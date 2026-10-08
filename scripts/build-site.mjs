import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadCsv } from './lib/csv.mjs';
import { CSV_FILES, DATA_MANIFEST, KIND_TO_FIELD, activeDynasties } from './lib/schema.mjs';
import { readerCopy, readerProse, readerMetadata } from './lib/reader.mjs';
import { firstQuote, escHtml, mdToHtml, publicBodyHtml } from './lib/chapter-html.mjs';
import { annotateMentions } from './lib/person-mentions.mjs';
import { parseReignTimeline } from './lib/reign-timeline.mjs';
import {
  publicCalendarStatus, localPreview, slimPortrait, pick, publicPortrait,
  publicClaim, publicAvailability, searchEntry, py,
} from './lib/public-records.mjs';
import { buildMediaManifest } from './build-media-manifest.mjs';
buildMediaManifest();
// 浏览器模块里只有零依赖的纯模块可被构建直接 import（reading.js / media-paths.js /
// qing-content.js / live-content.js）。templates.js 是唯一的例外：首页要服务端直出，
// 而它动态加载的 media-manifest.js 是派生产物——所以上面那行 buildMediaManifest()
// 必须先跑，顺序不是巧合。
const { homeHtml, isChapterIndexable, isChapterEvidenceClosed, selectReadingPicks, FEATURED_COUNT } = await import('../site/templates.js');
import { LIVE_TOPICS } from '../site/live-content.js';
import { chapterGenre, orderedChapters, evidenceLabel } from '../site/reading.js';
import { MENTION_PERSONS } from '../site/qing-content.js';
import { loadReviewContext } from './lib/review.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');

function readVersion() {
  try {
    return fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
  } catch {
    console.error('[build] VERSION 读不到，站点各处版本号退回 0.0.0');
    return '0.0.0';
  }
}

function siteFooterVersion(version) {
  return `    <p class="foot-version"><a href="./#/changelog">v${escHtml(version)}</a> · <a href="./#/changelog">更新日志</a></p>\n`;
}
const dataDir = path.join(root, 'data');
const siteDir = path.join(root, 'site');
const dataOutDir = path.join(siteDir, 'data');
const contentDir = path.join(root, 'content');
const siteBaseUrl = new URL(process.env.SITE_URL || 'https://zonglinxie-cyber.github.io/qing-history-evidence-base/');
if (!siteBaseUrl.pathname.endsWith('/')) siteBaseUrl.pathname += '/';

