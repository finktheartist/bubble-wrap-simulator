'use client';
import { useEffect, useRef } from 'react';
import { TouchGesture } from '../../lib/game/touch';

const ACTIONS=['POP','SMASH','WHACK','THROW','FIRE','THROW BOMB'];
export function UseToolButton({tool,held,onDown,onUp,onTap,onCancel,onLook,touch=false}:{tool:number;held:boolean;onDown:()=>void;onUp:()=>void;onTap:()=>void;onCancel?:()=>void;onLook?:(x:number,y:number)=>void;touch?:boolean}) {
  const pressed=useRef(false);
  const gesture=useRef(new TouchGesture());
  const cancelRef=useRef(onCancel??onUp);
  useEffect(()=>{cancelRef.current=onCancel??onUp;},[onCancel,onUp]);
  useEffect(()=>()=>{if(pressed.current)cancelRef.current();},[]);
  const down=()=>{if(!pressed.current){pressed.current=true;onDown();}};
  const up=()=>{if(pressed.current){pressed.current=false;onUp();}};
  const cancel=()=>{gesture.current.reset();if(pressed.current){pressed.current=false;cancelRef.current();}};
  const charged=held||tool===3;
  return <button
    type="button"
    className="use-tool-button"
    aria-label={`Use tool: ${held?'throw held item':ACTIONS[tool].toLowerCase()}`}
    onPointerDown={event=>{if(event.button!==0||!gesture.current.start(event.pointerId,event.clientX,event.clientY))return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);down();}}
    onPointerMove={event=>{const delta=gesture.current.move(event.pointerId,event.clientX,event.clientY);if(delta&&event.pointerType!=='mouse')onLook?.(delta.x,delta.y);}}
    onPointerUp={event=>{if(gesture.current.end(event.pointerId))up();}}
    onPointerCancel={event=>{if(gesture.current.end(event.pointerId))cancel();}}
    onLostPointerCapture={event=>{if(gesture.current.end(event.pointerId))cancel();}}
    onKeyDown={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();down();}}}
    onKeyUp={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();up();}}}
    onBlur={cancel}
    onContextMenu={event=>event.preventDefault()}
    onClick={event=>{if(event.detail===0&&!pressed.current)onTap();}}
  ><strong>{held?'THROW':ACTIONS[tool]}</strong><span>{charged?'Hold, then release':tool===5?(touch?'Tap to throw':'Click to throw'):(touch?'Tap or hold':'Click or hold')} <kbd>F</kbd></span></button>;
}
