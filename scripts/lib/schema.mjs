import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCsv } from './csv.mjs';

// 本文件从 data/dynasties.csv 与 data/data-manifest.csv 派生清单与朝代元数据。
// 站点为「单朝代运行时」：一次只启用一个 active 朝代。切换当前朝代 = 在 dynasties.csv 只保留一行 active=是，
// 该朝配套 = 文件行(data-manifest.csv) + 数据 CSV + site/<dynasty>-content.mjs。
// 同时启用多个 active 朝代会在 build 期被拦下（首页/dynasty-config/home·people·catalog 为单槽位，非并存）。
// count 语义为「最低（≥）」，契合章程「最低数量」哲学。

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

// manifest kind → ctx / 构建局部字段名。validate 与 build 共用；加 kind 只改这里。
export const KIND_TO_FIELD = {
  emperors: 'emperors',
  research_cards: 'cards',
  portraits: 'portraits',
  crosswalk: 'crosswalk',
  people: 'people',
  sources: 'sources',
  source_index: 'sourceIndex',
  tasks: 'tasks',
  vocab: 'vocab',
  source_units: 'units',
  source_claims: 'claims',
  questions: 'questions',
  chapters: 'chapters',
  lanes: 'lanes',
  empress_timeline: 'empressTimeline',
  princes: 'princes',
  princesses: 'princesses',
  heir_chain: 'heirChain',
  sites: 'historicSites',
  image_regions: 'imageRegions',
  iiif_manifests: 'iiifManifests',
  works: 'works',
  chronicle: 'chronicle',
  families: 'families',
  conflict_sets: 'conflictSets',
  community_corrections: 'communityCorrections',
  overview: 'overviews',
  emperor_timeline: 'emperorTimeline',
};
