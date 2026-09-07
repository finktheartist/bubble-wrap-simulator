import * as THREE from 'three';

// Small local material maps shared by the held tools, projectiles and portraits.
function texture(width:number,height:number,sample:(u:number,v:number)=>number[],color=false) {
  const pixels=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const rgb=sample(x/width,y/height),i=(y*width+x)*4;
    for(let c=0;c<3;c++)pixels[i+c]=Math.round(THREE.MathUtils.clamp(rgb[c],0,1)*255);
    pixels[i+3]=255;
  }
  const map=new THREE.DataTexture(pixels,width,height);
  map.wrapS=map.wrapT=THREE.RepeatWrapping;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
  map.generateMipmaps=true;map.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;map.needsUpdate=true;
  return map;
}
const noise=(u:number,v:number)=>{const n=Math.sin(u*127.1+v*311.7)*43758.5453;return n-Math.floor(n);};
const grain=texture(256,512,(u,v)=>{
  const bend=u+Math.sin(v*6.28)*.016+Math.sin(v*19+u*6.28)*.006;
  const growth=Math.pow(.5+.5*Math.sin(bend*Math.PI*88+Math.sin(v*9)*.4),12),fine=noise(u*170,v*110)*.04;
  return [.78-growth*.19+fine,.57-growth*.18+fine,.32-growth*.13+fine];
},true);
const pores=texture(128,128,(u,v)=>{const n=.55+noise(u*128,v*128)*.35;return[n,n,n];});
const resin=texture(512,256,(u,v)=>{
  // A spherical field keeps the marbling continuous across the UV seam.
  const theta=u*Math.PI*2,phi=v*Math.PI,x=Math.cos(theta)*Math.sin(phi),y=Math.cos(phi),z=Math.sin(theta)*Math.sin(phi);
  const warp=Math.sin(x*7+y*4)+Math.sin(z*8-y*6)*.6;
  const wave=.5+.5*Math.sin(x*8+y*13+z*5+warp*3),pearl=Math.pow(wave,7),blue=wave*.35;
  return[.055+pearl*.31,.11+blue*.29+pearl*.42,.17+blue*.43+pearl*.47];
},true);
export const toolMaterials={
  glove:new THREE.MeshStandardMaterial({color:0xdac6a1,roughness:.88,bumpMap:pores,bumpScale:.0008}),
  glovePatch:new THREE.MeshStandardMaterial({color:0xbfa781,roughness:.94,bumpMap:pores,bumpScale:.001}),
  seam:new THREE.MeshStandardMaterial({color:0x847562,roughness:.9}),
  wood:new THREE.MeshPhysicalMaterial({color:0xffffff,map:grain,bumpMap:grain,bumpScale:.0007,roughness:.4,clearcoat:.25,clearcoatRoughness:.35}),
  rubber:new THREE.MeshStandardMaterial({color:0x22282b,roughness:.89,bumpMap:pores,bumpScale:.0012}),
  grip:new THREE.MeshStandardMaterial({color:0x313638,roughness:.92,bumpMap:pores,bumpScale:.0015}),
  teal:new THREE.MeshPhysicalMaterial({color:0x317481,roughness:.42,metalness:.06,clearcoat:.28,clearcoatRoughness:.35,bumpMap:pores,bumpScale:.00025}),
  lime:new THREE.MeshStandardMaterial({color:0xc3d77a,roughness:.52,bumpMap:pores,bumpScale:.0003}),
  orange:new THREE.MeshStandardMaterial({color:0xc27037,roughness:.65}),
  metal:new THREE.MeshStandardMaterial({color:0xa8b0b1,roughness:.3,metalness:.94,bumpMap:pores,bumpScale:.00012}),
  darkMetal:new THREE.MeshStandardMaterial({color:0x454d50,roughness:.38,metalness:.82}),
  black:new THREE.MeshStandardMaterial({color:0x070a0c,roughness:.98}),
  resin:new THREE.MeshPhysicalMaterial({color:0xffffff,map:resin,vertexColors:true,roughness:.19,metalness:0,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:1.15}),
  fuse:new THREE.MeshStandardMaterial({color:0x9b8061,roughness:1,bumpMap:pores,bumpScale:.002}),
  ember:new THREE.MeshStandardMaterial({color:0xffc076,emissive:0xff6418,emissiveIntensity:2.5,roughness:.9}),
};
export function disposeToolMaterials(){Object.values(toolMaterials).forEach(m=>m.dispose());grain.dispose();pores.dispose();resin.dispose();}
