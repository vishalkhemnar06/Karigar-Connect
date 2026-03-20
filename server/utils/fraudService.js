const axios = require('axios');

const fraudApi = axios.create({
    baseURL: process.env.FRAUD_SERVICE_URL || 'http://localhost:5001',
    timeout: 30000,
});

const proxyFraudError = (error) => {
    const status = error.response?.status || 502;
    const message = error.response?.data?.error || error.response?.data?.message || error.message || 'Fraud service request failed.';
    const wrapped = new Error(message);
    wrapped.status = status;
    wrapped.details = error.response?.data;
    return wrapped;
};

const getFraudQueue = async (params = {}) => {
    try {
        const { data } = await fraudApi.get('/api/fraud/queue', { params });
        return data;
    } catch (error) {
        throw proxyFraudError(error);
    }
};

const getFraudMetrics = async () => {
    try {
        const { data } = await fraudApi.get('/api/fraud/metrics');
        return data;
    } catch (error) {
        throw proxyFraudError(error);
    }
};

const getFraudStats = async () => {
    try {
        const { data } = await fraudApi.get('/api/fraud/stats');
        return data;
    } catch (error) {
        throw proxyFraudError(error);
    }
};

const getFraudActions = async (params = {}) => {
    try {
        const { data } = await fraudApi.get('/api/fraud/actions', { params });
        return data;
    } catch (error) {
        throw proxyFraudError(error);
    }
};

const triggerFullScan = async () => {
    try {
        const { data } = await fraudApi.post('/api/fraud/scan-all');
        return data;
    } catch (error) {
        throw proxyFraudError(error);
    }
};

const takeFraudAction = async (payload) => {
    try {
        const { data } = await fraudApi.post('/api/fraud/action', payload);
        return data;
    } catch (error) {
        throw proxyFraudError(error);
    }
};

const dismissFraudQueueItem = async (userId) => {
    try {
        const { data } = await fraudApi.delete(`/api/fraud/queue/${userId}`);
        return data;
    } catch (error) {
        throw proxyFraudError(error);
    }
};

const getFraudHealth = async () => {
    try {
        const { data } = await fraudApi.get('/health');
        return data;
    } catch (error) {
        throw proxyFraudError(error);
    }
};

module.exports = {
    getFraudQueue,
    getFraudMetrics,
    getFraudStats,
    getFraudActions,
    triggerFullScan,
    takeFraudAction,
    dismissFraudQueueItem,
    getFraudHealth,
};