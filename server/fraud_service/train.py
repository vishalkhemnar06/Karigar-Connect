"""
server/fraud_service/train.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Train XGBoost fraud-detection models for workers and clients.
Saves model (.pkl), SHAP explainer (.pkl) and metrics (.json)
to server/fraud_service/models/

Usage (from server/fraud_service/):
    python train.py \
      --workers ../../fraud_workers_50k.csv \
      --clients ../../fraud_clients_50k.csv

Requirements:
    pip install xgboost shap scikit-learn pandas numpy imbalanced-learn
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import argparse, os, pickle, json, warnings
import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import (
    classification_report, roc_auc_score,
    f1_score, precision_score, recall_score,
    confusion_matrix, average_precision_score,
)
from sklearn.preprocessing import LabelEncoder
import shap

warnings.filterwarnings('ignore')

MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'fraud_service', 'models')

# ── Feature columns ── must match feature_eng.py exactly ─────────────────────
WORKER_FEATURES = [
    'account_age_days', 'doc_verified', 'has_id_proof', 'points',
    'phone_is_feature_phone', 'skills_count', 'experience_years',
    'has_emergency_contact', 'references_count', 'has_eshram_card',
    'portfolio_photos_count', 'profile_updates_30d', 'availability_toggles_7d',
    'logins_per_week', 'failed_logins_7d', 'device_changes_30d',
    'location_changes_30d', 'suspicious_ip_count',
    'total_applications', 'jobs_completed', 'job_cancellations_total',
    'cancel_within_grace_window_count', 'cancellation_rate', 'completion_rate',
    'jobs_running_now', 'avg_rating', 'rating_variance',
    'total_ratings_received', 'complaints_received_count',
    'complaints_filed_count', 'verification_status_enc',
]

CLIENT_FEATURES = [
    'account_age_days', 'doc_verified', 'has_id_proof',
    'phone_is_feature_phone', 'has_workplace_info', 'has_social_profile',
    'starred_workers_count', 'profile_updates_30d',
    'logins_per_week', 'failed_logins_7d', 'device_changes_30d',
    'location_changes_30d', 'suspicious_ip_count',
    'total_jobs_posted', 'jobs_completed_as_client',
    'jobs_cancelled_by_client', 'client_cancellation_rate',
    'client_completion_rate', 'application_toggle_count',
    'workers_accepted_then_removed', 'total_workers_hired',
    'avg_job_post_to_cancel_hours', 'avg_rating_given',
    'rating_variance_given', 'total_ratings_given',
    'complaints_received_count', 'complaints_filed_count',
    'verification_status_enc',
]

VERIF_MAP = {'pending': 0, 'approved': 1, 'rejected': 2, 'blocked': 3}


def encode(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df['verification_status_enc'] = (
        df['verification_status'].map(VERIF_MAP).fillna(0).astype(int)
    )
    return df


def engineer_extra_features(df: pd.DataFrame, role: str) -> pd.DataFrame:
    """Add derived features that improve model signal."""
    df = df.copy()

    if role == 'worker':
        # Risk score composite
        df['risk_composite'] = (
            df.get('failed_logins_7d', 0) * 2 +
            df.get('suspicious_ip_count', 0) * 3 +
            df.get('device_changes_30d', 0) +
            df.get('cancellation_rate', 0) * 5 +
            df.get('complaints_received_count', 0) * 2
        )
        df['trust_score'] = (
            df.get('doc_verified', 0) +
            df.get('has_id_proof', 0) +
            df.get('has_eshram_card', 0) +
            df.get('has_emergency_contact', 0) +
            df.get('references_count', 0)
        )
        df['activity_ratio'] = (
            df.get('logins_per_week', 0) /
            (df.get('profile_updates_30d', 0) + 1)
        ).clip(0, 50)
        df['cancel_to_app_ratio'] = (
            df.get('cancel_within_grace_window_count', 0) /
            (df.get('total_applications', 0) + 1)
        ).clip(0, 1)

    else:  # client
        df['risk_composite'] = (
            df.get('failed_logins_7d', 0) * 2 +
            df.get('suspicious_ip_count', 0) * 3 +
            df.get('device_changes_30d', 0) +
            df.get('client_cancellation_rate', 0) * 5 +
            df.get('workers_accepted_then_removed', 0) * 2
        )
        df['trust_score'] = (
            df.get('doc_verified', 0) +
            df.get('has_id_proof', 0) +
            df.get('has_workplace_info', 0) +
            df.get('has_social_profile', 0)
        )
        df['post_cancel_speed'] = (
            1 / (df.get('avg_job_post_to_cancel_hours', 999) + 1)
        ).clip(0, 1)

    return df


def train(df: pd.DataFrame, features: list, role: str):
    print(f'\n{"="*60}')
    print(f'  Training {role.upper()} model')
    print(f'{"="*60}')

    df = encode(df)

    # Fill missing features with 0
    for f in features:
        if f not in df.columns:
            df[f] = 0

    X, y = df[features].fillna(0), df['fraud_label']

    fraud_count = y.sum()
    legit_count = len(y) - fraud_count
    scale_pos_weight = legit_count / max(fraud_count, 1)

    print(f'  Total samples : {len(y):,}')
    print(f'  Fraud         : {fraud_count:,} ({fraud_count/len(y)*100:.1f}%)')
    print(f'  Legit         : {legit_count:,}')
    print(f'  scale_pos_weight: {scale_pos_weight:.2f}')

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = XGBClassifier(
        n_estimators=400,
        max_depth=6,
        learning_rate=0.07,
        subsample=0.8,
        colsample_bytree=0.75,
        min_child_weight=3,
        gamma=0.1,
        reg_alpha=0.1,
        reg_lambda=1.0,
        scale_pos_weight=scale_pos_weight,
        eval_metric='auc',
        random_state=42,
        n_jobs=-1,
        use_label_encoder=False,
    )

    model.fit(
        X_tr, y_tr,
        eval_set=[(X_te, y_te)],
        verbose=100,
        early_stopping_rounds=30,
    )

    y_pred = model.predict(X_te)
    y_prob = model.predict_proba(X_te)[:, 1]

    print(f'\n[{role.upper()}] Test Results:')
    print(classification_report(y_te, y_pred, target_names=['Legit', 'Fraud']))

    cm = confusion_matrix(y_te, y_pred)
    tn, fp, fn, tp = cm.ravel()
    print(f'  Confusion Matrix: TN={tn}, FP={fp}, FN={fn}, TP={tp}')

    auc    = roc_auc_score(y_te, y_prob)
    pr_auc = average_precision_score(y_te, y_prob)
    print(f'  AUC-ROC  : {auc:.4f}')
    print(f'  PR-AUC   : {pr_auc:.4f}')

    # Cross-validation AUC
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(
        XGBClassifier(
            n_estimators=model.best_iteration or 200,
            max_depth=6, learning_rate=0.07,
            subsample=0.8, colsample_bytree=0.75,
            scale_pos_weight=scale_pos_weight,
            eval_metric='auc', random_state=42, n_jobs=-1,
            use_label_encoder=False,
        ),
        X, y, cv=cv, scoring='roc_auc'
    )
    print(f'  CV AUC (5-fold): {cv_scores.mean():.4f} ± {cv_scores.std():.4f}')

    # SHAP explainer
    print(f'  Building SHAP explainer...')
    explainer = shap.TreeExplainer(model)

    metrics = {
        'role':          role,
        'features':      features,
        'n_estimators':  int(model.best_iteration or model.n_estimators),
        'f1':            round(float(f1_score(y_te, y_pred)),            4),
        'precision':     round(float(precision_score(y_te, y_pred)),     4),
        'recall':        round(float(recall_score(y_te, y_pred)),        4),
        'auc_roc':       round(float(auc),                               4),
        'pr_auc':        round(float(pr_auc),                            4),
        'cv_auc_mean':   round(float(cv_scores.mean()),                  4),
        'cv_auc_std':    round(float(cv_scores.std()),                   4),
        'confusion':     {'tn': int(tn), 'fp': int(fp), 'fn': int(fn), 'tp': int(tp)},
        'fraud_rate':    round(float(fraud_count / len(y)),              4),
        'train_samples': int(len(y_tr)),
        'test_samples':  int(len(y_te)),
    }

    return model, explainer, metrics


def save(model, explainer, metrics, role):
    os.makedirs(MODEL_DIR, exist_ok=True)
    with open(f'{MODEL_DIR}/xgb_{role}.pkl',        'wb') as f: pickle.dump(model,     f)
    with open(f'{MODEL_DIR}/shap_{role}.pkl',       'wb') as f: pickle.dump(explainer, f)
    with open(f'{MODEL_DIR}/metrics_{role}.json',   'w')  as f: json.dump(metrics,     f, indent=2)
    print(f'\n[{role.upper()}] ✅ Saved to {MODEL_DIR}/')
    print(f'  xgb_{role}.pkl  |  shap_{role}.pkl  |  metrics_{role}.json')


def main():
    p = argparse.ArgumentParser(description='Train KarigarConnect fraud detection models')
    p.add_argument('--workers', required=True, help='Path to workers CSV')
    p.add_argument('--clients', required=True, help='Path to clients CSV')
    p.add_argument('--model-dir', default=None, help='Override model output directory')
    args = p.parse_args()

    global MODEL_DIR
    if args.model_dir:
        MODEL_DIR = args.model_dir

    print('\n🔍 Loading datasets...')
    workers_df = pd.read_csv(args.workers)
    clients_df = pd.read_csv(args.clients)
    print(f'  Workers: {workers_df.shape[0]:,} rows | fraud rate: {workers_df.fraud_label.mean()*100:.1f}%')
    print(f'  Clients: {clients_df.shape[0]:,} rows | fraud rate: {clients_df.fraud_label.mean()*100:.1f}%')

    # Train worker model
    w_model, w_explainer, w_metrics = train(workers_df, WORKER_FEATURES, 'worker')
    save(w_model, w_explainer, w_metrics, 'worker')

    # Train client model
    c_model, c_explainer, c_metrics = train(clients_df, CLIENT_FEATURES, 'client')
    save(c_model, c_explainer, c_metrics, 'client')

    print('\n' + '='*60)
    print('  ✅ Both models trained and saved successfully!')
    print('='*60)
    print('\nNext step:')
    print('  cd server/fraud_service && python app.py')
    print()


if __name__ == '__main__':
    main()