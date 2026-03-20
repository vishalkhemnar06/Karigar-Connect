"""
server/fraud_service/scheduler/daily_scan.py
APScheduler cron job — runs every day at 2:00 AM,
calls the local /api/fraud/scan-all endpoint.
"""

import logging
import os

import requests
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger     = logging.getLogger(__name__)
_scheduler = None
FRAUD_SCAN_URL = os.environ.get('FRAUD_SERVICE_URL', 'http://localhost:5001')


def _run_scan():
    try:
        logger.info('[FraudScheduler] Starting daily batch scan...')
        resp = requests.post(f'{FRAUD_SCAN_URL}/api/fraud/scan-all', timeout=300)
        data = resp.json()
        logger.info(
            f'[FraudScheduler] Done — '
            f'scanned={data.get("scanned", 0)}, '
            f'flagged={data.get("flagged_count", 0)}'
        )
    except Exception as e:
        logger.error(f'[FraudScheduler] Scan failed: {e}')


def start_scheduler():
    global _scheduler
    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        _run_scan,
        trigger=CronTrigger(hour=2, minute=0),
        id='daily_fraud_scan',
        replace_existing=True,
    )
    _scheduler.start()
    logger.info('[FraudScheduler] Scheduled daily at 2:00 AM')
    return _scheduler


def stop_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown()