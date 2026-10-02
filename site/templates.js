const moduleVersion = new URL(import.meta.url).search;
const { EMPEROR_CARD, PORTRAIT_FRAMING, HOME_PORTRAIT_BOUNDS, COURT_PORTRAIT_NOTE } = await import('./qing-content.js' + moduleVersion);
const { MEDIA_FILES, MEDIA_ASPECT, MEDIA_STEM_VER } = await import('./media-manifest.js' + moduleVersion);
const { COAST, RIVER, PROVINCE, VIEW } = await import('./basemap.js' + moduleVersion);

const { isChapterIndexable, isChapterEvidenceClosed, evidenceLabel, EVIDENCE_HINT } = await import('./reading.js' + moduleVersion);
export { isChapterIndexable, isChapterEvidenceClosed };
const { mediaPath, LOCAL_VARIANTS } = await import('./media-paths.js' + moduleVersion);
const { readingPick, selectReadingPicks, FEATURED_COUNT } = await import('./reader-picks.js' + moduleVersion);
export { readingPick, selectReadingPicks, FEATURED_COUNT };

const WIDTHS = [320, 500, 800, 1280];

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

const ORPHAN_CITE_P = String.raw`<p>\s*((?:<(?:a|button)\b[^>]*\bclaim-ref\b[^>]*>[\s\S]*?<\/(?:a|button)>\s*)+)<\/p>`;

/**
 * 把单独成段的依据角标贴回上一句原文，避免引文下空出一行「1」。
 */
export function attachOrphanCites(html) {
  const quoteRe = new RegExp(String.raw`(<\/p>)\s*(<\/blockquote>)\s*${ORPHAN_CITE_P}`);
  const afterQuoteRe = new RegExp(String.raw`(<\/blockquote>)\s*${ORPHAN_CITE_P}`);
  const asideRe = new RegExp(String.raw`(<\/blockquote>)\s*(<aside\b[\s\S]*?<\/aside>)\s*${ORPHAN_CITE_P}`);
  const paraRe = new RegExp(String.raw`(<\/p>)\s*${ORPHAN_CITE_P}`);
  let out = String(html || '');
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(quoteRe, (_, pClose, bqClose, cites) => ` ${cites}${pClose}${bqClose}`);
  }
  prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(asideRe, (_, bqClose, aside, cites) => ` ${cites}${bqClose}${aside}`);
  }
  prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(afterQuoteRe, (_, bqClose, cites) => ` ${cites}${bqClose}`);
  }
  prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(paraRe, (_, pClose, cites) => ` ${cites}${pClose}`);
  }
  // 已经被上一轮构建放在 </p> 后的角标，也移入最后一个段落。
  return out.replace(/<\/p>\s*((?:<(?:a|button)\b[^>]*\bclaim-ref\b[^>]*>[\s\S]*?<\/(?:a|button)>\s*)+)<\/blockquote>/g,
    (_, cites) => ` ${cites}</p></blockquote>`);
}

/** 句末两字加标点不拆行，避免「理。」这类孤字。 */
export function noOrphan(text) {
  const s = String(text ?? '');
  const m = s.match(/^(.*?)([\u4e00-\u9fff]{2}[。．！？]?)$/);
  if (!m || !m[1]) return esc(s);
  return `${esc(m[1])}<span class="nobr">${esc(m[2])}</span>`;
}

export function canEmbed(portrait) {
  return Boolean(portrait && portrait['权利颜色'] === '绿' && portrait['可公开展示'] === '是' && portrait['预览文件']);
}

export function canEmbedSite(site) {
  return Boolean(site && site['权利颜色'] === '绿' && site['预览文件']);
}

