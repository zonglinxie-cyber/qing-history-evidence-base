// CAL-001 核录辅助：对 source-claims.csv 的公历换算做「可复算」的机器校验。
//
// ── 本脚本能做什么（全部为确定性算术，任何人可复跑，不依赖任何未公开数据）──
//   C1 区间合法性      下界 ≤ 上界
//   C2 表达可换算性    非时间表达不适用换算；填入单日只作字段检查提示
//   C3 时间字段提示    缺少公历或精度差异只供参考，不以主张确定性推断日期精度
// 本报告用于发现具体问题，不设人工审核、异常数量或发布基线门槛。
//   C4 纪年边界        公历年份是否落在该年号纪年的合理区间；纪年是否越出该年号总年数
//   C5 表达—区间函数性 同一「原始时间表达」是否映射到同一组公历区间
//   C6 日干支自洽      月后干支与公历日的 60 日循环是否自洽（用**外部锚点**判定，非本库拟合）
//   C7 跨年陷阱        月属十一月/十二月/闰月者，纪年与公历不同年，须页面显式说明
//   C8 区间过宽提示    跨度过大者，多为一朝或生卒概述，不宜作单点事件用
//   C9 时段收窄提示    仅称某某朝/年间的时段表达，其公历区间若窄于名称所示范围，收窄依据须另行记录
//   C10 年干支自洽     年干支经 (公历年-4) mod 60 复算，是否与公历区间相符
//
// ── 本脚本不能做什么（重要边界，勿越界宣称）──
//   · 不能核对朔日（月首）与闰月安置 —— 需 CAL-003 时宪历数据，来源尚未确定；
//   · 不能替代与陈垣《二十史朔闰表》的具书逐条比对，只能把待核范围收敛为工单；
//   · C6/C10 验证的是「库内换算自洽」，不等于「与 CAL-001 书页一致」。二者不可混同。
//
// 产物（均为内部工作表，按 review-notes.csv 先例不登记 data-manifest.csv，不进站点）：
//   data/calendar-audit.csv        逐条判定（断言级）
//   data/calendar-worksheet.csv    按年月归并的核录工单（供具书填写）
//
// 运行：npm run check:calendar

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCsv } from './lib/csv.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const dataDir = path.join(root, 'data');

// ── 年号纪年表 ────────────────────────────────────────────────────────────
// 元年公历年 + 该年号总年数。此表本身也在被检验之列：C4 用库内数据反向核它。
// 注意「即位年」≠「元年」：皇太极 1626 即位而天聪元年为 1627；顺治 1643 即位而顺治元年为 1644。
const REIGN_ERAS = [
  { name: '天命', firstYear: 1616, years: 11 },
  { name: '天聪', firstYear: 1627, years: 9 },
  { name: '崇德', firstYear: 1636, years: 8 },
  { name: '顺治', firstYear: 1644, years: 18 },
  { name: '康熙', firstYear: 1662, years: 61 },
  { name: '雍正', firstYear: 1723, years: 13 },
  { name: '乾隆', firstYear: 1736, years: 60 },
  { name: '嘉庆', firstYear: 1796, years: 25 },
  { name: '道光', firstYear: 1821, years: 30 },
  { name: '咸丰', firstYear: 1851, years: 11 },
  { name: '同治', firstYear: 1862, years: 13 },
  { name: '光绪', firstYear: 1875, years: 34 },
  { name: '宣统', firstYear: 1909, years: 3 },
];
const ERA_BY_NAME = new Map(REIGN_ERAS.map((e) => [e.name, e]));
const ERA_PATTERN = new RegExp(REIGN_ERAS.map((e) => e.name).join('|'), 'g');

const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const GANZHI_INDEX = new Map();
for (let i = 0; i < 60; i += 1) GANZHI_INDEX.set(STEMS[i % 10] + BRANCHES[i % 12], i);
const GANZHI_RE = new RegExp(`[${STEMS}][${BRANCHES}]`, 'g');

const CN_DIGITS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

