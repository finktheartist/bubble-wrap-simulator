import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toolMaterials as mats } from './tool-materials';
export { disposeToolMaterials } from './tool-materials';
export const TOOL_INFO = [
  {name:'Fingertip',verb:'Click POP or press F',detail:'One bubble at a time. Take it slow.',key:'1'},
  {name:'Mallet',verb:'Click to smash',detail:'A reassuringly excessive rubber mallet.',key:'2'},
  {name:'Bat',verb:'Click to whack',detail:'A wide swing. A very good crackle.',key:'3'},
  {name:'Bowling ball',verb:'Hold & release to throw',detail:'Seven kilos of excellent decisions.',key:'4'},
  {name:'Pop blaster',verb:'Hold to shoot',detail:'Little pellets. Rapid-fire satisfaction.',key:'5'},
  {name:'Pop bomb',verb:'Click to throw',detail:'A short fuse. A room-shaking ripple.',key:'6'},
] as const;

/** Three recessed wells: the surface descends through a bevel into each finger hole. */
function bowlingBallGeometry(){
  const geometry=new THREE.SphereGeometry(.28,112,72);
  const holes=[new THREE.Vector3(-.21,.32,.93).normalize(),new THREE.Vector3(.21,.32,.93).normalize(),new THREE.Vector3(0,-.16,.987).normalize()];
  const positions=geometry.getAttribute('position'),colors=new Float32Array(positions.count*3),direction=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
    direction.fromBufferAttribute(positions,i).normalize();let well=0;
    for(const hole of holes){const angle=Math.acos(THREE.MathUtils.clamp(direction.dot(hole),-1,1));well=Math.max(well,1-THREE.MathUtils.smoothstep(angle,.103,.164));}
    const point=direction.clone().multiplyScalar(.28-well*.135);positions.setXYZ(i,point.x,point.y,point.z);
    const shade=1-.975*well;colors.set([shade,shade,shade],i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeVertexNormals();return geometry;
}
export function makeTool(tool:number,world=false):THREE.Group {
  const group=new THREE.Group();group.name=TOOL_INFO[tool]?.name??'Pop bomb';
  const mesh=(geo:THREE.BufferGeometry,mat:THREE.Material,p:[number,number,number]=[0,0,0],rot?:[number,number,number])=>{const m=new THREE.Mesh(geo,mat);m.position.set(...p);if(rot)m.rotation.set(...rot);m.castShadow=world;m.receiveShadow=world;group.add(m);return m;};
  const box=(s:[number,number,number],m:THREE.Material,p:[number,number,number],radius=.015)=>mesh(new RoundedBoxGeometry(...s,2,Math.min(radius,...s.map(n=>n/3))),m,p);
  const sphere=(r:number,m:THREE.Material,p:[number,number,number])=>mesh(new THREE.SphereGeometry(r,28,18),m,p);
  const cylinder=(a:number,b:number,h:number,m:THREE.Material,p:[number,number,number],rot?:[number,number,number])=>mesh(new THREE.CylinderGeometry(a,b,h,28),m,p,rot);
  const lathe=(profile:number[][],m:THREE.Material,p:[number,number,number],rot?:[number,number,number])=>mesh(new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(p[0],p[1])),40),m,p,rot);
  const line=(points:number[][],r:number,m:THREE.Material)=>mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],p[1],p[2]))),Math.min(180,Math.max(16,points.length*3)),r,6,false),m);
  const ring=(r:number,t:number,m:THREE.Material,p:[number,number,number],rot:[number,number,number]=[Math.PI/2,0,0])=>mesh(new THREE.TorusGeometry(r,t,8,32),m,p,rot);
  const screw=(p:[number,number,number])=>{cylinder(.012,.012,.007,mats.darkMetal,p,[Math.PI/2,0,0]);box([.014,.002,.002],mats.black,[p[0],p[1],p[2]+.004],.0005);};
  if(tool===0){
    // Suede work glove with an articulated finger, curled knuckles and separate thumb.
    const palm=sphere(.112,mats.glove,[0,-.15,0]);palm.scale.set(.94,1.24,.61);
    const pad=sphere(.09,mats.glovePatch,[0,-.17,.045]);pad.scale.set(.95,1.15,.27);
    const finger=mesh(new THREE.CapsuleGeometry(.031,.205,7,14),mats.glove,[-.062,.018,-.07],[-.56,0,-.055]);finger.scale.z=.9;
    for(let i=0;i<3;i++){const x=-.004+i*.046;mesh(new THREE.CapsuleGeometry(.029,.056-i*.009,5,12),mats.glove,[x,-.075-i*.016,-.062],[-1.12,.1,-.09]);line([[x-.021,-.075-i*.016,-.085],[x,-.064-i*.016,-.098],[x+.022,-.076-i*.016,-.084]],.0015,mats.seam);}
    mesh(new THREE.CapsuleGeometry(.036,.083,6,14),mats.glove,[-.099,-.164,-.05],[-.65,0,-.62]);
    line([[-.08,-.24,.042],[-.094,-.17,.053],[-.076,-.08,.04]],.0014,mats.seam);
    line([[.078,-.23,.04],[.099,-.16,.036],[.08,-.11,.04]],.0014,mats.seam);
    cylinder(.078,.074,.12,mats.grip,[0,-.3,0]);
    for(let i=0;i<7;i++)ring(.076,.0023,mats.rubber,[0,-.352+i*.015,0]);
    box([.045,.025,.006],mats.teal,[0,-.32,.076],.004);
  } else if(tool===1){
    // A turned hardwood shaft through a dense rubber barrel with a mold parting line.
    lathe([[.001,-.44],[.036,-.44],[.042,-.425],[.039,-.37],[.027,.22],[.029,.35],[.001,.35]],mats.wood,[0,0,0]);
    lathe([[.001,-.28],[.115,-.28],[.14,-.269],[.148,-.245],[.144,-.22],[.135,-.16],[.134,.16],[.144,.22],[.148,.245],[.14,.269],[.115,.28],[.001,.28]],mats.rubber,[0,.25,0],[0,0,Math.PI/2]);
    ring(.136,.0018,mats.grip,[0,.25,0],[0,Math.PI/2,0]);
    for(const x of [-.276,.276]){cylinder(.113,.113,.007,mats.grip,[x,.25,0],[0,0,Math.PI/2]);ring(.1,.0015,mats.rubber,[x*1.014,.25,0],[0,Math.PI/2,0]);}
    cylinder(.037,.032,.036,mats.metal,[0,.105,0]);
    box([.086,.041,.006],mats.teal,[0,.25,.135],.005);box([.052,.004,.002],mats.lime,[0,.252,.139],.001);
    cylinder(.041,.037,.17,mats.grip,[0,-.349,0]);for(let i=0;i<8;i++)ring(.041,.0018,mats.rubber,[0,-.428+i*.022,0]);
  } else if(tool===2){
    // Continuous flared knob, narrow handle, tapered shoulder and rounded barrel.
    lathe([[.001,-.72],[.041,-.72],[.048,-.709],[.049,-.69],[.034,-.676],[.026,-.653],[.025,-.48],[.031,-.29],[.043,-.08],[.059,.12],[.073,.31],[.079,.49],[.075,.543],[.063,.575],[.035,.595],[.001,.599]],mats.wood,[0,0,0]);
    cylinder(.028,.027,.255,mats.grip,[0,-.527,0]);
    const tape:number[][]=[];for(let i=0;i<=150;i++){const y=-.654+i/150*.255,a=i/150*Math.PI*2*9;tape.push([Math.cos(a)*.0285,y,Math.sin(a)*.0285]);}line(tape,.0016,mats.rubber);
    cylinder(.046,.046,.007,mats.darkMetal,[0,-.708,0]);cylinder(.077,.077,.015,mats.teal,[0,.387,0]);cylinder(.076,.076,.004,mats.lime,[0,.403,0]);
  } else if(tool===3){
    mesh(bowlingBallGeometry(),mats.resin);
  } else if(tool===4){
    // Molded pneumatic toy, inset vents, rubber grip and a hollow metal nozzle.
    box([.187,.202,.36],mats.teal,[0,.015,-.07],.036);box([.199,.114,.254],mats.lime,[0,.074,-.056],.022);
    box([.162,.137,.142],mats.rubber,[0,-.004,.174],.025);
    for(const x of [-.095,.095])for(let i=0;i<5;i++)box([.006,.013,.08],mats.black,[x,.036-i*.019,-.125],.002);
    const grip=box([.094,.246,.111],mats.grip,[0,-.191,.039],.026);grip.rotation.x=-.18;
    for(let i=0;i<6;i++)box([.097,.008,.113],mats.rubber,[0,-.12-i*.027,.03+(i-2)*.005],.004);
    cylinder(.082,.091,.078,mats.darkMetal,[0,.016,-.282],[Math.PI/2,0,0]);
    lathe([[.047,-.16],[.059,-.16],[.064,-.146],[.063,.1],[.072,.11],[.072,.145],[.047,.145],[.047,-.16]],mats.metal,[0,.016,-.377],[Math.PI/2,0,0]);
    ring(.065,.008,mats.orange,[0,.016,-.522],[0,0,0]);cylinder(.047,.047,.005,mats.black,[0,.016,-.335],[Math.PI/2,0,0]);
    box([.047,.035,.1],mats.darkMetal,[0,.135,-.092],.006);box([.012,.013,.018],mats.lime,[0,.16,-.12],.003);
    line([[.047,-.047,-.113],[.047,-.136,-.109],[.047,-.168,-.068],[.047,-.152,.015]],.009,mats.darkMetal);
    box([.012,.05,.022],mats.orange,[.034,-.089,-.049],.007);for(const x of [-.061,.061])screw([x,.074,.109]);
  } else {
    // Painted hemispheres, gasket, threaded collar and a braided slow fuse.
    sphere(.19,mats.teal,[0,0,0]);ring(.19,.003,mats.rubber,[0,0,0]);ring(.1905,.0012,mats.metal,[0,.005,0]);
    cylinder(.072,.093,.049,mats.darkMetal,[0,.18,0]);cylinder(.055,.071,.025,mats.metal,[0,.214,0]);
    for(let i=0;i<4;i++)ring(.06+i*.003,.0018,mats.darkMetal,[0,.227-i*.006,0]);
    line([[0,.226,0],[.013,.258,.001],[.025,.294,-.009],[.051,.32,-.014]],.009,mats.fuse);
    const braid:number[][]=[];for(let i=0;i<=56;i++){const t=i/56;braid.push([.05*t+Math.cos(t*60)*.009,.228+t*.092,Math.sin(t*60)*.009-.014*t]);}line(braid,.0016,mats.glovePatch);
    sphere(.0105,mats.black,[.05,.32,-.014]);sphere(.007,mats.ember,[.056,.325,-.016]);
    box([.1,.049,.006],mats.lime,[0,.03,.187],.008);for(let i=0;i<3;i++)box([.004,.027,.003],mats.darkMetal,[-.025+i*.025,.03,.192],.001);
  }
  return group;
}
export function disposeTool(group:THREE.Group){group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});}
