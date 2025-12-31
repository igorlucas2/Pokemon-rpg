window.WORLD = {
  view: {
    tilesX: 35,
    tilesY: 20,
    scale: 2.5
  },
  moveSpeed: 80,
  player: {
    sprite: {
      fps: 6,
      targetHeightTiles: 2,
      sheet: {
        preset: "pokefirered-standard",
        src: "pokefirered-master/pokefirered-master/graphics/object_events/pics/people/boy.png",
        frameWidth: 16,
        frameHeight: 32
      }
    }
  },
  items: [
    { id: "potion", name: "Pocao", desc: "Restaura um pouco de HP." }
  ],
  dialogs: [
    {
      id: "intro",
      title: "Introducao",
      text: "Bem-vindo ao mundo. Fale com os NPCs para dicas."
    }
  ],
  flags: {
    oak_route1_open: true
  },
  activeMapId: "PalletTown",

  // ========== WORLD ACTIONS ==========
  onAction(action, data) {
    console.log("🎮 World Action:", action, data);

    if (action === "wildencounter" && data.encounter) {
      this.handleWildEncounter(data.encounter, data);
    }

    if (action === "pcinteraction" || action === "computer") {
      this.handlePCInteraction(data);
    }
  },

  // ========== PC INTERACTION HANDLER ==========
  handlePCInteraction(data) {
    console.log("💾 INTERAÇÃO COM PC DO POKÉCENTER!", data);

    // Abre o modal de save
    if (window.SaveGameModal?.open) {
      window.GAME?.setPaused?.(true);
      window.SaveGameModal.open();
    } else {
      console.warn("SaveGameModal não está disponível");
      const message = "💾 Salvar jogo? (Modal não implementado)";
      window.GAME?.showMessage?.(message) || alert(message);
    }
  },

  // ========== WILD ENCOUNTER HANDLER ==========
  async handleWildEncounter(encounter, data) {
    console.log("⚡ ENCONTRO SELVAGEM!", encounter);

    console.log("📊 Dados do encontro:", {
      pokemon: encounter.species,
      pokemonId: encounter.pokemonId,
      level: encounter.level,
      nature: encounter.nature,
      hp: encounter.stats?.hp,
      moves: encounter.moves?.map(m => m.moveName || m.name) || [],
      terrain: data.terrain
    });

    // Enriquecer encontro com terreno/mapa para UI da batalha
    try {
      encounter.terrain = encounter.terrain || data?.terrain || 'grass';
      if (data?.mapId) encounter.mapId = String(data.mapId);
    } catch {}

    // Adicionar ao painel de Pokémon Avistados (estilo Pokémon GO)
    if (window.NearbyPokemon?.add) {
      window.NearbyPokemon.add(encounter);
    } else {
      // Fallback: abrir modal se o sistema de nearby não estiver disponível
      if (window.EncounterModal?.open) {
        window.GAME?.setPaused?.(true);
        window.EncounterModal.open(encounter, {
          event: {
            name: `Encontro Selvagem - ${data.terrain || 'grama'}`,
            id: `wild_encounter_${Date.now()}`
          }
        });
      } else {
        const message = `🎲 Um ${encounter.species} selvagem apareceu! (Nv. ${encounter.level})`;
        window.GAME?.showMessage?.(message) || alert(message);
      }
    }
  }
};

