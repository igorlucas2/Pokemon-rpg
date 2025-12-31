/**
 * Trainer Parties Database
 * 
 * Times de treinadores extraídos do pokefirered-master
 * Cada treinador tem uma classe e um time de Pokémon
 */

module.exports = {
    // ========== YOUNGSTERS (Garotos) ==========
    "YoungsterBen": {
        trainerClass: "Youngster",
        trainerName: "Ben",
        party: [
            { species: 19, level: 11, iv: 0, moves: [] }, // Rattata
            { species: 23, level: 11, iv: 0, moves: [] }  // Ekans
        ]
    },

    "YoungsterCalvin": {
        trainerClass: "Youngster",
        trainerName: "Calvin",
        party: [
            { species: 21, level: 14, iv: 0, moves: [] }  // Spearow
        ]
    },

    "YoungsterJosh": {
        trainerClass: "Youngster",
        trainerName: "Josh",
        party: [
            { species: 19, level: 10, iv: 0, moves: [] }, // Rattata
            { species: 19, level: 10, iv: 0, moves: [] }, // Rattata
            { species: 41, level: 10, iv: 0, moves: [] }  // Zubat
        ]
    },

    // ========== BUG CATCHERS (Caçadores de Insetos) ==========
    "BugCatcherRick": {
        trainerClass: "Bug Catcher",
        trainerName: "Rick",
        party: [
            { species: 13, level: 6, iv: 0, moves: [] }, // Weedle
            { species: 10, level: 6, iv: 0, moves: [] }  // Caterpie
        ]
    },

    "BugCatcherDoug": {
        trainerClass: "Bug Catcher",
        trainerName: "Doug",
        party: [
            { species: 13, level: 7, iv: 0, moves: [] }, // Weedle
            { species: 14, level: 7, iv: 0, moves: [] }, // Kakuna
            { species: 13, level: 7, iv: 0, moves: [] }  // Weedle
        ]
    },

    "BugCatcherSammy": {
        trainerClass: "Bug Catcher",
        trainerName: "Sammy",
        party: [
            { species: 13, level: 9, iv: 0, moves: [] }  // Weedle
        ]
    },

    // ========== LASSES (Garotas) ==========
    "LassJanice": {
        trainerClass: "Lass",
        trainerName: "Janice",
        party: [
            { species: 16, level: 9, iv: 0, moves: [] }, // Pidgey
            { species: 16, level: 9, iv: 0, moves: [] }  // Pidgey
        ]
    },

    "LassSally": {
        trainerClass: "Lass",
        trainerName: "Sally",
        party: [
            { species: 19, level: 10, iv: 0, moves: [] }, // Rattata
            { species: 29, level: 10, iv: 0, moves: [] }  // Nidoran F
        ]
    },

    "LassRobin": {
        trainerClass: "Lass",
        trainerName: "Robin",
        party: [
            { species: 39, level: 14, iv: 0, moves: [] }  // Jigglypuff
        ]
    },

    // ========== SAILORS (Marinheiros) ==========
    "SailorEdmond": {
        trainerClass: "Sailor",
        trainerName: "Edmond",
        party: [
            { species: 66, level: 18, iv: 0, moves: [] }, // Machop
            { species: 90, level: 18, iv: 0, moves: [] }  // Shellder
        ]
    },

    "SailorTrevor": {
        trainerClass: "Sailor",
        trainerName: "Trevor",
        party: [
            { species: 66, level: 17, iv: 0, moves: [] }, // Machop
            { species: 72, level: 17, iv: 0, moves: [] }  // Tentacool
        ]
    },

    // ========== HIKERS (Montanhistas) ==========
    "HikerFranklin": {
        trainerClass: "Hiker",
        trainerName: "Franklin",
        party: [
            { species: 74, level: 15, iv: 0, moves: [] }, // Geodude
            { species: 74, level: 15, iv: 0, moves: [] }  // Geodude
        ]
    },

    "HikerWayne": {
        trainerClass: "Hiker",
        trainerName: "Wayne",
        party: [
            { species: 95, level: 17, iv: 0, moves: [] }  // Onix
        ]
    },

    // ========== PICNICKERS (Piqueniqueiras) ==========
    "PicnickerAlma": {
        trainerClass: "Picnicker",
        trainerName: "Alma",
        party: [
            { species: 43, level: 28, iv: 0, moves: [] }, // Oddish
            { species: 43, level: 28, iv: 0, moves: [] }, // Oddish
            { species: 44, level: 28, iv: 0, moves: [] }  // Gloom
        ]
    },

    // ========== CAMPERS (Campistas) ==========
    "CamperLiam": {
        trainerClass: "Camper",
        trainerName: "Liam",
        party: [
            { species: 27, level: 10, iv: 0, moves: [] }, // Sandshrew
            { species: 27, level: 11, iv: 0, moves: [] }  // Sandshrew
        ]
    },

    // ========== ROCKET GRUNTS (Team Rocket) ==========
    "RocketGrunt1": {
        trainerClass: "Team Rocket Grunt",
        trainerName: "Grunt",
        party: [
            { species: 19, level: 13, iv: 0, moves: [] }, // Rattata
            { species: 19, level: 13, iv: 0, moves: [] }  // Rattata
        ]
    },

    "RocketGrunt2": {
        trainerClass: "Team Rocket Grunt",
        trainerName: "Grunt",
        party: [
            { species: 27, level: 11, iv: 0, moves: [] }, // Sandshrew
            { species: 19, level: 11, iv: 0, moves: [] }, // Rattata
            { species: 41, level: 11, iv: 0, moves: [] }  // Zubat
        ]
    },

    "RocketGrunt3": {
        trainerClass: "Team Rocket Grunt",
        trainerName: "Grunt",
        party: [
            { species: 41, level: 14, iv: 0, moves: [] }, // Zubat
            { species: 23, level: 14, iv: 0, moves: [] }  // Ekans
        ]
    },

    // ========== SWIMMERS (Nadadores) ==========
    "SwimmerMaleLuis": {
        trainerClass: "Swimmer",
        trainerName: "Luis",
        party: [
            { species: 116, level: 16, iv: 0, moves: [] }, // Horsea
            { species: 90, level: 16, iv: 0, moves: [] }   // Shellder
        ]
    },

    "SwimmerFemaleAlice": {
        trainerClass: "Swimmer",
        trainerName: "Alice",
        party: [
            { species: 54, level: 30, iv: 0, moves: [] }, // Psyduck
            { species: 54, level: 30, iv: 0, moves: [] }  // Psyduck
        ]
    },

    // ========== FISHERMEN (Pescadores) ==========
    "FishermanDale": {
        trainerClass: "Fisherman",
        trainerName: "Dale",
        party: [
            { species: 129, level: 17, iv: 0, moves: [] }, // Magikarp
            { species: 129, level: 17, iv: 0, moves: [] }, // Magikarp
            { species: 129, level: 17, iv: 0, moves: [] }, // Magikarp
            { species: 129, level: 17, iv: 0, moves: [] }, // Magikarp
            { species: 129, level: 17, iv: 0, moves: [] }, // Magikarp
            { species: 129, level: 17, iv: 0, moves: [] }  // Magikarp
        ]
    },

    "FishermanBarny": {
        trainerClass: "Fisherman",
        trainerName: "Barny",
        party: [
            { species: 72, level: 17, iv: 0, moves: [] }, // Tentacool
            { species: 98, level: 17, iv: 0, moves: [] }, // Krabby
            { species: 116, level: 17, iv: 0, moves: [] }  // Horsea
        ]
    },

    // ========== BEAUTY (Beldades) ==========
    "BeautyBridget": {
        trainerClass: "Beauty",
        trainerName: "Bridget",
        party: [
            { species: 43, level: 21, iv: 0, moves: [] }, // Oddish
            { species: 69, level: 21, iv: 0, moves: [] }, // Bellsprout
            { species: 43, level: 21, iv: 0, moves: [] }, // Oddish
            { species: 69, level: 21, iv: 0, moves: [] }  // Bellsprout
        ]
    },

    // ========== PSYCHIC (Psíquicos) ==========
    "PsychicJohan": {
        trainerClass: "Psychic",
        trainerName: "Johan",
        party: [
            { species: 96, level: 31, iv: 0, moves: [] }, // Drowzee
            { species: 96, level: 31, iv: 0, moves: [] }, // Drowzee
            { species: 96, level: 31, iv: 0, moves: [] }, // Drowzee
            { species: 97, level: 31, iv: 0, moves: [] }  // Hypno
        ]
    },

    // ========== CHANNELERS (Médiums) ==========
    "ChannelerPatricia": {
        trainerClass: "Channeler",
        trainerName: "Patricia",
        party: [
            { species: 92, level: 22, iv: 0, moves: [] }  // Gastly
        ]
    },

    // ========== JUGGLER (Malabaristas) ==========
    "JugglerDalton": {
        trainerClass: "Juggler",
        trainerName: "Dalton",
        party: [
            { species: 96, level: 29, iv: 0, moves: [] }, // Drowzee
            { species: 97, level: 29, iv: 0, moves: [] }  // Hypno
        ]
    },

    // ========== TAMER (Domadores) ==========
    "TamerPhil": {
        trainerClass: "Tamer",
        trainerName: "Phil",
        party: [
            { species: 27, level: 34, iv: 0, moves: [] }, // Sandshrew
            { species: 24, level: 34, iv: 0, moves: [] }  // Arbok
        ]
    },

    // ========== BIRD KEEPER (Criadores de Pássaros) ==========
    "BirdKeeperSebastian": {
        trainerClass: "Bird Keeper",
        trainerName: "Sebastian",
        party: [
            { species: 16, level: 29, iv: 0, moves: [] }, // Pidgey
            { species: 16, level: 29, iv: 0, moves: [] }  // Pidgey
        ]
    },

    // ========== BLACK BELT (Faixa Preta) ==========
    "BlackBeltKoichi": {
        trainerClass: "Black Belt",
        trainerName: "Koichi",
        party: [
            { species: 66, level: 37, iv: 0, moves: [] }, // Machop
            { species: 67, level: 37, iv: 0, moves: [] }  // Machoke
        ]
    },

    // ========== RIVAL (Gary/Blue) ==========
    "RivalRoute22Squirtle": {
        trainerClass: "Rival",
        trainerName: "Gary",
        party: [
            { species: 16, level: 9, iv: 0, moves: [] },  // Pidgey
            { species: 7, level: 9, iv: 0, moves: [] }    // Squirtle
        ]
    },

    "RivalRoute22Bulbasaur": {
        trainerClass: "Rival",
        trainerName: "Gary",
        party: [
            { species: 16, level: 9, iv: 0, moves: [] },  // Pidgey
            { species: 1, level: 9, iv: 0, moves: [] }    // Bulbasaur
        ]
    },

    "RivalRoute22Charmander": {
        trainerClass: "Rival",
        trainerName: "Gary",
        party: [
            { species: 16, level: 9, iv: 0, moves: [] },  // Pidgey
            { species: 4, level: 9, iv: 0, moves: [] }    // Charmander
        ]
    },

    // ========== GYM LEADERS (Líderes de Ginásio) ==========
    "LeaderBrock": {
        trainerClass: "Gym Leader",
        trainerName: "Brock",
        party: [
            { species: 74, level: 12, iv: 0, moves: [] }, // Geodude
            { species: 95, level: 14, iv: 0, moves: [] }  // Onix
        ]
    },

    "LeaderMisty": {
        trainerClass: "Gym Leader",
        trainerName: "Misty",
        party: [
            { species: 120, level: 18, iv: 0, moves: [] }, // Staryu
            { species: 121, level: 21, iv: 0, moves: [] }  // Starmie
        ]
    },

    "LeaderLtSurge": {
        trainerClass: "Gym Leader",
        trainerName: "Lt. Surge",
        party: [
            { species: 100, level: 21, iv: 0, moves: [] }, // Voltorb
            { species: 25, level: 18, iv: 0, moves: [] },  // Pikachu
            { species: 26, level: 24, iv: 0, moves: [] }   // Raichu
        ]
    },

    "LeaderErika": {
        trainerClass: "Gym Leader",
        trainerName: "Erika",
        party: [
            { species: 71, level: 29, iv: 0, moves: [] }, // Victreebel
            { species: 114, level: 24, iv: 0, moves: [] }, // Tangela
            { species: 45, level: 29, iv: 0, moves: [] }  // Vileplume
        ]
    },

    "LeaderKoga": {
        trainerClass: "Gym Leader",
        trainerName: "Koga",
        party: [
            { species: 109, level: 37, iv: 0, moves: [] }, // Koffing
            { species: 89, level: 39, iv: 0, moves: [] },  // Muk
            { species: 109, level: 37, iv: 0, moves: [] }, // Koffing
            { species: 110, level: 43, iv: 0, moves: [] }  // Weezing
        ]
    },

    "LeaderSabrina": {
        trainerClass: "Gym Leader",
        trainerName: "Sabrina",
        party: [
            { species: 64, level: 38, iv: 0, moves: [] }, // Kadabra
            { species: 122, level: 37, iv: 0, moves: [] }, // Mr. Mime
            { species: 49, level: 38, iv: 0, moves: [] },  // Venomoth
            { species: 65, level: 43, iv: 0, moves: [] }   // Alakazam
        ]
    },

    "LeaderBlaine": {
        trainerClass: "Gym Leader",
        trainerName: "Blaine",
        party: [
            { species: 58, level: 42, iv: 0, moves: [] }, // Growlithe
            { species: 77, level: 40, iv: 0, moves: [] }, // Ponyta
            { species: 78, level: 42, iv: 0, moves: [] }, // Rapidash
            { species: 59, level: 47, iv: 0, moves: [] }  // Arcanine
        ]
    },

    "LeaderGiovanni": {
        trainerClass: "Gym Leader",
        trainerName: "Giovanni",
        party: [
            { species: 111, level: 45, iv: 0, moves: [] }, // Rhyhorn
            { species: 51, level: 42, iv: 0, moves: [] },  // Dugtrio
            { species: 31, level: 44, iv: 0, moves: [] },  // Nidoqueen
            { species: 34, level: 45, iv: 0, moves: [] },  // Nidoking
            { species: 112, level: 50, iv: 0, moves: [] }  // Rhydon
        ]
    }
};
