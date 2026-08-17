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
  const srcsetAttr = srcset ? ` srcset="${esc(srcset)}"` : '';
  const lightboxAttr = opts.lightbox ? ` data-lightbox="${esc(opts.lightbox)}"` : '';
  const referrer = /^https:\/\//.test(src) ? ' referrerpolicy="no-referrer"' : '';
  const onerror = opts.onerror
    ? ` onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'img-fallback',textContent:'图像暂时无法加载'}))"`
    : '';
  return `<img src="${esc(src)}"${srcsetAttr} sizes="${esc(sizes)}" alt="${esc(alt)}" width="${width}" height="${height}" loading="${loading}" decoding="async"${referrer}${onerror}${lightboxAttr}>`;
}

export function emperorCardVita(emperor) {
  const given = emperor['规范名'] || '';
  const temple = emperor['庙号'] || '';
  const son = emperor['皇子序'] || '';
  const nick = emperor['外号'] || '';
  const shi = emperor['谥号'] || '';
  const { born, died, from, to, age, reign } = yearSpan(emperor);
  const lines = [];
  if (given) lines.push(`<p class="card-name">${esc(given)}</p>`);
  if (temple || son) lines.push(`<p>${esc([temple, son].filter(Boolean).join(' · '))}</p>`);
  if (born || died) lines.push(`<p>${esc(`${born}年–${died}年${age ? ` · ${age}岁` : ''}`)}</p>`);
  if (from || to) lines.push(`<p>${esc(`在位 ${reign}年 · ${from}–${to}`)}</p>`);
  if (nick) lines.push(`<p class="card-nick">${esc(nick)}</p>`);
  const shihao = shi ? `<p class="card-shihao">谥号 ${esc(shi)}</p>` : '';
  return `<div class="card-vita">${lines.join('')}${shihao}</div>`;
}

const STRENGTH_CLASS = { '强': 'strong', '中': 'medium' };
const EVIDENCE_CLASS = { 'S': 'medium', 'C': 'conflict', 'U': 'medium' };

export function credibilityBadge(cred) {
  if (!cred || !cred.claims) {
    return '<span class="cred-badge cred-none">尚无结构化证据</span>';
  }
  const parts = Object.entries(cred.byStatus || {}).filter(([, v]) => v);
  const statusText = parts.length === 1
    ? esc(parts[0][0])
    : parts.map(([k, v]) => `${esc(k)} ${v}`).join(' · ');
  const strength = cred.topStrength ? ` · ${esc(cred.topStrength)}` : '';
  const cls = STRENGTH_CLASS[cred.topStrength] || 'none';
  return `<span class="cred-badge cred-${cls}">证据 ${cred.claims} · ${statusText}${strength}</span>`;
}

export function noEvidenceBanner(headline, explanation) {
  const ex = explanation ? `\n  <p>${esc(explanation)}</p>` : '';
  return `<aside class="x-banner"><p class="x-banner-head">${esc(headline)}</p>${ex}</aside>`;
}

