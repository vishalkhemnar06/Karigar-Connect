// client/src/api/shopInterceptor.js
// Injects shopToken for all /api/shop/ requests (except auth endpoints).
// Import this ONCE at the top of App.jsx.

import API from './index';

API.interceptors.request.use((req) => {
    const url = req.url || '';
    // Apply shopToken for protected shop routes only
    if (url.startsWith('/api/shop/') && !url.startsWith('/api/shop/auth/')) {
        const shopToken = localStorage.getItem('shopToken');
        if (shopToken) {
            req.headers.Authorization = `Bearer ${shopToken}`;
        }
    }
    return req;
});