// 中文数字 → 整数，覆盖 1–61（年）、1–12（月）、1–31（日）。
function cnToNumber(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (s === '元' || s === '正') return 1;
  if (/^\d+$/.test(s)) return Number(s);
  if (s === '十') return 10;
  if (s.startsWith('十')) return 10 + (CN_DIGITS[s[1]] ?? 0);
  if (s.includes('十')) {
    const [tens, ones] = s.split('十');
    return (CN_DIGITS[tens] ?? 1) * 10 + (ones ? (CN_DIGITS[ones] ?? 0) : 0);
  }
  return CN_DIGITS[s] ?? null;
}

const DAY_MS = 86400000;
function toEpochDay(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(t) ? null : Math.round(t / DAY_MS);
}
function fromEpochDay(day) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}
function ymdToEpoch(y, m, d) {
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}
// 年干支：(公历年 - 4) mod 60（公元 4 年为甲子）。纯算术，可独立复算。
function yearGanzhiOf(year) {
  const i = (((year - 4) % 60) + 60) % 60;
  return STEMS[i % 10] + BRANCHES[i % 12];
}
// 干支纪年的公历年 Y，其农历年约当公历 [Y-02-01, Y+1-02-28]。
function lunarYearWindow(year) {
  return [ymdToEpoch(year, 2, 1), ymdToEpoch(year + 1, 2, 28)];
}

function parseTimeExpression(raw) {
  const s = String(raw || '').trim();
  const out = {
    era: null, year: null, month: null, leap: false, day: null,
    dayGanzhi: [], yearGanzhi: [], eras: [], raw: s,
  };
  out.eras = [...new Set(s.match(ERA_PATTERN) || [])];
  if (out.eras.length) out.era = out.eras[0];

  const yearMatch = s.match(/((?:元|正|[一二三四五六七八九十]+|\d+))年/);
  if (yearMatch) out.year = cnToNumber(yearMatch[1]);

  const monthMatch = s.match(/(闰)?([元正一二三四五六七八九十]+|\d+)月/);
  let monthEnd = -1;
  if (monthMatch) {
    out.leap = Boolean(monthMatch[1]);
    out.month = cnToNumber(monthMatch[2]);
    monthEnd = monthMatch.index + monthMatch[0].length;
  }

  const dayMatch = s.match(/(初[一二三四五六七八九十]+|[一二三四五六七八九十]+|\d+)日/);
  if (dayMatch) out.day = cnToNumber(dayMatch[1].replace(/^初/, ''));

  for (const m of s.matchAll(GANZHI_RE)) {
    if (monthEnd >= 0 && m.index >= monthEnd) out.dayGanzhi.push(m[0]);
    else out.yearGanzhi.push(m[0]);
  }
  return out;
}

const SPAN_WORDS = /至|以来|前后|之后|之前|晚年|年间|未系年|起兵|之交/;
function classifyExpression(p) {
  if (p.eras.length > 1 || SPAN_WORDS.test(p.raw)) return '时段';
  if (p.era && p.year) return '单点';
  if (p.era && !p.year) return '时段';
  return '非纪年';
}

function allowedGregorianYears(p) {
  const era = ERA_BY_NAME.get(p.era);
  if (!era || !p.year) return null;
  const base = era.firstYear + p.year - 1;
  if (p.month == null) return [base, base + 1];
  if (p.month >= 1 && p.month <= 10) return [base];
  return [base, base + 1];
}

function fitGanzhiAnchor(samples) {
  const tally = new Array(60).fill(0);
  for (const s of samples) {
    const target = GANZHI_INDEX.get(s.ganzhi);
    if (target == null) continue;
    tally[(((target - (s.lo % 60)) % 60) + 60) % 60] += 1;
  }
  let offset = 0;
  for (let i = 1; i < 60; i += 1) if (tally[i] > tally[offset]) offset = i;
  return { offset, tally };
}

function ganzhiIndexOfDay(day, offset) {
  return (((((day % 60) + 60) % 60) + offset) % 60);
}

function ganzhiOfIndex(i) {
  return `${STEMS[i % 10]}${BRANCHES[i % 12]}`;
}

