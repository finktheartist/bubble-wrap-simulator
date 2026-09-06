'use client';
import { useRef } from 'react';

const ACTIONS=['POP','SMASH','WHACK','THROW','FIRE','THROW BOMB'];
export function UseToolButton({tool,held,onDown,onUp,onTap}:{tool:number;held:boolean;onDown:()=>void;onUp:()=>void;onTap:()=>void}) {
  const pressed=useRef(false);
  const down=()=>{if(!pressed.current){pressed.current=true;onDown();}};
  const up=()=>{if(pressed.current){pressed.current=false;onUp();}};
  const charged=held||tool===3;
  return <button
    type="button"
    className="use-tool-button"
    aria-label={`Use tool: ${held?'throw held item':ACTIONS[tool].toLowerCase()}`}
    onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);down();}}
    onPointerUp={up}
    onPointerCancel={up}
    onLostPointerCapture={up}
    onKeyDown={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();down();}}}
    onKeyUp={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();up();}}}
    onBlur={up}
    onClick={event=>{if(event.detail===0&&!pressed.current)onTap();}}
  ><strong>{held?'THROW':ACTIONS[tool]}</strong><span>{charged?'Hold, then release':tool===5?'Click to throw':'Click or hold'} <kbd>F</kbd></span></button>;
}
