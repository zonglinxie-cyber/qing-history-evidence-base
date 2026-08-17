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
 * 章节只有在绑定来源单元、达到 E1，且没有同时声明 S 级混合内容时，
 * 才能作为整章进入索引。混合章不能用少数已核段落替整章背书。
 */
export function isChapterIndexable(status, unitCount) {
  const value = String(status ?? '').trim();
  const hasE1 = /(?:^|[/；])\s*E1\s*单源回查/.test(value);
  const hasSecondaryDraft = /(?:^|[/；])\s*S\s*二手/.test(value);
  return Number(unitCount) > 0 && hasE1 && !hasSecondaryDraft;
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

export function researchDraftBanner(scope = 'chapter') {
  const chapter = scope === 'chapter';
  const headline = chapter ? '研究草稿｜本章尚未完成全文史料核对' : 'AI 辅助个人研究库｜并非专家审定本';
  const text = chapter
    ? '本章可能只有部分段落已对到原文，其余仍依赖后出史书或现代研究。请按正文中的「看依据」链接核对，不要把整章当作已成定论。'
    : '全库只有部分条目已对到可回查的原文。请优先阅读每条主张的引文和出处，并将其他内容视为待继续完善的研究草稿。';
  return `<aside class="research-banner research-banner-${chapter ? 'draft' : 'site'}" role="note" aria-label="研究状态">
    <p class="research-banner-head">${headline}</p>
    <p>${text}</p>
  </aside>`;
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
  const rawStatus = site['证据状态'] || '';
  const publicStatus = site['公开证据状态'] || EVIDENCE_LABEL[rawStatus[0]] || '';
  const evCls = rawStatus ? (EVIDENCE_CLASS[rawStatus[0]] || 'site') : (publicStatus === '存在异说' ? 'conflict' : 'medium');
  const siteBadge = publicStatus ? `<span class="cred-badge cred-${evCls}">${esc(publicStatus)}</span>` : '';
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
      ${researchDraftBanner('site')}
      <div class="grid cards">${emperors.map((row) => emperorCard(row, opts)).join('')}</div>
      <section class="now-read">
        <div class="page-head story">
          <h2>先看这几处转轴</h2>
        </div>
        <p class="lede">称汗、称帝、入关、密储、内禅、条约、热河、退位。走完这一页，再点皇帝。</p>
        <p class="actions"><a class="link" href="#/path">276年转轴</a> · <a class="link" href="#/spine/power">谁坐龙椅，谁拍板</a> · <a class="link" href="#/spine/money">饷从哪来，兵谁养</a></p>
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
      <section class="now-read">
        <div class="page-head story">
          <h2>已经对上日子的几处</h2>
        </div>
        <p class="lede">和珅不是第五天处死。继后那拉氏，官书没有写成抗旨宫斗。十三日崩，二十日才即位礼。</p>
        <ol class="threads now-read-list">
          <li>
            <a class="thread" href="#/chapter/jiaqing-04">
              <span class="thread-year">1796–99</span>
              <h2>内禅之后：太上皇崩与和珅案</h2>
              <p>第五天下狱，十五日后赐死。二十条是上谕列罪，不是抄家清册。</p>
            </a>
          </li>
          <li>
            <a class="thread" href="#/lane/QH-L-0033">
              <span class="thread-year">继后</span>
              <h2>继皇后那拉氏</h2>
              <p>官书有断发叙述。没有写成抗旨宫斗。姓氏两说，不择一。</p>
            </a>
          </li>
          <li>
            <a class="thread" href="#/chapter/yongzheng-07">
              <span class="thread-year">1722</span>
              <h2>从十三日崩逝到二十日即位</h2>
              <p>口谕、遗诏、即位礼，不是同一天。</p>
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