// ── 外部锚点：不依赖本库任何数据 ──────────────────────────────
// 1949-10-01 ＝ 甲子日。选它是因为它远离清代，不可能被本库的历史换算错误污染。
// 该锚点已用清代史料明载的干支反证（三处独立命合）：
//   1. 康熙六十一年十一月十三日 ＝ 甲午 ——《清聖祖實錄》卷300 该日条作「甲午」；
//      《永憲錄》卷1「甲午（十三日）戌刻，上崩於暢春苑」；《清史稿·世宗本紀》「甲午，聖祖大漸」。
//   2. 康熙六十一年十一月二十日 ＝ 辛丑 ——《清史稿·世宗本紀》「辛丑，上即位」。
//   3. 康熙六十一年十一月十七日 ＝ 戊戌 ——《永憲錄》「頒遺詔在戊戌」。
// 为什么必须用外部锚点：C6 原先用本库样本拟合出的 offset 去判本库样本，属循环论证——
// 拟合锚点会把「多数派」当成正确，从而看不出「多数派整体偏移」这类系统性错误。
const EXTERNAL_ANCHOR = {
  date: '1949-10-01',
  ganzhi: '甲子',
  checks: [
    ['1722-12-20', '甲午', '康熙六十一年十一月十三日（清聖祖實錄卷300／永憲錄卷1／清史稿世宗本紀）'],
    ['1722-12-27', '辛丑', '康熙六十一年十一月二十日（清史稿世宗本紀「辛丑，上即位」）'],
    ['1722-12-24', '戊戌', '康熙六十一年十一月十七日（永憲錄「頒遺詔在戊戌」）'],
  ],
};

