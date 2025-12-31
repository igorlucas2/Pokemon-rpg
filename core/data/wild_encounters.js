/**
 * Dados de encontros selvagens extraídos do pokefirered-master
 * Combina FireRed + LeafGreen
 * 
 * Estrutura:
 * {
 *   "map_name": {
 *     "terrain_type": {
 *       "encounters": [
 *         { "species": "bulbasaur", "min_level": 2, "max_level": 4, "rate": 0.45 },
 *         { "species": "pidgeotto", "min_level": 2, "max_level": 4, "rate": 0.55 }
 *       ]
 *     }
 *   }
 * }
 * 
 * terrain_type: grass, water, fishing, rock_smash, headbutt, surfing
 */

module.exports = {
  "Route1": {
    "grass": {
      "encounters": [
        { "species": "pidgey", "min_level": 2, "max_level": 5, "rate": 0.50 },
        { "species": "rattata", "min_level": 2, "max_level": 4, "rate": 0.50 }
      ]
    }
  },

  "ViridianForest": {
    "grass": {
      "encounters": [
        { "species": "caterpie", "min_level": 3, "max_level": 5, "rate": 0.40 },
        { "species": "metapod", "min_level": 4, "max_level": 6, "rate": 0.30 },
        { "species": "weedle", "min_level": 3, "max_level": 5, "rate": 0.20 },
        { "species": "pikachu", "min_level": 3, "max_level": 5, "rate": 0.05 },
        { "species": "pidgey", "min_level": 5, "max_level": 5, "rate": 0.05 }
      ]
    }
  },

  "Route2": {
    "grass": {
      "encounters": [
        { "species": "pidgey", "min_level": 3, "max_level": 5, "rate": 0.45 },
        { "species": "rattata", "min_level": 3, "max_level": 5, "rate": 0.45 },
        { "species": "caterpie", "min_level": 3, "max_level": 4, "rate": 0.10 }
      ]
    }
  },

  "Route3": {
    "grass": {
      "encounters": [
        { "species": "pidgey", "min_level": 6, "max_level": 8, "rate": 0.35 },
        { "species": "spearow", "min_level": 6, "max_level": 8, "rate": 0.35 },
        { "species": "jigglypuff", "min_level": 3, "max_level": 7, "rate": 0.15 },
        { "species": "mankey", "min_level": 7, "max_level": 8, "rate": 0.10 },
        { "species": "nidoran-f", "min_level": 6, "max_level": 7, "rate": 0.025 },
        { "species": "nidoran-m", "min_level": 6, "max_level": 7, "rate": 0.025 }
      ]
    }
  },

  "MtMoon_1F": {
    "grass": {
      "encounters": [
        { "species": "zubat", "min_level": 7, "max_level": 9, "rate": 0.35 },
        { "species": "paras", "min_level": 7, "max_level": 9, "rate": 0.35 },
        { "species": "clefairy", "min_level": 8, "max_level": 10, "rate": 0.20 },
        { "species": "geodude", "min_level": 8, "max_level": 10, "rate": 0.10 }
      ]
    }
  },

  "MtMoon_B1F": {
    "grass": {
      "encounters": [
        { "species": "zubat", "min_level": 9, "max_level": 11, "rate": 0.35 },
        { "species": "paras", "min_level": 9, "max_level": 11, "rate": 0.35 },
        { "species": "clefairy", "min_level": 10, "max_level": 12, "rate": 0.20 },
        { "species": "geodude", "min_level": 10, "max_level": 11, "rate": 0.10 }
      ]
    }
  },

  "Route4": {
    "grass": {
      "encounters": [
        { "species": "pidgey", "min_level": 8, "max_level": 12, "rate": 0.35 },
        { "species": "spearow", "min_level": 8, "max_level": 12, "rate": 0.35 },
        { "species": "rattata", "min_level": 8, "max_level": 12, "rate": 0.25 },
        { "species": "ekans", "min_level": 8, "max_level": 12, "rate": 0.05 }
      ]
    }
  },

  "Route5": {
    "grass": {
      "encounters": [
        { "species": "pidgey", "min_level": 13, "max_level": 16, "rate": 0.40 },
        { "species": "meowth", "min_level": 10, "max_level": 16, "rate": 0.35 },
        { "species": "oddish", "min_level": 13, "max_level": 16, "rate": 0.20 },
        { "species": "mankey", "min_level": 10, "max_level": 16, "rate": 0.05 }
      ]
    }
  },

  "Route6": {
    "grass": {
      "encounters": [
        { "species": "pidgey", "min_level": 13, "max_level": 16, "rate": 0.40 },
        { "species": "meowth", "min_level": 10, "max_level": 16, "rate": 0.35 },
        { "species": "oddish", "min_level": 13, "max_level": 16, "rate": 0.20 },
        { "species": "mankey", "min_level": 10, "max_level": 16, "rate": 0.05 }
      ]
    }
  },

  "Route7": {
    "grass": {
      "encounters": [
        { "species": "pidgey", "min_level": 19, "max_level": 22, "rate": 0.35 },
        { "species": "oddish", "min_level": 19, "max_level": 22, "rate": 0.30 },
        { "species": "meowth", "min_level": 18, "max_level": 20, "rate": 0.20 },
        { "species": "growlithe", "min_level": 18, "max_level": 20, "rate": 0.15 }
      ]
    }
  },

  "Route8": {
    "grass": {
      "encounters": [
        { "species": "pidgey", "min_level": 18, "max_level": 20, "rate": 0.35 },
        { "species": "meowth", "min_level": 18, "max_level": 20, "rate": 0.30 },
        { "species": "oddish", "min_level": 20, "max_level": 22, "rate": 0.20 },
        { "species": "growlithe", "min_level": 16, "max_level": 18, "rate": 0.15 }
      ]
    }
  },

  "Route9": {
    "grass": {
      "encounters": [
        { "species": "growlithe", "min_level": 22, "max_level": 25, "rate": 0.40 },
        { "species": "mankey", "min_level": 22, "max_level": 25, "rate": 0.35 },
        { "species": "arcanine", "min_level": 23, "max_level": 25, "rate": 0.25 }
      ]
    }
  },

  "Route10": {
    "grass": {
      "encounters": [
        { "species": "voltorb", "min_level": 21, "max_level": 24, "rate": 0.45 },
        { "species": "magnemite", "min_level": 21, "max_level": 24, "rate": 0.45 },
        { "species": "pikachu", "min_level": 22, "max_level": 24, "rate": 0.10 }
      ]
    }
  },

  "Route11": {
    "grass": {
      "encounters": [
        { "species": "pidgeotto", "min_level": 26, "max_level": 29, "rate": 0.40 },
        { "species": "raticate", "min_level": 20, "max_level": 29, "rate": 0.35 },
        { "species": "fearow", "min_level": 26, "max_level": 29, "rate": 0.25 }
      ]
    }
  },

  "Route12": {
    "grass": {
      "encounters": [
        { "species": "pidgeotto", "min_level": 27, "max_level": 29, "rate": 0.35 },
        { "species": "gloom", "min_level": 27, "max_level": 29, "rate": 0.35 },
        { "species": "venonat", "min_level": 27, "max_level": 29, "rate": 0.30 }
      ]
    },
    "fishing": {
      "encounters": [
        { "species": "goldeen", "min_level": 15, "max_level": 22, "rate": 0.60 },
        { "species": "magikarp", "min_level": 15, "max_level": 22, "rate": 0.40 }
      ]
    }
  },

  "Route13": {
    "grass": {
      "encounters": [
        { "species": "pidgeotto", "min_level": 29, "max_level": 32, "rate": 0.35 },
        { "species": "gloom", "min_level": 29, "max_level": 32, "rate": 0.35 },
        { "species": "bellsprout", "min_level": 29, "max_level": 32, "rate": 0.30 }
      ]
    }
  },

  "Route14": {
    "grass": {
      "encounters": [
        { "species": "pidgeotto", "min_level": 32, "max_level": 35, "rate": 0.35 },
        { "species": "bellsprout", "min_level": 32, "max_level": 35, "rate": 0.35 },
        { "species": "gloom", "min_level": 32, "max_level": 35, "rate": 0.30 }
      ]
    }
  },

  "Route15": {
    "grass": {
      "encounters": [
        { "species": "pidgeotto", "min_level": 32, "max_level": 35, "rate": 0.35 },
        { "species": "bellsprout", "min_level": 32, "max_level": 35, "rate": 0.35 },
        { "species": "gloom", "min_level": 32, "max_level": 35, "rate": 0.30 }
      ]
    }
  },

  "Route16": {
    "grass": {
      "encounters": [
        { "species": "pidgeotto", "min_level": 32, "max_level": 35, "rate": 0.40 },
        { "species": "spearow", "min_level": 32, "max_level": 35, "rate": 0.35 },
        { "species": "fearow", "min_level": 32, "max_level": 35, "rate": 0.25 }
      ]
    }
  },

  "Route17": {
    "grass": {
      "encounters": [
        { "species": "pidgeotto", "min_level": 32, "max_level": 35, "rate": 0.40 },
        { "species": "spearow", "min_level": 32, "max_level": 35, "rate": 0.35 },
        { "species": "fearow", "min_level": 32, "max_level": 35, "rate": 0.25 }
      ]
    }
  },

  "Route18": {
    "grass": {
      "encounters": [
        { "species": "pidgeotto", "min_level": 35, "max_level": 38, "rate": 0.40 },
        { "species": "spearow", "min_level": 35, "max_level": 38, "rate": 0.35 },
        { "species": "fearow", "min_level": 35, "max_level": 38, "rate": 0.25 }
      ]
    }
  },

  "Route19": {
    "water": {
      "encounters": [
        { "species": "tentacool", "min_level": 20, "max_level": 30, "rate": 0.60 },
        { "species": "shellder", "min_level": 20, "max_level": 30, "rate": 0.30 },
        { "species": "horsea", "min_level": 20, "max_level": 30, "rate": 0.10 }
      ]
    },
    "fishing": {
      "encounters": [
        { "species": "tentacool", "min_level": 20, "max_level": 25, "rate": 0.60 },
        { "species": "shellder", "min_level": 20, "max_level": 25, "rate": 0.40 }
      ]
    }
  },

  "Route20": {
    "water": {
      "encounters": [
        { "species": "tentacool", "min_level": 20, "max_level": 35, "rate": 0.60 },
        { "species": "shellder", "min_level": 20, "max_level": 35, "rate": 0.30 },
        { "species": "horsea", "min_level": 20, "max_level": 35, "rate": 0.10 }
      ]
    },
    "fishing": {
      "encounters": [
        { "species": "tentacool", "min_level": 20, "max_level": 25, "rate": 0.60 },
        { "species": "shellder", "min_level": 20, "max_level": 25, "rate": 0.40 }
      ]
    }
  },

  "Route21": {
    "water": {
      "encounters": [
        { "species": "tentacool", "min_level": 20, "max_level": 30, "rate": 0.60 },
        { "species": "shellder", "min_level": 20, "max_level": 30, "rate": 0.30 },
        { "species": "horsea", "min_level": 20, "max_level": 30, "rate": 0.10 }
      ]
    },
    "fishing": {
      "encounters": [
        { "species": "tentacool", "min_level": 20, "max_level": 25, "rate": 0.60 },
        { "species": "shellder", "min_level": 20, "max_level": 25, "rate": 0.40 }
      ]
    }
  },

  "Route22": {
    "grass": {
      "encounters": [
        { "species": "rattata", "min_level": 2, "max_level": 5, "rate": 0.45 },
        { "species": "nidoran-f", "min_level": 3, "max_level": 5, "rate": 0.20 },
        { "species": "nidoran-m", "min_level": 3, "max_level": 5, "rate": 0.20 },
        { "species": "mankey", "min_level": 3, "max_level": 5, "rate": 0.15 }
      ]
    }
  },

  "Route24": {
    "grass": {
      "encounters": [
        { "species": "pidgey", "min_level": 12, "max_level": 14, "rate": 0.40 },
        { "species": "oddish", "min_level": 12, "max_level": 14, "rate": 0.30 },
        { "species": "abra", "min_level": 8, "max_level": 12, "rate": 0.15 },
        { "species": "bellsprout", "min_level": 12, "max_level": 14, "rate": 0.15 }
      ]
    },
    "fishing": {
      "encounters": [
        { "species": "goldeen", "min_level": 15, "max_level": 22, "rate": 0.60 },
        { "species": "magikarp", "min_level": 15, "max_level": 22, "rate": 0.40 }
      ]
    }
  },

  "Route25": {
    "grass": {
      "encounters": [
        { "species": "pidgey", "min_level": 12, "max_level": 14, "rate": 0.40 },
        { "species": "oddish", "min_level": 12, "max_level": 14, "rate": 0.30 },
        { "species": "abra", "min_level": 8, "max_level": 12, "rate": 0.15 },
        { "species": "bellsprout", "min_level": 12, "max_level": 14, "rate": 0.15 }
      ]
    },
    "fishing": {
      "encounters": [
        { "species": "goldeen", "min_level": 15, "max_level": 22, "rate": 0.60 },
        { "species": "magikarp", "min_level": 15, "max_level": 22, "rate": 0.40 }
      ]
    }
  },

  "ViridianCave": {
    "grass": {
      "encounters": [
        { "species": "zubat", "min_level": 5, "max_level": 8, "rate": 0.45 },
        { "species": "geodude", "min_level": 5, "max_level": 8, "rate": 0.45 },
        { "species": "cubone", "min_level": 5, "max_level": 8, "rate": 0.10 }
      ]
    }
  },

  "RockTunnel": {
    "grass": {
      "encounters": [
        { "species": "zubat", "min_level": 17, "max_level": 20, "rate": 0.45 },
        { "species": "geodude", "min_level": 17, "max_level": 20, "rate": 0.40 },
        { "species": "machop", "min_level": 19, "max_level": 20, "rate": 0.15 }
      ]
    },
    "rock_smash": {
      "encounters": [
        { "species": "geodude", "min_level": 15, "max_level": 20, "rate": 0.90 },
        { "species": "rhyhorn", "min_level": 18, "max_level": 20, "rate": 0.10 }
      ]
    }
  },

  "PowerPlant": {
    "grass": {
      "encounters": [
        { "species": "voltorb", "min_level": 24, "max_level": 27, "rate": 0.60 },
        { "species": "magnemite", "min_level": 24, "max_level": 27, "rate": 0.35 },
        { "species": "pikachu", "min_level": 25, "max_level": 27, "rate": 0.05 }
      ]
    }
  },

  "Pokemon Tower": {
    "grass": {
      "encounters": [
        { "species": "gastly", "min_level": 21, "max_level": 24, "rate": 0.50 },
        { "species": "haunter", "min_level": 23, "max_level": 24, "rate": 0.35 },
        { "species": "cubone", "min_level": 21, "max_level": 24, "rate": 0.15 }
      ]
    }
  },

  "Seafoam Islands": {
    "water": {
      "encounters": [
        { "species": "tentacool", "min_level": 30, "max_level": 37, "rate": 0.60 },
        { "species": "shellder", "min_level": 30, "max_level": 37, "rate": 0.30 },
        { "species": "slowbro", "min_level": 35, "max_level": 37, "rate": 0.10 }
      ]
    },
    "fishing": {
      "encounters": [
        { "species": "goldeen", "min_level": 30, "max_level": 35, "rate": 0.60 },
        { "species": "magikarp", "min_level": 30, "max_level": 35, "rate": 0.40 }
      ]
    }
  },

  "Cinnabar Island": {
    "grass": {
      "encounters": [
        { "species": "growlithe", "min_level": 32, "max_level": 38, "rate": 0.40 },
        { "species": "vulpix", "min_level": 32, "max_level": 38, "rate": 0.40 },
        { "species": "ponyta", "min_level": 32, "max_level": 38, "rate": 0.20 }
      ]
    },
    "water": {
      "encounters": [
        { "species": "tentacool", "min_level": 30, "max_level": 37, "rate": 0.60 },
        { "species": "shellder", "min_level": 30, "max_level": 37, "rate": 0.30 },
        { "species": "slowbro", "min_level": 35, "max_level": 37, "rate": 0.10 }
      ]
    }
  },

  "VictoryRoad": {
    "grass": {
      "encounters": [
        { "species": "golbat", "min_level": 41, "max_level": 45, "rate": 0.40 },
        { "species": "machoke", "min_level": 41, "max_level": 45, "rate": 0.35 },
        { "species": "weezing", "min_level": 41, "max_level": 45, "rate": 0.25 }
      ]
    }
  },

  "UndergroundPath": {
    "grass": {
      "encounters": [
        { "species": "zubat", "min_level": 5, "max_level": 8, "rate": 0.45 },
        { "species": "geodude", "min_level": 5, "max_level": 8, "rate": 0.45 },
        { "species": "cubone", "min_level": 5, "max_level": 8, "rate": 0.10 }
      ]
    }
  },

  "One Island": {
    "grass": {
      "encounters": [
        { "species": "pidgeotto", "min_level": 20, "max_level": 29, "rate": 0.40 },
        { "species": "bellsprout", "min_level": 20, "max_level": 29, "rate": 0.35 },
        { "species": "oddish", "min_level": 20, "max_level": 29, "rate": 0.25 }
      ]
    }
  },

  "Two Island": {
    "grass": {
      "encounters": [
        { "species": "pidgeotto", "min_level": 20, "max_level": 29, "rate": 0.40 },
        { "species": "bellsprout", "min_level": 20, "max_level": 29, "rate": 0.35 },
        { "species": "oddish", "min_level": 20, "max_level": 29, "rate": 0.25 }
      ]
    }
  },

  "Three Island": {
    "grass": {
      "encounters": [
        { "species": "pidgeotto", "min_level": 20, "max_level": 29, "rate": 0.40 },
        { "species": "mankey", "min_level": 20, "max_level": 29, "rate": 0.35 },
        { "species": "growlithe", "min_level": 20, "max_level": 29, "rate": 0.25 }
      ]
    }
  },

  "Four Island": {
    "grass": {
      "encounters": [
        { "species": "pidgeotto", "min_level": 20, "max_level": 29, "rate": 0.40 },
        { "species": "bellsprout", "min_level": 20, "max_level": 29, "rate": 0.35 },
        { "species": "oddish", "min_level": 20, "max_level": 29, "rate": 0.25 }
      ]
    }
  },

  "Five Island": {
    "grass": {
      "encounters": [
        { "species": "pidgeotto", "min_level": 20, "max_level": 29, "rate": 0.40 },
        { "species": "bellsprout", "min_level": 20, "max_level": 29, "rate": 0.35 },
        { "species": "oddish", "min_level": 20, "max_level": 29, "rate": 0.25 }
      ]
    }
  },

  "Six Island": {
    "grass": {
      "encounters": [
        { "species": "pidgeotto", "min_level": 20, "max_level": 29, "rate": 0.40 },
        { "species": "bellsprout", "min_level": 20, "max_level": 29, "rate": 0.35 },
        { "species": "oddish", "min_level": 20, "max_level": 29, "rate": 0.25 }
      ]
    }
  },

  "Seven Island": {
    "grass": {
      "encounters": [
        { "species": "pidgeotto", "min_level": 20, "max_level": 29, "rate": 0.40 },
        { "species": "bellsprout", "min_level": 20, "max_level": 29, "rate": 0.35 },
        { "species": "oddish", "min_level": 20, "max_level": 29, "rate": 0.25 }
      ]
    }
  }
};
