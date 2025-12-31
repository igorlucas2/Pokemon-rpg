-- Migration: Poké Mart System
-- Creates tables for items, inventory, and shop configuration

-- Items catalog (from FireRed)
CREATE TABLE IF NOT EXISTS items (
  item_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  sell_price INTEGER GENERATED ALWAYS AS (price / 2) STORED,
  category TEXT,
  pocket TEXT,
  description TEXT,
  hold_effect TEXT,
  hold_effect_param INTEGER DEFAULT 0,
  battle_usage INTEGER DEFAULT 0,
  field_use_func TEXT,
  icon_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Player inventory
CREATE TABLE IF NOT EXISTS player_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(item_id),
  UNIQUE(user_id, item_id)
);

-- Add shop_type to NPCs table (if not exists)
-- This will be done via ALTER TABLE in the import script to avoid errors

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_player_inventory_user ON player_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_player_inventory_item ON player_inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_pocket ON items(pocket);
