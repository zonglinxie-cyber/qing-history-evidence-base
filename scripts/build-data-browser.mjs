// 数据浏览器序列化器（开闸 v0.1）：不挑、不净化、不改状态，全量出表。
// 由 data/data-manifest.csv 驱动，把每个登记文件原样序列化为 site/data/raw.json。
// 结构：{ tables: [ { file, dynasty, reign, kind, columns, rows } ] }
//   columns = 表头数组；rows = 每行对象数组（保留原始字段与原始值）。
// 只读、可重复：同一份 CSV 每次构建产出完全一样的 JSON；绝不手写。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './lib/csv.mjs';
import { DATA_MANIFEST } from './lib/schema.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const dataDir = path.join(root, 'data');
const outFile = path.join(root, 'site', 'data', 'raw.json');

// 读单表，返回 { columns, rows }；保留原始列顺序与原始值（csv 里的空串保留为空串）。
function readTable(file) {
  const text = fs.readFileSync(path.join(dataDir, file), 'utf8');
  const parsed = parseCsv(text);
  if (!parsed.length) return { columns: [], rows: [] };
  const [header, ...body] = parsed;
  const columns = header;
  const rows = body.map((raw) => Object.fromEntries(header.map((key, i) => [key, raw[i] ?? ''])));
  return { columns, rows };
}

export function build() {
  const tables = DATA_MANIFEST.map((entry) => {
    const { columns, rows } = readTable(entry.file);
    return {
      file: entry.file,
      dynasty: entry.dynasty,
      reign: entry.reign,
      kind: entry.kind,
      columns,
      rows,
    };
  });

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify({ tables })}\n`);

  const totalRows = tables.reduce((sum, table) => sum + table.rows.length, 0);
  return { name: 'raw.json', bytes: fs.statSync(outFile).size, tables: tables.length, totalRows };
}

// 独立运行：node scripts/build-data-browser.mjs；也可被 build 链条 import 后调用 build()。
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = build();
  console.log(`Wrote site/data/raw.json (${report.tables} tables, ${report.totalRows} rows, ${report.bytes}B)`);
}