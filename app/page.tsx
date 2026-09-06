'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowUpRight, AudioLines, Bomb, Circle, Crosshair, Hand, Hammer, HelpCircle, Maximize, MoveUp, Pause, Play, RotateCcw, Settings2, Volume2, VolumeX, X, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import type { BubbleGame, GameSettings, GameSnapshot } from '@/lib/game/game';

const TOOLS=[
  {name:'Fingertip',icon:Hand,verb:'Hold to pop',description:'One bubble at a time. Take it slow.'},
  {name:'Mallet',icon:Hammer,verb:'Click to smash',description:'A reassuringly excessive rubber mallet.'},
  {name:'Bat',icon:Zap,verb:'Click to whack',description:'A wide swing. A very good crackle.'},
  {name:'Bowling ball',icon:Circle,verb:'Hold & release to throw',description:'Seven kilos of excellent decisions.'},
  {name:'Pop blaster',icon:Crosshair,verb:'Hold to shoot',description:'Little pellets. Rapid-fire satisfaction.'},
  {name:'Pop bomb',icon:Bomb,verb:'Click to throw',description:'A short fuse. A room-shaking ripple.'},
];
const INITIAL:GameSnapshot={ready:false,playing:false,started:false,tool:0,pops:0,total:0,combo:0,best:0,hint:'',target:false,charge:0,held:'',fps:60,error:''};
const SETTINGS:GameSettings={volume:.65,sensitivity:1,shake:true,footsteps:true,muted:false,quality:'balanced'};
export default function Home() {
  const mount=useRef<HTMLDivElement>(null);
  const engine=useRef<BubbleGame|null>(null);
  const [state,setState]=useState(INITIAL);
  const [settings,setSettings]=useState(SETTINGS);
  const [panel,setPanel]=useState<'settings'|'help'|null>(null);
  const [touch,setTouch]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [notice,setNotice]=useState('');
  const lookRef=useRef<{x:number;y:number}|null>(null);
  useEffect(()=>{
    let disposed=false;
    let prefs=SETTINGS;
    try{const saved=JSON.parse(localStorage.getItem('bubble-wrap-settings')||'null');if(saved)prefs={...SETTINGS,...saved};else prefs={...SETTINGS,shake:!window.matchMedia('(prefers-reduced-motion: reduce)').matches};}catch{}
    import('@/lib/game/game').then(async({BubbleGame})=>{
      if(disposed||!mount.current)return;
      setTouch(window.matchMedia('(pointer: coarse)').matches);setSettings(prefs);
      const game=new BubbleGame(mount.current,setState);engine.current=game;game.setSettings(prefs);await game.init();
    }).catch(error=>{console.error('Arena initialization failed',error);if(!disposed)setLoadError('The arena could not start. Try reloading in a browser with WebGL enabled.');});
    return()=>{disposed=true;engine.current?.dispose();engine.current=null;};
  },[]);
  const changeSettings=(partial:Partial<GameSettings>)=>{
    const updated={...settings,...partial};setSettings(updated);engine.current?.setSettings(updated);
    try{localStorage.setItem('bubble-wrap-settings',JSON.stringify(updated));}catch{}
  };
  const start=()=>{setPanel(null);void engine.current?.start(touch);};
  const openPanel=(p:'settings'|'help')=>{engine.current?.pause();setPanel(p);};
  const reset=()=>{engine.current?.reset();setNotice('Fresh wrap. All yours.');window.setTimeout(()=>setNotice(''),2200);};
  const fullscreen=()=>{if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen().catch(()=>{setNotice('Fullscreen is unavailable in this browser.');window.setTimeout(()=>setNotice(''),2400);});};
  const tool=TOOLS[state.tool];
  const error=loadError||state.error;
  return <main className={`simulator ${state.playing?'is-playing':''} ${touch?'is-touch':''}`}>
    <div className="world" ref={mount} aria-label="Three dimensional bubble wrap arena" />
    {!state.playing&&!state.started&&<div className="welcome-veil" />}
    <header className="topbar">
      <div className="wordmark"><span className="brand-mark" aria-hidden="true"><Circle/><Circle/><Circle/><Circle/><Circle/><Circle/><Circle/><Circle/><Circle/></span><span>bubble wrap<small>SIMULATOR</small></span></div>
      <div className="top-controls">
        {state.started&&<div className="pop-counter"><span className="counter-label">BUBBLES POPPED</span><strong>{state.pops.toLocaleString().padStart(5,'0')}</strong><span className="counter-total">/ {state.total.toLocaleString()}</span></div>}
        <div className="utility-buttons">
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
      <div className="welcome-controls">{touch?'Drag to look · Thumbstick to move':<><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>move</span><span className="control-dot">·</span><span>Mouse to look</span></>}</div>
      {error&&<p role="alert" className="error-message">{error}<button onClick={()=>window.location.reload()}>Reload arena</button></p>}
    </section>}
    {!state.started&&<div className="intro-footer"><span className="arena-tag">THE POP PLAYGROUND <span>001</span></span><span>{state.ready?`${state.total.toLocaleString()} bubbles. Entirely unnecessary.`:'Making room for a little satisfaction.'}</span></div>}
    {state.started&&!state.playing&&!panel&&!error&&<div className="pause-layer"><section className="pause-card"><span className="eyebrow">PAUSED</span><h2>Take a breather.</h2><p>{state.pops.toLocaleString()} bubbles popped.<br/>The rest can wait.</p><button className="enter-button" onClick={start}>Back to popping <Play size={18}/></button><button className="text-button" onClick={reset}><RotateCcw size={15}/> Fresh wrap</button><span className="pause-tip">{touch?'Drag on the right to look around.':'Press Esc any time to release your mouse.'}</span></section></div>}
    {state.started&&error&&<div className="pause-layer"><section className="pause-card"><h2>A small snag.</h2><p role="alert">{error}</p><button className="enter-button" onClick={()=>window.location.reload()}>Reload arena</button></section></div>}
    {state.playing&&<>
      <div className={`reticle ${state.target?'has-target':''} ${state.charge?'is-charging':''}`}><span/><i/></div>
      <div className="aim-caption"><span>{state.hint}</span>{state.charge>0&&<div className="charge-track"><div style={{width:`${state.charge*100}%`}}/></div>}</div>
      {state.combo>=3&&<div className="combo-counter"><strong key={Math.floor(state.combo/10)}>{state.combo}<span> POPS</span></strong><small>{state.combo>120?'ABSOLUTELY UNNECESSARY':state.combo>40?'THAT’S THE STUFF':state.combo>12?'KEEP IT GOING':'A NICE LITTLE CRACKLE'}</small></div>}
      <div className="session-stats"><span className="live-dot"/> FREE PLAY <span>BEST STREAK <b>{state.best}</b></span></div>
      {touch&&<>
        <div className="touch-look" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);lookRef.current={x:e.clientX,y:e.clientY};}} onPointerMove={e=>{if(!lookRef.current)return;engine.current?.look((e.clientX-lookRef.current.x)*1.6,(e.clientY-lookRef.current.y)*1.6);lookRef.current={x:e.clientX,y:e.clientY};}} onPointerUp={()=>{lookRef.current=null;}} onPointerCancel={()=>{lookRef.current=null;}} />
        <Thumbstick onMove={(x,y)=>engine.current?.setTouchMove(x,y)}/>
        <div className="touch-actions"><button aria-label="Jump" onPointerDown={e=>{e.preventDefault();engine.current?.jump();}}><MoveUp/></button><button aria-label={state.held?'Drop object':'Grab object'} onClick={()=>engine.current?.grab()}><Hand/></button><button className="touch-fire" onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);engine.current?.actionDown();}} onPointerUp={()=>engine.current?.actionUp()} onPointerCancel={()=>engine.current?.actionUp()}>{state.held?'THROW':state.tool===0?'POP':state.tool===3?'THROW':state.tool===4?'FIRE':state.tool===5?'BOOM':'WHACK'}</button></div>
      </>}
    </>}
    {state.started&&<div className={`tool-area ${state.playing?'':'tool-area-paused'}`}>
      <div className="tool-description"><strong>{state.held||tool.name}</strong><span>{state.held?'Hold to build power. Release to throw.':tool.description}</span></div>
      <nav className="toolbelt" aria-label="Choose a tool">{TOOLS.map((t,i)=>{const Icon=t.icon;return <button key={t.name} aria-label={`${i+1}: ${t.name}`} aria-pressed={state.tool===i} onClick={()=>engine.current?.selectTool(i)} className={state.tool===i?'selected':''}><kbd>{i+1}</kbd><Icon strokeWidth={1.7}/><span>{t.name}</span></button>;})}</nav>
    </div>}
    {state.playing&&!touch&&<footer className="game-footer"><span><kbd>WASD</kbd> move <kbd>SPACE</kbd> jump <kbd>SHIFT</kbd> run</span><span><kbd>E</kbd> grab / drop <kbd>R</kbd> fresh wrap <kbd>ESC</kbd> pause</span></footer>}
    {notice&&<output className="notice">{notice}</output>}
    <Dialog open={panel!==null} onOpenChange={open=>{if(!open)setPanel(null);}}>
      <DialogContent className="settings-dialog">
        <DialogTitle>{panel==='settings'?'Make yourself comfortable.':'A very simple kind of fun.'}</DialogTitle>
        <DialogDescription>{panel==='settings'?'Tune the feel of your playground.':'Everything you need to make a little noise.'}</DialogDescription>
        {panel==='settings'?<div className="settings-list">
          <div className="setting-range"><label id="volume-label">Pop volume <span>{Math.round(settings.volume*100)}%</span></label><Slider aria-labelledby="volume-label" value={[settings.volume]} min={0} max={1} step={.01} onValueChange={v=>changeSettings({volume:Array.isArray(v)?v[0]:v})}/></div>
          <div className="setting-range"><label id="sensitivity-label">Look sensitivity <span>{settings.sensitivity.toFixed(1)}×</span></label><Slider aria-labelledby="sensitivity-label" value={[settings.sensitivity]} min={.3} max={2.5} step={.1} onValueChange={v=>changeSettings({sensitivity:Array.isArray(v)?v[0]:v})}/></div>
          <div className="setting-row"><label htmlFor="shake">Camera shake<small>A little weight behind each impact</small></label><Switch id="shake" checked={settings.shake} onCheckedChange={v=>changeSettings({shake:v})}/></div>
          <div className="setting-row"><label htmlFor="steps">Pop as you walk<small>Every step deserves a tiny crackle</small></label><Switch id="steps" checked={settings.footsteps} onCheckedChange={v=>changeSettings({footsteps:v})}/></div>
          <div className="setting-row"><label htmlFor="quality">Extra detail<small>Sharper reflections and cast shadows</small></label><Switch id="quality" checked={settings.quality==='high'} onCheckedChange={v=>changeSettings({quality:v?'high':'balanced'})}/></div>
          <button className="secondary-button" onClick={fullscreen}><Maximize size={17}/> Toggle fullscreen</button>
        </div>:<div className="control-list">
          <p><span>Move / look</span><b>{touch?'Thumbstick / drag':'WASD / mouse'}</b></p><p><span>Jump / run</span><b>{touch?'↑ button':'Space / Shift'}</b></p><p><span>Use your tool</span><b>{touch?'Action button':'Left mouse'}</b></p><p><span>Grab / drop a loose item</span><b>{touch?'Hand button':'E or right mouse'}</b></p><p><span>Throw a ball or held item</span><b>Hold, then release</b></p><p><span>Switch tools</span><b>{touch?'Tool belt':'1–6 or scroll'}</b></p><p><span>Reinflate the whole room</span><b>{touch?'Fresh wrap in pause':'R'}</b></p><p><span>Pause / release mouse</span><b>{touch?'Pause button':'Esc'}</b></p>
        </div>}
        <button className="enter-button dialog-done" onClick={()=>setPanel(null)}>All good <X size={16}/></button>
      </DialogContent>
    </Dialog>
  </main>;
}
function Thumbstick({onMove}:{onMove:(x:number,y:number)=>void}) {
  const [offset,setOffset]=useState({x:0,y:0});
  const active=useRef(false);
  const update=(e:PointerEvent<HTMLDivElement>)=>{const r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,m=Math.max(38,Math.hypot(x,y));const p={x:x/m*38,y:y/m*38};setOffset(p);onMove(p.x/38,p.y/38);};
  const stop=()=>{active.current=false;setOffset({x:0,y:0});onMove(0,0);};
  return <div className="thumbstick" aria-label="Movement thumbstick" onPointerDown={e=>{e.preventDefault();active.current=true;e.currentTarget.setPointerCapture(e.pointerId);update(e);}} onPointerMove={e=>{if(active.current)update(e);}} onPointerUp={stop} onPointerCancel={stop}><span style={{transform:`translate(${offset.x}px,${offset.y}px)`}}/></div>;
}