// 画廊取景档位。卡片是 4:3 横框，而库里多数原画是竖幅：
//   竖幅人物（朝服像、行乐图、扮装像）居中裁切只留下胸腹和袍摆，把脸切在框外；
//   长卷横披（南巡图局部、朱批长摺）裁进 4:3 只剩百分之几的一小段，还得放大约十倍。
// 两个阈值按全库 421 张主图的宽高比分布取：< 1.1 收 327 张（竖幅），> 2.2 收 6 张（长卷）。
// 具体样式在 styles.css 的 .visual-pic；比例数据由构建期 scripts/build-media-manifest.mjs 生成。
export const PIC_TALL_MAX = 1.1;
export const PIC_WIDE_MIN = 2.2;
export function picFitClass(file) {
  const aspect = MEDIA_ASPECT[String(file || '').trim()];
  if (!aspect) return '';
  if (aspect < PIC_TALL_MAX) return 'pic-tall';
  if (aspect > PIC_WIDE_MIN) return 'pic-wide';
  return '';
}

// 没有可嵌入的图时，别只丢一个空灰框——读者会当成图片挂了。
// 说清这是什么材料、为什么没有图。文件页外链在图像详情页里，这里不嵌套第二层链接。
export function restrictedFallback(portrait) {
  const kind = String(portrait?.['图像性质'] || '').trim() || '图像';
  return `<div class="img-fallback img-restricted">
          <span class="fallback-kind">${esc(kind)}</span>
          <span class="fallback-note">权利受限 · 未嵌入</span>
        </div>`;
}

export function yearSpan(emperor) {
  const born = Number(emperor['生年']);
  const died = Number(emperor['卒年']);
  const from = Number(emperor['在位起']);
  const to = Number(emperor['在位止']);
  const age = (born && died) ? died - born + 1 : 0;
  // 在位年数取数据列（传统年号纪年计数），不靠在位起止推算——
  // 起止记录即位/离位公历年，与「在位 X 年」的传统口径并非一致换算。
  const reign = Number(emperor['在位年数']) || 0;
  return { born, died, from, to, age, reign };
}

export function mediaSrcset(url) {
  const src = String(url || '').trim();
  if (!src) return { src: '', srcset: '' };
  const thumb = src.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+?)\/(\d+)px-(.+)$/);
  if (thumb) {
    const [, base, , file] = thumb;
    return {
      src,
      srcset: WIDTHS.map((width) => `${base}/${width}px-${file} ${width}w`).join(', '),
    };
  }
  const original = src.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/i);
  if (original) {
    const [, host, a, ab, file] = original;
    const base = `${host}/thumb/${a}/${ab}/${file}`;
    return {
      src: `${base}/960px-${file}`,
      srcset: WIDTHS.map((width) => `${base}/${width}px-${file} ${width}w`).join(', '),
    };
  }
  const local = mediaPath(src);
  if (local) {
    const { stem, ext } = local;
    // 图片文件名不变、内容会换（帝容换源、重切档），所以拼内容指纹做缓存失效。
    // 指纹来自构建期生成的 MEDIA_STEM_VER，Node 侧与浏览器侧拿到的是同一份清单。
    const ver = MEDIA_STEM_VER[stem] ? `?v=${MEDIA_STEM_VER[stem]}` : '';
    return {
      src: `${stem}${ext}${ver}`,
      srcset: LOCAL_VARIANTS
        .map(([suffix, width]) => [`${stem}${suffix}${ext}`, width])
        .filter(([file]) => MEDIA_FILES.has(file))
        .map(([file, width]) => `${file}${ver} ${width}w`).join(', '),
    };
  }
  return { src, srcset: '' };
}

// 灯箱用：取 Wikimedia 缩略图的最大档位；本地缓存图原样返回
export function largestVariant(url) {
  const { src, srcset } = mediaSrcset(url);
  if (!srcset) return src;
  const candidates = srcset.split(',').map((part) => part.trim().split(/\s+/));
  const best = candidates.sort((a, b) => parseInt(b[1], 10) - parseInt(a[1], 10))[0];
  return best ? best[0] : src;
}

