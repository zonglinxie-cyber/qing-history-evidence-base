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
const root = path.resolve(scriptDir, '..'); // phase-0/
const dataDir = path.join(root, 'data');
const contentDir = path.join(root, 'content');

const errors = [];
const warnings = [];

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
    for (const entry of DATA_MANIFEST) {
      if (entry.dynasty !== dynasty.code && entry.dynasty !== 'shared') continue;
      const rows = load(entry.file);
      checkMinCount(entry.file, rows);
      checkUnique(entry.file, rows);
      const list = byKind.get(entry.kind) || [];
      byKind.set(entry.kind, list.concat(rows));
    }

    // 章节 era 枚举：朝次必须取自本朝年号表
    const eraSet = new Set(reignEraLabels(dynasty.code));
    for (const row of byKind.get('chapters') || []) {
      if (!eraSet.has(row.era)) errors.push(`${row.chapter_id} 朝次无效: ${row.era}`);
    }

    // 证据等级采纳门禁（docs/03 发布规则的机器化；对应数据字典验收查询 13）
    // 台账来源允许「视对象而定」（逐件定级）；来源单元必须是具体等级，且不得高于台账来源等级。
    const SOURCE_RANKS = new Set(['A1', 'A2', 'B', 'C', 'D']);
    const rankBySource = new Map();
    for (const source of byKind.get('sources') || []) {
      const rank = source['证据等级'];
      if (!SOURCE_RANKS.has(rank) && rank !== '视对象而定') {
        errors.push(`${source.source_id} 证据等级无效: ${rank}`);
      }
      rankBySource.set(source.source_id, rank);
    }
    const rankByUnit = new Map();
    const RANK_ORDER = { A1: 1, A2: 2, B: 3, C: 4, D: 5 };
    for (const unit of byKind.get('source_units') || []) {
      const rank = unit['证据等级'];
      if (!SOURCE_RANKS.has(rank)) {
        errors.push(`${unit.source_unit_id} 证据等级必须是具体等级 A1-D: ${rank}`);
      }
      // 上限规则：单元只能等于或保守于其台账来源等级（现代整理稿可低于原始档案上限）
      const sourceRank = rankBySource.get(unit.source_entity_id);
      if (sourceRank && SOURCE_RANKS.has(sourceRank) && RANK_ORDER[rank] < RANK_ORDER[sourceRank]) {
        errors.push(`${unit.source_unit_id} 证据等级 ${rank} 高于台账来源 ${unit.source_entity_id} 的上限 ${sourceRank}`);
      }
      rankByUnit.set(unit.source_unit_id, rank);
    }
    // 已采纳主张必须至少有一条 A1/A2 支持证据；高风险命题的双来源家族要求在各朝 rules 模块检查
    for (const claim of byKind.get('source_claims') || []) {
      if (claim['状态'] !== '已采纳') continue;
      const unitRank = rankByUnit.get(claim['来源实体 ID']);
      const stance = claim['证据立场'] || '支持';
      if (stance === '支持' && unitRank !== 'A1' && unitRank !== 'A2') {
        errors.push(`${claim['Assertion ID']} 已采纳但支持证据等级为 ${unitRank || '未知'}；普通事实至少需要一个 A1/A2 证据`);
      }
    }

    // 来源家族登记表：独立性按派生树判定（无共同祖先才算独立），防「实录+转抄实录」假冒双来源
    const families = byKind.get('families') || [];
    const famById = new Map(families.map((f) => [f.family_id, f]));
    const ancestorsOf = (id) => {
      const out = new Set([id]);
      const stack = [id];
      while (stack.length) {
        const cur = famById.get(stack.pop());
        if (!cur) continue;
        for (const p of String(cur.derives_from || '').split(';').map((s) => s.trim()).filter(Boolean)) {
          if (!out.has(p)) { out.add(p); stack.push(p); }
        }
      }
      return out;
    };
    const independentFamilies = (a, b) => {
      const B = ancestorsOf(b);
      for (const x of ancestorsOf(a)) if (B.has(x)) return false;
      return true;
    };
    for (const f of families) {
      for (const p of String(f.derives_from || '').split(';').map((s) => s.trim()).filter(Boolean)) {
        if (!famById.has(p)) errors.push(`${f.family_id} 的 derives_from 指向未登记家族 ${p}`);
      }
    }
    for (const claim of byKind.get('source_claims') || []) {
      const fid = String(claim['来源家族 ID'] || '').trim();
      if (fid && !famById.has(fid)) {
        errors.push(`${claim['Assertion ID']} 来源家族 ID ${fid} 未登记`);
      }
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
        errors.push(`冲突组 ${g} 需要≥2 条主张且客体或时间互斥，当前 ${arr.length} 条/客体 ${objs.size}/时间 ${times.size}`);
      }
    }
    for (const cs of conflictSets) {
      if (String(cs['现行编辑判断'] || '').trim() && !String(cs['保留意见'] || '').trim()) {
        errors.push(`${cs.conflict_set_id} 有现行编辑判断但未写保留意见`);
      }
      const referenced = claimsByGroup.get(cs.conflict_set_id) || [];
      if (referenced.length === 0 && !String(cs['现行编辑判断'] || '').trim()) {
        errors.push(`${cs.conflict_set_id} 无主张引用且未写现行编辑判断；空组必须登记为待补面 TODO`);
      }
    }

    // 组装 ctx，dispatch 到本朝 rules 模块（缺省跳过）
    const ctx = { dynasty, contentDir, errors, warnings, rankBySource, rankByUnit, independentFamilies };
    for (const [kind, field] of Object.entries(KIND_TO_FIELD)) {
      ctx[field] = byKind.get(kind) || [];
    }

    checkCommon(ctx);
    if (dynasty.rulesModule) {
      const mod = await import(path.resolve(scriptDir, dynasty.rulesModule));
      if (mod.check) mod.check(ctx);
    }

    checkSkeletonProse({
      chapters: ctx.chapters,
      contentDir,
      warnings,
    });
    checkReaderProse({
      questions: ctx.questions,
      warnings,
    });

    summary.push({
      dynasty: dynasty.code,
      files: DATA_MANIFEST.filter((e) => e.dynasty === dynasty.code || e.dynasty === 'shared').length,
      rows: Object.fromEntries([...byKind.entries()].map(([k, v]) => [KIND_TO_FIELD[k] || k, v.length])),
    });
  }

  console.log(JSON.stringify({ dynasties: summary, errors: errors.length, warnings: warnings.length }, null, 2));
  if (warnings.length) console.log(`WARNINGS\n- ${warnings.join('\n- ')}`);
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
