import { CFG } from './config.js';
import { createInput } from './input.js';
import { createSimulation } from './simulation.js';
import { createRenderer } from './render.js';
import * as Audio from './audio.js';

const canvas=document.getElementById('game');
const hudScore=document.getElementById('hud-score');
const hudCoins=document.getElementById('hud-coins');
const hudWorld=document.getElementById('hud-world');
const hudTime=document.getElementById('hud-time');
const hudLives=document.getElementById('hud-lives');
const hudPower=document.getElementById('hud-power');
const progressBar=document.getElementById('progress-bar');
const overlay=document.getElementById('overlay');
const overlayTitle=document.getElementById('overlay-title');
const overlaySub=document.getElementById('overlay-sub');
const overlayBtn=document.getElementById('overlay-btn');
const muteBtn=document.getElementById('btn-mute');
const pauseBtn=document.getElementById('btn-pause');
const canvasWrap=document.getElementById('canvas-wrap');
const popupLayer=document.getElementById('popup-layer');

const input=createInput();
const sim=createSimulation();
const renderer=createRenderer(canvas); // null when WebGL is unavailable

// touch bindings
input.bindTouch(document.getElementById('t-left'),'left');
input.bindTouch(document.getElementById('t-right'),'right');
input.bindTouch(document.getElementById('t-jump'),'jump');
input.bindTouch(document.getElementById('t-run'),'run');
input.bindTouch(document.getElementById('t-down'),'down');
input.bindTouch(document.getElementById('t-pipe-hint'),'down');

function resize(){
  const w=canvasWrap.clientWidth;
  const h=canvasWrap.clientHeight;
  if(renderer && w && h) renderer.resize(w,h);
}
window.addEventListener('resize', resize);
resize();

if(!renderer){
  canvasWrap.innerHTML='<div style="padding:24px; color:#263B36">WebGL is unavailable in this browser. Try another browser to play.</div>';
}

// ---- overlays ----
function formatTime(seconds){
  return Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');
}

let overlayKey='';
function updateOverlay(state){
  // rewrite the card only when the visible content changes
  const key=state.state+'|'+state.score+'|'+state.coins+'|'+state.newBest;
  if(key===overlayKey) return;
  overlayKey=key;

  if(state.state==='title'){
    overlay.classList.remove('hidden');
    overlayTitle.textContent='Low Poly Mario';
    overlaySub.innerHTML='World 1-1 &bull; Run and jump to the castle<br><span style="opacity:.75;font-size:13px">Tip: look for the hidden block near the pipes</span>';
    overlayBtn.textContent='Play';
    overlayBtn.style.display='';
  } else if(state.state==='paused'){
    overlay.classList.remove('hidden');
    overlayTitle.textContent='Paused';
    overlaySub.textContent='Take a breather.';
    overlayBtn.textContent='Resume';
    overlayBtn.style.display='';
  } else if(state.state==='gameover'){
    overlay.classList.remove('hidden');
    overlayTitle.textContent='Game Over';
    overlaySub.textContent=`Score ${state.score} • Coins ${state.coins}`;
    overlayBtn.textContent='Try Again';
    overlayBtn.style.display='';
  } else if(state.state==='win'){
    overlay.classList.remove('hidden');
    const newBest = state.newBest ? ' • ★ NEW BEST' : '';
    overlayTitle.textContent='Course Clear!';
    overlaySub.innerHTML=`
      <div style="line-height:1.6; text-align:left; max-width:360px; margin:0 auto;">
        Score: <b>${state.score}</b><br>
        Time: <b>${formatTime(state.runTime)}</b><br>
        Coins: <b>${state.coins}</b> &bull; Secrets: <b>${state.secretsFound.size} / ${state.secretsTotal}</b><br>
        Enemies: <b>${state.stats.enemiesDefeated}</b> &bull; Flag: <b>${state.stats.flagBonus}</b> &bull; Time bonus: <b>${state.stats.timeBonus}</b> &bull; Fireworks: <b>${state.stats.fireworkBonus}</b><br>
        <span style="opacity:.8">Best Score: ${state.bestScore} &bull; Best Time: ${state.bestTime===Infinity?'—':formatTime(state.bestTime)}</span>${newBest}
      </div>`;
    overlayBtn.textContent='Play Again';
    overlayBtn.style.display='';
  } else {
    overlay.classList.add('hidden');
  }
}

