// server/utils/fraudService.js
// BUGFIX: Use explicit IPv4 address 127.0.0.1 in the fallback URL.
//         Node.js resolves "localhost" → ::1 (IPv6) on modern systems,
//         which causes ECONNREFUSED when Python only binds on 127.0.0.1.
//         Set FRAUD_SERVICE_URL=http://127.0.0.1:5001 in your .env to be explicit.

const axios = require('axios');

// FIX: was 'http://localhost:5001' — "localhost" → ::1 on modern Node → ECONNREFUSED
const FRAUD_SERVICE_URL = process.env.FRAUD_SERVICE_URL || 'http://127.0.0.1:5001';

const fraudApi = axios.create({
    baseURL: FRAUD_SERVICE_URL,
    timeout: 30000,
});

const handleServiceError = (error, operation) => {
    if (error.code === 'ECONNREFUSED') {
        const err = new Error('Fraud detection service is offline. Please ensure the Python service is running on port 5001.');
        err.status = 503;
        throw err;
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        const err = new Error('Fraud detection service timed out.');
        err.status = 504;
        throw err;
    }
    if (error.response) {
        const err = new Error(error.response.data?.error || error.response.data?.message || `Fraud service error during ${operation}`);
        err.status = error.response.status;
        err.details = error.response.data;
        throw err;
    }
    throw error;
};

exports.getFraudQueue = async (params = {}) => {
    try {
        const { data } = await fraudApi.get('/api/fraud/queue', { params });
        return data;
    } catch (error) {
        handleServiceError(error, 'getFraudQueue');
    }
};

exports.getFraudMetrics = async () => {
    try {
        const { data } = await fraudApi.get('/api/fraud/metrics');
        return data;
    } catch (error) {
        handleServiceError(error, 'getFraudMetrics');
    }
};

exports.getFraudStats = async () => {
    try {
        const { data } = await fraudApi.get('/api/fraud/stats');
        return data;
    } catch (error) {
        handleServiceError(error, 'getFraudStats');
    }
};

exports.getFraudActions = async (params = {}) => {
    try {
        const { data } = await fraudApi.get('/api/fraud/actions', { params });
        return data;
    } catch (error) {
        handleServiceError(error, 'getFraudActions');
    }
};

exports.triggerFullScan = async () => {
    try {
        const { data } = await fraudApi.post('/api/fraud/scan-all');
        return data;
    } catch (error) {
        handleServiceError(error, 'triggerFullScan');
    }
};

exports.takeFraudAction = async (body) => {
    try {
        const { data } = await fraudApi.post('/api/fraud/action', body);
        return data;
    } catch (error) {
        handleServiceError(error, 'takeFraudAction');
    }
};

exports.dismissFraudQueueItem = async (userId) => {
    try {
        const { data } = await fraudApi.delete(`/api/fraud/queue/${userId}`);
        return data;
    } catch (error) {
        handleServiceError(error, 'dismissFraudQueueItem');
    }
};

exports.getFraudHealth = async () => {
    try {
        const { data } = await fraudApi.get('/health');
        return data;
    } catch (error) {
        handleServiceError(error, 'getFraudHealth');
    }
};