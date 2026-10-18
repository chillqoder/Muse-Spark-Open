export function createInput(){
  const keys={};
  const touchState={left:false,right:false,jump:false,run:false,down:false};
  const pressed=new Set();
  const justPressed=new Set();

  const map={
    'arrowleft':'left','a':'left',
    'arrowright':'right','d':'right',
    ' ':'jump','w':'jump','arrowup':'jump',
    'shift':'run','x':'run',
    's':'down','arrowdown':'down',
    'p':'pause','escape':'pause',
    'r':'restart','enter':'enter'
  };

  function onDown(e){
    const k=e.key.toLowerCase();
    const m=map[k];
    if(!m) return;
    if(['jump','pause','restart','enter','run','left','right','down'].includes(m)) e.preventDefault();
    if(!keys[m]){
      keys[m]=true;
      justPressed.add(m);
      pressed.add(m);
    } else keys[m]=true;
  }
  function onUp(e){
    const k=e.key.toLowerCase();
    const m=map[k];
    if(m) { keys[m]=false; pressed.delete(m); }
  }
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', clearAll);
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) clearAll(); });

  function clearAll(){
    for(const k in keys) keys[k]=false;
    justPressed.clear(); pressed.clear();
    touchState.left=touchState.right=touchState.jump=touchState.run=touchState.down=false;
  }

  function getAxis(){
    let a=0;
    if(keys.left||touchState.left) a-=1;
    if(keys.right||touchState.right) a+=1;
    return a;
  }
  function isHeld(name){ return !!keys[name] || !!touchState[name]; }
  function consumeJust(name){
    if(justPressed.has(name)){ justPressed.delete(name); return true; }
    return false;
  }
  function consumePressed(name){
    if(justPressed.has(name)||pressed.has(name)){ justPressed.delete(name); pressed.delete(name); return true; }
    return false;
  }

  function bindTouch(btn, name){
    if(!btn) return;
    const set=(v,e)=>{ e.preventDefault(); touchState[name]=v; if(v) { justPressed.add(name); pressed.add(name); } };
    btn.addEventListener('touchstart', e=>set(true,e), {passive:false});
    btn.addEventListener('touchend', e=>set(false,e), {passive:false});
    btn.addEventListener('touchcancel', e=>set(false,e), {passive:false});
    btn.addEventListener('mousedown', e=>set(true,e));
    btn.addEventListener('mouseup', e=>set(false,e));
    btn.addEventListener('mouseleave', e=>set(false,e));
  }

  return { keys, touchState, getAxis, isHeld, consumeJust, consumePressed, bindTouch, clearAll, justPressed };
}
