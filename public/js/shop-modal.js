/**
 * Enhanced Shop Modal
 * 
 * Poké Mart system with buy/sell tabs, cart functionality, and item management
 */

(() => {
  const $ = (id) => document.getElementById(id);

  const modal = $("shopModal");
  const closeBtn = $("shopModalClose");
  const grid = $("shopGrid");
  const status = $("shopStatus");

  if (!modal || !grid || !status) return;

  let currentNPC = null;
  let currentTab = 'buy'; // 'buy' or 'sell'
  let shopItems = [];
  let playerInventory = [];
  let playerMoney = 0;
  let cart = []; // { itemId, quantity, price }

  // Open shop modal
  function open(npc) {
    currentNPC = npc;
    currentTab = 'buy';
    cart = [];
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");

    // Update title
    const title = $("shopModalTitle");
    if (title) {
      title.textContent = npc?.name || 'Poké Mart';
    }

    loadShopData();
  }

  // Close shop modal
  function close() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    currentNPC = null;
    cart = [];
  }

  // Load shop and player data
  async function loadShopData() {
    status.textContent = "Carregando...";

    try {
      // Load shop inventory
      const shopRes = await fetch('/api/shop/inventory');
      const shopData = await shopRes.json();
      if (shopData.ok) {
        shopItems = shopData.items || [];
      } else {
        console.error('Shop inventory error:', shopData);
      }

      // Load player inventory
      const invRes = await fetch('/api/shop/player-inventory');
      const invData = await invRes.json();
      if (invData.ok) {
        playerInventory = invData.items || [];
      } else {
        console.error('Player inventory error:', invData);
      }

      // Load player money
      const trainerRes = await fetch('/api/trainer');
      const trainerData = await trainerRes.json();
      if (trainerData.ok) {
        playerMoney = trainerData.trainer?.money || 0;
      }

      render();
    } catch (error) {
      console.error('Error loading shop data:', error);
      status.textContent = "Erro ao carregar loja.";
    }
  }

  // Render shop UI
  function render() {
    const items = currentTab === 'buy' ? shopItems : playerInventory;

    if (!items.length) {
      grid.innerHTML = `
        <div class="shop-empty">
          <div class="shop-empty__icon">${currentTab === 'buy' ? '🏪' : '🎒'}</div>
          <div class="shop-empty__text">
            ${currentTab === 'buy' ? 'Nenhum item disponível' : 'Inventário vazio'}
          </div>
        </div>
      `;
      status.textContent = "—";
      return;
    }

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    grid.innerHTML = `
      <div class="shop-header">
        <div class="shop-tabs">
          <button class="shop-tab ${currentTab === 'buy' ? 'shop-tab--active' : ''}" onclick="window.shopModal.switchTab('buy')">
            🛒 Comprar
          </button>
          <button class="shop-tab ${currentTab === 'sell' ? 'shop-tab--active' : ''}" onclick="window.shopModal.switchTab('sell')">
            💰 Vender
          </button>
        </div>
        <div class="shop-money">
          <span class="shop-money__label">Dinheiro:</span>
          <span class="shop-money__value">₽${playerMoney.toLocaleString('pt-BR')}</span>
        </div>
      </div>

      <div class="shop-items">
        ${items.map(item => renderItem(item)).join('')}
      </div>

      ${cart.length > 0 ? `
        <div class="shop-cart">
          <div class="shop-cart__header">
            <span class="shop-cart__title">Carrinho (${cartCount} ${cartCount === 1 ? 'item' : 'itens'})</span>
            <button class="shop-cart__clear" onclick="window.shopModal.clearCart()">Limpar</button>
          </div>
          <div class="shop-cart__items">
            ${cart.map(item => `
              <div class="shop-cart__item">
                <span class="shop-cart__item-name">${escapeHtml(item.name)}</span>
                <span class="shop-cart__item-qty">x${item.quantity}</span>
                <span class="shop-cart__item-price">₽${(item.price * item.quantity).toLocaleString('pt-BR')}</span>
              </div>
            `).join('')}
          </div>
          <div class="shop-cart__footer">
            <span class="shop-cart__total-label">Total:</span>
            <span class="shop-cart__total-value">₽${cartTotal.toLocaleString('pt-BR')}</span>
          </div>
          <button class="shop-cart__checkout" onclick="window.shopModal.checkout()">
            ${currentTab === 'buy' ? '✅ Comprar' : '💵 Vender'}
          </button>
        </div>
      ` : ''}
    `;

    status.textContent = `${items.length} item(ns) disponível(is)`;
  }

  // Render individual item
  function renderItem(item) {
    const price = currentTab === 'buy' ? item.price : item.sellPrice;
    const inCart = cart.find(c => c.itemId === item.itemId);
    const cartQty = inCart ? inCart.quantity : 0;
    const maxQty = currentTab === 'sell' ? item.quantity : 99;

    return `
      <div class="shop-item">
        <div class="shop-item__info">
          <div class="shop-item__name">${escapeHtml(item.name)}</div>
          <div class="shop-item__desc">${escapeHtml(item.description || 'Sem descrição')}</div>
          ${currentTab === 'sell' ? `<div class="shop-item__stock">Em estoque: ${item.quantity}</div>` : ''}
        </div>
        <div class="shop-item__actions">
          <div class="shop-item__price">₽${price.toLocaleString('pt-BR')}</div>
          <div class="shop-item__controls">
            <button class="shop-item__btn shop-item__btn--minus" 
                    onclick="window.shopModal.updateCart('${item.itemId}', -1)"
                    ${cartQty === 0 ? 'disabled' : ''}>−</button>
            <span class="shop-item__qty">${cartQty}</span>
            <button class="shop-item__btn shop-item__btn--plus" 
                    onclick="window.shopModal.updateCart('${item.itemId}', 1)"
                    ${cartQty >= maxQty ? 'disabled' : ''}>+</button>
          </div>
        </div>
      </div>
    `;
  }

  // Switch tab
  function switchTab(tab) {
    currentTab = tab;
    cart = [];
    render();
  }

  // Update cart
  function updateCart(itemId, delta) {
    const items = currentTab === 'buy' ? shopItems : playerInventory;
    const item = items.find(i => i.itemId === itemId);
    if (!item) return;

    const cartItem = cart.find(c => c.itemId === itemId);
    const price = currentTab === 'buy' ? item.price : item.sellPrice;

    if (cartItem) {
      cartItem.quantity += delta;
      if (cartItem.quantity <= 0) {
        cart = cart.filter(c => c.itemId !== itemId);
      }
    } else if (delta > 0) {
      cart.push({
        itemId: item.itemId,
        name: item.name,
        quantity: delta,
        price: price
      });
    }

    render();
  }

  // Clear cart
  function clearCart() {
    cart = [];
    render();
  }

  // Checkout
  async function checkout() {
    if (cart.length === 0) return;

    const endpoint = currentTab === 'buy' ? '/api/shop/buy' : '/api/shop/sell';
    const items = cart.map(c => ({ itemId: c.itemId, quantity: c.quantity }));

    status.textContent = "Processando...";

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });

      const data = await res.json();

      if (data.ok) {
        playerMoney = data.newBalance;
        cart = [];

        // Reload data
        await loadShopData();

        const action = currentTab === 'buy' ? 'comprados' : 'vendidos';
        status.textContent = `✅ Itens ${action} com sucesso!`;

        // Update player money in UI
        if (window.updatePlayerGold) {
          window.updatePlayerGold(playerMoney);
        }

        setTimeout(() => {
          status.textContent = `${(currentTab === 'buy' ? shopItems : playerInventory).length} item(ns) disponível(is)`;
        }, 3000);
      } else {
        const errorMsg = {
          'insufficient_funds': 'Dinheiro insuficiente!',
          'insufficient_quantity': 'Você não tem itens suficientes!',
          'item_not_found': 'Item não encontrado!'
        }[data.error] || 'Erro na transação';

        status.textContent = `❌ ${errorMsg}`;
        setTimeout(() => {
          status.textContent = `${(currentTab === 'buy' ? shopItems : playerInventory).length} item(ns) disponível(is)`;
        }, 3000);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      status.textContent = "❌ Erro ao processar transação";
    }
  }

  // Escape HTML
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Event listeners
  closeBtn?.addEventListener("click", close);
  modal?.querySelector("[data-shop-modal-close]")?.addEventListener("click", close);

  // Dashboard shop button
  const dashboardShopBtn = $("btnShop");
  if (dashboardShopBtn) {
    dashboardShopBtn.addEventListener("click", () => {
      open({ name: 'Poké Mart' }); // Open without NPC context
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) close();
  });

  // Export functions to window
  window.shopModal = {
    switchTab,
    updateCart,
    clearCart,
    checkout
  };

  window.openShopModal = open;
})();
