/**
 * Item Service
 * 
 * Manages items, inventory, and item effects
 */

const { getDb } = require('./db');

/**
 * Get item by ID
 */
function getItemById(itemId) {
    const db = getDb();
    const stmt = db.prepare(`SELECT * FROM items WHERE item_id = ?`);
    return stmt.get(itemId);
}

/**
 * Get items by category/pocket
 */
function getItemsByPocket(pocket) {
    const db = getDb();
    const stmt = db.prepare(`SELECT * FROM items WHERE pocket = ? ORDER BY price ASC`);
    return stmt.all(pocket);
}

/**
 * Get all shop items (Poké Mart inventory)
 */
function getShopItems() {
    const db = getDb();
    const pokemartItems = [
        'ITEM_POKE_BALL', 'ITEM_GREAT_BALL', 'ITEM_ULTRA_BALL',
        'ITEM_POTION', 'ITEM_SUPER_POTION', 'ITEM_HYPER_POTION', 'ITEM_MAX_POTION', 'ITEM_FULL_RESTORE',
        'ITEM_REVIVE', 'ITEM_MAX_REVIVE',
        'ITEM_ANTIDOTE', 'ITEM_PARALYZE_HEAL', 'ITEM_BURN_HEAL', 'ITEM_ICE_HEAL', 'ITEM_AWAKENING', 'ITEM_FULL_HEAL',
        'ITEM_ESCAPE_ROPE', 'ITEM_REPEL', 'ITEM_SUPER_REPEL', 'ITEM_MAX_REPEL'
    ];
    const placeholders = pokemartItems.map(() => '?').join(',');
    const stmt = db.prepare(`SELECT * FROM items WHERE item_id IN (${placeholders}) ORDER BY price ASC`);
    return stmt.all(...pokemartItems);
}

/**
 * Get player inventory
 */
function getPlayerInventory(userId) {
    const db = getDb();
    const stmt = db.prepare(`
    SELECT pi.id, pi.item_id, pi.quantity, i.name, i.price, i.sell_price, i.category, i.description, i.icon_url
    FROM player_inventory pi
    JOIN items i ON pi.item_id = i.item_id
    WHERE pi.user_id = ? AND pi.quantity > 0
    ORDER BY i.pocket, i.price DESC
  `);
    return stmt.all(userId);
}

/**
 * Add item to player inventory
 */
function addItemToInventory(userId, itemId, quantity) {
    const db = getDb();
    const stmt = db.prepare(`
    INSERT INTO player_inventory (user_id, item_id, quantity)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = CURRENT_TIMESTAMP
  `);
    try {
        stmt.run(userId, itemId, quantity);
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * Remove item from player inventory
 */
function removeItemFromInventory(userId, itemId, quantity) {
    const db = getDb();
    const checkStmt = db.prepare(`SELECT quantity FROM player_inventory WHERE user_id = ? AND item_id = ?`);
    const current = checkStmt.get(userId, itemId);
    if (!current || current.quantity < quantity) return { ok: false, error: 'insufficient_quantity' };

    const newQuantity = current.quantity - quantity;
    if (newQuantity <= 0) {
        const deleteStmt = db.prepare(`DELETE FROM player_inventory WHERE user_id = ? AND item_id = ?`);
        deleteStmt.run(userId, itemId);
    } else {
        const updateStmt = db.prepare(`UPDATE player_inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND item_id = ?`);
        updateStmt.run(newQuantity, userId, itemId);
    }
    return { ok: true, newQuantity };
}

/**
 * Get item effect type and parameters
 */
function getItemEffect(itemId) {
    const effects = {
        'ITEM_POTION': { type: 'heal_hp', amount: 20 },
        'ITEM_SUPER_POTION': { type: 'heal_hp', amount: 50 },
        'ITEM_HYPER_POTION': { type: 'heal_hp', amount: 200 },
        'ITEM_MAX_POTION': { type: 'heal_hp', amount: 999999 },
        'ITEM_FULL_RESTORE': { type: 'heal_hp_status', amount: 999999 },
        'ITEM_ANTIDOTE': { type: 'cure_status', status: 'poison' },
        'ITEM_PARALYZE_HEAL': { type: 'cure_status', status: 'paralysis' },
        'ITEM_BURN_HEAL': { type: 'cure_status', status: 'burn' },
        'ITEM_ICE_HEAL': { type: 'cure_status', status: 'freeze' },
        'ITEM_AWAKENING': { type: 'cure_status', status: 'sleep' },
        'ITEM_FULL_HEAL': { type: 'cure_all_status' },
        'ITEM_REVIVE': { type: 'revive', hpPercent: 50 },
        'ITEM_MAX_REVIVE': { type: 'revive', hpPercent: 100 }
    };
    return effects[itemId] || { type: 'unknown' };
}

/**
 * Apply item effect to a Pokémon
 */
function applyItemEffect(userId, itemId, targetPokemonId) {
    const db = getDb();
    const trainerStore = require('../store/trainerStore');
    const effect = getItemEffect(itemId);
    if (!effect || effect.type === 'unknown') return { ok: false, error: 'unknown_item_effect' };

    const { party } = trainerStore.getTrainerWithPokemonsByUserId(userId);
    const pokemon = party.find(p => p.id === targetPokemonId);
    if (!pokemon) return { ok: false, error: 'pokemon_not_found' };

    let result = { ok: true, effect: effect.type };

    if (effect.type === 'heal_hp') {
        if (pokemon.currentHp <= 0) return { ok: false, error: 'pokemon_fainted' };
        const newHp = Math.min(pokemon.maxHp, pokemon.currentHp + effect.amount);
        db.prepare(`UPDATE trainer_pokemon SET currentHp = ? WHERE id = ?`).run(newHp, targetPokemonId);
        result.healed = newHp - pokemon.currentHp;
        result.newHp = newHp;
    } else if (effect.type === 'heal_hp_status') {
        if (pokemon.currentHp <= 0) return { ok: false, error: 'pokemon_fainted' };
        db.prepare(`UPDATE trainer_pokemon SET currentHp = ?, status = NULL WHERE id = ?`).run(pokemon.maxHp, targetPokemonId);
        result.healed = pokemon.maxHp - pokemon.currentHp;
        result.newHp = pokemon.maxHp;
        result.statusCured = true;
    } else if (effect.type === 'cure_status' || effect.type === 'cure_all_status') {
        db.prepare(`UPDATE trainer_pokemon SET status = NULL WHERE id = ?`).run(targetPokemonId);
        result.statusCured = true;
    } else if (effect.type === 'revive') {
        if (pokemon.currentHp > 0) return { ok: false, error: 'pokemon_not_fainted' };
        const newHp = Math.floor(pokemon.maxHp * (effect.hpPercent / 100));
        db.prepare(`UPDATE trainer_pokemon SET currentHp = ?, status = NULL WHERE id = ?`).run(newHp, targetPokemonId);
        result.revived = true;
        result.newHp = newHp;
    }

    return result;
}

module.exports = {
    getItemById,
    getItemsByPocket,
    getShopItems,
    getPlayerInventory,
    addItemToInventory,
    removeItemFromInventory,
    getItemEffect,
    applyItemEffect
};