export function imgTag(url, alt, opts = {}) {
  const { src, srcset } = mediaSrcset(url);
  if (!src) return '<div class="img-fallback">无预览图</div>';
  const width = opts.width || 600;
  const height = opts.height || 800;
  const sizes = opts.sizes || '(max-width: 600px) 45vw, (max-width: 960px) 30vw, 280px';
  const loading = opts.eager ? 'eager' : 'lazy';
  const priority = opts.eager ? ' fetchpriority="high"' : '';
  const srcsetAttr = srcset ? ` srcset="${esc(srcset)}"` : '';
  const lightboxAttr = opts.lightbox ? ` data-lightbox="${esc(opts.lightbox)}"` : '';
  const referrer = /^https:\/\//.test(src) ? ' referrerpolicy="no-referrer"' : '';
  const onerror = opts.onerror
    ? ` onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'img-fallback',textContent:'图像暂时无法加载'}))"`
    : '';
  return `<img src="${esc(src)}"${srcsetAttr} sizes="${esc(sizes)}" alt="${esc(alt)}" width="${width}" height="${height}" loading="${loading}" decoding="async"${priority}${referrer}${onerror}${lightboxAttr}>`;
}

const EVIDENCE_CLASS = { 'S': 'medium', 'C': 'conflict', 'U': 'medium' };

export function noEvidenceBanner(headline, explanation) {
  const ex = explanation ? `\n  <p>${esc(explanation)}</p>` : '';
  return `<aside class="x-banner"><p class="x-banner-head">${esc(headline)}</p>${ex}</aside>`;
}

export function emperorCard(emperor, opts = {}) {
  const portrait = emperor.portrait;
  const eras = String(emperor['年号或通称'] || '').split('；').map((s) => s.trim()).filter(Boolean);
  const era = eras[0] || '';
  const alt = portrait?.['对象标题'] || `${era}朝服像`;
  const { born, died } = yearSpan(emperor);
  const given = String(emperor['规范名'] || '').replace(/^爱新觉罗·/, '');
  const fullName = String(emperor['规范名'] || '');
  const temple = String(emperor['庙号'] || '').trim();
  const posthumous = String(emperor['谥号'] || '').trim();
  const birthOrder = String(emperor['皇子序'] || '').trim();
  const { from, to, reign } = yearSpan(emperor);
  const frame = PORTRAIT_FRAMING[emperor.emperor_id];
  const bounds = opts.compact ? HOME_PORTRAIT_BOUNDS[emperor.emperor_id] : null;
  const height = bounds ? 84 / (bounds.feet - bounds.head) : 100;
  const top = bounds ? 8 - bounds.head * height : 0;
  const frameStyle = bounds
    ? ` style="--portrait-height:${height.toFixed(3)}%;--portrait-top:${top.toFixed(3)}%"`
    : frame ? ` style="--pic-z:${frame.z};--pic-y:${frame.y}%"` : '';
  // 溥仪没有庙号，也没有朝廷追上的谥号。留白会被读成漏填，写明原因。
  const idRow = (label, value, attrs = '') => (
    `<div class="card-id-row"><dt>${esc(label)}</dt><dd${attrs}>${value}</dd></div>`
  );
  const eraHref = emperor.eraSlug ? `#/${emperor.eraSlug}` : `#/person/${emperor.person_id}`;
  const hook = EMPEROR_CARD[emperor.person_id]?.hook || '';
  const img = canEmbed(portrait)
    ? imgTag(portrait['预览文件'], alt, {
      width: 600,
      height: 800,
      sizes: '(max-width: 600px) 92vw, (max-width: 960px) 45vw, 430px',
      onerror: opts.onerror !== false,
      eager: opts.eager,
    })
    : '';
  return `
      <article class="card emperor-card">
        <header class="emperor-card-heading">
          <a class="era-link" href="${esc(eraHref)}"><span class="card-era-label">${esc(eras.join(' · '))}</span><h2>${esc(given)}</h2></a>
          <p class="sub">在位 ${esc(from)}—${esc(to)}</p>
        </header>
        ${opts.compact ? '<details class="emperor-vita-fold"><summary>名号与生平</summary>' : ''}
        <dl class="card-vita-line card-ids card-vita">
          ${idRow('名', esc(fullName || given) + (birthOrder ? `<span class="card-id-sub">（${esc(birthOrder)}）</span>` : ''))}
          ${idRow('庙号', temple ? esc(temple) : '<span class="card-id-none">无，清亡未上</span>')}
          ${idRow('谥号', posthumous
            ? `<span class="card-id-shi">${esc(posthumous)}</span>`
            : '<span class="card-id-none">无，清亡未上</span>')}
          ${born && died ? idRow('在世', `${born} 年–${died} 年`) : ''}
          ${from && to ? idRow('在位', `${from} 年–${to} 年${reign ? ` · 共 ${reign} 年` : ''}`) : ''}
        </dl>
        ${opts.compact ? '</details>' : ''}
        <a class="card-pic"${frameStyle} href="${esc(eraHref)}" aria-label="${esc(alt)}">
          ${opts.compact ? `<span class="portrait-window">${img}</span>` : img}
          ${era ? `<span class="pic-seal" aria-hidden="true">${esc(era)}</span>` : ''}
        </a>
        <div class="meta">
          ${hook ? `<p class="card-hook-line">${esc(hook)}</p>` : ''}
        </div>
      </article>`;
}

