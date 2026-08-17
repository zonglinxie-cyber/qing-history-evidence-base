import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCsv } from './lib/csv.mjs';
import { CSV_FILES, DATA_MANIFEST, KIND_TO_FIELD, activeDynasties } from './lib/schema.mjs';
import { buildIndex } from '../site/search.js';
import { homeHtml } from '../site/templates.js';
import { pinyin } from 'pinyin-pro';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const dataDir = path.join(root, 'data');
const siteDir = path.join(root, 'site');
const dataOutDir = path.join(siteDir, 'data');
const contentDir = path.join(root, 'content');
const siteBaseUrl = new URL(process.env.SITE_URL || 'https://zonglinxie-cyber.github.io/qing-history-evidence-base/');
if (!siteBaseUrl.pathname.endsWith('/')) siteBaseUrl.pathname += '/';

function load(file) {
  return loadCsv(path.join(dataDir, file), {
    name: file,
    required: CSV_FILES[file]?.required,
  });
}

function localPreview(id, remoteUrl) {
  const remote = String(remoteUrl || '').trim();
  // 优先使用本地缓存；格式按真实内容保存，避免把 PNG 伪装成 .jpg。
  if (id) {
    for (const ext of ['webp', 'png', 'jpg', 'jpeg']) {
      const localRel = `media/${id}.${ext}`;
      if (fs.existsSync(path.join(siteDir, localRel))) return localRel;
    }
  }
  return remote;
}

function slimPortrait(portrait) {
  if (!portrait) return null;
  return {
    visual_id: portrait.visual_id,
    emperor_id: portrait.emperor_id,
    对象标题: portrait['对象标题'],
    预览文件: localPreview(portrait.visual_id, portrait['预览文件']),
    权利颜色: portrait['权利颜色'],
    可公开展示: portrait['可公开展示'],
    展示角色: portrait['展示角色'],
  };
}

function searchEntry(type, id, hay, extra = {}) {
  return { type, id, hay, ...extra };
}

// 拼音（无声调、去空格）并入检索 hay，支持 yinzhen → 胤禛 这类查询
function py(text) {
  try {
    return pinyin(String(text || ''), { toneType: 'none', nonZh: 'none' }).replace(/\s+/g, '');
  } catch {
    return '';
  }
}

function countBy(rows, field) {
  const out = {};
  for (const row of rows) {
    const val = row[field] || '';
    out[val] = (out[val] || 0) + 1;
  }
  return out;
}

function writeJson(name, payload) {
  const file = path.join(dataOutDir, name);
  const json = `${JSON.stringify(payload)}\n`;
  fs.writeFileSync(file, json);
  return { name, bytes: json.length };
}

function escHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[ch]));
}

