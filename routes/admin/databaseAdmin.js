/**
 * Database Admin Routes
 * 
 * Comprehensive database administration panel with CRUD operations
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../../services/db');

/**
 * GET /admin/database
 * Main database admin page
 */
router.get('/', (req, res) => {
    try {
        const db = getDb();

        // Get list of all tables
        const tables = db.prepare(`
            SELECT name 
            FROM sqlite_master 
            WHERE type='table' 
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `).all();

        // Get row count for each table
        const tablesWithCounts = tables.map(table => {
            const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
            return {
                name: table.name,
                rows: count.count
            };
        });

        res.render('admin_database', { tables: tablesWithCounts });
    } catch (err) {
        console.error('Error loading database admin:', err);
        res.status(500).send('Error loading database admin');
    }
});

/**
 * GET /api/tables
 * Get list of all tables with metadata
 */
router.get('/api/tables', (req, res) => {
    try {
        const db = getDb();

        const tables = db.prepare(`
            SELECT name 
            FROM sqlite_master 
            WHERE type='table' 
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `).all();

        const tablesWithInfo = tables.map(table => {
            const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
            return {
                name: table.name,
                rows: count.count
            };
        });

        res.json({ ok: true, tables: tablesWithInfo });
    } catch (err) {
        console.error('Error fetching tables:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * GET /api/table/:tableName/schema
 * Get schema information for a table
 */
router.get('/api/table/:tableName/schema', (req, res) => {
    try {
        const { tableName } = req.params;
        const db = getDb();

        // Validate table name
        const tableExists = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name=?
        `).get(tableName);

        if (!tableExists) {
            return res.status(404).json({ ok: false, error: 'Table not found' });
        }

        // Get table schema
        const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();

        res.json({ ok: true, schema });
    } catch (err) {
        console.error('Error fetching schema:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * GET /api/table/:tableName
 * Get paginated data from a table
 */
router.get('/api/table/:tableName', (req, res) => {
    try {
        const { tableName } = req.params;
        const { page = 1, limit = 50, search = '', orderBy = '', orderDir = 'ASC' } = req.query;

        const db = getDb();

        // Validate table name
        const tableExists = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name=?
        `).get(tableName);

        if (!tableExists) {
            return res.status(404).json({ ok: false, error: 'Table not found' });
        }

        // Get schema
        const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();

        // Build query
        let query = `SELECT * FROM ${tableName}`;
        const params = [];

        // Add search if provided
        if (search) {
            const searchConditions = schema.map(col => `${col.name} LIKE ?`).join(' OR ');
            query += ` WHERE ${searchConditions}`;
            schema.forEach(() => params.push(`%${search}%`));
        }

        // Add ordering
        if (orderBy && schema.find(col => col.name === orderBy)) {
            query += ` ORDER BY ${orderBy} ${orderDir}`;
        }

        // Get total count
        const countQuery = search
            ? `SELECT COUNT(*) as count FROM ${tableName} WHERE ${schema.map(col => `${col.name} LIKE ?`).join(' OR ')}`
            : `SELECT COUNT(*) as count FROM ${tableName}`;
        const total = db.prepare(countQuery).get(...params).count;

        // Add pagination
        const offset = (page - 1) * limit;
        query += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        // Execute query
        const data = db.prepare(query).all(...params);

        res.json({
            ok: true,
            table: tableName,
            schema,
            data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Error fetching table data:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * POST /api/table/:tableName
 * Create a new record
 */
router.post('/api/table/:tableName', (req, res) => {
    try {
        const { tableName } = req.params;
        const data = req.body;

        const db = getDb();

        // Get schema to validate fields
        const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const columns = schema.map(col => col.name).filter(name => name !== 'id'); // Exclude auto-increment id

        // Build INSERT query
        const placeholders = columns.map(() => '?').join(', ');
        const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

        const values = columns.map(col => data[col] || null);

        const result = db.prepare(query).run(...values);

        // Return created record
        const created = db.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`).get(result.lastInsertRowid);

        res.json({ ok: true, data: created });
    } catch (err) {
        console.error('Error creating record:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * PUT /api/table/:tableName/:id
 * Update a record
 */
router.put('/api/table/:tableName/:id', (req, res) => {
    try {
        const { tableName, id } = req.params;
        const data = req.body;

        const db = getDb();

        // Get schema
        const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const columns = schema.map(col => col.name).filter(name => name !== 'id');

        // Build UPDATE query
        const setClause = columns.map(col => `${col} = ?`).join(', ');
        const query = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;

        const values = [...columns.map(col => data[col] !== undefined ? data[col] : null), id];

        db.prepare(query).run(...values);

        // Return updated record
        const updated = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);

        res.json({ ok: true, data: updated });
    } catch (err) {
        console.error('Error updating record:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * DELETE /api/table/:tableName/:id
 * Delete a record
 */
router.delete('/api/table/:tableName/:id', (req, res) => {
    try {
        const { tableName, id } = req.params;
        const db = getDb();

        db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id);

        res.json({ ok: true, message: 'Record deleted' });
    } catch (err) {
        console.error('Error deleting record:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
