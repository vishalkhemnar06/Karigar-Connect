// server/config/staticFiles.js
// ─────────────────────────────────────────────────────────────────────────────
// FIXES: "Route GET /uploads/... not found"
//
// This module configures Express to serve the uploads/ directory as static
// files. Import and call setupStaticFiles(app) in your server.js / index.js
// BEFORE all other route registrations.
//
// Usage in server.js:
//   const { setupStaticFiles } = require('./config/staticFiles');
//   setupStaticFiles(app);
//   // ... then mount your routes
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const setupStaticFiles = (app) => {
    // Resolve the uploads directory relative to the server root
    const uploadsDir = path.join(__dirname, '..', 'uploads');

    // Create the directory if it doesn't exist yet (first boot)
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('[static] Created uploads directory:', uploadsDir);
    }

    // Serve everything under /uploads/* as static files
    // e.g. GET /uploads/1774198949153-4778611523.jpeg
    app.use('/uploads', express.static(uploadsDir, {
        // Allow up to 1 day cache for images
        maxAge: '1d',
        // Don't expose directory listings
        index: false,
        // Add content-disposition for PDF/doc files so browsers open them
        setHeaders: (res, filePath) => {
            const ext = path.extname(filePath).toLowerCase();
            if (ext === '.pdf') {
                res.setHeader('Content-Disposition', 'inline');
                res.setHeader('Content-Type', 'application/pdf');
            } else if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
                res.setHeader('Content-Type', `image/${ext === '.jpg' ? 'jpeg' : ext.slice(1)}`);
            }
        },
    }));

    console.log('[static] Serving uploads from:', uploadsDir);
    console.log('[static] Accessible at: /uploads/<filename>');
};

module.exports = { setupStaticFiles };