const EMPEROR_SHORT_ERA = {
  'QH-E-01': '天命',
  'QH-E-02': '崇德',
  'QH-E-03': '顺治',
  'QH-E-04': '康熙',
  'QH-E-05': '雍正',
  'QH-E-06': '乾隆',
  'QH-E-07': '嘉庆',
  'QH-E-08': '道光',
  'QH-E-09': '咸丰',
  'QH-E-10': '同治',
  'QH-E-11': '光绪',
  'QH-E-12': '宣统',
};

export function siteEraLabel(site) {
  const ids = String(site['相关皇帝ID'] || '').split(/[；;]/).map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return '遗址今况';
  if (ids.length === 1) return (EMPEROR_SHORT_ERA[ids[0]] || '') + '朝';
  if (ids.length <= 3) return ids.map((id) => EMPEROR_SHORT_ERA[id] || id).join('·') + '朝';
  return '中枢·跨朝';
}

export function siteCard(site, opts = {}) {
  const hook = site['卡片钩子'] || '';
  const today = String(site['今日'] || '');
  const alt = site['对象标题'] || site['事件'] || '遗址今况';
  const img = canEmbedSite(site)
    ? imgTag(site['预览文件'], alt, {
      width: 960,
      height: 540,
      sizes: '(max-width: 600px) 100vw, (max-width: 960px) 45vw, 420px',
      onerror: opts.onerror !== false,
      lightbox: alt,
    })
    : '<div class="img-fallback">图像权利受限，不嵌入</div>';
  const rawStatus = site['证据状态'] || '';
  const publicStatus = site['公开证据状态'] || evidenceLabel(rawStatus);
  const evCls = rawStatus ? (EVIDENCE_CLASS[rawStatus[0]] || 'site') : (publicStatus === '存在异说' ? 'conflict' : 'medium');
  const badgeHint = EVIDENCE_HINT[publicStatus] || '';
  const siteBadge = publicStatus
    ? `<span class="cred-badge cred-${evCls}"${badgeHint ? ` title="${esc(badgeHint)}"` : ''}>${esc(publicStatus)}</span>`
    : '';
  return `
      <article class="card emperor-card site-card">
        <a class="card-pic" href="#/site/${esc(site.site_id)}" aria-label="${esc(site['事件'])}">
          ${img}
        </a>
        <a class="meta" href="#/site/${esc(site.site_id)}">
          <div class="card-kind">${esc(siteEraLabel(site))}</div>
          <div class="era">${esc(site['事件'])}</div>
          <div class="sub">${esc(today)}</div>
          ${hook ? `<p class="card-hook">${esc(hook)}</p>` : ''}
          ${siteBadge}
        </a>
      </article>`;
}

