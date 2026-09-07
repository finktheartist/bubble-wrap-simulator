export type MeleeTool = 1 | 2;
export const MELEE = {
  1: { duration:.66, contact:.23, reach:3.7, radius:1.05 },
  2: { duration:.58, contact:.19, reach:4.1, radius:1.45 },
} as const;
type Pose = {position:[number,number,number];rotation:[number,number,number]};
const rest:Pose={position:[0,0,0],rotation:[0,0,0]};
const poses:Record<MeleeTool,Pose[]>={
  1:[rest,{position:[.06,.10,.10],rotation:[.85,-.15,-.2]},{position:[-.25,.13,-.18],rotation:[-.65,.15,.2]},{position:[-.29,-.08,-.14],rotation:[-1.25,.12,.4]},rest],
  2:[rest,{position:[.12,.035,.07],rotation:[.25,-.4,-1]},{position:[-.19,.15,-.12],rotation:[-.48,.38,.72]},{position:[-.38,.06,-.04],rotation:[-.55,.7,1.6]},rest],
};
/** Grip-pivot poses: wind-up, accelerating strike, follow-through, then a slower return. */
export function meleePose(tool:MeleeTool,elapsed:number):Pose {
  const config=MELEE[tool],times=[0,config.contact*.55,config.contact,config.contact+.10,config.duration];
  const t=Math.max(0,Math.min(elapsed,config.duration));
  let i=0;while(i<3&&t>times[i+1])i++;
  const raw=(t-times[i])/(times[i+1]-times[i]);
  const p=i===1?raw*raw:raw*raw*(3-2*raw);
  const blend=(a:number[],b:number[])=>a.map((v,j)=>v+(b[j]-v)*p) as [number,number,number];
  return {position:blend(poses[tool][i].position,poses[tool][i+1].position),rotation:blend(poses[tool][i].rotation,poses[tool][i+1].rotation)};
}
export function heldToolPose(tool:number,aspect:number,state:{charge?:number;recoil?:number;bob?:number;throwSwing?:number;attack?:{tool:MeleeTool;age:number}|null}={}) {
  const portrait=aspect<1,fit=portrait?Math.min(.85,Math.max(.34,aspect*.95)):1,melee=tool===1||tool===2;
  const position:[number,number,number]=[portrait?aspect*.18:tool===0?.34:tool===4?.32:.4,(portrait?-.22:-.4)+(state.bob??0)-(state.charge??0)*.08,(portrait?-.9:-.85)+(state.recoil??0)*.13];
  const rotation:[number,number,number]=[(melee?-.2:-.08)-Math.sin((state.throwSwing??0)*Math.PI)*(melee?0:.5),tool===1?-.6:-.18,melee?-.3:-.18];
  if(state.attack){const pose=meleePose(state.attack.tool,state.attack.age);for(let i=0;i<3;i++){position[i]+=pose.position[i]*fit;rotation[i]+=pose.rotation[i];}}
  if(tool===0){position[1]=portrait?-.06:-.32;position[2]=(portrait?-.8:-.62)-(state.recoil??0)*.35;}
  if(tool>=6){position[0]=portrait?aspect*.19:.32;position[1]=(portrait?-.19:-.285)+(state.bob??0);position[2]=(portrait?-1.05:-1.24)+(state.recoil??0)*.07;rotation[0]=-.04-(state.recoil??0)*.05;rotation[1]=.14;rotation[2]=-.08;}
  return {position,rotation,scale:(tool===2?.76:tool===6?.73:tool===7?.58:tool===8?.74:1)*(tool>=6&&portrait?Math.min(fit,.6):fit),gripY:tool===1?.26:tool===2?.38:0,modelYaw:tool===1?Math.PI/2:0};
}
export class MeleeSwing {
  attack:{tool:MeleeTool;startedAt:number;contacted:boolean}|null=null;
  private queued:{tool:MeleeTool;expires:number}|null=null;
  trigger(tool:MeleeTool,now:number,buffer=false) {
    if(this.attack){if(buffer)this.queued={tool,expires:now+.3};return false;}
    this.attack={tool,startedAt:now,contacted:false};return true;
  }
  advance(now:number):MeleeTool|null {
    const a=this.attack;if(!a)return null;
    const config=MELEE[a.tool];let contact:MeleeTool|null=null;
    if(!a.contacted&&now>=a.startedAt+config.contact){a.contacted=true;contact=a.tool;}
    if(now>=a.startedAt+config.duration){
      this.attack=null;const queued=this.queued;this.queued=null;
      if(queued&&queued.expires>=now)this.trigger(queued.tool,now);
    }
    return contact;
  }
  reset(){this.attack=null;this.queued=null;}
}
