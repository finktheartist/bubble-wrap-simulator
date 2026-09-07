'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, AudioLines, Circle, Hand, HelpCircle, Maximize, MousePointer2, MoveUp, Pause, Play, RotateCcw, Settings2, Volume2, VolumeX, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { UseToolButton } from '@/components/game/use-tool-button';
import { ToolPicker } from '@/components/game/tool-picker';
import { Thumbstick, TouchLook } from '@/components/game/touch-controls';
import { touchLookDelta } from '@/lib/game/touch';
import type { BubbleGame, GameSettings, GameSnapshot } from '@/lib/game/game';

const TOOLS=[
  {name:'Fingertip',verb:'Click POP or press F',description:'One bubble at a time. Take it slow.'},
  {name:'Mallet',verb:'Click to smash',description:'A reassuringly excessive rubber mallet.'},
  {name:'Bat',verb:'Click to whack',description:'A wide swing. A very good crackle.'},
  {name:'Bowling ball',verb:'Hold & release to throw',description:'Seven kilos of excellent decisions.'},
  {name:'Pop blaster',verb:'Hold to shoot',description:'Little pellets. Rapid-fire satisfaction.'},
  {name:'Pop bomb',verb:'Click to throw',description:'A short fuse. A room-shaking ripple.'},
];
const INITIAL:GameSnapshot={ready:false,playing:false,started:false,tool:0,pops:0,total:0,combo:0,best:0,hint:'',target:false,charge:0,held:'',fps:60,error:'',pointerLocked:false,targets:0,impact:0};
const SETTINGS:GameSettings={volume:.65,sensitivity:1,shake:true,footsteps:true,muted:false,quality:'balanced'};
export default function Home() {
  const mount=useRef<HTMLDivElement>(null);
  const engine=useRef<BubbleGame|null>(null);
  const [state,setState]=useState(INITIAL);
  const [toolIcons,setToolIcons]=useState<string[]>([]);
  const [settings,setSettings]=useState(SETTINGS);
  const [panel,setPanel]=useState<'settings'|'help'|null>(null);
  const [touch,setTouch]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [notice,setNotice]=useState('');
  const [inventoryOpen,setInventoryOpen]=useState(false);
  const inventoryChange=(open:boolean)=>{setInventoryOpen(open);if(open)engine.current?.pause();else void engine.current?.start(touch);};
  useEffect(()=>{
    const toggle=(event:KeyboardEvent)=>{if(event.code!=='KeyT'||event.repeat||(!state.playing&&!inventoryOpen)||(event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]'))return;event.preventDefault();setInventoryOpen(!inventoryOpen);if(inventoryOpen)void engine.current?.start(touch);else engine.current?.pause();};
    window.addEventListener('keydown',toggle);return()=>window.removeEventListener('keydown',toggle);
  },[state.playing,inventoryOpen,touch]);
  useEffect(()=>{
    let disposed=false;
    const coarse=window.matchMedia('(any-pointer: coarse)');
    const deviceTouch=coarse.matches||navigator.maxTouchPoints>0;
    const updateTouch=()=>{const enabled=coarse.matches||navigator.maxTouchPoints>0;setTouch(enabled);engine.current?.setTouchEnabled(enabled);};
    coarse.addEventListener('change',updateTouch);
    let prefs=SETTINGS;
    try{const saved=JSON.parse(localStorage.getItem('bubble-wrap-settings')||'null');if(saved)prefs={...SETTINGS,...saved};else prefs={...SETTINGS,shake:!window.matchMedia('(prefers-reduced-motion: reduce)').matches};}catch{}
    import('@/lib/game/game').then(async({BubbleGame})=>{
      if(disposed||!mount.current)return;
      setTouch(deviceTouch);setSettings(prefs);
      const game=new BubbleGame(mount.current,setState,deviceTouch);engine.current=game;game.setSettings(prefs);await game.init();
      if(!disposed)setToolIcons(game.toolIcons);
    }).catch(error=>{console.error('Arena initialization failed',error);if(!disposed)setLoadError('The arena could not start. Try reloading in a browser with WebGL enabled.');});
    return()=>{disposed=true;coarse.removeEventListener('change',updateTouch);engine.current?.dispose();engine.current=null;};
  },[]);
  const changeSettings=(partial:Partial<GameSettings>)=>{
    const updated={...settings,...partial};setSettings(updated);engine.current?.setSettings(updated);
    try{localStorage.setItem('bubble-wrap-settings',JSON.stringify(updated));}catch{}
  };
  const start=()=>{setPanel(null);void engine.current?.start(touch);};
  const openPanel=(p:'settings'|'help')=>{engine.current?.pause();setPanel(p);};
  const reset=()=>{engine.current?.reset();setNotice('Fresh wrap. All yours.');window.setTimeout(()=>setNotice(''),2200);};
  const fullscreen=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else throw new Error('Unavailable');}catch{setNotice('Fullscreen is unavailable in this browser.');window.setTimeout(()=>setNotice(''),2400);}};
  const touchLook=(x:number,y:number)=>{const delta=touchLookDelta(x,y,mount.current?.clientWidth??390);engine.current?.look(delta.x,delta.y);};
  const error=loadError||state.error;
  return <main className={`simulator ${state.started?'has-started':''} ${state.playing?'is-playing':''} ${touch?'is-touch':''} ${inventoryOpen?'inventory-open':''}`}>
    <div className="world" ref={mount} aria-label="Three dimensional bubble wrap arena" />
    {!state.playing&&!state.started&&<div className="welcome-veil" />}
    <header className="topbar">
      <div className="wordmark"><span className="brand-mark" aria-hidden="true"><Circle/><Circle/><Circle/><Circle/><Circle/><Circle/><Circle/><Circle/><Circle/></span><span>bubble wrap<small>SIMULATOR</small></span></div>
      <div className="top-controls">
        {state.started&&<div className="pop-counter"><span className="counter-label">BUBBLES POPPED</span><strong>{state.pops.toLocaleString().padStart(5,'0')}</strong><span className="target-score"><b>{state.targets}</b> MOVING TARGETS</span></div>}
        <div className="utility-buttons">
          {state.playing&&!touch&&<button aria-label={state.pointerLocked?'Release mouse (L)':'Enable mouse look (L)'} title={state.pointerLocked?'Release mouse · L':'Optional mouse look · L'} onClick={()=>void engine.current?.toggleMouseLook()}><MousePointer2/></button>}
          <button aria-label={settings.muted?'Turn sound on':'Mute sound'} title={settings.muted?'Sound off':'Sound on'} onClick={()=>changeSettings({muted:!settings.muted})}>{settings.muted?<VolumeX/>:<Volume2/>}</button>
          <button aria-label="Settings" title="Settings" onClick={()=>openPanel('settings')}><Settings2/></button>
          <button aria-label="Controls" title="Controls" onClick={()=>openPanel('help')}><HelpCircle/></button>
          {state.started&&<button aria-label={state.playing?'Pause game':'Resume game'} title="Pause / resume" onClick={()=>state.playing?engine.current?.pause():start()}>{state.playing?<Pause/>:<Play/>}</button>}
        </div>
      </div>
    </header>
    {!state.started&&<section className="welcome">
      <span className="eyebrow">NO OBJECTIVES. JUST POPS.</span>
      <h1>Bubble Wrap<br/>Simulator.</h1>
      <p>A whole room of bubble wrap.<br/>Go ahead. Get carried away.</p>
      <button className="enter-button" onClick={start} disabled={!state.ready||Boolean(error)}>{error?'Arena unavailable':state.ready?'Enter the arena':'Inflating the arena…'}{state.ready&&!error&&<ArrowUpRight size={21}/>}</button>
      <span className="welcome-note"><AudioLines size={15}/> Sound on. Stress off.</span>
      <div className="welcome-controls">{touch?'Left thumb to move · Right thumb to look':<><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>move</span><span className="control-dot">·</span><span>Right-drag to look</span></>}</div>
      {touch&&<span className="orientation-note">Plays upright or sideways.</span>}
      {error&&<p role="alert" className="error-message">{error}<button onClick={()=>window.location.reload()}>Reload arena</button></p>}
    </section>}
    {!state.started&&<div className="intro-footer"><span className="arena-tag">THE POP PLAYGROUND <span>001</span></span><span>{state.ready?`${state.total.toLocaleString()} bubbles. Entirely unnecessary.`:'Making room for a little satisfaction.'}</span></div>}
    {state.started&&!state.playing&&!inventoryOpen&&!panel&&!error&&<div className="pause-layer"><section className="pause-card"><span className="eyebrow">PAUSED</span><h2>Take a breather.</h2><p>{state.pops.toLocaleString()} bubbles popped.<br/>The rest can wait.</p><button className="enter-button" onClick={start}>Back to popping <Play size={18}/></button><button className="text-button" onClick={reset}><RotateCcw size={15}/> Fresh wrap</button><span className="pause-tip">{touch?'Drag on the right to look around.':'Press Esc any time to release your mouse.'}</span></section></div>}
    {state.started&&error&&<div className="pause-layer"><section className="pause-card"><h2>A small snag.</h2><p role="alert">{error}</p><button className="enter-button" onClick={()=>window.location.reload()}>Reload arena</button></section></div>}
    {state.playing&&<>
      <div className={`reticle ${state.target?'has-target':''} ${state.charge?'is-charging':''}`}><span/><i/></div>
      <div className="hit-marker" style={{opacity:state.impact}} aria-hidden="true"><i/><i/><i/><i/></div>
      <div className="aim-caption"><span>{state.hint}</span>{state.charge>0&&<div className="charge-track"><div style={{width:`${state.charge*100}%`}}/></div>}</div>
      {state.combo>=3&&<div className="combo-counter"><strong key={Math.floor(state.combo/10)}>{state.combo}<span> POPS</span></strong><small>{state.combo>120?'ABSOLUTELY UNNECESSARY':state.combo>40?'THAT’S THE STUFF':state.combo>12?'KEEP IT GOING':'A NICE LITTLE CRACKLE'}</small></div>}
      <div className="session-stats"><span className="live-dot"/> FREE PLAY <span>BEST STREAK <b>{state.best}</b></span></div>
      {touch&&<>
        <TouchLook onLook={touchLook} onTap={()=>engine.current?.tapTool()}/>
        <Thumbstick onMove={(x,y)=>engine.current?.setTouchMove(x,y)}/>
        <span className="touch-look-hint">TAP TO USE · DRAG TO LOOK</span>
      </>}
      {!touch&&<span className="look-instruction">{state.pointerLocked?'Mouse look on · L releases your cursor':'Right-drag to look · L enables mouse look'}</span>}
    </>}
    {(state.playing||inventoryOpen)&&<div className="action-dock">
      <ToolPicker open={inventoryOpen} onOpenChange={inventoryChange} tool={state.tool} icons={toolIcons} items={TOOLS} touch={touch} onSelect={i=>{engine.current?.selectTool(i);inventoryChange(false);}}/>
      <UseToolButton key={`${state.tool}-${Boolean(state.held)}`} tool={state.tool} held={Boolean(state.held)} touch={touch} onDown={()=>engine.current?.actionDown()} onUp={()=>engine.current?.actionUp()} onCancel={()=>engine.current?.actionCancel()} onLook={touchLook} onTap={()=>engine.current?.tapTool()}/>
      <div className="action-extras"><button onClick={()=>engine.current?.grab()}><Hand size={17}/>{state.held?'Drop':'Grab'}<kbd>E</kbd></button>{touch&&<button aria-label="Jump" onClick={()=>engine.current?.jump()}><MoveUp size={18}/><span>Jump</span></button>}</div>
    </div>}
    {state.playing&&!touch&&<footer className="game-footer"><span><kbd>WASD</kbd> move <kbd>SPACE</kbd> jump <kbd>SHIFT</kbd> run</span><span><kbd>F</kbd> use tool <kbd>T</kbd> tools <kbd>E</kbd> grab / drop <kbd>R</kbd> fresh wrap <kbd>ESC</kbd> pause</span></footer>}
    {notice&&<output className="notice">{notice}</output>}
    <Dialog open={panel!==null} onOpenChange={open=>{if(!open)setPanel(null);}}>
      <DialogContent className="settings-dialog">
        <DialogTitle>{panel==='settings'?'Make yourself comfortable.':'A very simple kind of fun.'}</DialogTitle>
        <DialogDescription>{panel==='settings'?'Tune the feel of your playground.':'Everything you need to make a little noise.'}</DialogDescription>
        {panel==='settings'?<div className="settings-list">
          <div className="setting-range"><label id="volume-label">Pop volume <span>{Math.round(settings.volume*100)}%</span></label><Slider aria-labelledby="volume-label" value={[settings.volume]} min={0} max={1} step={.01} onValueChange={v=>changeSettings({volume:Array.isArray(v)?v[0]:v})}/></div>
          <button className="secondary-button" onClick={()=>void engine.current?.previewPop()}><Volume2 size={17}/> Test the new pop</button>
          <div className="setting-range"><label id="sensitivity-label">Look sensitivity <span>{settings.sensitivity.toFixed(1)}×</span></label><Slider aria-labelledby="sensitivity-label" value={[settings.sensitivity]} min={.3} max={2.5} step={.1} onValueChange={v=>changeSettings({sensitivity:Array.isArray(v)?v[0]:v})}/></div>
          <div className="setting-row"><label htmlFor="shake">Camera shake<small>A little weight behind each impact</small></label><Switch id="shake" checked={settings.shake} onCheckedChange={v=>changeSettings({shake:v})}/></div>
          <div className="setting-row"><label htmlFor="steps">Pop as you walk<small>Every step deserves a tiny crackle</small></label><Switch id="steps" checked={settings.footsteps} onCheckedChange={v=>changeSettings({footsteps:v})}/></div>
          <div className="setting-row"><label htmlFor="quality">Extra detail<small>{touch?'Sharper reflections. Uses more battery.':'Sharper reflections and cast shadows'}</small></label><Switch id="quality" checked={settings.quality==='high'} onCheckedChange={v=>changeSettings({quality:v?'high':'balanced'})}/></div>
          <button className="secondary-button" onClick={()=>setPanel('help')}><HelpCircle size={17}/> View controls</button>
          <button className="secondary-button" onClick={fullscreen}><Maximize size={17}/> Toggle fullscreen</button>
        </div>:<div className="control-list">
          <p><span>Move / look</span><b>{touch?'Left stick / drag the arena':'WASD / right-drag'}</b></p><p><span>{touch?'Jump':'Jump / run'}</span><b>{touch?'Jump button':'Space / Shift'}</b></p><p><span>Use your tool</span><b>{touch?'Tap the arena or use the action button':'Action button / F / left mouse'}</b></p>{touch&&<p><span>Aim while using a tool</span><b>Drag on the action button</b></p>}<p><span>Grab / drop a loose item</span><b>{touch?'Grab button':'Grab button / E'}</b></p><p><span>Throw a ball or held item</span><b>Hold, then release</b></p><p><span>Switch tools</span><b>{touch?'Tap the equipped tool':'Equipped tool / T / 1–6 / scroll'}</b></p><p><span>Reinflate the whole room</span><b>{touch?'Fresh wrap in pause':'R'}</b></p><p><span>Pause / release mouse</span><b>{touch?'Pause button':'Esc'}</b></p>
        </div>}
        <button className="enter-button dialog-done" onClick={()=>setPanel(null)}>All good <X size={16}/></button>
      </DialogContent>
    </Dialog>
  </main>;
}
