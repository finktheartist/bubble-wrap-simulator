import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export const TOOL_INFO = [
  {name:'Fingertip',verb:'Click POP or press F',detail:'One bubble at a time. Take it slow.',key:'1'},
  {name:'Mallet',verb:'Click to smash',detail:'A reassuringly excessive rubber mallet.',key:'2'},
  {name:'Bat',verb:'Click to whack',detail:'A wide swing. A very good crackle.',key:'3'},
  {name:'Bowling ball',verb:'Hold & release to throw',detail:'Seven kilos of excellent decisions.',key:'4'},
  {name:'Pop blaster',verb:'Hold to shoot',detail:'Little pellets. Rapid-fire satisfaction.',key:'5'},
  {name:'Pop bomb',verb:'Click to throw',detail:'A short fuse. A room-shaking ripple.',key:'6'},
] as const;
const mats={
  glove:new THREE.MeshStandardMaterial({color:0xf6eee0,roughness:.68}),
  teal:new THREE.MeshStandardMaterial({color:0x4295a8,roughness:.3,metalness:.15}),
  dark:new THREE.MeshStandardMaterial({color:0x263640,roughness:.43,metalness:.22}),
  lime:new THREE.MeshStandardMaterial({color:0xd4f66b,roughness:.3}),
  pink:new THREE.MeshStandardMaterial({color:0xe9a39d,roughness:.4}),
  metal:new THREE.MeshStandardMaterial({color:0xc4d2d5,roughness:.24,metalness:.8}),
  black:new THREE.MeshStandardMaterial({color:0x08181d,roughness:.55}),
  light:new THREE.MeshStandardMaterial({color:0xfd9a63,emissive:0xe56025,emissiveIntensity:.7}),
};
export function makeTool(tool:number,world=false):THREE.Group {
  const group=new THREE.Group();
  const mesh=(geo:THREE.BufferGeometry,mat:THREE.Material,p:[number,number,number]=[0,0,0],rot?:[number,number,number])=>{const m=new THREE.Mesh(geo,mat);m.position.set(...p);if(rot)m.rotation.set(...rot);m.castShadow=world;group.add(m);return m;};
  const box=(s:[number,number,number],m:THREE.Material,p:[number,number,number])=>mesh(new RoundedBoxGeometry(...s,2,.035),m,p);
  const sphere=(r:number,m:THREE.Material,p:[number,number,number])=>mesh(new THREE.SphereGeometry(r,18,12),m,p);
  const cylinder=(a:number,b:number,h:number,m:THREE.Material,p:[number,number,number])=>mesh(new THREE.CylinderGeometry(a,b,h,16),m,p);
  if(tool===0) {
    const palm=sphere(.12,mats.glove,[0,-.15,0]);palm.scale.set(.85,1.3,.6);
    const finger=mesh(new THREE.CapsuleGeometry(.039,.2,5,10),mats.glove,[-.055,.012,0],[-.75,0,-.1]);
    finger.position.z=-.08;
    for(let i=0;i<3;i++) sphere(.043,mats.glove,[.003+i*.047,-.08,-.075]);
    cylinder(.083,.095,.19,mats.teal,[0,-.3,0]);
  } else if(tool===1) {
    cylinder(.034,.045,.67,mats.dark,[0,-.1,0]);
    for(let i=0;i<5;i++) cylinder(.047,.047,.025,mats.teal,[0,-.4+i*.04,0]);
    box([.52,.26,.26],mats.teal,[0,.27,0]);
    box([.065,.275,.275],mats.dark,[-.27,.27,0]);box([.065,.275,.275],mats.dark,[.27,.27,0]);
    box([.12,.13,.008],mats.lime,[0,.27,.137]);
  } else if(tool===2) {
    cylinder(.073,.027,.95,mats.pink,[0,.05,0]);sphere(.073,mats.pink,[0,.525,0]);
    cylinder(.032,.036,.3,mats.dark,[0,-.56,0]);sphere(.043,mats.teal,[0,-.72,0]);
    cylinder(.075,.073,.08,mats.lime,[0,.3,0]);
  } else if(tool===3) {
    sphere(.28,mats.teal,[0,0,0]);
    for(const p of [[-.063,.07,.262],[.043,.07,.267],[-.005,-.045,.276]] as [number,number,number][]) sphere(.036,mats.black,p);
  } else if(tool===4) {
    box([.2,.24,.4],mats.lime,[0,0,-.06]);
    mesh(new THREE.CylinderGeometry(.085,.085,.32,18),mats.teal,[0,0,-.37],[Math.PI/2,0,0]);
    mesh(new THREE.TorusGeometry(.067,.02,8,16),mats.light,[0,0,-.535]);
    box([.1,.26,.12],mats.dark,[0,-.21,.065]);
    box([.18,.15,.2],mats.teal,[0,0,.22]);
    box([.055,.06,.16],mats.dark,[0,.16,-.07]);
  } else {
    sphere(.19,mats.teal,[0,0,0]);cylinder(.1,.1,.08,mats.dark,[0,.18,0]);
    mesh(new THREE.TorusGeometry(.195,.023,6,20),mats.lime,[0,0,0],[Math.PI/2,0,0]);
    cylinder(.017,.017,.1,mats.light,[0,.25,0]);
    sphere(.026,mats.light,[0,.31,0]);
  }
  return group;
}
export function disposeTool(group:THREE.Group) {group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});}
export function disposeToolMaterials(){Object.values(mats).forEach(m=>m.dispose());}
