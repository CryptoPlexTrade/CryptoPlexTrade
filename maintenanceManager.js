/**
 * maintenanceManager.js
 * Shared module for maintenance mode state.
 * Both server.js and adminRoutes.js import from here
 * so admin writes and the middleware read from the same in-memory cache.
 */
const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'maintenance.json');

let cache = null;

function get() {
    if (cache) return cache;
    try {
        cache = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return cache;
    } catch {
        return { active: false, message: '', updatedAt: '' };
    }
}

function save(data) {
    cache = data; // Always update in-memory (works on Vercel)
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch {
        // Vercel read-only FS — in-memory cache is the source of truth
    }
}

module.exports = { get, save };