export function emperorCard(emperor, opts = {}) {
  const portrait = emperor.portrait;
  const era = emperor['年号或通称'].split('；')[0];
  const alt = portrait?.['对象标题'] || `${era}朝服像`;
  const img = canEmbed(portrait)
    ? imgTag(portrait['预览文件'], alt, {
      width: 600,
      height: 800,
      sizes: '(max-width: 600px) 45vw, (max-width: 960px) 30vw, 280px',
      onerror: opts.onerror !== false,
    })
    : '';
  return `
      <article class="card emperor-card">
        <a class="card-pic" href="#/person/${esc(emperor.person_id)}" aria-label="${esc(alt)}">
          ${img}
        </a>
        <a class="meta" href="#/person/${esc(emperor.person_id)}">
          <div class="era">${esc(era)}</div>
          ${emperorCardVita(emperor)}
          ${credibilityBadge(emperor.credibility)}
        </a>
      </article>`;
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
    })
    : '<div class="img-fallback">图像权利受限，不嵌入</div>';
  const evStatus = site['证据状态'] || '';
  const evCls = evStatus ? (EVIDENCE_CLASS[evStatus[0]] || 'site') : '';
  const siteBadge = evStatus ? `<span class="cred-badge cred-${evCls}">${esc(evStatus.slice(1) || evStatus)}</span>` : '';
  return `
      <article class="card emperor-card site-card">
        <a class="card-pic" href="#/site/${esc(site.site_id)}" aria-label="${esc(site['事件'])}">
          ${img}
        </a>
        <a class="meta" href="#/site/${esc(site.site_id)}">
          <div class="card-kind">今地</div>
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
  const featured = featuredSites(sites);
  const rest = sortedSites(sites).length - featured.length;
  return `      <div class="reading">
        <p class="kicker">${esc(dynasty?.kicker || '')}</p>
        <h1>${esc(dynasty?.headline || '')}</h1>
        <p class="lede">${noOrphan(dynasty?.lede || '')}</p>
      </div>
      <div class="grid cards">${emperors.map((row) => emperorCard(row, opts)).join('')}</div>
      <section class="now-read">
        <div class="page-head story">
          <h2>先看这几处转轴</h2>
        </div>
        <p class="lede">称汗、称帝、入关、密储、内禅、条约、热河、退位。走完这一页，再点皇帝。</p>
        <p class="actions"><a class="link" href="#/path">276年转轴</a> · <a class="link" href="#/spine/power">谁坐龙椅，谁拍板</a> · <a class="link" href="#/overview/periods">全朝脉络</a></p>
      </section>
      <section class="now-read">
        <div class="page-head story">
          <h2>由浅入深读全朝</h2>
        </div>
        <p class="lede">先看脉络，再逐帝读评传、争议与白话解读，最后追到原文。</p>
        <ol class="threads now-read-list">
          <li>
            <a class="thread" href="#/overview/periods">
              <span class="thread-year">六期</span>
              <h2>六期脉络</h2>
              <p>创业立国到新政终结，296 年一条主线。</p>
            </a>
          </li>
          <li>
            <a class="thread" href="#/overview/timeline">
              <span class="thread-year">十二帝</span>
              <h2>大事记</h2>
              <p>每帝关键年份与事件，骨架年份已回查。</p>
            </a>
          </li>
          <li>
            <a class="thread" href="#/overview/appraisals">
              <span class="thread-year">十帝</span>
              <h2>评传</h2>
              <p>性格、施政、功过，事实与评价分栏。</p>
            </a>
          </li>
          <li>
            <a class="thread" href="#/overview/disputes">
              <span class="thread-year">十帝</span>
              <h2>争议</h2>
              <p>学术、野史、影视三分级，标证据状态。</p>
            </a>
          </li>
          <li>
            <a class="thread" href="#/overview/reading">
              <span class="thread-year">原文</span>
              <h2>白话解读</h2>
              <p>十帝关键文献原文对照，译评分栏。</p>
            </a>
          </li>
        </ol>
      </section>
      <section class="now-read">
        <div class="page-head story">
          <h2>康熙这一段</h2>
        </div>
        <p class="lede">太子废了两次。即位和驾崩，官书都写到了日子。</p>
        <ol class="threads now-read-list">
          <li>
            <a class="thread" href="#/chapter/kangxi-02">
              <span class="thread-year">1675–1712</span>
              <h2>两废太子</h2>
              <p>立过，废过，又立，再废。日子对得上的留下，对不上的也留下。</p>
            </a>
          </li>
          <li>
            <a class="thread" href="#/chapter/kangxi-01">
              <span class="thread-year">1661 · 1722</span>
              <h2>即位、崩逝与遗诏</h2>
              <p>那年即位，次年才改元。口谕是口谕，遗诏是遗诏。实录写的是寝宫。</p>
            </a>
          </li>
          <li>
            <a class="thread" href="#/kangxi">
              <span class="thread-year">康熙朝</span>
              <h2>储位、四后、儿女</h2>
              <p>胤礽怎样一天一天被废。皇后当时叫什么。儿子怎么排。</p>
            </a>
          </li>
        </ol>
      </section>
      <section class="sites-home">
        <div class="page-head story">
          <h2>这些事，今天在哪儿</h2>
        </div>
        <p class="lede">战场、陵寝、园子、关城——这些地方今天什么样，能不能去，和当时差多远。</p>
        <div class="grid cards site-cards">${featured.map((row) => siteCard(row, opts)).join('')}</div>
        <p class="actions">
          ${rest > 0 ? `<a class="link" href="#/sites">其余 ${rest} 处今地</a> · ` : ''}
          <a class="link" href="#/lanes">传闻对照</a>
        </p>
      </section>`;
}
