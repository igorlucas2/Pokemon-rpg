/**
 * NPC Interaction Menu System
 * 
 * Handles interaction menu when clicking on NPCs
 * Options: Chat, Battle, Close
 */

class NPCInteractionMenu {
  constructor() {
    this.currentNPC = null;
    this.menuElement = null;
    this.isOpen = false;
    this.init();
  }

  init() {
    // Create menu element if it doesn't exist
    if (!document.getElementById('npcInteractionMenu')) {
      const menuHTML = `
        <div id="npcInteractionMenu" class="npc-interaction-menu" style="display: none;">
          <div class="npc-menu-content">
            <div class="npc-menu-header">
              <h3 id="npcMenuName">NPC</h3>
              <button class="npc-menu-close" onclick="npcInteractionMenu.close()">×</button>
            </div>
            <div class="npc-menu-body">
              <button class="npc-menu-btn npc-menu-btn--chat" onclick="npcInteractionMenu.startChat()">
                <span class="npc-menu-icon">💬</span>
                <span class="npc-menu-text">Conversar</span>
              </button>
              <button class="npc-menu-btn npc-menu-btn--battle" id="npcMenuBattleBtn" onclick="npcInteractionMenu.startBattle()">
                <span class="npc-menu-icon">⚔️</span>
                <span class="npc-menu-text">Batalhar</span>
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', menuHTML);
    }

    this.menuElement = document.getElementById('npcInteractionMenu');

    // Add CSS styles
    this.addStyles();
  }

  addStyles() {
    if (document.getElementById('npcInteractionMenuStyles')) return;

    const styles = `
      <style id="npcInteractionMenuStyles">
        .npc-interaction-menu {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .npc-menu-content {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 16px;
          padding: 0;
          min-width: 320px;
          max-width: 400px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          border: 2px solid rgba(255, 255, 255, 0.1);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .npc-menu-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 2px solid rgba(255, 255, 255, 0.1);
        }

        .npc-menu-header h3 {
          margin: 0;
          color: #fff;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .npc-menu-close {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #fff;
          font-size: 1.5rem;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .npc-menu-close:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: rotate(90deg);
        }

        .npc-menu-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .npc-menu-btn {
          background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 16px 20px;
          color: #fff;
          font-size: 1.1rem;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .npc-menu-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
          transition: left 0.5s ease;
        }

        .npc-menu-btn:hover::before {
          left: 100%;
        }

        .npc-menu-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .npc-menu-btn:active {
          transform: translateY(0);
        }

        .npc-menu-btn--chat {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .npc-menu-btn--chat:hover {
          background: linear-gradient(135deg, #7c8ff0 0%, #8a5bb8 100%);
        }

        .npc-menu-btn--battle {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }

        .npc-menu-btn--battle:hover {
          background: linear-gradient(135deg, #f5a3ff 0%, #ff6b7f 100%);
        }

        .npc-menu-btn--battle:disabled {
          background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
          opacity: 0.5;
          cursor: not-allowed;
        }

        .npc-menu-btn--battle:disabled:hover {
          transform: none;
          box-shadow: none;
        }

        .npc-menu-icon {
          font-size: 1.5rem;
        }

        .npc-menu-text {
          flex: 1;
          text-align: left;
        }

        /* Mobile responsive */
        @media (max-width: 480px) {
          .npc-menu-content {
            min-width: 280px;
            margin: 0 16px;
          }

          .npc-menu-header h3 {
            font-size: 1.3rem;
          }

          .npc-menu-btn {
            padding: 14px 18px;
            font-size: 1rem;
          }
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }

  show(npc) {
    this.currentNPC = npc;
    this.isOpen = true;

    // Update menu content
    document.getElementById('npcMenuName').textContent = npc.name || 'NPC';

    // Check if NPC can battle
    const battleBtn = document.getElementById('npcMenuBattleBtn');
    if (npc.canBattle === false || npc.hasBeenDefeated) {
      battleBtn.disabled = true;
      if (npc.hasBeenDefeated) {
        battleBtn.querySelector('.npc-menu-text').textContent = 'Já foi derrotado';
      }
    } else {
      battleBtn.disabled = false;
      battleBtn.querySelector('.npc-menu-text').textContent = 'Batalhar';
    }

    // Show menu
    this.menuElement.style.display = 'flex';

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.isOpen = false;
    this.currentNPC = null;
    this.menuElement.style.display = 'none';

    // Restore body scroll
    document.body.style.overflow = '';
  }

  startChat() {
    if (!this.currentNPC) return;

    // Close menu
    this.close();

    // Open chat widget with correct parameters
    if (typeof window.openChat === 'function') {
      // openChat expects (npcId, npcName, regionId)
      window.openChat(
        this.currentNPC.id || this.currentNPC.npc_id,
        this.currentNPC.name || 'NPC',
        this.currentNPC.region_id || 'kanto'
      );
    } else {
      console.warn('openChat function not found');
    }
  }

  async startBattle() {
    if (!this.currentNPC) return;

    try {
      // Show loading state
      const battleBtn = document.getElementById('npcMenuBattleBtn');
      const originalText = battleBtn.querySelector('.npc-menu-text').textContent;
      battleBtn.querySelector('.npc-menu-text').textContent = 'Iniciando...';
      battleBtn.disabled = true;

      // Call battle API
      const response = await fetch(`/api/battle/npc/${this.currentNPC.npc_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.ok) {
        // Close menu
        this.close();

        // Open battle UI
        if (typeof window.openBattleUI === 'function') {
          window.openBattleUI(data.battleState);
        } else {
          console.log('Battle started:', data.battleState);
          alert('Sistema de batalha em desenvolvimento!');
        }
      } else {
        throw new Error(data.error || 'Failed to start battle');
      }
    } catch (error) {
      console.error('Error starting battle:', error);
      alert('Erro ao iniciar batalha: ' + error.message);

      // Restore button
      const battleBtn = document.getElementById('npcMenuBattleBtn');
      battleBtn.querySelector('.npc-menu-text').textContent = 'Batalhar';
      battleBtn.disabled = false;
    }
  }
}

// Initialize global instance
let npcInteractionMenu;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    npcInteractionMenu = new NPCInteractionMenu();
    window.npcInteractionMenu = npcInteractionMenu; // Export to window
  });
} else {
  npcInteractionMenu = new NPCInteractionMenu();
  window.npcInteractionMenu = npcInteractionMenu; // Export to window
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NPCInteractionMenu;
}
