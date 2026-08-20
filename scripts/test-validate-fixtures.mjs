import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from './rules/common/structure.mjs';

const contentDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../content');
const errors = [];
const warnings = [];
const empty = [];

check({
  errors,
  warnings,
  contentDir,
  emperors: empty,
  portraits: empty,
  crosswalk: empty,
  people: empty,
  sources: empty,
  sourceIndex: empty,
  tasks: [{ task_id: 'TQ-X', 前置任务: 'TQ-MISSING' }],
  vocab: empty,
  units: empty,
  claims: empty,
  questions: empty,
  chapters: empty,
  lanes: empty,
  empressTimeline: empty,
  heirChain: empty,
  historicSites: empty,
  works: empty,
  conflictSets: empty,
  emperorTimeline: empty,
  imageRegions: [{ region_id: 'QH-IR-BAD', visual_id: 'QH-V-MISSING', assertion_id: 'QH-A-MISSING' }],
  iiifManifests: [{ visual_id: 'QH-V-MISSING2' }],
});

const joined = errors.join('\n');
let failed = 0;
function checkName(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ': ' + name);
  if (!cond) failed += 1;
}
checkName('坏样本触发未知画像', joined.includes('QH-IR-BAD') && joined.includes('QH-V-MISSING'));
checkName('坏样本触发未知主张外键', joined.includes('QH-A-MISSING'));
checkName('坏样本触发未知 IIIF 画像', joined.includes('QH-V-MISSING2'));
checkName('坏样本触发未知前置任务', joined.includes('TQ-MISSING'));
if (failed) {
  console.error(`validate fixture ${failed} 项失败`);
  process.exit(1);
}
console.log('validate fixture 全部通过');
