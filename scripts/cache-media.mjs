import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadCsv } from './lib/csv.mjs';

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const dataDir = path.join(root, 'data');
const mediaDir = path.join(root, 'site', 'media');
const UA = 'QingHistoryPhase0/1.0 (local research; cache-media.mjs; https://127.0.0.1:8765/)';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function thumbUrl(url) {
  const src = String(url || '').trim();
  if (!src) return '';
  if (/\/commons\/thumb\//.test(src)) return src;
  const original = src.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/i);
  if (!original) return src;
  const [, host, a, ab, file] = original;
  return `${host}/thumb/${a}/${ab}/${file}/960px-${file}`;
}

async function download(url, dest) {
  const tmp = `${dest}.part`;
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await execFileAsync('curl', [
        '-fsSL',
        '--retry', '3',
        '--retry-delay', '2',
        '-A', UA,
        '--max-time', '60',
        '-o', tmp,
        url,
      ], { timeout: 70000 });
      const size = fs.statSync(tmp).size;
      if (size < 1024) throw new Error(`too small: ${size}B`);
      fs.renameSync(tmp, dest);
      return size;
    } catch (err) {
      lastErr = err;
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      await sleep(5000 * attempt);
    }
  }
  throw lastErr || new Error('retry exhausted');
}

function jobs() {
  const portraits = loadCsv(path.join(dataDir, 'emperor-portraits.csv'));
  const sites = loadCsv(path.join(dataDir, 'historic-sites.csv'));
  const out = [];
  for (const row of portraits) {
    if (row['权利颜色'] !== '绿' || row['可本地保存'] !== '是' || !row['预览文件']) continue;
    out.push({
      id: row.visual_id,
      url: thumbUrl(row['预览文件']),
      first: row['展示角色'] === '默认朝服像',
    });
  }
  for (const row of sites) {
    if (row['权利颜色'] !== '绿' || !row['预览文件']) continue;
    out.push({ id: row.site_id, url: thumbUrl(row['预览文件']), first: false });
  }
  out.sort((a, b) => Number(b.first) - Number(a.first));
  return out;
}

async function main() {
  fs.mkdirSync(mediaDir, { recursive: true });
  const force = process.argv.includes('--force');
  const items = jobs();
  let ok = 0;
  let skip = 0;
  let fail = 0;
  for (const item of items) {
    const dest = path.join(mediaDir, `${item.id}.jpg`);
    if (!force && fs.existsSync(dest) && fs.statSync(dest).size > 1024) {
      skip += 1;
      continue;
    }
    try {
      const bytes = await download(item.url, dest);
      ok += 1;
      console.log(`OK ${item.id} ${bytes}B`);
      await sleep(1500);
    } catch (err) {
      fail += 1;
      console.error(`FAIL ${item.id} ${item.url}\n  ${err.message}`);
      await sleep(4000);
    }
  }
  console.log(`cached ${ok}, skipped ${skip}, failed ${fail}, total ${items.length}`);
  if (fail) process.exitCode = 1;
}

main();
