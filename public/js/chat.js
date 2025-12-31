/**
 * Chat System
 * Gerencia a janela de chat e comunicação com o backend LLM.
 */

const chatModal = document.getElementById('chatModal');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatHistory = document.getElementById('chatHistory');
const chatNpcName = document.getElementById('chatNpcName');
const chatCloseBtn = document.getElementById('chatModalClose');
const chatBackdrop = document.querySelector('[data-chat-modal-close]');

let currentNpcId = null;
let currentRegionId = null;

// =========================================
// UI Logic
// =========================================

function openChat(npcId, npcName, regionId) {
    currentNpcId = npcId;
    currentRegionId = regionId;
    chatNpcName.textContent = npcName || "NPC";

    // Limpar histórico visual (opcional, ou carregar do server)
    chatHistory.innerHTML = '';
    addMessage("Olá! Com quem tenho o prazer de falar?", 'npc');

    chatModal.classList.add('is-open');
    chatModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => chatInput.focus(), 100);
}

function closeChat() {
    chatModal.classList.remove('is-open');
    chatModal.setAttribute('aria-hidden', 'true');
    currentNpcId = null;
}

if (chatCloseBtn) chatCloseBtn.addEventListener('click', closeChat);
if (chatBackdrop) chatBackdrop.addEventListener('click', closeChat);

// =========================================
// Messaging Logic
// =========================================

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    if (!currentNpcId) return;

    // 1. Mostrar mensagem do player
    addMessage(text, 'player');
    chatInput.value = '';
    chatInput.disabled = true;

    // 2. Enviar para API
    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                npcId: currentNpcId,
                message: text,
                regionId: currentRegionId
            })
        });

        if (!res.ok) throw new Error('Erro na API');

        const data = await res.json();

        // 3. Mostrar resposta do NPC
        if (data.response) {
            addMessage(data.response, 'npc');
        } else {
            addMessage("(O NPC olha confuso...)", 'system');
        }

    } catch (err) {
        console.error(err);
        addMessage("(Erro de conexão com o cérebro do NPC)", 'system');
    } finally {
        chatInput.disabled = false;
        chatInput.focus();
    }
}

function addMessage(text, type) {
    const div = document.createElement('div');
    div.classList.add('chat-msg');
    div.classList.add(`chat-msg--${type}`);
    div.textContent = text;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Event Listeners
if (chatSendBtn) {
    chatSendBtn.addEventListener('click', sendMessage);
}
if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// Global Exports
window.openChat = openChat;