export function visualGalleryCard(portrait, opts = {}) {
  const alt = portrait?.['对象标题'] || '图像';
  const tag = portrait?.['图像性质'] || portrait?.['展示角色'] || '图像';
  const hook = portrait?.['卡片钩子'] || portrait?.['画面解析'] || '';
  const date = portrait?.['制作年代或摄影日期'] || '';
  const author = portrait?.['作者或摄影者'] || '';
  const metaSub = [date, author].filter(Boolean).join(' · ');
  const img = canEmbed(portrait)
    ? imgTag(portrait['预览文件'], alt, {
      width: 480,
      height: 640,
      sizes: '(max-width: 600px) 90vw, (max-width: 960px) 45vw, 300px',
      onerror: opts.onerror !== false,
      lightbox: alt,
    })
    : restrictedFallback(portrait);
  const fit = canEmbed(portrait) ? picFitClass(portrait['预览文件']) : '';

  return `
      <article class="card visual-card">
        <a class="card-pic visual-pic${fit ? ' ' + fit : ''}" href="#/image/${esc(portrait?.visual_id || '')}" aria-label="${esc(alt)}">
          ${img}
        </a>
        <div class="meta visual-meta">
          <div class="visual-tag-row">
            <span class="visual-tag">${esc(tag)}</span>
            ${metaSub ? `<span class="visual-date muted">${esc(metaSub)}</span>` : ''}
          </div>
          <h3 class="visual-title"><span class="visual-title-text">${esc(alt)}</span></h3>
          ${hook ? `<p class="visual-hook">${esc(hook)}</p>` : ''}
        </div>
      </article>`;
}

export function featuredSites(sites) {
  return [...(sites || [])]
    .filter((row) => row['首页'])
    .sort((a, b) => Number(a['首页']) - Number(b['首页']));
}

export function sortedSites(sites) {
  return [...(sites || [])].sort((a, b) => Number(a['排序'] || 0) - Number(b['排序'] || 0));
}

export function formatGBT7714(claim, unit) {
  if (!claim) return '';
  const book = unit?.['史料名'] || '';
  const juan = unit?.['卷次'] || '';
  const date = unit?.['原纪年'] || claim['原始时间表达'] || '';
  const rawSeq = String(unit?.['当日条次'] || '');
  const seq = /^\d+$/.test(rawSeq) ? `第${rawSeq}条` : rawSeq;
  const loc = claim['卷页/档号/图像定位'] || '';
  const id = claim['Assertion ID'] || '';

  if (book) {
    const parts = [`《${book}》`];
    if (juan) parts.push(juan);
    const main = parts.join('');
    const details = [date, seq, loc].filter(Boolean).join('，');
    return `${main}[M]. ${details ? `${details}. ` : ''}清史读本, 主张编号: ${id}.`;
  }

  const pred = claim['谓词/关系'] || '';
  const subj = claim['主体 ID'] || '';
  const obj = claim['客体 ID 或值'] || '';
  return `清史读本. 主张 ${id}: ${subj} ${pred} ${obj}[EB/OL]. https://zonglinxie-cyber.github.io/qing-history-evidence-base/#/claim/${id}.`;
}

// 帝像「供奉御容」读法模块。朝服像一人一幅，是读者最先看到的一类帝像，
// 也是「画像能看出他什么样」这个误解最容易发生的地方。文字在 qing-content.js。
export function courtPortraitNote() {
  return `
    <section class="portrait-reading-note" aria-labelledby="court-portrait-note-title">
      <p class="kicker">${esc(COURT_PORTRAIT_NOTE.kicker)}</p>
      <h2 id="court-portrait-note-title">${esc(COURT_PORTRAIT_NOTE.title)}</h2>
      <p class="lede">${esc(COURT_PORTRAIT_NOTE.lede)}</p>
      <dl class="reading-points">
        ${COURT_PORTRAIT_NOTE.points.map((point) => `<div><dt>${esc(point.label)}</dt><dd>${esc(point.text)}</dd></div>`).join('')}
      </dl>
      <p class="muted">${esc(COURT_PORTRAIT_NOTE.footer)}</p>
    </section>`;
}

