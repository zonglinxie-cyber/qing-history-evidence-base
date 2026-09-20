// 根据数据覆盖指纹自动维护 VERSION、CHANGELOG.md 与 site/data/release.json。
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { collectReleaseMetrics, METRIC_LABELS } from './lib/release-metrics.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionPath = path.join(root, 'VERSION');
const snapshotPath = path.join(root, 'data', 'release-snapshot.json');
const changelogPath = path.join(root, 'CHANGELOG.md');
const readmePath = path.join(root, 'README.md');
const packagePath = path.join(root, 'package.json');
const releaseJsonPath = path.join(root, 'site', 'data', 'release.json');

function readVersion() {
  return fs.readFileSync(versionPath, 'utf8').trim();
}

function writeVersion(version) {
  fs.writeFileSync(versionPath, `${version}\n`);
}

function bumpPatch(version) {
  const parts = version.split('.').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    throw new Error(`VERSION 格式无效：${version}`);
  }
  parts[2] += 1;
  return parts.join('.');
}

function todayLocal() {
  return new Date().toISOString().slice(0, 10);
}

function fingerprintMetrics(metrics) {
  const payload = METRIC_LABELS.map(([key]) => `${key}=${metrics[key]}`).join('|');
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

function diffMetrics(previous = {}, current = {}) {
  return METRIC_LABELS
    .map(([key, label]) => {
      const oldValue = previous[key];
      const newValue = current[key];
      if (oldValue === newValue) return null;
      // 新增/移除指标也要报出来，否则只会落成一句「指标组合更新」，读的人不知道变了什么。
      if (oldValue === undefined) return `${label}：新增 ${newValue}`;
      if (newValue === undefined) return `${label}：移除（原 ${oldValue}）`;
      return `${label}：${oldValue} → ${newValue}`;
    })
    .filter(Boolean);
}

function parseChangelog(markdown) {
  const entries = [];
  const sections = markdown.split(/^## /m).slice(1);
  for (const section of sections) {
    const [headingLine, ...bodyLines] = section.split('\n');
    const match = headingLine.trim().match(/^(\d+\.\d+\.\d+)\s*[—–-]\s*(\d{4}-\d{2}-\d{2})/);
    if (!match) continue;
    const changes = bodyLines
      .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
      .filter((line) => line && !line.startsWith('>'));
    entries.push({ version: match[1], date: match[2], changes });
  }
  return entries;
}

function formatChangelogEntry(version, date, changes) {
  const lines = changes.map((line) => `- ${line}`);
  return `## ${version} — ${date}\n\n${lines.join('\n')}\n\n`;
}

function prependChangelogEntry(version, date, changes) {
  const header = `# 更新日志

> 本页由 \`npm run release\` 根据数据覆盖变化自动维护；版本号见根目录 \`VERSION\`。请勿手改数字行。

`;
  let body = '';
  try {
    body = fs.readFileSync(changelogPath, 'utf8');
  } catch { /* first run */ }
  const rest = body.startsWith('# 更新日志')
    ? body.replace(/^# 更新日志[\s\S]*?\n\n(?=## )/, '')
    : body;
  fs.writeFileSync(changelogPath, header + formatChangelogEntry(version, date, changes) + rest);
}

function updateReadmeVersion(version) {
  if (!fs.existsSync(readmePath)) return;
  const readme = fs.readFileSync(readmePath, 'utf8');
  const next = readme.replace(
    /^版本：`[^`]+`.*$/m,
    `版本：\`${version}\`（[\`CHANGELOG.md\`](CHANGELOG.md) 由显式 release 命令维护）`,
  );
  if (next !== readme) fs.writeFileSync(readmePath, next);
}

function updatePackageVersion(version) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (pkg.version === version) return;
  pkg.version = version;
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function ensureInitialChangelog(version, metrics) {
  if (fs.existsSync(changelogPath)) return;
  const summary = METRIC_LABELS
    .slice(0, 4)
    .map(([key, label]) => `${label} ${metrics[key]}`)
    .join(' · ');
  prependChangelogEntry(version, '2026-08-12', [
    '开闸 v0.1：全量数据可浏览、存疑标记、校验门禁分级',
    summary,
  ]);
}

if (process.argv.includes('--render-only')) {
  const version = readVersion();
  const entries = parseChangelog(fs.readFileSync(changelogPath, 'utf8'));
  const updatedAt = entries.find(e => e.version === version)?.date || '';
  fs.mkdirSync(path.dirname(releaseJsonPath), { recursive: true });
  fs.writeFileSync(releaseJsonPath, JSON.stringify({ version, updatedAt, entries }, null, 2) + '\n');
  console.log('Projected release.json without modifying release sources');
  process.exit(0);
}
const metrics = collectReleaseMetrics();
const fingerprint = fingerprintMetrics(metrics);
let version = readVersion();
let snapshot = null;

try {
  snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
} catch { /* first run */ }

ensureInitialChangelog(version, metrics);

const fingerprintChanged = !snapshot || snapshot.fingerprint !== fingerprint;
// 指纹未变时保留既有 updatedAt，避免 release → home.json → assetStamp 链每天漂移、CI 可重复检查失败
const date = fingerprintChanged ? todayLocal() : snapshot.updatedAt;
const changes = snapshot ? diffMetrics(snapshot.metrics, metrics) : [];

if (snapshot && snapshot.fingerprint !== fingerprint) {
  if (!changes.length) {
    changes.push('数据指纹变化（指标组合更新）');
  }
  version = bumpPatch(version);
  writeVersion(version);
  prependChangelogEntry(version, date, changes);
  console.log(`Release bumped to ${version}: ${changes.join('；')}`);
} else if (!snapshot) {
  console.log(`Release initialized at ${version}`);
}

const snapshotOut = {
  version,
  fingerprint,
  metrics,
  updatedAt: date,
};
fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshotOut, null, 2)}\n`);

const entries = parseChangelog(fs.readFileSync(changelogPath, 'utf8'));
fs.mkdirSync(path.dirname(releaseJsonPath), { recursive: true });
fs.writeFileSync(releaseJsonPath, `${JSON.stringify({ version, updatedAt: date, entries }, null, 2)}\n`);

updateReadmeVersion(version);
updatePackageVersion(version);

console.log(`Wrote CHANGELOG.md, VERSION (${version}), release.json (${entries.length} entries)`);
