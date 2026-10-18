export const CFG = {
  // movement
  walkSpeed: 6,
  runSpeed: 9.8,
  groundAccel: 38,
  airAccel: 27,
  groundBrake: 32,
  airBrake: 8,
  gravity: -40,
  jumpSpeed: 21,
  runJumpBoost: 1.2,
  fallLimit: 34,
  coyoteMs: 120,
  bufferMs: 160,

  // mario sizes
  smallH: 1.6, smallW: 0.85,
  bigH: 2.5, bigW: 0.9,
  duckH: 1.3,

  // enemies
  goombaSpeed: 1.65,
  koopaSpeed: 1.35,
  shellSpeed: 12,

  // items
  mushroomSpeed: 3.1,
  fireballSpeed: 13,
  fireballCooldown: 0.25,
  maxFireballs: 2,
  starDuration: 10,
  invulnDuration: 2.2,

  // physics
  fixedDt: 1/120,
  deathY: -6,
  startLives: 3,
  startTime: 300,

  // colors
  sky: 0x9DD8ED,
  grass: 0x4CAF50,
  soil: 0x8D6E63,
  brick: 0xC76B3C,
  question: 0xE8B73A,
  usedBlock: 0x8D7B6B,
  pipe: 0x2E9B4E,
  pipeRim: 0x1E6B33,
};

export const SCORE = {
  coin: 200,
  powerup: 1000,
  brick: 50,
  enemy: 100,
  firework: 500,
  timeUnit: 50,
};

export const STOMP_CHAIN = [100,200,400,800,1000,2000,4000,8000];
export const SHELL_CHAIN = [500,800,1000,2000,4000,5000,8000];
