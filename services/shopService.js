/**
 * Shop Service
 * 
 * Handles buy/sell transactions for Poké Marts
 */

const { getDb } = require('./db');
const itemService = require('./itemService');
const trainerStore = require('../store/trainerStore');

/**
 * Get shop inventory by shop type
 */
function getShopInventory(shopType = 'pokemart') {
    if (shopType === 'pokemart') {
        return itemService.getShopItems();
    }

    // Future: other shop types (pharmacy, department store, etc)
    return [];
}

/**
 * Buy items from shop
 */
function buyItems(userId, items) {
    if (!Array.isArray(items) || items.length === 0) {
        return { ok: false, error: 'invalid_items' };
    }

    // Calculate total cost
    let totalCost = 0;
    const itemDetails = [];

    for (const { itemId, quantity } of items) {
        if (!itemId || !Number.isInteger(quantity) || quantity <= 0) {
            return { ok: false, error: 'invalid_item_data' };
        }

        const item = itemService.getItemById(itemId);
        if (!item) {
            return { ok: false, error: 'item_not_found', itemId };
        }

        const cost = item.price * quantity;
        totalCost += cost;
        itemDetails.push({ item, quantity, cost });
    }

    // Check if player has enough money
    const trainer = trainerStore.getTrainerByUserId(userId);
    if (!trainer) {
        return { ok: false, error: 'trainer_not_found' };
    }

    const currentMoney = Number(trainer.money || 0);
    if (currentMoney < totalCost) {
        return { ok: false, error: 'insufficient_funds', required: totalCost, current: currentMoney };
    }

    // Execute transaction
    const db = getDb();
    const transaction = db.transaction(() => {
        // Deduct money
        const updateMoneyStmt = db.prepare(`
      UPDATE trainers
      SET money = money - ?
      WHERE user_id = ?
    `);
        updateMoneyStmt.run(totalCost, userId);

        // Add items to inventory
        for (const { item, quantity } of itemDetails) {
            itemService.addItemToInventory(userId, item.item_id, quantity);
        }
    });

    try {
        transaction();
        return {
            ok: true,
            totalCost,
            newBalance: currentMoney - totalCost,
            itemsPurchased: itemDetails.map(d => ({
                itemId: d.item.item_id,
                name: d.item.name,
                quantity: d.quantity,
                cost: d.cost
            }))
        };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * Sell items to shop (50% of buy price)
 */
function sellItems(userId, items) {
    if (!Array.isArray(items) || items.length === 0) {
        return { ok: false, error: 'invalid_items' };
    }

    // Calculate total value
    let totalValue = 0;
    const itemDetails = [];

    for (const { itemId, quantity } of items) {
        if (!itemId || !Number.isInteger(quantity) || quantity <= 0) {
            return { ok: false, error: 'invalid_item_data' };
        }

        const item = itemService.getItemById(itemId);
        if (!item) {
            return { ok: false, error: 'item_not_found', itemId };
        }

        // Check if player has the item
        const inventory = itemService.getPlayerInventory(userId);
        const playerItem = inventory.find(i => i.item_id === itemId);

        if (!playerItem || playerItem.quantity < quantity) {
            return { ok: false, error: 'insufficient_quantity', itemId, required: quantity, current: playerItem?.quantity || 0 };
        }

        const sellPrice = Math.floor(item.price / 2); // 50% of buy price
        const value = sellPrice * quantity;
        totalValue += value;
        itemDetails.push({ item, quantity, value, sellPrice });
    }

    // Execute transaction
    const db = getDb();
    const transaction = db.transaction(() => {
        // Add money
        const updateMoneyStmt = db.prepare(`
      UPDATE trainers
      SET money = money + ?
      WHERE user_id = ?
    `);
        updateMoneyStmt.run(totalValue, userId);

        // Remove items from inventory
        for (const { item, quantity } of itemDetails) {
            itemService.removeItemFromInventory(userId, item.item_id, quantity);
        }
    });

    try {
        transaction();

        const trainer = trainerStore.getTrainerByUserId(userId);
        const newBalance = Number(trainer.money || 0);

        return {
            ok: true,
            totalValue,
            newBalance,
            itemsSold: itemDetails.map(d => ({
                itemId: d.item.item_id,
                name: d.item.name,
                quantity: d.quantity,
                value: d.value,
                sellPrice: d.sellPrice
            }))
        };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * Calculate transaction total
 */
function calculateTotal(items, isSelling = false) {
    let total = 0;

    for (const { itemId, quantity } of items) {
        const item = itemService.getItemById(itemId);
        if (!item) continue;

        const price = isSelling ? Math.floor(item.price / 2) : item.price;
        total += price * quantity;
    }

    return total;
}

module.exports = {
    getShopInventory,
    buyItems,
    sellItems,
    calculateTotal
};
