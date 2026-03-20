"""
server/fraud_service/utils/model_loader.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Loads XGBoost models + SHAP explainers once at Flask startup.
Exposes predict() used by route handlers.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import os, pickle, json
import pandas as pd
import numpy as np

MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')

# ── Feature columns — must match train.py & feature_eng.py exactly ───────────
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

# Human-readable labels for SHAP features shown in admin dashboard
FEATURE_LABELS = {
    # Worker
    'cancel_within_grace_window_count': 'Cancellations within 45-min grace window',
    'cancellation_rate':                'High job cancellation rate',
    'failed_logins_7d':                 'Multiple failed login attempts (7d)',
    'suspicious_ip_count':              'Suspicious IP addresses detected',
    'device_changes_30d':               'Frequent device switching (30d)',
    'complaints_received_count':        'Multiple complaints received',
    'doc_verified':                     'Identity document not verified',
    'has_id_proof':                     'No ID proof uploaded',
    'points':                           'Very low or negative points balance',
    'skills_count':                     'No skills listed on profile',
    'has_emergency_contact':            'No emergency contact provided',
    'has_eshram_card':                  'No eShram card registered',
    'portfolio_photos_count':           'No portfolio photos uploaded',
    'account_age_days':                 'Very new account',
    'avg_rating':                       'Low average rating from clients',
    'rating_variance':                  'Highly inconsistent ratings received',
    'availability_toggles_7d':          'Excessive availability toggling (7d)',
    'profile_updates_30d':              'Excessive profile edits (30d)',
    'location_changes_30d':             'Frequent location changes (30d)',
    'job_cancellations_total':          'High total job cancellations',
    'completion_rate':                  'Very low job completion rate',
    'verification_status_enc':          'Account status is rejected or blocked',
    'phone_is_feature_phone':           'Using feature phone (limited verification)',
    'references_count':                 'No references provided',
    'experience_years':                 'No experience listed',
    'total_ratings_received':           'Very few ratings received',
    'total_applications':               'No job applications made',
    'jobs_running_now':                 'Multiple simultaneous jobs (suspicious)',
    # Client
    'workers_accepted_then_removed':    'Workers hired then removed before job start',
    'application_toggle_count':         'Rapid open/close of job applications',
    'avg_job_post_to_cancel_hours':     'Jobs cancelled very quickly after posting',
    'jobs_cancelled_by_client':         'High number of client-side cancellations',
    'client_cancellation_rate':         'High client cancellation rate',
    'complaints_filed_count':           'Filed many complaints against others',
    'has_workplace_info':               'No workplace information provided',
    'has_social_profile':               'No social profile linked',
    'starred_workers_count':            'Never starred any workers (low engagement)',
    'total_ratings_given':              'Never submitted ratings for workers',
    'rating_variance_given':            'Gives wildly inconsistent ratings',
    'avg_rating_given':                 'Gives unusually extreme ratings',
    'total_jobs_posted':                'Never posted any jobs',
    'total_workers_hired':              'Never hired any workers',
}

# Thresholds for fraud risk levels
RISK_THRESHOLDS = {
    'HIGH':   0.80,
    'MEDIUM': 0.60,
    'LOW':    0.40,
    # Below 0.40 = SAFE (not flagged)
}


class FraudModelLoader:
    def __init__(self):
        self.models    = {}
        self.explainers = {}
        self.metrics   = {}
        self._load()

    def _load(self):
        for role in ('worker', 'client'):
            mp = os.path.join(MODEL_DIR, f'xgb_{role}.pkl')
            sp = os.path.join(MODEL_DIR, f'shap_{role}.pkl')
            ep = os.path.join(MODEL_DIR, f'metrics_{role}.json')

            if not os.path.exists(mp):
                raise FileNotFoundError(
                    f'Model not found: {mp}\n'
                    f'Run: cd server/fraud_service && python train.py '
                    f'--workers <csv> --clients <csv>'
                )
            with open(mp, 'rb') as f: self.models[role]      = pickle.load(f)
            with open(sp, 'rb') as f: self.explainers[role]  = pickle.load(f)
            with open(ep)       as f: self.metrics[role]      = json.load(f)

    def _features(self, role: str) -> list:
        return WORKER_FEATURES if role == 'worker' else CLIENT_FEATURES

    def predict(self, feature_dict: dict, role: str) -> dict:
        features = self._features(role)
        X = pd.DataFrame([feature_dict])[features].fillna(0)
        prob = float(self.models[role].predict_proba(X)[0][1])

        if prob >= RISK_THRESHOLDS['HIGH']:
            risk_level = 'HIGH'
        elif prob >= RISK_THRESHOLDS['MEDIUM']:
            risk_level = 'MEDIUM'
        elif prob >= RISK_THRESHOLDS['LOW']:
            risk_level = 'LOW'
        else:
            risk_level = 'SAFE'

        is_fraud    = prob >= 0.50
        top_reasons = self._explain(X, role, features)

        return {
            'fraud_probability': round(prob, 4),
            'fraud_percent':     round(prob * 100, 1),
            'is_fraud':          is_fraud,
            'risk_level':        risk_level,
            'top_reasons':       top_reasons,
        }

    def _explain(self, X: pd.DataFrame, role: str, features: list) -> list:
        """Top SHAP-driven reasons pushing score toward fraud."""
        shap_vals = self.explainers[role].shap_values(X)

        if isinstance(shap_vals, list):
            vals = shap_vals[1][0]
        else:
            vals = shap_vals[0]

        ranked  = sorted(enumerate(vals), key=lambda x: x[1], reverse=True)
        reasons = []
        for idx, sv in ranked[:6]:
            if sv <= 0:
                break
            feat = features[idx]
            reasons.append({
                'feature':    feat,
                'label':      FEATURE_LABELS.get(feat, feat.replace('_', ' ').title()),
                'shap_value': round(float(sv), 4),
                'raw_value':  float(X.iloc[0][feat]),
            })
        return reasons[:3]

    def get_metrics(self, role: str) -> dict:
        return self.metrics.get(role, {})

    def get_all_metrics(self) -> dict:
        return {
            'worker': self.get_metrics('worker'),
            'client': self.get_metrics('client'),
        }


# ── Singleton loaded once when Flask starts ───────────────────────────────────
_loader: FraudModelLoader = None


def get_loader() -> FraudModelLoader:
    global _loader
    if _loader is None:
        _loader = FraudModelLoader()
    return _loader