function headingSlug(raw, used) {
  const plain = String(raw).replace(/<[^>]+>/g, '').trim();
  let base = plain.replace(/[：:]/g, '-').replace(/\s+/g, '-').replace(/[「」『』《》]/g, '');
  if (!base) base = 'section';
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

function inlineMd(text) {
  let out = escHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const safe = /^(https?:\/\/|#\/)/.test(href) ? href : '#';
    const extra = safe.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
    return `<a class="link" href="${escHtml(safe)}"${extra}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\{\{claim:([A-Za-z0-9-]+)\}\}/g, (_, id) => (
    `<button type="button" class="link claim-ref" data-claim="${escHtml(id)}">看依据</button>`
  ));
  return out;
}

const MD_BLOCK = /^(#{1,3} |\- |\d+\. |\||>|\{\{fig:|\{\{conflict:)/;

function mdToHtml(src, fig) {
  const text = String(src || '').replace(/\r\n/g, '\n').replace(/^# .+\n+/, '');
  const lines = text.split('\n');
  const html = [];
  const usedIds = new Set();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    // 内部复核信息不进阅读正文：状态行与「待用户抽查」清单只在研究稿与 CSV 里保留
    if (/^状态：/.test(line.trim())) {
      i += 1;
      continue;
    }
    if (/^## 待用户抽查/.test(line.trim())) {
      i += 1;
      while (i < lines.length && !/^## /.test(lines[i])) i += 1;
      continue;
    }
    // 插图语法：整行 {{fig:QH-V-E01}} 或 {{fig:QH-V-E01|自定义图注}}，权利检查在构建期完成
    const figMatch = line.trim().match(/^\{\{fig:([A-Za-z0-9-]+)(?:\|([^}]*))?\}\}$/);
    if (figMatch) {
      html.push(fig ? fig(figMatch[1], (figMatch[2] || '').trim()) : '');
      i += 1;
      continue;
    }
    const conflictMatch = line.trim().match(/^\{\{conflict:([A-Za-z0-9-]+)(?:\|([^}]*))?\}\}$/);
    if (conflictMatch) {
      const id = conflictMatch[1];
      const label = (conflictMatch[2] || '').trim();
      html.push(`<div class="claim-compare conflict-embed" data-conflict="${escHtml(id)}"${label ? ` data-label="${escHtml(label)}"` : ''}></div>`);
      i += 1;
      continue;
    }
    if (line.startsWith('>')) {
      const quotes = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quotes.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      html.push(`<blockquote class="quote source-quote"><p>${inlineMd(quotes.join(' '))}</p></blockquote>`);
      continue;
    }
    if (line.startsWith('## ')) {
      const title = line.slice(3);
      const id = headingSlug(title, usedIds);
      html.push(`<h2 id="${escHtml(id)}">${inlineMd(title)}</h2>`);
      i += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      const title = line.slice(4);
      const id = headingSlug(title, usedIds);
      html.push(`<h3 id="${escHtml(id)}">${inlineMd(title)}</h3>`);
      i += 1;
      continue;
    }
    if (line.startsWith('#### ')) {
      const title = line.slice(5);
      const id = headingSlug(title, usedIds);
      const body = [];
      i += 1;
      while (i < lines.length && lines[i].trim() && !/^#{1,4} /.test(lines[i]) && !lines[i].startsWith('>') && !lines[i].startsWith('{{')) {
        body.push(`<p>${inlineMd(lines[i])}</p>`);
        i += 1;
      }
      html.push(`<aside class="read-line" id="${escHtml(id)}"><h4>${inlineMd(title)}</h4>${body.join('')}</aside>`);
      continue;
    }
    if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(`<li>${inlineMd(lines[i].slice(2))}</li>`);
        i += 1;
      }
      html.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li>${inlineMd(lines[i].replace(/^\d+\. /, ''))}</li>`);
        i += 1;
      }
      html.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        const cells = lines[i].split('|').slice(1, -1).map((cell) => cell.trim());
        if (!/^[-: ]+$/.test(cells.join(''))) rows.push(cells);
        i += 1;
      }
      if (rows.length) {
        const [head, ...body] = rows;
        html.push(`<div class="table-wrap"><table><thead><tr>${head.map((cell) => `<th>${inlineMd(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inlineMd(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      }
      continue;
    }
    const para = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !MD_BLOCK.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    const paraText = para.join(' ');
    const paraHtml = `<p>${inlineMd(paraText)}</p>`;
    html.push(paraText.startsWith('范围：')
      ? `<details class="evidence-drawer scope"><summary>本章范围</summary>${paraHtml}</details>`
      : paraHtml);
  }
  return wrapDrawers(html.join('\n'));
}

// 研究元信息折叠进证据抽屉：正文只留结论、怎么读与分日/骨架
function wrapDrawers(html) {
  const labels = { '边界': '本章边界', '尚未解决': '尚未解决' };
  let out = html;
  for (const [title, label] of Object.entries(labels)) {
    const re = new RegExp(`<h2 id="[^"]+">${title}</h2>([\\s\\S]*?)(?=<h2|$)`, 'g');
    out = out.replace(re, `<details class="evidence-drawer"><summary>${label}</summary>$1</details>`);
  }
  return wrapTeach(out);
}

function wrapTeach(html) {
  return html.replace(
    /(<h2 id="[^"]+">怎么读这件事<\/h2>)([\s\S]*?)(?=<h2|<!--|$)/,
    '$1<div class="teach">$2</div>',
  );
}
function staticChapterBody(html) {
  return String(html || '')
    .replace(
      /<button type="button" class="link claim-ref" data-claim="([A-Za-z0-9-]+)">看依据<\/button>/g,
      (_, id) => `<a class="link claim-ref" href="#/claim/${escHtml(id)}">看依据</a>`,
    )
    .replace(
      /<div class="claim-compare conflict-embed" data-conflict="([A-Za-z0-9-]+)"(?: data-label="[^"]*")?><\/div>/g,
      (_, id) => `<aside class="read-line"><h4>同组异说</h4><p><a class="link" href="#/claims">在交互版查看冲突组 ${escHtml(id)}</a></p></aside>`,
    );
}

function staticChapterHtml({ chapter, units, portrait, prev, next, indexable }) {
  const canonical = new URL(`chapter/${encodeURIComponent(chapter.slug)}/`, siteBaseUrl).href;
  const image = portrait?.['预览文件'] ? new URL(portrait['预览文件'], siteBaseUrl).href : '';
  const robots = indexable ? 'index,follow' : 'noindex,follow';
  const structured = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: chapter.title,
    description: chapter.lede,
    inLanguage: 'zh-Hans',
    isPartOf: { '@type': 'WebSite', name: '清史读本', url: siteBaseUrl.href },
    url: canonical,
    ...(image ? { image } : {}),
  }).replace(/</g, '\\u003c');
  const evidence = units.length
    ? `<section class="chapter-evidence">
        <h2>本章打开过的卷</h2>
        <p>${units.length} 处结构化来源。逐条主张、复核状态和原文链接请进入交互版。</p>
        <p class="actions">${units.map((unit) => `<a class="link" href="#/claims?unit=${escHtml(unit.source_unit_id)}">${escHtml([unit['史料名'], unit['卷次']].filter(Boolean).join(' '))}</a>`).join(' · ')}</p>
      </section>`
    : `<p class="bound">本章尚未绑定结构化来源单元，因此不会进入 sitemap；当前页面仅供分享与人工检查。</p>`;
  const nav = (prev || next) ? `<nav class="chapter-nav" aria-label="上下篇">
      ${prev ? `<a class="link" href="chapter/${escHtml(prev.slug)}/">上一篇 ${escHtml(prev.title)}</a>` : '<span></span>'}
      ${next ? `<a class="link" href="chapter/${escHtml(next.slug)}/">下一篇 ${escHtml(next.title)}</a>` : '<span></span>'}
    </nav>` : '';
  return `<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="../../">
  <title>${escHtml(chapter.title)} · 清史读本</title>
  <meta name="description" content="${escHtml(chapter.lede)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${escHtml(canonical)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="清史读本">
  <meta property="og:title" content="${escHtml(chapter.title)}">
  <meta property="og:description" content="${escHtml(chapter.lede)}">
  <meta property="og:url" content="${escHtml(canonical)}">
  ${image ? `<meta property="og:image" content="${escHtml(image)}">` : ''}
  <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
  <meta name="theme-color" content="#f4efe4" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#191512" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📜</text></svg>">
  <link rel="stylesheet" href="styles.css?v=9">
  <script type="application/ld+json">${structured}</script>
</head>
<body>
  <a class="skip" href="#main">跳到正文</a>
  <header class="masthead static-masthead">
    <a class="brand" href="./">清史读本</a>
    <nav class="nav" aria-label="主导航">
      <a href="#/path">读路</a><a href="#/">十二帝</a><a href="#/sites">今地</a><a href="#/works">文献</a>
    </nav>
  </header>
  <main id="main" tabindex="-1">
    <article>
      <div class="reading">
        <p class="kicker">${escHtml(chapter.era)}</p>
        <h1>${escHtml(chapter.title)}</h1>
        <p class="lede">${escHtml(chapter.lede)}</p>
        ${chapter.status ? `<p class="status-chip">${escHtml(chapter.status)}</p>` : ''}
        <p class="crumb"><a class="link" href="#/chapter/${escHtml(chapter.slug)}">打开交互版与主张抽屉</a></p>
      </div>
      <div class="md">${staticChapterBody(chapter.bodyHtml)}</div>
      ${evidence}
      ${nav}
    </article>
  </main>
  <footer class="foot">
    <p class="foot-links"><a href="#/how">怎么读</a> · <a href="#/questions">黄金问题</a> · <a href="#/sources">来源</a></p>
    <p class="foot-links"><a href="https://github.com/zonglinxie-cyber/qing-history-evidence-base" rel="noopener">开源仓库</a></p>
  </footer>
</body>
</html>
`;
}