// ==== 遗址地图 ====
//
// 2026-09-11 改：修投影 + 补底图。
//   病根一：原投影把经度直接铺满 800px、纬度铺满 380px，横向拉伸 3.0–4.5 倍
//     （23°N 处 2.97×，42°N 处 3.68×）。撒点看不出问题，一旦叠上真实海岸线就是错的形状。
//   病根二：底图只有一个纯色矩形，48 处史迹漂在空白里，读者辨不出地理语境。
//   修法：改用 Albers 等积圆锥（标准纬线 25°N／47°N，中央经线 117°E，中国全图常用参数），
//     视野按史迹实际分布取 104–133°E、19.5–55.5°N（真实长宽比 0.755，所以画框是竖的），
//     底图取 Natural Earth 1:50m 的海岸线、省界与主要河流。
//
//   底图是**现代**地理参照，不是清代疆域——省界尤其如此，界线上不写朝代。
// 视野取自 VIEW（由 scripts/build-basemap.mjs 写进底图），不在这里另抄一份数字：
// 底图裁线的范围与画框范围一旦分叉，贴边的海岸线会缺一段而没人发现。
const MAP = {
  ...VIEW,
  lon0: 117,
  phi1: (25 * Math.PI) / 180,
  phi2: (47 * Math.PI) / 180,
  W: 640, H: 848, pad: 26,
};
MAP.n = (Math.sin(MAP.phi1) + Math.sin(MAP.phi2)) / 2;
MAP.C = Math.cos(MAP.phi1) ** 2 + 2 * MAP.n * Math.sin(MAP.phi1);

function albersRaw(lng, lat) {
  const theta = (MAP.n * (lng - MAP.lon0) * Math.PI) / 180;
  const rho = Math.sqrt(MAP.C - 2 * MAP.n * Math.sin((lat * Math.PI) / 180)) / MAP.n;
  // 圆锥投影的 y 轴指向南极，SVG 的 y 轴指向下，两者同向，所以这里取 +cos，
  // 纬度越高 y 越小、画得越靠上。写成 -cos 会把整张图上下倒过来。
  return [rho * Math.sin(theta), rho * Math.cos(theta)];
}

// 视野四边采样求投影后的包围盒，再等比缩放进画框。视野固定，结果只算一次。
const MAP_FIT = (() => {
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  const edge = (lng, lat) => {
    const [x, y] = albersRaw(lng, lat);
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  };
  for (let i = 0; i <= 120; i += 1) {
    const t = i / 120;
    const lng = MAP.minLon + (MAP.maxLon - MAP.minLon) * t;
    const lat = MAP.minLat + (MAP.maxLat - MAP.minLat) * t;
    edge(lng, MAP.minLat); edge(lng, MAP.maxLat);
    edge(MAP.minLon, lat); edge(MAP.maxLon, lat);
  }
  const scale = Math.min((MAP.W - 2 * MAP.pad) / (x1 - x0), (MAP.H - 2 * MAP.pad) / (y1 - y0));
  return { x0, y0, scale, x1, y1 };
})();

function mapProject(lng, lat) {
  const [x, y] = albersRaw(lng, lat);
  const { x0, y0, scale, x1, y1 } = MAP_FIT;
  const px = (x - x0) * scale + (MAP.W - (x1 - x0) * scale) / 2;
  const py = (y - y0) * scale + (MAP.H - (y1 - y0) * scale) / 2;
  return [Math.round(px * 10) / 10, Math.round(py * 10) / 10];
}

// 底图折线：图省体积，点在构建期已抽稀，这里只做投影。
function mapPolylines(layers) {
  return layers.map((line) => {
    const pts = line.map(([lng, lat]) => mapProject(lng, lat));
    if (pts.length < 2) return '';
    return `M${pts.map(([x, y]) => `${x} ${y}`).join('L')}`;
  }).join('');
}

// 经纬网在 Albers 下是弧线，不是直线，按 0.5° 采样画。
function graticule() {
  const lines = [];
  const labels = [];
  for (const lat of [20, 30, 40, 50]) {
    const pts = [];
    for (let lng = MAP.minLon; lng <= MAP.maxLon; lng += 0.5) pts.push(mapProject(lng, lat));
    lines.push(`<path d="M${pts.map(([x, y]) => `${x} ${y}`).join('L')}" />`);
    const [lx, ly] = mapProject(MAP.minLon + 0.6, lat);
    labels.push(`<text x="${lx + 2}" y="${ly - 3}">${lat}°N</text>`);
  }
  for (const lng of [110, 120, 130]) {
    const pts = [];
    for (let lat = MAP.minLat; lat <= MAP.maxLat; lat += 0.5) pts.push(mapProject(lng, lat));
    lines.push(`<path d="M${pts.map(([x, y]) => `${x} ${y}`).join('L')}" />`);
    const [lx, ly] = mapProject(lng, MAP.minLat + 0.8);
    labels.push(`<text x="${lx + 3}" y="${ly}">${lng}°E</text>`);
  }
  return `<g class="map-grid">${lines.join('')}${labels.join('')}</g>`;
}

