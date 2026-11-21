// Puerto Luna — an original open-world crime game. All names, places,
// characters and story are invented for this entry; nothing is taken from
// any commercial game.
export const TILE = 48;
export const WORLD_TILES = 64;
export const WORLD = TILE * WORLD_TILES; // 3072 px square island city
export const VIEW_W = 1280;
export const VIEW_H = 720;

// Road centrelines (tile coords). Roads are 3 tiles wide.
export const ROADS_X = [8, 20, 32, 44, 56];
export const ROADS_Y = [8, 20, 32, 44, 56];
export const ROAD_HALF = 1.5 * TILE;

export const DISTRICTS = [
  { name: 'Old Town', x0: 0, y0: 0, x1: 20, y1: 20, tint: '#e8b04b' },
  { name: 'Marina District', x0: 44, y0: 0, x1: 64, y1: 20, tint: '#4bb3c9' },
  { name: 'Plaza Luna', x0: 20, y0: 20, x1: 44, y1: 44, tint: '#d97b8f' },
  { name: 'Downtown', x0: 44, y0: 20, x1: 64, y1: 44, tint: '#7b8fd9' },
  { name: 'Beachfront', x0: 0, y0: 44, x1: 44, y1: 58, tint: '#e8d24b' },
];

export const PLACES = {
  mamas: { name: "Mama Luz's Cantina", x: 32 * TILE, y: 20 * TILE + 90 },
  bank: { name: 'Banco del Sol', x: 44 * TILE + 90, y: 32 * TILE },
  marina: { name: 'Marina Yacht Club', x: 56 * TILE, y: 8 * TILE + 90 },
  garage: { name: "Rico's Garage", x: 20 * TILE + 90, y: 44 * TILE },
  hospital: { name: 'Hospital Santa Fe', x: 8 * TILE + 90, y: 8 * TILE },
  station: { name: 'Luna PD Precinct', x: 44 * TILE, y: 44 * TILE + 90 },
  beach: { name: 'Playa del Faro', x: 20 * TILE, y: 58 * TILE },
  lighthouse: { name: 'El Faro', x: 56 * TILE, y: 58 * TILE },
};

export const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c832', '#7dd93d', '#d93d9e', '#eeeeee', '#222831', '#e07b39'];
export const CAR_NAMES = ['Cometa', 'Brisa GT', 'Toro', 'Vela', 'Faro', 'Cangrejo', 'Luna LX', 'Solano'];

// Sun-soaked dusk palette
export const PALETTE = {
  grass: '#7fae5a',
  sand: '#e8d28a',
  water: '#2f7fb8',
  waterDeep: '#2563a0',
  road: '#3a3f4a',
  roadLine: '#e8e4c8',
  sidewalk: '#9aa0a8',
  buildingRoof: '#b08968',
  plaza: '#c9b8a3',
};
