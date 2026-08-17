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

function thumbUrl(url, width = 960) {
  const src = String(url || '').trim();
  if (!src) return '';
  if (/\/commons\/thumb\//.test(src)) {
    return width === 960 ? src : src.replace(/\/\d+px-/, `/${width}px-`);
  }
  const original = src.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/i);
  if (!original) return src;
  const [, host, a, ab, file] = original;
  return `${host}/thumb/${a}/${ab}/${file}/${width}px-${file}`;
}

function sourceExtension(url) {
  try {
    const pathname = decodeURIComponent(new URL(url).pathname).toLowerCase();
    const match = pathname.match(/\.(png|jpe?g|webp)$/);
    if (!match) return 'jpg';
    return match[1] === 'jpeg' ? 'jpg' : match[1];
  } catch {
    return 'jpg';
  }
}

async function download(url, dest, { toWebp = false } = {}) {
  const tmp = `${dest}.source.part`;
  const encoded = `${dest}.encoded.part`;
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
      if (toWebp) {
        await execFileAsync('cwebp', ['-quiet', '-q', '95', '-m', '6', tmp, '-o', encoded], { timeout: 70000 });
        fs.unlinkSync(tmp);
        fs.renameSync(encoded, dest);
      } else {
        fs.renameSync(tmp, dest);
      }
      return fs.statSync(dest).size;
    } catch (err) {
      lastErr = err;
      for (const file of [tmp, encoded]) if (fs.existsSync(file)) fs.unlinkSync(file);
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
  const hires = process.argv.includes('--hires');
  const items = jobs();
  let canWebp = false;
  try {
    await execFileAsync('cwebp', ['-version'], { timeout: 5000 });
    canWebp = true;
  } catch {
    console.warn('WARN cwebp 不可用：PNG 将按 .png 原格式缓存，不再伪装成 .jpg');
  }
  let ok = 0;
  let skip = 0;
  let fail = 0;
  for (const item of items) {
    const url = hires ? thumbUrl(item.url, 1280) : item.url;
    const nativeExt = sourceExtension(url);
    const toWebp = nativeExt === 'png' && canWebp;
    const ext = toWebp ? 'webp' : nativeExt;
    const dest = path.join(mediaDir, `${item.id}${hires ? '@2x' : ''}.${ext}`);
    if (!force && fs.existsSync(dest) && fs.statSync(dest).size > 1024) {
      skip += 1;
      continue;
    }
    try {
      const bytes = await download(url, dest, { toWebp });
      ok += 1;
      console.log(`OK ${path.basename(dest)} ${bytes}B`);
      await sleep(1500);
    } catch (err) {
      fail += 1;
      console.error(`FAIL ${item.id} ${url}\n  ${err.message}`);
      await sleep(4000);
    }
  }
  console.log(`cached ${ok}, skipped ${skip}, failed ${fail}, total ${items.length}${hires ? ' (hires 1280px)' : ''}`);
  if (fail) process.exitCode = 1;
}

main();
