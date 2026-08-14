import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCsv } from './csv.mjs';

// 本文件从 data/dynasties.csv 与 data/data-manifest.csv 派生清单与朝代元数据。
// 新增朝代 = 在 dynasties.csv 加一行 + 在 data-manifest.csv 加该朝的文件行 + 放入数据 CSV，
// 无需改本文件或任何脚本。count 语义为「最低（≥）」，契合章程「最低数量」哲学。

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(scriptDir, '../../data');

function splitList(value) {
  return String(value || '').split(/[;；]/).map((s) => s.trim()).filter(Boolean);
}

const dynastyRows = loadCsv(path.join(dataDir, 'dynasties.csv'), {
  name: 'dynasties.csv',
  required: ['dynasty_code', 'label', 'kicker', 'headline', 'lede', 'id_prefix', 'reign_eras', 'canonical_history_work', 'rules_module', 'active'],
});

export const DYNASTIES = dynastyRows.map((row) => {
  const reignEras = splitList(row.reign_eras).map((pair) => {
    const [label, slug] = pair.split(':').map((s) => s && s.trim());
    return { label, slug: slug || label };
  });
  return {
    code: row.dynasty_code,
    label: row.label,
    kicker: row.kicker,
    headline: row.headline,
    lede: row.lede,
    idPrefix: row.id_prefix,
    reignEras,
    canonicalHistoryWork: row.canonical_history_work,
    rulesModule: row.rules_module,
    active: row.active !== '否',
  };
});

const manifestRows = loadCsv(path.join(dataDir, 'data-manifest.csv'), {
  name: 'data-manifest.csv',
  required: ['file', 'dynasty', 'reign', 'kind', 'required', 'unique', 'min_count'],
});

export const DATA_MANIFEST = manifestRows.map((row) => ({
  file: row.file,
  dynasty: row.dynasty,
  reign: row.reign,
  kind: row.kind,
  required: splitList(row.required),
  unique: splitList(row.unique),
  minCount: row.min_count ? Number(row.min_count) : undefined,
}));

export const CSV_FILES = Object.fromEntries(
  DATA_MANIFEST.map((entry) => [entry.file, {
    required: entry.required,
    unique: entry.unique,
    minCount: entry.minCount,
  }]),
);

export function activeDynasties() {
  return DYNASTIES.filter((d) => d.active);
}

export function dynastyByCode(code) {
  return DYNASTIES.find((d) => d.code === code);
}

export function filesForDynasty(code) {
  return DATA_MANIFEST.filter((e) => e.dynasty === code);
}

export function reignEraLabels(code) {
  const d = dynastyByCode(code);
  return new Set(d ? d.reignEras.map((e) => e.label) : []);
}