function writeStaticChapterPages({ chapters, units, portraits, emperors }) {
  const chapterDir = path.join(siteDir, 'chapter');
  fs.rmSync(chapterDir, { recursive: true, force: true });
  fs.mkdirSync(chapterDir, { recursive: true });
  const unitById = new Map(units.map((unit) => [unit.source_unit_id, unit]));
  const emperorByPerson = new Map(emperors.map((emperor) => [emperor.person_id, emperor]));
  const primaryByEmperor = new Map();
  for (const portrait of portraits) {
    if (portrait['展示角色'] === '默认朝服像') primaryByEmperor.set(portrait.emperor_id, portrait);
  }
  const indexable = [];
  for (const chapter of chapters) {
    if (!/^[a-z0-9-]+$/.test(chapter.slug)) throw new Error(`静态章节 slug 非法: ${chapter.slug}`);
    const sourceUnits = String(chapter.unit_ids || '').split(/[；;]/).map((id) => unitById.get(id.trim())).filter(Boolean);
    const canIndex = sourceUnits.length > 0 && /E1\s*单源回查/.test(chapter.status || '');
    const siblings = chapters.filter((row) => row.person_id === chapter.person_id)
      .slice().sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
    const at = siblings.findIndex((row) => row.slug === chapter.slug);
    const emperor = emperorByPerson.get(chapter.person_id);
    const page = staticChapterHtml({
      chapter,
      units: sourceUnits,
      portrait: emperor ? primaryByEmperor.get(emperor.emperor_id) : null,
      prev: at > 0 ? siblings[at - 1] : null,
      next: at >= 0 && at < siblings.length - 1 ? siblings[at + 1] : null,
      indexable: canIndex,
    });
    const out = path.join(chapterDir, chapter.slug);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'index.html'), page);
    if (canIndex) indexable.push(chapter);
  }

  const urls = [siteBaseUrl.href, ...indexable.map((chapter) => new URL(`chapter/${encodeURIComponent(chapter.slug)}/`, siteBaseUrl).href)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escHtml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(siteDir, 'sitemap.xml'), sitemap);
  fs.writeFileSync(path.join(siteDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap.xml', siteBaseUrl).href}\n`);
  return { total: chapters.length, indexable: indexable.length };
}


// 装载本朝文件（含 shared 共享文件），按 kind 合并；返回 { dynasty, data: {field: rows} }。
// 主张行保留 manifest.reign，供覆盖度按朝分组；不从 Assertion ID 正则推朝次。
function loadDynasty(dynasty) {
  const byKind = new Map();
  for (const entry of DATA_MANIFEST) {
    if (entry.dynasty !== dynasty.code && entry.dynasty !== 'shared') continue;
    const rows = load(entry.file).map((r) => (
      entry.kind === 'source_claims' ? { ...r, _reign: entry.reign } : r
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
  } = data;

  for (const row of portraits) {
    row['预览文件'] = localPreview(row.visual_id, row['预览文件']);
  }
  for (const row of historicSites) {
    row['预览文件'] = localPreview(row.site_id, row['预览文件']);
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

  // B1: 按 person_id 归集 claims，算状态计数 + 最高证据层级
  const STRENGTH_RANK = { '强': 2, '中': 1 };
  const credibilityByPerson = new Map();
  for (const claim of claims) {
    const pid = claim['主体 ID'];
    if (!pid) continue;
    let c = credibilityByPerson.get(pid);
    if (!c) {
      c = { claims: 0, byStatus: {}, byStance: {}, byDirectness: {}, topStrength: '' };
      credibilityByPerson.set(pid, c);
    }
    c.claims += 1;
    for (const [field, bucket] of [['状态', 'byStatus'], ['证据立场', 'byStance'], ['证据直接性', 'byDirectness']]) {
      const val = claim[field] || '';
      c[bucket][val] = (c[bucket][val] || 0) + 1;
    }
    const strength = claim['证据强度'] || '';
    if ((STRENGTH_RANK[strength] || 0) > (STRENGTH_RANK[c.topStrength] || 0)) c.topStrength = strength;
  }
  const emptyCredibility = () => ({ claims: 0, byStatus: {}, byStance: {}, byDirectness: {}, topStrength: '' });

  const emperorRecords = emperors.map((emperor) => {
    const map = crosswalkByLegacy.get(emperor.emperor_id);
    const personId = map?.person_id || '';
    return {
      ...emperor,
      person_id: personId,
      id_status: map?.status || '',
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

  const chapters = chapterRows.map((row) => {
    const file = path.join(contentDir, row.file);
    const markdown = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const status = (markdown.match(/^状态：\s*(.+)$/m)?.[1] || '').replace(/`/g, '').trim();
    return { ...row, markdown, bodyHtml: mdToHtml(markdown, chapterFig), status };
  });

  const overviews = (overviewRows || []).map((row) => {
    const file = path.join(contentDir, row.file);
    const markdown = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    return { ...row, markdown, bodyHtml: mdToHtml(markdown, chapterFig) };
  });

  // 按朝归集主张总量：朝次来自 manifest.reign（经 loadDynasty 写入 _reign），不是 ID 前缀
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
    verifiedClaims: claims.filter((row) => row['复核人']).length,
    portraits: portraits.length,
    lanes: lanes.length,
    empressEvents: empressTimeline.length,
    princes: princes.length,
    princesses: princesses.length,
    heirEvents: heirChain.length,
    sites: historicSites.length,
    questions: questions.length,
    chapters: chapters.length,
    tasksDone: tasks.filter((row) => row['状态'] === '已完成').length,
    tasksTotal: tasks.length,
  };

  const suggest = [];
  const seenPeople = new Set();
  for (const emperor of emperorRecords) {
    seenPeople.add(emperor.person_id);
    suggest.push({
      id: emperor.person_id,
      label: emperor['年号或通称'].split('；')[0],
      extra: emperor['规范名'],
      hay: [emperor.person_id, emperor.emperor_id, emperor['规范名'], emperor['年号或通称'], emperor['庙号'], emperor['父亲'], emperor['母亲'], py([emperor['规范名'], emperor['年号或通称'], emperor['庙号']].join(''))].join(' '),
    });
  }
  for (const person of people) {
    if (seenPeople.has(person.person_id)) continue;
    suggest.push({
      id: person.person_id,
      label: person['规范名'].replace(/^爱新觉罗·/, ''),
      extra: person['常用名或异名'],
      hay: [person.person_id, person['规范名'], person['常用名或异名'], person['人物类型'], py([person['规范名'], person['常用名或异名']].join(''))].join(' '),
    });
  }

  const searchEntries = [
    ...suggest.map((row) => searchEntry('person', row.id, row.hay, { label: row.label, extra: row.extra })),
    ...claims.map((row) => searchEntry('claim', row['Assertion ID'], Object.values(row).join(' '))),
    ...sources.map((row) => searchEntry('source', row.source_id, Object.values(row).join(' '))),
    ...lanes.map((row) => searchEntry('lane', row.lane_id, Object.values(row).join(' '))),
    ...empressTimeline.map((row) => searchEntry('empress', row.event_id, [Object.values(row).join(' '), py(row['当时称号'])].join(' '))),
    ...princes.map((row) => searchEntry('prince', row.person_id, [Object.values(row).join(' '), py(row['规范名'])].join(' '), {
      label: row['规范名'].replace(/^爱新觉罗·/, ''),
      extra: row['表序标签'],
    })),
    ...princesses.map((row) => searchEntry('princess', row.person_id, [Object.values(row).join(' '), py(row['规范名'])].join(' '), {
      label: row['规范名'].replace(/^爱新觉罗氏/, ''),
      extra: row['表序标签'],
    })),
    ...heirChain.map((row) => searchEntry('heir', row.event_id, Object.values(row).join(' '))),
    ...works.map((row) => searchEntry('work', row.work_id, [row['文献名称'], row['文献类型'], row['内容概述'], row['成书年代']].join(' '), {
      label: row['文献名称'],
      extra: row['文献类型'],
    })),
    ...historicSites.map((row) => searchEntry('site', row.site_id, Object.values(row).join(' '))),
    ...questions.map((row) => searchEntry('question', row.question_id, Object.values(row).join(' '), {
      label: row['问题'],
      extra: row['类别'],
    })),
    ...chapters.map((row) => searchEntry('chapter', row.slug, [row.title, row.lede, row.era, row.markdown].join(' '), {
      label: row.title,
      extra: row.era,
    })),
  ];

  const slim = slimDynasty(dynasty);
  const written = [
    writeJson(`d-${dynasty.code}.json`, {
      units, claims, lanes, empressTimeline, princes, princesses, heirChain, chapters, questions, works,
      conflictSets: conflictSets || [],
      chronicle: chronicle || [],
      overviews,
      emperorTimeline: emperorTimeline || [],
      predicates: Object.fromEntries(
        (vocab || [])
          .filter((row) => row.scheme_code === 'assertion_predicate')
          .map((row) => [row.term_code, row['中文标签']]),
      ),
    }),
    writeJson('home.json', {
      // 构建产物必须可重复；发布时间由部署平台提供，不写入每次变化的当前时间。
      notice: '引文可回原文。家谱尚未用玉牒核对。',
      dynasty: slim,
      emperors: emperorRecords,
      sites: historicSites,
      coverage,
      credibility: {
        totalClaims: claims.length,
        byStatus: countBy(claims, '状态'),
        byStrength: countBy(claims, '证据强度'),
        byDirectness: countBy(claims, '证据直接性'),
        emperorsWithClaims: emperorRecords.filter((e) => (e.credibility?.claims || 0) > 0).length,
      },
      suggest,
    }),
    writeJson('people.json', { people, portraits, crosswalk, regions: imageRegions, iiif: iiifManifests }),
    writeJson('catalog.json', { sources, sourceIndex, tasks }),
  ];

  // 首页直出：kicker/h1/lede 取自 dynasty 对象
  const indexPath = path.join(siteDir, 'index.html');
  let indexHtml = fs.readFileSync(indexPath, 'utf8');
  const homeRe = /<main id="main"[^>]*>[\s\S]*?<\/main>/;
  if (homeRe.test(indexHtml)) {
    const home = homeHtml(slim, emperorRecords, historicSites, { onerror: false });
    indexHtml = indexHtml.replace(homeRe, `<main id="main" tabindex="-1" data-ssr="home">\n${home}\n  </main>`);
  } else {
    console.warn('WARN: index.html 未找到 <main id="main">，跳过直出。');
  }
  // 注入朝代配置：app.js 启动时同步读取 #dynasty-config，决定数据块与专题路由
  const dynastyConfig = {
    code: dynasty.code,
    label: dynasty.label,
    chunk: `d-${dynasty.code}`,
    eras: slim.eras,
  };
  const configTag = `  <script type="application/json" id="dynasty-config">${JSON.stringify(dynastyConfig)}</script>\n`;
  const configRe = /[ \t]*<script type="application\/json" id="dynasty-config">[\s\S]*?<\/script>\n?/;
  indexHtml = configRe.test(indexHtml)
    ? indexHtml.replace(configRe, configTag)
    : indexHtml.replace('</head>', `${configTag}</head>`);
  const homePortrait = portraits.find((row) => row.emperor_id === 'QH-E-04' && row['展示角色'] === '默认朝服像')
    || portraits.find((row) => row['展示角色'] === '默认朝服像');
  const homeImage = homePortrait?.['预览文件'] ? new URL(homePortrait['预览文件'], siteBaseUrl).href : '';
  const homeStructured = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'WebSite', name: '清史读本',
    url: siteBaseUrl.href, inLanguage: 'zh-Hans', description: dynasty.lede,
  }).replace(/</g, '\\u003c');
  const discoveryMeta = `  <!-- generated-site-meta:start -->
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${escHtml(siteBaseUrl.href)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="清史读本">
  <meta property="og:title" content="清史读本">
  <meta property="og:description" content="${escHtml(dynasty.lede)}">
  <meta property="og:url" content="${escHtml(siteBaseUrl.href)}">
  ${homeImage ? `<meta property="og:image" content="${escHtml(homeImage)}">` : ''}
  <meta name="twitter:card" content="${homeImage ? 'summary_large_image' : 'summary'}">
  <script type="application/ld+json">${homeStructured}</script>
  <!-- generated-site-meta:end -->`;
  const discoveryMetaRe = /  <!-- generated-site-meta:start -->[\s\S]*?  <!-- generated-site-meta:end -->/;
  indexHtml = discoveryMetaRe.test(indexHtml)
    ? indexHtml.replace(discoveryMetaRe, discoveryMeta)
    : indexHtml.replace('</head>', `${discoveryMeta}\n</head>`);
  fs.writeFileSync(indexPath, indexHtml);

  const staticPages = writeStaticChapterPages({ chapters, units, portraits, emperors: emperorRecords });
  return { dynasty: dynasty.code, written, searchEntries, emperorCount: emperorRecords.length, siteCount: historicSites.length, staticPages };
}

function build() {
  fs.mkdirSync(dataOutDir, { recursive: true });

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

  const searchWritten = writeJson('search.json', buildIndex(allSearchEntries));
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
  if (home) console.log(`Home emperors ${home.emperorCount}, sites ${home.siteCount}, search entries ${allSearchEntries.length}; static chapters ${home.staticPages.total}, indexable ${home.staticPages.indexable}`);
}

build();

if (process.argv.includes('--watch')) {
  let timer = null;
  const kick = (event, filename) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`rebuild after ${event} ${filename || ''}`);
      try {
        build();
      } catch (err) {
        console.error(err);
      }
    }, 200);
  };
  fs.watch(dataDir, { recursive: true }, kick);
  fs.watch(contentDir, { recursive: true }, kick);
  fs.watch(path.join(siteDir, 'templates.js'), kick);
  console.log('watching data/, content/, site/templates.js');
}
