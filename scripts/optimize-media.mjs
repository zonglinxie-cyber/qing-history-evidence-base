import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mediaDir = path.resolve(scriptDir, '../site/media');
const FORCE = process.argv.includes('--force');
const LIMIT = 600 * 1024;
const JPEG_QUALITY = 78;
const JPEG_COMPRESS = 72;
const WEBP_QUALITY = 80;
const WEBP_COMPRESS = 75;

function isWidthVariant(name) {
  return /-(?:480|960|1280)\.(jpe?g|png|webp)$/i.test(name);
}

function isBaseName(name) {
  // `-D1`/`-D2` 细节图给遗址详情卡用（qing-content.js 的 SITE_DETAILS），
  // 页面只取原尺寸档，不为它们再生 480/960 变体——曾生成过一批无人引用的孤儿文件。
  return /^(QH-[A-Z0-9-]+)\.(jpe?g|png|webp)$/i.test(name)
    && !/@2x/i.test(name)
    && !/-D\d+\./i.test(name)
    && !isWidthVariant(name);
}

async function pixelWidth(file) {
  const { stdout } = await execFileAsync('sips', ['-g', 'pixelWidth', file], { timeout: 15000 });
  const match = stdout.match(/pixelWidth:\s+(\d+)/);
  return match ? Number(match[1]) : 0;
}

async function hasBin(bin) {
  try {
    await execFileAsync(bin, bin === 'sips' ? ['-h'] : ['-version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

let tempSeq = 0;
function tempPath(ext) {
  tempSeq += 1;
  return path.join(os.tmpdir(), `qh-media-${process.pid}-${tempSeq}${ext}`);
}

async function writeJpeg(src, dest, { width, quality }) {
  const args = ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(quality)];
  if (width) args.push('--resampleWidth', String(width));
  args.push(src, '--out', dest);
  await execFileAsync('sips', args, { timeout: 60000 });
}

async function writeWebp(src, dest, { width, quality }) {
  const args = ['-quiet', '-q', String(quality)];
  if (width) args.push('-resize', String(width), '0');
  args.push(src, '-o', dest);
  await execFileAsync('cwebp', args, { timeout: 60000 });
}

async function writeVariant(src, dest, { width, quality, ext }) {
  if (ext === '.webp') await writeWebp(src, dest, { width, quality });
  else await writeJpeg(src, dest, { width, quality });
}

function replaceIfBetter(tmp, dest, { limit = LIMIT, minRatio = 0.28 } = {}) {
  if (!fs.existsSync(tmp)) return false;
  const next = fs.statSync(tmp).size;
  const prev = fs.existsSync(dest) ? fs.statSync(dest).size : Infinity;
  const under = next <= limit;
  const smaller = next < prev;
  if (next < 2048 || next < prev * minRatio || (!under && !smaller) || (next > prev && !under)) {
    fs.unlinkSync(tmp);
    return false;
  }
  if (!smaller && !under) {
    fs.unlinkSync(tmp);
    return false;
  }
  fs.renameSync(tmp, dest);
  return true;
}

async function encodeWithBudget(src, dest, { width, ext, startQuality }) {
  let quality = startQuality;
  let best = null;
  while (quality >= 50) {
    const tmp = tempPath(ext);
    await writeVariant(src, tmp, { width, quality, ext });
    const size = fs.statSync(tmp).size;
    if (!best || size < best.size) {
      if (best) fs.unlinkSync(best.file);
      best = { file: tmp, size, quality };
    } else {
      fs.unlinkSync(tmp);
    }
    if (size <= LIMIT) break;
    quality -= 8;
  }
  if (!best) return false;
  fs.renameSync(best.file, dest);
  return true;
}

async function main() {
  if (!(await hasBin('sips'))) {
    console.error('需要 macOS sips 才能生成本地宽度档');
    process.exit(1);
  }
  const canWebp = await hasBin('cwebp');
  const files = fs.readdirSync(mediaDir).filter((name) => !name.startsWith('.'));
  const bases = files.filter(isBaseName);
  let made = 0;
  let skipped = 0;
  let compressed = 0;

  for (const name of bases) {
    const ext = path.extname(name).toLowerCase();
    const id = name.slice(0, -ext.length);
    const basePath = path.join(mediaDir, name);
    const hiName = files.find((item) => item.toLowerCase() === `${id}@2x${ext}`.toLowerCase());
    const source = hiName ? path.join(mediaDir, hiName) : basePath;
    const sourceWidth = await pixelWidth(source);
    if (!sourceWidth) {
      console.warn(`SKIP ${name}: 读不到宽度`);
      continue;
    }
    if (ext === '.webp' && !canWebp) {
      console.warn(`SKIP ${name}: 无 cwebp`);
      continue;
    }

    for (const width of [480, 960]) {
      if (sourceWidth < width) {
        skipped += 1;
        continue;
      }
      const dest = path.join(mediaDir, `${id}-${width}${ext}`);
      if (!FORCE && fs.existsSync(dest) && fs.statSync(dest).size > 2048) {
        skipped += 1;
        continue;
      }
      const quality = ext === '.webp' ? WEBP_QUALITY : JPEG_QUALITY;
      await encodeWithBudget(source, dest, { width, ext, startQuality: quality });
      made += 1;
      console.log(`OK ${path.basename(dest)} ${fs.statSync(dest).size}B`);
    }
  }

  const outliers = fs.readdirSync(mediaDir)
    .filter((name) => /\.(jpe?g|webp)$/i.test(name) && !name.startsWith('.'))
    .map((name) => path.join(mediaDir, name))
    .filter((file) => fs.statSync(file).size > LIMIT);

  for (const file of outliers) {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.webp' && !canWebp) continue;
    const before = fs.statSync(file).size;
    const startQuality = ext === '.webp' ? WEBP_COMPRESS : JPEG_COMPRESS;
    const tmp = tempPath(ext);
    try {
      await encodeWithBudget(file, tmp, { ext, startQuality });
      if (replaceIfBetter(tmp, file)) {
        compressed += 1;
        console.log(`COMPRESS ${path.basename(file)} ${before}B → ${fs.statSync(file).size}B`);
      } else {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
        console.log(`KEEP ${path.basename(file)} ${before}B`);
      }
    } catch (err) {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      console.warn(`FAIL compress ${path.basename(file)}: ${err.message}`);
    }
  }

  console.log(`variants ${made}, skipped ${skipped}, compressed ${compressed}`);
}

main();
