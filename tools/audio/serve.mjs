/** Local audio audition using the actual browser game graph; never part of the deployed site. */
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const root=process.cwd(), output=resolve(root,'outputs/audio-review');
const itemOutput=resolve(root,'outputs/item-audio');
await mkdir(itemOutput,{recursive:true});
await mkdir(resolve(output,'before'),{recursive:true});
for(const name of ['audio.ts','pop-synthesis.ts'])await writeFile(resolve(output,'before',name),execFileSync('git',['show','abf35be49df524d8d35bc797dcbd34211a5a6362:lib/game/'+name],{cwd:root}));
const server=await createServer({configFile:false,root:resolve(root,'tools/audio'),publicDir:resolve(root,'public'),resolve:{alias:{'@game':resolve(root,'lib/game'),'@before':resolve(output,'before')}},server:{host:'127.0.0.1',port:4180,strictPort:true,fs:{allow:[root]}},plugins:[{name:'save-local-audio-review',configureServer(server){server.middlewares.use('/latest-items.mp3',async(_req,res)=>{
  try{const data=await readFile(resolve(itemOutput,'item-sounds-demo.mp3'));res.setHeader('Content-Type','audio/mpeg');res.setHeader('Cache-Control','no-cache');res.end(data);}catch{res.statusCode=404;res.end();}
});server.middlewares.use('/item-capture',async(req,res)=>{
  if(req.method!=='POST'){res.statusCode=405;res.end();return;}
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>8_000_000){res.statusCode=413;res.end();return;}chunks.push(chunk);}
  await writeFile(resolve(itemOutput,'item-sounds-demo.webm'),Buffer.concat(chunks));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({saved:true,bytes:size}));
});server.middlewares.use('/latest-comparison.mp3',async(_req,res)=>{
  try{const data=await readFile(resolve(output,'sound-comparison.mp3'));res.setHeader('Content-Type','audio/mpeg');res.setHeader('Cache-Control','no-cache');res.end(data);}catch{res.statusCode=404;res.end();}
});server.middlewares.use('/capture',async(req,res)=>{
  if(req.method!=='POST'){res.statusCode=405;res.end();return;}
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>8_000_000){res.statusCode=413;res.end();return;}chunks.push(chunk);}
  await writeFile(resolve(output,'reference-match.webm'),Buffer.concat(chunks));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({saved:true,bytes:size}));
});}}]});
await server.listen();console.log('Audio review: http://127.0.0.1:4180/review.html');
