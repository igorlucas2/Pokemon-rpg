(function() {
  "use strict";

  const nearbyList = document.getElementById("nearbyList");
  const btnClearNearby = document.getElementById("btnClearNearby");

  // Armazena os encontros avistados
  const nearbyEncounters = new Map();

  /**
   * Adiciona um Pokémon à lista de avistados
   * @param {Object} encounter - Dados do encontro
   */
  function addNearbyPokemon(encounter) {
    const encounterId = `encounter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Armazenar o encontro
    nearbyEncounters.set(encounterId, encounter);

    // Remover hint se existir
    const hint = nearbyList.querySelector(".hint");
    if (hint) {
      hint.remove();
    }

    // Criar card
    const card = document.createElement("div");
    card.className = "nearby-card";
    card.dataset.encounterId = encounterId;

    // Sprite (placeholder inicialmente)
    const sprite = document.createElement("img");
    sprite.className = "nearby-card__sprite";
    sprite.alt = encounter.species || "Pokémon";
    sprite.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect fill='%23ffffff10' width='48' height='48'/%3E%3C/svg%3E";

    // Buscar sprite real
    fetchPokemonSprite(encounter.pokemonId).then(url => {
      if (url) sprite.src = url;
    }).catch(() => {});

    // Info
    const info = document.createElement("div");
    info.className = "nearby-card__info";

    const name = document.createElement("div");
    name.className = "nearby-card__name";
    name.textContent = encounter.species || "???";

    const meta = document.createElement("div");
    meta.className = "nearby-card__meta";

    const level = document.createElement("span");
    level.textContent = `Nv. ${encounter.level || "?"}`;

    const nature = document.createElement("span");
    nature.className = "nearby-card__badge";
    nature.textContent = encounter.nature || "???";

    meta.appendChild(level);
    meta.appendChild(nature);

    info.appendChild(name);
    info.appendChild(meta);

    // Botão de remover
    const removeBtn = document.createElement("div");
    removeBtn.className = "nearby-card__remove";
    removeBtn.textContent = "×";
    removeBtn.title = "Ignorar";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeNearbyPokemon(encounterId);
    });

    // Click no card para batalhar
    card.addEventListener("click", () => {
      startBattleFromNearby(encounterId);
    });

    card.appendChild(sprite);
    card.appendChild(info);
    card.appendChild(removeBtn);

    nearbyList.appendChild(card);

    // Log no UI
    if (window.UI?.log) {
      window.UI.log(`🔍 Um ${encounter.species} selvagem apareceu nas proximidades!`);
    }

    // Limitar quantidade de cards (máximo 5)
    const cards = nearbyList.querySelectorAll(".nearby-card");
    if (cards.length > 5) {
      const oldest = cards[0];
      const oldestId = oldest.dataset.encounterId;
      nearbyEncounters.delete(oldestId);
      oldest.remove();
    }
  }

  /**
   * Remove um Pokémon da lista
   */
  function removeNearbyPokemon(encounterId) {
    const card = nearbyList.querySelector(`[data-encounter-id="${encounterId}"]`);
    if (card) {
      card.style.opacity = "0";
      card.style.transform = "translateX(20px)";
      setTimeout(() => {
        card.remove();
        nearbyEncounters.delete(encounterId);

        // Se não há mais cards, mostrar hint
        if (nearbyList.children.length === 0) {
          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Ande pela grama para encontrar Pokémon selvagens...";
          nearbyList.appendChild(hint);
        }
      }, 200);
    }
  }

  /**
   * Inicia batalha com Pokémon avistado
   */
  async function startBattleFromNearby(encounterId) {
    console.log("=== startBattleFromNearby called ===");
    console.log("Encounter ID:", encounterId);
    
    const encounter = nearbyEncounters.get(encounterId);
    console.log("Encounter data:", encounter);
    
    if (!encounter) {
      console.error("Encounter not found in map!");
      return;
    }

    try {
      // Use the new BattleModal API
      if (window.BattleModal?.open) {
        console.log("Calling BattleModal.open...");
        window.BattleModal.open(encounter);
      } else {
        console.error("BattleModal.open not available!");
      }

      // Remover da lista após iniciar batalha
      removeNearbyPokemon(encounterId);
    } catch (error) {
      console.error("Erro ao iniciar batalha:", error);
      if (window.UI?.log) {
        window.UI.log("⚠️ Erro ao iniciar batalha.");
      }
    }
  }

  /**
   * Limpar todos os avistados
   */
  function clearAllNearby() {
    nearbyEncounters.clear();
    nearbyList.innerHTML = '<div class="hint">Ande pela grama para encontrar Pokémon selvagens...</div>';
  }

  /**
   * Buscar sprite do Pokémon
   */
  async function fetchPokemonSprite(pokemonId) {
    try {
      // Usar PokeAPI diretamente
      const pokeApiResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
      if (pokeApiResponse.ok) {
        const data = await pokeApiResponse.json();
        // Priorizar GIF animado da Gen 5
        return data.sprites?.versions?.["generation-v"]?.["black-white"]?.animated?.front_default ||
               // Fallback: Showdown GIF
               `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${pokemonId}.gif` ||
               // Último fallback: sprite estático
               data.sprites?.front_default ||
               null;
      }
    } catch (error) {
      console.error("Erro ao buscar sprite:", error);
    }
    
    // Fallback final: Showdown GIF direto
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${pokemonId}.gif`;
  }

  // Event listeners
  if (btnClearNearby) {
    btnClearNearby.addEventListener("click", clearAllNearby);
  }

  // Expor API global
  window.NearbyPokemon = {
    add: addNearbyPokemon,
    remove: removeNearbyPokemon,
    clear: clearAllNearby,
    getAll: () => Array.from(nearbyEncounters.values())
  };

})();
