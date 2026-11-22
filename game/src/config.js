// Puerto Luna — tuning constants, the fare economy and the story missions.
// Everything the rest of the game needs to agree on lives here, in one place.

export const CFG = {
  WORLD_W: 3200,
  WORLD_H: 2400,
  BEACH: 130, // sand ring around the island before the water
  ROAD_GAP: 400, // distance between parallel roads
  ROAD_W: 92,
  VIEW_W: 1280,
  VIEW_H: 720,
  WALK_SPEED: 195,
  CAR_ACCEL: 430,
  CAR_MAX: 540,
  CAR_REVERSE: 190,
  CAR_TURN: 2.7, // radians per second at full speed
  CAR_GRIP: 0.94, // how much of the velocity survives each physics tick
  TRAFFIC_MIN: 110,
  TRAFFIC_MAX: 175,
  PED_MIN: 38,
  PED_MAX: 72,
  PLAYER_RADIUS: 13,
  CAR_RADIUS: 17,
  HEAT_MAX: 100,
  HEAT_DECAY: 2.2, // heat lost per second while quiet
  HEAT_HIDEOUT: 16, // heat lost per second inside a hideout
  HEAT_STEAL: 22,
  HEAT_HIT_PED: 15,
  HEAT_RAM_COP: 12,
  HEAT_SHOT: 9,
  HEAT_ROB_ALARM: 30,
  BUST_FINE: 50,
  START_CASH: 120,
  SAVE_KEY: 'puerto-luna-save-v1',
  SEED: 20261122,
};

// The taxi side-job: an islander waves you down, you drive them across town.
export const FARE = {
  BASE: 40, // flat pickup fee
  PER_PX: 0.055, // per pixel of trip distance, rounded at drop-off
  TIP_MULT: 1.5, // paid when more than 30 s of the meter is left
  TIP_WINDOW: 30,
  METER_S: 90, // seconds to reach the destination
  PICKUP_R: 64, // how close on foot to pick a customer up
  CUSTOMERS: 3, // waiting islanders on the map at once
};

// Wanted stars from heat: 0-4 quiet, 5+ one star, then a star every 20 heat.
export function wantedFromHeat(heat) {
  if (heat < 5) return 0;
  if (heat < 20) return 1;
  if (heat < 40) return 2;
  if (heat < 60) return 3;
  if (heat < 80) return 4;
  return 5;
}

// Every mission is data: a name, a fixer line, a reward and a list of steps.
// A step's target is either a landmark name (resolved against the city) or
// an explicit {x, y}. Step kinds are handled by the mission engine in main.js:
//   goto      reach the marker (optional time limit)
//   steal     get into the marked parked car
//   heat      reach a wanted level (param.level)
//   escape    get the wanted level back to zero
//   holdout   stay inside the marker for param.seconds while the heat is on
//   rob       stand in the zone for param.seconds (an alarm sounds first)
//   checkpoints  drive through param.points in order before param.seconds runs out
export const MISSIONS = [
  {
    id: 1,
    name: 'Hot Wheels',
    fixer: 'Mama Luz: Rico, I need wheels. The red sedan by the plaza — take it, bring it to my garage.',
    reward: 200,
    steps: [
      { kind: 'goto', target: { landmark: 'plaza' }, label: 'Go to the plaza' },
      { kind: 'steal', target: { landmark: 'plazaCar' }, label: 'Steal the red sedan (E)' },
      { kind: 'goto', target: { landmark: 'garage' }, label: 'Drive it to Mama Luz garage' },
    ],
  },
  {
    id: 2,
    name: 'Parcel Run',
    fixer: 'Mama Luz: A package at the docks, a buyer at the market. Fast, Rico. The buyer does not wait.',
    reward: 400,
    steps: [
      { kind: 'goto', target: { landmark: 'dock' }, label: 'Pick up the package at the docks' },
      { kind: 'goto', target: { landmark: 'market' }, label: 'Deliver to the market buyer', seconds: 75 },
    ],
  },
  {
    id: 3,
    name: 'Heat Wave',
    fixer: 'Mama Luz: The cops think this island is quiet. Show them it is not — then vanish.',
    reward: 600,
    steps: [
      { kind: 'heat', level: 2, label: 'Raise your wanted level to 2 stars' },
      { kind: 'escape', label: 'Lose the heat — hideout or lay low' },
    ],
  },
  {
    id: 4,
    name: 'Coastal Sprint',
    fixer: 'Mama Luz: Four checkpoints along the coast road. Beat the clock and the island is talking about you.',
    reward: 800,
    steps: [
      {
        kind: 'checkpoints',
        points: [
          { landmark: 'coastA' },
          { landmark: 'coastB' },
          { landmark: 'coastC' },
          { landmark: 'coastD' },
        ],
        seconds: 95,
        label: 'Race the checkpoints',
      },
    ],
  },
  {
    id: 5,
    name: 'Vault Job',
    fixer: 'Mama Luz: The Luna Bank keeps its cash in a back vault. Twelve seconds inside, then run.',
    reward: 1500,
    steps: [
      { kind: 'goto', target: { landmark: 'bank' }, label: 'Get to the Luna Bank' },
      { kind: 'rob', target: { landmark: 'bank' }, seconds: 12, label: 'Crack the vault — stay inside!' },
      { kind: 'escape', label: 'Escape the heat' },
    ],
  },
  {
    id: 6,
    name: 'The Big Score',
    fixer: 'Mama Luz: A yacht at the marina, full of a rich man\'s weekend. Hold the dock while my crew loads it.',
    reward: 2500,
    steps: [
      { kind: 'goto', target: { landmark: 'marina' }, label: 'Get to the marina' },
      { kind: 'holdout', target: { landmark: 'marina' }, seconds: 15, label: 'Hold the dock — 15 seconds' },
      { kind: 'goto', target: { landmark: 'drop' }, label: 'Drive the loot to the drop point' },
    ],
  },
  {
    id: 7,
    name: 'The Last Ferry',
    fixer: 'Mama Luz: One last job, Rico. Hold the ferry terminal until the boat is ready, then disappear.',
    reward: 3500,
    steps: [
      { kind: 'goto', target: { landmark: 'ferry' }, label: 'Get to the ferry terminal' },
      { kind: 'holdout', target: { landmark: 'ferry' }, seconds: 21, label: 'Hold the terminal — 21 seconds' },
      { kind: 'escape', label: 'Lose the heat and vanish' },
    ],
  },
];

// Sun-soaked palette: turquoise water, warm sand, pastel blocks, dark asphalt.
export const PALETTE = {
  water: '#1e7fa8',
  waterDeep: '#14607f',
  sand: '#e8d29a',
  grass: '#7fae62',
  park: '#5f9e4e',
  road: '#3a3f47',
  roadLine: '#e8d25a',
  sidewalk: '#9aa0a8',
  buildingRoofs: ['#c96f4a', '#d9a05b', '#7fa8c9', '#b06a8a', '#8a9a5b', '#e0cfa0'],
  carColors: ['#d94f3d', '#3d7ad9', '#e8c53a', '#e8e8e8', '#5b8c5a', '#8a5fb0', '#e07b39'],
  police: '#20242c',
  player: '#f2f2f2',
};
