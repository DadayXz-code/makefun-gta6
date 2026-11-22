// Puerto Luna — the island's constants: its size, its roads, its
// districts, the places its story visits, and the tuning for the heat.
// Everything the game simulates reads from here, so a number changed here
// changes the whole island at once. All names, places and characters are
// invented for this entry; nothing is taken from any commercial game.

// The island is a square of tiles, and the camera shows a 16:9 window of it.
export const TILE = 48;
export const WORLD_TILES = 64;
export const WORLD = TILE * WORLD_TILES; // 3072 px a side
export const VIEW_W = 1280;
export const VIEW_H = 720;

// Roads run on a grid of centrelines, three tiles wide, at these tiles.
export const ROADS_X = [8, 20, 32, 44, 56];
export const ROADS_Y = [8, 20, 32, 44, 56];
export const ROAD_HALF = 1.5 * TILE;

// The five districts, as tile rectangles with a tint for the map.
export const DISTRICTS = [
  {
    name: 'Old Town',
    x0: 0, y0: 0, x1: 20, y1: 20,
    tint: '#e8b04b',
  },
  {
    name: 'Marina District',
    x0: 44, y0: 0, x1: 64, y1: 20,
    tint: '#4bb3c9',
  },
  {
    name: 'Plaza Luna',
    x0: 20, y0: 20, x1: 44, y1: 44,
    tint: '#d97b8f',
  },
  {
    name: 'Downtown',
    x0: 44, y0: 20, x1: 64, y1: 44,
    tint: '#7b8fd9',
  },
  {
    name: 'Beachfront',
    x0: 0, y0: 44, x1: 44, y1: 58,
    tint: '#e8d24b',
  },
];

// The named places the missions visit, as pixel positions.
export const PLACES = {
  mamas: {
    name: "Mama Luz's Cantina",
    x: 32 * TILE,
    y: 20 * TILE + 90,
  },
  bank: {
    name: 'Banco del Sol',
    x: 44 * TILE + 90,
    y: 32 * TILE,
  },
  marina: {
    name: 'Marina Yacht Club',
    x: 56 * TILE,
    y: 8 * TILE + 90,
  },
  garage: {
    name: "Rico's Garage",
    x: 20 * TILE + 90,
    y: 44 * TILE,
  },
  hospital: {
    name: 'Hospital Santa Fe',
    x: 8 * TILE + 90,
    y: 8 * TILE,
  },
  station: {
    name: 'Luna PD Precinct',
    x: 44 * TILE,
    y: 44 * TILE + 90,
  },
  beach: {
    name: 'Playa del Faro',
    x: 20 * TILE,
    y: 58 * TILE,
  },
  lighthouse: {
    name: 'El Faro',
    x: 56 * TILE,
    y: 58 * TILE,
  },
  ferry: {
    name: 'Ferry Terminal',
    x: 38 * TILE,
    y: 59 * TILE + 20,
  },
};

// The cars on the island: their paint and their names.
export const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c832', '#7dd93d', '#d93d9e', '#eeeeee', '#222831', '#e07b39'];
export const CAR_NAMES = ['Cometa', 'Brisa GT', 'Toro', 'Vela', 'Faro', 'Cangrejo', 'Luna LX', 'Solano'];

// Sun-soaked dusk palette for the ground, the sea and the city.
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

// --- The heat: roadblocks and hideouts (see wanted.js) ---

// The PD starts throwing spike-strip roadblocks once the wanted level
// reaches this many stars.
export const ROADBLOCK_MIN_STARS = 3;
// A roadblock lives this long before the PD pulls it back.
export const ROADBLOCK_TTL = 20;
// Seconds between roadblock drops while the heat is on.
export const ROADBLOCK_INTERVAL = 4;
// Damage a spike strip does to the player's car.
export const SPIKE_DAMAGE = 25;
// How much faster the heat cools while hidden in a hideout.
export const HIDEOUT_COOL_MULT = 2;

// How much damage a police ram does per second of contact.
export const POLICE_RAM_DPS = 14;

// --- The last ferry (mission 7) ---

// Stars the holdout step demands, and seconds Rico must hold the
// terminal at that heat before the crew finishes loading the ferry.
export const HOLDOUT_STARS = 3;
export const HOLDOUT_SECONDS = 18;
