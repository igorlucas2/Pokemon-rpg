/**
 * SpriteService
 * 
 * Gerencia URLs de sprites/GIFs de Pokémon
 * Desacoplado das regras de batalha/encontros
 * Suporta múltiplas fontes (PokeAPI, outros)
 */

class SpriteService {
  constructor() {
    // Cache em memória
    this.spriteCache = new Map();
    
    // Configuração de fonte (pode vir de env)
    this.source = process.env.SPRITE_SOURCE || "pokeapi";
    this.variant = process.env.SPRITE_VARIANT || "official-artwork";
  }

  /**
   * Obter URL do sprite de um Pokémon
   * 
   * @param {number|string} pokemonId - ID ou nome do Pokémon
   * @param {string} variant - 'official-artwork', 'front-default', 'back-default', 'animated', etc.
   * @param {boolean} shiny - Se é shiny ou não
   * @returns {Promise<string>} URL do sprite
   */
  async getSpriteUrl(pokemonId, variant = "official-artwork", shiny = false) {
    const cacheKey = `${pokemonId}:${variant}:${shiny}`;

    // Verificar cache
    if (this.spriteCache.has(cacheKey)) {
      return this.spriteCache.get(cacheKey);
    }

    try {
      let url;

      switch (this.source.toLowerCase()) {
        case "pokeapi":
          url = await this._getPokeAPISprite(pokemonId, variant, shiny);
          break;
        case "pokeres":
          url = await this._getPokEResSprite(pokemonId, shiny);
          break;
        case "raw-github":
          url = await this._getGithubSprite(pokemonId, variant, shiny);
          break;
        default:
          url = await this._getPokeAPISprite(pokemonId, variant, shiny);
      }

      // Armazenar em cache
      this.spriteCache.set(cacheKey, url);
      return url;
    } catch (err) {
      console.error(`SpriteService.getSpriteUrl error for ${pokemonId}:`, err);
      // Retornar placeholder se falhar
      return this._getPlaceholderUrl(pokemonId);
    }
  }

  /**
   * Obter sprite do PokeAPI
   * @private
   */
  async _getPokeAPISprite(pokemonId, variant, shiny) {
    // Normalizar ID (pode ser string ou number)
    const id = typeof pokemonId === "string" 
      ? this._getPokemonIdByName(pokemonId) 
      : pokemonId;

    // PokeAPI oficial-artwork é PNG
    // Para GIFs, usar GitHub raw
    if (variant === "official-artwork") {
      return `https://raw.githubusercontent.com/PokeAPI/sprites/master/pokemon/other/official-artwork/${id}.png`;
    }

    // Se quiser animado (GIF), usar repositório pokefirered ou alternativo
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/pokemon/${id}.png`;
  }

  /**
   * Obter sprite do PokéRes (repositório com GIFs)
   * @private
   */
  async _getPokEResSprite(pokemonId, shiny) {
    const id = typeof pokemonId === "string"
      ? this._getPokemonIdByName(pokemonId)
      : pokemonId;

    const shinyPath = shiny ? "shiny" : "normal";
    return `https://pokeres.bastionbot.org/images/pokemon/${id}.gif`;
  }

  /**
   * Obter sprite do repositório GitHub (pokefirered-style)
   * @private
   */
  async _getGithubSprite(pokemonId, variant, shiny) {
    // Formato: sprites/pokemon/{id}.gif ou similar
    const id = typeof pokemonId === "string"
      ? this._getPokemonIdByName(pokemonId)
      : pokemonId;

    const repo = "https://raw.githubusercontent.com/cartridge-gg/pokefirered-sprites/main";
    return `${repo}/pokemon/${id}.gif`;
  }

  /**
   * Obter múltiplos sprites (ex: time completo)
   * 
   * @param {Array<number|string>} pokemonIds - IDs dos Pokémon
   * @param {string} variant - Variante
   * @returns {Promise<Object>} Mapa de { pokemonId: url }
   */
  async getSpriteUrls(pokemonIds, variant = "official-artwork") {
    const urls = {};

    for (const id of pokemonIds) {
      urls[id] = await this.getSpriteUrl(id, variant);
    }

    return urls;
  }

  /**
   * Obter GIF animado de uma batalha
   * Pode retornar animação de ataque, defesa, etc.
   * 
   * @param {number} pokemonId
   * @param {string} action - 'attack', 'hurt', 'faint', 'victory'
   * @returns {Promise<string>} URL do GIF
   */
  async getBattleAnimationUrl(pokemonId, action = "attack") {
    // Por enquanto, retornar sprite padrão
    // Pode ser expandido para animações específicas
    return this.getSpriteUrl(pokemonId, "official-artwork");
  }

  /**
   * Obter ID do Pokémon pelo nome (busca simples)
   * @private
   */
  _getPokemonIdByName(name) {
    // Mapeamento simples (expandir conforme necessário)
    const nameToId = {
      bulbasaur: 1,
      ivysaur: 2,
      venusaur: 3,
      charmander: 4,
      charmeleon: 5,
      charizard: 6,
      squirtle: 7,
      wartortle: 8,
      blastoise: 9,
      pidgeot: 16,
      pikachu: 25,
      raichu: 26,
    };

    return (
      nameToId[name.toLowerCase()] || 
      parseInt(name) || 
      1
    );
  }

  /**
   * Retornar URL de placeholder se sprite não encontrado
   * @private
   */
  _getPlaceholderUrl(pokemonId) {
    // Placeholder genérico
    return `https://via.placeholder.com/96x96?text=Pokemon+${pokemonId}`;
  }

  /**
   * Limpar cache
   */
  clearCache() {
    this.spriteCache.clear();
  }

  /**
   * Obter informações do cache (para debug)
   */
  getCacheStats() {
    return {
      size: this.spriteCache.size,
      entries: Array.from(this.spriteCache.keys()),
    };
  }
}

module.exports = new SpriteService();
