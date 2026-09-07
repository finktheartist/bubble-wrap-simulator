/** Lightweight catalog shared by the HUD, shortcuts, portraits, and game engine. */
export const TOOL_INFO = [
  {file:'fingertip',name:'Fingertip',action:'POP',verb:'Click POP or press F',touchVerb:'Tap to pop · Hold POP for a crackle',description:'One bubble at a time. Take it slow.',mode:'hold'},
  {file:'mallet',name:'Mallet',action:'SMASH',verb:'Click to smash',touchVerb:'Tap anywhere to swing',description:'A reassuringly excessive rubber mallet.',mode:'hold'},
  {file:'bat',name:'Bat',action:'WHACK',verb:'Click to whack',touchVerb:'Tap anywhere to swing',description:'A wide swing. A very good crackle.',mode:'hold'},
  {file:'bowling-ball',name:'Bowling ball',action:'THROW',verb:'Hold & release to throw',touchVerb:'Hold THROW · Release to launch',description:'Seven kilos of excellent decisions.',mode:'charge'},
  {file:'pop-blaster',name:'Pop blaster',action:'FIRE',verb:'Hold to shoot',touchVerb:'Hold FIRE · Drag to aim',description:'Little pellets. Rapid-fire satisfaction.',mode:'hold'},
  {file:'pop-bomb',name:'Pop bomb',action:'THROW BOMB',verb:'Click to throw',touchVerb:'Tap THROW BOMB',description:'A short fuse. A room-shaking ripple.',mode:'press'},
  {file:'rocket-launcher',name:'Rocket launcher',action:'LAUNCH',verb:'Click to launch · Bursts on impact',touchVerb:'Tap LAUNCH · Bursts on impact',description:'A streak of orange. An enormous pop.',mode:'press'},
  {file:'ball-cannon',name:'Bowling cannon',action:'BOWL',verb:'Click or hold to launch bowling balls',touchVerb:'Hold BOWL · Drag to aim',description:'Seven kilos, now with a pressure gauge.',mode:'hold'},
  {file:'pop-vacuum',name:'Pop vacuum',action:'VACUUM',verb:'Hold to gather props and pop wrap',touchVerb:'Hold VACUUM · Sweep to gather props',description:'Pull everything into one very satisfying pile.',mode:'hold'},
] as const;
export const TOOL_FILES = TOOL_INFO.map(tool=>tool.file);
/** Openings measured in the exported GLBs' local coordinates. */
export const TOOL_MUZZLES:Readonly<Record<number,readonly [number,number,number]>>={4:[0,.062,-.405],6:[0,.11,-.635],7:[0,.085,-.53],8:[0,-.015,-.73]};
export function toolShortcut(code:string):number|null {
  if(!/^Digit[1-9]$/.test(code))return null;
  const index=Number(code.at(-1))-1;return index<TOOL_INFO.length?index:null;
}
export function cycleTool(current:number,direction:number){return (current+(direction>0?1:TOOL_INFO.length-1))%TOOL_INFO.length;}
