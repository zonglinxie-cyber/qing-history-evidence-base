// 字段登记、编辑决定、来源对照是三个独立信号。
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCsv } from './csv.mjs';
import { DATA_MANIFEST } from './schema.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export function evidenceFingerprint(claim, unit, source) {
  return createHash('sha256').update(JSON.stringify(canonical({ claim, unit: unit || null, source: source || null }))).digest('hex');
}
export function inspectReview(claim, unit, source, baseline = {}, records = {}) {
  const id = claim['Assertion ID'];
  const fingerprint = evidenceFingerprint(claim, unit, source);
  const registered = Boolean(claim['支持引文']?.trim() && claim['卷页/档号/图像定位']?.trim() && unit && source);
  const protectedDecision = ['已驳回', '已废弃'].includes(claim['状态']);
  const record = records[id];
  const verified = registered && !protectedDecision && record?.fingerprint === fingerprint
    && record?.result === '录文已对照' && Boolean(record?.reviewer?.trim())
    && /^\d{4}-\d{2}-\d{2}$/.test(record?.checkedAt || '') && Boolean(record?.note?.trim());
  const changed = !verified && (Boolean(baseline[id] && baseline[id] !== fingerprint) || Boolean(record && record.fingerprint !== fingerprint));
  const needsReview = !protectedDecision && (!registered || changed);
  const label = protectedDecision ? claim['状态'] : needsReview ? '依据变化或缺项，需复核'
    : verified ? '录文已对照（不等于事件已证实）' : '引文已登记，未登记逐条复核';
  return { fingerprint, registered, verified, changed, needsReview, label, editorialStatus: claim['状态'] || '草稿' };
}
export function loadReviewContext() {
  const rows = kind => DATA_MANIFEST.filter(e => e.kind === kind).flatMap(e => loadCsv(path.join(root, 'data', e.file)));
  const units = new Map(rows('source_units').map(r => [r.source_unit_id, r]));
  const sources = new Map(rows('sources').map(r => [r.source_id, r]));
  // 缺少或损坏的审核文件应显式失败，不能回落成“已核实”。
  const baseline = JSON.parse(fs.readFileSync(path.join(root, 'data/claim-review-baseline.json'), 'utf8')).fingerprints;
  const records = JSON.parse(fs.readFileSync(path.join(root, 'data/review-records.json'), 'utf8')).records;
  if (!baseline || typeof baseline !== 'object' || Array.isArray(baseline) || !records || typeof records !== 'object' || Array.isArray(records)) throw new Error('审核文件必须含 fingerprints / records 对象');
  return { inspect(claim) { const unit = units.get(claim['来源实体 ID']); return inspectReview(claim, unit, sources.get(unit?.source_entity_id), baseline, records); } };
}
