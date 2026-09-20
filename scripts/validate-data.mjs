// 结构层校验：朝代无关，全部 manifest 驱动。
// 负责：required 列 / minCount(≥) / unique / 章节 era 枚举 / 按朝 dispatch 到 rules/<dynasty>.mjs。
// 朝代专属不变量（清史稿卷次、冲突组、卷164 等）在各朝 rules 模块里，结构层不读。

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCsv } from './lib/csv.mjs';
import {
  CSV_FILES,
  DATA_MANIFEST,
  KIND_TO_FIELD,
  activeDynasties,
  reignEraLabels,
} from './lib/schema.mjs';
import { checkSkeletonProse, checkReaderProse } from './rules/common/prose.mjs';
import { check as checkCommon } from './rules/common/structure.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const dataDir = path.join(root, 'data');
const contentDir = path.join(root, 'content');

const errors = [];
const warnings = [];
// 证据/编辑类断言与文风提示：默认只打印、不阻断构建。
// 改文案、加内容不该被机器拦住；需要严格自查时用 STRICT=1（npm run validate:strict）。
const assertions = [];
const STRICT = process.env.STRICT === '1';

function load(file) {
  return loadCsv(path.join(dataDir, file), {
    name: file,
    required: CSV_FILES[file]?.required,
    errors,
  });
}

function checkMinCount(file, rows) {
  const min = CSV_FILES[file]?.minCount;
  if (min != null && rows.length < min) {
    errors.push(`${file} 行数 ${rows.length}，至少应为 ${min}`);
  }
}

function checkUnique(file, rows) {
  for (const key of CSV_FILES[file]?.unique || []) {
    const seen = new Set();
    for (const row of rows) {
      if (!row[key]) errors.push(`${file} 存在空 ${key}`);
      else if (seen.has(row[key])) errors.push(`${file} 重复 ${key}: ${row[key]}`);
      seen.add(row[key]);
    }
  }
}

