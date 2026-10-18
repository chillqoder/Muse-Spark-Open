import { CFG, SCORE, STOMP_CHAIN, SHELL_CHAIN } from './config.js';
import { GROUND, STAIRS, TERRAIN_BOXES, PIPES, BLOCKS, COINS, ENEMIES, FLAG, CASTLE, CELLAR, LEVEL } from './level.js';
import * as Audio from './audio.js';

function aabb(ax,ay,aw,ah, bx,by,bw,bh){
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}

export function createSimulation(){
  let state='title'; // title, play, paused, warp, dying, finish, gameover, win
  let subState=''; // warpIn, warpOut, flagSlide, walkToCastle, timeCount, fireworks
  let subTimer=0;

  // persistent
  let bestScore=0, bestTime=Infinity, newBest=false;
  try{
    const raw=localStorage.getItem('lpm_save_v1');
    if(raw){ const d=JSON.parse(raw); bestScore=d.bestScore||0; bestTime=d.bestTime||Infinity; }
  }catch(e){}

  function saveRecords(){
    try{ localStorage.setItem('lpm_save_v1', JSON.stringify({bestScore,bestTime})); }catch(e){}
  }

  // run state
  let score=0, coins=0, lives=CFG.startLives, timeLeft=CFG.startTime, hurryPlayed=false;
  let runTime=0; // actual play time excluding pause/finish
  let mario={ x:LEVEL.startX, y:LEVEL.startY, vx:0, vy:0, dir:1, onGround:false, wasOnGround:false, power:'small', invuln:0, star:0, duck:false, coyote:0, jumpBuffer:0, jumpHeld:false, transform:0, transformFrom:'', checkpointReached:false };
  let prevFeetY=0;
  let stompChain=0, wasOnSolidFloor=false;

  let blocks=[], coinsArr=[], enemies=[], items=[], fireballs=[], particles=[], popups=[], bricksToRemove=[];
  let surfaceEnemies=[]; // parked while Mario is in the cellar
  let inCastle=false;
  let solidsCache=[]; // built each frame for rendering? also needed for physics
  let warpFrom=null, warpTo=null;
  let cellarMode=false, cellarCoins=[], cellarEntered=false;
  let secretsFound=new Set(), secretsTotal=3;
  let stats={ enemiesDefeated:0, flagBonus:0, timeBonus:0, fireworkBonus:0, fireworks:0 };
  let capturedTimeDisplay=0;
  let finishStage=0, flagY=FLAG.y+FLAG.poleH, marioOnFlag=false;

  let cameraX=LEVEL.startX;
  let effects=[]; // fireworks

  // block multi-coin counts
  let multiCounts=new Map();

  function resetRun(fullReset=true){
    if(fullReset){
      score=0; coins=0; lives=CFG.startLives; secretsFound=new Set();
      mario.power='small'; mario.checkpointReached=false;
    }
    timeLeft=CFG.startTime; hurryPlayed=false; runTime=0;
    mario.x = mario.checkpointReached ? LEVEL.checkpointX : LEVEL.startX;
    mario.y = LEVEL.startY; mario.vx=0; mario.vy=0; mario.onGround=false; mario.duck=false;
    mario.invuln=0; mario.star=0; mario.transform=0; mario.coyote=0; mario.jumpBuffer=0;
    stompChain=0; wasOnSolidFloor=false;
    items=[]; fireballs=[]; particles=[]; popups=[]; effects=[];
    cellarMode=false; cellarEntered=false; warpFrom=warpTo=null; surfaceEnemies=[]; inCastle=false;
    // restart begins play right away; only the very first boot shows the title screen
    state='play'; subState=''; subTimer=0; finishStage=0;
    flagY=FLAG.y+FLAG.poleH; capturedTimeDisplay=0; newBest=false;
    buildLevel();
    Audio.stopMusic();
    Audio.playTheme('overworld');
    cameraX=mario.x;
    stats={ enemiesDefeated:0, flagBonus:0, timeBonus:0, fireworkBonus:0, fireworks:0 };
  }

  function buildLevel(){
    blocks = BLOCKS.map((b,i)=>({
      id:i, x:b.x, y:b.y, w:1, h:1, type:b.type,
      hit:false, used:false, bump:0, revealed: b.type.startsWith('hidden')?false:true,
      coinsLeft: b.type==='brick_coin'?10:0
    }));
    coinsArr = COINS.map((c,i)=>({id:i,x:c.x,y:c.y,w:0.6,h:0.6,taken:false,collected:false}));
    if(!cellarMode){
      enemies = ENEMIES.map((e,i)=>({
        id:i, x:e.x, y:e.y||1, vx:(e.type==='koopa'?CFG.koopaSpeed:CFG.goombaSpeed)*(Math.random()<0.5?-1:1), vy:0,
        type:e.type, color:e.color||'green', state:'walk', timer:0, active:false, spawnX:e.x, dead:false, wasOnGround:false, chain:0
      }));
    } else {
      enemies=[];
    }
    // cellar coins
    cellarCoins = CELLAR.coins.map((c,i)=>({x:c.x, y:c.y, w:0.6,h:0.6, taken:false}));
  }

  buildLevel();

  function getMarioSize(){
    if(mario.power==='small') return {w:CFG.smallW, h:CFG.smallH};
    if(mario.duck) return {w:CFG.bigW, h:CFG.duckH};
    return {w:CFG.bigW, h:CFG.bigH};
  }

  function getSolids(includeHidden=false){
    const out=[];
    // ground
    // ground top is y = 0 (same plane the enemy/item/flag code assumes)
    for(const g of GROUND){
      out.push({x:g[0], y:-10, w:g[1]-g[0], h:10, type:'ground'});
    }
    for(const s of STAIRS) out.push({x:s.x, y:s.y, w:s.w, h:s.h, type:'stair'});
    for(const t of TERRAIN_BOXES) out.push({x:t.x,y:t.y,w:t.w,h:t.h,type:'terrain'});
    // pipes as solids (x is center, width 1.4)
    for(const p of PIPES){
      const w=1.6, half=w/2;
      out.push({x:p.x-half, y:0, w:w, h:p.h, type:'pipe', pipeId:p.id});
    }
    // blocks as solids if not hit/broken and (revealed)
    for(const b of blocks){
      if(b.hit && b.used) continue; // broken bricks leave the collision system immediately
      if(!b.revealed && !b.used) continue;
      out.push({x:b.x, y:b.y, w:1, h:1, type:'block', bid:b.id});
    }
    if(cellarMode){
      out.length=0;
      out.push({x:0,y:-1,w:CELLAR.w,h:1,type:'ground'});
      out.push({x:0,y:CELLAR.h,w:CELLAR.w,h:1,type:'ceiling'});
      out.push({x:0,y:0,w:1,h:CELLAR.h,type:'wall'});
      out.push({x:CELLAR.w-1,y:0,w:1,h:CELLAR.h,type:'wall'});
      // exit pipe platform
      out.push({x:CELLAR.exitPipeX-0.8,y:0,w:1.6,h:2,type:'pipe'});
    }
    // castle as solid
    if(!cellarMode) out.push({x:CASTLE.x, y:0, w:CASTLE.w, h:CASTLE.h, type:'castle'});
    return out;
  }

  function isOnSolidInterval(x){
    for(const g of GROUND) if(x>=g[0] && x<g[1]) return true;
    return false;
  }

  function resolveCollisions(px, py, pw, ph, vx, vy, solids){
    let x=px, y=py;
    let onGround=false, hitCeiling=false, hitWall=false;
    let hitBlockId=null, hitSide=false;

    // horizontal
    x += vx * CFG.fixedDt;
    for(const s of solids){
      // pipe rim special: allow jumping up against pipe - shrink top 0.2
      let sy=s.y, sh=s.h;
      // if pipe and moving up, ignore top 0.15 overhang
      if(s.type==='pipe' && vy>0){
        // allow pass up along side
      }
      if(aabb(x, y, pw, ph, s.x, sy, s.w, sh)){
        if(vx>0) x = s.x - pw - 0.001;
        else if(vx<0) x = s.x + s.w + 0.001;
        hitWall=true;
        hitSide=true;
        if(s.type==='block') hitBlockId=s.bid;
        break;
      }
    }
    // vertical
    const feetBefore = y;
    y += vy * CFG.fixedDt;
    for(const s of solids){
      if(aabb(x, y, pw, ph, s.x, s.y, s.w, s.h)){
        if(vy>0){
          // ceiling
          y = s.y - ph - 0.001;
          hitCeiling=true;
          if(s.type==='block') hitBlockId=s.bid;
        } else if(vy<0){
          y = s.y + s.h + 0.001;
          onGround=true;
        }
      }
    }
    // also check ground intervals for death pit: if y below 0 and not on ground and not over solid interval, keep falling
    return {x,y,onGround,hitCeiling,hitBlockId, hitSide, hitWall};
  }

  function handleBlockHit(bid, fromBelow){
    const b = blocks[bid];
    if(!b || b.used) return;
    if(!b.revealed){
      // first valid hit from below reveals the block and releases its 1-Up at once
      b.revealed=true; b.used=true; b.bump=0.18;
      spawnItem(b.x+0.5, b.y+1, '1up', b.x);
      secretsFound.add('hidden1up');
      Audio.sfx1up();
      return;
    }
    // bump anim
    b.bump=0.18;
    // check enemy on top
    for(const e of enemies){
      if(e.dead||e.state==='defeated') continue;
      // enemy standing on this block: ex within block, ey ~ b.y+1
      if(Math.abs(e.x - (b.x+0.5))<0.7 && Math.abs(e.y - (b.y+1))<0.3){
        // bump kill
        e.dead=true; e.state='defeated'; e.vy=4;
        addScore(SCORE.enemy, e.x, e.y+1);
        stats.enemiesDefeated++;
        Audio.sfxStomp();
      }
    }
    if(b.type==='q_coin'){
      b.used=true;
      addCoin(b.x+0.5, b.y+1);
      Audio.sfxCoin();
    } else if(b.type==='q_mush'){
      b.used=true;
      // adaptive: use current power at hit time
      const itemType = (mario.power==='small') ? 'mushroom' : 'flower';
      // if mushroom and flower edge case handled on collection
      spawnItem(b.x+0.5, b.y+1, itemType, b.x);
      Audio.sfxPowerup();
      // flower-after-damage tracking: store what was spawned? For edge case, item remembers original type?
    } else if(b.type==='brick'){
      if(mario.power==='small'){
        Audio.sfxBump();
      } else {
        b.used=true; b.hit=true;
        addScore(SCORE.brick, b.x+0.5, b.y+0.5);
        spawnBreakParticles(b.x, b.y);
        Audio.sfxBreak();
      }
    } else if(b.type==='brick_coin'){
      if(b.coinsLeft>0){
        b.coinsLeft--;
        addCoin(b.x+0.5, b.y+1);
        Audio.sfxCoin();
        if(b.coinsLeft<=0) b.used=true;
      }
      // still bump
    } else if(b.type==='brick_star'){
      b.used=true; b.hit=true;
      spawnItem(b.x+0.5, b.y+1, 'star', b.x);
      spawnBreakParticles(b.x,b.y);
      secretsFound.add('star');
      Audio.sfxPowerup();
    }
  }

  function addCoin(x,y){
    score+=SCORE.coin; coins++;
    if(coins>=100){ coins-=100; lives++; Audio.sfx1up(); addPopup(x,y,'1-UP'); }
    else Audio.sfxCoin();
    addPopup(x,y,'200');
    // no persistent coin entity; visual via popup/particles
  }
  function addScore(v,x,y){
    score+=v;
    addPopup(x,y,String(v));
  }
  function addPopup(x,y,text){ popups.push({x,y,text,t:0, vy:1.2}); }
  function spawnItem(x,y,type, blockX){
    items.push({x:x-0.4, y:y, vx:0, vy:0, w:0.8,h:0.8, type, emerging:true, emergeY:y, emergeMax:y+1, dir:1, taken:false, blockX});
    // items emerge 0.5 sec
  }
  function spawnBreakParticles(bx,by){
    for(let i=0;i<4;i++) particles.push({x:bx+0.25+ (i%2)*0.5, y:by+0.25+Math.floor(i/2)*0.5, vx:(i%2?1:-1)*3, vy:4+Math.random()*2, t:0, life:0.6, type:'brick'});
  }

  function activateEnemies(){
    const viewL = cameraX - 14, viewR = cameraX + 14;
    for(const e of enemies){
      if(e.dead) continue;
      if(!e.active && e.spawnX > viewL-2 && e.spawnX < viewR+2) e.active=true;
    }
  }

  function updateEnemies(dt){
    const solids=getSolids();
    for(const e of enemies){
      if(e.dead){
        // flattened goombas stay put (no harm, no sinking into ground); kicked ones fly off and vanish
        // own timer: e.timer is the shell wake-up countdown and starts at 0 for walkers
        if(e.deadT===undefined) e.deadT = 1.0;
        e.deadT -= dt;
        if(e.state==='defeated'){
          // knocked-out enemies pop up and land on solid ground instead of sinking through it
          e.vy = Math.max(e.vy + CFG.gravity*dt, -CFG.fallLimit);
          let ny = e.y + e.vy*dt;
          for(const s of solids){
            if(aabb(e.x, ny, 0.8, 0.8, s.x,s.y,s.w,s.h)){
              if(e.vy<0){ ny=s.y+s.h+0.001; }
              else if(e.vy>0){ ny=s.y-0.8-0.001; }
              e.vy=0;
            }
          }
          e.y = ny;
        }
        if(e.deadT<=0 || e.y<-6) e.gone=true;
        continue;
      }
      if(!e.active) continue;
      // skip if far behind camera
      if(e.x < cameraX-18) continue;

      if(e.state==='walk'){
        e.vy += CFG.gravity*dt;
        e.vy = Math.max(e.vy, -CFG.fallLimit);
        // horizontal move
        let nx = e.x + e.vx*dt;
        let ny = e.y + e.vy*dt;
        // check wall collision
        let hitWall=false;
        const pw=0.8, ph=0.8;
        // simple wall check using solids
        for(const s of solids){
          if(aabb(nx, e.y, pw, ph, s.x, s.y, s.w, s.h)){ hitWall=true; break; }
        }
        if(hitWall){ e.vx*=-1; nx=e.x; }
        // ledge check for red koopa only
        if(e.type==='koopa' && e.color==='red'){
          // check floor ahead
          const aheadX = e.x + (e.vx>0? 0.6 : -0.1);
          let hasFloor=false;
          for(const s of solids){
            if(aabb(aheadX, e.y-0.2, 0.2,0.2, s.x,s.y,s.w,s.h)){ hasFloor=true; break; }
          }
          // also ground intervals
          if(!hasFloor && e.y<=0.2){
            // check if ahead is over ground interval
            if(!isOnSolidInterval(aheadX)) hasFloor=false; else hasFloor=true;
          }
          // For simplicity, if no solids under ahead and y~0, turn
          const stillOverSolid = solids.some(s=> aheadX>=s.x && aheadX < s.x+s.w && e.y-0.1 >= s.y && e.y-0.1 < s.y+s.h+0.5);
          if(!stillOverSolid && e.y<0.5){
            // check ground interval
            if(!isOnSolidInterval(aheadX)) { e.vx*=-1; }
          }
        }
        // enemy-enemy bounce
        for(const o of enemies){
          if(o===e||o.dead||o.state!=='walk') continue;
          if(Math.abs(o.x - nx)<0.8 && Math.abs(o.y - e.y)<0.5){ e.vx*=-1; o.vx*=-1; break; }
        }
        // vertical ground
        let onG=false;
        for(const s of solids){
          if(aabb(nx, ny, pw, ph, s.x,s.y,s.w,s.h)){
            if(e.vy<0){ ny=s.y+s.h+0.001; onG=true; e.vy=0; }
            else if(e.vy>0){ ny=s.y-ph-0.001; e.vy=0; }
          }
        }
        // ground plane at y=0 if over solid interval
        if(!onG && ny<=0){
          if(isOnSolidInterval(nx)) { ny=0; onG=true; e.vy=0; }
        }
        e.x=nx; e.y=Math.max(ny, -10);
      } else if(e.state==='shell'){
        // a stationary shell still obeys gravity, so it never hovers above a landing
        const shellH=0.5;
        e.vy = Math.max(e.vy + CFG.gravity*dt, -CFG.fallLimit);
        let sy=e.y + e.vy*dt;
        for(const s of solids){
          if(aabb(e.x, sy, 0.8, shellH, s.x,s.y,s.w,s.h)){
            if(e.vy<0){ sy=s.y+s.h+0.001; }
            else if(e.vy>0){ sy=s.y-shellH-0.001; }
            e.vy=0;
          }
        }
        if(sy<=0 && isOnSolidInterval(e.x)){ sy=0; e.vy=0; }
        e.y=sy;
        e.timer-=dt;
        if(e.timer<=0){
          // wake up if headroom
          const solids2=getSolids();
          let blocked=false;
          for(const s of solids2) if(aabb(e.x, e.y+0.8, 0.8,1, s.x,s.y,s.w,s.h)) blocked=true;
          if(!blocked){
            e.state='walk'; e.vx = (Math.random()<0.5?-1:1)*CFG.koopaSpeed; e.chain=0;
          } else {
            e.timer=0.6; // retry
          }
        }
      } else if(e.state==='shell_sliding'){
        e.vy += CFG.gravity*dt;
        let nx=e.x + e.vx*dt;
        let ny=e.y + e.vy*dt;
        let bounced=false;
        const pw=0.8, ph=0.7;
        for(const s of solids){
          if(aabb(nx, e.y, pw, ph, s.x,s.y,s.w,s.h)){
            // side impact: check if block brick to break
            if(s.type==='block'){
              const b=blocks[s.bid];
              if(b && !b.used && (b.type==='brick' || b.type==='brick_coin' || b.type==='brick_star')){
                b.used=true; b.hit=true; if(b.type==='brick') addScore(SCORE.brick, b.x+0.5,b.y+0.5); spawnBreakParticles(b.x,b.y); Audio.sfxBreak();
              }
            }
            e.vx*=-1; bounced=true; break;
          }
        }
        if(!bounced){
          // check enemy hits
          for(const o of enemies){
            if(o===e||o.dead) continue;
            if(o.state==='defeated') continue;
            if(aabb(nx, e.y, pw, ph, o.x,o.y,0.8,0.8)){
              // defeat other enemy
              o.dead=true; o.state='defeated'; o.vy=4;
              // shell chain
              e.chain = (e.chain||0)+1;
              let pts;
              if(e.chain<=SHELL_CHAIN.length) pts=SHELL_CHAIN[Math.min(e.chain-1, SHELL_CHAIN.length-1)];
              else pts=0; // actually 1UP after 8
              // handle 1UP at chain 8
              if(e.chain===8){ lives++; addPopup(o.x,o.y,'1-UP'); Audio.sfx1up(); }
              else if(pts){ addScore(pts, o.x,o.y+0.5); }
              stats.enemiesDefeated++;
              if(pts) Audio.sfxStomp();
              continue;
            }
          }
        }
        // vertical
        let onG=false;
        for(const s of solids){
          if(aabb(e.x, ny, pw, ph, s.x,s.y,s.w,s.h)){
            if(e.vy<0){ ny=s.y+s.h+0.001; onG=true; e.vy=0; }
            else if(e.vy>0){ ny=s.y-ph-0.001; e.vy=0; }
          }
        }
        if(!onG && ny<=0 && isOnSolidInterval(e.x)) { ny=0; onG=true; e.vy=0; }
        e.x = bounced? e.x : nx;
        e.y = ny;
        // also hit mario handled outside
      }
    }
    enemies = enemies.filter(e=>!e.gone);
  }

  function updateItems(dt){
    const solids=getSolids();
    for(const it of items){
      if(it.taken) continue;
      if(it.emerging){
        it.y += 1.0*dt;
        if(it.y >= it.emergeMax){ it.y=it.emergeMax; it.emerging=false; it.vx = (it.type==='flower'||it.type==='star'?0: CFG.mushroomSpeed)*(Math.random()<0.5?1:-1); if(it.type==='flower') it.vx=0; }
        continue;
      }
      if(it.type==='flower'){
        // bob
        it.y = it.emergeMax + Math.sin(Date.now()*0.003)*0.12;
        continue;
      }
      if(it.type==='star'){
        it.vy += CFG.gravity*dt;
        it.x += it.vx*dt;
        it.y += it.vy*dt;
        // bounce
        if(it.vy<0){
          for(const s of solids){
            if(aabb(it.x, it.y, it.w,it.h, s.x,s.y,s.w,s.h)){ it.y=s.y+s.h+0.01; it.vy=9; if(Math.random()<0.5) it.vx*=-1; break; }
          }
          if(it.y<=0 && isOnSolidInterval(it.x)){ it.y=0; it.vy=9; }
        }
        // wall reverse
        for(const s of solids){
          if(aabb(it.x, it.y, 0.8,0.8, s.x,s.y,s.w,s.h)){ it.vx*=-1; break; }
        }
        if(it.x < cameraX-16) it.taken=true;
        continue;
      }
      // mushroom / 1up
      it.vy += CFG.gravity*dt;
      it.vy = Math.max(it.vy, -CFG.fallLimit);
      let nx = it.x + it.vx*dt;
      let hitWall=false;
      for(const s of solids) if(aabb(nx, it.y, it.w,it.h, s.x,s.y,s.w,s.h)) hitWall=true;
      if(hitWall) it.vx*=-1;
      else it.x=nx;
      // vertical
      let ny=it.y + it.vy*dt;
      let onG=false;
      for(const s of solids) if(aabb(it.x, ny, it.w,it.h, s.x,s.y,s.w,s.h)){ if(it.vy<0){ ny=s.y+s.h+0.01; onG=true; it.vy=0; } }
      if(!onG && ny<=0 && isOnSolidInterval(it.x)){ ny=0; onG=true; it.vy=0; }
      it.y=ny;
      if(it.y < -10) it.taken=true;
    }
    items=items.filter(it=>!it.taken);
  }

  function updateFireballs(dt){
    const solids=getSolids();
    for(const f of fireballs){
      f.life-=dt;
      if(f.life<=0){ f.dead=true; continue; }
      f.vy += CFG.gravity*dt;
      let nx=f.x + f.vx*dt;
      let ny=f.y + f.vy*dt;
      // wall/ceiling
      for(const s of solids){
        if(aabb(nx, f.y, 0.4,0.4, s.x,s.y,s.w,s.h)){ f.dead=true; particles.push({x:f.x,y:f.y,vx:0,vy:1,t:0,life:0.3,type:'pop'}); break; }
      }
      if(f.dead) continue;
      for(const s of solids){
        if(aabb(f.x, ny, 0.4,0.4, s.x,s.y,s.w,s.h)){
          if(f.vy<0){ ny=s.y+s.h+0.01; f.vy=7; }
          else { f.dead=true; break; }
        }
      }
      if(f.y<=0 && f.vy<0 && isOnSolidInterval(f.x)){ ny=0.01; f.vy=7; }
      f.x=nx; f.y=ny;
      if(f.y<-10) f.dead=true;
      // enemy hit
      for(const e of enemies){
        if(e.dead) continue;
        if(aabb(f.x,f.y,0.4,0.4, e.x,e.y,0.8,0.8)){
          e.dead=true; e.state='defeated'; e.vy=4;
          addScore(SCORE.enemy, e.x,e.y+0.5);
          stats.enemiesDefeated++;
          f.dead=true; Audio.sfxStomp();
          break;
        }
      }
    }
    fireballs=fireballs.filter(f=>!f.dead);
  }

  // eligible pipe Mario is standing centered on (down-press entry)
  function tryWarp(){
    const list = cellarMode
      ? [{id:'cellarExit', x:CELLAR.exitPipeX, h:2}]
      : PIPES.filter(p=>p.id==='enter');
    for(const p of list){
      if(Math.abs(mario.x - p.x) < 0.5 && Math.abs(mario.y - p.h) < 0.3 && mario.onGround){
        return p;
      }
    }
    return null;
  }

  // returns true only when a transition actually starts
  function startWarp(pipe){
    if(pipe.id==='cellarExit'){ warpFrom='cellar'; warpTo='surface'; }
    else if(pipe.id==='enter'){ warpFrom='surface'; warpTo='cellar'; }
    else return false;
    state='warp'; subState='warpIn'; subTimer=0.6;
    mario.vx=0; mario.vy=0;
    Audio.sfxPipe();
    Audio.stopMusic();
    return true;
  }

  function updateMario(dt, input){
    const sz=getMarioSize();
    prevFeetY=mario.y;

    // transform freeze
    if(mario.transform>0){ mario.transform-=dt; if(mario.transform<=0) mario.transform=0; return; }

    // duck handling
    if((input.isHeld('down')||input.touchState.down) && mario.power!=='small' && mario.onGround){
      mario.duck=true;
    } else {
      // try stand if ducking and ceiling
      if(mario.duck){
        // check headroom for big
        const solids=getSolids();
        let blocked=false;
        for(const s of solids) if(aabb(mario.x - sz.w/2, mario.y, CFG.bigW, CFG.bigH, s.x,s.y,s.w,s.h)) blocked=true;
        if(!blocked) mario.duck=false;
      }
    }

    // horizontal input
    const axis=input.getAxis();
    const maxSpeed = input.isHeld('run')? CFG.runSpeed : CFG.walkSpeed;
    const accel = mario.onGround? CFG.groundAccel : CFG.airAccel;
    const brake = mario.onGround? CFG.groundBrake : CFG.airBrake;
    if(axis!==0){
      mario.dir = axis>0?1:-1;
      const target = axis*maxSpeed;
      // if moving opposite direction, use brake + accel
      if(Math.sign(mario.vx) !== Math.sign(axis) && Math.abs(mario.vx)>0.2){
        // skidding
      }
      // accelerate towards target without overshoot
      if(mario.vx < target) mario.vx = Math.min(target, mario.vx + accel*dt);
      else if(mario.vx > target) mario.vx = Math.max(target, mario.vx - accel*dt);
    } else {
      // brake to 0
      if(mario.vx>0) mario.vx = Math.max(0, mario.vx - brake*dt);
      else if(mario.vx<0) mario.vx = Math.min(0, mario.vx + brake*dt);
    }

    // jump buffer / coyote
    if(input.consumeJust('jump')||input.isHeld('jump')&&input.justPressed.has('jump')){
      mario.jumpBuffer = CFG.bufferMs/1000;
    } else if(input.isHeld('jump')){
      // allow hold for variable height but not for initiating if already held? use just logic
    }
    // if jump pressed this frame (fresh)
    const wantJump = mario.jumpBuffer>0;
    const canJump = mario.onGround || mario.coyote>0;
    if(wantJump && canJump){
      let boost = Math.abs(mario.vx)> CFG.walkSpeed+0.5 ? CFG.runJumpBoost : 0;
      mario.vy = CFG.jumpSpeed + boost;
      mario.onGround=false; mario.coyote=0; mario.jumpBuffer=0;
      mario.jumpHeld=true;
      Audio.sfxJump();
    }
    // variable height: if releasing jump while going up, cut velocity
    if(!input.isHeld('jump') && mario.vy>0 && mario.jumpHeld){
      mario.vy *= 0.55;
      mario.jumpHeld=false;
    }
    if(mario.onGround) mario.jumpHeld=false;

    // gravity
    mario.vy += CFG.gravity*dt;
    if(mario.vy < -CFG.fallLimit) mario.vy=-CFG.fallLimit;

    // collision resolution
    const solids=getSolids();
    // horizontal
    let newX = mario.x + mario.vx*dt;
    let hitWall=false, hitBlock=null;
    for(const s of solids){
      if(aabb(newX - sz.w/2, mario.y, sz.w, sz.h, s.x,s.y,s.w,s.h)){
        if(mario.vx>0) newX = s.x - sz.w/2 - 0.001;
        else if(mario.vx<0) newX = s.x + s.w + sz.w/2 + 0.001;
        hitWall=true;
        if(s.type==='block') hitBlock=s.bid;
        mario.vx=0;
        break;
      }
    }
    mario.x=newX;

    // vertical
    let newY = mario.y + mario.vy*dt;
    let onGround=false, ceilHit=false, ceilBlock=null;
    // unrevealed hidden blocks are not solid; a rising head that crosses their bottom reveals them
    if(mario.vy>0){
      const headPrev = mario.y + sz.h, headNew = newY + sz.h;
      for(const b of blocks){
        if(b.revealed || b.used || !b.type.startsWith('hidden')) continue;
        if(headPrev<=b.y && headNew>=b.y && mario.x+sz.w/2>b.x && mario.x-sz.w/2<b.x+1){
          handleBlockHit(b.id, true);
        }
      }
    }
    for(const s of solids){
      if(aabb(mario.x - sz.w/2, newY, sz.w, sz.h, s.x,s.y,s.w,s.h)){
        if(mario.vy>0){
          newY = s.y - sz.h - 0.001;
          ceilHit=true; if(s.type==='block') ceilBlock=s.bid;
          mario.vy=0;
        } else if(mario.vy<0){
          newY = s.y + s.h + 0.001;
          onGround=true;
          mario.vy=0;
        }
      }
    }
    // ground intervals at y=0
    if(!onGround && newY<=0){
      if(!cellarMode){
        if(isOnSolidInterval(mario.x)){ newY=0; onGround=true; mario.vy=0; }
      } else {
        newY=0; onGround=true; mario.vy=0;
      }
    }
    mario.y=newY;
    // update coyote/buffer timers
    mario.wasOnGround = mario.onGround;
    mario.onGround=onGround;
    if(onGround){ mario.coyote= CFG.coyoteMs/1000; mario.jumpBuffer=0; }
    else { mario.coyote = Math.max(0, mario.coyote - dt); mario.jumpBuffer = Math.max(0, mario.jumpBuffer - dt); }

    if(ceilHit && ceilBlock!==null){
      handleBlockHit(ceilBlock, true);
    }
    // also if hit wall block from side via shell? handled in shell

    // checkpoint
    if(!mario.checkpointReached && mario.x > LEVEL.checkpointX){
      mario.checkpointReached=true;
      // visual pop?
    }

    // timers
    if(mario.star>0){ mario.star-=dt; if(mario.star<=0){ mario.star=0; Audio.playTheme(cellarMode?'cellar':'overworld'); if(hurryPlayed) Audio.setHurry(true); } }
    if(mario.invuln>0) mario.invuln-=dt;

    // stomp chain reset on landing
    const nowOnSolid = onGround;
    if(nowOnSolid && !wasOnSolidFloor){
      stompChain=0;
    }
    wasOnSolidFloor = nowOnSolid;

    // death
    if(mario.y < CFG.deathY){
      doDeath();
    }

    // flag
    if(!cellarMode && state==='play'){
      checkFlag();
    }
  }

  function checkFlag(){
    const fx=FLAG.x;
    if(Math.abs(mario.x - fx) < 0.7 && mario.y > -0.2){
      // valid contact above ground
      captureFlag();
    }
  }
  function captureFlag(){
    state='finish'; subState='flagSlide'; subTimer=0;
    capturedTimeDisplay=Math.floor(timeLeft);
    // compute flag bonus based on feet height
    const feet = mario.y;
    let bonus=100;
    if(feet>7) bonus=5000;
    else if(feet>5) bonus=2000;
    else if(feet>3) bonus=800;
    else if(feet>1) bonus=400;
    stats.flagBonus=bonus; score+=bonus; addPopup(FLAG.x, feet, String(bonus));
    Audio.sfxFlag();
    Audio.stopMusic();
    flagY = Math.min(FLAG.poleH, feet+1);
  }

  function doDeath(){
    // pits and timeout stay lethal even while starred
    if(state==='dying' || state==='gameover') return;
    lives--;
    if(lives<=0){
      state='gameover';
      Audio.sfxDie(); Audio.stopMusic();
      return;
    }
    state='dying'; subState='dieHop'; subTimer=1.2;
    mario.vy=10; mario.vx=0;
    Audio.sfxDie(); Audio.stopMusic();
  }

  function updateDying(dt){
    subTimer-=dt;
    mario.vy += CFG.gravity*dt;
    mario.y += mario.vy*dt;
    if(subTimer<=0){
      // respawn at checkpoint or start
      mario.x = mario.checkpointReached? LEVEL.checkpointX : LEVEL.startX;
      mario.y = LEVEL.startY; mario.vx=0; mario.vy=0;
      mario.power='small'; mario.invuln=1.5;
      timeLeft=CFG.startTime; hurryPlayed=false;
      // reset level but keep score/coins/secrets
      items=[]; fireballs=[]; particles=[]; popups=[];
      cellarMode=false; surfaceEnemies=[]; inCastle=false;
      buildLevelPreserve();
      state='play'; subState='';
      Audio.playTheme('overworld');
      cameraX=mario.x;
    }
  }
  function buildLevelPreserve(){
    // rebuild blocks/enemies but keep consumed? For checkpoint spec: Preserve score, coins, discoveries, and consumed items after non-final death.
    // So we keep blocks hit state? We'll keep blocks as they were? But spec says restore? Actually "Preserve score, coins, discoveries, and consumed items after a non-final death." Means consumed stays consumed.
    // We'll keep blocks hit status
    // For simplicity rebuild enemies only
    // blocks, world coins and cellar coins keep their state; enemies respawn fresh
    const oldBlocks=blocks;
    const oldCoins=coinsArr;
    const oldCellarCoins=cellarCoins;
    buildLevel();
    blocks=oldBlocks;
    coinsArr=oldCoins;
    cellarCoins=oldCellarCoins;
  }

  function handleWarp(dt, input){
    subTimer-=dt;
    if(subState==='warpIn'){
      mario.y -= 2*dt; // descend into the pipe
      if(subTimer<=0){
        if(warpTo==='cellar'){
          // surface enemies and projectiles do not follow Mario underground
          surfaceEnemies = enemies;
          enemies = []; items = []; fireballs = []; popups = [];
          cellarMode=true; cellarEntered=true; secretsFound.add('cellar');
          mario.x=CELLAR.exitPipeX-6; mario.y=0;
          Audio.playTheme('cellar');
        } else if(warpTo==='surface'){
          cellarMode=false;
          enemies = surfaceEnemies; surfaceEnemies = [];
          items = []; fireballs = []; popups = [];
          const exitPipe = PIPES.find(p=>p.id==='exit');
          mario.x = exitPipe.x; mario.y = exitPipe.h;
          Audio.playTheme('overworld'); if(hurryPlayed) Audio.setHurry(true);
        }
        mario.vx=0; mario.vy=0; mario.onGround=false;
        subState='warpOut'; subTimer=0.8;
        Audio.sfxPipe();
      }
    } else if(subState==='warpOut'){
      // emerge: rise out of the pipe mouth; on the surface the cellar exit is the pipe itself
      if(warpTo==='surface') mario.y += 2*dt;
      else mario.y = Math.max(mario.y, 0);
      if(subTimer<=0){
        state='play'; subState=''; warpFrom=warpTo=null;
        mario.onGround=false; mario.vy=0;
        mario.invuln=0.6;
      }
    }
  }

  function updateFinish(dt){
    if(subState==='flagSlide'){
      // slide down flag
      mario.y -= 3*dt;
      flagY -= 4*dt;
      if(mario.y<=0){ mario.y=0; subState='walkToCastle'; subTimer=1.2; }
      if(flagY<0) flagY=0;
    } else if(subState==='walkToCastle'){
      // walk to the castle door (centre of the castle front), then Mario goes inside
      const doorX = CASTLE.x + CASTLE.w/2;
      mario.x = Math.min(doorX, mario.x + 3*dt);
      mario.dir = 1;
      if(mario.x >= doorX){
        inCastle=true;
        subState='timeCount'; subTimer=0;
      }
    } else if(subState==='timeCount'){
      // convert remaining whole timer units at 50 points each, one tick per unit
      if(timeLeft>0){
        const before=Math.ceil(timeLeft);
        timeLeft=Math.max(0, timeLeft - 30*dt);
        const units=before-Math.ceil(timeLeft);
        if(units>0){
          score+=units*SCORE.timeUnit; stats.timeBonus+=units*SCORE.timeUnit;
          Audio.sfxTimeTick();
        }
      } else {
        timeLeft=0;
        subState='fireworks';
        // fireworks follow the digit the player saw when touching the flag
        const d = capturedTimeDisplay % 10;
        let count=0; if(d===1||d===3||d===6) count=d;
        stats.fireworks=count;
        for(let i=0;i<count;i++){
          effects.push({x:CASTLE.x+CASTLE.w/2+(i-(count-1)/2)*1.4, y:4+(i%2)*1.5, t:-i*0.35, life:0.8, fired:false});
        }
        if(count===0) subState='done';
      }
    } else if(subState==='fireworks'){
      let doneAll=true;
      for(const e of effects){
        e.t+=dt;
        if(e.t>0 && !e.fired){ e.fired=true; score+=SCORE.firework; stats.fireworkBonus+=SCORE.firework; Audio.sfxFirework(); }
        if(e.t < e.life) doneAll=false;
      }
      if(doneAll) subState='done';
    }
    if(subState==='done'){
      // finalize
      state='win';
      // save records
      const thisTime = Math.floor(runTime);
      newBest = score>bestScore && bestScore>0;
      if(score>bestScore) bestScore=score;
      // completion time record: only finished runs, smaller is better
      if(thisTime < bestTime) bestTime=thisTime;
      saveRecords();
      Audio.sfxFlag();
    }
  }

  function handleCollisionsWithEnemies(){
    const sz=getMarioSize();
    const mx=mario.x - sz.w/2, my=mario.y, mw=sz.w, mh=sz.h;
    for(const e of enemies){
      if(e.dead) continue;
      if(!e.active) continue;
      const ex=e.x, ey=e.y, ew=0.8, eh= e.state==='shell'?0.5:0.8;
      if(!aabb(mx,my,mw,mh, ex,ey,ew,eh)) continue;
      // star invincible
      if(mario.star>0){
        e.dead=true; e.state='defeated'; e.vy=5;
        addScore(SCORE.enemy, e.x,e.y+0.5);
        stats.enemiesDefeated++;
        continue;
      }
      // check stomp: descending and previous feet above enemy top
      const feetPrev = prevFeetY;
      const enemyTop = ey+eh;
      const descending = mario.vy<0 || !mario.onGround;
      if(descending && feetPrev >= enemyTop -0.25 && mario.y + mh*0.1 >= enemyTop -0.4){
        // stomp
        if(e.type==='goomba'){
          e.dead=true; e.state='flat'; e.vy=0; e.deadT=0.5;
          // flattened in place; harmless from now on
          mario.vy=11;
          // chain
          stompChain++;
          let pts;
          if(stompChain<=STOMP_CHAIN.length) pts=STOMP_CHAIN[stompChain-1];
          else { // 1up
            if(stompChain===9){ lives++; addPopup(e.x,ey+1,'1-UP'); Audio.sfx1up(); pts=0; }
            else pts=0; // continue 1up?
          }
          if(pts){ addScore(pts, e.x,ey+1); }
          stats.enemiesDefeated++;
          Audio.sfxStomp();
        } else if(e.type==='koopa'){
          if(e.state==='walk'){
            e.state='shell'; e.vx=0; e.timer=6; e.vy=0;
            mario.vy=9;
            addScore(100, e.x,ey+0.5);
            Audio.sfxStomp();
          } else if(e.state==='shell'){
            // kick
            const dir = (mario.x < e.x)?1:-1;
            e.state='shell_sliding'; e.vx=dir*CFG.shellSpeed; e.chain=0; e.kickGrace=0.2; e.kickOwner=true;
            mario.vy=5;
            Audio.sfxStomp();
          } else if(e.state==='shell_sliding'){
            // stop it
            e.state='shell'; e.vx=0; e.timer=6;
            mario.vy=9;
            addScore(100, e.x,ey+0.5);
            Audio.sfxStomp();
          }
        }
        continue;
      }
      // side damage
      // shell sliding grace period for kick
      if(e.state==='shell_sliding' && e.kickGrace>0){
        continue;
      }
      // damage Mario
      if(mario.invuln>0) continue;
      if(mario.power==='small'){
        // die
        doDeath();
      } else {
        // shrink to small
        mario.power='small';
        mario.transform=0.8; mario.transformFrom='big';
        mario.invuln=CFG.invulnDuration;
        Audio.sfxHit();
      }
    }
    // also handle shell sliding grace countdown
    for(const e of enemies) if(e.kickGrace) e.kickGrace=Math.max(0, e.kickGrace - CFG.fixedDt);
  }

  function handleItemPickup(){
    const sz=getMarioSize();
    const mx=mario.x - sz.w/2, my=mario.y, mw=sz.w, mh=sz.h;
    // world coins
    if(!cellarMode){
      for(const c of coinsArr){
        if(c.taken) continue;
        if(aabb(mx,my,mw,mh, c.x-0.3,c.y-0.3,0.6,0.6)){
          c.taken=true;
          score+=SCORE.coin; coins++;
          if(coins>=100){ coins-=100; lives++; addPopup(c.x,c.y,'1-UP'); Audio.sfx1up(); }
          else Audio.sfxCoin();
          addPopup(c.x,c.y,'200');
        }
      }
    } else {
      for(const c of cellarCoins){
        if(c.taken) continue;
        // cellar local to world? cellar x is local, mario in cellar uses same 0-30
        if(aabb(mx,my,mw,mh, c.x-0.3,c.y-0.3,0.6,0.6)){
          if(!c.collected){ c.taken=true; score+=SCORE.coin; coins++; addPopup(c.x,c.y,'200'); if(coins>=100){coins-=100;lives++; Audio.sfx1up(); addPopup(c.x,c.y,'1-UP'); } else Audio.sfxCoin(); }
        }
      }
    }
    // items
    for(const it of items){
      if(it.taken||it.emerging) continue;
      if(aabb(mx,my,mw,mh, it.x,it.y,it.w,it.h)){
        it.taken=true;
        if(it.type==='mushroom'){
          if(mario.power==='small'){
            mario.power='big'; mario.transform=0.6; Audio.sfxPowerup();
          } else {
            // already big/fire stays? just points
          }
          addScore(SCORE.powerup, it.x,it.y);
        } else if(it.type==='flower'){
          // edge case: if was Big when released but now Small, become Big not Fire. Our adaptive already handled at spawn, so here just handle collection:
          // Actually if spawned as flower but mario shrank before collecting, it should give Big. So need to track spawnPower vs current.
          // Simplified: if mario is small, flower gives big.
          if(mario.power==='small'){
            mario.power='big'; mario.transform=0.6;
          } else {
            mario.power='fire';
          }
          addScore(SCORE.powerup, it.x,it.y);
          Audio.sfxPowerup();
        } else if(it.type==='1up'){
          lives++; addPopup(it.x,it.y,'1-UP'); Audio.sfx1up();
          addScore(SCORE.powerup, it.x,it.y);
        } else if(it.type==='star'){
          mario.star=CFG.starDuration; Audio.playTheme('star'); addScore(SCORE.powerup, it.x,it.y); Audio.sfxPowerup();
        }
      }
    }
  }

  function tryFire(input){
    if(mario.power!=='fire' || cellarMode) return;
    if(!input.isHeld('run') && !input.consumeJust('run')) return; // hold to fire
    // cooldown
    if(mario._fireCd>0) return;
    if(fireballs.length >= CFG.maxFireballs) return;
    // spawn outside body
    const sz=getMarioSize();
    const fx = mario.x + mario.dir*(sz.w/2+0.4);
    const fy = mario.y + sz.h*0.6;
    // check embedded in solid
    const solids=getSolids();
    let blocked=false;
    for(const s of solids) if(aabb(fx-0.2,fy-0.2,0.4,0.4, s.x,s.y,s.w,s.h)) blocked=true;
    if(blocked) return;
    fireballs.push({x:fx-0.2,y:fy-0.2,vx:mario.dir*CFG.fireballSpeed, vy:2, life:2.5, dead:false});
    mario._fireCd=CFG.fireballCooldown;
    Audio.sfxFireball();
    // throwing pose timer
    mario._throwT=0.15;
  }

  // camera is presentation only: it follows Mario on the surface and frames the whole cellar
  function updateCamera(dt){
    const target = cellarMode ? CELLAR.w/2 : Math.min(Math.max(mario.x, -48), 138);
    cameraX += (target - cameraX)*Math.min(1, dt*6);
  }

  function pause(){
    if(state!=='play') return;
    state='paused'; Audio.silenceMusic(); Audio.sfxPause();
  }
  function resume(){
    if(state!=='paused') return;
    state='play'; Audio.unsilenceMusic();
  }

  // main fixed update
  function fixedUpdate(dt, input){
    // input global pause/restart
    if(input.consumeJust('pause')||input.consumeJust('enter')){
      if(state==='title'){ state='play'; Audio.initAudio(); Audio.playTheme('overworld'); }
      else if(state==='play'){ pause(); }
      else if(state==='paused'){ resume(); }
      else if(state==='gameover' || state==='win'){ resetRun(true); return; }
    }
    if(input.consumeJust('restart')){
      if(state!=='title'){ resetRun(true); return; }
    }

    if(state==='title') return;
    if(state==='paused') return;
    updateCamera(dt);
    if(state==='warp'){ handleWarp(dt,input); return; }
    if(state==='dying'){ updateDying(dt); return; }
    if(state==='finish'){ updateFinish(dt); return; }
    if(state==='gameover' || state==='win') return;

    // normal play
    if(mario._fireCd) mario._fireCd-=dt;
    if(mario._throwT) mario._throwT-=dt;

    // warp check before movement (down press)
    if(input.isHeld('down')){
      const p=tryWarp();
      if(p && startWarp(p)) return;
    }

    runTime+=dt;
    // timer countdown
    timeLeft-=dt;
    if(timeLeft<=100 && !hurryPlayed && timeLeft>0){
      hurryPlayed=true; Audio.setHurry(true);
    }
    if(timeLeft<=0){ timeLeft=0; doDeath(); return; }

    activateEnemies();
    updateMario(dt, input);
    // handle collisions after mario move
    handleCollisionsWithEnemies();
    handleItemPickup();
    tryFire(input);
    updateEnemies(dt);
    updateItems(dt);
    updateFireballs(dt);

    // popups / particles
    for(const p of popups){ p.t+=dt; p.y+=p.vy*dt; p.vy-=3*dt; }
    popups=popups.filter(p=>p.t<0.7);
    for(const p of particles){ p.t+=dt; p.vy+=CFG.gravity*dt*0.5; p.x+=p.vx*dt; p.y+=p.vy*dt; }
    particles=particles.filter(p=>p.t<p.life);

    // block bump anim
    for(const b of blocks) if(b.bump>0) b.bump-=dt;

  }

  function getState(){ return {state, subState, mario, score, coins, lives, timeLeft, bestScore, bestTime, newBest, secretsFound, secretsTotal, blocks, coinsArr, enemies, items, fireballs, particles, popups, effects, solids:getSolids(), cameraX, runTime, cellarMode, cellarCoins, stats, finishStage, flagY, capturedTimeDisplay, inCastle}; }
  function setStateTitle(){ state='title'; }
  function forcePlay(){ state='play'; Audio.initAudio(); Audio.playTheme('overworld'); }

  // inspection API for tests
  const api = {
    getMario:()=>mario,
    getSolids,
    getBlocks:()=>blocks,
    CFG,
    fixedUpdate, resetRun, getState, setStateTitle, forcePlay,
    handleBlockHit, addScore, aabb, isOnSolidInterval
  };

  return { fixedUpdate, getState, setStateTitle, forcePlay, resetRun, getMarioSize, api, saveRecords, pause, resume };
}