function main() {
  const claims = loadCsv(path.join(dataDir, 'source-claims.csv'), { name: 'source-claims.csv' });

  // 第一遍：解析，收集日干支样本以拟合锚点
  const items = claims.map((row) => {
    const raw = row['原始时间表达'] || '';
    const p = parseTimeExpression(raw);
    return {
      row,
      raw,
      p,
      kind: classifyExpression(p),
      loRaw: (row['公历下界'] || '').trim(),
      hiRaw: (row['公历上界'] || '').trim(),
      lo: toEpochDay(row['公历下界']),
      hi: toEpochDay(row['公历上界']),
      level: row['确定性'],
    };
  });
  const exactSamples = [];
  for (const it of items) {
    if (!it.p.dayGanzhi.length || it.lo == null || it.hi == null) continue;
    for (const gz of it.p.dayGanzhi) exactSamples.push({ id: it.row['Assertion ID'], ganzhi: gz, lo: it.lo, exact: it.lo === it.hi });
  }
  const fit = fitGanzhiAnchor(exactSamples.filter((s) => s.exact));

  // 外部锚点：offset 使锚点日的干支序号等于 EXTERNAL_ANCHOR.ganzhi。
  // offset 必须由 date 与 ganzhi 两者共同推出——只从 date 硬推等于把「甲子」写死在两处，
  // 改上面声明的 ganzhi 不会有任何反应，反证也就失去意义。
  const anchorDay = toEpochDay(EXTERNAL_ANCHOR.date);
  const anchorIndex = GANZHI_INDEX.get(EXTERNAL_ANCHOR.ganzhi);
  if (anchorIndex == null) throw new Error(`EXTERNAL_ANCHOR.ganzhi「${EXTERNAL_ANCHOR.ganzhi}」不是六十甲子之一`);
  const externalOffset = (((anchorIndex - anchorDay) % 60) + 60) % 60;
  const anchorChecks = EXTERNAL_ANCHOR.checks.map(([d, gz, src]) => {
    const got = ganzhiOfIndex(ganzhiIndexOfDay(toEpochDay(d), externalOffset));
    return { date: d, expect: gz, got, ok: got === gz, src };
  });
  const anchorOk = anchorChecks.every((c) => c.ok);

  // 第二遍：判定
  const auditRows = [];
  const flags = Object.fromEntries(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11'].map((k) => [k, []]));
  const verdictCount = { 通过: 0, 待核: 0, 异常: 0, 不适用: 0 };
  const byExpression = new Map();
  let ganzhiAgree = 0;
  let ganzhiChecked = 0;
  let c6Drift = 0;

  for (const it of items) {
    const { row, raw, p, kind, loRaw, hiRaw, lo, hi, level } = it;
    const id = row['Assertion ID'];
    const spanDays = lo != null && hi != null ? hi - lo : null;
    const marks = [];
    let hard = false;
    let soft = false;

    // C1
    if (lo != null && hi != null && lo > hi) {
      marks.push('C1:下界晚于上界'); hard = true;
      flags.C1.push(`${id} ${raw} → ${loRaw} > ${hiRaw}`);
    }

    // C2 表达可换算性。分两种，不可混同：
    //   (a) 完全不含纪年成分（如「清史稿卷164圣祖系（表无生年）」「列传总述」）——真·非时间表达；
    //   (b) 含纪年成分但不在本库年号表内（如「明万历十一年癸未」「甲午开衅时」）——前朝或干支纪年，
    //       换算是可做的，只是本库暂不建前朝年号表，故不计入矛盾。
    if (kind === '非纪年') {
      const hasYearToken = /(元|正|[一二三四五六七八九十]+|\d+)年/.test(raw) || p.yearGanzhi.length > 0;
      if (hasYearToken) {
        marks.push('C2:前朝或干支纪年（不在本库年号表）');
      } else {
        marks.push('C2:非时间表达');
        // 表序、亲属关系等主张可以确定，却没有事件日期；不能据此判为历法异常。
        if (lo != null && lo === hi) {
          marks.push('C2b:非时间表达附有单日，检查日期用途');
          flags.C2.push(`${id} 【${raw}】附有单日 ${loRaw}，需区分事件日期与编辑定位`);
        }
      }
    }

    // C3
    let precision = '区间';
    if (lo == null && hi == null) precision = '空';
    else if (lo != null && hi != null && lo === hi) precision = '单日';
    if (kind !== '非纪年' && precision === '空') {
      marks.push('C3:无公历界'); soft = true;
      flags.C3.push(`${id} ${raw} 无公历界（确定性=${level}）`);
    } else if (kind !== '非纪年' && level === '约略' && precision === '单日') {
      marks.push('C3:约略却给单日'); soft = true;
      flags.C3.push(`${id} 确定性=约略 却落在单日 ${loRaw}`);
    } else if (kind !== '非纪年' && level === '不确定' && precision === '单日') {
      marks.push('C3:不确定却给单日'); soft = true;
      flags.C3.push(`${id} 确定性=不确定 却落在单日 ${loRaw}`);
    }

    // C4
    if (kind === '单点' && p.era && p.year) {
      const era = ERA_BY_NAME.get(p.era);
      if (p.year > era.years) {
        marks.push(`C4:纪年越界(应≤${era.years}年)`); hard = true;
        flags.C4.push(`${id} ${p.era}${p.year}年 超出该年号总年数 ${era.years}`);
      }
      const allowed = allowedGregorianYears(p);
      const loYear = loRaw ? Number(loRaw.slice(0, 4)) : null;
      if (allowed && loYear && !allowed.includes(loYear)) {
        marks.push(`C4:公历年份不符(应为${allowed.join('/')})`); hard = true;
        flags.C4.push(`${id} ${raw} → ${loRaw}，按纪年应为 ${allowed.join(' 或 ')} 年`);
      }
    }

    // C6 日干支。只在公历下界＝上界（日级）时判定：
    // 区间窗口宽 S 天时，某干支缺席的概率约为 1−S/60，S≈30 天即有约一半概率「查无此干支」，
    // 缺席属正常，不构成矛盾。故区间一律不判，避免把统计噪声当错误。
    if (p.dayGanzhi.length && lo != null && lo === hi) {
      for (const gz of p.dayGanzhi) {
        const target = GANZHI_INDEX.get(gz);
        if (target == null) continue;
        ganzhiChecked += 1;
        const actual = ganzhiIndexOfDay(lo, externalOffset);
        if (actual === target) {
          ganzhiAgree += 1;
        } else {
          const fittedWouldAgree = ganzhiIndexOfDay(lo, fit.offset) === target;
          marks.push(fittedWouldAgree ? 'C6b:与外部锚点不符（拟合锚点曾判为自洽）' : 'C6:日干支与公历不符');
          soft = true;
          if (fittedWouldAgree) c6Drift += 1;
          flags.C6.push(`${id} 标 ${gz} 于 ${loRaw}（外部锚点实为 ${ganzhiOfIndex(actual)}）${fittedWouldAgree ? '；拟合锚点曾掩盖此项' : ''}`);
        }
      }
    }

    // C10 年干支
    if (p.yearGanzhi.length && kind !== '非纪年' && lo != null) {
      const era = p.era ? ERA_BY_NAME.get(p.era) : null;
      for (const gz of p.yearGanzhi) {
        const candidates = [];
        const baseYear = Number(loRaw.slice(0, 4));
        for (let y = baseYear - 70; y <= baseYear + 70; y += 1) {
          if (yearGanzhiOf(y) !== gz) continue;
          if (era && (y < era.firstYear || y > era.firstYear + era.years - 1)) continue;
          candidates.push(y);
        }
        if (!candidates.length) continue;
        const hiBound = hi != null ? hi : lo;
        const hit = candidates.some((y) => {
          const [a, b] = lunarYearWindow(y);
          return lo <= b && hiBound >= a;
        });
        if (!hit) {
          marks.push(`C10:年干支不符(${gz}应为${candidates.join('/')})`); hard = true;
          flags.C10.push(`${id} ${raw} 标 ${loRaw}~${hiRaw}，但 ${gz} 在${p.era || '该时段'}内对应 ${candidates.join(' / ')}`);
        }
      }
    }

    // C7
    if (p.era && p.year && p.month != null && (p.month >= 11 || p.leap)) {
      marks.push('C7:跨年陷阱');
      flags.C7.push(`${id} ${raw} → ${loRaw}`);
    }

    // C8
    if (spanDays != null && spanDays > 3660) { marks.push('C8:区间逾十年'); soft = true; }

    // C9：仅对「只称某某朝/年间、既无纪年数也无年干支」的时段表达检查收窄。
    // 凡由年干支定位者（如「光绪庚子十二月」）不属泛指，不收窄判定。
    if (kind === '时段' && p.eras.length === 1 && p.year == null && p.yearGanzhi.length === 0 && p.era) {
      const era = ERA_BY_NAME.get(p.era);
      const namedStart = era.firstYear;
      const namedEnd = era.firstYear + era.years - 1;
      const loYear = loRaw ? Number(loRaw.slice(0, 4)) : null;
      const hiYear = hiRaw ? Number(hiRaw.slice(0, 4)) : null;
      if (loYear && hiYear && (loYear > namedStart || hiYear < namedEnd)) {
        marks.push(`C9:收窄于「${p.era}」(应${namedStart}–${namedEnd})`);
        soft = true;
        flags.C9.push(`${id} 【${raw}】→ ${loRaw}~${hiRaw}，窄于 ${namedStart}–${namedEnd}，收窄依据未记录`);
      }
    }

    if (!byExpression.has(raw)) {
      byExpression.set(raw, { p, kind, bounds: new Set(), ids: [], levels: new Set() });
    }
    const bucket = byExpression.get(raw);
    bucket.bounds.add(`${loRaw}|${hiRaw}`);
    bucket.ids.push(id);
    bucket.levels.add(level);

    let verdict = '通过';
    if (hard) verdict = '异常';
    else if (kind === '非纪年') verdict = '不适用';
    else if (soft) verdict = '待核';

    auditRows.push({
      assertion_id: id,
      reign: row.reign || '',
      原始时间表达: raw,
      表达类型: kind,
      年号: p.era || '',
      纪年: p.year ?? '',
      月: p.month ?? '',
      闰月: p.leap ? '是' : '',
      日: p.day ?? '',
      日干支: p.dayGanzhi.join('/'),
      年干支: p.yearGanzhi.join('/'),
      公历下界: loRaw,
      公历上界: hiRaw,
      跨度天: spanDays ?? '',
      确定性: level,
      判定: verdict,
      标记: [...new Set(marks)].join('；'),
    });
  }

  // C5
  for (const [expr, b] of byExpression) {
    if (b.bounds.size > 1) flags.C5.push(`${expr} → ${[...b.bounds].join(' | ')}（${b.ids.length} 条）`);
    if (b.levels.size > 1) flags.C5.push(`${expr} → 确定性不一致：${[...b.levels].join('/')}（${b.ids.length} 条）`);
  }

  // C11 锚点无关：同一「年号纪年＋月」内，日级条目的干支序差必须等于公历日差。
  // 这是全套检查中唯一不需要任何锚点的「绝对」自洽性约束，故其命中即为硬矛盾。
  const rowById = new Map(auditRows.map((r) => [r.assertion_id, r]));
  const dayGroups = new Map();
  for (const it of items) {
    if (!it.p.dayGanzhi.length || it.p.dayGanzhi.length !== 1) continue;
    if (it.p.era == null || it.p.year == null || it.p.month == null) continue;
    if (it.lo == null || it.lo !== it.hi) continue;
    const key = `${it.p.era}|${it.p.year}|${it.p.leap ? '闰' : ''}${it.p.month}`;
    if (!dayGroups.has(key)) dayGroups.set(key, []);
    dayGroups.get(key).push({ id: it.row['Assertion ID'], gz: it.p.dayGanzhi[0], day: it.lo });
  }
  let c11Pairs = 0;
  let c11Bad = 0;
  const touch = (id, note) => {
    const row = rowById.get(id);
    if (!row) return;
    row.标记 = [row.标记, note].filter(Boolean).join('；');
    // C11 不依赖外部锚点，是确定性的内部矛盾，必须进入硬异常而非普通待核。
    row.判定 = '异常';
  };
  for (const [key, list] of dayGroups) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i]; const b = list[j];
        c11Pairs += 1;
        const ia = GANZHI_INDEX.get(a.gz); const ib = GANZHI_INDEX.get(b.gz);
        if (a.day === b.day) {
          if (ia === ib) continue; // 同一日、同一干支，正常
          c11Bad += 1;
          flags.C11.push(`${key} 同一公历日 ${fromEpochDay(a.day)} 却有两说：${a.id} 作 ${a.gz}、${b.id} 作 ${b.gz}`);
          touch(a.id, 'C11:同日干支两说');
          touch(b.id, 'C11:同日干支两说');
          continue;
        }
        let lo = a; let hi = b; let il = ia; let ih = ib;
        if (a.day > b.day) { lo = b; hi = a; il = ib; ih = ia; }
        if ((ih - il + 60) % 60 === (hi.day - lo.day) % 60) continue;
        c11Bad += 1;
        flags.C11.push(`${key} ${lo.id} ${lo.gz} ${fromEpochDay(lo.day)} 与 ${hi.id} ${hi.gz} ${fromEpochDay(hi.day)}：差 ${hi.day - lo.day} 日却差 ${(ih - il + 60) % 60} 个干支`);
        touch(lo.id, 'C11:月内干支序不符');
        touch(hi.id, 'C11:月内干支序不符');
      }
    }
  }

  for (const row of auditRows) verdictCount[row.判定] = (verdictCount[row.判定] || 0) + 1;

  writeCsv(path.join(dataDir, 'calendar-audit.csv'), auditRows);

  // 核录工单
  const wsRows = [];
  const sorted = [...byExpression.entries()].sort((a, b) => {
    const A = a[1].p; const B = b[1].p;
    const ak = [A.era ? ERA_BY_NAME.get(A.era).firstYear : 9999, A.year ?? 99, A.month ?? 99, A.day ?? 99];
    const bk = [B.era ? ERA_BY_NAME.get(B.era).firstYear : 9999, B.year ?? 99, B.month ?? 99, B.day ?? 99];
    for (let i = 0; i < 4; i += 1) if (ak[i] !== bk[i]) return ak[i] - bk[i];
    return a[0].localeCompare(b[0]);
  });
  let seq = 0;
  for (const [expr, b] of sorted) {
    seq += 1;
    const bounds = [...b.bounds];
    const [loStr, hiStr] = bounds[0].split('|');
    wsRows.push({
      worksheet_id: `CAL-WS-${String(seq).padStart(3, '0')}`,
      原始时间表达: expr,
      表达类型: b.kind,
      年号: b.p.era || '',
      纪年: b.p.year ?? '',
      月: b.p.month ?? '',
      闰月: b.p.leap ? '是' : '',
      日: b.p.day ?? '',
      日干支: b.p.dayGanzhi.join('/'),
      年干支: b.p.yearGanzhi.join('/'),
      使用条数: b.ids.length,
      主张ID: b.ids.join(' '),
      现公历下界: loStr,
      现公历上界: bounds.length === 1 ? hiStr : `${hiStr}（存在多组区间，见 calendar-audit.csv）`,
      确定性: [...b.levels].join('/'),
      核录公历下界: '',
      核录公历上界: '',
      核录依据页: '',
      核录人: '',
      核录日期: '',
    });
  }
  writeCsv(path.join(dataDir, 'calendar-worksheet.csv'), wsRows);

  // 控制台汇总
  const titles = {
    C1: 'C1 区间非法（下界晚于上界）',
    C2: 'C2 非时间表达附有单日（检查用途，不判历法错误）',
    C3: 'C3 日期字段参考提示',
    C4: 'C4 公历年份与年号纪年不符',
    C5: 'C5 同一表达映射到不同区间/确定性',
    C6: 'C6 日干支与公历日不自洽',
    C7: 'C7 跨年陷阱（须页面说明，非错误）',
    C8: 'C8 区间逾十年（多为概述，非单点事件）',
    C9: 'C9 时段收窄于名称所示范围（依据未记录）',
    C10: 'C10 年干支与公历区间不符',
    C11: 'C11 月内干支序不符（锚点无关，属硬矛盾）',
  };
  const kindCount = {};
  for (const row of auditRows) kindCount[row.表达类型] = (kindCount[row.表达类型] || 0) + 1;

  console.log('CAL-001 机器一致性校验');
  console.log('─'.repeat(60));
  console.log(`主张总数          ${claims.length}`);
  console.log(`唯一时间表达      ${byExpression.size}（= 具书核录的最低工作量上限）`);
  console.log(`表达类型          单点 ${kindCount['单点'] || 0} / 时段 ${kindCount['时段'] || 0} / 非纪年 ${kindCount['非纪年'] || 0}`);
  console.log(`判定              通过 ${verdictCount.通过} / 待核 ${verdictCount.待核} / 异常 ${verdictCount.异常} / 不适用 ${verdictCount.不适用}`);
  console.log('');
  for (const key of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10']) {
    const list = flags[key];
    console.log(`${titles[key]}：${list.length} 条`);
    for (const item of list.slice(0, 4)) console.log(`    · ${item}`);
    if (list.length > 4) console.log(`    … 其余 ${list.length - 4} 条见 data/calendar-audit.csv`);
  }
  console.log('');
  console.log(`C6 日干支：受检 ${ganzhiChecked} 条，自洽 ${ganzhiAgree} 条（${(ganzhiChecked ? ganzhiAgree / ganzhiChecked * 100 : 0).toFixed(1)}%）`);
  console.log(`  判定锚点         外部锚点 offset=${externalOffset}（${EXTERNAL_ANCHOR.date} = ${EXTERNAL_ANCHOR.ganzhi}）`);
  console.log(`  外部反证         ${anchorOk ? '通过' : '不通过'}（${anchorChecks.map((c) => `${c.date.slice(5)}=${c.got}${c.ok ? '✓' : '✗应' + c.expect}`).join(' ')}）`);
  console.log(`  本库拟合 offset  ${fit.offset}（仅作对照；用拟合锚点判本库样本属循环论证，故不用于判定）`);
  if (c6Drift) console.log(`  ⚠ 其中 ${c6Drift} 条被拟合锚点掩盖，只有外部锚点能看出（标 C6b）`);
  console.log('  ↑ 外部锚点已由清代史料明载干支反证；但仍不等于已与 CAL-001 书页逐条核对');
  console.log(`C11 月内干支序：受检 ${c11Pairs} 对，矛盾 ${c11Bad} 对（此项不依赖任何锚点，命中即硬矛盾）`);
  if (!anchorOk) {
    console.log('');
    console.error('⚠ 外部锚点反证未通过——上述 C6 结论不可用，须先修锚点。');
    // 上面声明「不设异常数量门槛」，那是针对数据侧的 C1–C11 计数；锚点反证失败是工具自身
    // 失效——干支算术或年号表错了，此时整套判定无意义，必须让构建与 CI 停下来。
    process.exitCode = 1;
  }
  console.log('');
  console.log('已写出 data/calendar-audit.csv 与 data/calendar-worksheet.csv');

}

function writeCsv(filePath, rows) {
  if (!rows.length) { fs.writeFileSync(filePath, ''); return; }
  const header = Object.keys(rows[0]);
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(','), ...rows.map((r) => header.map((k) => esc(r[k])).join(','))];
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

main();
