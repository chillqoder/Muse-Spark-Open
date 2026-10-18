export const LEVEL = {
  startX: -56, startY: 1,
  flagX: 134, castleX: 141,
  checkpointX: 52,
  pipeWarp: { enterX: -8, enterH: 3.4, exitX: 44 },
};

// ground intervals: [x0,x1] inclusive blocks
export const GROUND = [
  [-60, 4], [7, 37], [41, 90], [93, 148]
];

// pits are gaps between grounds, y=-10 depth

// platforms / terrain extras: small grass platforms not full ground
// These are solid boxes {x,y,w,h} where y is bottom, w width, h height
export const TERRAIN_BOXES = [
  // small floating island at 19-21
  {x:19, y:0, w:2, h:1},
  // staircase practice 69-90 done as individual steps below
];

// Stairs / stepped terrain as boxes
export const STAIRS = [
  // staircase practice at 71-78 ascending to height 4
  {x:71, y:0, w:1, h:1}, {x:72, y:0, w:1, h:2}, {x:73, y:0, w:1, h:3}, {x:74, y:0, w:1, h:4},
  // stairs around gap at 82-90
  {x:82, y:0, w:1, h:1}, {x:83, y:0, w:1, h:2}, {x:84, y:0, w:1, h:3}, {x:85, y:0, w:1, h:4},
  // after gap landing
  {x:93, y:0, w:1, h:1}, {x:94, y:0, w:1, h:2},
  // final stairs to flag 122-134
  {x:122, y:0, w:1, h:1}, {x:123, y:0, w:1, h:2}, {x:124, y:0, w:1, h:3}, {x:125, y:0, w:1, h:4},
  {x:126, y:0, w:1, h:5}, {x:127, y:0, w:1, h:5}, {x:128, y:0, w:1, h:5},
];

export const PIPES = [
  // x, height
  {x: -26, h: 2.0, warp: false},
  {x: -18, h: 2.8, warp: false},
  {x: -8, h: 3.4, warp: true, id:'enter'},
  {x: 12, h: 2.0, warp: false},
  {x: 44, h: 2.0, warp: true, id:'exit'},
  {x: 108, h: 2.8, warp: false},
];

// Blocks: x, y (bottom), type
// types: 'q_mush' (adaptive power), 'q_coin', 'brick', 'brick_coin' (multi), 'brick_star', 'hidden_1up'
export const BLOCKS = [
  // opening
  {x:-48, y:4, type:'q_coin'},
  {x:-46, y:4, type:'brick'},
  {x:-44, y:4, type:'q_mush'},
  {x:-42, y:4, type:'brick'},
  {x:-44, y:7.5, type:'brick'}, // upper
  // pipe area
  {x:-22, y:4, type:'brick'},
  {x:-20, y:4, type:'brick'},
  // hidden 1up near pipes - hidden block at -14,7.5
  {x:-14, y:7.5, type:'hidden_1up'},
  // first gap brick route 10-30
  {x:10, y:4, type:'brick'},
  {x:14, y:4, type:'q_mush'},
  {x:15, y:4, type:'brick'},
  {x:16, y:7.5, type:'brick'},
  {x:17, y:7.5, type:'brick'},
  {x:18, y:7.5, type:'brick'},
  {x:19, y:4, type:'brick_coin'}, // multi-coin
  {x:20, y:7.5, type:'q_coin'},
  {x:24, y:4, type:'brick'},
  {x:26, y:4, type:'brick_star'}, // hidden star in brick
  {x:28, y:4, type:'brick'},
  {x:28, y:7.5, type:'q_coin'},
  // middle stretch
  {x:48, y:4, type:'brick'},
  {x:50, y:4, type:'q_coin'},
  {x:52, y:4, type:'brick'},
  {x:56, y:4, type:'q_coin'},
  {x:58, y:7.5, type:'brick'},
  {x:60, y:7.5, type:'brick'},
  {x:62, y:7.5, type:'q_mush'},
  // staircase area
  {x:76, y:4, type:'brick'},
  {x:78, y:4, type:'q_coin'},
  {x:80, y:4, type:'brick'},
  // final approach
  {x:98, y:4, type:'q_mush'},
  {x:100, y:4, type:'brick'},
  {x:102, y:4, type:'brick'},
  {x:104, y:7.5, type:'q_coin'},
];

export const COINS = [
  // scattered world coins
  {x:-47, y:5.5}, {x:-40, y:2}, {x:-39, y:2},
  {x:-16, y:5}, {x:-15, y:5.5}, {x:-14, y:5},
  // floating trail over gap
  {x:5, y:2.5}, {x:6, y:3},
  // elevated
  {x:16, y:8.5}, {x:17, y:8.5}, {x:18, y:8.5},
  {x:20, y:3}, {x:24, y:5.5}, {x:28, y:8.5},
  // middle
  {x:50, y:6}, {x:58, y:8.5}, {x:60, y:8.5}, {x:62, y:6},
  {x:72, y:5}, {x:76, y:5.5}, {x:80, y:5.5},
  {x:98, y:6}, {x:104, y:8.5},
  // flag approach
  {x:118, y:3}, {x:119, y:4}, {x:120, y:5},
];

export const ENEMIES = [
  {x:-38, type:'goomba'},
  {x:-20, type:'goomba'},
  {x:-12, type:'goomba'},
  {x: 14, type:'goomba'},
  {x: 22, type:'goomba'},
  {x: 30, type:'koopa', color:'green'},
  {x: 50, type:'goomba'},
  {x: 53, type:'goomba'},
  {x: 60, type:'koopa', color:'red'},
  {x: 78, type:'goomba'},
  {x: 86, type:'goomba'},
  {x: 100, type:'goomba'},
  {x: 102, type:'goomba'},
  {x: 110, type:'koopa', color:'green'},
];

export const FLAG = { x: 134, y: 0, h: 10, poleH: 11 };
export const CASTLE = { x: 141, y: 0, w: 6, h: 6 };

// cellar
export const CELLAR = {
  w: 30, h: 12,
  coins: [
    {x:2,y:2},{x:4,y:2},{x:6,y:2},{x:8,y:2},{x:10,y:2},{x:12,y:2},{x:14,y:2},{x:16,y:2},
    {x:4,y:5},{x:6,y:5},{x:8,y:5},{x:10,y:5},{x:12,y:5},{x:14,y:5},
    {x:8,y:8},{x:10,y:8},{x:12,y:8},
  ],
  exitPipeX: 24, // cellar local
};

// scenery
export const TREES = [
  {x:-50,z:-6},{x:-42,z:-8},{x:-30,z:-7},{x:-12,z:-9},{x:8,z:-6},{x:20,z:-8},{x:35,z:-7},{x:55,z:-9},{x:75,z:-7},{x:90,z:-8},{x:115,z:-6},{x:130,z:-7},
];
export const BUSHES = [
  {x:-52,z:-3},{x:-36,z:-4},{x:-24,z:-3},{x:-6,z:-4},{x:16,z:-3},{x:32,z:-4},{x:48,z:-3},{x:64,z:-4},{x:88,z:-3},{x:112,z:-4},{x:125,z:-3},
];
