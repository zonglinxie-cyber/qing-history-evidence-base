import assert from 'node:assert/strict';
import { inspectReview, evidenceFingerprint } from './lib/review.mjs';
const claim = {'Assertion ID':'TEST', '状态':'已采纳', '支持引文':'原句', '卷页/档号/图像定位':'卷一', '客体 ID 或值':'记录'};
const unit = {source_unit_id:'U', stable_locator:'卷一'}, source = {source_id:'S'};
const baseline = {TEST:evidenceFingerprint(claim,unit,source)};
assert.equal(inspectReview(claim,unit,source,baseline).verified,false);
assert.equal(inspectReview({...claim, '支持引文':''},unit,source,baseline).needsReview,true);
assert.equal(inspectReview(claim,{...unit,stable_locator:'卷二'},source,baseline).needsReview,true);
for (const status of ['已驳回','已废弃']) {
  const row={...claim,'状态':status}; const result=inspectReview(row,unit,source,baseline);
  assert.equal(result.label,status); assert.equal(result.verified,false); assert.equal(row['状态'],status);
}
const records={TEST:{fingerprint:baseline.TEST,result:'录文已对照',reviewer:'测试样本',checkedAt:'2026-09-15',note:'只用于测试'}};
assert.equal(inspectReview(claim,unit,source,baseline,records).verified,true);
assert.equal(inspectReview({...claim,'客体 ID 或值':'变化'},unit,source,baseline,records).verified,false);
console.log('PASS: 字段齐全不核实、撤销决定保护、引文/来源/主张变化使复核失效');

const renewed={...claim,'客体 ID 或值':'重新核对的记录'};
const renewedRecords={TEST:{...records.TEST,fingerprint:evidenceFingerprint(renewed,unit,source)}};
assert.equal(inspectReview(renewed,unit,source,baseline,renewedRecords).needsReview,false);

// 整合检查：构建派生字段不得改变原始证据指纹。
const fs = await import('node:fs');
const {loadReviewContext} = await import('./lib/review.mjs');
const {loadCsv} = await import('./lib/csv.mjs');
const {DATA_MANIFEST} = await import('./lib/schema.mjs');
const ctx = loadReviewContext();
const originals=new Map(DATA_MANIFEST.filter(e=>e.kind==='source_claims').flatMap(e=>loadCsv(new URL('../data/'+e.file,import.meta.url))).map(r=>[r['Assertion ID'],r]));
const built=JSON.parse(fs.readFileSync(new URL('../site/data/d-qing.json',import.meta.url),'utf8'));
for(const row of built.claims) assert.deepEqual(row.review,ctx.inspect(originals.get(row['Assertion ID'])),row['Assertion ID']);
console.log('PASS: 网页的逐条审核结果与原始 CSV 检查完全一致');
