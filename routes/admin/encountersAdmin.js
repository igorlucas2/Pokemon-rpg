/**
 * Wild Encounters Admin Routes
 * 
 * API routes for managing wild Pokemon encounters
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../../services/db');

/**
 * GET /admin/encounters
 * List all routes with encounter data
 */
router.get('/', (req, res) => {
    try {
        const db = getDb();

        // Get all unique map IDs with encounter counts
        const maps = db.prepare(`
      SELECT 
        map_id,
        COUNT(*) as total_encounters,
        SUM(CASE WHEN encounter_type = 'grass' THEN 1 ELSE 0 END) as grass_count,
        SUM(CASE WHEN encounter_type = 'water' THEN 1 ELSE 0 END) as water_count,
        SUM(CASE WHEN encounter_type = 'fishing' THEN 1 ELSE 0 END) as fishing_count,
        SUM(CASE WHEN encounter_type = 'rock_smash' THEN 1 ELSE 0 END) as rock_smash_count
      FROM wild_encounters
      GROUP BY map_id
      ORDER BY map_id
    `).all();

        // Get all Pokemon for dropdown
        const pokemon = db.prepare('SELECT id, name FROM pokemon ORDER BY id').all();

        res.render('admin_encounters', { maps });
    } catch (err) {
        console.error('Error loading encounters:', err);
        res.status(500).send('Error loading encounters');
    }
});

/**
 * GET /api/pokemon
 * Get list of all Pokemon
 */
router.get('/api/pokemon', (req, res) => {
    try {
        const db = getDb();
        const pokemon = db.prepare('SELECT id, name FROM pokemon ORDER BY id').all();
        res.json({ ok: true, pokemon });
    } catch (err) {
        console.error('Error fetching Pokemon:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * GET /admin/encounters/api/:mapId
 * Get encounters for a specific map
 */
router.get('/api/:mapId', (req, res) => {
    try {
        const { mapId } = req.params;
        const { type } = req.query; // grass, water, fishing, rock_smash

        const db = getDb();

        let query = `
      SELECT 
        we.*,
        p.name as pokemon_name
      FROM wild_encounters we
      JOIN pokemon p ON we.pokemon_id = p.id
      WHERE we.map_id = ?
    `;

        const params = [mapId];

        if (type) {
            query += ' AND we.encounter_type = ?';
            params.push(type);
        }

        query += ' ORDER BY we.encounter_type, we.slot_number';

        const encounters = db.prepare(query).all(...params);

        res.json({ ok: true, encounters });
    } catch (err) {
        console.error('Error fetching encounters:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * POST /api/admin/encounters
 * Create or update encounter slot
 */
router.post('/api/encounters', (req, res) => {
    try {
        const { mapId, encounterType, slotNumber, pokemonId, minLevel, maxLevel, probability } = req.body;

        // Validation
        if (!mapId || !encounterType || slotNumber === undefined || !pokemonId) {
            return res.status(400).json({ ok: false, error: 'Missing required fields' });
        }

        if (minLevel < 1 || minLevel > 100 || maxLevel < 1 || maxLevel > 100) {
            return res.status(400).json({ ok: false, error: 'Invalid level range (1-100)' });
        }

        if (minLevel > maxLevel) {
            return res.status(400).json({ ok: false, error: 'Min level cannot be greater than max level' });
        }

        if (probability < 0 || probability > 100) {
            return res.status(400).json({ ok: false, error: 'Invalid probability (0-100)' });
        }

        const db = getDb();

        // Insert or replace
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO wild_encounters 
      (map_id, encounter_type, slot_number, pokemon_id, min_level, max_level, probability, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

        stmt.run(mapId, encounterType, slotNumber, pokemonId, minLevel, maxLevel, probability);

        res.json({ ok: true, message: 'Encounter saved successfully' });
    } catch (err) {
        console.error('Error saving encounter:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * DELETE /api/admin/encounters/:id
 * Delete encounter slot
 */
router.delete('/api/encounters/:id', (req, res) => {
    try {
        const { id } = req.params;

        const db = getDb();
        const stmt = db.prepare('DELETE FROM wild_encounters WHERE id = ?');
        stmt.run(id);

        res.json({ ok: true, message: 'Encounter deleted successfully' });
    } catch (err) {
        console.error('Error deleting encounter:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

/**
 * POST /api/admin/encounters/validate
 * Validate that probabilities sum to 100%
 */
router.post('/api/encounters/validate', (req, res) => {
    try {
        const { mapId, encounterType } = req.body;

        const db = getDb();
        const result = db.prepare(`
      SELECT SUM(probability) as total
      FROM wild_encounters
      WHERE map_id = ? AND encounter_type = ?
    `).get(mapId, encounterType);

        const total = result.total || 0;
        const isValid = Math.abs(total - 100) < 0.01; // Allow small floating point errors

        res.json({
            ok: true,
            total,
            isValid,
            message: isValid ? 'Valid' : `Total is ${total}%, should be 100%`
        });
    } catch (err) {
        console.error('Error validating encounters:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
