import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const project=fileURLToPath(new URL('.',import.meta.url));
/** The game needs no server: this entry reuses the same React UI and game engine. */
export default defineConfig({
  root:resolve(project,'platform/vercel'),
  publicDir:resolve(project,'public'),
  plugins:[react()],
  resolve:{alias:{'@':project}},
  css:{postcss:{plugins:[tailwindcss()]}},
  build:{outDir:resolve(project,'outputs/vercel/site'),emptyOutDir:true,target:'es2022',sourcemap:false},
});
