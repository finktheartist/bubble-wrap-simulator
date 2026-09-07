'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { TouchGesture, thumbstickVector } from '../../lib/game/touch';

export function TouchLook({ onLook, onTap }: { onLook: (x: number, y: number) => void; onTap:()=>void }) {
  const gesture = useRef(new TouchGesture());
  const stop = (event: PointerEvent) => { gesture.current.end(event.pointerId); };
  return <div className="touch-look" aria-label="Drag to look around"
    onPointerDown={event => {
      if(event.button!==0)return;
      if (gesture.current.start(event.pointerId, event.clientX, event.clientY)) {
        event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      }
    }}
    onPointerMove={event => {
      const delta = gesture.current.move(event.pointerId, event.clientX, event.clientY);
      if (delta) onLook(delta.x, delta.y);
    }}
    onPointerUp={event=>{if(gesture.current.finishTap(event.pointerId,event.clientX,event.clientY))onTap();}} onPointerCancel={stop} onLostPointerCapture={stop}
    onContextMenu={event => event.preventDefault()}
  />;
}

export function Thumbstick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const gesture = useRef(new TouchGesture());
  const knob = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);
  const onMoveRef = useRef(onMove);
  useEffect(() => { onMoveRef.current = onMove; }, [onMove]);
  useEffect(() => () => onMoveRef.current(0, 0), []);
  const update = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const vector = thumbstickVector(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2, rect.width * .30);
    if (knob.current) knob.current.style.transform = `translate(${vector.knobX}px, ${vector.knobY}px)`;
    onMove(vector.x, vector.y);
  };
  const stop = (event: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current.end(event.pointerId)) return;
    setActive(false); if (knob.current) knob.current.style.transform = '';
    onMove(0, 0);
  };
  return <div className={`thumbstick ${active ? 'is-active' : ''}`} aria-label="Movement thumbstick"
    onPointerDown={event => {
      if (!gesture.current.start(event.pointerId, event.clientX, event.clientY)) return;
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setActive(true); update(event);
    }}
    onPointerMove={event => { if (gesture.current.move(event.pointerId, event.clientX, event.clientY)) update(event); }}
    onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
    onContextMenu={event => event.preventDefault()}
  ><span ref={knob} /><small>MOVE</small></div>;
}