const MAP_REGIONS = [
  ['黑龙江·雅克萨', 126.5, 52.6],
  ['塞北·木兰围场与多伦', 112.6, 44.6],
  ['关外·盛京发祥', 127.0, 41.6],
  ['中枢·京畿与承德', 110.4, 38.2],
  ['江南·南巡与江防', 114.6, 28.6],
  ['岭南·海防与开埠', 107.9, 25.1],
];

export function sitesMapSvg(sites) {
  const validSites = (sites || []).filter((s) => {
    const lng = Number(s['经度']);
    const lat = Number(s['纬度']);
    return !Number.isNaN(lng) && !Number.isNaN(lat)
      && lng >= MAP.minLon && lng <= MAP.maxLon && lat >= MAP.minLat && lat <= MAP.maxLat;
  });

  const pins = validSites.map((site) => {
    const lng = Number(site['经度']);
    const lat = Number(site['纬度']);
    const [x, y] = mapProject(lng, lat);
    const label = site['事件'] || '';
    const today = (site['今日'] || '').split('。')[0];
    const id = site.site_id || '';
    return `<g class="map-pin" data-pin-id="${esc(id)}" tabindex="0" role="button" aria-label="${esc(label)}">
      <circle class="pin-pulse" cx="${x}" cy="${y}" r="8" />
      <circle class="pin-dot" cx="${x}" cy="${y}" r="4" />
      <text class="pin-title" x="${x}" y="${y - 8}" text-anchor="middle">${esc(label)}</text>
      <title>${esc(label)} · ${esc(today)} (${lng.toFixed(2)}°E, ${lat.toFixed(2)}°N)</title>
    </g>`;
  }).join('');

  return `
    <div class="sites-map-wrap">
      <div class="sites-map-header">
        <span class="map-tag">历史地景分布（${validSites.length} 处）</span>
        <span class="map-hint">点击坐标点查看对应遗址今况</span>
      </div>
      <svg class="sites-map-svg" viewBox="0 0 ${MAP.W} ${MAP.H}" preserveAspectRatio="xMidYMid meet" aria-label="清史关键历史遗址地理分布图">
        <defs>
          <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="var(--accent, #9e2a2b)" stop-opacity="0.25" />
            <stop offset="100%" stop-color="var(--accent, #9e2a2b)" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect class="map-bg" width="${MAP.W}" height="${MAP.H}" rx="8" />
        ${graticule()}
        <g class="map-land">
          <path class="map-province" d="${mapPolylines(PROVINCE)}" />
          <path class="map-river" d="${mapPolylines(RIVER)}" />
          <path class="map-coast" d="${mapPolylines(COAST)}" />
        </g>
        <g class="map-regions">
          ${MAP_REGIONS.map(([label, lng, lat]) => {
    const [x, y] = mapProject(lng, lat);
    return `<text class="reg-label" x="${x}" y="${y}">${esc(label)}</text>`;
  }).join('')}
        </g>
        <g class="map-pins">
          ${pins}
        </g>
      </svg>
      <p class="map-legend">底图为<strong>现代</strong>地理参照（Natural Earth 1:50m，公有领域）：海岸线、省界、主要河流。
        省界是今天的省制，不是清代疆域，只帮读者把点位放回今天的中国地图。</p>
    </div>
  `;
}

/**
 * 御览长卷：十二帝在位纪年轴。
 * 每格宽窄即在位长短（flex-grow = 在位年数），两端紫檀轴头，
 * 下标公历刻度。窄格（如宣统三年）不题字，一线即是叙事。
 */
