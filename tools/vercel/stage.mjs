/** Build and hash the exact static payload; this script does not upload or deploy. */
import { copyFile, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root=fileURLToPath(new URL('../../',import.meta.url)),site=resolve(root,'outputs/vercel/site');
await copyFile(resolve(root,'platform/vercel/vercel.json'),resolve(site,'vercel.json'));
await copyFile(resolve(root,'platform/vercel/fonts/OFL.txt'),resolve(site,'font-license.txt'));
const files=[];
async function inventory(dir){
  for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    const path=resolve(dir,entry.name);
    if(entry.isDirectory())await inventory(path);
    else if(entry.isFile()){
      const content=await readFile(path);files.push({path:relative(site,path),bytes:content.length,sha256:createHash('sha256').update(content).digest('hex')});
    }else throw new Error(`Unexpected deployment entry: ${path}`);
  }
}
await inventory(site);
if(!files.some(f=>f.path==='index.html')||files.filter(f=>f.path.endsWith('.glb')).length!==9)throw new Error('Incomplete game package');
const manifest={project:'bubble-wrap-simulator',scope:'finktheartist-5591s-projects',orgId:'team_MIC5cycgd9LcCIvLGGlmRPN1',directory:site,files};
await writeFile(resolve(root,'outputs/vercel/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Vercel payload ready: ${files.length} files, ${files.reduce((n,f)=>n+f.bytes,0)} bytes. Manifest: outputs/vercel/manifest.json`);