overlayBtn.addEventListener('click', ()=>{
  Audio.initAudio();
  const st=sim.getState().state;
  if(st==='title') sim.forcePlay();
  else if(st==='paused'){ sim.resume(); input.clearAll(); }
  else if(st==='gameover' || st==='win') sim.resetRun(true);
});
canvas.addEventListener('click', ()=>{
  if(sim.getState().state==='title'){ sim.forcePlay(); Audio.initAudio(); }
});
muteBtn.addEventListener('click', ()=>{
  const m=Audio.toggleMute();
  muteBtn.textContent = m?'🔇':'🔊';
  muteBtn.setAttribute('aria-pressed', String(m));
});
pauseBtn.addEventListener('click', ()=>{
  const st=sim.getState().state;
  if(st==='play') sim.pause();
  else if(st==='paused') sim.resume();
  input.clearAll();
});
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){ sim.pause(); input.clearAll(); }
});

// ---- world popups: projected through the real camera so they sit on the action ----
function renderPopups(state){
  if(!renderer) return;
  popupLayer.textContent='';
  for(const p of state.popups){
    const pt=renderer.toScreen(p.x, p.y);
    const el=document.createElement('div');
    el.className='world-popup';
    el.textContent=p.text;
    el.style.left=pt.x+'px';
    el.style.top=pt.y+'px';
    el.style.opacity=String(Math.max(0, 1 - p.t/0.7));
    popupLayer.appendChild(el);
  }
}

// ---- fixed-step loop: simulation at CFG.fixedDt, rendering every animation frame ----
let acc=0, last=performance.now();
let simTime=0;

function frame(now){
  requestAnimationFrame(frame);
  const rawDt=Math.min(0.05, (now-last)/1000);
  last=now;

  acc+=rawDt;
  let steps=0;
  while(acc>=CFG.fixedDt && steps<8){
    sim.fixedUpdate(CFG.fixedDt, input);
    acc-=CFG.fixedDt;
    steps++;
  }
  if(steps===8) acc=0; // drop backlog instead of fast-forwarding
  simTime+=rawDt;

  const state=sim.getState();

  // HUD
  hudScore.textContent=String(state.score).padStart(6,'0');
  hudCoins.textContent=String(state.coins);
  hudWorld.textContent='1-1';
  hudTime.textContent=String(Math.max(0, Math.ceil(state.timeLeft))).padStart(3,'0');
  hudLives.textContent=String(state.lives);
  hudPower.textContent= state.mario.power==='small'?'SMALL': state.mario.power==='fire'?'FIRE':'BIG';
  hudPower.className='hud-val ' + (state.mario.star>0? 'power-star' : state.mario.power==='fire'?'power-fire':'');
  const progress = Math.min(1, Math.max(0, (state.mario.x - (-60)) / (148+60) ));
  progressBar.style.width=(progress*100)+'%';
  pauseBtn.textContent = state.state==='paused' ? '▶ Resume' : '⏸︎ Pause';

  // low time warning blink
  if(state.timeLeft<=100 && state.timeLeft>0 && Math.floor(simTime*4)%2===0) hudTime.classList.add('warn');
  else hudTime.classList.remove('warn');

  updateOverlay(state);
  if(renderer){
    renderer.renderFrame(state, simTime);
    renderPopups(state);
  }

  // inspection hooks for deterministic checks
  window.__game = window.__game||{};
  window.__game.state=state;
  window.__game.sim=sim;
  window.__game.api=sim.api;
}
requestAnimationFrame(frame);

window.LPM = {
  getState: ()=>sim.getState(),
  api: sim.api
};
