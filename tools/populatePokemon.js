/**
 * Pokemon Database Population Script - Complete Gen 1
 * 
 * Populates the pokemon table with all 151 Gen 1 Pokemon from pokefirered-master
 */

const { getDb } = require('../services/db');

// All 151 Gen 1 Pokemon with base stats from FireRed
const POKEMON_DATA = [
    // 1-10
    { id: 1, name: 'Bulbasaur', type1: 'Grass', type2: 'Poison', hp: 45, attack: 49, defense: 49, spAttack: 65, spDefense: 65, speed: 45 },
    { id: 2, name: 'Ivysaur', type1: 'Grass', type2: 'Poison', hp: 60, attack: 62, defense: 63, spAttack: 80, spDefense: 80, speed: 60 },
    { id: 3, name: 'Venusaur', type1: 'Grass', type2: 'Poison', hp: 80, attack: 82, defense: 83, spAttack: 100, spDefense: 100, speed: 80 },
    { id: 4, name: 'Charmander', type1: 'Fire', type2: null, hp: 39, attack: 52, defense: 43, spAttack: 60, spDefense: 50, speed: 65 },
    { id: 5, name: 'Charmeleon', type1: 'Fire', type2: null, hp: 58, attack: 64, defense: 58, spAttack: 80, spDefense: 65, speed: 80 },
    { id: 6, name: 'Charizard', type1: 'Fire', type2: 'Flying', hp: 78, attack: 84, defense: 78, spAttack: 109, spDefense: 85, speed: 100 },
    { id: 7, name: 'Squirtle', type1: 'Water', type2: null, hp: 44, attack: 48, defense: 65, spAttack: 50, spDefense: 64, speed: 43 },
    { id: 8, name: 'Wartortle', type1: 'Water', type2: null, hp: 59, attack: 63, defense: 80, spAttack: 65, spDefense: 80, speed: 58 },
    { id: 9, name: 'Blastoise', type1: 'Water', type2: null, hp: 79, attack: 83, defense: 100, spAttack: 85, spDefense: 105, speed: 78 },
    { id: 10, name: 'Caterpie', type1: 'Bug', type2: null, hp: 45, attack: 30, defense: 35, spAttack: 20, spDefense: 20, speed: 45 },

    // 11-20
    { id: 11, name: 'Metapod', type1: 'Bug', type2: null, hp: 50, attack: 20, defense: 55, spAttack: 25, spDefense: 25, speed: 30 },
    { id: 12, name: 'Butterfree', type1: 'Bug', type2: 'Flying', hp: 60, attack: 45, defense: 50, spAttack: 90, spDefense: 80, speed: 70 },
    { id: 13, name: 'Weedle', type1: 'Bug', type2: 'Poison', hp: 40, attack: 35, defense: 30, spAttack: 20, spDefense: 20, speed: 50 },
    { id: 14, name: 'Kakuna', type1: 'Bug', type2: 'Poison', hp: 45, attack: 25, defense: 50, spAttack: 25, spDefense: 25, speed: 35 },
    { id: 15, name: 'Beedrill', type1: 'Bug', type2: 'Poison', hp: 65, attack: 90, defense: 40, spAttack: 45, spDefense: 80, speed: 75 },
    { id: 16, name: 'Pidgey', type1: 'Normal', type2: 'Flying', hp: 40, attack: 45, defense: 40, spAttack: 35, spDefense: 35, speed: 56 },
    { id: 17, name: 'Pidgeotto', type1: 'Normal', type2: 'Flying', hp: 63, attack: 60, defense: 55, spAttack: 50, spDefense: 50, speed: 71 },
    { id: 18, name: 'Pidgeot', type1: 'Normal', type2: 'Flying', hp: 83, attack: 80, defense: 75, spAttack: 70, spDefense: 70, speed: 101 },
    { id: 19, name: 'Rattata', type1: 'Normal', type2: null, hp: 30, attack: 56, defense: 35, spAttack: 25, spDefense: 35, speed: 72 },
    { id: 20, name: 'Raticate', type1: 'Normal', type2: null, hp: 55, attack: 81, defense: 60, spAttack: 50, spDefense: 70, speed: 97 },

    // 21-30
    { id: 21, name: 'Spearow', type1: 'Normal', type2: 'Flying', hp: 40, attack: 60, defense: 30, spAttack: 31, spDefense: 31, speed: 70 },
    { id: 22, name: 'Fearow', type1: 'Normal', type2: 'Flying', hp: 65, attack: 90, defense: 65, spAttack: 61, spDefense: 61, speed: 100 },
    { id: 23, name: 'Ekans', type1: 'Poison', type2: null, hp: 35, attack: 60, defense: 44, spAttack: 40, spDefense: 54, speed: 55 },
    { id: 24, name: 'Arbok', type1: 'Poison', type2: null, hp: 60, attack: 85, defense: 69, spAttack: 65, spDefense: 79, speed: 80 },
    { id: 25, name: 'Pikachu', type1: 'Electric', type2: null, hp: 35, attack: 55, defense: 40, spAttack: 50, spDefense: 50, speed: 90 },
    { id: 26, name: 'Raichu', type1: 'Electric', type2: null, hp: 60, attack: 90, defense: 55, spAttack: 90, spDefense: 80, speed: 110 },
    { id: 27, name: 'Sandshrew', type1: 'Ground', type2: null, hp: 50, attack: 75, defense: 85, spAttack: 20, spDefense: 30, speed: 40 },
    { id: 28, name: 'Sandslash', type1: 'Ground', type2: null, hp: 75, attack: 100, defense: 110, spAttack: 45, spDefense: 55, speed: 65 },
    { id: 29, name: 'Nidoran♀', type1: 'Poison', type2: null, hp: 55, attack: 47, defense: 52, spAttack: 40, spDefense: 40, speed: 41 },
    { id: 30, name: 'Nidorina', type1: 'Poison', type2: null, hp: 70, attack: 62, defense: 67, spAttack: 55, spDefense: 55, speed: 56 },

    // 31-40
    { id: 31, name: 'Nidoqueen', type1: 'Poison', type2: 'Ground', hp: 90, attack: 92, defense: 87, spAttack: 75, spDefense: 85, speed: 76 },
    { id: 32, name: 'Nidoran♂', type1: 'Poison', type2: null, hp: 46, attack: 57, defense: 40, spAttack: 40, spDefense: 40, speed: 50 },
    { id: 33, name: 'Nidorino', type1: 'Poison', type2: null, hp: 61, attack: 72, defense: 57, spAttack: 55, spDefense: 55, speed: 65 },
    { id: 34, name: 'Nidoking', type1: 'Poison', type2: 'Ground', hp: 81, attack: 102, defense: 77, spAttack: 85, spDefense: 75, speed: 85 },
    { id: 35, name: 'Clefairy', type1: 'Fairy', type2: null, hp: 70, attack: 45, defense: 48, spAttack: 60, spDefense: 65, speed: 35 },
    { id: 36, name: 'Clefable', type1: 'Fairy', type2: null, hp: 95, attack: 70, defense: 73, spAttack: 95, spDefense: 90, speed: 60 },
    { id: 37, name: 'Vulpix', type1: 'Fire', type2: null, hp: 38, attack: 41, defense: 40, spAttack: 50, spDefense: 65, speed: 65 },
    { id: 38, name: 'Ninetales', type1: 'Fire', type2: null, hp: 73, attack: 76, defense: 75, spAttack: 81, spDefense: 100, speed: 100 },
    { id: 39, name: 'Jigglypuff', type1: 'Normal', type2: 'Fairy', hp: 115, attack: 45, defense: 20, spAttack: 45, spDefense: 25, speed: 20 },
    { id: 40, name: 'Wigglytuff', type1: 'Normal', type2: 'Fairy', hp: 140, attack: 70, defense: 45, spAttack: 85, spDefense: 50, speed: 45 },

    // 41-50
    { id: 41, name: 'Zubat', type1: 'Poison', type2: 'Flying', hp: 40, attack: 45, defense: 35, spAttack: 30, spDefense: 40, speed: 55 },
    { id: 42, name: 'Golbat', type1: 'Poison', type2: 'Flying', hp: 75, attack: 80, defense: 70, spAttack: 65, spDefense: 75, speed: 90 },
    { id: 43, name: 'Oddish', type1: 'Grass', type2: 'Poison', hp: 45, attack: 50, defense: 55, spAttack: 75, spDefense: 65, speed: 30 },
    { id: 44, name: 'Gloom', type1: 'Grass', type2: 'Poison', hp: 60, attack: 65, defense: 70, spAttack: 85, spDefense: 75, speed: 40 },
    { id: 45, name: 'Vileplume', type1: 'Grass', type2: 'Poison', hp: 75, attack: 80, defense: 85, spAttack: 110, spDefense: 90, speed: 50 },
    { id: 46, name: 'Paras', type1: 'Bug', type2: 'Grass', hp: 35, attack: 70, defense: 55, spAttack: 45, spDefense: 55, speed: 25 },
    { id: 47, name: 'Parasect', type1: 'Bug', type2: 'Grass', hp: 60, attack: 95, defense: 80, spAttack: 60, spDefense: 80, speed: 30 },
    { id: 48, name: 'Venonat', type1: 'Bug', type2: 'Poison', hp: 60, attack: 55, defense: 50, spAttack: 40, spDefense: 55, speed: 45 },
    { id: 49, name: 'Venomoth', type1: 'Bug', type2: 'Poison', hp: 70, attack: 65, defense: 60, spAttack: 90, spDefense: 75, speed: 90 },
    { id: 50, name: 'Diglett', type1: 'Ground', type2: null, hp: 10, attack: 55, defense: 25, spAttack: 35, spDefense: 45, speed: 95 },

    // 51-60
    { id: 51, name: 'Dugtrio', type1: 'Ground', type2: null, hp: 35, attack: 100, defense: 50, spAttack: 50, spDefense: 70, speed: 120 },
    { id: 52, name: 'Meowth', type1: 'Normal', type2: null, hp: 40, attack: 45, defense: 35, spAttack: 40, spDefense: 40, speed: 90 },
    { id: 53, name: 'Persian', type1: 'Normal', type2: null, hp: 65, attack: 70, defense: 60, spAttack: 65, spDefense: 65, speed: 115 },
    { id: 54, name: 'Psyduck', type1: 'Water', type2: null, hp: 50, attack: 52, defense: 48, spAttack: 65, spDefense: 50, speed: 55 },
    { id: 55, name: 'Golduck', type1: 'Water', type2: null, hp: 80, attack: 82, defense: 78, spAttack: 95, spDefense: 80, speed: 85 },
    { id: 56, name: 'Mankey', type1: 'Fighting', type2: null, hp: 40, attack: 80, defense: 35, spAttack: 35, spDefense: 45, speed: 70 },
    { id: 57, name: 'Primeape', type1: 'Fighting', type2: null, hp: 65, attack: 105, defense: 60, spAttack: 60, spDefense: 70, speed: 95 },
    { id: 58, name: 'Growlithe', type1: 'Fire', type2: null, hp: 55, attack: 70, defense: 45, spAttack: 70, spDefense: 50, speed: 60 },
    { id: 59, name: 'Arcanine', type1: 'Fire', type2: null, hp: 90, attack: 110, defense: 80, spAttack: 100, spDefense: 80, speed: 95 },
    { id: 60, name: 'Poliwag', type1: 'Water', type2: null, hp: 40, attack: 50, defense: 40, spAttack: 40, spDefense: 40, speed: 90 },

    // 61-70
    { id: 61, name: 'Poliwhirl', type1: 'Water', type2: null, hp: 65, attack: 65, defense: 65, spAttack: 50, spDefense: 50, speed: 90 },
    { id: 62, name: 'Poliwrath', type1: 'Water', type2: 'Fighting', hp: 90, attack: 95, defense: 95, spAttack: 70, spDefense: 90, speed: 70 },
    { id: 63, name: 'Abra', type1: 'Psychic', type2: null, hp: 25, attack: 20, defense: 15, spAttack: 105, spDefense: 55, speed: 90 },
    { id: 64, name: 'Kadabra', type1: 'Psychic', type2: null, hp: 40, attack: 35, defense: 30, spAttack: 120, spDefense: 70, speed: 105 },
    { id: 65, name: 'Alakazam', type1: 'Psychic', type2: null, hp: 55, attack: 50, defense: 45, spAttack: 135, spDefense: 95, speed: 120 },
    { id: 66, name: 'Machop', type1: 'Fighting', type2: null, hp: 70, attack: 80, defense: 50, spAttack: 35, spDefense: 35, speed: 35 },
    { id: 67, name: 'Machoke', type1: 'Fighting', type2: null, hp: 80, attack: 100, defense: 70, spAttack: 50, spDefense: 60, speed: 45 },
    { id: 68, name: 'Machamp', type1: 'Fighting', type2: null, hp: 90, attack: 130, defense: 80, spAttack: 65, spDefense: 85, speed: 55 },
    { id: 69, name: 'Bellsprout', type1: 'Grass', type2: 'Poison', hp: 50, attack: 75, defense: 35, spAttack: 70, spDefense: 30, speed: 40 },
    { id: 70, name: 'Weepinbell', type1: 'Grass', type2: 'Poison', hp: 65, attack: 90, defense: 50, spAttack: 85, spDefense: 45, speed: 55 },

    // 71-80
    { id: 71, name: 'Victreebel', type1: 'Grass', type2: 'Poison', hp: 80, attack: 105, defense: 65, spAttack: 100, spDefense: 70, speed: 70 },
    { id: 72, name: 'Tentacool', type1: 'Water', type2: 'Poison', hp: 40, attack: 40, defense: 35, spAttack: 50, spDefense: 100, speed: 70 },
    { id: 73, name: 'Tentacruel', type1: 'Water', type2: 'Poison', hp: 80, attack: 70, defense: 65, spAttack: 80, spDefense: 120, speed: 100 },
    { id: 74, name: 'Geodude', type1: 'Rock', type2: 'Ground', hp: 40, attack: 80, defense: 100, spAttack: 30, spDefense: 30, speed: 20 },
    { id: 75, name: 'Graveler', type1: 'Rock', type2: 'Ground', hp: 55, attack: 95, defense: 115, spAttack: 45, spDefense: 45, speed: 35 },
    { id: 76, name: 'Golem', type1: 'Rock', type2: 'Ground', hp: 80, attack: 120, defense: 130, spAttack: 55, spDefense: 65, speed: 45 },
    { id: 77, name: 'Ponyta', type1: 'Fire', type2: null, hp: 50, attack: 85, defense: 55, spAttack: 65, spDefense: 65, speed: 90 },
    { id: 78, name: 'Rapidash', type1: 'Fire', type2: null, hp: 65, attack: 100, defense: 70, spAttack: 80, spDefense: 80, speed: 105 },
    { id: 79, name: 'Slowpoke', type1: 'Water', type2: 'Psychic', hp: 90, attack: 65, defense: 65, spAttack: 40, spDefense: 40, speed: 15 },
    { id: 80, name: 'Slowbro', type1: 'Water', type2: 'Psychic', hp: 95, attack: 75, defense: 110, spAttack: 100, spDefense: 80, speed: 30 },

    // 81-90
    { id: 81, name: 'Magnemite', type1: 'Electric', type2: 'Steel', hp: 25, attack: 35, defense: 70, spAttack: 95, spDefense: 55, speed: 45 },
    { id: 82, name: 'Magneton', type1: 'Electric', type2: 'Steel', hp: 50, attack: 60, defense: 95, spAttack: 120, spDefense: 70, speed: 70 },
    { id: 83, name: 'Farfetch\'d', type1: 'Normal', type2: 'Flying', hp: 52, attack: 90, defense: 55, spAttack: 58, spDefense: 62, speed: 60 },
    { id: 84, name: 'Doduo', type1: 'Normal', type2: 'Flying', hp: 35, attack: 85, defense: 45, spAttack: 35, spDefense: 35, speed: 75 },
    { id: 85, name: 'Dodrio', type1: 'Normal', type2: 'Flying', hp: 60, attack: 110, defense: 70, spAttack: 60, spDefense: 60, speed: 110 },
    { id: 86, name: 'Seel', type1: 'Water', type2: null, hp: 65, attack: 45, defense: 55, spAttack: 45, spDefense: 70, speed: 45 },
    { id: 87, name: 'Dewgong', type1: 'Water', type2: 'Ice', hp: 90, attack: 70, defense: 80, spAttack: 70, spDefense: 95, speed: 70 },
    { id: 88, name: 'Grimer', type1: 'Poison', type2: null, hp: 80, attack: 80, defense: 50, spAttack: 40, spDefense: 50, speed: 25 },
    { id: 89, name: 'Muk', type1: 'Poison', type2: null, hp: 105, attack: 105, defense: 75, spAttack: 65, spDefense: 100, speed: 50 },
    { id: 90, name: 'Shellder', type1: 'Water', type2: null, hp: 30, attack: 65, defense: 100, spAttack: 45, spDefense: 25, speed: 40 },

    // 91-100
    { id: 91, name: 'Cloyster', type1: 'Water', type2: 'Ice', hp: 50, attack: 95, defense: 180, spAttack: 85, spDefense: 45, speed: 70 },
    { id: 92, name: 'Gastly', type1: 'Ghost', type2: 'Poison', hp: 30, attack: 35, defense: 30, spAttack: 100, spDefense: 35, speed: 80 },
    { id: 93, name: 'Haunter', type1: 'Ghost', type2: 'Poison', hp: 45, attack: 50, defense: 45, spAttack: 115, spDefense: 55, speed: 95 },
    { id: 94, name: 'Gengar', type1: 'Ghost', type2: 'Poison', hp: 60, attack: 65, defense: 60, spAttack: 130, spDefense: 75, speed: 110 },
    { id: 95, name: 'Onix', type1: 'Rock', type2: 'Ground', hp: 35, attack: 45, defense: 160, spAttack: 30, spDefense: 45, speed: 70 },
    { id: 96, name: 'Drowzee', type1: 'Psychic', type2: null, hp: 60, attack: 48, defense: 45, spAttack: 43, spDefense: 90, speed: 42 },
    { id: 97, name: 'Hypno', type1: 'Psychic', type2: null, hp: 85, attack: 73, defense: 70, spAttack: 73, spDefense: 115, speed: 67 },
    { id: 98, name: 'Krabby', type1: 'Water', type2: null, hp: 30, attack: 105, defense: 90, spAttack: 25, spDefense: 25, speed: 50 },
    { id: 99, name: 'Kingler', type1: 'Water', type2: null, hp: 55, attack: 130, defense: 115, spAttack: 50, spDefense: 50, speed: 75 },
    { id: 100, name: 'Voltorb', type1: 'Electric', type2: null, hp: 40, attack: 30, defense: 50, spAttack: 55, spDefense: 55, speed: 100 },

    // 101-110
    { id: 101, name: 'Electrode', type1: 'Electric', type2: null, hp: 60, attack: 50, defense: 70, spAttack: 80, spDefense: 80, speed: 150 },
    { id: 102, name: 'Exeggcute', type1: 'Grass', type2: 'Psychic', hp: 60, attack: 40, defense: 80, spAttack: 60, spDefense: 45, speed: 40 },
    { id: 103, name: 'Exeggutor', type1: 'Grass', type2: 'Psychic', hp: 95, attack: 95, defense: 85, spAttack: 125, spDefense: 75, speed: 55 },
    { id: 104, name: 'Cubone', type1: 'Ground', type2: null, hp: 50, attack: 50, defense: 95, spAttack: 40, spDefense: 50, speed: 35 },
    { id: 105, name: 'Marowak', type1: 'Ground', type2: null, hp: 60, attack: 80, defense: 110, spAttack: 50, spDefense: 80, speed: 45 },
    { id: 106, name: 'Hitmonlee', type1: 'Fighting', type2: null, hp: 50, attack: 120, defense: 53, spAttack: 35, spDefense: 110, speed: 87 },
    { id: 107, name: 'Hitmonchan', type1: 'Fighting', type2: null, hp: 50, attack: 105, defense: 79, spAttack: 35, spDefense: 110, speed: 76 },
    { id: 108, name: 'Lickitung', type1: 'Normal', type2: null, hp: 90, attack: 55, defense: 75, spAttack: 60, spDefense: 75, speed: 30 },
    { id: 109, name: 'Koffing', type1: 'Poison', type2: null, hp: 40, attack: 65, defense: 95, spAttack: 60, spDefense: 45, speed: 35 },
    { id: 110, name: 'Weezing', type1: 'Poison', type2: null, hp: 65, attack: 90, defense: 120, spAttack: 85, spDefense: 70, speed: 60 },

    // 111-120
    { id: 111, name: 'Rhyhorn', type1: 'Ground', type2: 'Rock', hp: 80, attack: 85, defense: 95, spAttack: 30, spDefense: 30, speed: 25 },
    { id: 112, name: 'Rhydon', type1: 'Ground', type2: 'Rock', hp: 105, attack: 130, defense: 120, spAttack: 45, spDefense: 45, speed: 40 },
    { id: 113, name: 'Chansey', type1: 'Normal', type2: null, hp: 250, attack: 5, defense: 5, spAttack: 35, spDefense: 105, speed: 50 },
    { id: 114, name: 'Tangela', type1: 'Grass', type2: null, hp: 65, attack: 55, defense: 115, spAttack: 100, spDefense: 40, speed: 60 },
    { id: 115, name: 'Kangaskhan', type1: 'Normal', type2: null, hp: 105, attack: 95, defense: 80, spAttack: 40, spDefense: 80, speed: 90 },
    { id: 116, name: 'Horsea', type1: 'Water', type2: null, hp: 30, attack: 40, defense: 70, spAttack: 70, spDefense: 25, speed: 60 },
    { id: 117, name: 'Seadra', type1: 'Water', type2: null, hp: 55, attack: 65, defense: 95, spAttack: 95, spDefense: 45, speed: 85 },
    { id: 118, name: 'Goldeen', type1: 'Water', type2: null, hp: 45, attack: 67, defense: 60, spAttack: 35, spDefense: 50, speed: 63 },
    { id: 119, name: 'Seaking', type1: 'Water', type2: null, hp: 80, attack: 92, defense: 65, spAttack: 65, spDefense: 80, speed: 68 },
    { id: 120, name: 'Staryu', type1: 'Water', type2: null, hp: 30, attack: 45, defense: 55, spAttack: 70, spDefense: 55, speed: 85 },

    // 121-130
    { id: 121, name: 'Starmie', type1: 'Water', type2: 'Psychic', hp: 60, attack: 75, defense: 85, spAttack: 100, spDefense: 85, speed: 115 },
    { id: 122, name: 'Mr. Mime', type1: 'Psychic', type2: 'Fairy', hp: 40, attack: 45, defense: 65, spAttack: 100, spDefense: 120, speed: 90 },
    { id: 123, name: 'Scyther', type1: 'Bug', type2: 'Flying', hp: 70, attack: 110, defense: 80, spAttack: 55, spDefense: 80, speed: 105 },
    { id: 124, name: 'Jynx', type1: 'Ice', type2: 'Psychic', hp: 65, attack: 50, defense: 35, spAttack: 115, spDefense: 95, speed: 95 },
    { id: 125, name: 'Electabuzz', type1: 'Electric', type2: null, hp: 65, attack: 83, defense: 57, spAttack: 95, spDefense: 85, speed: 105 },
    { id: 126, name: 'Magmar', type1: 'Fire', type2: null, hp: 65, attack: 95, defense: 57, spAttack: 100, spDefense: 85, speed: 93 },
    { id: 127, name: 'Pinsir', type1: 'Bug', type2: null, hp: 65, attack: 125, defense: 100, spAttack: 55, spDefense: 70, speed: 85 },
    { id: 128, name: 'Tauros', type1: 'Normal', type2: null, hp: 75, attack: 100, defense: 95, spAttack: 40, spDefense: 70, speed: 110 },
    { id: 129, name: 'Magikarp', type1: 'Water', type2: null, hp: 20, attack: 10, defense: 55, spAttack: 15, spDefense: 20, speed: 80 },
    { id: 130, name: 'Gyarados', type1: 'Water', type2: 'Flying', hp: 95, attack: 125, defense: 79, spAttack: 60, spDefense: 100, speed: 81 },

    // 131-140
    { id: 131, name: 'Lapras', type1: 'Water', type2: 'Ice', hp: 130, attack: 85, defense: 80, spAttack: 85, spDefense: 95, speed: 60 },
    { id: 132, name: 'Ditto', type1: 'Normal', type2: null, hp: 48, attack: 48, defense: 48, spAttack: 48, spDefense: 48, speed: 48 },
    { id: 133, name: 'Eevee', type1: 'Normal', type2: null, hp: 55, attack: 55, defense: 50, spAttack: 45, spDefense: 65, speed: 55 },
    { id: 134, name: 'Vaporeon', type1: 'Water', type2: null, hp: 130, attack: 65, defense: 60, spAttack: 110, spDefense: 95, speed: 65 },
    { id: 135, name: 'Jolteon', type1: 'Electric', type2: null, hp: 65, attack: 65, defense: 60, spAttack: 110, spDefense: 95, speed: 130 },
    { id: 136, name: 'Flareon', type1: 'Fire', type2: null, hp: 65, attack: 130, defense: 60, spAttack: 95, spDefense: 110, speed: 65 },
    { id: 137, name: 'Porygon', type1: 'Normal', type2: null, hp: 65, attack: 60, defense: 70, spAttack: 85, spDefense: 75, speed: 40 },
    { id: 138, name: 'Omanyte', type1: 'Rock', type2: 'Water', hp: 35, attack: 40, defense: 100, spAttack: 90, spDefense: 55, speed: 35 },
    { id: 139, name: 'Omastar', type1: 'Rock', type2: 'Water', hp: 70, attack: 60, defense: 125, spAttack: 115, spDefense: 70, speed: 55 },
    { id: 140, name: 'Kabuto', type1: 'Rock', type2: 'Water', hp: 30, attack: 80, defense: 90, spAttack: 55, spDefense: 45, speed: 55 },

    // 141-151
    { id: 141, name: 'Kabutops', type1: 'Rock', type2: 'Water', hp: 60, attack: 115, defense: 105, spAttack: 65, spDefense: 70, speed: 80 },
    { id: 142, name: 'Aerodactyl', type1: 'Rock', type2: 'Flying', hp: 80, attack: 105, defense: 65, spAttack: 60, spDefense: 75, speed: 130 },
    { id: 143, name: 'Snorlax', type1: 'Normal', type2: null, hp: 160, attack: 110, defense: 65, spAttack: 65, spDefense: 110, speed: 30 },
    { id: 144, name: 'Articuno', type1: 'Ice', type2: 'Flying', hp: 90, attack: 85, defense: 100, spAttack: 95, spDefense: 125, speed: 85 },
    { id: 145, name: 'Zapdos', type1: 'Electric', type2: 'Flying', hp: 90, attack: 90, defense: 85, spAttack: 125, spDefense: 90, speed: 100 },
    { id: 146, name: 'Moltres', type1: 'Fire', type2: 'Flying', hp: 90, attack: 100, defense: 90, spAttack: 125, spDefense: 85, speed: 90 },
    { id: 147, name: 'Dratini', type1: 'Dragon', type2: null, hp: 41, attack: 64, defense: 45, spAttack: 50, spDefense: 50, speed: 50 },
    { id: 148, name: 'Dragonair', type1: 'Dragon', type2: null, hp: 61, attack: 84, defense: 65, spAttack: 70, spDefense: 70, speed: 70 },
    { id: 149, name: 'Dragonite', type1: 'Dragon', type2: 'Flying', hp: 91, attack: 134, defense: 95, spAttack: 100, spDefense: 100, speed: 80 },
    { id: 150, name: 'Mewtwo', type1: 'Psychic', type2: null, hp: 106, attack: 110, defense: 90, spAttack: 154, spDefense: 90, speed: 130 },
    { id: 151, name: 'Mew', type1: 'Psychic', type2: null, hp: 100, attack: 100, defense: 100, spAttack: 100, spDefense: 100, speed: 100 }
];

