// ---------------------------------------------------------------------------
// EcoGrasp — tunables + level layout
// World coords: +x right, +y down. Rects are {x, y, w, h} with x,y = top-left.
// ---------------------------------------------------------------------------
import { Color } from 'excalibur'

export const VIEW = { width: 1280, height: 720 }

export const PHYS = {
  gravity: 1900,        // px/s^2
  moveSpeed: 290,       // px/s horizontal
  jumpSpeed: 830,       // px/s initial jump impulse
  coyoteTime: 0.1,      // s of grace after leaving a ledge
}

export const PLAYER = { w: 40, h: 56 }

// Tree (the cursor-aimed weapon). Grows with seeds and behaves like a weighted
// pendulum on a rigid arm — it trails when you move and sags under gravity.
export const TREE = {
  baseLen: 72,          // px reach at 0 seeds
  lenPerSeed: 7.2,      // +px reach per seed  -> 20 seeds = 216px (>3x player height)
  baseCanopy: 24,       // px canopy radius at 0 seeds
  canopyPerSeed: 1.8,   // +px per seed
  maxSeedsForGrowth: 30,

  // physics — bigger tree = more mass = slower aim, more lag, heavier swing
  stiffness: 60,        // "muscle" pull toward the cursor aim
  friction: 6,          // angular velocity damping (per second)
  massPerSeed: 0.13,    // added mass per seed (slows rotation + swing)
  gravitySag: 110,      // downward pull; heavier trees droop more
  swingImpulse: 1500,   // tangential kick on click (divided by mass)
  lungeAmount: 0.36,    // fraction of reach added during a swing lunge
  lungeDur: 0.24,       // s — lunge in/out time
}

// Movement penalty for carrying a big tree (0 seeds = full speed).
export const MOBILITY = {
  moveSlowMax: 0.42,    // up to 42% slower run at max growth
  jumpSlowMax: 0.12,    // up to 12% weaker jump at max growth
}

export const SEEDS_TO_BEAT_BOSS = 20

// Colors -------------------------------------------------------------------
export const COL = {
  sky: Color.fromHex('#0b132b'),
  soil: Color.fromHex('#5b3d23'),
  grass: Color.fromHex('#5fa845'),
  wasteBody: Color.fromHex('#2f4a05'),
  wasteGlow: Color.fromHex('#b6f000'),
  player: Color.fromHex('#36cfff'),
  playerDark: Color.fromHex('#0b3a4a'),
  trunk: Color.fromHex('#7c4a1e'),
  canopy: Color.fromHex('#27c93f'),
  canopyHi: Color.fromHex('#86efac'),
  seed: Color.fromHex('#ffe14d'),
  enemy: Color.fromHex('#6b7280'),
  enemyDark: Color.fromHex('#2b2f36'),
  boss: Color.fromHex('#3b4351'),
  bossEye: Color.fromHex('#ff3b30'),
  bossAcid: Color.fromHex('#b6f000'),
  flagOff: Color.fromHex('#64748b'),
  flagOn: Color.fromHex('#22c55e'),
}

const GROUND_TOP = 900

// Solid platforms (player stands/collides). Brown body + grass cap drawn on top.
export const PLATFORMS = [
  // ground segments (gaps between them are toxic-waste pits)
  { x: 0, y: GROUND_TOP, w: 720, h: 320 },
  { x: 900, y: GROUND_TOP, w: 660, h: 320 },
  { x: 1720, y: GROUND_TOP, w: 760, h: 320 },
  { x: 2660, y: GROUND_TOP, w: 560, h: 320 },
  { x: 3400, y: GROUND_TOP, w: 520, h: 320 },
  { x: 4150, y: GROUND_TOP, w: 1250, h: 320 }, // boss arena
  // stepping stones across the waste pits
  { x: 760, y: 770, w: 140, h: 22 },
  { x: 1560, y: 770, w: 140, h: 22 },
  { x: 2480, y: 820, w: 150, h: 22 },
  { x: 3230, y: 820, w: 150, h: 22 },
  { x: 3940, y: 820, w: 160, h: 22 },
  // upper route (the seed-rich detour) — branch up around x=1850, rejoin near x=3650
  { x: 1850, y: 660, w: 190, h: 22 },
  { x: 2150, y: 540, w: 190, h: 22 },
  { x: 2470, y: 440, w: 190, h: 22 },
  { x: 2820, y: 440, w: 210, h: 22 },
  { x: 3170, y: 540, w: 190, h: 22 },
  { x: 3500, y: 660, w: 190, h: 22 },
]

// Toxic-waste pools — touching = death.  (fills the gaps + a deep floor of death)
export const WASTE = [
  { x: 0, y: 1180, w: 5400, h: 60 }, // bottomless-pit catch: deep toxic floor
  { x: 720, y: 1040, w: 180, h: 140 },
  { x: 1560, y: 1040, w: 160, h: 140 },
  { x: 2480, y: 1040, w: 180, h: 140 },
  { x: 3220, y: 1040, w: 180, h: 140 },
  { x: 3920, y: 1040, w: 230, h: 140 },
]

// Seeds — main path has only 14; the upper route holds 12 more.
// You need 20 to grow a boss-killing tree, so the detour is mandatory.
export const SEEDS = [
  // main / ground path (14)
  { x: 180, y: 840 }, { x: 360, y: 840 }, { x: 560, y: 840 },
  { x: 830, y: 720 }, { x: 1000, y: 840 }, { x: 1250, y: 840 },
  { x: 1630, y: 720 }, { x: 1820, y: 840 }, { x: 2050, y: 840 },
  { x: 2300, y: 840 }, { x: 2760, y: 840 }, { x: 3560, y: 840 },
  { x: 3760, y: 840 }, { x: 4320, y: 840 },
  // upper route (12)
  { x: 1900, y: 610 }, { x: 1990, y: 610 },
  { x: 2200, y: 490 }, { x: 2290, y: 490 },
  { x: 2520, y: 390 }, { x: 2610, y: 390 },
  { x: 2880, y: 390 }, { x: 2970, y: 390 },
  { x: 3220, y: 490 }, { x: 3310, y: 490 },
  { x: 3550, y: 610 }, { x: 3640, y: 610 },
]

// Patrolling trash enemies (center x,y + horizontal patrol range)
export const ENEMIES = [
  { x: 1120, y: 876, range: 180 },
  { x: 2000, y: 876, range: 200 },
  { x: 2880, y: 416, range: 150 }, // guards the upper route
  { x: 3650, y: 876, range: 170 },
  { x: 4420, y: 876, range: 160 }, // boss-arena guard
]

// Checkpoints (base sits on a ground top). Respawn point = standing here.
export const CHECKPOINTS = [
  { x: 90, y: GROUND_TOP },
  { x: 1760, y: GROUND_TOP },
  { x: 2720, y: GROUND_TOP },
  { x: 4200, y: GROUND_TOP },
]

export const BOSS = { x: 4950, y: GROUND_TOP, w: 190, h: 270 }

export const WORLD = { left: 0, right: 5400, top: -200, bottom: 1240 }
