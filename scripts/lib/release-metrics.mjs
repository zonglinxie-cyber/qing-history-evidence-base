// 发布指纹：与 STATUS.md 同源的核心覆盖指标，供 build-release / build-status 共用。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCsv } from './csv.mjs';
import { DATA_MANIFEST } from './schema.mjs';
import { isChapterIndexable, isChapterEvidenceClosed } from '../../site/templates.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const data = (name) => loadCsv(path.join(root, 'data', name));

export const METRIC_LABELS = [
  ['chapters', '可读章节'],
  ['claims', '结构化主张'],
  ['adopted', '正式采纳主张'],
  ['pending', '审核中主张'],
  ['people', '人物档'],
  ['sourceIndex', '来源索引'],
  ['questions', '黄金问题'],
  ['sourceBoundChapters', '绑定来源单元的章节'],
  ['indexableChapters', '进入 sitemap 的章节'],
  ['evidenceClosedChapters', '证据闭环章节'],
];

export function collectReleaseMetrics() {
  const emperors = data('qing-emperors.csv');
  const crosswalk = data('entity-id-crosswalk.csv');
  const people = data('phase0-people.csv');
  const claims = DATA_MANIFEST.filter((entry) => entry.kind === 'source_claims')
    .flatMap((entry) => data(entry.file));
  const chapters = data('chapters.csv');
  const sourceIndex = data('qing-emperor-source-index.csv');
  const questions = data('golden-questions.csv');
  const emperorPeople = new Set(crosswalk.map((row) => row.person_id));
  const emperorsWithClaims = new Set(
    claims.filter((row) => emperorPeople.has(row['主体 ID'])).map((row) => row['主体 ID']),
  );
  const adopted = claims.filter((row) => row['状态'] === '已采纳').length;
  const pending = claims.filter((row) => row['状态'] === '审核中').length;
  const sourceBoundChapters = chapters.filter((row) => String(row.unit_ids || '').trim()).length;
  const indexableChapters = chapters.filter((row) => isChapterIndexable(row)).length;
  const evidenceClosedChapters = chapters.filter((row) => {
    const unitCount = String(row.unit_ids || '').split(/[；;]/).map((id) => id.trim()).filter(Boolean).length;
    let markdown = '';
    try {
      markdown = fs.readFileSync(path.join(root, 'content', row.file), 'utf8');
    } catch { /* empty */ }
    const chapterStatus = (markdown.match(/^状态：\s*(.+)$/m)?.[1] || '').replace(/`/g, '').trim();
    return isChapterEvidenceClosed(chapterStatus, unitCount);
  }).length;

  return {
    emperors: emperors.length,
    emperorsWithClaims: emperorsWithClaims.size,
    chapters: chapters.length,
    claims: claims.length,
    adopted,
    pending,
    people: people.length,
    sourceIndex: sourceIndex.length,
    questions: questions.length,
    sourceBoundChapters,
    indexableChapters,
    evidenceClosedChapters,
  };
}
