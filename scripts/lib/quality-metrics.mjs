// 北极星只计有匹配证据指纹的逐条录文对照记录；旧采纳状态不作核验凭据。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadCsv } from './csv.mjs';
import { DATA_MANIFEST } from './schema.mjs';
import { loadReviewContext } from './review.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const data = (name) => loadCsv(path.join(root, 'data', name));
const has = (value) => String(value ?? '').trim().length > 0;
// 指标缺料会让 STATUS 与版本指纹静默少算，一律报出声；判定本身不变。
const warned = new Set();
function warnOnce(key, message) {
  if (warned.has(key)) return;
  warned.add(key);
  console.error(`[quality-metrics] ${message}`);
}

function dirBytes(dir) {
  let total = 0;
  let files = 0;
  let topLevel = true;
  const walk = (current) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      if (topLevel) warnOnce(`dir:${dir}`, `${dir} 读不到，体积按 0 计`);
      return;
    }
    topLevel = false;
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        try {
          total += fs.statSync(full).size;
          files += 1;
        } catch { /* 忽略读不到的条目 */ }
      }
    }
  };
  walk(dir);
  return { bytes: total, files };
}

function buildCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

// 断言覆盖率：扫描 rules/*.mjs 里实际出现的 QH-A-XX-#### 前缀，
// 再用 claims 数据把前缀反查成朝次，避免在代码里维护第二份映射表。
function assertionCoverage() {
  const rulesDir = path.join(root, 'scripts', 'rules');
  const sources = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.mjs$/.test(entry.name)) sources.push(fs.readFileSync(full, 'utf8'));
    }
  };
  try {
    walk(rulesDir);
  } catch {
    warnOnce('rules', `${rulesDir} 读不到，断言覆盖按 0 计`);
  }
  const blob = sources.join('\n');
  const prefixes = [...new Set([...blob.matchAll(/QH-A-([A-Z]{2})-\d+/g)].map((m) => m[1]))];
  const ruleCount = [...blob.matchAll(/assertions\.push\(/g)].length;

  const claims = DATA_MANIFEST.filter((entry) => entry.kind === 'source_claims')
    .flatMap((entry) => data(entry.file));
  const prefixToReign = new Map();
  for (const row of claims) {
    const prefix = String(row['Assertion ID'] || '').match(/^QH-A-([A-Z]{2})-/)?.[1];
    if (prefix && !prefixToReign.has(prefix)) prefixToReign.set(prefix, row.reign || '');
  }
  const covered = [...new Set(prefixes.map((p) => prefixToReign.get(p)).filter(Boolean))].sort();
  return { rules: ruleCount, covered, coveredCount: covered.length };
}

// 「建议顺手抽查」积压：各章「## 待用户抽查」小节里的条目数。
function reviewBacklog() {
  const chapters = data('chapters.csv');
  let items = 0;
  const missing = [];
  for (const row of chapters) {
    let markdown = '';
    try {
      markdown = fs.readFileSync(path.join(root, 'content', row.file), 'utf8');
    } catch {
      missing.push(row.file);
      continue;
    }
    const block = markdown.split(/^## 待用户抽查\s*$/m)[1];
    if (!block) continue;
    for (const line of block.split(/^## /m)[0].split('\n')) {
      if (line.replace(/^\s*\d+\.\s*/, '').replace(/^\s*[-*]\s*/, '').trim()) items += 1;
    }
  }
  if (missing.length) warnOnce('backlog', `${missing.length} 章正文读不到，抽查积压少计：${missing.slice(0, 5).join(' ')}`);
  return items;
}

export function collectQualityMetrics() {
  const claims = DATA_MANIFEST.filter((entry) => entry.kind === 'source_claims')
    .flatMap((entry) => data(entry.file));
  const adopted = claims.filter((row) => row['状态'] === '已采纳').length;
  const review = loadReviewContext();
  const reviews = claims.map(row => review.inspect(row));
  const verified = reviews.filter(r => r.verified).length;
  const coverage = assertionCoverage();
  const dataDir = dirBytes(path.join(root, 'site', 'data'));
  const mediaDir = dirBytes(path.join(root, 'site', 'media'));

  return {
    // 北极星
    northStar: verified,
    registered: reviews.filter(r => r.registered).length,
    needsReview: reviews.filter(r => r.needsReview).length,
    claimsTotal: claims.length,
    adoptedRate: claims.length ? Math.round((verified / claims.length) * 1000) / 10 : 0,
    // 质量健康度
    assertionRules: coverage.rules,
    assertionCoverageEras: coverage.coveredCount,
    assertionCoveredReigns: coverage.covered,
    reviewBacklog: reviewBacklog(),
    // 体积与来源（仅上报，不入指纹）
    dataBytes: dataDir.bytes,
    dataFiles: dataDir.files,
    mediaBytes: mediaDir.bytes,
    mediaFiles: mediaDir.files,
    buildCommit: buildCommit(),
  };
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
