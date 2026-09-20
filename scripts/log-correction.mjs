// 勘误登记：把「读的时候发现的问题」落成一行可追踪的记录。
//
// 用途（本项目定位：历史爱好者资料站，不做具书核录，错误读到再改）：
//   读者（= 谢总）在某页看到不对劲 → 记一行 → 我按行改 → 标已修正。
//   这张表是勘误的**唯一账本**，不追求完备，只求「改过什么、为什么改」可回溯。
//
// 用法：
//   npm run errata -- --list
//   npm run errata -- --loc QH-A-YZ-0026 --text "年羹尧死法引文与卷9不吻合" [--now "..." ] [--source "清史稿卷9"] [--by "谢总"] [--degree 略知一二]
//
// 位置ID 可以填：主张 ID（QH-A-*）、冲突组 ID（QH-CF-*）、来源 ID（SRC-*）、
//   来源单元 ID（QH-SU-*）、人物 ID（QH-P-*）、章节 slug、或页面路由（如 #/claim/...）。
//   本脚本会尽力核对该 ID 是否存在；**核对失败只警告、仍写入**——宁可有记录，不要没记录。
// 只改这一张表，幂等：同一次调用不会重复写入同一 (位置ID + 纠错内容)。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 必须用 fileURLToPath，不能用 new URL(...).pathname——
// 本仓库路径含中文（自娱自乐），pathname 会返回百分号编码串，
// 于是 fs 会在一个「%E8%87%AA…」的假目录里建树并写入，而真实文件纹丝不动。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(root, 'data', 'community-corrections.csv');
const HEADER = ['correction_id', 'issue_number', '位置ID', '当前表述', '纠错内容', '证据来源', '提交人', '熟悉程度', '状态', '提交日期'];

const argv = process.argv.slice(2);
const flag = (name, fallback = '') => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

function readRows() {
  const raw = fs.readFileSync(FILE, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim());
  if (lines[0]?.split(',')[0].trim() === HEADER[0]) lines.shift(); // 去掉表头
  // 本表约定：LF、无 BOM、字段内不含 ASCII 逗号或引号。写入时沿用该约定，不引入引号风格。
  return lines.map((l) => {
    const cells = l.split(',');
    return Object.fromEntries(HEADER.map((h, i) => [h, cells[i] ?? '']));
  });
}

function csvLine(row) {
  for (const h of HEADER) {
    const v = String(row[h] ?? '');
    if (v.includes(',') || v.includes('"')) {
      throw new Error(`字段 ${h} 含 ASCII 逗号或引号，会破坏本表的无引号约定：${v}`);
    }
  }
  return HEADER.map((h) => row[h] ?? '').join(',');
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 位置ID 解析：尽量确认它指得到东西，但只警告
function resolveLocator(loc) {
  const loc_ = String(loc || '').trim();
  if (!loc_) return '位置ID 为空';
  const probe = (file, col) => {
    const p = path.join(root, 'data', file);
    if (!fs.existsSync(p)) return false;
    return fs.readFileSync(p, 'utf8').split('\n').slice(1).some((l) => l.split(',')[0].trim() === loc_);
  };
  if (loc_.startsWith('#')) {
    const slug = loc_.replace(/^#\/?(claim|conflict|source|person|chapter)\//, '').trim();
    const p = path.join(root, 'data', 'chapters.csv');
    if (fs.existsSync(p) && fs.readFileSync(p, 'utf8').includes(slug)) return true;
    return `页面路由 ${loc_} 未能在 chapters.csv 中确认（仍写入）`;
  }
  const tables = [
    ['source-claims.csv', '主张'], ['conflict-sets.csv', '冲突组'], ['source-rights-ledger.csv', '来源'],
    ['source-units.csv', '来源单元'], ['phase0-people.csv', '人物'], ['imperial-works.csv', '文献'],
    ['historic-sites.csv', '今地'], ['chapters.csv', '章节'],
  ];
  for (const [file, label] of tables) if (probe(file, label)) return true;
  return `位置ID ${loc_} 未能在任何数据表中确认（仍写入，请事后核对）`;
}

function main() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, `${HEADER.join(',')}\n`, 'utf8');
  const rows = readRows();

  if (has('list')) {
    const open = rows.filter((r) => r['状态'] !== '已修正');
    console.log(`勘误表共 ${rows.length} 行；未修正 ${open.length} 行。`);
    for (const r of rows) {
      console.log(`  ${r.correction_id}  [${r['状态'] || '（无状态）'}]  ${r['位置ID']}  ${r['纠错内容']}`);
    }
    return;
  }

  const loc = flag('loc');
  const text = flag('text');
  if (!loc || !text) {
    console.error('用法：npm run errata -- --loc <位置ID> --text "<发现的问题>" [--now "<当前表述>"] [--source "<依据>"] [--by <提交人>] [--degree <熟悉程度>]');
    console.error('查看全部：npm run errata -- --list');
    process.exitCode = 1;
    return;
  }

  if (rows.some((r) => r['位置ID'] === loc && r['纠错内容'] === text)) {
    console.log('已存在同一 (位置ID + 纠错内容) 的记录，未重复写入。');
    return;
  }

  const seq = rows.length + 1;
  const row = {
    correction_id: `ERR-${String(seq).padStart(3, '0')}`,
    issue_number: flag('issue'),
    位置ID: loc,
    '当前表述': flag('now'),
    '纠错内容': text,
    '证据来源': flag('source'),
    '提交人': flag('by', '谢总'),
    '熟悉程度': flag('degree', '略知一二'),
    状态: flag('status', '待处理'),
    '提交日期': today(),
  };

  const note = resolveLocator(loc);
  fs.appendFileSync(FILE, `${csvLine(row)}\n`, 'utf8');
  console.log(`已登记 ${row.correction_id}：${row['位置ID']} — ${row['纠错内容']}`);
  if (note !== true) console.warn(`⚠ ${note}`);
  console.log('下一步：改完源文件后把该行 `状态` 改为「已修正」，并跑 npm run validate && npm run build。');
}

main();
