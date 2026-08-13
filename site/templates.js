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
  let reign = (from && to) ? to - from : 0;
  if (emperor.emperor_id === 'QH-E-01') reign = 11;
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

export function imgTag(url, alt, opts = {}) {
  const { src, srcset } = mediaSrcset(url);
  if (!src) return '<div class="img-fallback">无预览图</div>';
  const width = opts.width || 600;
  const height = opts.height || 800;
  const sizes = opts.sizes || '(max-width: 600px) 45vw, (max-width: 960px) 30vw, 280px';
  const loading = opts.eager ? 'eager' : 'lazy';
  const srcsetAttr = srcset ? ` srcset="${esc(srcset)}"` : '';
  const referrer = /^https:\/\//.test(src) ? ' referrerpolicy="no-referrer"' : '';
  const onerror = opts.onerror
    ? ` onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'img-fallback',textContent:'图像暂时无法加载'}))"`
    : '';
  return `<img src="${esc(src)}"${srcsetAttr} sizes="${esc(sizes)}" alt="${esc(alt)}" width="${width}" height="${height}" loading="${loading}" decoding="async"${referrer}${onerror}>`;
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
        <a class="card-pic" href="#/image/${esc(portrait?.visual_id || '')}" aria-label="${esc(alt)}">
          ${img}
        </a>
        <a class="meta" href="#/person/${esc(emperor.person_id)}">
          <div class="era">${esc(era)}</div>
          ${emperorCardVita(emperor)}
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
    : '<div class="img-fallback">今地</div>';
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

export function homeHtml(emperors, sites, opts = {}) {
  const featured = featuredSites(sites);
  const rest = sortedSites(sites).length - featured.length;
  return `      <div class="reading">
        <p class="kicker">清朝</p>
        <h1>十二帝</h1>
        <p class="lede">从太祖努尔哈赤到宣统溥仪。帝号是当时的称号，人还是同一个人。点进去看生卒、在位和留下的像。</p>
      </div>
      <div class="grid cards">${emperors.map((row) => emperorCard(row, opts)).join('')}</div>
      <section class="sites-home">
        <div class="page-head story">
          <h2>这些事，今天在哪儿</h2>
        </div>
        <p class="lede">古战场可能已经在水下。园子可能只剩两座门。行宫也可能还开着。</p>
        <div class="grid cards site-cards">${featured.map((row) => siteCard(row, opts)).join('')}</div>
        <p class="actions">
          ${rest > 0 ? `<a class="link" href="#/sites">其余 ${rest} 处今地</a> · ` : ''}
          <a class="link" href="#/lanes">传闻对照</a>
        </p>
      </section>`;
}