function populatePokemonDatabase() {
    const db = getDb();

    console.log('🔄 Populando tabela de Pokémon com todos os 151 da Gen 1...');

    // Create table if not exists
    db.exec(`
    CREATE TABLE IF NOT EXISTS pokemon (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type1 TEXT NOT NULL,
      type2 TEXT,
      hp INTEGER NOT NULL,
      attack INTEGER NOT NULL,
      defense INTEGER NOT NULL,
      sp_attack INTEGER NOT NULL,
      sp_defense INTEGER NOT NULL,
      speed INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

    const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO pokemon 
    (id, name, type1, type2, hp, attack, defense, sp_attack, sp_defense, speed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    let count = 0;
    for (const pokemon of POKEMON_DATA) {
        try {
            insertStmt.run(
                pokemon.id,
                pokemon.name,
                pokemon.type1,
                pokemon.type2,
                pokemon.hp,
                pokemon.attack,
                pokemon.defense,
                pokemon.spAttack,
                pokemon.spDefense,
                pokemon.speed
            );
            count++;
        } catch (err) {
            console.error(`Erro ao inserir ${pokemon.name}:`, err.message);
        }
    }

    console.log(`✅ ${count} Pokémon inseridos/atualizados!`);

    // Verify
    const total = db.prepare('SELECT COUNT(*) as count FROM pokemon').get();
    console.log(`📊 Total de Pokémon no banco: ${total.count}`);

    // Show some examples
    const examples = db.prepare('SELECT id, name, type1, type2, hp FROM pokemon WHERE id IN (1, 25, 150) ORDER BY id').all();
    console.log('\n📝 Exemplos:');
    examples.forEach(p => {
        console.log(`  #${p.id} ${p.name} (${p.type1}${p.type2 ? '/' + p.type2 : ''}) - HP: ${p.hp}`);
    });
}

// Run if called directly
if (require.main === module) {
    try {
        populatePokemonDatabase();
        console.log('\n✅ População concluída com sucesso!');
    } catch (err) {
        console.error('❌ Erro:', err);
        process.exit(1);
    }
}

module.exports = { populatePokemonDatabase };
