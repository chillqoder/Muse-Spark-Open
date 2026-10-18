let ctx=null, masterGain=null, musicGain=null, sfxGain=null;
let muted=false, hurry=false;
let musicTimer=null, currentTheme='overworld';
let seqPos=0, seqTimer=0, musicBpm=128;

function ensureCtx(){
  if(ctx) return;
  try{
    ctx = new (window.AudioContext||window.webkitAudioContext)();
    masterGain = ctx.createGain(); masterGain.gain.value=0.45; masterGain.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value=0.32; musicGain.connect(masterGain);
    sfxGain = ctx.createGain(); sfxGain.gain.value=0.55; sfxGain.connect(masterGain);
  }catch(e){ ctx=null; }
}
export function initAudio(){ ensureCtx(); if(ctx && ctx.state==='suspended') ctx.resume(); }
export function isMuted(){ return muted; }
export function toggleMute(){
  muted=!muted;
  if(masterGain) masterGain.gain.value = muted?0:0.45;
  if(muted) stopMusic(); else playTheme(currentTheme);
  return muted;
}
// pause/hidden: stop the note loop entirely so nothing is queued while silent
export function silenceMusic(){ stopMusic(); if(musicGain) musicGain.gain.value=0; }
export function unsilenceMusic(){
  if(musicGain) musicGain.gain.value = muted?0:0.32;
  if(!muted) playTheme(currentTheme);
}

function tone(freq, dur, type='square', vol=0.4, dest, slideTo){
  if(!ctx || muted) return;
  const o=ctx.createOscillator(), g=ctx.createGain();
  o.type=type; o.frequency.value=freq;
  o.connect(g); g.connect(dest||sfxGain);
  const t=ctx.currentTime;
  g.gain.setValueAtTime(vol,t);
  g.gain.linearRampToValueAtTime(0, t+dur);
  if(slideTo) o.frequency.linearRampToValueAtTime(slideTo, t+dur);
  o.start(t); o.stop(t+dur+0.02);
}

export function sfxJump(){ initAudio(); tone(420,0.12,'square',0.35); setTimeout(()=>tone(620,0.08,'square',0.25),60); }
export function sfxCoin(){ initAudio(); tone(880,0.08,'square',0.3); setTimeout(()=>tone(1320,0.12,'square',0.3),70); }
export function sfxBump(){ initAudio(); tone(180,0.08,'square',0.3); }
export function sfxBreak(){ initAudio(); tone(120,0.15,'square',0.4); tone(220,0.12,'square',0.3); }
export function sfxStomp(){ initAudio(); tone(200,0.06,'square',0.3); setTimeout(()=>tone(400,0.06,'square',0.25),50); }
export function sfxPowerup(){ initAudio(); const seq=[262,330,392,523]; seq.forEach((f,i)=>setTimeout(()=>tone(f,0.12,'square',0.35),i*90)); }
export function sfx1up(){ initAudio(); const seq=[392,523,659,784,659,784,1046]; seq.forEach((f,i)=>setTimeout(()=>tone(f,0.11,'square',0.35),i*85)); }
export function sfxFireball(){ initAudio(); tone(800,0.06,'square',0.25); }
export function sfxHit(){ initAudio(); tone(150,0.18,'sawtooth',0.35); }
export function sfxDie(){ initAudio(); const seq=[400,350,300,250,200,150,100]; seq.forEach((f,i)=>setTimeout(()=>tone(f,0.09,'square',0.3),i*110)); }
export function sfxFlag(){ initAudio(); const seq=[262,294,330,349,392,440,494,523]; seq.forEach((f,i)=>setTimeout(()=>tone(f,0.12,'square',0.3),i*100)); }
export function sfxTimeTick(){ initAudio(); tone(900,0.04,'square',0.2); }
export function sfxFirework(){ initAudio(); tone(600,0.12,'square',0.3); setTimeout(()=>tone(900,0.08,'square',0.25),80); setTimeout(()=>tone(1200,0.06,'square',0.2),140); }
export function sfxPipe(){ initAudio(); tone(300,0.4,'sine',0.3, null, 150); }
export function sfxPause(){ initAudio(); tone(500,0.08,'square',0.25); }

// Music themes: simple arpeggiated melodies
const THEMES = {
  overworld: {
    notes: [262,262,262,196,262,330,392, 196,262,330,392,330,262, 262,262,196,262,330,392, 330,262,294,262],
    bpm: 140
  },
  hurry: {
    notes: [262,262,262,196,262,330,392, 196,262,330,392,330,262, 262,262,196,262,330,392, 330,262,294,262],
    bpm: 185
  },
  cellar: {
    notes: [196,220,196,247,220,196,165,196, 196,220,196,247,220,196,165,196],
    bpm: 110
  },
  star: {
    notes: [523,659,784,1046,784,659,523,659, 523,659,784,1046,784,659,523,392],
    bpm: 190
  },
  death: {
    notes: [200,180,160,140,120,100],
    bpm: 90
  }
};

export function playTheme(name){
  currentTheme=name;
  if(muted) return;
  stopMusic();
  ensureCtx(); if(!ctx) return;
  const theme = THEMES[name]||THEMES.overworld;
  musicBpm = theme.bpm;
  seqPos=0;
  const beatDur = 60/musicBpm * 0.5; // eighth notes
  function tick(){
    if(muted || !musicGain || musicGain.gain.value===0){ musicTimer=null; return; }
    const n = theme.notes[seqPos % theme.notes.length];
    // play note
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type='square'; o.frequency.value=n;
    // simple low-pass via frequency
    o.connect(g); g.connect(musicGain);
    const t=ctx.currentTime;
    g.gain.setValueAtTime(0.18,t);
    g.gain.linearRampToValueAtTime(0,t+beatDur*0.85);
    o.start(t); o.stop(t+beatDur);
    seqPos++;
    musicTimer = setTimeout(tick, beatDur*1000);
  }
  // slight delay to avoid backlog
  musicTimer = setTimeout(tick, 60);
}
export function stopMusic(){
  if(musicTimer){ clearTimeout(musicTimer); musicTimer=null; }
}
export function setHurry(on){
  if(on===hurry) return;
  hurry=on;
  if(on) playTheme('hurry'); else if(currentTheme!=='star' && currentTheme!=='cellar') playTheme('overworld');
}