export function reignScroll(emperors) {
  const rows = (emperors || []).map((row) => {
    const { from, to, reign } = yearSpan(row);
    const era = String(row['年号或通称'] || '').split('；')[0].trim();
    const name = String(row['规范名'] || '').replace(/^爱新觉罗·/, '');
    const years = reign || (from && to ? to - from : 1);
    const href = row.eraSlug ? `#/${esc(row.eraSlug)}` : `#/person/${esc(row.person_id)}`;
    return { era, name, from, to, years, href };
  }).filter((row) => row.era && row.years > 0);
  if (!rows.length) return '';
  const span0 = rows[0].from;
  const span1 = rows[rows.length - 1].to;
  const span = span1 - span0;
  const segs = rows.map((row) => {
    const cls = row.years < 8 ? 'reign-seg seg-tiny' : row.years >= 25 ? 'reign-seg seg-wide' : 'reign-seg';
    return `<a class="${cls}" style="--yr:${row.years}" href="${row.href}" title="${esc(row.era)} · ${esc(row.name)} · ${row.from}–${row.to} · 在位 ${row.years} 年"><span class="reign-era">${esc(row.era)}</span><span class="reign-yr">${row.years}</span></a>`;
  }).join('');
  const century = Math.ceil(span0 / 100) * 100;
  const ticks = [span0, century, century + 100, century + 200, span1]
    .filter((v, i, arr) => v >= span0 && v <= span1 && arr.indexOf(v) === i)
    .map((v) => `<span style="left:${(((v - span0) / span) * 100).toFixed(2)}%">${v}</span>`).join('');
  return `
      <div class="reign-scroll-wrap">
        <p class="reign-scroll-cap"><span>御览长卷 · ${span0}—${span1}</span><span>格之宽窄，即在位长短</span></p>
        <div class="reign-scroll">
          <span class="scroll-knob left" aria-hidden="true"></span>
          <nav class="reign-track" aria-label="十二帝在位长卷">${segs}</nav>
          <span class="scroll-knob right" aria-hidden="true"></span>
        </div>
        <div class="reign-scale" aria-hidden="true">${ticks}</div>
      </div>`;
}

export function readingCards(picks) {
  return `<div class="reading-picks">${picks.map((pick, index) => `<article class="reading-pick">
    <a href="${esc(pick.href)}">
      <p class="pick-eyebrow"><span>${esc(pick.era)} · ${esc(pick.label)}</span><span aria-hidden="true">${String(index + 1).padStart(2, '0')}</span></p>
      <h3>${esc(pick.title)}</h3>
      <p class="pick-description">${esc(pick.description)}</p>
      ${(pick.material || pick.gain) ? `<dl class="pick-facts">
        ${pick.material ? `<div><dt>材料</dt><dd>${esc(pick.material)}</dd></div>` : ''}
        ${pick.gain ? `<div><dt>读完</dt><dd>${esc(pick.gain)}</dd></div>` : ''}
      </dl>` : ''}
      <span class="pick-action">${esc(pick.detail)} <span aria-hidden="true">↗</span></span>
    </a>
  </article>`).join('')}</div>`;
}

export function homeHtml(dynasty, emperors, sites, opts = {}) {
  return `      <div class="reading page-intro home-intro">
        <p class="kicker">${esc(dynasty?.kicker || '')}</p>
        <h1>${esc(dynasty?.headline || '')}</h1>
        <p class="lede">${noOrphan(dynasty?.lede || '')}</p>
        <p class="home-invitation"><a href="#/read">先挑一个具体的问题读进去</a> <span aria-hidden="true">·</span> 也可以沿十二帝一朝一朝读</p>
      </div>
${reignScroll(emperors)}
      <p class="home-more"><a class="link" href="#/jiedu">逐段读原典</a><span aria-hidden="true">·</span><a class="link" href="#/spine/money">看钱粮如何运转</a><span aria-hidden="true">·</span><a class="link" href="#/lanes">对读两种说法</a></p>
      <section class="home-emperors-block" aria-labelledby="home-emperors-title">
        <div class="reading-section-head"><div><p class="kicker">沿朝读</p><h2 id="home-emperors-title">十二帝</h2></div></div>
        <div class="grid cards home-emperors">${emperors.map((row) => emperorCard(row, { ...opts, eager: false, compact: true })).join('')}</div>
      </section>`;
}
