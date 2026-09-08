#!/usr/bin/env node
/** Offline asset authoring only. The browser game never contacts Tripo. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { parseArgs, parseEnv } from 'node:util';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../../', import.meta.url));
const api = 'https://openapi.tripo3d.ai/v3';
const { values: args } = parseArgs({ options: {
  asset: { type: 'string' }, job: { type: 'string' },
  'env-file': { type: 'string' }, run: { type: 'string', default: 'first-pass' },
  'dry-run': { type: 'boolean', default: false },
  balance: { type: 'boolean', default: false },
} });
const catalog = JSON.parse(await readFile(new URL('./assets.json', import.meta.url), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const cap = capability => {
  if (!args.job) throw new Error('Supply --job with the active Studio job.');
  execFileSync('studio', ['cap', args.job, capability], { stdio: 'pipe' });
};
const save = async (path, data) => {
  const temp = `${path}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  await rename(temp, path);
};
const readOptional = async path => {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};

async function main() {
  if (!args.balance && !Object.hasOwn(catalog.assets, args.asset ?? '')) {
    throw new Error(`Choose --asset from: ${Object.keys(catalog.assets).join(', ')}`);
  }
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(args.run)) throw new Error('Use a short slug for --run.');
  const payload = args.asset ? { ...catalog.defaults, ...catalog.assets[args.asset] } : null;
  if (payload && (payload.prompt.length > 1024 || payload.negative_prompt.length > 255)) throw new Error('Prompt exceeds Tripo limits.');
  if (args['dry-run']) {
    console.log(JSON.stringify({ endpoint: args.balance ? `${api}/account/balance` : `${api}/generation/text-to-model`, payload }, null, 2));
    return;
  }
  const localEnv = args['env-file'] ? parseEnv(await readFile(resolve(args['env-file']), 'utf8')) : {};
  const key = localEnv.TRIPO_API_KEY || process.env.TRIPO_API_KEY;
  if (!key?.trim()) throw new Error('TRIPO_API_KEY is missing. Set it in the environment or supply a local --env-file.');
  // A credential stays on the fixed Tripo API origin, never on a CDN request.
  const request = async (path, body) => {
    cap('network');
    const response = await fetch(`${api}${path}`, {
      method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(45000),
      headers: { Authorization: `Bearer ${key.trim()}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`Tripo returned HTTP ${response.status}.`);
    const result = await response.json();
    if (result.code !== 0 || !result.data) throw new Error(`Tripo rejected the request (code ${result.code}).`);
    return result.data;
  };
  if (args.balance) {
    const data = await request('/account/balance');
    console.log(JSON.stringify({ balance: data.balance, frozen: data.frozen }));
    return;
  }
  const out = join(root, 'outputs/tripo', args.run, args.asset);
  await mkdir(out, { recursive: true });
  const receiptPath = join(out, 'receipt.json');
  const fingerprint = hash(JSON.stringify(payload));
  let receipt = await readOptional(receiptPath);
  if (receipt && receipt.requestSha256 !== fingerprint) throw new Error('The prompt changed. Use a new --run slug to preserve the existing task.');
  if (receipt?.status === 'downloaded') {
    const bytes = await readFile(join(out, 'source.glb'));
    if (hash(bytes) !== receipt.modelSha256) throw new Error('Downloaded model hash no longer matches its receipt.');
    console.log(`Already downloaded: ${join(out, 'source.glb')}`);
    return;
  }
  if (receipt && !receipt.taskId) throw new Error('A prior submission has an uncertain result. Check the Tripo account before creating another paid task.');
  if (!receipt) {
    const balance = await request('/account/balance');
    console.log(`Available credits: ${balance.balance}; reserved: ${balance.frozen}`);
    cap('spend');
    receipt = { asset: args.asset, studioJob: args.job, requestSha256: fingerprint, status: 'submitting', createdAt: new Date().toISOString() };
    // Claim the output first. A second process or a lost POST reply must not create duplicate charges.
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await save(join(out, 'request.json'), payload);
    const submitted = await request('/generation/text-to-model', payload);
    if (typeof submitted.task_id !== 'string' || !submitted.task_id) throw new Error('No task id returned; do not repeat this submission.');
    receipt.taskId = submitted.task_id;
    receipt.status = 'submitted';
    await save(receiptPath, receipt);
  }
  const deadline = Date.now() + 10 * 60 * 1000;
  let lastProgress = '';
  while (Date.now() < deadline) {
    const task = await request(`/tasks/${encodeURIComponent(receipt.taskId)}`);
    const progress = `${task.status} ${task.progress ?? 0}%`;
    if (progress !== lastProgress) { console.log(`${args.asset}: ${progress}`); lastProgress = progress; }
    receipt.status = task.status;
    receipt.creditsConsumed = task.credits_consumed;
    receipt.checkedAt = new Date().toISOString();
    await save(receiptPath, receipt);
    if (['failed', 'cancelled', 'banned', 'expired', 'unknown'].includes(task.status)) {
      throw new Error(`Task ${receipt.taskId} ended with ${task.status}; no automatic replacement submitted.`);
    }
    if (task.status === 'success') {
      if (!task.output?.model_url) throw new Error('Successful task has no model_url.');
      const url = new URL(task.output.model_url);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Unexpected download URL.');
      cap('network');
      const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error(`Model download returned HTTP ${response.status}. Resume the same run to refresh the URL.`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Downloaded asset is not a complete GLB 2.0 file.');
      await writeFile(join(out, 'source.glb.tmp'), bytes);
      await rename(join(out, 'source.glb.tmp'), join(out, 'source.glb'));
      Object.assign(receipt, { status: 'downloaded', bytes: bytes.length, modelSha256: hash(bytes) });
      await save(receiptPath, receipt);
      console.log(`Saved ${join(out, 'source.glb')} (${bytes.length} bytes)`);
      return;
    }
    await delay(5000);
  }
  throw new Error('Polling timed out. Rerun the same command to resume this task without a new charge.');
}

try { await main(); }
catch (error) {
  // Avoid emitting fetch internals, headers, URLs with signatures, or dotenv contents.
  console.error(error instanceof Error ? error.message : 'Tripo authoring failed.');
  process.exitCode = 1;
}
