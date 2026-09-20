// 只读检查：不采纳、不驳回、不覆盖编辑决定，也不把非空字段当来源核验。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCsv } from './lib/csv.mjs';
import { DATA_MANIFEST } from './lib/schema.mjs';
import { loadReviewContext } from './lib/review.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = loadReviewContext();
const rows = DATA_MANIFEST.filter(e => e.kind === 'source_claims').flatMap(e => loadCsv(path.join(root, 'data', e.file)));
const report = rows.map(row => ({ id: row['Assertion ID'], ...context.inspect(row) }));
console.log(JSON.stringify({ mode: '只读；不改编辑状态', total: report.length,
  registered: report.filter(r => r.registered).length,
  verified: report.filter(r => r.verified).length,
  needsReview: report.filter(r => r.needsReview),
}, null, 2));
