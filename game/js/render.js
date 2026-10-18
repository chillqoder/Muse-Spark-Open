import * as THREE from '../vendor/three.module.js';
import { CFG } from './config.js';
import { TREES, BUSHES, FLAG, CASTLE } from './level.js';

// Mario's model is built with its origin at the hips. The soles sit FEET_Y below that origin
// and the model is MODEL_H tall, so scaling by (collision height / MODEL_H) keeps feet on mario.y.
const MODEL_H = 1.53;
const FEET_Y = 0.73;
const SKY = CFG.sky;
const CELLAR_SKY = 0x2a2118;

// outfit colours per power state; the star effect cycles cap and shirt only
const OUTFIT = {
  small: { cap:0xE53935, shirt:0xE53935, overall:0x1E88E5 },
  big:   { cap:0xE53935, shirt:0xE53935, overall:0x1E88E5 },
  fire:  { cap:0xFFFFFF, shirt:0xFFFFFF, overall:0xE53935 },
};

// deterministic random so the artwork is identical on every load
function seeded(seed){
  return ()=>{
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRenderer(canvas){
  let renderer;
  try{
    renderer=new THREE.WebGLRenderer({canvas, antialias:true});
  }catch(e){
    return null; // no WebGL: main.js shows the friendly message
  }
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;

  const scene=new THREE.Scene();
  scene.background=new THREE.Color(SKY);
  scene.fog=new THREE.Fog(SKY, 40, 90);

  const camera=new THREE.PerspectiveCamera(58, 1, 0.1, 200);
  camera.position.set(0,5,14);
  camera.lookAt(0,1,0);

  // lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun=new THREE.DirectionalLight(0xfff8e1, 1.1);
  sun.position.set(10,18,12);
  sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.near=0.5; sun.shadow.camera.far=80;
  sun.shadow.camera.left=-30; sun.shadow.camera.right=30; sun.shadow.camera.top=20; sun.shadow.camera.bottom=-10;
  scene.add(sun);

  // shared geometry and materials: per-frame code only creates scene-graph nodes
  const geoCache=new Map();
  function box(w,h,d){
    const key=w+'/'+h+'/'+d;
    if(!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w,h,d));
    return geoCache.get(key);
  }
  const matCache=new Map();
  function lam(color){
    if(!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({color}));
    return matCache.get(color);
  }
  const coinGeo=new THREE.CylinderGeometry(0.35,0.35,0.12,8);

  // procedural pixel textures
  const rand=seeded(1337);
  function makeTexture(draw){
    const c=document.createElement('canvas'); c.width=16; c.height=16;
    draw(c.getContext('2d'), 16, rand);
    const tex=new THREE.CanvasTexture(c);
    tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
    tex.colorSpace=THREE.SRGBColorSpace;
    return tex;
  }
  const texGrass=makeTexture((g,s,R)=>{
    g.fillStyle='#3FAF4A'; g.fillRect(0,0,s,s);
    g.fillStyle='#6B8E23'; for(let i=0;i<12;i++) g.fillRect(R()*s,R()*s,1,1.5);
    g.fillStyle='#8BC34A'; for(let i=0;i<6;i++) g.fillRect(R()*s,R()*2,2,1);
  });
  const texSoil=makeTexture((g,s,R)=>{
    g.fillStyle='#8D6E63'; g.fillRect(0,0,s,s);
    g.fillStyle='#5D4037'; for(let i=0;i<18;i++) g.fillRect(R()*s,R()*s,1,1);
    g.fillStyle='#BC9A8A'; for(let i=0;i<8;i++) g.fillRect(R()*s,R()*s,1,1);
  });
  const texBrick=makeTexture((g,s,R)=>{
    g.fillStyle='#C76B3C'; g.fillRect(0,0,s,s);
    g.fillStyle='#F0D0B0'; g.fillRect(0,7,s,2); // mortar
    g.fillRect(7,0,2,s);
    g.fillStyle='#A85A2E'; for(let i=0;i<6;i++) g.fillRect(R()*7, R()*7,1,1);
  });
  const texQuestion=makeTexture((g,s)=>{
    g.fillStyle='#E8B73A'; g.fillRect(0,0,s,s);
    g.fillStyle='#F7D774'; g.fillRect(1,1,14,3); // highlight
    g.fillStyle='#7A5A1A'; g.fillRect(0,0,16,1); g.fillRect(0,15,16,1); g.fillRect(0,0,1,16); g.fillRect(15,0,1,16);
    g.fillStyle='#7A3B00'; g.fillRect(6,4,4,2); g.fillRect(8,6,2,3); g.fillRect(6,11,4,2);
  });
  const texUsed=makeTexture((g,s,R)=>{
    g.fillStyle='#8D7B6B'; g.fillRect(0,0,s,s);
    g.fillStyle='#6B5E52'; for(let i=0;i<10;i++) g.fillRect(R()*s,R()*s,1,1);
  });

  const matGround=new THREE.MeshLambertMaterial({map:texGrass});
  const matSoil=new THREE.MeshLambertMaterial({map:texSoil});
  const matBrick=new THREE.MeshLambertMaterial({map:texBrick});
  const matQuestion=new THREE.MeshLambertMaterial({map:texQuestion});
  const matUsed=new THREE.MeshLambertMaterial({map:texUsed});
  const matPipe=lam(CFG.pipe);
  const matPipeRim=lam(CFG.pipeRim);
  const matCastle=lam(0xDEB887);
  const matGold=lam(0xFFD54F);

  // scene graph
  const world=new THREE.Group(); scene.add(world);
  const bgGroup=new THREE.Group(); scene.add(bgGroup);
  const decorGroup=new THREE.Group(); world.add(decorGroup);
  const solidGroup=new THREE.Group(); world.add(solidGroup);
  const blockGroup=new THREE.Group(); world.add(blockGroup);
  const entityGroup=new THREE.Group(); world.add(entityGroup);
  const coinGroup=new THREE.Group(); entityGroup.add(coinGroup);
  const enemyGroup=new THREE.Group(); entityGroup.add(enemyGroup);
  const itemGroup=new THREE.Group(); entityGroup.add(itemGroup);
  const fireGroup=new THREE.Group(); entityGroup.add(fireGroup);
  const fxGroup=new THREE.Group(); world.add(fxGroup);

  // background hills and clouds (parallax only, never part of gameplay)
  const hills=[];
  for(let i=0;i<4;i++){
    const hill=new THREE.Mesh(box(30, 6+rand()*4, 10), lam(i%2?0xA8D5C0:0xC8E8D8));
    hill.position.set(-30 + i*45, -1, -22 - i*2);
    bgGroup.add(hill); hills.push(hill);
  }
  const clouds=[];
  for(let i=0;i<7;i++){
    const g=new THREE.Group();
    for(let j=0;j<3;j++){
      const c=new THREE.Mesh(box(2+rand(),1,1), lam(0xffffff));
      c.position.set(j*1.2-1.2,0,0);
      g.add(c);
    }
    g.position.set(-50 + i*30 + rand()*10, 10+rand()*2, -14);
    bgGroup.add(g); clouds.push({mesh:g, speed:0.15+rand()*0.1});
  }

  // trees and bushes, built once
  for(const tr of TREES){
    const trunk=new THREE.Mesh(box(0.35,1.2,0.35), lam(0x5D4037));
    trunk.position.set(tr.x, 0.6, tr.z);
    decorGroup.add(trunk);
    for(let i=0;i<4;i++){
      const b=new THREE.Mesh(box(1.1-i*0.12,0.55,1.1-i*0.12), lam(0x4CAF50));
      b.position.set(tr.x, 1.6 + i*0.5, tr.z);
      decorGroup.add(b);
    }
  }
  for(const bu of BUSHES){
    const bush=new THREE.Mesh(box(1.3,0.45,0.8), lam(0x6ABF69));
    bush.position.set(bu.x,0.22, bu.z);
    decorGroup.add(bush);
  }

  // flagpole and castle, built once; hidden in the cellar
  const flagMesh=new THREE.Mesh(box(0.12, FLAG.poleH, 0.12), lam(0xE0E0E0));
  flagMesh.position.set(FLAG.x, FLAG.poleH/2, 0);
  const flagFlag=new THREE.Mesh(box(0.9,0.6,0.05), lam(0x4CAF50));
  flagFlag.position.set(0.45, FLAG.poleH/2 -1, 0);
  flagMesh.add(flagFlag);
  world.add(flagMesh);

  const castleMesh=new THREE.Mesh(box(CASTLE.w, CASTLE.h, 2.6), lam(0xC9A86A));
  castleMesh.position.set(CASTLE.x+CASTLE.w/2, CASTLE.h/2, -0.3);
  const door=new THREE.Mesh(box(0.9,1.6,0.1), lam(0x3E2723));
  door.position.set(0, -CASTLE.h/2+0.8, 1.35); // flush with the castle front face
  castleMesh.add(door);
  world.add(castleMesh);

  // ---- Mario rig: pivots at hips and shoulders, origin at the hips ----
  function buildMario(){
    const group=new THREE.Group();
    const body=new THREE.Group(); body.position.y=FEET_Y; group.add(body);
    const mats={
      cap:new THREE.MeshLambertMaterial({color:OUTFIT.small.cap}),
      shirt:new THREE.MeshLambertMaterial({color:OUTFIT.small.shirt}),
      overall:new THREE.MeshLambertMaterial({color:OUTFIT.small.overall}),
      skin:lam(0xFFCC99), hair:lam(0x4E342E), glove:lam(0xffffff),
      shoe:lam(0x5D4037), eye:lam(0x212121), button:lam(0xFFD600),
    };
    const add=(parent, w,h,d, mat, x,y,z)=>{
      const m=new THREE.Mesh(box(w,h,d), mat);
      m.position.set(x,y,z); parent.add(m); return m;
    };
    add(body, 0.6,0.3,0.55, mats.cap, 0,0.65,0);          // cap
    add(body, 0.35,0.08,0.3, mats.cap, 0.28,0.58,0);      // brim
    add(body, 0.5,0.35,0.45, mats.skin, 0,0.32,0);        // face
    add(body, 0.15,0.12,0.18, mats.skin, 0.24,0.32,0);    // nose
    add(body, 0.3,0.08,0.25, mats.hair, 0.18,0.26,0);     // mustache
    add(body, 0.08,0.08,0.02, mats.eye, 0.22,0.38,0.18);  // eyes
    add(body, 0.08,0.08,0.02, mats.eye, 0.22,0.38,-0.18);
    add(body, 0.5,0.45,0.32, mats.shirt, 0,-0.05,0);      // shirt
    add(body, 0.52,0.4,0.34, mats.overall, 0,-0.08,0);    // overalls
    add(body, 0.08,0.08,0.36, mats.button, -0.05,0.06,0); // button

    const pivots={};
    // arms: shoulder pivots with glove at the end
    for(const side of [-1,1]){
      const pivot=new THREE.Group(); pivot.position.set(0,0.12,side*0.32); body.add(pivot);
      const arm=add(pivot, 0.18,0.35,0.18, mats.shirt, 0,-0.18,0);
      add(arm, 0.16,0.16,0.16, mats.glove, 0,-0.18,0);
      pivots[side<0?'armL':'armR']=pivot;
    }
    // legs: hip pivots with a shoe at the end
    for(const side of [-1,1]){
      const pivot=new THREE.Group(); pivot.position.set(0,-0.3,side*0.15); body.add(pivot);
      const leg=add(pivot, 0.2,0.35,0.2, mats.overall, 0,-0.15,0);
      add(leg, 0.24,0.12,0.22, mats.shoe, 0.05,-0.22,0);
      pivots[side<0?'legL':'legR']=pivot;
    }
    entityGroup.add(group);
    return {group, pivots, mats};
  }
  const marioRig=buildMario();

  function setOutfit(pal){
    marioRig.mats.cap.color.setHex(pal.cap);
    marioRig.mats.shirt.color.setHex(pal.shirt);
    marioRig.mats.overall.color.setHex(pal.overall);
  }

  function renderMario(m, state, t){
    const rig=marioRig;
    const h = (m.duck && m.power!=='small') ? CFG.duckH : (m.power==='small' ? CFG.smallH : CFG.bigH);
    const pop = m.transform>0 ? 1+Math.sin(t*18)*0.08 : 1;
    const s = h/MODEL_H*pop;
    rig.group.position.set(m.x, m.y, 0);
    rig.group.scale.set(m.dir<0?-s:s, s, s);
    rig.group.rotation.z=0;

    if(m.star>0){
      const hue=(t*3)%1;
      rig.mats.cap.color.setHSL(hue,0.9,0.55);
      rig.mats.shirt.color.setHSL(hue,0.9,0.55);
      rig.mats.overall.color.setHSL((hue+0.5)%1,0.9,0.5);
    } else {
      setOutfit(OUTFIT[m.power]||OUTFIT.small);
    }

    // limb poses
    const spd=Math.abs(m.vx);
    const cycle=t*(spd>8?14:9);
    let legL=0, legR=0, armL=0, armR=0;
    if(!m.onGround && m.vy>0.5){ legL=-0.6; legR=0.6; armL=0.5; armR=-0.5; }
    else if(m.onGround && spd>0.3){
      const sn=Math.sin(cycle);
      legL=sn*0.8; legR=-sn*0.8; armL=-sn*0.6; armR=sn*0.6;
    }
    if(m._throwT>0) armL=-1.1;
    rig.pivots.legL.rotation.x=legL; rig.pivots.legR.rotation.x=legR;
    rig.pivots.armL.rotation.x=armL; rig.pivots.armR.rotation.x=armR;

    // skid: tilt while still moving against the facing direction
    if(m.onGround && Math.sign(m.vx)!==Math.sign(m.dir) && spd>2.5) rig.group.rotation.z=Math.sign(m.dir)*0.18;
    if(state.state==='dying') rig.group.rotation.z=0.6;

    // hidden while blinking under invulnerability and once inside the castle
    rig.group.visible = !state.inCastle && !(m.invuln>0 && Math.floor(t*12)%2===0);
  }

  // ---- surface/cellar mode ----
  let solidKey='';
  function applyArea(cellar){
    scene.background.set(cellar?CELLAR_SKY:SKY);
    scene.fog.color.set(cellar?CELLAR_SKY:SKY);
    bgGroup.visible=!cellar;
    decorGroup.visible=!cellar;
    blockGroup.visible=!cellar;
    flagMesh.visible=!cellar;
    castleMesh.visible=!cellar;
  }

  function rebuildSolids(solids, cellar){
    solidGroup.clear();
    for(const s of solids){
      if(s.type==='block' || s.type==='castle') continue; // blocks and castle have their own meshes
      let mat=matSoil;
      if(s.type==='ground' || s.type==='stair') mat = cellar ? matBrick : matGround;
      else if(s.type==='wall' || s.type==='ceiling') mat=matBrick;
      else if(s.type==='pipe') mat=matPipe;
      const mesh=new THREE.Mesh(box(1,1,1), mat);
      mesh.scale.set(s.w, s.h, 1.2);
      mesh.position.set(s.x + s.w/2, s.y + s.h/2, 0);
      mesh.receiveShadow=true;
      solidGroup.add(mesh);
      if(s.type==='pipe'){
        const rim=new THREE.Mesh(box(s.w+0.3,0.25,1.6), matPipeRim);
        rim.position.set(s.x + s.w/2, s.y+s.h, 0);
        solidGroup.add(rim);
      }
    }
  }

  // ---- blocks: one mesh per block, created on first sight ----
  const blockMeshes=new Map();
  function renderBlocks(blocks, cellar){
    for(const b of blocks){
      let mesh=blockMeshes.get(b.id);
      if(!mesh){
        mesh=new THREE.Mesh(box(1,1,1), matBrick);
        mesh.castShadow=true; mesh.receiveShadow=true;
        blockGroup.add(mesh);
        blockMeshes.set(b.id, mesh);
      }
      mesh.visible = !cellar && b.revealed && !(b.hit && b.used);
      if(!mesh.visible) continue;
      mesh.material = b.type.startsWith('q_') && !b.used ? matQuestion : (b.used ? matUsed : matBrick);
      mesh.position.set(b.x+0.5, b.y+0.5 + (b.bump>0 ? Math.sin(b.bump*30)*0.15 : 0), 0);
    }
  }

  function renderEnemies(enemies, t){
    enemyGroup.clear();
    for(const e of enemies){
      if(e.gone) continue;
      if(!e.active && !e.dead && e.state==='walk') continue;
      const g=new THREE.Group();
      g.position.set(e.x+0.4, e.y, 0);
      if(e.type==='goomba'){
        // body spans the full 0.8-unit hitbox; soles sit exactly on e.y
        const body=new THREE.Mesh(box(0.74,0.58,0.62), lam(0x8D6E63)); body.position.y=0.35; g.add(body);
        const feet=new THREE.Mesh(box(0.66,0.14,0.52), lam(0x3E2723)); feet.position.y=0.07; g.add(feet);
        const eyeL=new THREE.Mesh(box(0.08,0.1,0.02), lam(0x212121)); eyeL.position.set(0.2,0.45,0.15); g.add(eyeL);
        const eyeR=eyeL.clone(); eyeR.position.z=-0.15; g.add(eyeR);
        if(e.state==='flat'){ g.scale.y=0.3; }
        else if(e.dead){ g.rotation.z=Math.PI; g.position.y+=0.8; }
      } else {
        const col = e.color==='red'?0xE53935:0x4CAF50;
        if(e.state==='shell' || e.state==='shell_sliding'){
          const shell=new THREE.Mesh(box(0.65,0.45,0.6), lam(col)); shell.position.y=0.225; g.add(shell);
          // wobble when a stationary shell is about to wake
          if(e.state==='shell' && e.timer<2) g.rotation.z=Math.sin(t*18)*0.1;
        } else {
          g.scale.x = e.vx<0 ? -1 : 1;
          const shell=new THREE.Mesh(box(0.62,0.5,0.6), lam(col)); shell.position.y=0.25; g.add(shell);
          const head=new THREE.Mesh(box(0.28,0.28,0.28), lam(0xFFCC80)); head.position.set(-0.3,0.3,0); g.add(head);
        }
      }
      enemyGroup.add(g);
    }
  }

  function renderItems(items, t){
    itemGroup.clear();
    for(const it of items){
      if(it.taken) continue;
      const g=new THREE.Group();
      g.position.set(it.x+it.w/2, it.y+it.h/2, 0);
      const colors={mushroom:0xE53935, flower:0xFF9800, '1up':0x4CAF50, star:0xFFD600};
      const m=new THREE.Mesh(box(0.55,0.55,0.55), lam(colors[it.type]||0xE53935));
      if(it.type==='mushroom'){
        const dots=new THREE.Mesh(box(0.12,0.12,0.58), lam(0xffffff));
        dots.position.y=0.12; m.add(dots);
      } else if(it.type==='star'){
        m.rotation.z=t*3;
      }
      g.add(m);
      itemGroup.add(g);
    }
  }

  function renderFire(fireballs, t){
    fireGroup.clear();
    for(const f of fireballs){
      const mesh=new THREE.Mesh(box(0.32,0.32,0.32), lam(0xFF5722));
      mesh.position.set(f.x+0.2, f.y+0.2, 0);
      mesh.rotation.z=t*10;
      fireGroup.add(mesh);
    }
  }

  // fireworks: a ring of blocks around a fixed centre, growing then fading out
  function renderEffects(effects){
    fxGroup.clear();
    for(const fx of effects){
      if(fx.t<0 || fx.t>fx.life) continue;
      const burst=new THREE.Group();
      burst.position.set(fx.x, fx.y + fx.t*1.5, 0);
      burst.scale.setScalar(0.4 + 0.8*Math.min(1, fx.t/0.25));
      for(let i=0;i<6;i++){
        const a=i/6*Math.PI*2 + fx.id;
        const p=new THREE.Mesh(box(0.18,0.18,0.18), lam(i%2?0xFFD600:0xE53935));
        p.position.set(Math.cos(a)*0.8, Math.sin(a)*0.8, 0);
        burst.add(p);
      }
      fxGroup.add(burst);
    }
  }

  let lastCellar=null;
  function renderFrame(state, t){
    const m=state.mario;
    if(!m) return;

    // camera follows the simulation's camera X; parallax moves the scenery behind it
    camera.position.x = state.cameraX;
    camera.lookAt(state.cameraX, 2.2, 0);
    for(let i=0;i<hills.length;i++) hills[i].position.x = state.cameraX*0.15 + (-30 + i*45);
    for(const c of clouds){
      c.mesh.position.x += c.speed*0.016;
      if(c.mesh.position.x > state.cameraX+30) c.mesh.position.x = state.cameraX-35;
    }

    if(state.cellarMode!==lastCellar){
      lastCellar=state.cellarMode;
      applyArea(state.cellarMode);
      solidKey='';
    }
    const key=state.cellarMode?'cellar':'surface';
    if(key!==solidKey){
      solidKey=key;
      rebuildSolids(state.solids, state.cellarMode);
    }

    renderBlocks(state.blocks, state.cellarMode);

    coinGroup.clear();
    const coins = state.cellarMode ? state.cellarCoins : state.coinsArr;
    for(const c of coins){
      if(c.taken) continue;
      // coin pickup is centred on (c.x, c.y), so the mesh is too
      const mesh=new THREE.Mesh(coinGeo, matGold);
      mesh.position.set(c.x, c.y, 0);
      mesh.rotation.set(0, t*2.5, Math.PI/2);
      coinGroup.add(mesh);
    }

    renderEnemies(state.enemies, t);
    renderItems(state.items, t);
    renderFire(state.fireballs, t);
    renderEffects(state.effects||[]);
    renderMario(m, state, t);

    flagFlag.position.y = state.flagY - FLAG.poleH/2;

    renderer.render(scene, camera);
  }

  // project a world point to CSS pixels on the canvas (used for score popups)
  function toScreen(x, y){
    camera.updateMatrixWorld();
    const v=new THREE.Vector3(x, y, 0).project(camera);
    const w=renderer.domElement.clientWidth, h=renderer.domElement.clientHeight;
    return { x:(v.x*0.5+0.5)*w, y:(-v.y*0.5+0.5)*h };
  }

  function resize(w,h){
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
    renderer.setSize(w,h);
    camera.aspect=w/h; camera.updateProjectionMatrix();
  }

  return { renderFrame, resize, toScreen, scene, renderer, camera };
}
