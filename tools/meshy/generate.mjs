#!/usr/bin/env node
/** Offline Meshy authoring: preview/refine geometry or retexture a precise existing prop. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { parseArgs, parseEnv } from 'node:util';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../../', import.meta.url));
const api = 'https://api.meshy.ai';
const { values: args } = parseArgs({ options: {
  asset: { type: 'string' }, job: { type: 'string' },
  stage: { type: 'string', default: 'preview' },
  run: { type: 'string', default: 'first-pass' },
  'preview-run': { type: 'string' },
  source: { type: 'string' },
  'env-file': { type: 'string' }, 'mcp-config': { type: 'string' },
  'dry-run': { type: 'boolean', default: false },
  balance: { type: 'boolean', default: false },
} });
const endpoint = args.stage === 'retexture' ? '/openapi/v1/retexture' : '/openapi/v2/text-to-3d';
const catalog = JSON.parse(await readFile(new URL('./assets.json', import.meta.url), 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
const cap = capability => {
  if (!args.job) throw new Error('Supply --job with the authorized Studio job.');
  execFileSync('studio', ['cap', args.job, capability], { stdio: 'pipe' });
};
const save = async (path, data) => {
  await writeFile(`${path}.tmp`, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  await rename(`${path}.tmp`, path);
};
const readOptional = async path => {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};

async function main() {
  if (!['preview', 'refine', 'retexture'].includes(args.stage)) throw new Error('Use --stage preview, refine or retexture.');
  for (const run of [args.run, args['preview-run'] ?? args.run]) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(run)) throw new Error('Run names must be short slugs.');
  }
  const asset = Object.hasOwn(catalog.assets, args.asset ?? '') ? catalog.assets[args.asset] : undefined;
  if (!args.balance && !asset) throw new Error(`Choose --asset from: ${Object.keys(catalog.assets).join(', ')}`);
  if (asset && (asset.prompt.length > 800 || asset.texture_prompt.length > 800)) throw new Error('Meshy prompts must stay within 800 characters.');
  const previewPayload = asset ? { ...catalog.preview, prompt: asset.prompt, target_polycount: asset.target_polycount } : null;
  let payload = previewPayload;
  if (args.stage === 'retexture' && !args.balance) {
    if (!args.source) throw new Error('Retexturing requires --source with a reviewed local GLB.');
    const bytes = await readFile(resolve(args.source));
    if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Source is not a complete GLB 2.0 file.');
    payload = { ai_model: 'meshy-7', enable_original_uv: true, enable_pbr: true, texture_resolution: '4k', target_formats: ['glb'], text_style_prompt: asset.texture_prompt, model_url: `data:application/octet-stream;base64,${bytes.toString('base64')}` };
  }
  if (args.stage === 'refine' && asset) {
    const priorDir = join(root, 'outputs/meshy', args['preview-run'] ?? args.run, args.asset);
    const prior = await readOptional(join(priorDir, 'preview-receipt.json'));
    if (!args['dry-run']) {
      if (prior?.status !== 'downloaded' || !prior.taskId) throw new Error('Generate and review a successful preview first.');
      if (prior.requestSha256 !== hash(JSON.stringify(previewPayload))) throw new Error('The geometry prompt changed since this preview.');
      if (hash(await readFile(join(priorDir, 'preview.glb'))) !== prior.modelSha256) throw new Error('Preview GLB differs from its generation receipt.');
    }
    payload = { ...catalog.refine, preview_task_id: prior?.taskId ?? 'REVIEWED_PREVIEW_TASK_ID', texture_prompt: asset.texture_prompt };
  }
  if (args['dry-run']) {
    const display = payload?.model_url ? { ...payload, model_url: '[local GLB data URI omitted from console]' } : payload;
    console.log(JSON.stringify({ endpoint: api + (args.balance ? '/openapi/v1/balance' : endpoint), payload: args.balance ? undefined : display }, null, 2));
    return;
  }
  const env = args['env-file'] ? parseEnv(await readFile(resolve(args['env-file']), 'utf8')) : {};
  const config = args['mcp-config'] ? JSON.parse(await readFile(resolve(args['mcp-config']), 'utf8')) : {};
  const key = env.MESHY_API_KEY || process.env.MESHY_API_KEY || config.mcpServers?.meshy?.env?.MESHY_API_KEY;
  if (!key?.trim()) throw new Error('MESHY_API_KEY is missing. Supply an environment variable, local --env-file or --mcp-config.');
  const request = async (path, body) => {
    cap('network');
    const response = await fetch(api + path, {
      method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(45000),
      headers: { Authorization: `Bearer ${key.trim()}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`Meshy returned HTTP ${response.status}; no automatic paid retry.`);
    return response.json();
  };
  if (args.balance) {
    const result = await request('/openapi/v1/balance');
    console.log(JSON.stringify({ balance: result.balance }));
    return;
  }
  const out = join(root, 'outputs/meshy', args.run, args.asset);
  await mkdir(out, { recursive: true });
  const receiptPath = join(out, `${args.stage}-receipt.json`);
  const fingerprint = hash(JSON.stringify(payload));
  let receipt = await readOptional(receiptPath);
  if (receipt && receipt.requestSha256 !== fingerprint) throw new Error('Request changed. Use a new --run; --preview-run can reuse an existing reviewed mesh.');
  if (receipt?.status === 'downloaded') {
    if (hash(await readFile(join(out, `${args.stage}.glb`))) !== receipt.modelSha256) throw new Error('Downloaded GLB no longer matches its receipt.');
    console.log(`Already downloaded: ${args.asset} ${args.stage}`);
    return;
  }
  if (receipt && !receipt.taskId) throw new Error('An earlier POST has an uncertain result. Check Meshy before submitting any replacement.');
  if (!receipt) {
    const { balance } = await request('/openapi/v1/balance');
    const estimatedCredits = args.stage === 'preview' ? 25 : 10;
    if (typeof balance !== 'number' || balance < estimatedCredits) throw new Error('Not enough existing credits for this generation. No top-up was attempted.');
    cap('spend');
    receipt = { asset: args.asset, stage: args.stage, studioJob: args.job, requestSha256: fingerprint, status: 'submitting', createdAt: new Date().toISOString(), balanceBefore: balance };
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await save(join(out, `${args.stage}-request.json`), payload);
    const result = await request(endpoint, payload);
    if (typeof result.result !== 'string' || !result.result) throw new Error('Missing task ID; inspect the account before resubmitting.');
    receipt.taskId = result.result;
    receipt.status = 'submitted';
    await save(receiptPath, receipt);
  }
  const deadline = Date.now() + 15 * 60 * 1000;
  let lastProgress = '';
  while (Date.now() < deadline) {
    const task = await request(`${endpoint}/${encodeURIComponent(receipt.taskId)}`);
    const progress = `${task.status} ${task.progress ?? 0}%`;
    if (progress !== lastProgress) { console.log(`${args.asset} ${args.stage}: ${progress}`); lastProgress = progress; }
    Object.assign(receipt, { status: task.status, creditsConsumed: task.consumed_credits, checkedAt: new Date().toISOString() });
    await save(receiptPath, receipt);
    if (['FAILED', 'CANCELED', 'CANCELLED', 'EXPIRED'].includes(task.status)) throw new Error(`Task ${receipt.taskId} ended with ${task.status}; no paid replacement submitted.`);
    if (task.status === 'SUCCEEDED') {
      if (!task.model_urls?.glb) throw new Error('Completed task has no GLB URL.');
      const url = new URL(task.model_urls.glb);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Unexpected model download URL.');
      cap('network');
      // API credentials never accompany the signed asset-download request.
      const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error(`GLB download returned HTTP ${response.status}; resume the same stage to refresh its URL.`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('The model is not a complete GLB 2.0 file.');
      await writeFile(join(out, `${args.stage}.glb.tmp`), bytes);
      await rename(join(out, `${args.stage}.glb.tmp`), join(out, `${args.stage}.glb`));
      Object.assign(receipt, { status: 'downloaded', bytes: bytes.length, modelSha256: hash(bytes) });
      await save(receiptPath, receipt);
      console.log(`Downloaded ${args.asset} ${args.stage}: ${bytes.length} bytes, ${receipt.creditsConsumed ?? 'unknown'} credits`);
      return;
    }
    await delay(5000);
  }
  throw new Error('Polling timed out. Resume the same command without creating another task.');
}

try { await main(); }
catch (error) {
  console.error(error instanceof Error ? error.message : 'Meshy authoring failed.');
  process.exitCode = 1;
}
