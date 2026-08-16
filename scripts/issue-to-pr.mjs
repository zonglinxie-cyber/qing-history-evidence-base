// 结构化纠错 Issue → 自动 PR：解析 correction-claim 表单，生成 community-corrections.csv 行并开 PR。
// 贡献者全程不碰命令行；数据纠错进入审核队列，不直接污染主张表。
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from './lib/csv.mjs';

const MAX_CELL = 2000;

function toCsv(rows) {
  const esc = (v) => {
    let s = String(v ?? '');
    if (s.length > MAX_CELL) s = s.slice(0, MAX_CELL);
    // Excel/Sheets 会把 =+-@ 及制表/回车开头的单元格当公式；本库会导出 xlsx
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\n') + '\n';
}

const HEADER = ['correction_id', 'issue_number', '位置ID', '当前表述', '纠错内容', '证据来源', '提交人', '熟悉程度', '状态', '提交日期'];

function parseForm(body) {
  const fields = {};
  let current = null;
  for (const line of String(body || '').split('\n')) {
    const m = line.match(/^###\s+(.+?)\s*$/);
    if (m) { current = m[1]; fields[current] = ''; continue; }
    if (current) fields[current] += (fields[current] ? '\n' : '') + line;
  }
  const clean = (k) => String(fields[k] || '').trim().replace(/^_.*_$/s, '');
  return {
    location: clean('出错位置'),
    current: clean('当前表述'),
    correction: clean('你的修正'),
    evidence: clean('证据来源'),
    familiarity: clean('你与该材料的熟悉程度'),
  };
}

const issueNumber = process.env.ISSUE_NUMBER || '';
const issueAuthor = process.env.ISSUE_AUTHOR || 'unknown';
const form = parseForm(process.env.ISSUE_BODY);
if (!form.location && !form.correction) {
  console.log('非结构化纠错表单，跳过。');
  process.exit(0);
}

const file = path.resolve(process.argv[2] || 'data/community-corrections.csv');
let rows;
if (fs.existsSync(file)) {
  rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (JSON.stringify(rows[0]) !== JSON.stringify(HEADER)) rows = [HEADER, ...rows.slice(1)];
} else {
  rows = [HEADER];
}
const correctionId = `CR-${String(issueNumber).padStart(5, '0')}`;
if (rows.slice(1).some((r) => r[0] === correctionId)) {
  console.log(`纠错行 ${correctionId} 已存在，跳过。`);
  process.exit(0);
}
const idMatch = String(form.location).match(/QH-[A-Z]+-[A-Z0-9]+(?:-\d+[A-Z]?)?/);
rows.push([
  correctionId,
  issueNumber,
  idMatch ? idMatch[0] : form.location,
  form.current,
  form.correction,
  form.evidence,
  issueAuthor,
  form.familiarity,
  '审核中',
  new Date().toISOString().slice(0, 10),
]);
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, toCsv(rows));
console.log(`已生成纠错行 CR-${String(issueNumber).padStart(5, '0')}（位置 ${idMatch ? idMatch[0] : '未识别'}），等待维护者升格为主张。`);
