/**
 * Script para extrair NPCs (object_events) dos mapas do Pokemon FireRed
 * e popular os arquivos JSON em core/mapas/
 */

const fs = require('fs');
const path = require('path');

// Configuração de caminhos
const FIRERED_MAPS_DIR = path.join(__dirname, '..', 'core', 'pokefirered-master', 'pokefirered-master', 'data', 'maps');
const OUTPUT_MAPS_DIR = path.join(__dirname, '..', 'core', 'mapas');

// Mapeamento de movement_type para facing direction
const MOVEMENT_TO_FACING = {
  'MOVEMENT_TYPE_FACE_UP': 'up',
  'MOVEMENT_TYPE_FACE_DOWN': 'down',
  'MOVEMENT_TYPE_FACE_LEFT': 'left',
  'MOVEMENT_TYPE_FACE_RIGHT': 'right',
  'MOVEMENT_TYPE_LOOK_AROUND': 'down',
  'MOVEMENT_TYPE_WANDER_AROUND': 'down',
  'MOVEMENT_TYPE_WANDER_UP_AND_DOWN': 'down',
  'MOVEMENT_TYPE_WANDER_LEFT_AND_RIGHT': 'right',
};

function getFacingFromMovement(movementType) {
  return MOVEMENT_TO_FACING[movementType] || 'down';
}

/**
 * Extrai NPCs de um mapa do FireRed
 */
function extractNPCsFromFireRedMap(mapJsonPath) {
  try {
    const data = JSON.parse(fs.readFileSync(mapJsonPath, 'utf8'));
    const objectEvents = data.object_events || [];
    
    const npcs = objectEvents.map((obj, index) => {
      // Alguns NPCs podem ter flags que os ocultam - vamos incluir todos
      // mas marcar os que têm flags especiais
      return {
        id: `npc-${data.name || 'unknown'}-${index}`,
        x: obj.x || 0,
        y: obj.y || 0,
        sprite: obj.graphics_id || 'OBJ_EVENT_GFX_BOY',
        facing: getFacingFromMovement(obj.movement_type || ''),
        solid: true, // Por padrão, NPCs são sólidos
        elevation: obj.elevation || 0,
        movementType: obj.movement_type || 'MOVEMENT_TYPE_FACE_DOWN',
        movementRangeX: obj.movement_range_x || 0,
        movementRangeY: obj.movement_range_y || 0,
        // Metadados opcionais para referência
        meta: {
          localId: obj.local_id || '',
          script: obj.script || '',
          flag: obj.flag || '0'
        }
      };
    });
    
    return npcs;
  } catch (error) {
    console.error(`Erro ao processar ${mapJsonPath}:`, error.message);
    return [];
  }
}

/**
 * Atualiza um arquivo de mapa JSON com os NPCs extraídos
 */
function updateMapWithNPCs(mapFilePath, npcs) {
  try {
    const mapData = JSON.parse(fs.readFileSync(mapFilePath, 'utf8'));
    
    // Atualiza o campo npcs
    mapData.npcs = npcs;
    
    // Salva o arquivo atualizado
    fs.writeFileSync(mapFilePath, JSON.stringify(mapData, null, 4), 'utf8');
    
    return true;
  } catch (error) {
    console.error(`Erro ao atualizar ${mapFilePath}:`, error.message);
    return false;
  }
}

/**
 * Processa todos os mapas
 */
function processAllMaps() {
  console.log('🗺️  Iniciando extração de NPCs de todos os mapas...\n');
  
  let totalMaps = 0;
  let mapsWithNPCs = 0;
  let totalNPCs = 0;
  const npcSprites = new Set();
  
  // Lista todos os diretórios de mapas no FireRed
  const mapDirs = fs.readdirSync(FIRERED_MAPS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  for (const mapDir of mapDirs) {
    const fireRedMapJsonPath = path.join(FIRERED_MAPS_DIR, mapDir, 'map.json');
    const outputMapJsonPath = path.join(OUTPUT_MAPS_DIR, `${mapDir}.json`);
    
    // Verifica se o arquivo de origem existe
    if (!fs.existsSync(fireRedMapJsonPath)) {
      continue;
    }
    
    // Verifica se o arquivo de destino existe
    if (!fs.existsSync(outputMapJsonPath)) {
      console.log(`⚠️  Mapa de destino não encontrado: ${mapDir}.json`);
      continue;
    }
    
    totalMaps++;
    
    // Extrai NPCs do mapa do FireRed
    const npcs = extractNPCsFromFireRedMap(fireRedMapJsonPath);
    
    if (npcs.length > 0) {
      mapsWithNPCs++;
      totalNPCs += npcs.length;
      
      // Coleta sprites únicos
      npcs.forEach(npc => npcSprites.add(npc.sprite));
      
      console.log(`✅ ${mapDir}: ${npcs.length} NPCs`);
      
      // Atualiza o arquivo de mapa
      updateMapWithNPCs(outputMapJsonPath, npcs);
    } else {
      // Mesmo sem NPCs, atualiza com array vazio
      updateMapWithNPCs(outputMapJsonPath, []);
    }
  }
  
  console.log('\n📊 Resumo:');
  console.log(`   Total de mapas processados: ${totalMaps}`);
  console.log(`   Mapas com NPCs: ${mapsWithNPCs}`);
  console.log(`   Total de NPCs extraídos: ${totalNPCs}`);
  console.log(`   Sprites únicos encontrados: ${npcSprites.size}`);
  
  // Salva lista de sprites únicos para referência
  const spritesListPath = path.join(__dirname, '..', 'core', 'npc-sprites-list.json');
  fs.writeFileSync(
    spritesListPath,
    JSON.stringify(Array.from(npcSprites).sort(), null, 2),
    'utf8'
  );
  
  console.log(`\n💾 Lista de sprites salvando em: ${spritesListPath}`);
  console.log('\n✅ Extração concluída!');
}

// Executa o script
processAllMaps();
