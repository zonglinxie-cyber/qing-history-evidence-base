import { EMPEROR_CARD, PORTRAIT_FRAMING } from './qing-content.mjs';

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

/** 句末两字加标点不拆行，避免「理。」这类孤字。 */
export function noOrphan(text) {
  const s = String(text ?? '');
  const m = s.match(/^(.*?)([\u4e00-\u9fff]{2}[。．！？]?)$/);
  if (!m || !m[1]) return esc(s);
  return `${esc(m[1])}<span class="nobr">${esc(m[2])}</span>`;
}

/**
 * 整章证据是否已闭环：绑定来源单元、达到 E1，且没有同时声明 S 级混合内容。
 * 只决定研究草稿横幅，不再决定 robots / sitemap。
 */
export function isChapterEvidenceClosed(status, unitCount) {
  const value = String(status ?? '').trim();
  const hasE1 = /(?:^|[/；])\s*E1\s*单源回查/.test(value);
  const hasSecondaryDraft = /(?:^|[/；])\s*S\s*二手/.test(value);
  return Number(unitCount) > 0 && hasE1 && !hasSecondaryDraft;
}

/**
 * 搜索引擎收录由 chapters.csv「收录」列单独决定，与证据等级解耦。
 */
export function isChapterIndexable(chapter) {
  return String(chapter?.['收录'] || '').trim() === '是';
}

export function canEmbed(portrait) {
  return Boolean(portrait && portrait['权利颜色'] === '绿' && portrait['可公开展示'] === '是' && portrait['预览文件']);
}

export function canEmbedSite(site) {
  return Boolean(site && site['权利颜色'] === '绿' && site['预览文件']);
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
  const local = src.match(/^(media\/[A-Za-z0-9-]+?)(?:-(?:480|960)|@2x)?(\.(?:jpe?g|png|webp))$/i);
  if (local) {
    const [, stem, ext] = local;
    return {
      src: `${stem}${ext}`,
      srcset: `${stem}-480${ext} 480w, ${stem}-960${ext} 960w, ${stem}@2x${ext} 1280w`,
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

export function emperorCardVita(emperor) {
  const given = emperor['规范名'] || '';
  const temple = emperor['庙号'] || '';
  const son = emperor['皇子序'] || '';
  const nick = emperor['外号'] || '';
  const { born, died, from, to, age, reign } = yearSpan(emperor);
  const lines = [];
  if (given) lines.push(`<p class="card-name">${esc(given)}</p>`);
  if (temple || son) lines.push(`<p>${esc([temple, son].filter(Boolean).join(' · '))}</p>`);
  if (born || died) lines.push(`<p>${esc(`${born}年–${died}年${age ? ` · ${age}岁` : ''}`)}</p>`);
  if (from || to) lines.push(`<p>${esc(`在位 ${reign}年 · ${from}–${to}`)}</p>`);
  if (nick) lines.push(`<p class="card-nick">${esc(nick)}</p>`);
  return `<div class="card-vita">${lines.join('')}</div>`;
}

const EVIDENCE_CLASS = { 'S': 'medium', 'C': 'conflict', 'U': 'medium' };
const EVIDENCE_LABEL = { S: '参考线索', E: '已列原文', C: '存在异说', U: '尚不确定' };

export function credibilityBadge(cred) {
  if (!cred || !cred.claims) {
    return '<span class="cred-badge cred-none">还没有逐日的官书条</span>';
  }
  return '';
}

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
  const frameStyle = frame ? ` style="--pic-z:${frame.z};--pic-y:${frame.y}%"` : '';
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
        <a class="card-pic"${frameStyle} href="${esc(eraHref)}" aria-label="${esc(alt)}">
          ${img}
        </a>
        <div class="meta">
          <a class="era-link" href="${esc(eraHref)}">
            <p class="card-era-label">年号</p>
            <div class="era">${esc(eras.join(' · '))}</div>
          </a>
          <dl class="card-vita-line card-ids">
            ${idRow('名', esc(fullName || given) + (birthOrder ? `<span class="card-id-sub">（${esc(birthOrder)}）</span>` : ''))}
            ${idRow('庙号', temple ? esc(temple) : '<span class="card-id-none">无，清亡未上</span>')}
            ${idRow('谥号', posthumous
              ? `<span class="card-id-shi">${esc(posthumous)}</span>`
              : '<span class="card-id-none">无，清亡未上</span>')}
            ${born && died ? idRow('在世', `${born}年–${died}年`) : ''}
            ${from && to ? idRow('在位', `${from}年–${to}年${reign ? ` · 共 ${reign} 年` : ''}`) : ''}
          </dl>
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
  if (!ids.length) return '今地';
  if (ids.length === 1) return (EMPEROR_SHORT_ERA[ids[0]] || '') + '朝';
  if (ids.length <= 3) return ids.map((id) => EMPEROR_SHORT_ERA[id] || id).join('·') + '朝';
  return '中枢·跨朝';
}

export function siteCard(site, opts = {}) {
  const hook = site['卡片钩子'] || '';
  const today = String(site['今日'] || '').split('。')[0];
  const alt = site['对象标题'] || site['事件'] || '今地';
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
  const publicStatus = site['公开证据状态'] || EVIDENCE_LABEL[rawStatus[0]] || '';
  const evCls = rawStatus ? (EVIDENCE_CLASS[rawStatus[0]] || 'site') : (publicStatus === '存在异说' ? 'conflict' : 'medium');
  const badgeHint = {
    '已列原文': '能回到实录或本纪的具体条目',
    '参考线索': '依据后出史书或通行叙述，尚未对到日级原文',
    '存在异说': '同一件事有两种以上写法，并列保存',
    '尚不确定': '现有材料还不足以判定',
  }[publicStatus] || '';
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

export function featuredSites(sites) {
  return [...(sites || [])]
    .filter((row) => row['首页'])
    .sort((a, b) => Number(a['首页']) - Number(b['首页']));
}

export function sortedSites(sites) {
  return [...(sites || [])].sort((a, b) => Number(a['排序'] || 0) - Number(b['排序'] || 0));
}

export function homeHtml(dynasty, emperors, sites, opts = {}) {
  // 首页只放十二帝画像。转轴、逐解、说法对照、遗址今况、真迹、文献
  // 一律走顶栏，不在这里堆二级入口。
  return `      <div class="reading">
        <p class="kicker">${esc(dynasty?.kicker || '')}</p>
        <h1>${esc(dynasty?.headline || '')}</h1>
        <p class="lede">${noOrphan(dynasty?.lede || '')}</p>
      </div>
      <p class="actions home-actions"><a class="link" href="#/path">276 年转轴</a> · <a class="link" href="#/material">材料</a> · <a class="link" href="#/how">怎么读</a></p>
      <div class="grid cards">${emperors.map((row, i) => emperorCard(row, { ...opts, eager: i < 3 })).join('')}</div>`;
}
