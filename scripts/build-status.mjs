// 从权威 CSV 生成项目状态页，避免 README 中的手工数字长期漂移。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCsv } from './lib/csv.mjs';
import { DATA_MANIFEST } from './lib/schema.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = (name) => loadCsv(path.join(root, 'data', name));
const countBy = (rows, field) => Object.fromEntries(
  [...rows.reduce((m, row) => m.set(row[field] || '空', (m.get(row[field] || '空') || 0) + 1), new Map())],
);

const emperors = data('qing-emperors.csv');
const crosswalk = data('entity-id-crosswalk.csv');
const people = data('phase0-people.csv');
const claims = DATA_MANIFEST.filter((entry) => entry.kind === 'source_claims')
  .flatMap((entry) => data(entry.file));
const chapters = data('chapters.csv');
const works = data('imperial-works.csv');
const sourceIndex = data('qing-emperor-source-index.csv');
const timeline = data('emperor-timeline.csv');
const questions = data('golden-questions.csv');
const emperorPeople = new Set(crosswalk.map((row) => row.person_id));
const emperorsWithClaims = new Set(claims.filter((row) => emperorPeople.has(row['主体 ID'])).map((row) => row['主体 ID']));
const status = countBy(claims, '状态');
const workState = countBy(works, 'open_state');
const timelineState = countBy(timeline, 'status');
const reviewed = claims.filter((row) => String(row['复核人'] || '').trim()).length;
const sourceBoundChapters = chapters.filter((row) => String(row.unit_ids || '').trim()).length;
const indexableChapters = chapters.filter((row) => {
  if (!String(row.unit_ids || '').trim()) return false;
  const markdown = fs.readFileSync(path.join(root, 'content', row.file), 'utf8');
  return /(^|\n)状态：.*E1\s*单源回查/.test(markdown);
}).length;

const md = `# 当前状态

> 本页由 \`npm run status\` 根据 CSV 自动生成，请勿手改数字。

## 核心覆盖

| 指标 | 当前值 |
|---|---:|
| 帝王骨架 | ${emperors.length} |
| 人物档 | ${people.length} |
| 来源索引 | ${sourceIndex.length} |
| 结构化主张 | ${claims.length} |
| 具名复核主张 | ${reviewed} |
| 正式采纳主张 | ${status['已采纳'] || 0} |
| 审核中主张 | ${status['审核中'] || 0} |
| 有主张的帝王 | ${emperorsWithClaims.size} / ${emperors.length} |
| 可读章节 | ${chapters.length} |
| 绑定来源单元的章节 | ${sourceBoundChapters} / ${chapters.length} |
| 进入 sitemap 的 E1 章节 | ${indexableChapters} / ${chapters.length} |
| 黄金问题 | ${questions.length} |

## 文献打开程度

| 状态 | 含义 | 数量 |
|---|---|---:|
| L0 | 入口已登记 | ${workState.L0 || 0} |
| L1 | 目录已开 | ${workState.L1 || 0} |
| L2 | 条次已钉 | ${workState.L2 || 0} |
| L3 | 主张已拆 | ${workState.L3 || 0} |

## 十二帝统治年表

${Object.entries(timelineState).map(([key, value]) => `- ${key}：${value} 条`).join('\n')}

“卷级索引”只表示知道应回哪一卷，不等于日级原文已经钉住；升级到 E1 必须绑定结构化主张。
`;

fs.writeFileSync(path.join(root, 'STATUS.md'), md);
console.log(`Wrote STATUS.md (claims ${claims.length}, chapters ${chapters.length}, source-bound ${sourceBoundChapters}, indexable ${indexableChapters})`);
