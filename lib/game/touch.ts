/** A gesture owns one finger until it ends; other fingers cannot steal or release it. */
export class TouchGesture {
  private pointer: number | null = null;
  private x = 0;
  private y = 0;
  private startX = 0;
  private startY = 0;
  private startedAt = 0;
  private travel = 0;
  start(id: number, x: number, y: number, now = performance.now()) {
    if (this.pointer !== null) return false;
    this.pointer = id; this.x = x; this.y = y;
    this.startX=x;this.startY=y;this.startedAt=now;this.travel=0;
    return true;
  }
  move(id: number, x: number, y: number) {
    if (this.pointer !== id) return null;
    const delta = { x: x - this.x, y: y - this.y };
    this.x = x; this.y = y;
    this.travel=Math.max(this.travel,Math.hypot(x-this.startX,y-this.startY));
    return delta;
  }
  end(id: number) {
    if (this.pointer !== id) return false;
    this.pointer = null;
    return true;
  }
  reset() { this.pointer = null; }
  finishTap(id:number,x:number,y:number,now=performance.now()) {
    if(this.pointer!==id)return false;
    this.move(id,x,y);
    const tap=this.travel<=10&&now-this.startedAt<=350;
    this.end(id);return tap;
  }
}

/** Keep the knob in its well and remove accidental movement near its center. */
export function thumbstickVector(x: number, y: number, radius: number) {
  const distance = Math.hypot(x, y);
  const fraction = Math.min(1, distance / radius);
  const strength = Math.max(0, (fraction - .14) / .86);
  const dx = distance ? x / distance : 0, dy = distance ? y / distance : 0;
  return { knobX: dx * fraction * radius, knobY: dy * fraction * radius, x: dx * strength, y: dy * strength };
}

export function touchLookDelta(x: number, y: number, viewportWidth: number) {
  // One swipe crosses a comparable angle in portrait and landscape.
  const scale = 520 / Math.max(320, Math.min(viewportWidth, 900));
  return { x: x * scale, y: y * scale };
}
