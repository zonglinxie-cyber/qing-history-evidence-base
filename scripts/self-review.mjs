// 自审（单人自用版）：有逐字引文 + 卷页定位 + 无冲突组 → 已采纳；有冲突组或缺引文/定位 → 审核中。
// 只改「状态 / 编辑备注」两列，幂等。不再区分 A1/A2/C 级、「复核人」「复核日期」与多源家族门禁。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './lib/csv.mjs';
import { DATA_MANIFEST } from './lib/schema.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../data');

function esc(cell) {
  const s = String(cell ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function serialize(rows) {
  return rows.map((r) => r.map(esc).join(',')).join('\n') + '\n';
}

const claimFiles = DATA_MANIFEST.filter((e) => e.kind === 'source_claims').map((e) => e.file);
const stats = { adopted: 0, kept: 0, untouched: 0 };

for (const f of claimFiles) {
  const rows = parseCsv(fs.readFileSync(path.join(dataDir, f), 'utf8'));
  const h = rows[0];
  const col = {
    status: h.indexOf('状态'),
    conflict: h.indexOf('冲突组 ID'),
    quote: h.indexOf('支持引文'),
    loc: h.indexOf('卷页/档号/图像定位'),
    note: h.indexOf('编辑备注'),
  };
  let adoptedNow = 0;
  for (const r of rows.slice(1)) {
    const cur = (r[col.status] || '').trim();
    if (cur === '已采纳') { stats.untouched++; continue; }
    const conflict = String(r[col.conflict] || '').trim();
    const quote = String(r[col.quote] || '').trim();
    const loc = String(r[col.loc] || '').trim();
    let next; let reason;
    if (conflict) { next = '审核中'; reason = '自审：入冲突组，并列保存不裁决'; }
    else if (quote && loc) { next = '已采纳'; reason = '自审：有逐字引文与卷页定位，采纳'; }
    else { next = '审核中'; reason = '自审：缺引文或卷页定位，待补'; }
    r[col.status] = next;
    if (next === '已采纳') { adoptedNow++; stats.adopted++; } else { stats.kept++; }
    if (!String(r[col.note] || '').trim()) r[col.note] = reason;
  }
  fs.writeFileSync(path.join(dataDir, f), serialize(rows));
  console.log(`${f}: 采纳 ${adoptedNow} 行（共 ${rows.length - 1} 行）`);
}
console.log(`汇总 adopted=${stats.adopted} kept=${stats.kept} untouched=${stats.untouched}`);