// 手选主题必须在 CSS 前挂上，否则暗色用户每次进站先闪白。类名与 app.js applyTheme 一致。
const THEME_BOOT = "try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.classList.add(t)}catch(e){}";
const THEME_BOOT_TAG = `  <script>${THEME_BOOT}</script>\n`;
const THEME_BOOT_RE = /[ \t]*<script>try\{var t=localStorage\.getItem\('theme'\);[\s\S]*?<\/script>\n?/;

function withThemeBoot(html) {
  return THEME_BOOT_RE.test(html)
    ? html.replace(THEME_BOOT_RE, THEME_BOOT_TAG)
    : html.replace('</head>', `${THEME_BOOT_TAG}</head>`);
}

function load(file) {
  return loadCsv(path.join(dataDir, file), {
    name: file,
    required: CSV_FILES[file]?.required,
  });
}

function loadCalendarAudit() {
  const file = path.join(dataDir, 'calendar-audit.csv');
  if (!fs.existsSync(file)) return new Map();
  return new Map(loadCsv(file, { name: 'calendar-audit.csv' })
    .map((row) => [row.assertion_id, row]));
}



function writeJson(name, payload) {
  const file = path.join(dataOutDir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const json = `${JSON.stringify(payload)}\n`;
  fs.writeFileSync(file, json);
  return { name, bytes: json.length };
}

function writeRobotsTxt() {
  fs.rmSync(path.join(siteDir, 'sitemap.xml'), { force: true });
  fs.writeFileSync(path.join(siteDir, 'robots.txt'), 'User-agent: *\nAllow: /\n');
}

function removeLegacyMirrors() {
  for (const name of ['chapter', 'person', 'lane', 'site']) {
    fs.rmSync(path.join(siteDir, name), { recursive: true, force: true });
  }
  fs.rmSync(path.join(dataOutDir, 'raw.json'), { force: true });
  fs.rmSync(path.join(dataOutDir, 'qing.sqlite'), { force: true });
}

// 装载本朝文件（含 shared 共享文件），按 kind 合并；返回 { dynasty, data: {field: rows} }。
// 主张行保留 manifest.reign，供覆盖度按朝分组；不从 Assertion ID 正则推朝次。
function loadDynasty(dynasty) {
  const byKind = new Map();
  for (const entry of DATA_MANIFEST) {
    if (entry.dynasty !== dynasty.code && entry.dynasty !== 'shared') continue;
    const rows = load(entry.file).map((r) => (
      entry.kind === 'source_claims' ? { ...r, _reign: r.reign || entry.reign } : r
    ));
    const list = byKind.get(entry.kind) || [];
    byKind.set(entry.kind, list.concat(rows));
  }
  const data = {};
  for (const [kind, field] of Object.entries(KIND_TO_FIELD)) {
    data[field] = byKind.get(kind) || [];
  }
  return { dynasty, data };
}

function slimDynasty(dynasty) {
  return {
    code: dynasty.code,
    label: dynasty.label,
    kicker: dynasty.kicker,
    headline: dynasty.headline,
    lede: dynasty.lede,
    // slug → 年号标签；前端据此解析朝代专题路由与数据块
    eras: Object.fromEntries(dynasty.reignEras.map((era) => [era.slug, era.label])),
  };
}

function buildDynasty({ dynasty, data }) {
  const {
    emperors, cards, portraits, crosswalk, people, sources, sourceIndex, tasks,
    units, claims, questions, chapters: chapterRows, lanes, empressTimeline,
    princes, princesses, heirChain, historicSites, imageRegions, iiifManifests,
    works, vocab, conflictSets, chronicle, overviews: overviewRows, emperorTimeline,
    personPortraits, ziguanggeHeroes, ziguanggeBatches,
  } = data;
  const calendarAuditById = loadCalendarAudit();
  const calendarForClaim = (id) => publicCalendarStatus(calendarAuditById.get(String(id || '').trim()));
  const calendarForClaims = (rawIds) => {
    const ids = String(rawIds || '').split(/[；;\s]+/).filter(Boolean);
    if (!ids.length) return { status: 'not-applicable' };
    const states = ids.map(calendarForClaim);
    if (states.some((state) => state.status === 'conflict')) return { status: 'conflict' };
    if (states.some((state) => ['review', 'unknown'].includes(state.status))) return { status: 'review' };
    if (states.some((state) => state.status === 'checked')) return { status: 'checked' };
    return { status: 'not-applicable' };
  };

  for (const row of portraits) {
    row['预览文件'] = localPreview(row.visual_id, row['预览文件']);
  }
  for (const row of historicSites) {
    row['预览文件'] = localPreview(row.site_id, row['预览文件']);
  }
  for (const row of (personPortraits || [])) {
    row['预览文件'] = localPreview(row.visual_id, row['预览文件']);
  }

  const portraitsByEmperor = new Map();
  for (const row of portraits) {
    const list = portraitsByEmperor.get(row.emperor_id) || [];
    list.push(row);
    portraitsByEmperor.set(row.emperor_id, list);
  }
  function primaryPortrait(emperorId) {
    const list = portraitsByEmperor.get(emperorId) || [];
    return list.find((row) => row['展示角色'] === '默认朝服像') || list[0] || null;
  }
  const crosswalkByLegacy = new Map(crosswalk.map((row) => [row.legacy_emperor_id, row]));

  // 人物卡只公布证据条数与已核对数，不暴露内部审核状态。
  const credibilityByPerson = new Map();
  for (const claim of claims) {
    const pid = claim['主体 ID'];
    if (!pid) continue;
    let c = credibilityByPerson.get(pid);
    if (!c) {
      c = { claims: 0, checked: 0 };
      credibilityByPerson.set(pid, c);
    }
    c.claims += 1;
    if (claim['状态'] === '已采纳') c.checked += 1;
  }
  const emptyCredibility = () => ({ claims: 0, checked: 0 });

  const emperorRecords = emperors.map((emperor) => {
    const map = crosswalkByLegacy.get(emperor.emperor_id);
    const personId = map?.person_id || '';
    return {
      ...pick(emperor, [
        'emperor_id', '顺序', '规范名', '年号或通称', '庙号', '谥号', '生年', '卒年', '在位起', '在位止', '在位年数',
        '皇子序', '外号', '父亲', '母亲', '前任', '继任', '陵寝', '故宫人物页',
      ]),
      person_id: personId,
      portrait: slimPortrait(primaryPortrait(emperor.emperor_id)),
      credibility: credibilityByPerson.get(personId) || emptyCredibility(),
    };
  });

  // 章节插图：构建期权利检查。绿色且可公开展示才嵌图；黄色/红色只给说明与外链。
  const portraitsByVisual = new Map(portraits.map((p) => [p.visual_id, p]));
  function chapterFig(id, overrideCaption) {
    const portrait = portraitsByVisual.get(id);
    if (!portrait) {
      console.warn(`WARN: 章节插图未知 ${id}`);
      return `<figure class="fig-inline"><div class="img-fallback">图像未找到：${escHtml(id)}</div></figure>`;
    }
    const title = portrait['对象标题'] || id;
    const caption = overrideCaption || title;
    const license = portrait['文件页标示许可'] || '';
    const fileUrl = /^https:\/\//.test(portrait['文件页'] || '') ? portrait['文件页'] : '';
    const embeddable = portrait['权利颜色'] === '绿' && portrait['可公开展示'] === '是' && portrait['预览文件'];
    if (!embeddable) {
      return `<figure class="fig-inline fig-restricted"><div class="img-fallback">${escHtml(title)} · 权利受限，不嵌入</div><figcaption>${escHtml(caption)}${fileUrl ? ` · <a href="${escHtml(fileUrl)}" target="_blank" rel="noopener">看文件页</a>` : ''}</figcaption></figure>`;
    }
    const src = localPreview(portrait.visual_id, portrait['预览文件']);
    return `<figure class="fig-inline"><a href="#/image/${escHtml(id)}"><img src="${escHtml(src)}" alt="${escHtml(title)}" loading="lazy" decoding="async"></a><figcaption><strong>${escHtml(caption)}</strong>${license ? ` · ${escHtml(license)}` : ''}${fileUrl ? ` · <a href="${escHtml(fileUrl)}" target="_blank" rel="noopener">文件页</a>` : ''}</figcaption></figure>`;
  }

  const routeTitles = {
    chapter: Object.fromEntries(chapterRows.map((row) => [row.slug, row.title])),
    lane: Object.fromEntries((lanes || []).map((row) => [row.lane_id, row['标题']])),
    site: Object.fromEntries((historicSites || []).map((row) => [row.site_id, row['事件']])),
    person: Object.fromEntries((people || []).map((row) => [row.person_id, row['规范名']])),
    image: Object.fromEntries([
      ...(portraits || []).map((row) => [row.visual_id, row['对象标题']]),
      ...(personPortraits || []).map((row) => [row.visual_id, row['对象标题']]),
    ].filter(([id, title]) => id && title)),
  };
  const chapters = chapterRows.map((row) => {
    const file = path.join(contentDir, row.file);
    const markdown = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const status = (markdown.match(/^状态：\s*(.+)$/m)?.[1] || '').replace(/`/g, '').trim();
    return { ...row, markdown, bodyHtml: publicBodyHtml(mdToHtml(markdown, chapterFig), routeTitles), status };
  });

  const overviews = (overviewRows || []).map((row) => {
    const file = path.join(contentDir, row.file);
    const markdown = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    return { ...row, markdown, bodyHtml: publicBodyHtml(mdToHtml(markdown, chapterFig), routeTitles) };
  });

  const unitById = new Map(units.map((row) => [row.source_unit_id, row]));
  const personById = new Map(people.map((row) => [row.person_id, row]));
  const siteById = new Map(historicSites.map((row) => [row.site_id, row]));
  const laneById = new Map(lanes.map((row) => [row.lane_id, row]));
  const chapterById = new Map(chapters.map((row) => [row.chapter_id, row]));

  // 正文「出场」：白名单人物在每节首见处连到人物页，同时留下人物页要用的出场索引。
  // 未入库的人物不参与，否则连出去就是死链。
  const mentionPersons = MENTION_PERSONS.filter((row) => personById.has(row.id));
  const personMentions = [];
  for (const row of chapters) {
    const annotated = annotateMentions(row.bodyHtml, mentionPersons, row);
    row.bodyHtml = annotated.html;
    personMentions.push(...annotated.mentions);
  }

  const publicPeople = people.map((row) => ({
    ...pick(row, ['person_id', '分组', '规范名', '人物类型', 'wikidata_qid', 'cbdb_id', 'ctext_entity']),
    '常用名或异名': readerMetadata(row['常用名或异名']),
  }));
  const publicPortraits = portraits.map(publicPortrait);
  const publicCrosswalk = crosswalk.map((row) => pick(row, ['person_id', 'legacy_emperor_id']));
  const publicRegions = imageRegions.map((row) => pick(row, [
    'region_id', 'visual_id', 'region_label', 'x', 'y', 'w', 'h', 'assertion_id', 'evidence_stance', 'note',
  ]));
  const publicIiif = iiifManifests.map((row) => pick(row, ['visual_id', 'iiif_manifest']));
  const publicUnits = units.map((row) => pick(row, [
    'source_unit_id', 'source_entity_id', '史料名', '卷次', '原纪年', '当日条次', '直接记录网址', 'stable_locator', '证据等级',
  ]));
  const review = loadReviewContext();
  const publicClaims = claims.map(row => {
    const { _reign, ...sourceRow } = row; // 路由派生字段不属于原始证据。
    return {
      ...publicClaim(row),
      review: review.inspect(sourceRow),
      calendar: calendarForClaim(row['Assertion ID']),
    };
  });
  const publicLanes = lanes.map((row) => ({
    ...pick(row, ['lane_id', '栏目', '相关人物ID', '标题', '来源入口', '冲突组 ID']),
    '通行说法': readerProse(row['通行说法'], { file: 'side-lanes.csv', field: `${row.lane_id}/通行说法` }),
    '官书或档案怎么写': readerProse(row['官书或档案怎么写'], { file: 'side-lanes.csv', field: `${row.lane_id}/官书` }),
    '野史笔记或影视怎么写': readerProse(row['野史笔记或影视怎么写'], { file: 'side-lanes.csv', field: `${row.lane_id}/野史` }),
    '差异或读法': readerProse(row['差异或读法'], { file: 'side-lanes.csv', field: `${row.lane_id}/读法` }),
  }));
  const publicEmpressTimeline = empressTimeline.map((row) => ({
    ...pick(row, [
      'event_id', 'person_id', '当时称号', '事件类型', '原纪年', '公历下界', '公历上界', '来源单元', '引文', '冲突组 ID', '主张 ID', '排序键',
    ]),
    '公开证据状态': evidenceLabel(row['回查状态']),
    calendar: calendarForClaims(row['主张 ID']),
  }));
  const publicPrinces = princes.map((row) => pick(row, [
    'person_id', '表序', '表序标签', '收录状态', '规范名', '世表用名', '异名', '父亲ID', '生母人物ID', '生母候选名', '生母来源', '世表摘要', '后妃传子女句', '冲突组 ID', '排序键',
  ]));
  const publicPrincesses = princesses.map((row) => pick(row, [
    'person_id', '表序', '表序标签', '收录状态', '规范名', '公主表用名', '异名', '父亲ID', '生母人物ID', '生母候选名', '生母来源', '封号摘要', '下嫁摘要', '生薨摘要', '额驸事略', '冲突组 ID', '排序键',
  ]));
  const publicHeirChain = heirChain.map((row) => ({
    ...pick(row, [
      'event_id', 'person_id', '阶段', '事件类型', '原纪年', '公历下界', '公历上界', '地点', '来源单元', '引文', '冲突组 ID', '主张 ID', '相关人物ID', '排序键',
    ]),
    '公开证据状态': evidenceLabel(row['回查状态']),
    calendar: calendarForClaims(row['主张 ID']),
  }));
  const publicSites = historicSites.map((row) => {
    const out = pick(row, [
      'site_id', '相关皇帝ID', '相关人物ID', '事件', '当时', '今日', '今地说明', '卡片钩子', '权利颜色', '图像性质分类', '文件页', '预览文件', '文件页标示许可', '作者或摄影者', '制作年代或摄影日期', '排序', '首页', '经度', '纬度',
    ]);
    for (const field of ['当时', '今日', '今地说明', '卡片钩子']) {
      out[field] = readerCopy(out[field]).replace(/\bQH-ST-\d+\b/g, (id) => siteById.get(id)?.['事件'] || '相关地点');
    }
    out['预览文件'] = localPreview(row.site_id, row['预览文件']);
    out['公开证据状态'] = evidenceLabel(row['证据状态']);
    return out;
  });
  const publicWorks = works.map((row) => ({
    ...pick(row, [
      'work_id', 'emperor_id', '文献名称', '文献类型', '编纂者/作者', '成书年代', '卷数', '内容概述', '来源入口', '排序', 'dedicated_chapter',
    ]),
    '卷数': readerMetadata(row['卷数']),
    '内容概述': readerCopy(row['内容概述']),
    availability: publicAvailability(row.open_state),
    hasDirectText: row.open_state === 'L2' || row.open_state === 'L3',
  }));
  const publicSources = sources.map((row) => ({
    ...pick(row, [
      'source_id', '机构或资源', '资源类型', '证据等级', '核心内容', '访问方式', '权利颜色', '可本地保存', '可公开展示', '可商业使用', '使用策略', '限制摘要', '资源网址', '权利或规则网址',
    ]),
    '核心内容': readerCopy(row['核心内容']),
    '访问方式': readerCopy(row['访问方式']),
    '可商业使用': readerMetadata(row['可商业使用']),
    '使用策略': readerCopy(row['使用策略']),
    '限制摘要': readerCopy(row['限制摘要']),
  }));
  const publicConflictSets = (conflictSets || []).map((row) => pick(row, ['conflict_set_id', '议题']));
  const publicChronicle = (chronicle || []).map((row) => ({
    ...pick(row, [
      'entry_id', 'emperor_id', '层级', 'parent_id', '事件类型', '标题', '原纪年', '公历下界', '公历上界', '精度', '主张IDs', '来源单元', '冲突组', '今地ID', '章节slug', '年号级收录', '排序键',
    ]),
    '说明': readerCopy(row['说明']),
    calendar: calendarForClaims(row['主张IDs']),
  }));
  // 帝页时间骨架：各朝年表的年份表解析一次，前端只排不再读 Markdown。
  // 年表仍是二手索引层，逐日官书条另有自己的主张与冲突组，两者在帝页合并成一条时间线。
  const reignTimeline = [];
  for (const row of chapters) {
    if (!/-reign-timeline\.md$/.test(String(row.file || ''))) continue;
    const emperor = emperorRecords.find((item) => item.person_id === row.person_id);
    for (const item of parseReignTimeline(row.markdown, routeTitles)) {
      reignTimeline.push({ ...item, emperor_id: emperor?.emperor_id || '', era: row.era, chapter_slug: row.slug });
    }
  }
  const publicChapters = chapters.map((row) => {
    const sourceCount = String(row.unit_ids || '').split(/[；;]/).map((id) => id.trim()).filter((id) => unitById.has(id)).length;
    const closed = isChapterEvidenceClosed(row.status, sourceCount);
    return {
      ...pick(row, ['chapter_id', 'slug', 'person_id', 'era', 'title', 'unit_ids', 'related', 'sort', '体裁']),
      lede: readerCopy(row.lede),
      bodyHtml: row.bodyHtml,
      quote: firstQuote(row.bodyHtml),
      readMinutes: Math.max(1, Math.ceil(String(row.bodyHtml || '').replace(/<[^>]*>/g, '').replace(/\s/g, '').length / 450)),
      talks: LIVE_TOPICS.filter((topic) => topic.chapter === row.slug).map(({ slug, title }) => ({ slug, title })),
      indexable: isChapterIndexable(row),
      draft: !closed,
    };
  });
  for (const row of publicChapters) {
    const bookOrder = orderedChapters(publicChapters, emperorRecords, chapterGenre(row));
    const i = bookOrder.findIndex((chapter) => chapter.slug === row.slug);
    const prev = i > 0 ? bookOrder[i - 1] : null;
    const next = i < bookOrder.length - 1 ? bookOrder[i + 1] : null;
    row.prev_slug = prev?.slug || '';
    row.prev_title = prev?.title || '';
    row.next_slug = next?.slug || '';
    row.next_title = next?.title || '';
  }
  const eraSlugByLabel = Object.fromEntries((dynasty.reignEras || []).map((era) => [era.label, era.slug]));
  function pickEmperorReads(personId) {
    const list = publicChapters
      .filter((row) => row.person_id === personId)
      .slice()
      .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
    const isTimeline = (row) => /统治年表|年表/.test(row.title || '');
    const bound = list.filter((row) => String(row.unit_ids || '').trim());
    const unbound = list.filter((row) => !String(row.unit_ids || '').trim());
    const picked = [
      ...bound.filter((row) => !isTimeline(row)),
      ...bound.filter(isTimeline),
      ...unbound,
    ].slice(0, 3);
    let lane = null;
    const skipHomeLanes = new Set(['QH-L-0007', 'QH-L-0009']);
    for (const row of [...picked, ...list]) {
      const match = String(row.related || '').match(/#\/lane\/(QH-L-\d+)/);
      if (!match || skipHomeLanes.has(match[1])) continue;
      const rec = (publicLanes || []).find((item) => item.lane_id === match[1]);
      lane = { id: match[1], title: rec?.['标题'] || '对照' };
      break;
    }
    return {
      chapters: picked.map((row) => ({ slug: row.slug, title: row.title })),
      lane,
    };
  }
  for (const emperor of emperorRecords) {
    const era = String(emperor['年号或通称'] || '').split('；')[0];
    emperor.eraSlug = eraSlugByLabel[era] || '';
    const firstChapter = publicChapters
      .filter((row) => row.person_id === emperor.person_id)
      .slice()
      .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))[0];
    emperor.chronicleSlug = firstChapter?.slug?.split('-')[0] || '';
    emperor.reads = pickEmperorReads(emperor.person_id);
  }
  const publicOverviews = overviews.map((row) => ({
    ...pick(row, ['overview_id', 'slug', 'title', 'sort']),
    lede: readerCopy(row.lede),
    bodyHtml: row.bodyHtml,
  }));

  function questionLink(id) {
    const value = String(id || '').trim();
    if (!value) return null;
    if (/^QH-A-/.test(value)) return { href: `#/claim/${value}`, label: '相关依据' };
    if (/^QH-P-/.test(value)) return { href: `#/person/${value}`, label: personById.get(value)?.['规范名'] || '相关人物' };
    if (/^QH-ST-/.test(value)) return { href: `#/site/${value}`, label: siteById.get(value)?.['事件'] || '相关遗址今况' };
    if (/^QH-L-/.test(value)) return { href: `#/lane/${value}`, label: laneById.get(value)?.['标题'] || '相关对照' };
    if (/^QH-SU-/.test(value)) {
      const unit = unitById.get(value);
      return { href: `#/claims?unit=${encodeURIComponent(value)}`, label: [unit?.['史料名'], unit?.['卷次']].filter(Boolean).join(' ') || '相关原文' };
    }
    if (/^QH-CH-/.test(value)) {
      const chapter = chapterById.get(value);
      return chapter ? { href: `#/chapter/${chapter.slug}`, label: chapter.title } : null;
    }
    return null;
  }

  const publicQuestions = questions.map((row) => ({
    question_id: row.question_id,
    category: row['类别'] === '无证据拒答' ? '证据边界' : row['类别'],
    question: readerCopy(row['问题']),
    answer: row['期望行为'] === '拒绝作答' ? '' : readerCopy(row['可公开答案']),
    evidenceGap: row['期望行为'] === '拒绝作答',
    explanation: row['期望行为'] === '拒绝作答' ? readerCopy(row['拒答说明']) : '',
    route: row['路由'],
    links: String(row['绑定ID'] || '').split(/[；;]/).map(questionLink).filter(Boolean),
  }));

  // 按朝归集主张总量：朝次来自主张表 reign 列，不是 ID 前缀
  const eraBySlug = Object.fromEntries(dynasty.reignEras.map((e) => [e.slug, e.label]));
  const claimsByReign = {};
  for (const row of claims) {
    const reign = eraBySlug[row._reign] || '其他';
    claimsByReign[reign] = (claimsByReign[reign] || 0) + 1;
    delete row._reign;
  }
  const coverage = {
    emperors: emperors.length,
    people: people.length,
    sources: sources.length,
    claims: claims.length,
    claimsByReign,
    checkedClaims: claims.filter((row) => row['状态'] === '已采纳').length,
    portraits: portraits.length,
    lanes: lanes.length,
    empressEvents: empressTimeline.length,
    princes: princes.length,
    princesses: princesses.length,
    heirEvents: heirChain.length,
    sites: historicSites.length,
    questions: questions.length,
    chapters: chapters.length,
  };

  const suggest = [];
  const seenPeople = new Set();
  for (const emperor of emperorRecords) {
    seenPeople.add(emperor.person_id);
    suggest.push({
      type: 'person',
      id: emperor.person_id,
      label: emperor['年号或通称'].split('；')[0],
      extra: emperor['规范名'],
      href: `#/person/${emperor.person_id}`,
      hay: [emperor.person_id, emperor.emperor_id, emperor['规范名'], emperor['年号或通称'], emperor['庙号'], emperor['父亲'], emperor['母亲'], py([emperor['规范名'], emperor['年号或通称'], emperor['庙号']].join(''))].join(' '),
    });
  }
  for (const person of people) {
    if (seenPeople.has(person.person_id)) continue;
    const aliases = readerMetadata(person['常用名或异名']);
    suggest.push({
      type: 'person',
      id: person.person_id,
      label: person['规范名'].replace(/^爱新觉罗·/, ''),
      extra: aliases,
      href: `#/person/${person.person_id}`,
      hay: [person.person_id, person['规范名'], aliases, person['人物类型'], py([person['规范名'], aliases].join(''))].join(' '),
    });
  }
  for (const row of publicChapters) {
    suggest.push({
      type: 'chapter',
      id: row.slug,
      label: row.title,
      extra: row.era,
      href: `#/chapter/${row.slug}`,
      hay: [row.slug, row.title, row.lede, row.era, row.quote, py(row.title)].join(' '),
    });
  }
  for (const row of publicSites) {
    suggest.push({
      type: 'site',
      id: row.site_id,
      label: row['事件'],
      extra: String(row['今日'] || '').split('。')[0],
      href: `#/site/${row.site_id}`,
      hay: [row.site_id, row['事件'], row['当时'], row['今日'], row['卡片钩子'], py(row['事件'])].join(' '),
    });
  }
  for (const row of publicWorks) {
    const href = row.dedicated_chapter ? `#/chapter/${row.dedicated_chapter}` : '#/works';
    suggest.push({
      type: 'work',
      id: row.work_id,
      label: row['文献名称'],
      extra: row['文献类型'],
      href,
      hay: [row.work_id, row['文献名称'], row['文献类型'], row['内容概述'], py(row['文献名称'])].join(' '),
    });
  }
  for (const row of (ziguanggeHeroes || [])) {
    suggest.push({
      type: 'ziguangge',
      id: row.slug,
      label: row['姓名'],
      extra: `${row['批次']} · ${row['战役']}`,
      href: `#/ziguangge/${row.slug}`,
      hay: [row.slug, row['姓名'], row['满蒙回名'], row['旗籍身份'], row['批次'], row['战役'], row['检索词'], py(row['姓名'])].join(' '),
    });
  }

  const searchEntries = [
    ...suggest.map((row) => {
      const chapter = row.type === 'chapter' ? publicChapters.find((item) => item.slug === row.id) : null;
      const text = chapter ? String(chapter.bodyHtml || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
      return searchEntry(row.type, row.id, text ? `${row.hay} ${text}` : row.hay, {
        label: row.label, extra: row.extra,
        ...(chapter ? { bodyStart: row.hay.length + 1, lede: chapter.lede } : {}),
      });
    }),
    ...publicClaims.map((row) => searchEntry('claim', row['Assertion ID'], [row['主体 ID'], row['谓词/关系'], row['客体 ID 或值'], row['原始时间表达'], row['支持引文']].join(' '))),
    ...publicSources.map((row) => searchEntry('source', row.source_id, [row['机构或资源'], row['资源类型'], row['核心内容']].join(' '))),
    ...publicLanes.map((row) => searchEntry('lane', row.lane_id, [row['标题'], row['通行说法'], row['官书或档案怎么写'], row['野史笔记或影视怎么写'], row['差异或读法']].join(' '))),
    ...publicEmpressTimeline.map((row) => searchEntry('empress', row.event_id, [row['当时称号'], row['事件类型'], row['原纪年'], row['引文'], py(row['当时称号'])].join(' '))),
    ...publicPrinces.map((row) => searchEntry('prince', row.person_id, [row['规范名'], row['异名'], row['表序标签'], row['世表摘要'], py(row['规范名'])].join(' '), {
      label: row['规范名'].replace(/^爱新觉罗·/, ''),
      extra: row['表序标签'],
    })),
    ...publicPrincesses.map((row) => searchEntry('princess', row.person_id, [row['规范名'], row['异名'], row['表序标签'], row['封号摘要'], row['下嫁摘要'], py(row['规范名'])].join(' '), {
      label: row['规范名'].replace(/^爱新觉罗氏/, ''),
      extra: row['表序标签'],
    })),
    ...publicHeirChain.map((row) => searchEntry('heir', row.event_id, [row['阶段'], row['事件类型'], row['原纪年'], row['引文']].join(' '))),
    ...publicQuestions.map((row) => searchEntry('question', row.question_id, [row.question, row.answer, row.explanation, row.category].join(' '), {
      label: row.question,
      extra: row.category,
    })),
  ];

  const slim = slimDynasty(dynasty);
  const written = [
    writeJson(`d-${dynasty.code}.json`, {
      units: publicUnits,
      claims: publicClaims,
      lanes: publicLanes,
      empressTimeline: publicEmpressTimeline,
      princes: publicPrinces,
      princesses: publicPrincesses,
      heirChain: publicHeirChain,
      chapters: publicChapters.map((row) => {
        const { bodyHtml, quote, ...meta } = row;
        return meta;
      }),
      personMentions,
      questions: publicQuestions,
      works: publicWorks,
      conflictSets: publicConflictSets,
      chronicle: publicChronicle,
      reignTimeline,
      overviews: publicOverviews,
      predicates: Object.fromEntries(
        (vocab || [])
          .filter((row) => ['assertion_predicate', 'relationship_type'].includes(row.scheme_code) && row['是否启用'] !== 'false')
          .map((row) => [row.term_code, row['中文标签']]),
      ),
      ziguanggeHeroes: (ziguanggeHeroes || []).map((row) => pick(row, [
        'hero_id', 'slug', '姓名', '满蒙回名', '旗籍身份', '批次', '战役', '名次',
        '位列理由', '像赞类型', '像赞原文', '像赞出处', '事迹', '事迹出处',
        '图像类型', '预览文件', '图像来源', '权利状态', '图像说明', 'visual_brief', '完整度',
      ])),
      ziguanggeBatches: ziguanggeBatches || [],
    }),
    writeJson('home.json', {
      // 构建产物必须可重复；发布时间由部署平台提供，不写入每次变化的当前时间。
      notice: '引文可回原文。家谱尚未用玉牒核对。满汉遗诏原件未见。',
      dynasty: slim,
      featuredReads: selectReadingPicks(publicChapters, { limit: FEATURED_COUNT }),
      emperors: emperorRecords,
      sites: publicSites,
      coverage,
      credibility: {
        totalClaims: claims.length,
        checkedClaims: claims.filter((row) => row['状态'] === '已采纳').length,
        emperorsWithClaims: emperorRecords.filter((e) => (e.credibility?.claims || 0) > 0).length,
      },
    }),
    writeJson('suggest.json', { suggest }),
    writeJson('people.json', { people: publicPeople, portraits: publicPortraits, crosswalk: publicCrosswalk, regions: publicRegions, iiif: publicIiif, personPortraits: (personPortraits || []).map((row) => ({
      visual_id: row.visual_id,
      person_id: row.person_id,
      '对象标题': row['对象标题'],
      '图像性质': row['图像性质'],
      '图像性质分类': row['图像性质分类'],
      '作者或摄影者': row['作者或摄影者'],
      '制作年代': row['制作年代'],
      '文件页': row['文件页'],
      '预览文件': row['预览文件'],
      '许可': row['许可'],
      '使用说明': row['使用说明'],
    })) }),
    writeJson('catalog.json', { sources: publicSources }),
  ];
  const chapterBodyDir = path.join(dataOutDir, 'chapter');
  fs.rmSync(chapterBodyDir, { recursive: true, force: true });
  fs.mkdirSync(chapterBodyDir, { recursive: true });
  for (const row of publicChapters) {
    written.push(writeJson(`chapter/${row.slug}.json`, {
      slug: row.slug,
      title: row.title,
      lede: row.lede,
      era: row.era,
      '体裁': row['体裁'],
      person_id: row.person_id,
      unit_ids: row.unit_ids,
      related: row.related,
      sort: row.sort,
      indexable: row.indexable,
      draft: row.draft,
      readMinutes: row.readMinutes,
      talks: row.talks,
      bodyHtml: row.bodyHtml,
    }));
  }

  // 首页直出与发现元信息
  renderHomePage({ dynasty, slim, emperorRecords, historicSites, publicChapters, portraits });

  return { dynasty: dynasty.code, written, searchEntries, emperorCount: emperorRecords.length, siteCount: historicSites.length };
}

/** 首页直出：把 SSR 的 `<main>`、朝代配置、发现元信息、主题引导与版本行写回 index.html。只读上一步的结果。 */
function renderHomePage({ dynasty, slim, emperorRecords, historicSites, publicChapters, portraits }) {
  const indexPath = path.join(siteDir, 'index.html');
  let indexHtml = fs.readFileSync(indexPath, 'utf8');
  // 编辑器／预览面板会把 data-page-node-id 这类标记注入到磁盘上的 index.html。
  // 它是工具产物、不是站点内容：留在模板里会被原样写回，还会让「顶栏导航」这类
  // 带严格标签形态的断言失配（实测 37 处）。写盘前剥掉，保证模板始终干净。
  const toolingMarks = indexHtml.match(/ data-page-node-id="[^"]*"/g) || [];
  if (toolingMarks.length) {
    indexHtml = indexHtml.replace(/ data-page-node-id="[^"]*"/g, '');
    console.log(`[build-site] 剥离 ${toolingMarks.length} 处工具注入标记 data-page-node-id`);
  }
  const homeRe = /<main id="main"[^>]*>[\s\S]*?<\/main>/;
  if (homeRe.test(indexHtml)) {
    const home = homeHtml(slim, emperorRecords, historicSites, { onerror: false });
    indexHtml = indexHtml.replace(homeRe, `<main id="main" tabindex="-1" data-ssr="home">\n${home}\n  </main>`);
  } else {
    console.warn('WARN: index.html 未找到 <main id="main">，跳过直出。');
  }
  // 注入朝代配置：app.js 启动时同步读取 #dynasty-config，决定数据块与专题路由。
  // 资源戳必须覆盖代码、全部源数据和分章正文；否则只改正文或来源目录时，按需 JSON 的 URL 不变，
  // 回访读者会继续使用浏览器缓存中的旧内容。
  const assetHash = createHash('sha256');
  // 代码清单靠扫目录而不是手抄：浏览器模块之间互相 import，漏一个（basemap.js 就漏过）
  // 等于改了它资源戳不动，回访的浏览器继续跑旧代码。
  const assetFiles = fs.readdirSync(siteDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:js|css)$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  for (const file of assetFiles) assetHash.update(fs.readFileSync(path.join(siteDir, file)));
  for (const file of [...new Set(DATA_MANIFEST.map((entry) => entry.file))].sort()) {
    const source = path.join(dataDir, file);
    if (fs.existsSync(source)) assetHash.update(fs.readFileSync(source));
  }
  for (const row of publicChapters) assetHash.update(row.slug).update(row.bodyHtml || '');
  for (const file of ['home.json', 'suggest.json', `d-${dynasty.code}.json`, 'release.json']) {
    const generated = path.join(dataOutDir, file);
    if (fs.existsSync(generated)) assetHash.update(fs.readFileSync(generated));
  }
  const assetStamp = assetHash.digest('hex').slice(0, 12);
  const dynastyConfig = {
    code: dynasty.code,
    label: dynasty.label,
    chunk: `d-${dynasty.code}`,
    eras: slim.eras,
    v: assetStamp,
  };
  const configTag = `  <script type="application/json" id="dynasty-config">${JSON.stringify(dynastyConfig)}</script>\n`;
  const configRe = /[ \t]*<script type="application\/json" id="dynasty-config">[\s\S]*?<\/script>\n?/;
  indexHtml = configRe.test(indexHtml)
    ? indexHtml.replace(configRe, configTag)
    : indexHtml.replace('</head>', `${configTag}</head>`);
  const homePortrait = portraits.find((row) => row.emperor_id === 'QH-E-04' && row['展示角色'] === '默认朝服像')
    || portraits.find((row) => row['展示角色'] === '默认朝服像');
  const homeImage = homePortrait?.['预览文件'] ? new URL(homePortrait['预览文件'], siteBaseUrl).href : '';
  const homeDescription = dynasty.lede;
  const homeStructured = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'WebSite', name: '清史读本',
    url: siteBaseUrl.href, inLanguage: 'zh-Hans', description: homeDescription,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteBaseUrl.href}#/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }).replace(/</g, '\\u003c');
  const discoveryMeta = `  <!-- generated-site-meta:start -->
  <meta name="robots" content="noindex,follow">
  <meta name="description" content="${escHtml(homeDescription)}">
  <link rel="canonical" href="${escHtml(siteBaseUrl.href)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="清史读本">
  <meta property="og:title" content="清史读本">
  <meta property="og:description" content="${escHtml(homeDescription)}">
  <meta property="og:url" content="${escHtml(siteBaseUrl.href)}">
  ${homeImage ? `<meta property="og:image" content="${escHtml(homeImage)}">` : ''}
  <meta name="twitter:card" content="${homeImage ? 'summary_large_image' : 'summary'}">
  <script type="application/ld+json">${homeStructured}</script>
  <!-- generated-site-meta:end -->`;
  const discoveryMetaRe = /  <!-- generated-site-meta:start -->[\s\S]*?  <!-- generated-site-meta:end -->/;
  indexHtml = discoveryMetaRe.test(indexHtml)
    ? indexHtml.replace(discoveryMetaRe, discoveryMeta)
    : indexHtml.replace('</head>', `${discoveryMeta}\n</head>`);
  indexHtml = withThemeBoot(indexHtml);
  indexHtml = indexHtml.replace(/href="styles\.css\?v=[^"]+"/, `href="styles.css?v=${assetStamp}"`);
  indexHtml = indexHtml.replace(/src="app\.js(?:\?v=[^"]*)?"/, `src="app.js?v=${assetStamp}"`);
  const versionTag = siteFooterVersion(readVersion()).trim();
  const versionRe = /  <!-- generated-site-version:start -->[\s\S]*?  <!-- generated-site-version:end -->/;
  const versionBlock = `  <!-- generated-site-version:start -->\n    ${versionTag}\n    <!-- generated-site-version:end -->`;
  indexHtml = versionRe.test(indexHtml)
    ? indexHtml.replace(versionRe, versionBlock)
    : indexHtml.replace('</footer>', `  ${versionTag}\n  </footer>`);
  fs.writeFileSync(indexPath, indexHtml);
}

function build() {
  fs.mkdirSync(dataOutDir, { recursive: true });
  removeLegacyMirrors();
  writeRobotsTxt();

  const activeList = activeDynasties();
  if (activeList.length === 0) {
    console.error('ERROR: dynasties.csv 没有 active=是 的朝代，无法构建。请指定一个 active 朝代。');
    process.exit(1);
  }
  if (activeList.length > 1) {
    console.error(
      `ERROR: 检测到多个 active 朝代（${activeList.map((d) => d.code).join(', ')}），但本站是单朝代运行时：`,
      '#dynasty-config、首页直出与 home/people/catalog.json 一次只能承载一个朝代，同时构建会互相覆盖（后写者胜）而非并存。',
      '请把 dynasties.csv 里除目标外的朝代设为 active=否；真正的多朝代并存需先把数据块前缀化为 d-<code> 并给前端加朝代切换器。',
    );
    process.exit(1);
  }

  const allSearchEntries = [];
  const reports = [];
  for (const dynasty of activeList) {
    const loaded = loadDynasty(dynasty);
    const report = buildDynasty(loaded);
    allSearchEntries.push(...report.searchEntries);
    reports.push(report);
  }

  const searchWritten = writeJson('search.json', { entries: allSearchEntries });
  reports.push({ dynasty: 'search', written: [searchWritten] });

  // 清理已被 d-${code}.json 取代的旧产物
  const legacyDataJs = path.join(siteDir, 'data.js');
  if (fs.existsSync(legacyDataJs)) fs.unlinkSync(legacyDataJs);
  const legacyKangxi = path.join(dataOutDir, 'kangxi.json');
  if (fs.existsSync(legacyKangxi)) fs.unlinkSync(legacyKangxi);

  const summary = reports
    .flatMap((r) => r.written.map((item) => `${item.name} ${item.bytes}B`))
    .join(', ');
  console.log(`Wrote site/data/{${reports.flatMap((r) => r.written.map((item) => item.name)).join(', ')}} (${summary})`);
  const home = reports.find((r) => r.dynasty !== 'search');
  if (home) console.log(`Home emperors ${home.emperorCount}, sites ${home.siteCount}, search entries ${allSearchEntries.length}`);
}

build();

if (process.argv.includes('--watch')) {
  let timer = null;
  const kick = (event, filename) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`rebuild after ${event} ${filename || ''}`);
      try {
        if (String(filename || '').endsWith('source-claims.csv')) {
          execFileSync(process.execPath, [path.join(scriptDir, 'check-calendar-baseline.mjs')], { stdio: 'inherit' });
        }
        build();
      } catch (err) {
        console.error(err);
      }
    }, 200);
  };
  fs.watch(dataDir, { recursive: true }, kick);
  fs.watch(contentDir, { recursive: true }, kick);
  // 单文件 watch 在 macOS 上是按所在目录实现的，兄弟文件被重写也会报成 templates.js 变了。
  // build 每次都写 site/index.html，于是重建→自触发→重建无限循环（实测一次保存刷出 122 次重建）。
  // 改成显式盯 site/ 目录并按文件名精确过滤，只有 templates.js 真的变了才重建。
  fs.watch(siteDir, (event, filename) => {
    if (String(filename).endsWith('templates.js')) kick(event, filename);
  });
  console.log('watching data/, content/, site/templates.js');
}
