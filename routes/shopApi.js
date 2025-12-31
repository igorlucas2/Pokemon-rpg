/**
 * Shop API Routes
 * 
 * Handles Poké Mart buy/sell transactions
 */

const express = require('express');
const router = express.Router();
const shopService = require('../services/shopService');
const itemService = require('../services/itemService');

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ ok: false, error: 'not_authenticated' });
  }
  next();
}

/**
 * GET /api/shop/inventory/:shopType
 * Get shop inventory
 */
router.get('/inventory/:shopType', requireAuth, (req, res) => {
  const shopType = req.params.shopType || 'pokemart';

  try {
    const items = shopService.getShopInventory(shopType);
    return res.json({
      ok: true,
      shopType,
      items: items.map(item => ({
        itemId: item.item_id,
        name: item.name,
        price: item.price,
        sellPrice: item.sell_price,
        category: item.category,
        description: item.description,
        icon: item.icon_url
      }))
    });
  } catch (error) {
    console.error('Error getting shop inventory:', error);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

/**
 * GET /api/shop/inventory (default to pokemart)
 */
router.get('/inventory', requireAuth, (req, res) => {
  try {
    const items = shopService.getShopInventory('pokemart');
    return res.json({
      ok: true,
      shopType: 'pokemart',
      items: items.map(item => ({
        itemId: item.item_id,
        name: item.name,
        price: item.price,
        sellPrice: item.sell_price,
        category: item.category,
        description: item.description,
        icon: item.icon_url
      }))
    });
  } catch (error) {
    console.error('Error getting shop inventory:', error);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

/**
 * POST /api/shop/buy
 * Buy items from shop
 * Body: { items: [{ itemId, quantity }] }
 */
router.post('/buy', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ ok: false, error: 'invalid_request' });
  }

  const result = shopService.buyItems(userId, items);

  if (!result.ok) {
    const status = result.error === 'insufficient_funds' ? 402 : 400;
    return res.status(status).json(result);
  }

  return res.json(result);
});

/**
 * POST /api/shop/sell
 * Sell items to shop
 * Body: { items: [{ itemId, quantity }] }
 */
router.post('/sell', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ ok: false, error: 'invalid_request' });
  }

  const result = shopService.sellItems(userId, items);

  if (!result.ok) {
    const status = result.error === 'insufficient_quantity' ? 409 : 400;
    return res.status(status).json(result);
  }

  return res.json(result);
});

/**
 * POST /api/item/use
 * Use an item on a Pokémon
 * Body: { itemId, targetPokemonId }
 */
router.post('/use', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const { itemId, targetPokemonId } = req.body;

  if (!itemId || !targetPokemonId) {
    return res.status(400).json({ ok: false, error: 'missing_parameters' });
  }

  // Check if player has the item
  const inventory = itemService.getPlayerInventory(userId);
  const playerItem = inventory.find(i => i.item_id === itemId);

  if (!playerItem || playerItem.quantity <= 0) {
    return res.status(404).json({ ok: false, error: 'item_not_found' });
  }

  // Apply item effect
  const result = itemService.applyItemEffect(userId, itemId, targetPokemonId);

  if (!result.ok) {
    return res.status(400).json(result);
  }

  // Remove item from inventory
  const removeResult = itemService.removeItemFromInventory(userId, itemId, 1);
  if (!removeResult.ok) {
    return res.status(500).json({ ok: false, error: 'failed_to_remove_item' });
  }

  return res.json({
    ok: true,
    effect: result.effect,
    healed: result.healed,
    newHp: result.newHp,
    statusCured: result.statusCured,
    revived: result.revived,
    remainingQuantity: removeResult.newQuantity || 0
  });
});

/**
 * GET /api/shop/player-inventory
 * Get player's inventory
 */
router.get('/player-inventory', requireAuth, (req, res) => {
  const userId = req.session.user.id;

  try {
    const inventory = itemService.getPlayerInventory(userId);
    return res.json({
      ok: true,
      items: inventory.map(item => ({
        id: item.id,
        itemId: item.item_id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        sellPrice: item.sell_price,
        category: item.category,
        description: item.description,
        icon: item.icon_url
      }))
    });
  } catch (error) {
    console.error('Error getting inventory:', error);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

module.exports = router;