async function main() {
  const summary = [];

  for (const dynasty of activeDynasties()) {
    // 装载本朝文件（含 shared 共享文件），按 kind 合并
    const byKind = new Map();
    const fileDetails = [];
    for (const entry of DATA_MANIFEST) {
      if (entry.dynasty !== dynasty.code && entry.dynasty !== 'shared') continue;
      const rows = load(entry.file);
      checkMinCount(entry.file, rows);
      checkUnique(entry.file, rows);
      fileDetails.push({
        file: entry.file,
        kind: entry.kind,
        rows: rows.length,
        columns: rows.length ? Object.keys(rows[0]) : [],
      });
      const list = byKind.get(entry.kind) || [];
      byKind.set(entry.kind, list.concat(rows));
    }

    // 同 kind 多文件合并后主键必须全局唯一（避免康熙/雍正主张 ID 静默覆盖）
    const uniqueByKind = new Map();
    for (const entry of DATA_MANIFEST) {
      if (entry.dynasty !== dynasty.code && entry.dynasty !== 'shared') continue;
      for (const key of entry.unique || []) {
        uniqueByKind.set(`${entry.kind}\0${key}`, key);
      }
    }
    for (const [kind, rows] of byKind) {
      const keys = [...new Set(
        DATA_MANIFEST
          .filter((entry) => entry.kind === kind && (entry.dynasty === dynasty.code || entry.dynasty === 'shared'))
          .flatMap((entry) => entry.unique || []),
      )];
      for (const key of keys) {
        const seen = new Map();
        for (const row of rows) {
          const id = String(row[key] || '').trim();
          if (!id) continue;
          if (seen.has(id)) errors.push(`${kind} 跨文件重复 ${key}: ${id}`);
          seen.set(id, true);
        }
      }
    }

    // 章节 era 枚举：朝次必须取自本朝年号表
    const eraSet = new Set(reignEraLabels(dynasty.code));
    const eraSlugs = new Set((dynasty.reignEras || []).map((e) => e.slug));
    for (const row of byKind.get('chapters') || []) {
      if (!eraSet.has(row.era)) errors.push(`${row.chapter_id} 朝次无效: ${row.era}`);
    }
    for (const row of byKind.get('source_units') || []) {
      if (!eraSlugs.has(row.reign)) errors.push(`${row.source_unit_id} 朝次无效: ${row.reign || '空'}`);
    }
    for (const row of byKind.get('source_claims') || []) {
      if (!eraSlugs.has(row.reign)) errors.push(`${row['Assertion ID']} 朝次无效: ${row.reign || '空'}`);
    }

    // 来源性质分级（docs/03 §2；对应数据字典验收查询 13）
    // 2026-09-11 由 6 级（A1/A2/A3/B/C/D）压缩为 3 级人话，理由：
    //   ① 最高级 A1「原始档案」实际恒为 0（本库确无档案支撑，也不具备获取条件），
    //      保留一个永远为空的等级 = 用分级表假装研究深度，属自欺；
    //   ② A2（官修编年制度）与 A3（御制敕编）对读者是同一件事：都是同时代官方文本。
    // 台账来源允许「视对象而定」（逐件定级）；来源单元必须是具体等级，且不得高于台账来源等级。
    const SOURCE_RANKS = new Set(['同时代·官方', '同时代·私撰', '后出']);
    const rankBySource = new Map();
    for (const source of byKind.get('sources') || []) {
      const rank = source['证据等级'];
      if (!SOURCE_RANKS.has(rank) && rank !== '视对象而定') {
        errors.push(`${source.source_id} 证据等级无效: ${rank}`);
      }
      rankBySource.set(source.source_id, rank);
    }
    const rankByUnit = new Map();
    const RANK_ORDER = { '同时代·官方': 1, '同时代·私撰': 2, 后出: 3 };
    for (const unit of byKind.get('source_units') || []) {
      const rank = unit['证据等级'];
      if (!SOURCE_RANKS.has(rank)) {
        errors.push(`${unit.source_unit_id} 证据等级必须是 同时代·官方／同时代·私撰／后出 之一: ${rank}`);
      }
      // 上限规则：单元只能等于或保守于其台账来源等级（现代整理稿可低于原始档案上限）
      const sourceRank = rankBySource.get(unit.source_entity_id);
      if (sourceRank && SOURCE_RANKS.has(sourceRank) && RANK_ORDER[rank] < RANK_ORDER[sourceRank]) {
        assertions.push(`${unit.source_unit_id} 证据等级 ${rank} 高于台账来源 ${unit.source_entity_id} 的上限 ${sourceRank}`);
      }
      rankByUnit.set(unit.source_unit_id, rank);
    }
    // 冲突组一等公民：登记 + ≥2 条主张 + 客体或时间互斥；有现行判断必须写保留意见
    const conflictSets = byKind.get('conflict_sets') || [];
    const csById = new Map(conflictSets.map((c) => [c.conflict_set_id, c]));
    const claimsByGroup = new Map();
    for (const claim of byKind.get('source_claims') || []) {
      const g = String(claim['冲突组 ID'] || '').trim();
      if (!g) continue;
      (claimsByGroup.get(g) || claimsByGroup.set(g, []).get(g)).push(claim);
    }
    for (const [g, arr] of claimsByGroup) {
      if (!csById.has(g)) errors.push(`主张引用了未登记的冲突组 ${g}`);
      const objs = new Set(arr.map((c) => c['客体 ID 或值']));
      const times = new Set(arr.map((c) => c['原始时间表达']));
      if (arr.length < 2 || (objs.size < 2 && times.size < 2)) {
        assertions.push(`冲突组 ${g} 需要≥2 条主张且客体或时间互斥，当前 ${arr.length} 条/客体 ${objs.size}/时间 ${times.size}`);
      }
    }
    for (const cs of conflictSets) {
      if (String(cs['现行编辑判断'] || '').trim() && !String(cs['保留意见'] || '').trim()) {
        assertions.push(`${cs.conflict_set_id} 有现行编辑判断但未写保留意见`);
      }
      const referenced = claimsByGroup.get(cs.conflict_set_id) || [];
      if (referenced.length === 0 && !String(cs['现行编辑判断'] || '').trim()) {
        assertions.push(`${cs.conflict_set_id} 无主张引用且未写现行编辑判断；空组必须登记为待补面 TODO`);
      }
    }

    // 勘误账本（2026-09-11 接通）：本站定位是爱好者资料站，不做具书核录，
    // 错误读到再改。`data/community-corrections.csv` 是勘误的唯一账本，
    // 由 `npm run errata` 登记（见 docs/25）。这里只做「别让记录变成孤儿」的轻检查：
    //   位置ID 必须指得到真实存在的东西，状态必须是已声明的勘误状态。
    // 位置ID 无法解析时只提示（assertion），不阻断——宁可有记录，不要没记录；
    // 状态非法则阻断（error），因为状态是机器要读的字段，写错等于账本失效。
    // 状态取值从 controlled-vocabularies.csv 的 correction_status 方案读出，不写死
    const CORRECTION_STATUS = new Set(
      (byKind.get('vocab') || [])
        .filter((r) => r.scheme_code === 'correction_status' && String(r['是否启用']).toLowerCase() !== 'false')
        .map((r) => r['中文标签']),
    );
    const locatorIndex = new Map();
    const indexIds = (kindName, col) => {
      for (const row of byKind.get(kindName) || []) {
        const v = String(row[col] || '').trim();
        if (v) locatorIndex.set(v, kindName);
      }
    };
    indexIds('source_claims', 'Assertion ID');
    indexIds('conflict_sets', 'conflict_set_id');
    indexIds('sources', 'source_id');
    indexIds('source_units', 'source_unit_id');
    indexIds('people', 'person_id');
    indexIds('works', 'work_id');
    indexIds('sites', 'site_id');
    indexIds('chapters', 'slug');
    for (const row of byKind.get('community_corrections') || []) {
      const loc = String(row['位置ID'] || '').trim();
      const st = String(row['状态'] || '').trim();
      if (loc && !locatorIndex.has(loc) && !loc.startsWith('#')) {
        assertions.push(`${row.correction_id} 位置ID「${loc}」在数据表中找不到对应记录，勘误无法定位到源文件`);
      }
      if (st && CORRECTION_STATUS.size && !CORRECTION_STATUS.has(st)) {
        errors.push(`${row.correction_id} 勘误状态无效: ${st}（应为 ${[...CORRECTION_STATUS].join('/')}）`);
      }
    }

    // 组装 ctx，dispatch 到本朝 rules 模块（缺省跳过）
    const ctx = { dynasty, contentDir, errors, warnings, assertions, rankBySource, rankByUnit };
    for (const [kind, field] of Object.entries(KIND_TO_FIELD)) {
      ctx[field] = byKind.get(kind) || [];
    }

    checkCommon(ctx);
    if (dynasty.rulesModule) {
      const mod = await import(path.resolve(scriptDir, dynasty.rulesModule));
      if (mod.check) mod.check(ctx);
    }

    // 文风检查（docs/04 §13.2）默认不跑：它是写作参考，不是内容门槛。
    // 想看一份文案自查报告时用 npm run validate:strict——此时文风提示与证据断言一样按 error 报出。
    if (STRICT) {
      const proseFindings = [];
      checkSkeletonProse({
        chapters: ctx.chapters,
        contentDir,
        warnings: proseFindings,
      });
      checkReaderProse({
        questions: ctx.questions,
        warnings: proseFindings,
      });
      errors.push(...proseFindings);
    }

    summary.push({
      dynasty: dynasty.code,
      files: DATA_MANIFEST.filter((e) => e.dynasty === dynasty.code || e.dynasty === 'shared').length,
      tables: fileDetails,
      rows: Object.fromEntries([...byKind.entries()].map(([k, v]) => [KIND_TO_FIELD[k] || k, v.length])),
    });
  }

  // 证据/编辑类断言默认只提示；STRICT=1 时并入 error（可选严格自查）。
  // 2026-09-11 起取消绝对阈值门禁（原先 warning ≤ 1、断言 ≤ 0）：
  // 告警是给人看的雷达，不是构建闸门；阈值恒定不随内容规模变化，只会让「写得越多越容易红」。
  if (STRICT) errors.push(...assertions);
  else warnings.push(...assertions);

  console.log(JSON.stringify({
    dynasties: summary,
    errors: errors.length,
    warnings: warnings.length,
    assertions: assertions.length,
    mode: STRICT
      ? 'STRICT=1：证据/编辑类断言与文风提示按 error 阻断'
      : '默认：只输出提示，不阻断构建',
  }, null, 2));
  if (warnings.length) console.log(`WARNINGS（提示，不影响构建）\n- ${warnings.join('\n- ')}`);
  if (STRICT && assertions.length) console.log(`注：${assertions.length} 条证据/编辑类断言已升为 error（见下 ERROR 列表）。`);
  if (errors.length) {
    console.error(`ERRORS\n- ${errors.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log('PASS: required / minCount / unique / era 枚举 / 朝代不变量检查通过。');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
