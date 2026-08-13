import fs from 'node:fs';
import { parse } from 'csv-parse/sync';

export function parseCsv(text, { relax = true } = {}) {
  return parse(text, {
    skip_empty_lines: true,
    bom: true,
    relax_quotes: false,
    relax_column_count: relax,
  });
}

export function loadCsv(filePath, { name, required, errors } = {}) {
  const label = name || filePath;
  const text = fs.readFileSync(filePath, 'utf8');
  let rows;
  try {
    rows = parseCsv(text);
  } catch (err) {
    const message = `${label}: CSV 解析失败 ${err.message}`;
    if (errors) errors.push(message);
    else throw new Error(message);
    return [];
  }
  if (!rows.length) {
    const message = `${label} 为空`;
    if (errors) errors.push(message);
    else throw new Error(message);
    return [];
  }
  const header = rows.shift();
  if (required) {
    for (const col of required) {
      if (!header.includes(col)) {
        const message = `${label} 缺少列 ${col}`;
        if (errors) errors.push(message);
        else throw new Error(message);
      }
    }
  }
  if (errors) {
    rows.forEach((row, index) => {
      if (row.length !== header.length) {
        errors.push(`${label}:${index + 2} 字段数 ${row.length}，应为 ${header.length}`);
      }
    });
  }
  return rows.map((row) => Object.fromEntries(header.map((key, i) => [key, row[i] ?? ''])));
}
