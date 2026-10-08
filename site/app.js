// 将入口脚本的资源版本传给依赖，避免新页面沿用旧文案与旧选段链接。
const moduleVersion = new URL(import.meta.url).search;
const [
  {
  esc,
  canEmbed,
  canEmbedSite,
  restrictedFallback,
  siteCard,
  visualGalleryCard,
  homeHtml,
  readingCards,
  readingPick,
  selectReadingPicks,
  noOrphan,
  attachOrphanCites,
  imgTag,
  largestVariant,
  noEvidenceBanner,
  siteEraLabel,
  featuredSites: pickFeaturedSites,
  sortedSites: sortSites,
  formatGBT7714,
  sitesMapSvg,
  courtPortraitNote,
  yearSpan,
},
  { normalize, lookup: lookupIndex, buildIndex },
  { calendarDate, chapterGenre, orderedChapters, comparisonLabel, EVIDENCE_HINT },
  { EMPEROR_READS, EMPRESS_IDS, HEIR_THREADS, SOURCE_GROUPS, PATH_NODES, SPINE_POWER, SPINE_MONEY, ERA_PINNED, JIEDU_FEATURED, SITE_DETAILS, PORTRAIT_FRAMING, EMPEROR_CARD, EXHIBITIONS, LINK_LABELS }
] = await Promise.all([
  import('./templates.js' + moduleVersion),
  import('./search.js' + moduleVersion),
  import('./reading.js' + moduleVersion),
  import('./qing-content.js' + moduleVersion)
]);

let studioModule;
function ensureStudio() {
  if (!studioModule) studioModule = import('./studio.js' + moduleVersion).catch((error) => {
    studioModule = null;
    throw error;
  });
  return studioModule;
}

const preferences = {
  get(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* 不支持存储时，本次阅读仍可调节。 */ } },
};

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    // no-cache 是「每次回源核对」而不是「不缓存」：数据块有 2 MB，命中 304 只花一次往返。
    const response = await fetch(url, { signal: controller.signal, cache: 'no-cache' });
    if (!response.ok) throw new Error(`无法载入 ${url}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const DATA = {
  emperors: [],
  featuredReads: [],
  sites: [],
  people: [],
  sources: [],
  units: [],
  claims: [],
  lanes: [],
  empressTimeline: [],
  princes: [],
  princesses: [],
  heirChain: [],
  portraits: [],
  personPortraits: [],
  crosswalk: [],
  regions: [],
  iiif: [],
  kangxiChapter: '',
  chapters: [],
  personMentions: [],
  questions: [],
  predicates: {},
  coverage: {},
  notice: '',
  release: null,
  suggest: [],
  conflictSets: [],
  chronicle: [],
  reignTimeline: [],
  overviews: [],
};

const loadedChunks = new Set();
const inflightChunks = new Map();
let SEARCH = { entries: [], postings: {} };

// 朝代配置由构建注入 index.html 的 #dynasty-config（scripts/build-site.mjs 从 data/dynasties.csv 派生）。
// 单朝代运行时：#dynasty-config 与 DYNASTY.chunk 都是单槽位。换「当前」朝代 = 改 dynasties.csv 的 active 行 + 对应 <dynasty>-content.mjs。
// 多朝代并存需先把数据块前缀化为 d-<code> 并给前端加朝代切换器（见 build-site.mjs 的多 active 拦截守卫）。
const DYNASTY = JSON.parse(document.getElementById('dynasty-config').textContent);
const REIGN_CHUNK = DYNASTY.chunk;
const ASSET_V = DYNASTY.v ? `?v=${encodeURIComponent(DYNASTY.v)}` : '';
const VIEW_CHUNKS = {
  '': ['home'],
  sites: ['home'],
  site: ['home'],
  person: ['home', 'people', REIGN_CHUNK],
  people: ['home', 'people'],
  images: ['home', 'people'],
  image: ['home', 'people'],
  hands: ['home', 'people'],
  material: ['home', 'people', REIGN_CHUNK],
  chapter: ['home', 'people', REIGN_CHUNK],
  studio: ['home', REIGN_CHUNK, 'people'],
  screen: ['home', REIGN_CHUNK, 'people'],
  claims: ['home', REIGN_CHUNK, 'people'],
  claim: ['home', REIGN_CHUNK, 'people'],
  succession: ['home', REIGN_CHUNK, 'people'],
  empresses: ['home', REIGN_CHUNK, 'people'],
  princes: ['home', REIGN_CHUNK, 'people'],
  princesses: ['home', REIGN_CHUNK, 'people'],
  lanes: ['home', REIGN_CHUNK, 'people'],
  lane: ['home', REIGN_CHUNK, 'people'],
  questions: ['home', REIGN_CHUNK, 'people'],
  question: ['home', REIGN_CHUNK, 'people'],
  sources: ['home', 'catalog'],
  source: ['home', 'catalog', REIGN_CHUNK, 'people'],
  works: ['home', REIGN_CHUNK, 'people'],
  how: ['home'],
  changelog: ['home', 'release'],
  path: ['home', REIGN_CHUNK, 'people'],
  spine: ['home', REIGN_CHUNK, 'people'],
  chronicle: ['home', REIGN_CHUNK, 'people'],
  overview: ['home', REIGN_CHUNK, 'people'],
  exhibits: ['home', 'people', REIGN_CHUNK],
  exhibit: ['home', 'people', REIGN_CHUNK],
  search: ['home', 'people', REIGN_CHUNK, 'catalog', 'search'],
  ziguangge: ['home', REIGN_CHUNK, 'people'],
};

async function loadChunk(name) {
  if (loadedChunks.has(name)) return;
  if (inflightChunks.has(name)) return inflightChunks.get(name);
  const pending = fetchJson(`data/${name}.json${ASSET_V}`)
    .then((payload) => {
      if (name === 'search') SEARCH = payload.postings ? payload : buildIndex(payload.entries || []);
      else if (name === 'release') DATA.release = payload;
      else Object.assign(DATA, payload);
      loadedChunks.add(name);
      reindex();
    })
    .finally(() => inflightChunks.delete(name));
  inflightChunks.set(name, pending);
  return pending;
}

async function ensureView(view) {
  const eraChunks = ['home', 'people', REIGN_CHUNK];
  const chunks = VIEW_CHUNKS[view] || (DYNASTY.eras[view] ? eraChunks : ['home', 'people', REIGN_CHUNK, 'catalog']);
  await Promise.all(chunks.map(loadChunk));
}

async function loadChapterBody(slug) {
  if (!slug) return;
  const row = (DATA.chapters || []).find((item) => item.slug === slug);
  if (row?.bodyHtml) return;
  try {
    const payload = await fetchJson(`data/chapter/${encodeURIComponent(slug)}.json${ASSET_V}`);
    if (typeof payload.bodyHtml !== 'string') throw new Error('chapter body missing');
    if (row) row.bodyHtml = payload.bodyHtml;
    else (DATA.chapters ||= []).push(payload);
  } catch {
    if (row) row.bodyHtml = `<p class="warn">正文加载失败，<button type="button" class="link" data-retry-chapter="${esc(slug)}">重试</button></p>`;
  }
}

function eraPage(slug) {
  const eraLabel = DYNASTY.eras[slug];
  if (!eraLabel) return `<h1>未找到该页面</h1><p class="actions"><a class="link" href="#/">← 十二帝</a></p>`;
  const emperor = (DATA.emperors || []).find((row) => String(row['年号或通称'] || '').split('；')[0] === eraLabel);
  return emperor ? emperorPage(emperor) : `<h1>${esc(eraLabel)}朝</h1><p class="empty">这一朝尚未建立帝王条目。</p>`;
}


  const main = document.getElementById('main');
  const drawer = document.getElementById('drawer');
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('q');

  let peopleById = new Map();
  let emperorByPerson = new Map();
  let emperorByLegacy = new Map();
  let unitById = new Map();
  let sourceById = new Map();
  let claimById = new Map();
  let portraitsByEmperor = new Map();
  let portraitById = new Map();
  let regionsByVisual = new Map();
  let regionsByAssertion = new Map();
  let iiifByVisual = new Map();
  function reindex() {
    peopleById = new Map((DATA.people || []).map((row) => [row.person_id, row]));
    emperorByPerson = new Map((DATA.emperors || []).map((row) => [row.person_id, row]));
    emperorByLegacy = new Map((DATA.emperors || []).map((row) => [row.emperor_id, row]));
    unitById = new Map((DATA.units || []).map((row) => [row.source_unit_id, row]));
    sourceById = new Map((DATA.sources || []).map((row) => [row.source_id, row]));
    claimById = new Map((DATA.claims || []).map((row) => [row['Assertion ID'], row]));
    portraitsByEmperor = new Map();
    for (const row of DATA.portraits || []) {
      const list = portraitsByEmperor.get(row.emperor_id) || [];
      list.push(row);
      portraitsByEmperor.set(row.emperor_id, list);
    }
    portraitById = new Map((DATA.portraits || []).map((row) => [row.visual_id, row]));
    regionsByVisual = new Map();
    regionsByAssertion = new Map();
    for (const row of DATA.regions || []) {
      const vlist = regionsByVisual.get(row.visual_id) || [];
      vlist.push(row);
      regionsByVisual.set(row.visual_id, vlist);
      const alist = regionsByAssertion.get(row.assertion_id) || [];
      alist.push(row);
      regionsByAssertion.set(row.assertion_id, alist);
    }
    iiifByVisual = new Map((DATA.iiif || []).map((row) => [row.visual_id, row.iiif_manifest]));
  }
  function primaryPortrait(emperorId) {
    const list = portraitsByEmperor.get(emperorId) || [];
    return list.find((row) => row['展示角色'] === '默认朝服像') || list[0] || null;
  }

  // C2: OpenSeadragon deep-zoom viewer (CDN, zero npm dependency)
  let osdPromise = null;
  let osdInstances = [];
  function loadOsd() {
    if (osdPromise) return osdPromise;
    osdPromise = new Promise((resolve, reject) => {
      if (window.OpenSeadragon) return resolve(window.OpenSeadragon);
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/openseadragon@4.1.1/build/openseadragon/openseadragon.min.js';
      s.integrity = 'sha384-SslUh5K0qRJYyxhoVK+XxSxjS0BNDdgc3cLvY4+nMEmnLtgdEK3UaBTDaHOk8T9S';
      s.crossOrigin = 'anonymous';
      s.referrerPolicy = 'no-referrer';
      s.onload = () => resolve(window.OpenSeadragon);
      s.onerror = () => { osdPromise = null; reject(new Error('OSD CDN load failed')); };
      document.head.appendChild(s);
    });
    return osdPromise;
  }
  function destroyOsdViewers() {
    for (const v of osdInstances) { try { v.destroy(); } catch {} }
    osdInstances = [];
  }
  function osdFallback(el) {
    const fallback = el.dataset.fallback || '';
    const alt = el.dataset.alt || '';
    el.className = 'image-regions';
    el.innerHTML = `<img src="${esc(fallback)}" alt="${esc(alt)}">`;
  }
  function initOsdViewers() {
    const els = main.querySelectorAll('.osd-viewer[data-manifest]');
    if (!els.length) return;
    loadOsd().then((OSD) => {
      for (const el of els) {
        if (el.dataset.osdReady) continue;
        el.dataset.osdReady = '1';
        const manifest = el.dataset.manifest;
        if (!manifest) continue;
        const isIIIF = manifest.includes('info.json') || manifest.endsWith('.json');
        const tileSources = isIIIF ? manifest : { type: 'image', url: manifest };
        try {
          const viewer = OSD({
            element: el,
            tileSources,
            prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@4.1.1/build/openseadragon/images/',
            showNavigator: true,
            navigatorPosition: 'BOTTOM_RIGHT',
            constrainDuringPan: true,
            visibilityRatio: 1,
            minZoomImageRatio: 0.5,
            maxZoomPixelRatio: 2,
          });
          osdInstances.push(viewer);
        } catch {
          osdFallback(el);
        }
      }
    }).catch(() => {
      els.forEach(osdFallback);
    });
  }

  function mediaImg(src, alt, lightbox = '') {
    return imgTag(src, alt, {
      width: 600,
      height: 800,
      onerror: true,
      sizes: '(max-width: 600px) 45vw, (max-width: 960px) 30vw, 280px',
      lightbox,
    });
  }

  function safeUrl(url) {
    const value = String(url || '').trim();
    return /^https?:\/\//.test(value) ? value : '';
  }

  function sourcePageLabel(portrait) {
    const url = portrait['文件页'] || '';
    if (/zh\.wikisource\.org/.test(url)) return '维基文库';
    if (/wikimedia\.org/.test(url)) return 'Wikimedia 文件页';
    if (/qingarchives\.npm/.test(url)) return '台北故宫清档';
    if (/digitalarchive\.npm|npm\.gov\.tw|npm\.edu\.tw/.test(url)) return '台北故宫';
    if (/dpm\.org\.cn/.test(url)) return '故宫';
    return '来源';
  }

  function transcriptionBlock(portrait) {
    if (!portrait['释文']) return '';
    return `<blockquote class="transcription"><p>${esc(portrait['释文'])}</p></blockquote>`;
  }

  function thumbMods(row) {
    const role = row['展示角色'] || '';
    return [
      canEmbed(row) ? '' : ' missing',
      role === '相关史迹' ? ' wide' : '',
      role === '御笔书法' ? ' script' : '',
      role === '奏折朱批' ? ' doc' : '',
    ].join('');
  }

  function thumbCard(row) {
    return `
      <a class="thumb${thumbMods(row)}" href="#/image/${esc(row.visual_id)}">
        <span class="thumb-pic">
          ${canEmbed(row) ? mediaImg(row['预览文件'], row['对象标题'], row['对象标题']) : `<span class="img-fallback">${esc(row['对象标题'])}</span>`}
        </span>
        <span class="thumb-cap">${esc(row['对象标题'])}</span>
      </a>`;
  }

  function personName(id) {
    const emperor = emperorByPerson.get(id);
    if (emperor) return emperor['年号或通称'].split('；')[0];
    const person = peopleById.get(id);
    if (person) return person['规范名'].replace(/^爱新觉罗·/, '');
    return id;
  }

  function personHref(id) {
    const emperor = emperorByPerson.get(id);
    if (emperor?.eraSlug) return `#/${emperor.eraSlug}`;
    if (peopleById.has(id) || emperor) return `#/person/${encodeURIComponent(id)}`;
    return '';
  }

  function personLink(id) {
    const href = personHref(id);
    const label = personName(id);
    return href ? `<a href="${esc(href)}">${esc(label)}</a>` : esc(label || id);
  }

  function objectDisplay(claim) {
    const value = claim['客体 ID 或值'];
    if (/^QH-P-/.test(value)) return personLink(value);
    return esc(value);
  }

  function rightsChip(color) {
    const cls = color === '绿' ? 'green' : color === '红' ? 'red' : 'amber';
    return `<span class="chip ${cls}">权利 ${esc(color)}</span>`;
  }

  function reviewChip(claim) {
    const review = claim.review;
    return `<span class="chip">${esc(review?.label || '未登记逐条复核')}</span>`;
  }

  function calendarChip(record) {
    if (record?.calendar?.status === 'conflict') return '<span class="chip red">日期换算异常</span>';
    if (record?.calendar?.status === 'review') return '<span class="chip amber">日期待核</span>';
    return '';
  }

  function calendarStatusLabel(record) {
    return ({
      conflict: '公历换算存在一致性冲突，暂不展示精确值',
      review: '公历换算有待确认',
      unknown: '尚未运行日期检查',
    })[record?.calendar?.status] || '';
  }

  function predicateLabel(code) {
    return (DATA.predicates || {})[code] || code;
  }

  function evidenceMark(state) {
    if (!state) return '';
    let label = state;
    let cls = 'mark';
    if (state === '已列原文' || state.startsWith('E')) { label = state === '已列原文' ? '已列原文' : '已回原文'; cls = 'mark ok'; }
    else if (state === '存在异说' || state.startsWith('C')) { label = state === '存在异说' ? '存在异说' : '两说并存'; cls = 'mark two'; }
    else if (state === '参考线索') { label = '参考线索'; }
    else if (state.startsWith('S')) { label = '后出转述'; }
    else if (state === '尚不确定') { label = '尚不确定'; }
    else { label = state; }
    const hint = EVIDENCE_HINT[label] || '';
    const title = hint ? ` title="${esc(hint)}"` : '';
    return `<span class="${cls}"${title}>${esc(label)}</span>`;
  }

  function lanePeople(row) {
    return (row['相关人物ID'] || '').split(/[；;]/).map((item) => item.trim()).filter(Boolean);
  }

  function lanesForPerson(id) {
    return (DATA.lanes || []).filter((row) => lanePeople(row).includes(id));
  }

  function laneHref(url) {
    if (!url) return '';
    // 站内链接给出条目的实际题名，外链标明是站外材料
    if (url.startsWith('#/')) return relatedLinks(url);
    const safe = safeUrl(url);
    if (!safe) return '';
    return `<a class="link" href="${esc(safe)}" target="_blank" rel="noopener">外部来源</a>`;
  }

  function linkifyInternal(text) {
    return esc(text).replace(/#\/chapter\/[A-Za-z0-9-]+/g, (m) => `<a class="link" href="${m}">见本站章</a>`);
  }

  function laneCard(row, opts = {}) {
    const title = opts.detail
      ? esc(row['标题'])
      : `<a href="#/lane/${esc(row.lane_id)}">${esc(row['标题'])}</a>`;
    const headingLevel = opts.headingLevel === 2 ? 2 : 3;
    const subheadingLevel = headingLevel + 1;
    const people = lanePeople(row);
    return `
      <article class="card lane-card-panel" id="${esc(row.lane_id)}">
        <header class="lane-card-header">
          <h${headingLevel} class="lane-card-title">${title}</h${headingLevel}>
          ${row['栏目'] ? `<span class="lane-chip">${esc(row['栏目'])}</span>` : ''}
        </header>
        ${people.length ? `<p class="lane-people muted">${people.map(personLink).join('、')}</p>` : ''}
        <div class="split lane-split">
          <div class="said official">
            <div class="said-head"><span class="said-tag official-tag">官书／档案摘要</span><h${subheadingLevel}>材料如何记</h${subheadingLevel}></div>
            <p class="said-body">${esc(row['官书或档案怎么写'])}</p>
          </div>
          <div class="said unofficial">
            <div class="said-head"><span class="said-tag unofficial-tag">通行说法 · 传闻</span><h${subheadingLevel}>通行说法</h${subheadingLevel}></div>
            <p class="said-body">${esc(row['通行说法'])}</p>
            ${row['野史笔记或影视怎么写'] ? `<p class="said-extra muted">${esc(row['野史笔记或影视怎么写'])}</p>` : ''}
          </div>
        </div>
        <div class="lane-reading-box">
          <div class="lane-reading-head"><span class="lane-reading-badge">考辨</span><strong>怎么读</strong></div>
          <p class="lane-reading-content">${linkifyInternal(row['差异或读法'])}</p>
        </div>
        <p class="actions lane-actions">
          ${laneHref(row['来源入口'])}
        </p>
      </article>
    `;
  }

  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [pathPart, queryPart = ''] = raw.split('?');
    const parts = pathPart.split('/').filter(Boolean);
    const query = Object.fromEntries(new URLSearchParams(queryPart));
    return { parts, query, path: `/${parts.join('/')}` };
  }

  function setNav(path) {
    const current = path.split('/').filter(Boolean)[0] || '';
    const readViews = new Set(['read', 'chapter', 'overview', 'path', 'spine', 'chronicle']);
    const materialViews = new Set(['material', 'works', 'hands', 'jiedu', 'image', 'sources', 'source']);
    document.querySelectorAll('.nav a').forEach((link) => {
      const href = (link.getAttribute('href') || '#/').replace(/^#/, '') || '/';
      const key = href.split('/').filter(Boolean)[0] || '';
      let on = false;
      if (!key) on = !current || current === 'emperors' || Boolean(DYNASTY.eras[current])
        || ['people', 'person', 'empresses', 'princes', 'princesses', 'succession'].includes(current);
      else if (key === 'read') on = readViews.has(current);
      else if (key === 'material') on = materialViews.has(current);
      else if (key === 'sites') on = current === 'sites' || current === 'site';
      else on = key === current;
      link.classList.toggle('active', on);
      if (on) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  let drawerTrigger = null;

  function isModalOpen(el) {
    return Boolean(el && (el.open || (typeof el.showModal !== 'function' && !el.hidden)));
  }

  function openModal(el) {
    if (!el) return;
    if (typeof el.showModal === 'function') {
      if (!el.open) el.showModal();
    } else {
      el.hidden = false;
    }
  }

  function closeModal(el) {
    if (!el) return;
    if (typeof el.close === 'function' && el.open) el.close();
    else el.hidden = true;
  }

  function closeDrawer() {
    if (!isModalOpen(drawer)) return;
    closeModal(drawer);
    drawer.innerHTML = '';
    const trigger = drawerTrigger;
    drawerTrigger = null;
    if (trigger && document.contains(trigger)) trigger.focus();
  }

  function openDrawer(html, trigger) {
    drawerTrigger = trigger || null;
    drawer.innerHTML = `<button class="close" type="button" data-close>关闭</button>${html}`;
    openModal(drawer);
    requestAnimationFrame(() => drawer.querySelector('.close')?.focus());
  }

  drawer?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDrawer();
  });
  drawer?.addEventListener('click', (event) => {
    if (!isModalOpen(drawer) || typeof drawer.getBoundingClientRect !== 'function') return;
    const rect = drawer.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) closeDrawer();
  });

  // 灯箱：img[data-lightbox] 点击放大预览，不打断卡片导航
  let lightboxTrigger = null;
  const lightbox = document.getElementById('lightbox');

  function openLightbox(img, trigger) {
    const boxImg = document.getElementById('lightbox-img');
    const boxCap = document.getElementById('lightbox-cap');
    if (!lightbox || !boxImg) return;
    lightboxTrigger = trigger || null;
    const caption = img.getAttribute('data-lightbox') || img.alt || '';
    const base = img.getAttribute('data-src') || img.getAttribute('src') || img.currentSrc || img.src;
    // 本地缓存图优先试 1280px 同格式档（jpg/png/webp），404 时回退普通档。
    const local = base.match(/^(media\/[^@]+)(\.(?:jpe?g|png|webp))$/i);
    const localHi = local ? `${local[1]}@2x${local[2]}` : '';
    boxImg.onerror = localHi ? () => { boxImg.onerror = null; boxImg.src = base; } : null;
    boxImg.src = localHi || largestVariant(base);
    boxImg.alt = caption;
    if (boxCap) boxCap.textContent = caption;
    openModal(lightbox);
    requestAnimationFrame(() => document.getElementById('lightbox-close')?.focus());
  }

  function closeLightbox() {
    if (!isModalOpen(lightbox)) return;
    closeModal(lightbox);
    const trigger = lightboxTrigger;
    lightboxTrigger = null;
    if (trigger && document.contains(trigger)) trigger.focus();
  }

  lightbox?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeLightbox();
  });

  document.addEventListener('click', (event) => {
    const img = event.target.closest ? event.target.closest('img[data-lightbox]') : null;
    if (!img) return;
    event.preventDefault();
    event.stopPropagation();
    openLightbox(img, event.target.closest('a') || img);
  }, true);

  document.getElementById('lightbox')?.addEventListener('click', (event) => {
    if (event.target.id === 'lightbox' || event.target.id === 'lightbox-close') closeLightbox();
  });

  function renderClaimDrawer(claim, trigger) {
    const unit = unitById.get(claim['来源实体 ID']);
    const source = unit ? sourceById.get(unit.source_entity_id) : null;
    const gbtCite = formatGBT7714(claim, unit);
    openDrawer(`
      <p class="kicker">依据</p>
      <h2>${esc(predicateLabel(claim['谓词/关系']))}</h2>
      <p>${reviewChip(claim)}${calendarChip(claim)}</p>
      <p class="sub">编辑记录：${esc(claim.review?.editorialStatus || '未登记')}；编辑采纳不等于史实已核实。${calendarStatusLabel(claim) ? ` ${esc(calendarStatusLabel(claim))}。` : ''}</p>
      <p class="quote">「${esc(claim['支持引文'])}」</p>
      <dl class="kv">
        <dt>谁</dt><dd>${personLink(claim['主体 ID'])}</dd>
        <dt>何事</dt><dd>${objectDisplay(claim)}</dd>
        <dt>纪年</dt><dd>${esc(claim['原始时间表达'])}</dd>
        <dt>公历</dt><dd>${esc(calendarDate(claim))}</dd>
        <dt>出处</dt><dd>${esc(claim['卷页/档号/图像定位'])}</dd>
      </dl>
      ${unit ? `<p class="unit-ref">${esc(unit['史料名'])} ${esc(unit['卷次'])} ${esc(unit['原纪年'])}${unit['当日条次'] ? ` · ${esc(unit['当日条次'])}` : ''}</p>` : ''}
      <div class="cite-section">
        <div class="cite-bar">
          <span class="cite-title">GB/T 7714-2015 引用</span>
          <button class="link btn-copy-cite" type="button" data-cite-claim="${esc(claim['Assertion ID'])}">复制引用</button>
        </div>
        <p class="cite-preview"><code>${esc(gbtCite)}</code></p>
      </div>
      <p class="actions">
        ${unit ? `<a class="link" href="${esc(safeUrl(unit['直接记录网址']))}" target="_blank" rel="noopener">原文</a>` : ''}
        ${unit && safeUrl(unit.stable_locator) && unit.stable_locator !== unit['直接记录网址']
          ? `<a class="link" href="${esc(safeUrl(unit.stable_locator))}" target="_blank" rel="noopener">稳定卷页</a>`
          : ''}
        ${source ? `<a class="link" href="#/source/${esc(source.source_id)}">来源说明</a>` : ''}
      </p>
    `, trigger);
  }

  function citationText(claim, unit) {
    return formatGBT7714(claim, unit);
  }

  // 合并角标的抽屉：一次列出该组全部依据，每条仍可下钻到单条详情。
  function renderClaimRunDrawer(claims, trigger) {
    const items = claims.map((claim) => {
      const unit = unitById.get(claim['来源实体 ID']);
      const locator = claim['卷页/档号/图像定位'];
      const unitLine = unit
        ? `${esc(unit['史料名'])}${unit['卷次'] ? ` ${esc(unit['卷次'])}` : ''}`
        : '';
      return `
        <li class="claim-run-item">
          <p class="quote">「${esc(claim['支持引文'])}」</p>
          <p class="sub">${esc(predicateLabel(claim['谓词/关系']))}${locator ? ` · ${esc(locator)}` : ''}${unitLine ? ` · ${unitLine}` : ''}</p>
          <p class="actions"><button class="link" type="button" data-claim="${esc(claim['Assertion ID'])}">单条详情</button></p>
        </li>`;
    }).join('');
    openDrawer(`
      <p class="kicker">依据</p>
      <h2>这一处引用 ${claims.length} 条依据</h2>
      <p class="muted">同句并列的条目一次列出，点「单条详情」看卷页与引用格式。</p>
      <ol class="claim-run-list">${items}</ol>
    `, trigger);
  }

  function claimCard(claim) {
    const pred = predicateLabel(claim['谓词/关系']);
    return `
      <article class="claim" id="${esc(claim['Assertion ID'])}">
        <p class="sentence">${personLink(claim['主体 ID'])} ${esc(pred)} ${objectDisplay(claim)}</p>
        <div class="chips">${reviewChip(claim)}${calendarChip(claim)}${claim['冲突组 ID'] ? '<span class="chip indigo">有异说</span>' : ''}</div>
        <p class="sub">${esc(claim['原始时间表达'])} · ${esc(calendarDate(claim))}${claim['冲突组 ID'] ? ` · ${comparisonLabel(claim['冲突组 ID'])}` : ''}</p>
        <p class="quote">「${esc(claim['支持引文'])}」</p>
        <p class="actions">
          <button class="link" data-claim="${esc(claim['Assertion ID'])}">依据</button>
        </p>
      </article>
    `;
  }

  function mentionCard(row) {
    const href = `#/chapter/${encodeURIComponent(row.chapter_slug)}${row.focus ? `?focus=${encodeURIComponent(row.focus)}` : ''}`;
    return `
      <article class="claim">
        <p class="sentence"><a class="link" href="${esc(href)}">${esc(row.section_title || '本章开篇')}</a></p>
        <p class="quote">${esc(row.excerpt)}</p>
      </article>
    `;
  }

  // 出场按章归组：一个人物散在十几篇里，逐条平铺会读成一堵链接墙。
  function mentionGroups(mentions) {
    const groups = [];
    for (const row of mentions) {
      const last = groups[groups.length - 1];
      if (last && last.chapter_slug === row.chapter_slug) last.rows.push(row);
      else groups.push({ chapter_slug: row.chapter_slug, chapter_title: row.chapter_title, era: row.era, rows: [row] });
    }
    return groups.map((group) => `
      <h3><a class="link" href="#/chapter/${encodeURIComponent(group.chapter_slug)}">${esc(group.chapter_title)}</a> <span class="muted">${esc(group.era)} · ${group.rows.length} 处</span></h3>
      ${group.rows.map((row) => mentionCard(row)).join('')}
    `).join('');
  }

  function annotationChips(portrait) {    return (portrait['关键标注'] || '').split('；').filter(Boolean)
      .map((item) => `<span class="chip">${esc(item)}</span>`).join('');
  }

  function home() {

    return homeHtml(DATA.dynasty, DATA.emperors, DATA.sites, { onerror: true });
  }

  function eraChapters(era) {
    return (DATA.chapters || [])
      .filter((row) => row.era === era)
      .slice()
      .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
  }

  function crumbs(items) {
    const bits = (items || []).filter((item) => item && item.label);
    if (!bits.length) return '';
    return `<p class="crumb">${bits.map((item) => (
      item.href ? `<a class="link" href="${esc(item.href)}">${esc(item.label)}</a>` : `<span>${esc(item.label)}</span>`
    )).join(' <span class="crumb-sep" aria-hidden="true">›</span> ')}</p>`;
  }

  // 一句话后挂 N 条依据时，编号上标会连成一片数字墙（最长 30 连）。
  // 把 ≥RUN_MIN 个相邻角标收成一枚「起–止」号，点击后列出该组全部依据；
  // 单条绑定原样保留在 data-claim-run 里，证据链不丢。
  const CITE_RUN_MIN = 5;
  const CITE_RUN_RE = /(?:<(?:button|a)\b[^>]*\bclaim-ref\b[^>]*>\s*<sup class="cite-n">\d+<\/sup>\s*<\/(?:button|a)>\s*){5,}/g;

  function collapseCiteRuns(html) {
    return String(html || '').replace(CITE_RUN_RE, (run) => {
      const nums = [...run.matchAll(/<sup class="cite-n">(\d+)<\/sup>/g)].map((m) => m[1]);
      const ids = [...run.matchAll(/data-claim="([^"]+)"/g)].map((m) => m[1]);
      if (nums.length < CITE_RUN_MIN || ids.length !== nums.length) return run;
      const from = nums[0];
      const to = nums[nums.length - 1];
      return `<button type="button" class="link claim-ref is-run"`
        + ` data-claim="${esc(ids[0])}" data-claim-run="${esc(ids.join(','))}"`
        + ` aria-label="依据 ${from} 至 ${to}，共 ${nums.length} 条">`
        + `<sup class="cite-n">${from}\u2013${to}</sup>`
        + `<span class="cite-run-n">${nums.length} 条</span>`
        + '</button>';
    });
  }

  function citeClaimRefs(html) {
    let n = 0;
    const converted = String(html || '').replace(
      /<(button|a)(\s[^>]*\bclaim-ref\b[^>]*)>(?:依据|<sup class="cite-n">\d+<\/sup>)<\/\1>/g,
      (_, tag, attrs) => {
        n += 1;
        const labeled = /\baria-label=/.test(attrs) ? attrs : `${attrs} aria-label="依据 ${n}"`;
        return `<${tag}${labeled}><sup class="cite-n">${n}</sup></${tag}>`;
      },
    );
    return collapseCiteRuns(attachOrphanCites(converted));
  }

  function liftEditorialBans(html) {
    const held = [];
    const masked = String(html || '').replace(/<(aside|details|blockquote)[\s\S]*?<\/\1>/g, (block) => {
      held.push(block);
      return `<!--LIFT${held.length - 1}-->`;
    });
    const bans = [];
    const lifted = masked.replace(/<p>([\s\S]*?)<\/p>/g, (full, inner) => {
      const text = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim();
      if (!text || text.length > 90) return full;
      if (!/^(不能|不得|本库不)/.test(text)) return full;
      if (/data-claim|claim-ref/.test(inner)) return full;
      bans.push(inner.replace(/<[^>]+>/g, '').trim());
      return '';
    });
    return {
      body: lifted.replace(/<!--LIFT(\d+)-->/g, (_, i) => held[Number(i)]),
      bans,
    };
  }

  function readCatalogPage() {
    const list = (DATA.chapters || []).slice().sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
    const groups = groupByReign(list, (row) => row.era);
    const narrative = list.filter((row) => chapterGenre(row) === '章').length;
    return `
      <div class="reading page-intro">
        <p class="kicker">读故事</p>
        <h1>按朝读故事</h1>
        <p class="lede">十二帝排成一条线。正文是章，年表和世表标成资料，不打断阅读。</p>
        ${crumbs([{ href: '#/', label: '十二帝' }, { label: '读故事' }])}
        <p class="muted">全站收录 ${list.length} 篇，其中 ${narrative} 篇为主线正文。</p>
      </div>
      ${DATA.featuredReads?.length ? `<section class="read-features" aria-labelledby="read-picks">
        <div class="reading-section-head"><div><p class="kicker">先挑一篇</p><h2 id="read-picks">每个精选都从一个具体问题开始</h2></div></div>
        ${readingCards(DATA.featuredReads)}
      </section>` : ''}
      <nav class="era-jump era-tab-bar" aria-label="按朝跳转">${groups
        .map(([era, items]) => `<button type="button" class="era-tab-item" data-scroll="read-${esc(era)}">${esc(era)} <i>${items.length}</i></button>`).join('')}</nav>
      ${groups.map(([era, items]) => `
        <section class="read-era-section" id="read-${era}">
          ${reignHead(era, items.length, '篇')}
          <div class="grid cards read-chapter-grid">${items.map((row) => {
            const genre = chapterGenre(row);
            const isData = genre === '资料';
            return `
              <article class="card chapter-item-card${isData ? ' is-data' : ''}">
                <a class="chapter-item-link" href="#/chapter/${esc(row.slug)}">
                  <div class="chapter-item-meta">
                    <span class="chapter-genre-tag ${isData ? 'tag-data' : 'tag-story'}">${esc(genre)}</span>
                    <span class="chapter-era-name">${esc(row.era)}</span>
                  </div>
                  <h3 class="chapter-item-title">${esc(row.title)}</h3>
                  <p class="chapter-item-lede">${esc(row.lede || '')}</p>
                </a>
              </article>`;
          }).join('')}</div>
        </section>`).join('')}
    `;
  }

  // 展示角色只有 5 个值，其中「其他真迹」把器物和行乐图混在一起。
  // 浏览页改用更具体的「图像性质」归类，让每件视觉材料都有唯一入口。
  const VISUAL_GROUPS = [
    { key: 'court', title: '朝服像', test: /朝服像/ },
    { key: 'life', title: '便服·行乐·戎装·化身', test: /便服|行乐|扮装|角色扮演|化身|戎装|骑马|狩猎|长卷/ },
    { key: 'brush', title: '御笔', test: /御笔|书法|匾额|法书|史论/ },
    { key: 'rescript', title: '朱批奏折', test: /[朱硃]批|奏折/ },
    { key: 'edict', title: '诏书上谕', test: /上谕|诏书|官方文书|卷首谕旨/ },
    { key: 'object', title: '器物', test: /^器物$/ },
    { key: 'photo', title: '历史照片', test: /历史照片/ },
    { key: 'site', title: '史迹与后世画', test: /地景|后世历史画/ },
  ];

  function visualGroup(row) {
    const kind = String(row?.['图像性质'] || '');
    return VISUAL_GROUPS.find((group) => group.test.test(kind)) || null;
  }

  const MATERIAL_KINDS = [
    { key: 'works', href: '#/works', title: '文献', hint: '实录、圣训、御制、敕编——这一朝写下的书和奉旨修成的书。' },
    { key: 'visuals', href: '#/hands', title: '像与物', hint: '朝服像、行乐图、御笔、朱批、诏书、器物、照片。书之外留下来的东西。' },
    { key: 'jiedu', href: '#/jiedu', title: '逐段读原典', hint: '原典拆成短引，每段配白话、「为何这样写」和「不能写成」。' },
  ];

  function materialRows() {
    const works = DATA.works || [];
    return (DATA.emperors || []).map((e) => {
      const era = String(e['年号或通称'] || '').split('；')[0];
      const list = portraitsByEmperor.get(e.emperor_id) || [];
      return {
        era,
        href: e.eraSlug ? `#/${e.eraSlug}` : `#/person/${e.person_id}`,
        who: String(e['规范名'] || '').replace(/^爱新觉罗·/, ''),
        works: works.filter((w) => w.emperor_id === e.emperor_id).length,
        visuals: list.filter(visualGroup).length,
        jiedu: (JIEDU_FEATURED || []).filter((x) => x.era === era).length,
      };
    });
  }

  // 「史料与遗址」——朝代页原来一个字都没链到文献/真迹/逐解。
  // 康熙、雍正走专题页，不经过 eraPage，所以抽成公用的。
  function reignTail(eraLabel) {
    const e = reignRecord(eraLabel);
    if (!e) return '';
    const read = EMPEROR_READS[e.person_id];
    const sites = sitesForEmperor(e.emperor_id).slice(0, 2);
    const works = (DATA.works || []).filter((w) => w.emperor_id === e.emperor_id);
    const opened = works.filter((w) => w.hasDirectText);
    const workLine = opened.length
      ? `${opened.length} 种文献已列出可直接回查的条目。`
      : works.length
        ? `文献栏收录 ${works.length} 种书，目前只提供馆藏或查阅入口。`
        : '这一朝的专题文献尚未收录。';
    return `
      ${sites.length ? `<h2>遗址今况</h2>
      <div class="grid cards site-cards">${sites.map(siteCard).join('')}</div>` : ''}
      <p class="bound">${esc(workLine)}系年不可考者，不编年表。</p>
      ${read?.evidenceNote ? `<details class="evidence-drawer"><summary>史料说明</summary><p>${esc(read.evidenceNote)}</p></details>` : ''}
      ${reignMaterialBlock(eraLabel)}`;
  }

  function reignMaterialBlock(eraLabel) {
    const e = reignRecord(eraLabel);
    if (!e) return '';
    const q = encodeURIComponent(eraLabel);
    const nWorks = (DATA.works || []).filter((w) => w.emperor_id === e.emperor_id).length;
    const nJiedu = (JIEDU_FEATURED || []).filter((x) => x.era === eraLabel).length;
    const nSites = sitesForEmperor(e.emperor_id).length;
    const bits = [
      nWorks ? `<a class="link" href="#/works?era=${q}">文献 ${nWorks} 种</a>` : '',
      nJiedu ? `<a class="link" href="#/jiedu?era=${q}">逐段读原典 ${nJiedu} 篇</a>` : '',
      nSites ? `<a class="link" href="#/sites">遗址 ${nSites} 处</a>` : '',
    ].filter(Boolean);
    return bits.length ? `<h2>本朝材料</h2><p class="actions">${bits.join(' · ')}</p>` : '';
  }

  function materialCell(n, kind, era) {
    if (!n) return '<td class="mat-zero">—</td>';
    return `<td><a href="#/${kind}?era=${encodeURIComponent(era)}">${n}</a></td>`;
  }

  function materialPage() {
    const rows = materialRows();
    const total = rows.reduce((a, r) => ({ works: a.works + r.works, visuals: a.visuals + r.visuals, jiedu: a.jiedu + r.jiedu }),
      { works: 0, visuals: 0, jiedu: 0 });
    const count = { works: total.works, visuals: total.visuals, jiedu: total.jiedu };
    return `
      <div class="reading">
        <p class="kicker">材料</p>
        <h1>本朝遗存</h1>
        <p class="lede">三种材料：写下的书、留下的像与物、逐段的解读。先挑一种，或者直接从某一朝进去。</p>
      </div>
      <div class="mat-kinds">${MATERIAL_KINDS.map((k) => `
        <a class="mat-kind" href="${esc(k.href)}">
          <span class="mat-kind-n">${count[k.key]}</span>
          <h2>${esc(k.title)}</h2>
          <p>${esc(k.hint)}</p>
        </a>`).join('')}</div>
      <h2 class="mat-head">主题展</h2>
      <p class="muted mat-note">三条按问题走的线，材料都出自上面这三类，只是换了排法。</p>
      <div class="mat-kinds">${EXHIBITIONS.map((exhibition) => `
        <a class="mat-kind" href="#/exhibit/${esc(exhibition.slug)}">
          <span class="mat-kind-n">${exhibitCount(exhibition)}</span>
          <h2>${esc(exhibition.title)}</h2>
          <p>${esc(exhibition.lede)}</p>
        </a>`).join('')}</div>
      <h2 class="mat-head">按朝看</h2>
      <div class="table-wrap"><table class="mat-table">
        <thead><tr><th>朝</th><th>文献</th><th>像与物</th><th>逐段读原典</th></tr></thead>
        <tbody>${rows.map((r) => `
          <tr>
            <th scope="row"><a href="${esc(r.href)}">${esc(r.era)}<span>${esc(r.who)}</span></a></th>
            ${materialCell(r.works, 'works', r.era)}
            ${materialCell(r.visuals, 'hands', r.era)}
            ${materialCell(r.jiedu, 'jiedu', r.era)}
          </tr>`).join('')}</tbody>
      </table></div>
      <p class="actions"><a class="link" href="#/overview">全朝通览</a> · <a class="link" href="#/path">276 年转轴</a> · <a class="link" href="#/sites">遗址今况</a> · <a class="link" href="#/sources">所据材料</a> · <a class="link" href="#/how">怎么读</a></p>
    `;
  }

  // 朝代是这些清单的主脊：能挂到某一朝的条目就按朝分组，
  // 组标题直接通到那位皇帝，读者不必自己认年号。
  function reignRecord(label) {
    const want = String(label || '').trim();
    return (DATA.emperors || []).find((row) => String(row['年号或通称'] || '')
      .split('；').map((x) => x.trim()).includes(want));
  }
  function reignHref(label) {
    const e = reignRecord(label);
    if (!e) return '';
    return e.eraSlug ? `#/${e.eraSlug}` : `#/person/${e.person_id}`;
  }
  function reignPerson(label) {
    const e = reignRecord(label);
    return e ? String(e['规范名'] || '').replace(/^爱新觉罗·/, '') : '';
  }
  // 组标题：年号 + 本名，整块可点，通到该朝
  function reignHead(label, count, unit = '篇', id = '') {
    const href = reignHref(label);
    const who = reignPerson(label);
    const inner = `<span class="era-group-name">${esc(label)}</span>`
      + (who ? `<span class="era-group-who">${esc(who)}</span>` : '')
      + (count ? `<span class="era-group-n">${count} ${esc(unit)}</span>` : '');
    return `<h2 class="era-group"${id ? ` id="${esc(id)}"` : ''}>${href ? `<a href="${esc(href)}">${inner}</a>` : inner}</h2>`;
  }
  // 按在位顺序把带 era 的条目分组
  function groupByReign(rows, getEra) {
    const order = (DATA.emperors || []).map((e) => String(e['年号或通称'] || '').split('；')[0]);
    const bag = new Map();
    for (const row of rows) {
      const key = String(getEra(row) || '').trim() || '其他';
      if (!bag.has(key)) bag.set(key, []);
      bag.get(key).push(row);
    }
    const rank = (k) => {
      const i = order.findIndex((e) => reignRecord(k) && reignRecord(e) && reignRecord(k).emperor_id === reignRecord(e).emperor_id);
      return i < 0 ? 999 : i;
    };
    return [...bag.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  }

  function jieduPage(query = {}) {
    const only = query.era || '';
    const rows = (JIEDU_FEATURED || []).filter((r) => !only || r.era === only);
    const groups = groupByReign(rows, (r) => r.era);
    return `
      <div class="reading page-intro">
        <p class="kicker">逐段读原典</p>
        <h1>一部一部，逐段读</h1>
        <p class="lede">从原文里的细节入手，连着解释与上下文一起读。${only ? `${esc(only)}朝 ${rows.length} 个选读主题。` : `共 ${rows.length} 个选读主题，按朝排定；点击可直达对应选段。`}</p>
        ${crumbs([{ href: '#/', label: '十二帝' }, { href: '#/material', label: '读史料' }, { label: '逐段读原典' }])}
        ${only ? `<p class="actions"><a class="link" href="#/jiedu">全部 ${(JIEDU_FEATURED || []).length} 个主题</a> · <a class="link" href="#/material">← 读史料</a></p>` : ''}
      </div>
      ${only ? '' : `<nav class="era-jump era-tab-bar" aria-label="按朝跳转">${groups
        .map(([era, items]) => `<button type="button" class="era-tab-item" data-scroll="jiedu-${esc(era)}">${esc(era)} <i>${items.length}</i></button>`).join('')}</nav>`}
      ${groups.map(([era, items]) => `
        <div class="jiedu-group-section" id="jiedu-${esc(era)}">
          <h2 class="era-group jiedu-group-head"><span class="era-group-name">${esc(era)}朝</span><span class="era-group-n">${items.length} 个主题</span></h2>
          <ol class="threads jiedu-grid">${items.map((item) => `
            <li>
              <a class="thread" href="${esc(item.focus ? `${item.href}?focus=${encodeURIComponent(item.focus)}` : item.href)}">
                <div class="jiedu-card-header">
                  <span class="jiedu-era-tag">${esc(era)}</span>
                  <span class="jiedu-work-badge">原典逐解</span>
                </div>
                <h2 class="jiedu-card-title">${esc(item.title)}</h2>
                <p class="jiedu-card-desc">${esc(item.text)}</p>
              </a>
            </li>`).join('')}</ol>
        </div>`).join('')}
      <p class="actions" style="margin-top: 40px;">
        <a class="link" href="#/works">文献</a> ·
        <a class="link" href="#/lanes">对照</a> ·
        <a class="link" href="#/">← 十二帝</a>
      </p>`;
  }

  function relatedLaneCards(chapter) {
    const ids = String(chapter?.related || '').split(/[；;]/).map((item) => item.trim())
      .map((href) => href.match(/^#\/lane\/([^/?#]+)/)?.[1]).filter(Boolean);
    const rows = ids.map((id) => (DATA.lanes || []).find((item) => item.lane_id === id)).filter(Boolean);
    if (!rows.length) return '';
    return `<section class="now-read">
      <h2>相关对照</h2>
      <ol class="threads now-read-list">${rows.map((row) => `
        <li>
          <a class="thread" href="#/lane/${esc(row.lane_id)}">
            <span class="thread-year">${esc(row['栏目'] || '对照')}</span>
            <h2>${esc(row['标题'])}</h2>
            <p>${esc(row['差异或读法'] || row['标题'])}</p>
          </a>
        </li>`).join('')}</ol>
    </section>`;
  }

  function relatedLinks(value) {
    // 通用路由的说法属界面壳；本朝专属题目（康熙朝／储位链／景陵…）在 qing-content.js。
    const labels = {
      ...LINK_LABELS,
      '#/lanes': '对照',
      '#/claims': '依据',
      '#/works': '文献',
      '#/hands': '真迹手稿',
      '#/path': '转轴',
    };
    return String(value || '').split(/[；;]/).map((item) => item.trim()).filter(Boolean)
      .map((href) => {
        let label = labels[href];
        if (!label) {
          const siteId = href.match(/^#\/site\/(QH-ST-\d+)$/)?.[1];
          const site = siteId && (DATA.sites || []).find((row) => row.site_id === siteId);
          if (site) label = `遗址今况：${site['事件']}`;
        }
        if (!label) {
          const laneId = href.match(/^#\/lane\/(QH-L-\d+)$/)?.[1];
          const lane = laneId && (DATA.lanes || []).find((row) => row.lane_id === laneId);
          if (lane) label = lane['标题'];
        }
        if (!label) {
          const personId = href.match(/^#\/person\/(QH-P-\d+)$/)?.[1];
          if (personId) label = personName(personId);
        }
        if (!label) {
          const slug = href.match(/^#\/chapter\/([^/?#]+)$/)?.[1];
          const ch = slug && (DATA.chapters || []).find((row) => row.slug === slug);
          if (ch) label = ch.title;
        }
        if (!label) {
          const qid = href.match(/^#\/question\/(QH-GQ-\d+)$/)?.[1];
          const q = qid && (DATA.questions || []).find((row) => row.question_id === qid);
          if (q) label = q.question;
        }
        if (!label) {
          const vid = href.match(/^#\/image\/(QH-V-[A-Za-z0-9]+)$/)?.[1];
          const v = vid && portraitById.get(vid);
          if (v) label = v['对象标题'];
        }
        // 认不出的条目宁可给通用词，也不把内部编号原样抛给读者
        return `<a class="link" href="${esc(href)}">${esc(label || '相关条目')}</a>`;
      })
      .join(' · ');
  }

  function lampChip(lamp) {
    if (!lamp) return '';
    return `<span class="lamp lamp-${esc(lamp)}">${esc(lamp)}</span>`;
  }

  function emperorPack(read, emperor) {
    if (!read || !read.narrative) return '';
    const hasChronicle = chronicleRows(emperor.emperor_id).length > 0;
    const chronicleHref = hasChronicle && emperor.chronicleSlug ? `#/chronicle/${emperor.chronicleSlug}` : '';
    const ref = (r) => r.claim
      ? ` <button class="link" data-claim="${esc(r.claim)}">${esc(r.label)}</button>`
      : (r.href ? ` <a class="link" href="${esc(r.href)}">${esc(r.label)}</a>` : '');
    const prose = read.narrative.map((s) => `<p>${esc(s.p)}${(s.refs || []).map(ref).join('')}</p>`).join('');
    const sources = (read.habits || []).map((row) => `<p><span class="prose-when">${esc(row.when)}·${esc(row.layer)}</span>${esc(row.text)}${row.claim ? ` <button class="link" data-claim="${esc(row.claim)}">依据</button>` : ''}</p>`).join('');
    return `
      <div class="pack-prose">${prose}</div>
      ${sources ? `<h2 id="pack-docs">文书所见</h2><div class="pack-prose pack-sources">${sources}</div>` : ''}
      ${chronicleHref ? `<p class="actions"><a class="link" href="${esc(chronicleHref)}">全朝大事记</a></p>` : ''}
    `;
  }

  function chronicleRows(emperorId) {
    return (DATA.chronicle || [])
      .filter((row) => !emperorId || row.emperor_id === emperorId)
      .slice()
      .sort((a, b) => String(a['排序键'] || '').localeCompare(String(b['排序键'] || '')));
  }

  function chronicleItem(row) {
    const claims = String(row['主张IDs'] || '').split(/[；;]/).map((s) => s.trim()).filter(Boolean);
    return `
      <article class="chronicle-item" id="${esc(row.entry_id)}">
        <p class="sub">${esc(row['原纪年'])} · ${esc(calendarDate(row))}${row['冲突组'] ? ' · 同组记载对照' : ''}</p>
        <h3>${esc(row['标题'])}</h3>
        <p>${esc(row['说明'])}</p>
        ${refRow([
          claimRef(claims),
          chapterRef(row['章节slug']),
          row['今地ID'] ? `<a class="link" href="#/site/${esc(row['今地ID'])}">今地</a>` : '',
        ])}
      </article>`;
  }

  // 本朝纪事：一条时间线。逐日官书条、储位记录与年表行按公历同序排下来。
  // 同年且共享一条主张算同一件事，只留证据级更高的那条（大事记带章节与遗址入口）；
  // 系日不同或异说各条不合并，冲突组照原样标出来，不替读者择一。
  function claimIdsOf(value) {
    return String(value || '').split(/[；;]/).map((id) => id.trim()).filter(Boolean);
  }

  // 一行只留一处出处入口：多条依据收成一枚计数，点开仍是站点原有的并列依据抽屉。
  function claimRef(ids) {
    if (!ids.length) return '';
    if (ids.length === 1) return `<button class="link" type="button" data-claim="${esc(ids[0])}">依据</button>`;
    return `<button class="link" type="button" data-claim="${esc(ids[0])}" data-claim-run="${esc(ids.join(','))}"`
      + ` aria-label="依据 ${ids.length} 条，一次列出">依据 ${ids.length} 条</button>`;
  }

  // 「章」不写成一个字：给出章名，读者知道这点下去读哪一篇。
  function chapterRef(slug) {
    if (!slug) return '';
    const title = String((DATA.chapters || []).find((row) => row.slug === slug)?.title || '').split('：')[0].trim();
    return `<a class="link" href="#/chapter/${esc(slug)}">${esc(title || '原章')}</a>`;
  }

  function personRef(id) {
    const href = personHref(id);
    return href ? `<a class="link" href="${esc(href)}">${esc(personName(id))}</a>` : '';
  }

  function refRow(refs) {
    const bits = refs.filter(Boolean);
    return bits.length ? `<p class="tl-refs">${bits.join('')}</p>` : '';
  }

  function eraTimelineNodes(emperor) {
    const dayRows = chronicleRows(emperor.emperor_id).filter((row) => row['年号级收录'] === '是');
    const dayClaims = new Set(dayRows.flatMap((row) => claimIdsOf(row['主张IDs'])));
    const dated = dayRows.map((row) => ({
      sort: row['排序键'] || row['公历下界'] || '9999',
      year: String(row['公历下界'] || '').slice(0, 4),
      claims: claimIdsOf(row['主张IDs']),
      when: row['原纪年'],
      date: calendarDate(row),
      title: esc(row['标题']),
      gloss: esc(row['说明']),
      conflict: row['冲突组'],
      refs: [
        claimRef(claimIdsOf(row['主张IDs'])),
        chapterRef(row['章节slug']),
        row['今地ID'] ? `<a class="link" href="#/site/${esc(row['今地ID'])}">今地</a>` : '',
      ],
    }));
    const heir = heirEventsFor(emperor.person_id)
      .filter((row) => !claimIdsOf(row['主张 ID']).some((id) => dayClaims.has(id)))
      .map((row) => ({
        sort: row['排序键'] || '9999',
        year: String(row['公历下界'] || '').slice(0, 4),
        claims: claimIdsOf(row['主张 ID']),
        when: row['原纪年'],
        date: calendarDate(row),
        title: eventSentence(row),
        quote: row['引文'],
        conflict: row['冲突组 ID'],
        refs: [claimRef(claimIdsOf(row['主张 ID'])), personRef(row.person_id)],
      }));
    const spine = dated.concat(heir);
    const yearRows = (DATA.reignTimeline || [])
      .filter((row) => row.emperor_id === emperor.emperor_id)
      .filter((row) => !spine.some((node) => node.year && node.year === row.year
        && row.claims.some((id) => node.claims.includes(id))))
      .map((row) => ({
        sort: row.sort,
        when: row.reign_year || row.year_label,
        date: row.year_label,
        title: row.event_html,
        gloss: row.note_html,
        refs: [claimRef(row.claims)],
      }));
    return spine.concat(yearRows).sort((a, b) => String(a.sort).localeCompare(String(b.sort)));
  }

  function eraTimelineBlock(emperor) {
    const nodes = eraTimelineNodes(emperor);
    if (!nodes.length) return '<p class="empty">这一朝还没有系年可考的条目。</p>';
    return `
      <ol class="timeline">
        ${nodes.map((node) => `
          <li>
            <div class="when">
              <strong>${esc(node.when || '')}</strong>
              ${node.date ? `<span class="muted">${esc(node.date)}</span>` : ''}
            </div>
            <div class="what">
              <p class="event-line">${node.title}${node.conflict ? ' <span class="mark two">两说并存</span>' : ''}</p>
              ${node.quote ? `<p class="quote">「${esc(node.quote)}」</p>` : ''}
              ${node.gloss ? `<p class="gloss">${node.gloss}</p>` : ''}
              ${refRow(node.refs)}
            </div>
          </li>`).join('')}
      </ol>`;
  }

  function eraTimelineLinks(emperor) {
    const bits = [];
    const slug = (DATA.reignTimeline || []).find((row) => row.emperor_id === emperor.emperor_id)?.chapter_slug;
    if (slug) bits.push(`<a class="link" href="#/chapter/${esc(slug)}">全表与卷次</a>`);
    if (heirEventsFor(emperor.person_id).length) bits.push('<a class="link" href="#/succession">储位全链</a>');
    return bits.length ? `<p class="actions">${bits.join(' · ')}</p>` : '';
  }

  function pathPage() {
    return `
      <div class="reading">
        <p class="kicker">转轴</p>
        <h1>转轴之处</h1>
        <p class="lede">称汗、称帝、入关、密储、内禅、条约、热河、退位。走完这一页，再点皇帝。</p>
      </div>
      <ol class="threads path-nodes">
        ${PATH_NODES.map((node) => `
          <li>
            <a class="thread" href="${esc(node.href)}">
              <span class="thread-year">${esc(node.year)}${node.era ? `　${esc(node.era)}` : ''}　${lampChip(node.lamp)}</span>
              <h2>${esc(node.title)}</h2>
              <p>${esc(node.text)}</p>
            </a>
          </li>`).join('')}
      </ol>
      <p class="actions"><a class="link" href="#/overview">全朝通览</a> · <a class="link" href="#/spine/power">君权与决策</a> · <a class="link" href="#/spine/money">军饷与兵源</a> · <a class="link" href="#/hands">真迹手稿</a> · <a class="link" href="#/questions?type=%E8%AF%81%E6%8D%AE%E8%BE%B9%E7%95%8C">现有材料答不了</a></p>
    `;
  }

  function spinePage(slug) {
    if (slug === 'money') {
      return `
        <div class="reading">
          <p class="kicker">军饷与兵源</p>
          <h1>财政与兵源</h1>
          <p class="lede">从三藩的藩饷、康熙遗诏中的河工岁费，到雍正的耗羡归公和咸丰朝湘军就地筹饷——这几条财政线索，条次没打开的，只当入口。</p>
          ${crumbs([
            { href: '#/', label: '十二帝' },
            { href: '#/path', label: '转轴' },
            { label: '军饷与兵源' },
          ])}
        </div>
        <ol class="threads">
          ${SPINE_MONEY.map((row) => `
            <li>
              <a class="thread" href="${esc(row.href)}">
                <span class="thread-year">${lampChip(row.lamp)}</span>
                <h2>${esc(row.title)}</h2>
                <p>${esc(row.text)}</p>
              </a>
            </li>`).join('')}
        </ol>
        <p class="actions"><a class="link" href="#/path">转轴</a> · <a class="link" href="#/spine/power">决策归属</a></p>
      `;
    }
    if (slug && slug !== 'power') {
      return `<h1>未找到该主轴</h1><p class="actions"><a class="link" href="#/path">← 转轴</a></p>`;
    }
    return `
      <div class="reading">
        <p class="kicker">继承与决策</p>
        <h1>在位者与决策者</h1>
        <p class="lede">明立太子失败过，密旨后来才写成办法。禅了位，太上皇还在批折子，幼帝那几年，拍板的人另有其人。</p>
        ${crumbs([
          { href: '#/', label: '十二帝' },
          { href: '#/path', label: '转轴' },
          { label: '继承与决策' },
        ])}
      </div>
      <ol class="threads">
        ${SPINE_POWER.map((row) => `
          <li>
            <a class="thread" href="${esc(row.href)}">
              <span class="thread-year">${lampChip(row.lamp)}</span>
              <h2>${esc(row.title)}</h2>
              <p>${esc(row.text)}</p>
            </a>
          </li>`).join('')}
      </ol>
      <p class="actions"><a class="link" href="#/path">转轴</a> · <a class="link" href="#/spine/money">军饷与兵源</a> · <a class="link" href="#/succession">康熙储位全链</a></p>
    `;
  }

  function chroniclePage(slug) {
    if (!slug) {
      return `<h1>未找到该大事记</h1><p class="lede">要看哪一朝，写在地址后面。康熙有十六件。</p><p class="actions"><a class="link" href="#/chronicle/kangxi">康熙大事记</a> · <a class="link" href="#/">← 十二帝</a></p>`;
    }
    const emperor = (DATA.emperors || []).find((row) => row.chronicleSlug === slug)
      || (DATA.emperors || []).find((row) => {
        const era = String(row['年号或通称'] || '').split('；')[0];
        return era === slug;
      });
    if (!emperor) {
      return `<h1>未找到该大事记</h1><p class="actions"><a class="link" href="#/">← 十二帝</a></p>`;
    }
    const rows = chronicleRows(emperor.emperor_id);
    const era = String(emperor['年号或通称'] || '').split('；')[0];
    const back = emperor.eraSlug || slug;
    if (!rows.length) {
      const opened = eraChapters(era);
      return `
        <div class="reading">
          <p class="kicker">${esc(era)}大事记</p>
          <h1>尚无逐日官书条</h1>
          <p class="lede">这一朝只登记了文献入口。日子对不回去，就不编年表。</p>
          <p class="crumb"><a class="link" href="#/${esc(back)}">回${esc(era)}朝</a></p>
        </div>
        ${opened.length ? `
          <p class="muted">已经写下的章，可以从这里进。</p>
          <ol class="threads">
            ${opened.slice(0, 4).map((row) => `
              <li>
                <a class="thread" href="#/chapter/${esc(row.slug)}">
                  <span class="thread-year">${esc(row.era)}</span>
                  <h2>${esc(row.title)}</h2>
                  <p>${esc(row.lede)}</p>
                </a>
              </li>`).join('')}
          </ol>` : ''}
        <p class="actions"><a class="link" href="#/path">转轴</a> · <a class="link" href="#/lanes">对照</a></p>`;
    }
    const byYear = new Map();
    for (const row of rows) {
      const year = row.calendar?.status === 'conflict'
        ? '日期待核'
        : String(row['公历下界'] || '').slice(0, 4) || '未系年';
      const list = byYear.get(year) || [];
      list.push(row);
      byYear.set(year, list);
    }
    return `
      <div class="reading">
        <p class="kicker">${esc(era)}大事记</p>
        <h1>系年可考的 ${rows.length} 件</h1>
        <p class="lede">只收已经打开的官书条。冲突年写成两说，不择一。</p>
        <p class="crumb"><a class="link" href="#/${esc(slug || 'kangxi')}">${esc(era)}朝</a></p>
      </div>
      ${[...byYear.entries()].map(([year, list]) => `
        <section class="chronicle-year">
          <h2>${esc(year)}</h2>
          <div class="chronicle-list">${list.map(chronicleItem).join('')}</div>
        </section>`).join('')}
    `;
  }

  function reignThreadItem(year, href, title, lede) {
    return `<li><a class="thread" href="${esc(href)}">
      <span class="thread-year">${esc(year)}</span>
      <h2>${esc(title)}</h2>
      <p>${esc(lede || '')}</p>
    </a></li>`;
  }

  function reignEventsBlock(emperor) {
    const era = String(emperor['年号或通称'] || '').split('；')[0];
    const slug = emperor.eraSlug || '';
    const chapters = eraChapters(era);
    // 年表已经排进上面的时间线，章目里不再重复列一次；入口在时间线上方。
    const spineSlugs = new Set((DATA.reignTimeline || []).map((row) => row.chapter_slug));
    const reads = chapters.filter((row) => chapterGenre(row) === '章');
    const extras = chapters.filter((row) => chapterGenre(row) !== '章' && !spineSlugs.has(row.slug));
    const seen = new Set(chapters.map((row) => `#/chapter/${row.slug}`));
    const tools = [];
    if (era === '康熙') {
      tools.push(
        { year: '胤礽', href: '#/person/QH-P-000004', title: '胤礽', lede: '两岁被立，三十五岁再废。中间废过一次，又立过一次。' },
        { year: '后妃', href: '#/empresses', title: '康熙四后', lede: '活着的时候是妃、是后、是太后，孝恭两个字是死后才有的。' },
        { year: '皇子', href: '#/princes', title: '康熙的儿子', lede: '表上第一子是胤禔，但后妃传说承瑞才是长子。' },
        { year: '皇女', href: '#/princesses', title: '康熙的女儿', lede: '亲生二十人，受封八人；固伦若是追进，人已经不在了。' },
        { year: '对照', href: '#/lanes', title: '野史与官书', lede: '改诏、畅春园、后宫。通行说法和已经打开的官书放在一起。' },
      );
    } else if (era === '雍正') {
      tools.push(
        { year: '对照', href: '#/lanes', title: '改诏、丹药、吕四娘', lede: '通行说法和官书原文放在一起，看差在哪里。' },
      );
    }
    for (const row of ERA_PINNED[slug] || []) {
      if (seen.has(row.href) || tools.some((item) => item.href === row.href)) continue;
      tools.push({ year: row.year, href: row.href, title: row.title, text: row.text });
    }
    const items = [
      ...reads.map((row) => ({ year: row.era, href: `#/chapter/${row.slug}`, title: row.title, lede: row.lede })),
      ...extras.map((row) => ({ year: '资料', href: `#/chapter/${row.slug}`, title: row.title, lede: row.lede })),
      ...tools.map((item) => ({ year: item.year, href: item.href, title: item.title, lede: item.lede ?? item.text })),
    ];
    const deduped = [];
    const hrefs = new Set();
    for (const item of items) {
      if (hrefs.has(item.href)) continue;
      hrefs.add(item.href);
      deduped.push(item);
    }
    if (!deduped.length) return '<p class="empty">这一朝还没有可读的章。</p>';
    return `
      <h3 class="reign-sub">本朝章目</h3><ol class="threads">${deduped.map((item) => reignThreadItem(item.year, item.href, item.title, item.lede)).join('')}</ol>
    `;
  }

  function splitIds(value) {
    return String(value || '').split(/[；;]/).map((item) => item.trim()).filter(Boolean);
  }

  function sortedSites() {
    return sortSites(DATA.sites);
  }

  function featuredSites() {
    return pickFeaturedSites(DATA.sites);
  }

  function siteImg(src, alt) {
    return imgTag(src, alt, {
      width: 960,
      height: 540,
      onerror: true,
      sizes: '(max-width: 600px) 100vw, (max-width: 960px) 45vw, 420px',
      lightbox: alt,
    });
  }

  function sitesForEmperor(emperorId) {
    return sortedSites().filter((site) => splitIds(site['相关皇帝ID']).includes(emperorId));
  }

  const SITE_CATEGORIES = [
    { label: '全部', test: () => true },
    { label: '关外发祥与入关', test: (s) => /萨尔浒|赫图阿拉|沈阳故宫|永陵|福陵|昭陵|宁远|山海关|扬州十日/.test(s['事件']) },
    { label: '中枢宫苑与理政', test: (s) => /避暑山庄|圆明园|畅春园|养心殿|九州清晏|烟波致爽|瀛台|军机处|咸安宫|直隶总督|江宁织造|天宁寺|马戛尔尼/.test(s['事件'] + s['今日']) },
    { label: '要塞疆土与征战', test: (s) => /萨尔浒|宁远|山海关|雅克萨|乌兰布统|多伦会盟|木兰围场|大沽口|虎门炮台|威海卫/.test(s['事件']) },
    { label: '近代条约与变局', test: (s) => /虎门销烟|南京条约|香港岛|天津教案|金田起义|辛酉政变|大沽口|威海卫|东交民巷|武昌起义|伪满/.test(s['事件']) },
    { label: '关内外皇陵', test: (s) => /陵/.test(s['事件']) },
  ];

  function sitesPage(query = {}) {
    const activeCat = query.cat || '全部';
    const cat = SITE_CATEGORIES.find((c) => c.label === activeCat) || SITE_CATEGORIES[0];
    const allRows = sortedSites();
    const rows = allRows.filter((row) => cat.test(row));
    return `
      <div class="reading page-intro">
        <p class="kicker">遗址今况</p>
        <h1>清代历史地景今貌</h1>
        <p class="lede">每一处遗址今况，都对应一段当时的记录。照片是今貌，不是历史现场。全库已收录 <strong>${allRows.length}</strong> 处关键历史地景，可按经纬度定位，与今昔记载对照。</p>
        ${crumbs([{ href: '#/', label: '十二帝' }, { href: '#/material', label: '材料' }, { label: '遗址今况' }])}
      </div>
      <div class="filters era-tab-bar site-filters" style="margin-bottom: 28px;" aria-label="地景分类">
        ${SITE_CATEGORIES.map((item) => `<a href="#/sites?cat=${encodeURIComponent(item.label)}" class="era-tab-item${item.label === activeCat ? ' active' : ''}">${esc(item.label)} <i>${allRows.filter((r) => item.test(r)).length}</i></a>`).join('')}
      </div>
      ${sitesMapSvg(rows)}
      <div class="grid cards site-cards">${rows.map(siteCard).join('')}</div>
    `;
  }

  function relatedSites(site) {
    const emperorIds = new Set(splitIds(site['相关皇帝ID']));
    const pool = featuredSites().filter((row) => row.site_id !== site.site_id);
    const same = pool.filter((row) => splitIds(row['相关皇帝ID']).some((id) => emperorIds.has(id)));
    return (same.length ? same : pool).slice(0, 3);
  }

  function sitePage(id) {
    const site = (DATA.sites || []).find((row) => row.site_id === id);
    if (!site) return `<h1>未找到遗址今况 ${esc(id)}</h1><p><a href="#/">← 首页</a></p>`;
    const emperors = splitIds(site['相关皇帝ID']).map((emperorId) => emperorByLegacy.get(emperorId)).filter(Boolean);
    const others = relatedSites(site);
    const hook = site['卡片钩子'] || site['事件'];
    return `
      <div class="site-page-shell">
        <p class="kicker">${esc(siteEraLabel(site))} · ${esc(site['事件'])}</p>
        <h1 class="site-page-title">${esc(hook)}</h1>
        ${crumbs([
          { href: '#/', label: '十二帝' },
          { href: '#/sites', label: '遗址今况' },
          { label: hook },
        ])}
        <div class="image-meta-actions">
          <a class="link" href="#/site/${esc(id)}">分享本页</a>
        </div>
        <div class="dossier image-dossier site-page">
          <figure class="portrait large site-hero">
            ${canEmbedSite(site) ? siteImg(site['预览文件'], hook) : '<div class="img-fallback">暂无实景照片</div>'}
            <figcaption class="portrait-caption">
              <p class="muted">${esc(site['作者或摄影者'] || '')}${site['制作年代或摄影日期'] ? ` · ${esc(site['制作年代或摄影日期'])}` : ''} · ${esc(site['文件页标示许可'] || '')}</p>
            </figcaption>
          </figure>
          <div class="site-info-col">
            <h2>当时</h2>
            <p>${esc(site['当时'])}</p>
            <h2>今日</h2>
            <p>${esc(site['今日'])}</p>
            <h2>今昔考辨</h2>
            <p>${esc(site['今地说明'])}</p>
            ${(site['经度'] && site['纬度']) ? `<dl class="kv">
              <dt>坐标</dt><dd>${esc(site['经度'])}°E, ${esc(site['纬度'])}°N · WGS84</dd>
            </dl>` : ''}
            ${emperors.length ? `<dl class="kv">
              <dt>相关</dt><dd>${emperors.map((emperor) => `<a href="${esc(emperor.eraSlug ? `#/${emperor.eraSlug}` : `#/person/${emperor.person_id}`)}">${esc(emperor['年号或通称'].split('；')[0])}</a>`).join(' · ')}</dd>
            </dl>` : ''}
            <div class="actions">
              <a class="btn" href="#/sites">全部遗址今况</a>
              ${emperors.length ? `<a class="btn" href="${esc(emperors[0].eraSlug ? `#/${emperors[0].eraSlug}` : `#/person/${emperors[0].person_id}`)}">相关朝代</a>` : ''}
              ${safeUrl(site['文件页']) ? `<a class="btn primary" href="${esc(safeUrl(site['文件页']))}" target="_blank" rel="noopener">${esc(sourcePageLabel(site))} ↗</a>` : ''}
            </div>
          </div>
        </div>
        ${(SITE_DETAILS[id] || []).length ? (() => {
          const items = SITE_DETAILS[id];
          const sec = items.find(d => d._section) || {};
          const cards = items.filter(d => !d._section);
          return cards.length ? `
          <section class="site-details-section">
            <div class="section-head">
              <h2>${esc(sec.title || '建筑规制与细节特写')}</h2>
              <p class="muted">${esc(sec.desc || '历史现场的规制、石雕与遗址细节。')}</p>
            </div>
            <div class="site-details-grid">
              ${cards.map((d) => `
                <figure class="site-detail-card">
                  <div class="site-detail-pic">
                    ${imgTag(d.preview, d.title, { width: 640, height: 480, lightbox: d.title })}
                  </div>
                  <figcaption class="site-detail-caption">
                    <span class="detail-tag">${esc(d.tag)}</span>
                    <strong class="detail-title">${esc(d.title)}</strong>
                    <p class="detail-desc">${esc(d.caption)}</p>
                  </figcaption>
                </figure>
              `).join('')}
            </div>
          </section>` : '';
        })() : ''}
        ${others.length ? `
          <section class="site-siblings-section">
            <div class="section-head">
              <h2>别处遗址今况</h2>
              <p class="muted">与本条相关的清代历史地景与遗址。</p>
            </div>
            <div class="grid cards site-cards">${others.map(siteCard).join('')}</div>
          </section>` : ''}
      </div>
    `;
  }

  function peoplePage(query) {
    const group = query.group || '全部';
    const groups = ['全部', ...new Set(DATA.people.map((row) => row['分组']))];
    const rows = DATA.people.filter((row) => group === '全部' || row['分组'] === group);
    return `
      <div class="page-head">
        <h1>人物异名</h1>
      </div>
      <p class="lede">雍正、胤禛、世宗，是同一个人。</p>
      ${crumbs([{ href: '#/', label: '十二帝' }, { label: '人物' }])}
      <div class="filters">
        ${groups.map((item) => `<button type="button" data-filter="${esc(item)}" class="${item === group ? 'on' : ''}" aria-pressed="${item === group}">${esc(item)}</button>`).join('')}
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>名</th><th>也称为</th><th>身份</th></tr></thead>
          <tbody>
            ${rows.map((row) => `
              <tr data-href="#/person/${esc(row.person_id)}">
                <td><a href="#/person/${esc(row.person_id)}">${esc(row['规范名'].replace(/^爱新觉罗·/, ''))}</a></td>
                <td>${esc(row['常用名或异名'])}</td>
                <td>${esc(row['人物类型'])}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }


  function externalAlign(person) {
    if (!person) return null;
    const qid = String(person.wikidata_qid || '').trim();
    const cbdb = String(person.cbdb_id || '').trim();
    const ctext = String(person.ctext_entity || '').trim();
    if (!qid && !cbdb && !ctext) return null;
    return { qid, cbdb, ctext };
  }

  function externalAlignChips(person) {
    const ids = externalAlign(person);
    if (!ids) return '';
    const chips = [];
    if (ids.qid) {
      chips.push(`<a class="chip-link" href="${esc(safeUrl(`https://www.wikidata.org/wiki/${ids.qid}`))}" target="_blank" rel="noopener">Wikidata ${esc(ids.qid)} ↗</a>`);
    }
    if (ids.cbdb) {
      chips.push(`<a class="chip-link" href="${esc(safeUrl(`https://cbdb.fas.harvard.edu/cbdbapi/person.php?id=${Number(ids.cbdb)}`))}" target="_blank" rel="noopener">CBDB ${esc(ids.cbdb)} ↗</a>`);
    }
    if (ids.ctext) {
      chips.push(`<a class="chip-link" href="${esc(safeUrl(`https://ctext.org/datawiki.pl?if=gb&res=${ids.ctext}`))}" target="_blank" rel="noopener">ctext ${esc(ids.ctext)} ↗</a>`);
    }
    return chips.join('');
  }

  function externalAlignNote(person) {
    const ids = externalAlign(person);
    if (!ids) return '';
    return ids.cbdb
      ? '<p class="muted">这些是其他人名库里的同一人。CBDB 只作对照，不是本页依据。</p>'
      : '<p class="muted">这些是其他人名库里的同一人。</p>';
  }

  function externalAlignBlock(person) {
    const chips = externalAlignChips(person);
    if (!chips) return '';
    return `<div class="external-align">${externalAlignNote(person)}<p class="actions">${chips}</p></div>`;
  }

  function emperorPage(emperor) {
    const id = emperor.person_id;
    const card = emperor.card;
    const portrait = emperor.portrait || primaryPortrait(emperor.emperor_id);
    const visuals = (emperor.portraits || portraitsByEmperor.get(emperor.emperor_id) || []).filter(visualGroup);
    const read = EMPEROR_READS[id] || {};
    const father = emperor['父亲'] || '';
    const mother = emperor['母亲'] || '';
    const era = emperor['年号或通称'].split('；')[0];
    const eras = String(emperor['年号或通称'] || '').split('；').map((s) => s.trim()).filter(Boolean);
    const temple = String(emperor['庙号'] || '').trim();
    const posthumous = String(emperor['谥号'] || '').trim();
    const { born, died, from, to, reign } = yearSpan(emperor);
    const hook = EMPEROR_CARD[id]?.hook || read?.lede || '';
    const frame = PORTRAIT_FRAMING[emperor.emperor_id];
    const frameStyle = frame ? ` style="--pic-z:${frame.z};--pic-y:${frame.y}%"` : '';
    const alt = portrait?.['对象标题'] || `${era}朝服像`;

    const idRow = (label, value, attrs = '') => (
      `<div class="card-id-row"><dt>${esc(label)}</dt><dd${attrs}>${value}</dd></div>`
    );

    const img = canEmbed(portrait)
      ? imgTag(portrait['预览文件'], alt, {
        width: 600,
        height: 800,
        sizes: '(max-width: 600px) 92vw, 360px',
        eager: true,
      })
      : '<div class="img-fallback">暂无肖像</div>';

    // 帝系承继：上承何朝、下启何朝，按 emperors 表序推
    const allEmperors = DATA.emperors || [];
    const selfIdx = allEmperors.findIndex((row) => row.person_id === id);
    const succNav = (row, dir) => {
      if (!row) return '<span></span>';
      const rowEra = String(row['年号或通称'] || '').split('；')[0].trim();
      const href = row.eraSlug ? `#/${esc(row.eraSlug)}` : `#/person/${esc(row.person_id)}`;
      const label = dir < 0 ? `上承 ${rowEra}` : `下启 ${rowEra}`;
      return `<a class="succ-link" href="${href}">${dir < 0 ? '←' : ''} ${esc(label)} ${dir > 0 ? '→' : ''}</a>`;
    };
    const succStrip = selfIdx >= 0 ? `
        <nav class="succ-strip" aria-label="帝系承继">
          ${succNav(allEmperors[selfIdx - 1], -1)}
          <span class="succ-node"><span class="succ-node-seal" aria-hidden="true">${esc(era)}</span><span class="succ-node-name">${esc(era)}</span></span>
          ${succNav(allEmperors[selfIdx + 1], 1)}
        </nav>` : '';

    return `
      <div class="era-shell emperor-page">
        <!-- 帝容与生平大卡 -->
        <article class="era-hero-panel card">
          <div class="era-hero-pic-wrap">
            <a class="card-pic era-hero-pic"${frameStyle} href="#/image/${esc(portrait?.visual_id || '')}" aria-label="${esc(alt)}">
              ${img}
              ${era ? `<span class="pic-seal" aria-hidden="true">${esc(era)}</span>` : ''}
            </a>
            ${portrait?.['制作年代或摄影日期'] || portrait?.['作者或摄影者'] ? `<p class="era-pic-caption muted">${esc([portrait['对象标题'], portrait['制作年代或摄影日期'], portrait['作者或摄影者']].filter(Boolean).join(' · '))}</p>` : ''}
          </div>
          <div class="era-hero-meta">
            <div class="era-hero-header">
              <p class="kicker">清朝 · 帝王</p>
              <div class="era-title-row">
                <h1 class="era-hero-title">${esc(eras.join(' · '))}</h1>
                <span class="era-hero-tag">${esc(temple || '帝王')}</span>
              </div>
              ${crumbs([
                { href: '#/', label: '十二帝' },
              ])}
            </div>

            <dl class="card-ids era-hero-ids">
              ${idRow('名', esc(emperor['规范名'] || '') + (emperor['皇子序'] ? `<span class="card-id-sub">（${esc(emperor['皇子序'])}）</span>` : ''))}
              ${idRow('庙号', temple ? esc(temple) : '<span class="card-id-none">无，清亡未上</span>')}
              ${idRow('谥号', posthumous ? `<span class="card-id-shi">${esc(posthumous)}</span>` : '<span class="card-id-none">无，清亡未上</span>')}
              ${born && died ? idRow('生卒', `${born} 年–${died} 年${Number(died) && Number(born) ? ` · ${Number(died) - Number(born) + 1} 岁` : ''}`) : ''}
              ${from && to ? idRow('在位', `${from} 年–${to} 年${reign ? ` · 共 ${reign} 年` : ''}`) : ''}
              ${father ? idRow('父', esc(father)) : ''}
              ${mother ? idRow('母', esc(mother)) : ''}
              ${emperor['陵寝'] ? idRow('葬', esc(emperor['陵寝'])) : ''}
            </dl>

            ${hook ? `<p class="card-hook-line era-hero-hook">${esc(hook)}</p>` : ''}

            <div class="era-hero-actions">
              ${emperor['故宫人物页'] || card?.['故宫人物页'] ? `<a class="chip-link" href="${esc(safeUrl(emperor['故宫人物页'] || card['故宫人物页']))}" target="_blank" rel="noopener">故宫人物档案 ↗</a>` : ''}
              ${externalAlignChips(peopleById.get(id))}
              <a class="chip-link" href="#/person/${esc(id)}">分享本页</a>
            </div>
            ${externalAlignNote(peopleById.get(id))}
          </div>
        </article>

        <nav class="era-section-jump" aria-label="本朝内容">
          <button class="link" data-scroll="era-start">精选故事</button>
          <button class="link" data-scroll="era-life">生平与施政</button>
          <button class="link" data-scroll="era-events">本朝纪事</button>
          <button class="link" data-scroll="era-visuals">御容与器物</button>
          <button class="link" data-scroll="era-material">史料与遗址</button>
        </nav>

        <section class="era-start" id="era-start" aria-labelledby="era-start-title">
          <div class="reading-section-head"><div><p class="kicker">开卷</p><h2 id="era-start-title">读${esc(era)}，从这里开始</h2></div><a class="link" href="#/read">读故事目录 →</a></div>
          ${readingCards(selectReadingPicks(DATA.chapters, { era, limit: 6 }))}
        </section>

        <!-- 板块一：生平与施政 -->
        <section class="reign-section emperor-read era-section" data-reign-part="生平" id="era-life">
          <h2 class="reign-part section-title">生平与施政</h2>
          ${emperorPack(read, emperor)}
          ${(emperor.credibility?.claims || 0) === 0 ? noEvidenceBanner('尚无逐日官书条', '这一朝目前只有骨架，日子还对不回去。') : ''}
        </section>

        <!-- 板块二：本朝纪事（时间线 + 本朝章目） -->
        <section id="era-events" class="reign-section era-events-section era-section" data-reign-part="大事">
          <h2 class="reign-part section-title">本朝纪事</h2>
          <p class="section-sub muted">系年可考的条目按时间排下来；专题长文在本朝章目里</p>
          ${eraTimelineLinks(emperor)}
          ${eraTimelineBlock(emperor)}
          ${reignEventsBlock(emperor)}
        </section>

        <!-- 板块三：御容与器物 -->
        <section class="reign-section reign-visual era-section" data-reign-part="像与物" id="era-visuals">
          <h2 class="reign-part section-title">御容与器物</h2>
          <p class="section-sub muted">朝服像、行乐图、御笔朱批与旧藏器物</p>
          ${visuals.length
            ? `<div class="grid cards visual-grid thumbs-row">${visuals.map((row) => visualGalleryCard(row)).join('')}</div>
               <p class="section-actions actions"><a class="link" href="#/hands?era=${encodeURIComponent(era)}">全部像与物 ${visuals.length} 件</a></p>`
            : '<p class="empty">这一朝的像与物尚未收录。</p>'}
        </section>

        <!-- 板块四：史料与遗址 -->
        <section id="era-material" class="reign-section era-heritage-section era-section" data-reign-part="史料">
          <h2 class="reign-part section-title">史料与遗址</h2>
          <p class="section-sub muted">遗址今况与专题文献</p>
          ${reignTail(era)}
        </section>

        ${succStrip}
      </div>
    `;
  }

  function personPortraitBlock(id) {
    const row = (DATA.personPortraits || []).find((r) => r.person_id === id);
    if (!row) return '';
    return `
      <figure class="person-portrait">
        ${mediaImg(row['预览文件'], row['对象标题'], row['对象标题'])}
        <figcaption class="muted">${esc(row['对象标题'])} · ${esc(row['图像性质'])} · ${esc(row['作者或摄影者'] || '')}${row['制作年代'] ? ' · ' + esc(row['制作年代']) : ''} · <a class="link" href="${esc(safeUrl(row['文件页']))}" target="_blank" rel="noopener">来源</a>（${esc(row['许可'])}）</figcaption>
      </figure>
    `;
  }

  function personPage(id) {
    const emperor = emperorByPerson.get(id);
    if (emperor) return emperorPage(emperor);
    const person = peopleById.get(id);
    if (!person) return `<h1>未找到 ${esc(id)}</h1><p>该编号尚未建立人物条目。</p>`;
    const claims = DATA.claims.filter((row) => row['主体 ID'] === id || row['客体 ID 或值'] === id);
    const yinreng = id === 'QH-P-000004';
    const heshen = id === 'QH-P-000124';

    // 固定骨架：这一页分几块、每块多少条，进页就能看见。
    // 原先「储位/称号/依据/对照」是四种不同层级的标记，滚下去看不出结构。
    const sections = [];
    const intro = [
      yinreng ? `<p class="lede">嫡子，两岁立为太子，做了三十三年。经历了废黜、复立、再废，而拘执、颁诏、告祭都不是同一天。</p>
        <details class="evidence-drawer"><summary>史料说明</summary><p>实录在再废当日记拘执与废黜；咸安宫地名见于后出的本纪和列传，不应把不同层次的记载合成同一日的现场纪录。</p></details>
        <p class="actions"><a class="link" href="#/chapter/kangxi-02">两废太子</a> · <a class="link" href="#/succession">分日全链</a></p>` : '',
      heshen ? `<p class="lede">太上皇崩后第五天下狱，第十五日赐死。二十条是上谕列罪，不是抄家清册。</p>
        <details class="evidence-drawer"><summary>史料说明</summary><p>《清史稿》卷16分日；卷319转录二十大罪。已打开的列传没有「八亿两」这一总数。</p></details>
        <p class="actions"><a class="link" href="#/chapter/jiaqing-04">读分日</a> · <a class="link" href="#/lane/QH-L-0032">对照通行说法</a></p>` : '',
      princeCard(id),
      princessCard(id),
    ].filter(Boolean).join('');
    if (intro) sections.push({ id: 'p-intro', title: '这个人', count: '', body: intro });

    const heirRows = heirEventsFor(id);
    if (heirRows.length) sections.push({
      id: 'p-heir', title: '储位', count: `${heirRows.length} 条`,
      body: `${heirList(heirRows)}<p class="actions"><a class="link" href="#/succession">读全链</a></p>`,
    });

    const empressRows = empressEventsFor(id);
    if (empressRows.length) sections.push({
      id: 'p-title', title: '称号', count: `${empressRows.length} 条`,
      body: `${timelineList(empressRows)}<p class="actions"><a class="link" href="#/empresses">四后全轴</a></p>`,
    });

    const mentions = (DATA.personMentions || []).filter((row) => row.person_id === id);
    if (mentions.length) sections.push({
      id: 'p-mention', title: '出场',
      count: `${mentions.length} 处 · ${new Set(mentions.map((row) => row.chapter_slug)).size} 篇`,
      body: mentionGroups(mentions),
    });

    const lanes = lanesForPerson(id);
    if (lanes.length) sections.push({
      id: 'p-lane', title: '对照', count: `${lanes.length} 条`,
      body: lanes.map(laneCard).join(''),
    });

    if (claims.length) sections.push({
      id: 'p-claim', title: '依据', count: `${claims.length} 条`,
      body: `<p class="muted">这个人名下的原文出处，按库中顺序。</p>${claims.map(claimCard).join('')}`,
    });

    return `
      <p class="kicker">${esc(person['人物类型'] || '人物')}</p>
      <h1>${esc(person['规范名'].replace(/^爱新觉罗·/, ''))}</h1>
      <p class="lede">${esc(person['常用名或异名'] || '')}</p>
      ${crumbs([
        { href: '#/', label: '十二帝' },
        { href: '#/people', label: '人物' },
        { label: person['规范名'].replace(/^爱新觉罗·/, '') },
      ])}
      <p class="crumb crumb-share"><a class="link" href="#/person/${esc(id)}">分享本页</a></p>
      ${externalAlignBlock(person)}
      ${personPortraitBlock(id)}
      ${sections.length > 1 ? `<nav class="chapter-toc" aria-label="本页目录">
        <p class="toc-label">本页分 ${sections.length} 块</p>
        <ol>${sections.map((sec) => `<li><button type="button" class="link" data-scroll="${sec.id}">${esc(sec.title)}${sec.count ? ` <span class="muted">${esc(sec.count)}</span>` : ''}</button></li>`).join('')}</ol>
      </nav>` : ''}
      <div class="reading">
        ${sections.map((sec) => `
          <section class="person-section">
            <h2 id="${sec.id}">${esc(sec.title)}${sec.count ? ` <span class="muted">${esc(sec.count)}</span>` : ''}</h2>
            ${sec.body}
          </section>`).join('')}
      </div>
    `;
  }


  function empressEventsFor(id) {
    const rows = DATA.empressTimeline || [];
    if (id === 'QH-P-000001') return rows;
    return rows.filter((row) => row.person_id === id);
  }

  function timelineList(rows) {
    const sorted = [...rows].sort((a, b) => String(a['排序键'] || '').localeCompare(String(b['排序键'] || '')));
    return `
      <ol class="timeline">
        ${sorted.map((row) => `
          <li>
            <div class="when">
              <strong>${esc(row['原纪年'])}</strong>
              <span class="muted">${esc(calendarDate(row))}</span>
            </div>
            <div class="what">
              <p class="event-line">${personLink(row.person_id)} ${esc(row['当时称号'])} · ${esc(row['事件类型'])} ${evidenceMark(row['公开证据状态'])}${row['冲突组 ID'] ? ' <span class="mark two">两说并存</span>' : ''}</p>
              <p class="quote">「${esc(row['引文'])}」</p>
              ${row['主张 ID'] ? `<p class="actions"><button class="link" data-claim="${esc(row['主张 ID'])}">依据</button></p>` : ''}
            </div>
          </li>`).join('')}
      </ol>`;
  }

  const YZ_EMPRESS_IDS = ['QH-P-000036', 'QH-P-000037', 'QH-P-000038', 'QH-P-000039', 'QH-P-000040', 'QH-P-000134', 'QH-P-000135'];

  function empressesPage(query) {
    const era = tableEra(query);
    const yongzheng = era === 'yongzheng';
    const ids = yongzheng ? YZ_EMPRESS_IDS : EMPRESS_IDS;
    const person = query.person || '全部';
    const rows = (DATA.empressTimeline || []).filter((row) => {
      if (!ids.includes(row.person_id) && !(yongzheng && YZ_EMPRESS_IDS.includes(row.person_id))) return false;
      if (!ids.includes(row.person_id)) return false;
      return person === '全部' || row.person_id === person;
    });
    const filters = ['全部', ...ids];
    return `
      <div class="reading page-intro">
        <p class="kicker">后妃</p>
        <h1>${yongzheng ? '雍正后妃' : '康熙四后'}</h1>
        <p class="lede">${yongzheng
          ? '潜邸是嫡福晋、侧福晋、格格。皇后、贵妃、谦妃，是后来的号。'
          : '活着的时候是妃、是后、是太后，孝诚、孝昭、孝懿、孝恭都是死后才加上去的。孝恭在康熙朝不是皇后。'}</p>
        <p class="warn">${yongzheng
          ? '时态称号按后妃传原文。谦妃子作弘適，世表作弘曕，不择一。'
          : '赫舍里氏册后，后妃传记四年七月，本纪记四年九月辛卯。两说都在，不抹平。'}</p>
        ${crumbs([
          { href: '#/', label: '十二帝' },
          { href: yongzheng ? '#/yongzheng' : '#/kangxi', label: yongzheng ? '雍正朝' : '康熙朝' },
          { label: yongzheng ? '后妃' : '康熙四后' },
        ])}
      </div>
      <div class="filters era-tab-bar" aria-label="朝代切换">
        <button type="button" data-empress-era="kangxi" class="era-tab-item ${yongzheng ? '' : 'active on'}" aria-pressed="${yongzheng ? 'false' : 'true'}">康熙朝</button>
        <button type="button" data-empress-era="yongzheng" class="era-tab-item ${yongzheng ? 'active on' : ''}" aria-pressed="${yongzheng ? 'true' : 'false'}">雍正朝</button>
      </div>
      <div class="filters era-tab-bar" style="margin-top: -12px;" aria-label="后妃筛选">
        ${filters.map((item) => {
          const label = item === '全部' ? (yongzheng ? '全轴' : '四人全轴') : personName(item);
          return `<button type="button" data-empress="${esc(item)}" class="era-tab-item ${item === person ? 'active on' : ''}" aria-pressed="${item === person}">${esc(label)}</button>`;
        }).join('')}
      </div>
      ${timelineList(rows)}
      <p class="actions"><a class="link" href="#/claims">相关主张</a> · <a class="link" href="#/lanes">对照</a></p>
    `;
  }

  function tableEra(query) {
    return query.era === 'yongzheng' ? 'yongzheng' : 'kangxi';
  }

  function eraHref(base, query, extra) {
    const params = new URLSearchParams();
    if (tableEra(query) === 'yongzheng') params.set('era', 'yongzheng');
    Object.entries(extra || {}).forEach(([key, value]) => {
      if (value && value !== '全部') params.set(key, value);
    });
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  function princesForEra(era) {
    const father = era === 'yongzheng' ? 'QH-P-000002' : 'QH-P-000001';
    return (DATA.princes || []).filter((row) => row['父亲ID'] === father);
  }

  function princessesForEra(era) {
    if (era === 'yongzheng') {
      return (DATA.princesses || []).filter((row) => (
        row['父亲ID'] === 'QH-P-000002' || String(row['表序标签'] || '').startsWith('世宗抚')
      ));
    }
    return (DATA.princesses || []).filter((row) => (
      row['父亲ID'] === 'QH-P-000001' || row.person_id === 'QH-P-000123'
    ));
  }

  function princeById(id) {
    return (DATA.princes || []).find((row) => row.person_id === id) || null;
  }

  function princeCard(id) {
    const row = princeById(id);
    if (!row && id !== 'QH-P-000001' && id !== 'QH-P-000002') return '';
    if (id === 'QH-P-000001') {
      const n = princesForEra('kangxi').length;
      return `<h2>皇子</h2>
        <p class="thread-lead">表序不是玉牒，第四子不在《清史稿》圣祖系这一卷，早殇另列。现有 ${n} 行。</p>
        <p class="actions"><a class="link" href="#/princes">全表</a></p>`;
    }
    if (id === 'QH-P-000002') {
      return `<h2>皇子</h2>
        <p class="thread-lead">卷165缺第四子弘历。表序不是玉牒。</p>
        <p class="actions"><a class="link" href="#/princes?era=yongzheng">雍正皇子表</a></p>`;
    }
    const era = row['父亲ID'] === 'QH-P-000002' ? 'yongzheng' : 'kangxi';
    return `
      <h2>在皇子表里</h2>
      <p class="rel">${esc(row['表序标签'])} · ${esc(row['收录状态'])}${row['冲突组 ID'] ? ' · 两说并存' : ''}</p>
      <p class="quote">「${esc(row['世表摘要'] || row['后妃传子女句'])}」</p>
      <p class="gloss">生母候选：${row['生母人物ID'] ? personLink(row['生母人物ID']) : esc(row['生母候选名'] || '未详')}。</p>
      <p class="actions"><a class="link" href="${era === 'yongzheng' ? '#/princes?era=yongzheng' : '#/princes'}">全表</a></p>`;
  }

  function princeLineageView(rows) {
    const statusGroups = [
      { key: '入序正文', label: '入序正文', hint: '清史稿世表入序之皇子' },
      { key: '本卷缺号', label: '本卷缺号', hint: '承嗣大统或列入其他世系之皇子' },
      { key: '早薨附列', label: '早薨附列', hint: '幼年殇逝未入齿序之皇子' },
    ];
    return `
      <div class="lineage-tree">
        ${statusGroups.map((g) => {
          const items = rows.filter((r) => r['收录状态'] === g.key);
          if (!items.length) return '';
          return `
            <section class="lineage-branch">
              <h3 class="lineage-branch-title">${esc(g.label)} <span class="muted">（${items.length} 位 · ${esc(g.hint)}）</span></h3>
              <div class="lineage-grid">
                ${items.map((row) => `
                  <article class="lineage-card" data-href="#/person/${esc(row.person_id)}">
                    <div class="lineage-card-top">
                      <span class="lineage-badge">${esc(row['表序'] || row['收录状态'])}</span>
                      <a class="lineage-title" href="#/person/${esc(row.person_id)}">${esc(row['规范名'].replace(/^爱新觉罗·/, ''))}</a>
                    </div>
                    <p class="lineage-mother">生母：${row['生母人物ID'] ? personLink(row['生母人物ID']) : esc(row['生母候选名'] || '未详')}</p>
                    <p class="lineage-summary">${esc(row['世表摘要'] || '')}</p>
                  </article>
                `).join('')}
              </div>
            </section>`;
        }).join('')}
      </div>
    `;
  }

  function princesPage(query) {
    const era = tableEra(query);
    const status = query.status || '全部';
    const isTree = query.view === 'tree';
    const groups = ['全部', '入序正文', '本卷缺号', '早薨附列'];
    const rows = princesForEra(era).filter((row) => status === '全部' || row['收录状态'] === status);
    const yongzheng = era === 'yongzheng';
    return `
      <div class="reading page-intro">
        <p class="kicker">皇子</p>
        <h1>${yongzheng ? '雍正的儿子' : '康熙的儿子'}</h1>
        <p class="lede">${yongzheng
          ? '表上没有第四子这一行，缺号的是弘历，弘时只写早薨，弘曕过继给了允礼。'
          : '表上第一子是胤禔，但后妃传说承瑞才是长子。第四子胤禛不在这一卷，但并非康熙没有这个儿子。'}</p>
        <p class="warn">${yongzheng
          ? '表序不是玉牒。后妃传弘適与世表弘曕是异写，不择一。'
          : '世表以胤禔为第一子；后妃传以承瑞为长子。早殇未入序，仍是儿子。'}</p>
        ${crumbs([
          { href: '#/', label: '十二帝' },
          { href: yongzheng ? '#/yongzheng' : '#/kangxi', label: yongzheng ? '雍正朝' : '康熙朝' },
          { label: yongzheng ? '雍正皇子' : '康熙皇子' },
        ])}
      </div>
      <div class="filters era-tab-bar" aria-label="朝代切换">
        <button type="button" data-prince-era="kangxi" class="era-tab-item ${yongzheng ? '' : 'active on'}" aria-pressed="${yongzheng ? 'false' : 'true'}">康熙</button>
        <button type="button" data-prince-era="yongzheng" class="era-tab-item ${yongzheng ? 'active on' : ''}" aria-pressed="${yongzheng ? 'true' : 'false'}">雍正</button>
      </div>
      <div class="filters era-tab-bar" style="margin-top: -12px;" aria-label="收录状态筛选">
        ${groups.map((item) => `<button type="button" data-prince="${esc(item)}" class="era-tab-item ${item === status ? 'active on' : ''}" aria-pressed="${item === status}">${esc(item)}</button>`).join('')}
      </div>
      <div class="filters view-filters">
        <button type="button" data-prince-view="table" class="${isTree ? '' : 'on'}" aria-pressed="${isTree ? 'false' : 'true'}">表格清单</button>
        <button type="button" data-prince-view="tree" class="${isTree ? 'on' : ''}" aria-pressed="${isTree ? 'true' : 'false'}">系谱概览</button>
      </div>
      ${isTree ? princeLineageView(rows) : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>表序</th><th>规范名</th><th>世表用名</th><th>收录</th><th>生母候选</th><th>世表摘要</th></tr></thead>
          <tbody>
            ${rows.map((row) => `
              <tr data-href="#/person/${esc(row.person_id)}">
                <td><a href="#/person/${esc(row.person_id)}">${esc(row['表序'] || '—')}</a></td>
                <td>${esc(row['规范名'].replace(/^爱新觉罗·/, ''))}</td>
                <td>${esc(row['世表用名'] || '本卷无行')}</td>
                <td>${esc(row['收录状态'])}</td>
                <td>${esc(row['生母候选名'] || '未详')}</td>
                <td>${esc(row['世表摘要'])}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`}
      <aside class="gap-card">
        <h2>玉牒未开</h2>
        <p>这张表来自《清史稿》世表。1921 年玉牒藏在一史馆，分满汉文本，但康雍那几册的卷页和合法核验路径仍不通。</p>
        <p>表序、长子、生母都还只是后出表的说法，不能当成玉牒已经核对过。入口见 <a class="link" href="#/works">文献</a>，问法见 <a class="link" href="#/question/QH-GQ-0057">玉牒里的自然顺序</a>。</p>
      </aside>
      <p class="actions"><a class="link" href="${yongzheng ? '#/empresses?era=yongzheng' : '#/empresses'}">后妃</a> · <a class="link" href="${yongzheng ? '#/princesses?era=yongzheng' : '#/princesses'}">皇女</a> · <a class="link" href="#/succession">储位</a></p>
    `;
  }

  function princessById(id) {
    return (DATA.princesses || []).find((row) => row.person_id === id) || null;
  }

  function princessCard(id) {
    const row = princessById(id);
    if (!row && id !== 'QH-P-000001') return '';
    if (id === 'QH-P-000001') {
      return `<h2>皇女</h2>
        <p class="thread-lead">表序不是玉牒，和硕、固伦的封号会变，常宁之女是抚育而非亲生第二十一女。</p>
        <p class="actions"><a class="link" href="#/princesses">全表</a></p>`;
    }
    return `
      <h2>在皇女表里</h2>
      <p class="rel">${esc(row['表序标签'])} · ${esc(row['收录状态'])}</p>
      <p class="quote">「${esc(row['封号摘要'] || row['生薨摘要'])}」</p>
      <p class="gloss">生母候选：${row['生母人物ID'] ? personLink(row['生母人物ID']) : esc(row['生母候选名'] || '未详')}。</p>
      <p class="actions"><a class="link" href="#/princesses">全表</a></p>`;
  }

  function princessLineageView(rows) {
    const statusGroups = [
      { key: '入序受封', label: '入序受封', hint: '亲生成年并受封固伦/和硕公主' },
      { key: '未封', label: '未封', hint: '亲生幼殇或未及受封' },
      { key: '抚育附列', label: '抚育附列', hint: '宗室王公之女入宫抚育' },
    ];
    return `
      <div class="lineage-tree">
        ${statusGroups.map((g) => {
          const items = rows.filter((r) => r['收录状态'] === g.key);
          if (!items.length) return '';
          return `
            <section class="lineage-branch">
              <h3 class="lineage-branch-title">${esc(g.label)} <span class="muted">（${items.length} 位 · ${esc(g.hint)}）</span></h3>
              <div class="lineage-grid">
                ${items.map((row) => `
                  <article class="lineage-card" data-href="#/person/${esc(row.person_id)}">
                    <div class="lineage-card-top">
                      <span class="lineage-badge">${esc(row['表序'] || row['收录状态'])}</span>
                      <a class="lineage-title" href="#/person/${esc(row.person_id)}">${esc(row['规范名'].replace(/^爱新觉罗氏/, ''))}</a>
                    </div>
                    <p class="lineage-mother">生母：${row['生母人物ID'] ? personLink(row['生母人物ID']) : esc(row['生母候选名'] || (row['收录状态'] === '抚育附列' ? '表未记生母' : '未详'))}</p>
                    <p class="lineage-summary">${row['封号摘要'] ? `<strong>封号：</strong>${esc(row['封号摘要'])}` : ''}${row['下嫁摘要'] ? ` · <strong>下嫁：</strong>${esc(row['下嫁摘要'])}` : ''}</p>
                  </article>
                `).join('')}
              </div>
            </section>`;
        }).join('')}
      </div>
    `;
  }

  function princessesPage(query) {
    const era = tableEra(query);
    const status = query.status || '全部';
    const isTree = query.view === 'tree';
    const groups = ['全部', '入序受封', '未封', '抚育附列'];
    const rows = princessesForEra(era).filter((row) => status === '全部' || row['收录状态'] === status);
    const yongzheng = era === 'yongzheng';
    return `
      <div class="reading page-intro">
        <p class="kicker">皇女</p>
        <h1>${yongzheng ? '雍正的女儿' : '康熙的女儿'}</h1>
        <p class="lede">${yongzheng
          ? '亲生四女，只有第二女长成，雍正元年追进和硕怀恪。三个抚育女不是亲生。'
          : '亲生二十人，受封八人。固伦若是追进，人已经不在了，常宁之女是抚育，不要算进这二十。'}</p>
        <p class="warn">${yongzheng
          ? '公主表在卷166，不在卷167；追进不是生前进封，表序也不是玉牒。'
          : '和硕、固伦是当时的封号，追进固伦时人已经薨了，表序也不是玉牒。'}</p>
        ${crumbs([
          { href: '#/', label: '十二帝' },
          { href: yongzheng ? '#/yongzheng' : '#/kangxi', label: yongzheng ? '雍正朝' : '康熙朝' },
          { label: yongzheng ? '雍正皇女' : '康熙皇女' },
        ])}
      </div>
      <div class="filters era-tab-bar" aria-label="朝代切换">
        <button type="button" data-princess-era="kangxi" class="era-tab-item ${yongzheng ? '' : 'active on'}" aria-pressed="${yongzheng ? 'false' : 'true'}">康熙</button>
        <button type="button" data-princess-era="yongzheng" class="era-tab-item ${yongzheng ? 'active on' : ''}" aria-pressed="${yongzheng ? 'true' : 'false'}">雍正</button>
      </div>
      <div class="filters era-tab-bar" style="margin-top: -12px;" aria-label="收录状态筛选">
        ${groups.map((item) => `<button type="button" data-princess="${esc(item)}" class="era-tab-item ${item === status ? 'active on' : ''}" aria-pressed="${item === status}">${esc(item)}</button>`).join('')}
      </div>
      <div class="filters view-filters">
        <button type="button" data-princess-view="table" class="${isTree ? '' : 'on'}" aria-pressed="${isTree ? 'false' : 'true'}">表格清单</button>
        <button type="button" data-princess-view="tree" class="${isTree ? 'on' : ''}" aria-pressed="${isTree ? 'true' : 'false'}">系谱概览</button>
      </div>
      ${isTree ? princessLineageView(rows) : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>表序</th><th>规范名</th><th>收录</th><th>生母候选</th><th>封号</th><th>下嫁</th></tr></thead>
          <tbody>
            ${rows.map((row) => `
              <tr data-href="#/person/${esc(row.person_id)}">
                <td><a href="#/person/${esc(row.person_id)}">${esc(row['表序'] || '—')}</a></td>
                <td>${esc(row['规范名'].replace(/^爱新觉罗氏/, ''))}</td>
                <td>${esc(row['收录状态'])}</td>
                <td>${esc(row['生母候选名'] || (row['收录状态'] === '抚育附列' ? '表未记生母' : '未详'))}</td>
                <td>${esc(row['封号摘要'])}</td>
                <td>${esc(row['下嫁摘要'] || '—')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`}
      <aside class="gap-card">
        <h2>玉牒未开</h2>
        <p>公主表也是后出的。生母、封号、抚育都不能拿这张表代替玉牒。</p>
        <p>阻塞是康雍卷册卷页与合法核验路径，不是不知道玉牒存在。入口见 <a class="link" href="#/works">文献</a>，问法见 <a class="link" href="#/question/QH-GQ-0064">玉牒里皇女的顺序</a>。</p>
      </aside>
      <p class="actions"><a class="link" href="${yongzheng ? '#/princes?era=yongzheng' : '#/princes'}">皇子</a> · <a class="link" href="${yongzheng ? '#/empresses?era=yongzheng' : '#/empresses'}">后妃</a> · <a class="link" href="${yongzheng ? '#/chapter/yongzheng-05' : '#/chapter/kangxi-08'}">读表说明</a></p>
    `;
  }

  function heirEventsFor(id) {
    const rows = DATA.heirChain || [];
    if (id === 'QH-P-000001') return rows;
    return rows.filter((row) => row.person_id === id || (row['相关人物ID'] || '').includes(id));
  }

  function eventSentence(row) {
    const who = personLink(row.person_id);
    const place = row['地点'] ? `于${esc(row['地点'])}` : '';
    switch (row['事件类型']) {
      case '择吉下谕': return `谕礼部以${who}为皇太子，选择吉期`;
      case '立储': return `${who}立为皇太子`;
      case '驻跸': return `${who}驻跸${place}`;
      case '宣示罪状拘执': return `${who}${place}被拘执`;
      case '废储颁示': return `${who}被废，颁诏天下`;
      case '削爵': return `${who}被削爵`;
      case '削爵幽禁': return `${who}被削爵幽禁`;
      case '奏保被杖': return `有人奏保${who}，被杖`;
      case '议储不许': return `廷臣请立${who}为储，不许`;
      case '释放': return `${who}被释放`;
      case '复立': return `${who}复立为皇太子`;
      case '再废锢禁': return `${who}再废${row['地点'] ? `，锢于${esc(row['地点'])}` : ''}`;
      case '告庙': return `${who}废储告庙`;
      case '上书请复立': return `有人上书请复立${who}`;
      case '薨逝': return `${who}薨`;
      case '上谕转述': return `上谕转述${who}之奏`;
      case '不豫回驻': return `${who}不豫${place ? `，回驻${place.replace(/^于/, '')}` : ''}`;
      case '口谕继位': return `口谕令${who}继位`;
      case '遗诏继位': return `遗诏令${who}继位`;
      case '崩逝': return `${who}崩${place}`;
      case '即位礼': return `${who}即皇帝位`;
      default: return `${who} ${esc(row['事件类型'])}`;
    }
  }

  function heirList(rows) {
    const sorted = [...rows].sort((a, b) => String(a['排序键'] || '').localeCompare(String(b['排序键'] || '')));
    return `
      <ol class="chronicle">
        ${sorted.map((row) => `
          <li>
            <div class="when">
              <strong>${esc(row['原纪年'])}</strong>
              <span class="muted">${esc(calendarDate(row))}</span>
            </div>
            <div class="what">
              <p class="event-line">${eventSentence(row)} ${evidenceMark(row['公开证据状态'])}${row['冲突组 ID'] ? ' <span class="mark two">两说并存</span>' : ''}</p>
              <p class="quote">「${esc(row['引文'])}」</p>
              <p class="actions">
                ${row['主张 ID'] ? `<button class="link" data-claim="${esc(row['主张 ID'])}">依据</button>` : ''}
                <a class="link" href="#/person/${esc(row.person_id)}">${esc(personName(row.person_id))}</a>
              </p>
            </div>
          </li>`).join('')}
      </ol>`;
  }


  // ==== 主题展 ====
  // 站点的两条老路（按朝代 / 按材料类型）都要求读者先知道自己想看什么。
  // 主题展是第三条入口：按一个问题进去。内容全在 qing-content.js 的 EXHIBITIONS，
  // 这里只负责把它渲染出来，不新增任何史实。
  function exhibitItem(item) {
    if (item.visual) {
      const portrait = portraitById.get(item.visual);
      if (!portrait) return '';
      const title = portrait['对象标题'] || item.visual;
      const meta = [portrait['制作年代或摄影日期'], portrait['作者或摄影者']].filter(Boolean).join(' · ');
      const thumb = canEmbed(portrait)
        ? mediaImg(portrait['预览文件'], title, title)
        : restrictedFallback(portrait);
      return `<li class="exhibit-item">
        <a class="exhibit-thumb" href="#/image/${esc(item.visual)}" aria-label="${esc(title)}">${thumb}</a>
        <div class="exhibit-body">
          <h3><a class="link" href="#/image/${esc(item.visual)}">${esc(title)}</a></h3>
          ${meta ? `<p class="exhibit-meta">${esc(meta)}</p>` : ''}
          <p>${esc(item.text)}</p>
        </div>
      </li>`;
    }
    if (item.event) {
      const row = (DATA.heirChain || []).find((r) => r.event_id === item.event);
      if (!row) return '';
      return `<li class="exhibit-item exhibit-item-text">
        <div class="exhibit-body">
          <p class="exhibit-when">${esc(row['原纪年'])}${row['地点'] ? ` · ${esc(row['地点'])}` : ''}${row['冲突组 ID'] ? ' <span class="mark two">两说并存</span>' : ''}</p>
          <p class="quote">「${esc(row['引文'])}」</p>
          <p>${esc(item.text)}</p>
          <p class="actions">
            ${row['主张 ID'] ? `<button class="link" data-claim="${esc(row['主张 ID'])}">依据</button>` : ''}
            <a class="link" href="#/person/${esc(row.person_id)}">${esc(personName(row.person_id))}</a>
          </p>
        </div>
      </li>`;
    }
    return '';
  }

  function exhibitCount(exhibition) {
    return (exhibition.sections || []).reduce((sum, section) => sum + section.items.length, 0);
  }

  function exhibitsPage() {
    return `
      <div class="reading page-intro">
        <p class="kicker">主题展</p>
        <h1>其他入口</h1>
        <p class="lede">不按朝代，也不按材料类型，按一个问题进去。每一条都还是库里原来那条记录，只是重新排过；没有新增史实。</p>
        ${crumbs([{ href: '#/', label: '十二帝' }, { label: '主题展' }])}
      </div>
      <div class="grid cards">
        ${EXHIBITIONS.map((exhibition) => {
    const first = exhibition.sections?.[0]?.items?.find((item) => item.visual);
    const cover = first ? portraitById.get(first.visual) : null;
    return `<article class="card exhibit-card">
          ${cover && canEmbed(cover) ? `<a class="card-pic" href="#/exhibit/${esc(exhibition.slug)}" aria-label="${esc(exhibition.title)}">${mediaImg(cover['预览文件'], cover['对象标题'], '')}</a>` : ''}
          <div class="meta">
            <p class="kicker">${esc(exhibition.kicker)}</p>
            <h2><a class="link" href="#/exhibit/${esc(exhibition.slug)}">${esc(exhibition.title)}</a></h2>
            <p>${esc(exhibition.lede)}</p>
            <p class="muted">${exhibition.sections.length} 节 · ${exhibitCount(exhibition)} 件</p>
          </div>
        </article>`;
  }).join('')}
      </div>
      <p class="actions"><a class="link" href="#/material">← 材料</a> · <a class="link" href="#/hands">像与物</a> · <a class="link" href="#/works">文献</a></p>`;
  }

  function exhibitPage(slug) {
    const exhibition = EXHIBITIONS.find((row) => row.slug === slug);
    if (!exhibition) {
      return `<h1>未找到该展览</h1><p class="actions"><a class="link" href="#/exhibits">← 主题展</a></p>`;
    }
    return `
      <div class="reading page-intro">
        <p class="kicker">${esc(exhibition.kicker)}</p>
        <h1>${esc(exhibition.title)}</h1>
        <p class="lede">${esc(exhibition.lede)}</p>
        ${crumbs([{ href: '#/', label: '十二帝' }, { href: '#/exhibits', label: '主题展' }, { label: exhibition.title }])}
      </div>
      ${exhibition.sections.map((section, index) => `
        <section class="exhibit-section">
          <h2><span class="exhibit-n">${index + 1}</span>${esc(section.title)}</h2>
          ${section.note ? `<p class="exhibit-note">${esc(section.note)}</p>` : ''}
          <ul class="exhibit-list">${section.items.map(exhibitItem).join('')}</ul>
        </section>`).join('')}
      <p class="actions"><a class="link" href="#/exhibits">← 主题展</a> · <a class="link" href="#/hands">像与物</a> · <a class="link" href="#/material">材料</a></p>`;
  }

  function successionPage(query) {
    const group = query.stage || '全部';
    const threads = group === '全部' ? HEIR_THREADS : HEIR_THREADS.filter((item) => item.key === group);
    return `
      <div class="reading">
        <p class="kicker">储位</p>
        <h1>储位立废</h1>
        <p class="lede">六月先择吉，十二月才册立。四十七年九月，驻跸、拘执、颁诏，隔了二十天，放出来不等于又立回去。五十一年再废，实录写成两天。六十一年十一月，口谕、遗诏和崩在十三日，即位礼在二十日。</p>
        ${crumbs([
          { href: '#/', label: '十二帝' },
          { href: '#/kangxi', label: '康熙朝' },
          { href: '#/chapter/kangxi-02', label: '两废太子' },
          { label: '储位全链' },
        ])}
      </div>
      <div class="filters">
        ${['全部', ...HEIR_THREADS.map((item) => item.key)].map((item) => {
          const label = item === '全部' ? '全链' : (HEIR_THREADS.find((thread) => thread.key === item)?.title || item);
          return `<button type="button" data-stage="${esc(item)}" class="${item === group ? 'on' : ''}" aria-pressed="${item === group}">${esc(label)}</button>`;
        }).join('')}
      </div>
      ${threads.map((thread) => {
        const rows = (DATA.heirChain || []).filter((row) => thread.stages.includes(row['阶段']));
        if (!rows.length) return '';
        return `
          <section class="thread-block">
            <h2>${esc(thread.title)}</h2>
            <p class="thread-lead">${esc(thread.lead)}</p>
            ${heirList(rows)}
          </section>`;
      }).join('')}
      <h2 class="src-title">补注</h2>
      <aside class="gap-card">
        <h2>咸安宫</h2>
        <p>本纪和列传写他再废后关在这里。实录那两天只写拘执、废黜，没有这个地名。</p>
        <p>起居注该日还没打开。所以地点只记在后出的那一层，不提前写进实录。</p>
      </aside>
      <aside class="gap-card">
        <h2>满汉遗诏原件</h2>
        <p>一史馆和中研院都藏有满汉合璧本。现在只列出入口，没有打开到可核验的图像页。</p>
        <p>现在能回查的是实录卷300那一条，不是原件。展览介绍不能当成已经核对过原件。入口见 <a class="link" href="#/works">文献</a>，问法见 <a class="link" href="#/question/QH-GQ-0084">满汉遗诏原件看见了吗</a>、<a class="link" href="#/question/QH-GQ-0085">起居注记了御榻口谕吗</a>。</p>
      </aside>
      <aside class="gap-card">
        <h2>别朝的继位层</h2>
        <p>本页接到辛丑即位礼为止。分日讲解见<a class="link" href="#/chapter/yongzheng-07">十三日崩逝到二十日即位</a>。别的继位文本在各自章里：<a class="link" href="#/chapter/daoguang-04">道光·密匣两启</a>、<a class="link" href="#/chapter/xianfeng-01">咸丰·序层回銮</a>、<a class="link" href="#/chapter/guangxu-01">光绪·懿旨立嗣</a>、<a class="link" href="#/chapter/xuantong-01">宣统·退位诏</a>。匣、旨、诏，生产者各不相同。</p>
        <p>清代自己排过一次序：<a class="link" href="#/chapter/qianlong-01">乾隆传位诏</a>把口谕、密缄、明诏摆成一排，「以今视昔，孰逾于此」。排序者是乾隆，自述非公论——但枢纽的四种文本，本朝人自己也对过账。</p>
      </aside>
      <p class="actions"><a class="link" href="#/person/QH-P-000004">胤礽</a> · <a class="link" href="#/lanes">对照</a> · <a class="link" href="#/princes">皇子</a></p>
    `;
  }

  const LANE_HINT = {
    '后宫制度': '称号、名分、抚养关系，多数「宫斗」其实是制度题。',
    '野史对照': '通行说法与官书原文并列，不把好看的故事升格成事实。',
    '罕读史料': '这些材料存在，但一般人接触不到，先说明它在哪、能不能看。',
    '宫中治理': '禁令、火政、瞒报——一条规矩的百年生命史。',
    '笔法': '同一件事，不同的书用不同的写法。',
  };

  function lanesPage(query) {
    const lane = query.lane || '全部';
    const groups = [
      { id: '全部', label: '全部' },
      { id: '后宫制度', label: '后宫制度' },
      { id: '野史对照', label: '传闻' },
      { id: '罕读史料', label: '罕读史料' },
      { id: '宫中治理', label: '宫中治理' },
      { id: '笔法', label: '笔法' },
    ];
    const rows = (DATA.lanes || []).filter((row) => lane === '全部' || row['栏目'] === lane);
    return `
      <div class="reading page-intro">
        <p class="kicker">对照</p>
        <h1>官书与传闻</h1>
        <p class="lede">先看已经打开的官书。对面才是通行说法和影视。</p>
        ${crumbs([{ href: '#/', label: '十二帝' }, { label: '对照' }])}
      </div>
      <div class="filters era-tab-bar" aria-label="对照分类">
        ${groups.map((item) => `<button type="button" data-lane="${esc(item.id)}" class="era-tab-item ${item.id === lane ? 'active' : ''}" aria-pressed="${item.id === lane}">${esc(item.label)}</button>`).join('')}
      </div>
      ${lane === '全部'
        ? groups.slice(1).map((g) => {
            const items = (DATA.lanes || []).filter((row) => row['栏目'] === g.id);
            if (!items.length) return '';
            return `
              <div class="lane-group-section">
                <h2 class="era-group lane-group-title"><span class="era-group-name">${esc(g.label)}</span><span class="era-group-n">${items.length} 条</span></h2>
                <p class="muted lane-group-hint">${esc(LANE_HINT[g.id] || '')}</p>
                <div class="lane-cards-list">${items.map(laneCard).join('')}</div>
              </div>`;
          }).join('')
        : `<div class="lane-cards-list">${rows.map((row) => laneCard(row, { headingLevel: 2 })).join('')}</div>`}
    `;
  }

  function lanePage(id) {
    const row = (DATA.lanes || []).find((item) => item.lane_id === id);
    if (!row) return `<h1>未找到条目 ${esc(id)}</h1>`;
    const related = (DATA.lanes || []).filter((item) => item.lane_id !== id && item['栏目'] === row['栏目']).slice(0, 6);
    const laneRoute = `#/lane/${id}`;
    const questions = (DATA.questions || []).filter((item) => item.route === laneRoute);
    return `
      <p class="kicker">${esc({ 后宫制度: '后宫制度', 野史对照: '传闻', 罕读史料: '罕读史料', 宫中治理: '宫中治理', 笔法: '笔法' }[row['栏目']] || row['栏目'])}</p>
      <h1>${esc(row['标题'])}</h1>
      ${crumbs([{ href: '#/lanes', label: '对照' }])}
      <p class="crumb crumb-share"><a class="link" href="#/lane/${esc(id)}">分享本页</a></p>
      ${laneCard(row, { detail: true, headingLevel: 2 })}
      ${questions.length ? `<h2>这类问题</h2>${questions.map((item) => questionCard(item)).join('')}` : ''}
      <p class="actions"><a class="link" href="#/lanes">← 对照</a> ${laneHref(row['来源入口'])}</p>
      ${related.length ? `<h2>同一栏其他条目</h2>${related.map((item) => `<p><a href="#/lane/${esc(item.lane_id)}">${esc(item['标题'])}</a></p>`).join('')}` : ''}
    `;
  }

  // 依据页：全部 = 来源索引（不再一次铺 881 张卡），选中某部书才展开卷次和条目
  function claimSourceName(claim) {
    return unitById.get(claim['来源实体 ID'])?.['史料名'] || '未标注来源';
  }

  function claimsBySource() {
    const map = new Map();
    (DATA.claims || []).forEach((row) => {
      const name = claimSourceName(row);
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(row);
    });
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }

  function claimsPage(query) {
    // 兼容 #/claims?unit=QH-SU-XXX：章节页和静态分享页仍在生成这种旧链接
    if (query.unit && !query.src) {
      const unit = unitById.get(query.unit);
      if (unit) query = { ...query, src: unit['史料名'] || '', vol: unit['卷次'] || '' };
    }
    const groups = claimsBySource();
    const total = (DATA.claims || []).length;
    const src = query.src || '';
    const head = `
      <div class="page-head">
        <h1>依据</h1>
      </div>
      <p class="lede">一条主张对应一句原文、一个出处。全库 ${total} 条，来自 ${groups.length} 种史料。</p>
      ${crumbs([{ href: '#/material', label: '材料' }, { label: '依据' }])}`;

    // 一级：没选书时只给来源索引，不渲染条目
    if (!src) {
      return `
        ${head}
        <nav class="src-index" aria-label="按史料看">
          ${groups.map(([name, rows]) => `
            <button type="button" class="src-row" data-src="${esc(name)}">
              <span class="src-name">${esc(name)}</span>
              <span class="src-count">${rows.length}</span>
            </button>`).join('')}
        </nav>`;
    }

    const rows = (DATA.claims || []).filter((row) => claimSourceName(row) === src);
    if (!rows.length) {
      return `${head}<p class="empty">没有「${esc(src)}」的依据。</p>
        <p class="actions"><button type="button" class="link" data-src="全部">← 来源索引</button></p>`;
    }

    // 二级：卷次。同名卷次合并，按条数排
    const volMap = new Map();
    rows.forEach((row) => {
      const vol = unitById.get(row['来源实体 ID'])?.['卷次'] || '未分卷';
      if (!volMap.has(vol)) volMap.set(vol, []);
      volMap.get(vol).push(row);
    });
    // 卷次混用阿拉伯数字（卷6）和中文数字（卷之二十一），两种都要能排
    const volNum = (name) => {
      const raw = String(name);
      const arab = raw.match(/\d+/);
      if (arab) return Number(arab[0]);
      const digits = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
      const cn = raw.replace(/^卷之?/, '').match(/[零一二三四五六七八九十百]+/);
      if (!cn) return Number.MAX_SAFE_INTEGER;
      let section = 0;
      let current = 0;
      for (const ch of cn[0]) {
        if (ch in digits) { current = digits[ch]; continue; }
        if (ch === '十') { section += (current || 1) * 10; current = 0; continue; }
        if (ch === '百') { section += (current || 1) * 100; current = 0; continue; }
      }
      return (section + current) || Number.MAX_SAFE_INTEGER;
    };
    const vols = [...volMap.entries()].sort((a, b) => volNum(a[0]) - volNum(b[0]) || a[0].localeCompare(b[0], 'zh'));
    const vol = query.vol || '';
    const shown = vol && volMap.has(vol) ? [[vol, volMap.get(vol)]] : vols;

    return `
      ${head}
      <p class="crumb"><button type="button" class="link" data-src="全部">← 全部来源</button></p>
      <h2 class="src-title">${esc(src)} <span class="muted">${rows.length} 条</span></h2>
      ${vols.length > 1 ? `<div class="filters">
        <button type="button" data-vol="全部" class="${vol ? '' : 'on'}" aria-pressed="${!vol}">全部卷次</button>
        ${vols.map(([name, list]) => `<button type="button" data-vol="${esc(name)}" class="${name === vol ? 'on' : ''}" aria-pressed="${name === vol}">${esc(name)} <span class="muted">${list.length}</span></button>`).join('')}
      </div>` : ''}
      ${shown.map(([name, list]) => `
        <section class="claim-group">
          <h3 class="group-head">${esc(name)} <span class="muted">${list.length} 条</span></h3>
          ${list.map(claimCard).join('')}
        </section>`).join('')}
    `;
  }

  function claimPage(id) {
    const claim = claimById.get(id);
    if (!claim) return `<h1>未找到主张 ${esc(id)}</h1>`;
    const linkedRegions = regionsByAssertion.get(id) || [];
    const conflictId = String(claim['冲突组 ID'] || '').trim();
    const siblings = conflictId
      ? (DATA.claims || []).filter((row) => row['Assertion ID'] !== id && String(row['冲突组 ID'] || '').trim() === conflictId)
      : [];
    return `
      <p class="kicker">依据</p>
      <h1>${esc(predicateLabel(claim['谓词/关系']))}</h1>
      ${crumbs([
        { href: '#/claims', label: '依据' },
        { label: predicateLabel(claim['谓词/关系']) },
      ])}
      <div class="claim-compare">
        <div>${claimCard(claim)}</div>
        ${siblings.length ? `
        <section class="conflict-siblings">
          <h2>同组异说 · ${esc(conflictId)}</h2>
          ${siblings.map((row) => claimCard(row)).join('')}
        </section>` : ''}
      </div>
      ${linkedRegions.length ? `
      <section class="region-backlinks">
        <h2>引用本主张的图像区域</h2>
        ${linkedRegions.map((r) => `<p><a class="link" href="#/image/${esc(r.visual_id)}">${esc(r.region_label)}</a> · ${esc(r.evidence_stance || '')}${r.note ? ` · ${esc(r.note)}` : ''}</p>`).join('')}
      </section>` : ''}
    `;
  }

  function htmlPlainTextLength(html) {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    const text = String(html || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
        if (code[0] !== '#') return named[code.toLowerCase()] ?? entity;
        const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(value) ? String.fromCodePoint(value) : entity;
      })
      .replace(/\s/g, '');
    return Array.from(text).length;
  }

  function chapterIsShort(chapter) {
    return Boolean(chapter && htmlPlainTextLength(chapter.bodyHtml || '') < 2000);
  }

  function extractLeadingEvidenceDrawers(html, limit = 2) {
    let body = String(html || '');
    const drawers = [];
    for (let i = 0; i < limit; i++) {
      const match = body.match(/^\s*(<details class="evidence-drawer[^"]*"[\s\S]*?<\/details>)/);
      if (!match) break;
      drawers.push(match[1].replace('class="evidence-drawer', 'class="chapter-meta-item evidence-drawer'));
      body = body.slice(match[0].length);
    }
    return { drawers, body };
  }

  function chapterToc(html) {
    const items = [];
    const re = /<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g;
    let match;
    while ((match = re.exec(html))) {
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      if (title === '边界' || title === '尚未解决') continue;
      items.push({ id: match[1], title });
    }
    return items;
  }

  function expandConflicts(html) {
    return String(html || '').replace(
      /<div class="claim-compare conflict-embed" data-conflict="([^"]+)"(?: data-label="([^"]*)")?><\/div>/g,
      (_, id, label) => {
        const rows = (DATA.claims || []).filter((row) => String(row['冲突组 ID'] || '').trim() === id);
        const set = (DATA.conflictSets || []).find((row) => row.conflict_set_id === id);
        const heading = label || set?.['议题'] || id;
        if (!rows.length) {
          return `<section class="claim-compare"><h3>${esc(heading)}</h3><p class="muted">本组主张尚未载入。</p></section>`;
        }
        return `<details class="conflict-fold claim-compare">
          <summary>${comparisonLabel(id)} · ${esc(heading)}</summary>
          <section class="claim-compare"><h3>${esc(heading)}</h3>${rows.map((row) => claimCard(row)).join('')}</section>
        </details>`;
      },
    );
  }

  function chapterNav(chapter, list) {
    const sameGenre = orderedChapters(list, DATA.emperors, chapterGenre(chapter));
    const idx = sameGenre.findIndex((row) => row.slug === chapter.slug);
    const prev = idx > 0 ? sameGenre[idx - 1] : null;
    const next = idx >= 0 && idx < sameGenre.length - 1 ? sameGenre[idx + 1] : null;
    if (!prev && !next) return '';
    return `<nav class="chapter-nav" aria-label="上下篇">
      ${prev ? `<a class="chapter-nav-card" href="#/chapter/${esc(prev.slug)}"><span>← 回看 · 上一篇</span><strong>${esc(prev.title)}</strong></a>` : '<span></span>'}
      ${next ? `<a class="chapter-nav-card" href="#/chapter/${esc(next.slug)}"><span>继续主线 · 下一篇 →</span><strong>${esc(next.title)}</strong></a>` : '<span></span>'}
    </nav>`;
  }

  function chapterPage(slug) {
    const list = DATA.chapters || [];
    const chapter = list.find((row) => row.slug === slug) || (slug ? null : list[0]);
    if (!chapter) return `<h1>未找到章节 ${esc(slug || '')}</h1><p><a href="#/">← 十二帝</a></p>`;
    const unitIds = String(chapter.unit_ids || '').split(/[；;]/).map((item) => item.trim()).filter(Boolean);
    const units = unitIds.map((id) => DATA.units.find((unit) => unit.source_unit_id === id)).filter(Boolean);
    const claimCount = units.reduce((n, unit) => (
      n + (DATA.claims || []).filter((row) => row['来源实体 ID'] === unit.source_unit_id).length
    ), 0);
    const eraHome = reignHref(chapter.era) || (chapter.person_id ? personHref(chapter.person_id) : '#/');
    const expandedBody = expandConflicts(chapter.bodyHtml || '');
    const short = chapterIsShort(chapter);
    const compact = extractLeadingEvidenceDrawers(expandedBody);
    const lifted = liftEditorialBans(compact.body);
    const body = citeClaimRefs(lifted.body);
    const toc = short ? [] : chapterToc(body);
    const compactMeta = compact.drawers.length ? `
      <details class="chapter-notes"><summary>关于本章材料</summary>
        <div class="chapter-meta-row" aria-label="本章材料说明">${compact.drawers.join('')}</div>
      </details>` : '';
    const related = String(chapter.related || '').split(/[；;]/).map((item) => item.trim()).filter(Boolean).slice(0, 3);
    const relatedHtml = related.length ? `<p class="chapter-related">${relatedLinks(related.join('；'))}</p>` : '';
    const relatedChapters = String(chapter.related || '').split(/[；;]/)
      .map((href) => list.find((row) => href.trim() === `#/chapter/${row.slug}`))
      .filter((row) => row && row.slug !== chapter.slug && row.slug !== chapter.prev_slug && row.slug !== chapter.next_slug);
    const further = [...relatedChapters.map((row) => readingPick(row)), ...selectReadingPicks(list, { exclude: chapter.slug })]
      .filter((row, index, all) => all.findIndex((item) => item.slug === row.slug) === index).slice(0, 2);
    // 版心卷次：同朝诸篇按序排「卷」，资料篇作「附」
    const eraList = list.filter((row) => row.era === chapter.era && chapterGenre(row) !== '资料');
    const juanIdx = eraList.findIndex((row) => row.slug === chapter.slug);
    const juanLabel = chapterGenre(chapter) === '资料' || juanIdx < 0
      ? `${chapter.era}朝 · 附`
      : `${chapter.era}朝 · 卷${numCn(juanIdx + 1)}`;
    return `
      <div class="chapter-shell" data-chapter="${esc(chapter.slug)}" data-juan="${esc(juanLabel)}" data-era="${esc(chapter.era)}" data-title="${esc(chapter.title)}">
      <div class="reading chapter-head">
        <p class="kicker">${esc(chapter.era)}${chapterGenre(chapter) === '资料' ? ' · 资料' : ''}</p>
        <h1>${esc(chapter.title)}</h1>
        <p class="lede">${noOrphan(chapter.lede)}</p>
        <p class="reading-time">${chapter.readMinutes ? `约 ${chapter.readMinutes} 分钟阅读 · ` : ''}随时点角标，查看原文出处${lastSearch ? ` · <a href="${esc(lastSearch.href)}">返回「${esc(lastSearch.q)}」的搜索结果</a>` : ''}</p>
        ${crumbs([
          { href: '#/', label: '十二帝' },
          { href: '#/read', label: '读故事' },
          eraHome ? { href: eraHome, label: chapter.era } : null,
        ])}
        <div class="chapter-tools">
          <p class="crumb crumb-share"><a class="link" href="#/chapter/${esc(chapter.slug)}">分享本页</a></p>
          <div class="reader-controls">
            <button type="button" class="reader-tool-btn" data-copy-citation="《清史读本》·「${esc(chapter.era)}」${esc(chapter.title)}" title="复制本章引用格式">复制引用</button>
            <span class="fs-controls" aria-label="字号调节">
              <button type="button" class="fs-btn" data-set-fs="s" title="小字号">A-</button>
              <button type="button" class="fs-btn" data-set-fs="m" title="标准字号">A</button>
              <button type="button" class="fs-btn" data-set-fs="l" title="大字号">A+</button>
            </span>
          </div>
        </div>
      </div>
      ${toc.length ? `<details class="chapter-toc"${window.matchMedia('(min-width: 1100px)').matches ? ' open' : ''}>
        <summary class="toc-label">本章目录 · ${toc.length} 节</summary>
        <ol>${toc.map((item) => `<li><button type="button" class="link" data-scroll="${esc(item.id)}">${esc(item.title)}</button></li>`).join('')}</ol>
      </details>` : ''}
      <div class="chapter-body">
      ${chapter.talks?.length ? `<details class="chapter-talks"><summary>这章也可以讲 · ${chapter.talks.length} 个选题</summary><p>${chapter.talks.map((topic) => `<a class="link" href="#/studio/${esc(topic.slug)}">${esc(topic.title)}</a>`).join(' · ')}</p></details>` : ''}
      <div class="md">${body}</div>
      ${lifted.bans.length ? `<details class="evidence-drawer editorial-bound">
        <summary>编辑边界 · ${lifted.bans.length} 条</summary>
        <ul>${lifted.bans.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
      </details>` : ''}
      <section class="chapter-next">
        <h2>接着读下去</h2>
        ${chapterNav(chapter, list)}
        ${further.length ? `<h2 class="further-heading">换个角度读</h2>${readingCards(further)}` : ''}
        ${units.length ? `<details class="chapter-evidence">
          <summary>本章可回查的卷 · ${units.length} 处来源</summary>
          <p>${units.length} 处来源，${claimCount} 条主张。正文角标对着原文。</p>
          <p class="actions">${units.map((unit) => `<a class="link" href="#/claims?unit=${esc(unit.source_unit_id)}">${esc(unit['卷次'] || unit.source_unit_id)}</a>`).join(' · ')}</p>
        </details>` : ''}
        ${compactMeta}
        ${relatedHtml}
        ${relatedLaneCards(chapter)}
      </section>
      </div>
      </div>
    `;
  }

  function overviewPage(slug) {
    const list = DATA.overviews || [];
    // 没给篇名时给索引，而不是默默显示第一篇——这 5 篇原先全站没有入口
    if (!slug) {
      const sorted = list.slice().sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
      return `
        <p class="kicker">脉络</p>
        <h1>全朝通览</h1>
        <p class="lede">十二帝不按朝分开看，而是横过来排：谁做了什么、争议在哪、原文怎么读。共 ${sorted.length} 篇。</p>
        <ol class="threads">
          ${sorted.map((row) => `
            <li>
              <a class="thread" href="#/overview/${esc(row.slug)}">
                <h2>${esc(row.title)}</h2>
                <p>${esc(row.lede || '')}</p>
              </a>
            </li>`).join('')}
        </ol>
        <p class="actions"><a class="link" href="#/path">转轴</a> · <a class="link" href="#/material">材料</a> · <a class="link" href="#/">← 十二帝</a></p>`;
    }
    const ov = list.find((row) => row.slug === slug);
    if (!ov) return `<h1>未找到专题 ${esc(slug || '')}</h1><p class="actions"><a class="link" href="#/overview">← 脉络目录</a></p>`;
    const body = expandConflicts(ov.bodyHtml || '');
    const toc = chapterToc(body);
    const siblings = list.slice().sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
    const idx = siblings.findIndex((row) => row.slug === ov.slug);
    const prev = idx > 0 ? siblings[idx - 1] : null;
    const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
    return `
      <div class="chapter-shell">
      <div class="reading chapter-head">
        <p class="kicker">脉络</p>
        <h1>${esc(ov.title)}</h1>
        <p class="lede">${noOrphan(ov.lede)}</p>
        <p class="crumb"><a class="link" href="#/overview">← 脉络目录</a> · <a class="link" href="#/">← 十二帝</a></p>
      </div>
      ${toc.length ? `<details class="chapter-toc"${window.matchMedia('(min-width: 1100px)').matches ? ' open' : ''}>
        <summary class="toc-label">本章目录 · ${toc.length} 节</summary>
        <ol>${toc.map((item) => `<li><button type="button" class="link" data-scroll="${esc(item.id)}">${esc(item.title)}</button></li>`).join('')}</ol>
      </details>` : ''}
      <div class="chapter-body">
      <div class="md">${body}</div>
      ${(prev || next) ? `<nav class="chapter-nav" aria-label="上下篇">
        ${prev ? `<a class="link" href="#/overview/${esc(prev.slug)}">上一篇 ${esc(prev.title)}</a>` : '<span></span>'}
        ${next ? `<a class="link" href="#/overview/${esc(next.slug)}">下一篇 ${esc(next.title)}</a>` : '<span></span>'}
      </nav>` : ''}
      </div>
      </div>
    `;
  }

  function questionCard(row, opts = {}) {
    return `
      <article class="claim" id="${esc(row.question_id)}">
        <p class="sub">${esc(row.evidenceGap ? '现有材料不够' : '能对到日子')}</p>
        <p class="sentence"><a href="#/question/${esc(row.question_id)}">${esc(row.question)}</a></p>
        ${opts.hideBound ? '' : (row.evidenceGap
          ? `<p class="bound">${esc(row.explanation)}</p>`
          : `<p class="lede">${esc(row.answer)}</p>`)}
        <p class="actions">
          ${row.route ? `<a class="link" href="${esc(row.route)}">相关页</a>` : ''}
          ${(row.links || []).map((link) => `<a class="link" href="${esc(link.href)}">${esc(link.label)}</a>`).join(' ')}
        </p>
      </article>
    `;
  }

  function questionsPage(query) {
    const group = query.type || '全部';
    const types = [
      { id: '全部', label: '全部' },
      { id: '能对到日子', label: '能对到日子' },
      { id: '现有材料不够', label: '现有材料不够' },
    ];
    const rows = (DATA.questions || []).filter((row) => {
      if (group === '现有材料不够') return Boolean(row.evidenceGap);
      if (group === '能对到日子') return !row.evidenceGap;
      return true;
    });
    const pinnedIds = ['QH-GQ-0068', 'QH-GQ-0071', 'QH-GQ-0053'];
    const pinned = group === '全部'
      ? pinnedIds.map((id) => rows.find((row) => row.question_id === id)).filter(Boolean)
      : [];
    const rest = rows.filter((row) => !pinned.includes(row));
    return `
      <div class="reading page-intro">
        <p class="kicker">现有材料答不了</p>
        <h1>此类问题暂无答案</h1>
        <p class="lede">有的能对到卷和日子。有的只能说：现有材料不够，不能写成事实。</p>
        ${crumbs([{ href: '#/', label: '十二帝' }, { label: '这类问题' }])}
      </div>
      <div class="filters era-tab-bar" aria-label="问题类型分类">
        ${types.map((item) => `<button type="button" data-qtype="${esc(item.id)}" class="era-tab-item ${item.id === group ? 'active on' : ''}" aria-pressed="${item.id === group}">${esc(item.label)}</button>`).join('')}
      </div>
      ${pinned.length ? `<h2>三问</h2><div class="questions-list">${pinned.map((row) => questionCard(row)).join('')}</div>` : ''}
      <div class="questions-list">${rest.map(questionCard).join('')}</div>
    `;
  }

  function questionPage(id) {
    const row = (DATA.questions || []).find((item) => item.question_id === id);
    if (!row) return `<h1>未找到问题 ${esc(id)}</h1><p><a href="#/questions">← 这类问题</a></p>`;
    return `
      <p class="kicker">${esc(row.evidenceGap ? '现有材料不够' : '能对到日子')}</p>
      <h1>${esc(row.question)}</h1>
      ${crumbs([
        { href: '#/', label: '十二帝' },
        { href: '#/questions', label: '这类问题' },
        { label: row.question },
      ])}
      ${row.evidenceGap ? noEvidenceBanner('现有材料不足以下结论', row.explanation) : ''}
      ${questionCard(row, { hideBound: row.evidenceGap })}
      <p class="crumb"><a class="link" href="#/questions">全部这类问题</a></p>
    `;
  }

  function handsPage(query = {}) {
    const only = query.era || '';
    const emperorOrder = new Map((DATA.emperors || []).map((emperor, index) => [emperor.emperor_id, index]));
    const all = (DATA.portraits || [])
      .map((row) => {
        const emperor = emperorByLegacy.get(row.emperor_id);
        return { row, group: visualGroup(row), era: String(emperor?.['年号或通称'] || '').split('；')[0] };
      })
      .filter((item) => item.group && (!only || item.era === only))
      .sort((a, b) => (emperorOrder.get(a.row.emperor_id) ?? 999) - (emperorOrder.get(b.row.emperor_id) ?? 999));
    return `
      <div class="reading page-intro">
        <p class="kicker">像与物</p>
        <h1>图像与器物</h1>
        <p class="lede">朝服像、行乐图、御笔、朱批、诏书、器物和照片，按材料本身的性质归类。全库共收录 ${all.length} 件视觉材料。</p>
        ${crumbs([{ href: '#/', label: '十二帝' }, { href: '#/material', label: '材料' }, { label: '像与物' }])}
        ${only ? `<p class="actions"><a class="link" href="#/hands">全部</a> · <a class="link" href="#/material">← 材料</a></p>` : ''}
      </div>
      ${courtPortraitNote()}
      ${all.length ? `<nav class="era-jump era-tab-bar" aria-label="按组跳转">${VISUAL_GROUPS
        .filter((group) => all.some((item) => item.group.key === group.key))
        .map((group) => `<button type="button" class="era-tab-item" data-scroll="visual-${group.key}">${esc(group.title)} <i>${all.filter((item) => item.group.key === group.key).length}</i></button>`).join('')}</nav>` : ''}
      ${VISUAL_GROUPS.map((group) => {
        const items = all.filter((item) => item.group.key === group.key);
        if (!items.length) return '';
        return `
          <div class="visual-group-section" id="visual-${group.key}">
            <h2 class="era-group visual-group-head"><span class="era-group-name">${esc(group.title)}</span><span class="era-group-n">${items.length} 件</span></h2>
            <div class="grid cards visual-grid">${items.map(({ row }) => visualGalleryCard(row)).join('')}</div>
          </div>`;
      }).join('')}
      <p class="actions" style="margin-top: 40px;"><a class="link" href="#/exhibits">主题展</a> · <a class="link" href="#/works">文献</a> · <a class="link" href="#/jiedu">逐段读原典</a> · <a class="link" href="#/path">转轴</a></p>
    `;
  }

  // 旧的画像总览链接保留为别名，和 #/hands 渲染同一份完整清单。
  function imagePage(id) {
    const portrait = portraitById.get(id);
    if (!portrait) return `<h1>未找到图像 ${esc(id)}</h1>`;
    const emperor = emperorByLegacy.get(portrait.emperor_id);
    const siblings = (portraitsByEmperor.get(portrait.emperor_id) || []).filter((row) => row.visual_id !== id);
    const scriptish = ['御笔书法', '奏折朱批'].includes(portrait['展示角色']);
    // 朝服像（一人一幅）挂通用的「御容读法」，把埋在单张图里的判断提到读者第一眼能看到的位置。
    const isCourtPortrait = portrait['展示角色'] === '默认朝服像';
    const era = emperor ? emperor['年号或通称'].split('；')[0] : '图像';
    const hook = portrait['卡片钩子'] || '';
    const analysis = portrait['画面解析'] || '';
    const sourceUrl = safeUrl(portrait['文件页']);
    const hasImage = canEmbed(portrait);
    const facts = [
      portrait['制作年代或摄影日期'] ? `<dt>年代</dt><dd>${esc(portrait['制作年代或摄影日期'])}</dd>` : '',
      portrait['作者或摄影者'] ? `<dt>作者</dt><dd>${esc(portrait['作者或摄影者'])}</dd>` : '',
      portrait['文件页标示许可'] ? `<dt>许可</dt><dd>${esc(portrait['文件页标示许可'])}</dd>` : '',
      portrait['图像性质'] ? `<dt>性质</dt><dd>${esc(portrait['图像性质'])}</dd>` : '',
    ].filter(Boolean).join('');
    const regions = regionsByVisual.get(id) || [];
    const manifest = iiifByVisual.get(id);
    const overlayHtml = regions.map((r) => {
      const rx = Number(r.x) * 100, ry = Number(r.y) * 100, rw = Number(r.w) * 100, rh = Number(r.h) * 100;
      const style = `left:${rx}%;top:${ry}%;width:${rw}%;height:${rh}%`;
      const inner = `<span class="region-label">${esc(r.region_label)}</span>`;
      if (!r.assertion_id) {
        return `<span class="region-overlay region-static" style="${style}" title="${esc(r.region_label)}">${inner}</span>`;
      }
      return `<a class="region-overlay" style="${style}" href="#/claim/${esc(r.assertion_id)}" title="${esc(r.region_label)}">${inner}</a>`;
    }).join('');
    const regionLinksHtml = regions.length ? `
          <div class="region-links">
            <h2>区域与主张</h2>
            ${regions.map((r) => r.assertion_id
              ? `<p><a class="link" href="#/claim/${esc(r.assertion_id)}">${esc(r.region_label)}</a> · ${esc(r.evidence_stance || '')}${r.note ? ` · ${esc(r.note)}` : ''}</p>`
              : `<p>${esc(r.region_label)}${r.note ? ` · ${esc(r.note)}` : ''}</p>`).join('')}
          </div>` : '';

    return `
      <div class="image-page-shell">
        <div class="image-header">
          <p class="kicker">${esc(era)} · ${esc(portrait['展示角色'])}</p>
          <h1>${esc(portrait['对象标题'])}</h1>
          ${hook ? `<p class="lede">${esc(hook)}</p>` : ''}
          ${crumbs([
            { href: '#/', label: '十二帝' },
            { href: '#/hands', label: '像与物' },
            { label: portrait['对象标题'] },
          ])}
          <div class="image-meta-actions">
            <a class="link" href="#/image/${esc(id)}">分享本页</a>
          </div>
        </div>

        ${hasImage ? `
          <div class="dossier image-dossier">
            <figure class="portrait large${scriptish ? ' script' : ''}">
              ${manifest ? `<div class="osd-viewer" data-manifest="${esc(manifest)}" data-fallback="${esc(portrait['预览文件'])}" data-alt="${esc(portrait['对象标题'])}"><noscript><img src="${esc(portrait['预览文件'])}" alt="${esc(portrait['对象标题'])}"></noscript></div>` : `<div class="image-regions">
                ${mediaImg(portrait['预览文件'], portrait['对象标题'], portrait['对象标题'])}
                ${overlayHtml}
              </div>`}
              <figcaption class="portrait-caption">
                <p class="muted">${esc(portrait['作者或摄影者'] || '')}${portrait['制作年代或摄影日期'] ? ` · ${esc(portrait['制作年代或摄影日期'])}` : ''} · ${esc(portrait['文件页标示许可'] || '')}</p>
              </figcaption>
            </figure>
            <div class="image-info-col">
              ${analysis ? `<div class="image-analysis"><h2>画面解析</h2><p>${esc(analysis)}</p></div>` : ''}
              ${isCourtPortrait ? courtPortraitNote() : ''}
              ${regionLinksHtml}
              ${portrait['释文'] ? `<div class="image-transcription-wrap"><h2>释文</h2>${transcriptionBlock(portrait)}</div>` : ''}
              <div class="chips">${annotationChips(portrait)}</div>
              ${facts ? `<dl class="kv">${facts}</dl>` : ''}
              <div class="actions">
                ${emperor ? `<a class="btn" href="#/person/${esc(emperor.person_id)}">回${esc(era)}朝代页</a>` : ''}
                ${sourceUrl ? `<a class="btn primary" href="${esc(sourceUrl)}" target="_blank" rel="noopener">${esc(sourcePageLabel(portrait))} ↗</a>` : ''}
              </div>
            </div>
          </div>
        ` : `
          <div class="doc-dossier">
            <div class="doc-dossier-card">
              ${analysis ? `<div class="doc-analysis"><p class="lede-prose">${esc(analysis)}</p></div>` : ''}
              ${portrait['释文'] ? `
                <div class="doc-transcription-section">
                  <h2>释文 · 原文摘录</h2>
                  <div class="doc-transcription-box">
                    ${transcriptionBlock(portrait)}
                  </div>
                </div>
              ` : ''}
              ${regionLinksHtml}
              <div class="doc-facts-grid">
                ${facts ? `<dl class="kv doc-kv">${facts}</dl>` : ''}
                <div class="doc-access-box">
                  <h3>典藏查阅</h3>
                  <p class="muted">${esc(rightsNote(portrait['权利颜色']))} · 馆藏原件或数字高清单行外链</p>
                  <div class="actions">
                    ${sourceUrl ? `<a class="btn primary" href="${esc(sourceUrl)}" target="_blank" rel="noopener">${esc(sourcePageLabel(portrait))} ↗</a>` : ''}
                    ${emperor ? `<a class="btn" href="#/person/${esc(emperor.person_id)}">回${esc(era)}朝代页</a>` : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        `}

        ${siblings.length ? `
          <section class="image-siblings-section">
            <div class="section-head">
              <h2>本朝其他像与物</h2>
              <p class="muted">同属 ${esc(era)} 朝的朝服像、便服行乐、御笔、朱批与器物。</p>
            </div>
            <div class="thumbs sibling-thumbs">${siblings.map(thumbCard).join('')}</div>
          </section>
        ` : ''}
      </div>
    `;
  }


  function sourceGroup(row) {
    const found = SOURCE_GROUPS.find((group) => group.match(row));
    return found ? found.title : '其他';
  }

  function rightsNote(color) {
    if (color === '绿') return '可嵌入图像';
    if (color === '黄') return '只给说明与外链';
    return '须申请授权';
  }

  function sourceCard(row) {
    const content = (row['核心内容'] || '').trim();
    return `
      <a class="card source-card" href="#/source/${esc(row.source_id)}">
        <div class="meta">
          <div class="era">${esc(row['机构或资源'])}</div>
          <div class="chips">${rightsChip(row['权利颜色'])}<span class="chip">${esc(row['证据等级'])}</span></div>
          ${content ? `<p class="src-note">${esc(rightsNote(row['权利颜色']))} · ${esc(content)}</p>` : `<p class="src-note">${esc(rightsNote(row['权利颜色']))}</p>`}
        </div>
      </a>
    `;
  }

  function openStateChip(state) {
    return `<span class="open-state">${esc(state || '馆藏入口')}</span>`;
  }

  // 卡片正文统一截 3 行：文献里有把上百个碑文名全列进来的条目，不截就把网格撑塌
  function longDesc(text) {
    const raw = String(text || '').trim();
    if (!raw) return '';
    if (raw.length <= 90) return `<p class="work-desc">${esc(raw)}</p>`;
    return `<div class="clamp"><p class="work-desc">${esc(raw)}</p><button type="button" class="link clamp-toggle" data-clamp>展开</button></div>`;
  }

  function worksPage(query = {}) {
    const only = query.era || '';
    const works = DATA.works || [];
    const workCard = (w) => {
      const opened = Boolean(w.hasDirectText);
      const entryLabel = opened ? '原文条目' : '馆藏／咨询入口';
      return `
      <article class="card work-card">
        <div class="meta work-card-meta">
          <div class="work-kicker">
            <span class="work-type-badge">${esc(w['文献类型'])}</span>
            <span class="work-year-badge">${esc(w['成书年代'])}</span>
            ${openStateChip(w.availability)}
          </div>
          <h2 class="work-title">${esc(w['文献名称'])}</h2>
          ${w['卷数'] ? `<p class="muted work-vol">${esc(w['卷数'])}</p>` : ''}
          ${longDesc(w['内容概述'])}
          <div class="work-card-actions actions">
            ${w['dedicated_chapter'] ? `<a class="chip-link highlight" href="#/chapter/${esc(w['dedicated_chapter'])}">专论 ›</a>` : ''}
            ${safeUrl(w['来源入口']) ? `<a class="chip-link" href="${esc(safeUrl(w['来源入口']))}" target="_blank" rel="noopener">${esc(entryLabel)} ↗</a>` : ''}
          </div>
        </div>
      </article>`;
    };
    const featured = works.filter((w) => w['dedicated_chapter']);
    const groups = (DATA.emperors || [])
      .map((e) => ({ e, rows: works.filter((w) => w.emperor_id === e.emperor_id) }))
      .filter((g) => g.rows.length)
      .filter((g) => !only || String(g.e['年号或通称'] || '').split('；')[0] === only);
    const groupedIds = new Set(groups.flatMap((g) => g.rows.map((w) => w.work_id)));
    const rest = works.filter((w) => !groupedIds.has(w.work_id));
    return `
      <div class="reading page-intro">
        <p class="kicker">文献</p>
        <h1>十二帝著述与官修书</h1>
        <p class="lede">已列出原文条目的文献可直接回查；其余项目只提供馆藏或查阅入口。全库共收录 ${works.length} 种清代核心史籍与著述。</p>
        ${crumbs([{ href: '#/', label: '十二帝' }, { href: '#/material', label: '材料' }, { label: '文献' }])}
        ${only ? `<p class="actions"><a class="link" href="#/works">全部 ${works.length} 种</a> · <a class="link" href="#/material">← 材料</a></p>` : ''}
      </div>
      ${only ? '' : `<nav class="era-jump era-tab-bar" aria-label="按朝跳转">${groups
        .map((g) => ({ era: String(g.e['年号或通称'] || '').split('；')[0], count: g.rows.length }))
        .map(({ era, count }) => `<button type="button" class="era-tab-item" data-scroll="works-${esc(era)}">${esc(era)} <i>${count}</i></button>`).join('')}</nav>`}
      ${!only && featured.length ? `
        <div class="work-group-section">
          <h2 class="era-group work-group-title"><span class="era-group-name">专论文献</span><span class="era-group-n">${featured.length} 种</span></h2>
          <div class="grid cards work-grid">${featured.map(workCard).join('')}</div>
        </div>` : ''}
      ${groups.map((g) => {
        const era = String(g.e['年号或通称'] || '').split('；')[0];
        const read = EMPEROR_READS[g.e.person_id];
        const intro = read?.lede || '';
        return `
        <div class="work-group-section" id="works-${esc(era)}">
          ${reignHead(era, g.rows.length, '种')}
          ${intro ? `<p class="muted era-group-intro">${esc(intro)}</p>` : ''}
          <div class="grid cards work-grid">${g.rows.map(workCard).join('')}</div>
        </div>`;
      }).join('')}
      ${!only && rest.length ? `
        <div class="work-group-section">
          <h2 class="era-group work-group-title"><span class="era-group-name">综合汇编</span><span class="era-group-n">${rest.length} 种</span></h2>
          <div class="grid cards work-grid">${rest.map(workCard).join('')}</div>
        </div>` : ''}
    `;
  }

  function sourcesPage() {
    const seen = new Set();
    const groups = SOURCE_GROUPS.map((group) => {
      const rows = DATA.sources.filter((row) => {
        if (seen.has(row.source_id) || sourceGroup(row) !== group.title) return false;
        seen.add(row.source_id);
        return true;
      });
      return { ...group, rows };
    }).filter((group) => group.rows.length);
    const rest = DATA.sources.filter((row) => !seen.has(row.source_id));
    return `
      <div class="page-head story">
        <h1>所据材料</h1>
      </div>
      <p class="lede">官书、档案、图像、工具四类。能在线查阅不等于可以整库复制，各来源的权利规则不同。</p>
      ${groups.map((group) => `
        <section class="src-group">
          <h2>${esc(group.title)}</h2>
          <p class="muted">${esc(group.hint)}</p>
          <div class="grid cards">${group.rows.map(sourceCard).join('')}</div>
        </section>`).join('')}
      ${rest.length ? `<section class="src-group"><h2>其他</h2><div class="grid cards">${rest.map(sourceCard).join('')}</div></section>` : ''}
    `;
  }

  function sourcePage(id) {
    const row = sourceById.get(id);
    if (!row) return `<h1>未找到来源 ${esc(id)}</h1>`;
    const relatedUnits = DATA.units.filter((unit) => unit.source_entity_id === id);
    return `
      <p class="kicker">${esc(id)}</p>
      <h1>${esc(row['机构或资源'])}</h1>
      ${crumbs([
        { href: '#/', label: '十二帝' },
        { href: '#/sources', label: '所据材料' },
        { label: row['机构或资源'] },
      ])}
      <div class="chips">${rightsChip(row['权利颜色'])}<span class="chip">${esc(row['证据等级'])}</span></div>
      <dl class="kv">
        <dt>类型</dt><dd>${esc(row['资源类型'])}</dd>
        <dt>核心内容</dt><dd>${esc(row['核心内容'])}</dd>
        <dt>访问</dt><dd>${esc(row['访问方式'])}</dd>
        <dt>本地保存</dt><dd>${esc(row['可本地保存'])}</dd>
        <dt>公开展示</dt><dd>${esc(row['可公开展示'])}</dd>
        <dt>商业使用</dt><dd>${esc(row['可商业使用'])}</dd>
        <dt>策略</dt><dd>${esc(row['使用策略'])}</dd>
        <dt>限制</dt><dd>${esc(row['限制摘要'])}</dd>
      </dl>
      <p class="actions">
        <a class="link" href="${esc(row['资源网址'])}" target="_blank" rel="noopener">资源</a>
        <a class="link" href="${esc(row['权利或规则网址'])}" target="_blank" rel="noopener">权利规则</a>
      </p>
      ${relatedUnits.length ? `<h2>可回查条目</h2>${relatedUnits.map((unit) => `<p><a href="#/claims?unit=${esc(unit.source_unit_id)}">${esc([unit['史料名'], unit['卷次']].filter(Boolean).join(' '))}</a> ${esc(unit['原纪年'])}</p>`).join('')}` : ''}
    `;
  }

  function highlightHtml(text, q) {
    const src = String(text ?? '');
    const needle = String(q || '').trim();
    if (!needle) return esc(src);
    const chars = [...needle].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    let re;
    try {
      re = new RegExp(chars.join('[·\\s；;，,。.\\-_/]*'), 'gi');
    } catch {
      return esc(src);
    }
    let out = '';
    let last = 0;
    for (const match of src.matchAll(re)) {
      out += esc(src.slice(last, match.index));
      out += `<mark>${esc(match[0])}</mark>`;
      last = match.index + match[0].length;
    }
    out += esc(src.slice(last));
    return out;
  }

  function clipBlock(items, renderOne, limit = 8) {
    if (!items.length) return '';
    if (items.length <= limit) return items.map(renderOne).join('');
    const head = items.slice(0, limit).map(renderOne).join('');
    const rest = items.slice(limit).map(renderOne).join('');
    return `${head}<details class="search-more"><summary>展开全部 ${items.length} 条</summary>${rest}</details>`;
  }

  function chapterSearchResult(hit, q) {
    const text = typeof hit.bodyStart === 'number' ? hit.hay.slice(hit.bodyStart) : hit.lede || '';
    const index = text.toLowerCase().indexOf(q.trim().toLowerCase());
    const start = Math.max(0, index - 32);
    const raw = index >= 0 ? `${start ? '…' : ''}${text.slice(start, start + 150)}${start + 150 < text.length ? '…' : ''}` : hit.lede || text.slice(0, 150);
    // 摘句横跨小节起点时，「先说结论」这类的标签会悬在句中读不通；用户专找这四个字时保留。
    const kw = q.trim();
    const excerpt = kw && !'先说结论'.includes(kw) ? raw.replace(/先说结论/g, '') : raw;
    return `<article class="search-story"><p class="pick-eyebrow">${esc(hit.extra || '')} · 文章</p><h3><a href="#/chapter/${esc(hit.id)}">${highlightHtml(hit.label, q)}</a></h3><p>${highlightHtml(excerpt, q)}</p></article>`;
  }

  function searchPage(q, query = {}) {
    const needle = normalize(q);
    if (!needle) return `<h1>检索</h1><p>输入年号、庙号、本名、异名或 ID。</p>`;
    const hits = lookupIndex(SEARCH, q);
    const activeCat = query.cat || 'all';

    const peopleHits = hits.filter((row) => row.type === 'person');
    const claimHits = hits.filter((row) => row.type === 'claim').map((row) => claimById.get(row.id)).filter(Boolean);
    const sourceHits = hits.filter((row) => row.type === 'source').map((row) => sourceById.get(row.id)).filter(Boolean);
    const laneHits = hits.filter((row) => row.type === 'lane').map((row) => (DATA.lanes || []).find((item) => item.lane_id === row.id)).filter(Boolean);
    const empressHits = hits.filter((row) => row.type === 'empress').map((row) => (DATA.empressTimeline || []).find((item) => item.event_id === row.id)).filter(Boolean);
    const princeHits = hits.filter((row) => row.type === 'prince').map((row) => (DATA.princes || []).find((item) => item.person_id === row.id)).filter(Boolean);
    const princessHits = hits.filter((row) => row.type === 'princess').map((row) => (DATA.princesses || []).find((item) => item.person_id === row.id)).filter(Boolean);
    const heirHits = hits.filter((row) => row.type === 'heir').map((row) => (DATA.heirChain || []).find((item) => item.event_id === row.id)).filter(Boolean);
    const siteHits = hits.filter((row) => row.type === 'site').map((row) => (DATA.sites || []).find((item) => item.site_id === row.id)).filter(Boolean);
    const questionHits = hits.filter((row) => row.type === 'question');
    const chapterHits = hits.filter((row) => row.type === 'chapter');
    const workHits = hits.filter((row) => row.type === 'work');
    const zggHits = hits.filter((row) => row.type === 'ziguangge');
    const total = peopleHits.length + claimHits.length + empressHits.length + princeHits.length + princessHits.length + heirHits.length + siteHits.length + chapterHits.length + questionHits.length + laneHits.length + sourceHits.length + workHits.length + zggHits.length;

    const categories = [
      { id: 'all', label: '全部', count: total },
      { id: 'chapter', label: '文章', count: chapterHits.length },
      { id: 'person', label: '人物', count: peopleHits.length },
      { id: 'claim', label: '原文依据', count: claimHits.length },
      { id: 'lane', label: '对照', count: laneHits.length },
      { id: 'site', label: '遗址今况', count: siteHits.length },
      { id: 'empress', label: '后妃', count: empressHits.length },
      { id: 'prince', label: '皇子', count: princeHits.length },
      { id: 'princess', label: '皇女', count: princessHits.length },
      { id: 'heir', label: '储位', count: heirHits.length },
      { id: 'question', label: '这类问题', count: questionHits.length },
      { id: 'work', label: '文献与来源', count: workHits.length + sourceHits.length },
      { id: 'ziguangge', label: '紫光阁', count: zggHits.length },
    ].filter((c) => c.id === 'all' || c.count > 0);

    const showAll = activeCat === 'all';

    return `
      <div class="reading page-intro">
        <p class="kicker">检索</p>
        <h1>「${esc(q)}」</h1>
        <p class="lede">全库共检索到 <strong>${total}</strong> 处匹配条目。</p>
        ${crumbs([{ href: '#/', label: '十二帝' }, { label: `检索 「${q}」` }])}
      </div>
      <div class="filters era-tab-bar search-facets" role="tablist" aria-label="检索类别筛选">
        ${categories.map((c) => `
          <button type="button" class="era-tab-item facet-btn ${c.id === activeCat ? 'active on' : ''}" data-search-cat="${esc(c.id)}" role="tab" aria-selected="${c.id === activeCat ? 'true' : 'false'}">
            ${esc(c.label)} <i>${c.count}</i>
          </button>
        `).join('')}
      </div>

      ${!total ? `<section class="search-empty"><h2>暂时没找到「${esc(q)}」</h2><p>可以缩短关键词，或换成年号、人名再试。也可以先读下面的故事。</p>${readingCards(DATA.featuredReads)}</section>` : ''}
      ${(showAll || activeCat === 'chapter') ? (chapterHits.length ? `<section class="search-stories"><h2>先读文章 <span class="muted">${chapterHits.length}</span></h2>${clipBlock(chapterHits, (hit) => chapterSearchResult(hit, q), 6)}</section>` : (activeCat === 'chapter' ? '<p class="empty">没有匹配的文章，可以切换到人物或原文依据。</p>' : '')) : ''}
      ${(showAll || activeCat === 'person') ? `
        ${peopleHits.length || activeCat === 'person' ? `<h2>人物 ${peopleHits.length}</h2>` : ''}
        ${peopleHits.length ? `<ul class="search-people">${clipBlock(peopleHits, (hit) => `<li><a href="#/person/${esc(hit.id)}">${highlightHtml(hit.label, q)}</a> <span class="muted">${highlightHtml(hit.extra || '', q)}</span></li>`)}</ul>` : (activeCat === 'person' ? '<p class="empty">无人物命中。</p>' : '')}
      ` : ''}

      ${(showAll || activeCat === 'claim') ? (claimHits.length ? `<h2>依据 ${claimHits.length}</h2>${clipBlock(claimHits, claimCard)}` : (activeCat === 'claim' ? '<p class="empty">无依据命中。</p>' : '')) : ''}

      ${(showAll || activeCat === 'empress') ? (empressHits.length ? `<h2>后妃 ${empressHits.length}</h2>${timelineList(empressHits)}` : (activeCat === 'empress' ? '<p class="empty">无后妃命中。</p>' : '')) : ''}

      ${(showAll || activeCat === 'prince') ? (princeHits.length ? `<h2>皇子 ${princeHits.length}</h2><ul>${princeHits.map((row) => `<li><a href="#/person/${esc(row.person_id)}">${esc(row['规范名'].replace(/^爱新觉罗·/, ''))}</a> <span class="muted">${esc(row['表序标签'])}</span></li>`).join('')}</ul>` : (activeCat === 'prince' ? '<p class="empty">无皇子命中。</p>' : '')) : ''}

      ${(showAll || activeCat === 'princess') ? (princessHits.length ? `<h2>皇女 ${princessHits.length}</h2><ul>${princessHits.map((row) => `<li><a href="#/person/${esc(row.person_id)}">${esc(row['规范名'].replace(/^爱新觉罗氏/, ''))}</a> <span class="muted">${esc(row['表序标签'])}</span></li>`).join('')}</ul>` : (activeCat === 'princess' ? '<p class="empty">无皇女命中。</p>' : '')) : ''}

      ${(showAll || activeCat === 'heir') ? (heirHits.length ? `<h2>储位 ${heirHits.length}</h2>${heirList(heirHits)}` : (activeCat === 'heir' ? '<p class="empty">无储位命中。</p>' : '')) : ''}

      ${(showAll || activeCat === 'site') ? (siteHits.length ? `<h2>遗址今况 ${siteHits.length}</h2><div class="grid cards site-cards">${siteHits.map(siteCard).join('')}</div>` : (activeCat === 'site' ? '<p class="empty">无遗址今况命中。</p>' : '')) : ''}


      ${(showAll || activeCat === 'question') ? (questionHits.length ? `<h2>这类问题 ${questionHits.length}</h2><ul>${questionHits.map((hit) => `<li><a href="#/question/${esc(hit.id)}">${highlightHtml(hit.label, q)}</a> <span class="muted">${highlightHtml(hit.extra || '', q)}</span></li>`).join('')}</ul>` : (activeCat === 'question' ? '<p class="empty">无问题命中。</p>' : '')) : ''}

      ${(showAll || activeCat === 'lane') ? (laneHits.length ? `<h2>对照 ${laneHits.length}</h2>${laneHits.map(laneCard).join('')}` : (activeCat === 'lane' ? '<p class="empty">无对照命中。</p>' : '')) : ''}

      ${(showAll || activeCat === 'ziguangge') ? (zggHits.length ? `<h2>紫光阁 ${zggHits.length}</h2><ul>${clipBlock(zggHits, (hit) => `<li><a href="#/ziguangge/${esc(hit.id)}">${highlightHtml(hit.label, q)}</a> <span class="muted">${highlightHtml(hit.extra || '', q)}</span></li>`)}</ul>` : (activeCat === 'ziguangge' ? '<p class="empty">无紫光阁命中。</p>' : '')) : ''}

      ${(showAll || activeCat === 'work') ? `
        ${sourceHits.length ? `<h2>来源 ${sourceHits.length}</h2><ul>${sourceHits.map((row) => `<li><a href="#/source/${esc(row.source_id)}">${esc(row.source_id)} ${esc(row['机构或资源'])}</a></li>`).join('')}</ul>` : ''}
        ${workHits.length ? `<h2>文献 ${workHits.length}</h2><ul>${workHits.map((hit) => {
          const work = (DATA.works || []).find((row) => row.work_id === hit.id);
          const href = work?.dedicated_chapter ? `#/chapter/${work.dedicated_chapter}` : '#/works';
          return `<li><a href="${esc(href)}">${highlightHtml(hit.label, q)}</a> <span class="muted">${highlightHtml(hit.extra || '', q)}</span></li>`;
        }).join('')}</ul>` : ''}
        ${!sourceHits.length && !workHits.length && activeCat === 'work' ? '<p class="empty">无文献命中。</p>' : ''}
      ` : ''}
    `;
  }

  function howToReadPage() {
    const rules = [
      { id: 'how-1', num: '01', title: '先选一个问题', tag: '选题', text: '从讲解台选一组现成讲解，或从十二帝、读故事目录找到文章。一次先讲清一个问题：谁在什么时间做了什么，哪条材料能够支持。' },
      { id: 'how-2', num: '02', title: '看正文，再点依据', tag: '回查', text: '正文给出叙述，角标打开引文、原始纪年与出处。日期只记到年或月时，公历范围不是事件发生的确切一天。', list: [['机器检查通过', '只表示字段之间暂未发现矛盾，不等于已经与底本逐字核录。'], ['参考线索', '可以继续查证，讲解时要说明材料层级。'], ['存在异说', '先确认是否同一事件，再对照两种记载。']] },
      { id: 'how-3', num: '03', title: '边讲边展示原文', tag: '讲解', text: '讲解台左侧选择段落，中间预览观众画面，右侧查看主播提示。打开独立展示窗口后，把它作为直播画面；翻页会同步，个人笔记只留在主播侧。' },
      { id: 'how-4', num: '04', title: '分清材料在记录什么', tag: '史料', text: '实录、本纪、列传、笔记的编写背景和叙事目的不同。先看作者、成书时间与具体出处，再比较同一件事。材料详略不同，不自动构成冲突。咸安宫相关记载就是一个可练习的例子。' },
      { id: 'how-5', num: '05', title: '原典逐段读', tag: '选读', text: '「逐段读原典」是把原典分段，配上白话与解释。目录中的选读主题会定位到对应段落，适合备课时查一段，也适合讲解时补充一条证据。' },
      { id: 'how-6', num: '06', title: '把事实和解释说清楚', tag: '表达', text: '先说「某书某卷记载……」，再说「这可以怎样理解」。有争议的推断注明依据和缺口。目录标题、后出传闻和实录原文各有用途，不应都用同一种确定语气讲述。' },
      { id: 'how-7', num: '07', title: '图像也有出处', tag: '图像', text: '页面中的画像、实物和遗址照片附有来源。讲解时保留作品名称与出处，区分当时材料和后世图像。外链可访问，并不自动表示可以下载、剪辑或转播。' },
    ];

    return `
      <div class="reading page-intro">
        <p class="kicker">读法</p>
        <h1>选题与备讲</h1>
        <p class="lede">先从一篇文章开始。日子对得上，就写日子；材料有缺口，就把缺口说清楚。</p>
        ${crumbs([{ href: '#/', label: '十二帝' }, { label: '怎么读' }])}
      </div>

      <nav class="how-toc era-tab-bar" aria-label="本页小节">
        ${rules.map((r) => `<button type="button" class="era-tab-item" data-scroll="${r.id}">${r.num} ${esc(r.title)}</button>`).join('')}
      </nav>

      <section class="now-read card panel" style="padding: 24px; margin: 24px 0 36px; border: 1px solid var(--line); border-radius: 6px;">
        <div class="section-header">
          <h2 class="section-title"><span class="section-badge">实录</span>已系年的几处</h2>
          <p class="section-sub muted">和珅不是第五天处死的，继后那拉氏在官书里也没有被写成抗旨宫斗，十三日崩逝到二十日才举行即位礼。</p>
        </div>
        <div class="grid cards read-chapter-grid" style="margin-bottom: 0;">
          <article class="card chapter-item-card">
            <a class="chapter-item-link" href="#/chapter/jiaqing-04">
              <div class="chapter-item-meta"><span class="chapter-genre-tag tag-story">1796–99</span><span class="chapter-era-name">嘉庆朝</span></div>
              <h3 class="chapter-item-title">内禅之后：太上皇崩与和珅案</h3>
              <p class="chapter-item-lede">乾隆去世五日后下狱，十五日后赐死；二十条是上谕中的列罪，不是抄家清册。</p>
            </a>
          </article>
          <article class="card chapter-item-card">
            <a class="chapter-item-link" href="#/lane/QH-L-0033">
              <div class="chapter-item-meta"><span class="chapter-genre-tag tag-data">对照</span><span class="chapter-era-name">乾隆朝</span></div>
              <h3 class="chapter-item-title">继皇后那拉氏</h3>
              <p class="chapter-item-lede">官书有断发的叙述，但没有写成抗旨宫斗。姓氏有两说，不择其一。</p>
            </a>
          </article>
          <article class="card chapter-item-card">
            <a class="chapter-item-link" href="#/chapter/yongzheng-07">
              <div class="chapter-item-meta"><span class="chapter-genre-tag tag-story">1722</span><span class="chapter-era-name">康雍之际</span></div>
              <h3 class="chapter-item-title">从十三日崩逝到二十日即位</h3>
              <p class="chapter-item-lede">十三日记口谕与遗诏，二十日举行即位礼。</p>
            </a>
          </article>
        </div>
      </section>

      <div class="how-rules-list">
        ${rules.map((r) => `
          <article class="card how-rule-card" id="${r.id}">
            <div class="how-card-head">
              <span class="how-rule-num">${r.num}</span>
              <h2 class="how-rule-title">${esc(r.title)}</h2>
              <span class="how-rule-tag">${esc(r.tag)}</span>
            </div>
            <div class="how-card-body">
              <p>${esc(r.text)}</p>
              ${r.list ? `<ul class="how-rule-list">${r.list.map(([label, desc]) => `<li><strong>${esc(label)}</strong>：${esc(desc)}</li>`).join('')}</ul>` : ''}
            </div>
          </article>
        `).join('')}
      </div>

      <p class="actions" style="margin-top: 40px;"><a class="link" href="#/chapter/yongzheng-04">大义觉迷录</a> · <a class="link" href="#/chapter/yongzheng-02">朱批三批</a> · <a class="link" href="#/chapter/kangxi-13">庭训格言</a> · <a class="link" href="#/chapter/daoguang-04">密匣两启</a> · <a class="link" href="#/chapter/xianfeng-01">咸丰遗诏</a> · <a class="link" href="#/chapter/xuantong-01">退位诏</a> · <a class="link" href="#/path">转轴</a> · <a class="link" href="#/overview">全朝通览</a></p>
    `;
  }

  function zggHref(query = {}, extra = {}) {
    const params = new URLSearchParams();
    const merged = { ...query, ...extra };
    for (const key of ['q', 'batch', 'campaign', 'banner']) {
      const value = String(merged[key] || '').trim();
      if (value && value !== '全部') params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `#/ziguangge?${qs}` : '#/ziguangge';
  }

  function zggHeroes() {
    return DATA.ziguanggeHeroes || [];
  }

  function zggImg(row, opts = {}) {
    const kind = row['图像类型'];
    const src = row['预览文件'];
    if (kind === '缺图' || !src) {
      return `<div class="zgg-ph" role="img" aria-label="缺图">缺图<span>未见公版原图，列入生成队列</span></div>`;
    }
    const badge = kind === '生成'
      ? '<em class="zgg-badge zgg-gen">据史料描述生成，非原像</em>'
      : '<em class="zgg-badge zgg-orig">公版传世像</em>';
    return `<figure class="zgg-pic">${imgTag(src, `${row['姓名']}（${kind}）`, {
      width: opts.width || 360,
      height: opts.height || 480,
      lightbox: `${row['姓名']} · ${kind}`,
      sizes: opts.sizes || '(max-width: 600px) 45vw, 220px',
      eager: opts.eager,
    })}${badge}</figure>`;
  }

  function zggMatch(row, query) {
    const q = normalize(query.q || '');
    if (q) {
      const hay = normalize([row['姓名'], row['满蒙回名'], row['旗籍身份'], row['批次'], row['战役'], row.slug, row['像赞原文']].join(' '));
      if (!hay.includes(q)) return false;
    }
    if (query.batch && query.batch !== '全部' && row['批次'] !== query.batch) return false;
    if (query.campaign && query.campaign !== '全部' && row['战役'] !== query.campaign) return false;
    if (query.banner && query.banner !== '全部' && !String(row['旗籍身份'] || '').includes(query.banner)) return false;
    return true;
  }

  function zggCard(row) {
    return `<article class="zgg-card" id="${esc(row.slug)}">
      <a class="zgg-card-link" href="#/ziguangge/${esc(row.slug)}">
        ${zggImg(row)}
        <h3>${esc(row['姓名'])}</h3>
        <p class="zgg-meta">${esc(row['批次'])}第${esc(row['名次'])}名 · ${esc(row['战役'])}</p>
        ${row['满蒙回名'] ? `<p class="muted">${esc(row['满蒙回名'])}</p>` : ''}
        <p class="zgg-banner">${esc(row['旗籍身份'] || '')}</p>
      </a>
      <blockquote class="zgg-zan">${esc(row['像赞原文'] || '未见御制赞回库')}</blockquote>
      <p class="zgg-zan-type">${esc(row['像赞类型'])}</p>
    </article>`;
  }

  function zggPersonPage(slug) {
    const row = zggHeroes().find((item) => item.slug === slug);
    if (!row) {
      return `<div class="reading"><p class="kicker">紫光阁</p><h1>未找到该人物</h1><p><a class="link" href="#/ziguangge">← 名册</a></p></div>`;
    }
    const list = zggHeroes();
    const idx = list.findIndex((item) => item.slug === slug);
    const prev = idx > 0 ? list[idx - 1] : null;
    const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
    const zanLabel = row['像赞类型'] === '御制' ? '乾隆御制像赞' : row['像赞类型'] === '儒臣代撰' ? '儒臣代撰像赞（非御制）' : '乾隆点评';
    return `
      <div class="reading page-intro">
        <p class="kicker">紫光阁功臣</p>
        <h1>${esc(row['姓名'])}</h1>
        <p class="lede">${esc(row['满蒙回名'] || row['旗籍身份'] || '')}</p>
        ${crumbs([
          { href: '#/', label: '十二帝' },
          { href: '#/qianlong', label: '乾隆' },
          { href: '#/ziguangge', label: '紫光阁功臣' },
          { label: row['姓名'] },
        ])}
      </div>
      <article class="zgg-detail">
        <div class="zgg-detail-visual">
          ${zggImg(row, { width: 640, height: 860, eager: true, sizes: '(max-width: 720px) 90vw, 360px' })}
          <p class="zgg-rights">${esc(row['权利状态'] || '')}${row['图像来源'] ? ` · <a href="${esc(row['图像来源'])}" rel="noopener">${esc(row['图像类型'] === '原图' ? '文件页' : '说明')}</a>` : ''}</p>
          <p class="muted">${esc(row['图像说明'] || '')}</p>
          ${row.visual_brief ? `<p class="zgg-visual">${esc(row.visual_brief)}</p>` : ''}
        </div>
        <div class="zgg-detail-body">
          <p class="zgg-meta">${esc(row['旗籍身份'] || '旗籍待核')}</p>
          <h2>位列紫光阁的理由</h2>
          <p>${esc(row['位列理由'])}</p>
          <h2>${esc(zanLabel)}</h2>
          <blockquote class="zgg-zan">${esc(row['像赞原文'] || '未见御制赞，本库未回对应文集，不臆补。')}</blockquote>
          <p class="cite">${esc(row['像赞出处'] || '')}</p>
          <h2>事迹</h2>
          <p>${esc(row['事迹'])}</p>
          <p class="cite">${esc(row['事迹出处'] || '')}</p>
          <p class="actions">
            <a class="link" href="#/chapter/qianlong-ziguangge">制度说明</a>
            <a class="link" href="#/chapter/qianlong-06">十全武功</a>
            <a class="link" href="#/ziguangge">全部名册</a>
          </p>
        </div>
      </article>
      <nav class="zgg-pager" aria-label="相邻功臣">
        ${prev ? `<a href="#/ziguangge/${esc(prev.slug)}">上一名 ${esc(prev['姓名'])}</a>` : '<span></span>'}
        ${next ? `<a href="#/ziguangge/${esc(next.slug)}">下一名 ${esc(next['姓名'])}</a>` : '<span></span>'}
      </nav>
    `;
  }

  function ziguanggePage(slug, query = {}) {
    if (slug) return zggPersonPage(slug);
    const all = zggHeroes();
    const batches = DATA.ziguanggeBatches || [];
    const shown = all.filter((row) => zggMatch(row, query));
    const campaigns = [...new Set(all.map((row) => row['战役']).filter(Boolean))];
    const banners = ['满洲', '蒙古', '汉军', '汉', '回部', '索伦', '喀尔喀', '卫拉', '厄鲁特'];
    const core = all.filter((row) => row['完整度'] === '核心').length;
    const orig = all.filter((row) => row['图像类型'] === '原图').length;
    const gen = all.filter((row) => row['图像类型'] === '生成').length;
    const miss = all.filter((row) => row['图像类型'] === '缺图').length;
    const grouped = new Map();
    for (const row of shown) {
      const key = row['批次'];
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    }
    return `
      <div class="reading page-intro zgg-intro">
        <p class="kicker">乾隆 · 紫光阁</p>
        <h1>功臣像：二百八十人</h1>
        <p class="lede">西师事后图形紫光阁。前五十御制赞，后五十儒臣缀辞，合计百人，本库已列全。金川一百、台湾五十、廓尔喀三十先给名次骨架。缅甸、安南未见独立全名单。</p>
        ${crumbs([{ href: '#/', label: '十二帝' }, { href: '#/qianlong', label: '乾隆' }, { label: '紫光阁功臣' }])}
        <p class="zgg-complete">完整度：核心 ${core} 人已上赞文；后一百八十人是目录骨架。图像：原图 ${orig}，生成图 ${gen}，缺图 ${miss}。生成图一律标「据史料描述生成，非原像」。</p>
        <p class="actions">
          <a class="link" href="#/chapter/qianlong-ziguangge">制度与赞文边界</a>
          <a class="link" href="#/chapter/qianlong-06">十全武功专章</a>
        </p>
      </div>
      <nav class="zgg-toc" aria-label="批次目录">
        ${batches.map((row) => `<button type="button" class="link" data-scroll="batch-${esc(row.batch_id)}">${esc(row['批次'])}<i>${esc(row['人数'])}</i></button>`).join('')}
      </nav>
      <form class="zgg-filters" role="search" data-zgg-form>
        <label>姓名或旗籍 <input type="search" name="q" value="${esc(query.q || '')}" placeholder="傅恒、海兰察、索伦"></label>
        <label>批次
          <select name="batch">
            <option value="">全部批次</option>
            ${batches.map((row) => `<option value="${esc(row['批次'])}" ${query.batch === row['批次'] ? 'selected' : ''}>${esc(row['批次'])}</option>`).join('')}
          </select>
        </label>
        <label>战役
          <select name="campaign">
            <option value="">全部战役</option>
            ${campaigns.map((name) => `<option value="${esc(name)}" ${query.campaign === name ? 'selected' : ''}>${esc(name)}</option>`).join('')}
          </select>
        </label>
        <label>旗籍
          <select name="banner">
            <option value="">全部旗籍</option>
            ${banners.map((name) => `<option value="${esc(name)}" ${query.banner === name ? 'selected' : ''}>${esc(name)}</option>`).join('')}
          </select>
        </label>
        <button type="submit">筛选</button>
      </form>
      <p class="muted">当前显示 ${shown.length} / ${all.length} 人。每人可深链到 <code>#/ziguangge/姓名罗马化</code>。</p>
      ${shown.length ? [...grouped.entries()].map(([batch, rows]) => {
        const meta = batches.find((item) => item['批次'] === batch) || {};
        return `<section class="zgg-batch" id="batch-${esc(meta.batch_id || batch)}">
          <h2>${esc(batch)} <span class="muted">${esc(meta['年代'] || '')} · ${esc(meta['赞文性质'] || '')} · ${esc(meta['完整度'] || '')}</span></h2>
          <p class="cite">${esc(meta['说明'] || '')}</p>
          <div class="zgg-grid">${rows.map(zggCard).join('')}</div>
        </section>`;
      }).join('') : '<p class="empty">没有符合筛选的功臣。</p>'}
    `;
  }

  function changelogPage() {
    const release = DATA.release || {};
    const entries = release.entries || [];
    const updatedAt = release.updatedAt ? `最近构建 ${esc(release.updatedAt)}` : '';
    return `
      <div class="reading">
        <p class="kicker">清史读本</p>
        <h1>更新日志</h1>
        <p class="lede">当前版本 <strong>v${esc(release.version || '—')}</strong>${updatedAt ? ` · ${updatedAt}` : ''}。数据覆盖（章节、主张、人物等）变化时，构建流程会自动递增补丁号并写入本页。</p>
      </div>
      <div class="changelog-list">
        ${entries.length
          ? entries.map((entry) => `
            <section class="changelog-entry">
              <h2>v${esc(entry.version)} <span class="muted">${esc(entry.date || '')}</span></h2>
              <ul>${(entry.changes || []).map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
            </section>
          `).join('')
          : '<p class="empty">尚无发布记录。</p>'}
      </div>
      <p class="actions"><a class="link" href="https://github.com/zonglinxie-cyber/qing-history-evidence-base/blob/main/CHANGELOG.md" target="_blank" rel="noopener">仓库 CHANGELOG.md</a></p>
    `;
  }


  function titleFromHtml(html) {
    const raw = String(html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '';
    return raw.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  }

  function dataPage() {
    return `
      <p class="kicker">数据</p>
      <h1>原始数据表</h1>
      <p class="lede">站点不再镜像整表，也不再派生 SQLite。权威 CSV 只存在仓库 <code>data/</code> 目录。</p>
      <p class="actions"><a class="link" href="https://github.com/zonglinxie-cyber/qing-history-evidence-base/tree/main/data" rel="noopener">data/</a></p>
    `;
  }

  let renderGen = 0;
  let prevView = null;
  let renderedRoute = '';
  let lastSearch = null;
  const searchPositions = new Map();
  window.addEventListener('scroll', () => {
    if (prevView === 'search' && renderedRoute) searchPositions.set(renderedRoute, window.scrollY);
  }, { passive: true });
  let cleanupStudio = () => {};
  async function render() {
    const gen = ++renderGen;
    closeDrawer();
    cleanupStudio();
    cleanupStudio = () => {};
    cleanupReader();
    cleanupReader = () => {};
    const { parts, query, path } = parseHash();
    document.body.dataset.surface = parts[0] === 'screen' ? 'screen' : '';
    // #/images 是像与物的旧地址。站点公开发布过，外部可能还有老链接，
    // 所以留一行改道，而不是让它落到「未找到该页面」。
    if (parts[0] === 'images') {
      location.replace(`#/hands${location.hash.includes('?') ? `?${location.hash.split('?')[1]}` : ''}`);
      return;
    }
    setNav(path === '/' ? '/' : `/${parts[0]}`);
    const view = parts[0] || '';
    const isHome = !view;
    if (isHome && main.dataset.ssr === 'home') delete main.dataset.ssr;
    if (view === 'search' && !loadedChunks.has('search')) {
      main.innerHTML = '<p class="kicker">检索</p><h1>检索中…</h1>';
    }
    let studio;
    try {
      const loaded = await Promise.all([ensureView(view), view === 'studio' || view === 'screen' ? ensureStudio() : null]);
      studio = loaded[1];
    } catch (err) {
      if (gen !== renderGen) return;
      console.error(err);
      main.innerHTML = '<section class="load-error reading"><p class="kicker">稍等一下</p><h1>这一页暂时没有打开</h1><p>可能是连接中断，已加载的内容和阅读记录仍保留。</p><div class="actions"><button type="button" class="reader-tool-btn" data-retry-view>重新加载这一页</button><a class="link" href="#/">返回十二帝</a></div></section>';
      return;
    }
    if (gen !== renderGen) return;
    let html = '';
    if (isHome) html = home();
    else if (DYNASTY.eras[view]) html = eraPage(view);
    else if (view === 'people') html = peoplePage(query);
    else if (view === 'person') html = personPage(parts[1]);
    else if (view === 'claims') html = claimsPage(query);
    else if (view === 'claim') html = claimPage(parts[1]);
    else if (view === 'read') html = readCatalogPage();
    else if (view === 'studio' || view === 'screen') html = studio.studioPage(DATA, parts[1], query, view === 'screen');
    else if (view === 'chapter') {
      await loadChapterBody(parts[1]);
      if (gen !== renderGen) return;
      html = chapterPage(parts[1]);
    }
    else if (view === 'questions') html = questionsPage(query);
    else if (view === 'question') html = questionPage(parts[1]);
    else if (view === 'image') html = imagePage(parts[1]);
    else if (view === 'hands') html = handsPage(query);
    else if (view === 'sites') html = sitesPage(query);
    else if (view === 'site') html = sitePage(parts[1]);
    else if (view === 'lanes') html = lanesPage(query);
    else if (view === 'lane') html = lanePage(parts[1]);
    else if (view === 'empresses') html = empressesPage(query);
    else if (view === 'princes') html = princesPage(query);
    else if (view === 'princesses') html = princessesPage(query);
    else if (view === 'succession') html = successionPage(query);
    else if (view === 'sources') html = sourcesPage();
    else if (view === 'works') html = worksPage(query);
    else if (view === 'source') html = sourcePage(parts[1]);
    else if (view === 'search') {
      lastSearch = { href: location.hash, q: query.q || '' };
      searchInput.value = query.q || '';
      html = searchPage(query.q || '', query);
    }
    else if (view === 'how') html = howToReadPage();
    else if (view === 'changelog') html = changelogPage();
    else if (view === 'material') html = materialPage();
    else if (view === 'jiedu') html = jieduPage(query);
    else if (view === 'path') html = pathPage();
    else if (view === 'spine') html = spinePage(parts[1]);
    else if (view === 'chronicle') html = chroniclePage(parts[1]);
    else if (view === 'overview') html = overviewPage(parts[1]);
    else if (view === 'exhibits') html = exhibitsPage();
    else if (view === 'exhibit') html = exhibitPage(parts[1]);
    else if (view === 'ziguangge') html = ziguanggePage(parts[1], query);
    else if (view === 'data') html = dataPage();
    else html = `<h1>未找到该页面</h1><p><a href="#/">← 首页</a></p>`;
    // 版心分档：读栏给纯文字页，表栏给分栏/年表，满栏只给卡片网格。
    // 原先只有朝代页和逐解收窄，其余一律 70rem 硬撑，右半边是空的。
    const FULL_VIEWS = new Set(['sites', 'works', 'people', 'princes', 'princesses', 'empresses', 'data', 'hands', 'read', 'studio', 'screen', 'exhibits', 'ziguangge']);
    const TABLE_VIEWS = new Set(['material', 'lanes', 'person', 'chronicle', 'claims', 'succession', 'search', 'sources', 'image', 'site', 'exhibit']);
    const isEmperorRoute = Boolean(DYNASTY.eras[view] || (view === 'person' && emperorByPerson.has(parts[1])));
    // 按内容性质分档，不按页面分：同一帝王的年号路由和旧人物路由共用 era 壳。
    main.dataset.layout = isHome || FULL_VIEWS.has(view)
      ? 'full'
      : view === 'chapter' ? (chapterIsShort((DATA.chapters || []).find((row) => row.slug === parts[1])) ? 'reading' : 'chapter')
      : view === 'how' ? 'how'
      : view === 'read' ? 'full'
      : isEmperorRoute ? 'era'
      : view === 'lanes' || view === 'lane' ? 'compare'
      : (TABLE_VIEWS.has(view) ? 'table' : 'reading');
    destroyOsdViewers();
    main.innerHTML = html;
    const pageTitle = titleFromHtml(html);
    document.title = pageTitle ? `${pageTitle} · 清史读本` : '清史读本';
    const live = document.getElementById('search-status');
    if (live) live.textContent = view === 'search' ? `检索「${query.q || ''}」已更新` : '';
    main.classList.remove('enter');
    void main.offsetWidth;
    main.classList.add('enter');
    const routeKey = location.hash || '#/';
    // 只有「同一页内换筛选」才保留当前滚动位置。
    // 原先所有路由都恢复 sessionStorage 里的旧位置，换页回来会落在半空中，像页面坏了。
    const skipTop = /[?&](src|vol|qtype|era|group|type)=/.test(routeKey) && prevView === view;
    prevView = view;
    renderedRoute = routeKey;
    const restoreY = view === 'search' ? searchPositions.get(routeKey) || 0 : 0;
    if (!skipTop) window.scrollTo(0, restoreY);
    main.focus({ preventScroll: true });
    initOsdViewers();
    highlightToc();
    mountReaderChrome(view, parts);
    if (view === 'studio' || view === 'screen') cleanupStudio = studio.mountStudio(main, DATA, parts[1], query, view === 'screen');
    if (query.focus && (view === 'chapter' || view === 'how')) focusPassage(query.focus);
  }

  function focusPassage(term) {
    const candidates = [...main.querySelectorAll('.md h2, .md h3, .md p, .md li, .how-body p, .how-body h2')];
    const matched = candidates.filter((el) => el.textContent.includes(term));
    const target = matched.sort((a, b) => a.textContent.length - b.textContent.length)[0];
    if (!target) return;
    let parent = target.parentElement;
    while (parent && parent !== main) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; }
    target.classList.add('passage-focus');
    target.setAttribute('tabindex', '-1');
    target.scrollIntoView({ behavior: 'instant', block: 'start' });
    target.focus({ preventScroll: true });
  }

  let tocObserver = null;
  function highlightToc() {
    if (tocObserver) {
      tocObserver.disconnect();
      tocObserver = null;
    }
    const toc = main.querySelector('.chapter-toc');
    if (!toc || typeof IntersectionObserver !== 'function') return;
    const buttons = [...toc.querySelectorAll('[data-scroll]')];
    const heads = buttons.map((btn) => document.getElementById(btn.getAttribute('data-scroll'))).filter(Boolean);
    if (!heads.length) return;
    tocObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      buttons.forEach((btn) => btn.classList.toggle('on', btn.getAttribute('data-scroll') === visible.target.id));
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
    heads.forEach((head) => tocObserver.observe(head));
  }

  /* ============================================================
     「殿本开卷」读者交互层
     版心鱼尾、卷轴进度、已读钤印、续读缎带、朱批、干支牌记
     ============================================================ */
  // 中文卷次：1→一 … 10→十 … 13→十三 … 21→二十一
  function numCn(n) {
    const d = '零一二三四五六七八九';
    if (n <= 10) return n === 10 ? '十' : d[n];
    if (n < 20) return `十${d[n % 10]}`;
    const t = Math.floor(n / 10);
    const r = n % 10;
    return `${d[t]}十${r ? d[r] : ''}`;
  }

  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 隐私模式下静默 */ }
    },
  };

  /* ---- 干支牌记：岁次与今日干支 ---- */
  const GAN = '甲乙丙丁戊己庚辛壬癸';
  const ZHI = '子丑寅卯辰巳午未申酉戌亥';
  function ganzhiToday() {
    const now = new Date();
    const yi = (((now.getFullYear() - 4) % 60) + 60) % 60;
    // 日柱以 2000-01-01（戊午，序 54）为锚，儒略日公式 (JDN+49)%60 可互证
    const days = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(2000, 0, 1)) / 86400000);
    const di = (((54 + days) % 60) + 60) % 60;
    return `岁在${GAN[yi % 10]}${ZHI[yi % 12]} · 今日${GAN[di % 10]}${ZHI[di % 12]}`;
  }
  function mountGanzhi() {
    const foot = document.querySelector('.foot');
    if (!foot || foot.querySelector('.foot-ganzhi')) return;
    const p = document.createElement('p');
    p.className = 'foot-ganzhi';
    p.textContent = ganzhiToday();
    foot.appendChild(p);
  }

  /* ---- 已读钤印 ---- */
  const READ_KEY = 'qh-read-v1';
  const LAST_KEY = 'qh-last-read-v1';
  const readSet = () => new Set(store.get(READ_KEY, []));
  function markRead(slug) {
    const set = readSet();
    if (set.has(slug)) return false;
    set.add(slug);
    store.set(READ_KEY, [...set]);
    return true;
  }
  function decorateReadLinks() {
    const set = readSet();
    if (!set.size) return;
    main.querySelectorAll('a[href^="#/chapter/"]').forEach((a) => {
      if (a.querySelector('img')) return;
      if (a.closest('.chapter-tools, .chapter-nav, .crumb-share')) return;
      const slug = a.getAttribute('href').match(/^#\/chapter\/([^/?#]+)/)?.[1];
      if (slug && set.has(slug)) a.classList.add('chapter-read');
    });
  }

  function highlightReignScroll() {
    const last = store.get(LAST_KEY, null);
    const era = last?.era;
    if (!era) return;
    main.querySelectorAll('.reign-seg').forEach((a) => {
      const title = a.getAttribute('title') || '';
      a.classList.toggle('on', title.startsWith(`${era} ·`) || title.startsWith(`${era} `));
    });
  }

  /* ---- 读者铬件（版心/卷轴/钤印）的挂载与清理 ---- */
  let cleanupReader = () => {};
  function removeReaderChrome() {
    document.querySelectorAll('body > .banxin, body > .juan-progress, body > .pi-trigger, body > .pi-pop').forEach((el) => el.remove());
  }

  function mountReaderChrome(view, parts) {
    cleanupReader();
    cleanupReader = () => {};
    removeReaderChrome();
    document.body.dataset.view = view || 'home';
    mountGanzhi();
    decorateReadLinks();
    if (view === 'chapter') mountChapterChrome(parts[1]);
    if (!view) {
      mountResume();
      highlightReignScroll();
    }
  }

  /* 首页续读缎带 */
  function mountResume() {
    const last = store.get(LAST_KEY, null);
    if (!last?.slug || !last?.title) return;
    const intro = main.querySelector('.page-intro');
    if (!intro || intro.querySelector('.resume-reading')) return;
    const count = readSet().size;
    const p = document.createElement('p');
    p.className = 'resume-reading';
    p.innerHTML = `<span class="resume-ribbon" aria-hidden="true"></span>`
      + `<a href="#/chapter/${esc(last.slug)}">续读 · ${esc(last.era || '')}「${esc(last.title)}」</a>`
      + (count ? `<span class="resume-meta">已读 ${count} 篇</span>` : '');
    intro.appendChild(p);
  }

  /* 章节页：版心鱼尾 + 卷轴进度 + 读讫钤印 + 朱批 */
  function mountChapterChrome(slug) {
    const shell = main.querySelector('.chapter-shell[data-chapter]');
    if (!shell) return;
    const juan = shell.dataset.juan || '';
    const era = shell.dataset.era || '';
    const title = shell.dataset.title || '';
    store.set(LAST_KEY, { slug, title, era, at: Date.now() });

    // 版心：鱼尾 + 书名 + 卷次 + 已展几分
    const banxin = document.createElement('div');
    banxin.className = 'banxin';
    banxin.setAttribute('aria-hidden', 'true');
    banxin.innerHTML = `<span class="banxin-yu"></span><span class="banxin-book">清史读本</span><span class="banxin-juan">${esc(juan)}</span><span class="banxin-prog"></span>`;
    document.body.appendChild(banxin);
    // 卷轴：页顶一线，前端轴头
    const juanBar = document.createElement('div');
    juanBar.className = 'juan-progress';
    juanBar.setAttribute('aria-hidden', 'true');
    juanBar.innerHTML = '<span class="juan-fill"></span>';
    document.body.appendChild(juanBar);
    const fill = juanBar.querySelector('.juan-fill');
    const prog = banxin.querySelector('.banxin-prog');
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 16);

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      raf(() => {
        ticking = false;
        const doc = document.documentElement;
        const max = Math.max(1, (doc.scrollHeight || 1) - (window.innerHeight || 1));
        const p = Math.min(1, Math.max(0, (window.scrollY || 0) / max)) || 0;
        fill.style.width = `${(p * 100).toFixed(2)}%`;
        prog.textContent = `已展${Math.round(p * 100)}%`;
        const past = (window.scrollY || 0) > 260;
        banxin.classList.toggle('on', past);
        juanBar.classList.toggle('on', past);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // 读讫：读者动过之后，「续读」入眼才算展卷讫。首屏看见不算。
    const seal = document.createElement('div');
    seal.className = 'duqi-seal';
    seal.textContent = '讫';
    seal.title = '此卷已展讫';
    const already = readSet().has(slug);
    let observer = null;
    let unbindArm = () => {};
    if (already) {
      shell.appendChild(seal);
    } else {
      const end = shell.querySelector('.chapter-next') || shell.lastElementChild;
      if (end && typeof IntersectionObserver === 'function') {
        let armed = false;
        let stamped = false;
        const endVisible = () => {
          const box = end.getBoundingClientRect();
          const vis = Math.max(0, Math.min(window.innerHeight || 0, box.bottom) - Math.max(0, box.top));
          return box.height > 0 && vis / box.height >= 0.25;
        };
        const finish = () => {
          if (stamped) return;
          if (!markRead(slug)) return;
          stamped = true;
          seal.classList.add('stamp');
          shell.appendChild(seal);
          observer?.disconnect();
        };
        const arm = () => {
          if (armed) return;
          armed = true;
          if (endVisible()) finish();
        };
        observer = new IntersectionObserver((entries) => {
          if (!armed || !entries.some((entry) => entry.isIntersecting)) return;
          finish();
        }, { threshold: 0.25 });
        observer.observe(end);
        window.addEventListener('scroll', arm, { once: true, passive: true });
        shell.addEventListener('pointerdown', arm, { once: true });
        unbindArm = () => {
          window.removeEventListener('scroll', arm);
          shell.removeEventListener('pointerdown', arm);
        };
      }
    }

    cleanupReader = () => {
      window.removeEventListener('scroll', onScroll);
      unbindArm();
      if (observer) observer.disconnect();
      removeReaderChrome();
    };

    mountZhupi(slug, shell);
  }

  /* ============================================================
     朱批：选中正文，落一笔朱砂
     存 localStorage，按「原文+前后文」锚回段落
     ============================================================ */
  const PI_KEY = 'qh-pi-v1';
  const piAll = () => store.get(PI_KEY, {});
  const piFor = (slug) => piAll()[slug] || [];
  function piPersist(slug, list) {
    const all = piAll();
    if (list.length) all[slug] = list; else delete all[slug];
    store.set(PI_KEY, all);
  }
  const piId = () => `pi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  // 把 .md 的文本节点串成一整段可检索文字，记下每个节点的区间
  function mdTextMap(md) {
    const nodes = [];
    let text = '';
    const walker = document.createTreeWalker(md, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.closest('.zhu-pi, script, style, .pi-list')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      nodes.push({ node, start: text.length, end: text.length + node.nodeValue.length });
      text += node.nodeValue;
    }
    return { nodes, text };
  }

  // 按全局区间给文本节点套朱批 span（可跨节点）
  function wrapPiRange(md, from, to, id) {
    const { nodes } = mdTextMap(md);
    let wrapped = 0;
    for (const item of nodes) {
      if (item.end <= from || item.start >= to) continue;
      const node = item.node;
      const localFrom = Math.max(0, from - item.start);
      const localTo = Math.min(node.nodeValue.length, to - item.start);
      const range = document.createRange();
      range.setStart(node, localFrom);
      range.setEnd(node, localTo);
      const span = document.createElement('span');
      span.className = 'zhu-pi';
      span.dataset.pi = id;
      span.tabIndex = 0;
      try {
        range.surroundContents(span);
        wrapped += 1;
      } catch { /* 跨越元素边界的零碎区间跳过 */ }
    }
    return wrapped;
  }

  function unwrapPi(root, id) {
    root.querySelectorAll(`.zhu-pi[data-pi="${CSS.escape(id)}"]`).forEach((el) => {
      el.replaceWith(...el.childNodes);
    });
  }

  // 用「原文 + 前后文」找回区间；找不到精确锚就退到原文首现
  function locatePi(md, ann) {
    const { text } = mdTextMap(md);
    const withCtx = `${ann.prefix || ''}${ann.exact}${ann.suffix || ''}`;
    let idx = text.indexOf(withCtx);
    if (idx >= 0) return { from: idx + (ann.prefix || '').length, to: idx + (ann.prefix || '').length + ann.exact.length };
    idx = text.indexOf(ann.exact);
    if (idx >= 0) return { from: idx, to: idx + ann.exact.length };
    return null;
  }

  function mountZhupi(slug, shell) {
    if (typeof document.createTreeWalker !== 'function' || typeof document.createRange !== 'function') return;
    const md = shell.querySelector('.md');
    if (!md || !md.tagName) return;
    let anns = piFor(slug);

    const renderList = () => {
      shell.querySelector('.pi-list')?.remove();
      if (!anns.length) return;
      const box = document.createElement('div');
      box.className = 'pi-list';
      box.innerHTML = `<h3>拙批 · ${anns.length}</h3><ol>${anns.map((ann) => `
        <li><span class="pi-list-quote" data-pi-jump="${esc(ann.id)}">${esc(ann.exact.slice(0, 24))}${ann.exact.length > 24 ? '…' : ''}</span>
        ${ann.note ? `<span class="pi-list-note">${esc(ann.note)}</span>` : ''}</li>`).join('')}</ol>`;
      shell.querySelector('.chapter-body')?.appendChild(box);
    };

    const restore = () => {
      for (const ann of anns) {
        const loc = locatePi(md, ann);
        if (loc) wrapPiRange(md, loc.from, loc.to, ann.id);
      }
      renderList();
    };
    restore();

    // 选中文字 → 浮出「批」钮
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'pi-trigger';
    trigger.textContent = '批';
    trigger.setAttribute('aria-label', '为所选文字加朱批');
    let pending = null; // { exact, prefix, suffix, rect }
    let draftId = null;

    const hideTrigger = () => { trigger.remove(); };
    const unwrapDraft = () => {
      if (!draftId) return;
      unwrapPi(md, draftId);
      draftId = null;
    };
    const onSelect = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { hideTrigger(); return; }
      const range = sel.getRangeAt(0);
      if (!md.contains(range.commonAncestorContainer)) { hideTrigger(); return; }
      const exact = sel.toString().trim();
      if (exact.length < 2 || exact.length > 120) { hideTrigger(); return; }
      const before = document.createRange();
      before.selectNodeContents(md);
      before.setEnd(range.startContainer, range.startOffset);
      const after = document.createRange();
      after.selectNodeContents(md);
      after.setStart(range.endContainer, range.endOffset);
      pending = {
        exact,
        prefix: before.toString().slice(-30),
        suffix: after.toString().slice(0, 30),
        rect: range.getBoundingClientRect(),
      };
      trigger.style.left = `${pending.rect.left + pending.rect.width / 2}px`;
      trigger.style.top = `${Math.max(44, pending.rect.top - 8)}px`;
      if (!trigger.isConnected) document.body.appendChild(trigger);
    };
    document.addEventListener('mouseup', onSelect);

    const closePop = () => { document.querySelector('.pi-pop')?.remove(); };

    const openPop = (rect, ann, onSave, onDelete, onCancel) => {
      closePop();
      const pop = document.createElement('div');
      pop.className = 'pi-pop';
      pop.setAttribute('role', 'dialog');
      pop.setAttribute('aria-label', '朱批');
      pop.innerHTML = `
        <p class="pi-quote">${esc(ann.exact.length > 60 ? `${ann.exact.slice(0, 60)}…` : ann.exact)}</p>
        <textarea placeholder="批一笔…（只存在本机）">${esc(ann.note || '')}</textarea>
        <div class="pi-actions">
          ${onDelete ? '<button type="button" class="pi-del">删批</button>' : ''}
          <button type="button" class="pi-cancel">作罢</button>
          <button type="button" class="pi-save">落笔</button>
        </div>`;
      document.body.appendChild(pop);
      const w = pop.offsetWidth;
      const h = pop.offsetHeight;
      pop.style.left = `${Math.min(Math.max(16, rect.left), window.innerWidth - w - 16)}px`;
      pop.style.top = `${Math.min(rect.bottom + 10, window.innerHeight - h - 16)}px`;
      const ta = pop.querySelector('textarea');
      ta.focus();
      pop.querySelector('.pi-cancel').addEventListener('click', () => { onCancel?.(); closePop(); });
      pop.querySelector('.pi-save').addEventListener('click', () => {
        onSave(ta.value.trim());
        closePop();
      });
      pop.querySelector('.pi-del')?.addEventListener('click', () => { onDelete(); closePop(); });
    };

    trigger.addEventListener('click', () => {
      if (!pending) return;
      const ann = { id: piId(), ...pending, note: '', at: Date.now() };
      delete ann.rect;
      draftId = ann.id;
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        const before = document.createRange();
        before.selectNodeContents(md);
        before.setEnd(range.startContainer, range.startOffset);
        const from = before.toString().length;
        wrapPiRange(md, from, from + range.toString().length, ann.id);
        sel.removeAllRanges();
      }
      hideTrigger();
      openPop(pending.rect, ann, (note) => {
        draftId = null;
        ann.note = note;
        anns = [...anns, ann];
        piPersist(slug, anns);
        renderList();
      }, null, unwrapDraft);
      pending = null;
    });

    // 点已有朱批 → 看批语 / 改 / 删
    const onPiClick = (event) => {
      const mark = event.target.closest?.('.zhu-pi');
      if (!mark || !shell.contains(mark)) return;
      const id = mark.dataset.pi;
      const ann = anns.find((item) => item.id === id);
      if (!ann) return;
      event.preventDefault();
      openPop(mark.getBoundingClientRect(), ann, (note) => {
        ann.note = note;
        piPersist(slug, anns);
        renderList();
      }, () => {
        anns = anns.filter((item) => item.id !== id);
        piPersist(slug, anns);
        unwrapPi(shell, id);
        renderList();
      });
    };
    shell.addEventListener('click', onPiClick);

    // 拙批清单跳转
    const onJump = (event) => {
      const jump = event.target.closest?.('[data-pi-jump]');
      if (!jump) return;
      const target = shell.querySelector(`.zhu-pi[data-pi="${CSS.escape(jump.dataset.piJump)}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    shell.addEventListener('click', onJump);

    const onKey = (event) => {
      if (event.key === 'Escape') { unwrapDraft(); closePop(); hideTrigger(); }
    };
    document.addEventListener('keydown', onKey);

    const prevCleanup = cleanupReader;
    cleanupReader = () => {
      prevCleanup();
      unwrapDraft();
      document.removeEventListener('mouseup', onSelect);
      document.removeEventListener('keydown', onKey);
      closePop();
    };
  }

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const q = searchInput.value.trim();
    hideSuggest();
    location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/';
  });
  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-zgg-form]');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    location.hash = zggHref({}, {
      q: data.get('q'),
      batch: data.get('batch'),
      campaign: data.get('campaign'),
      banner: data.get('banner'),
    });
  });

  const suggest = document.getElementById('suggest');
  let suggestItems = [];
  let suggestActive = -1;

  function debounce(fn, ms) {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  function searchSuggest(q) {
    const needle = normalize(q);
    if (!needle) return [];
    const rank = { person: 0, chapter: 1, site: 2, work: 3 };
    const rows = DATA.suggest || [];
    if (rows.length) {
      return rows
        .filter((row) => normalize(row.hay).includes(needle))
        .sort((a, b) => (rank[a.type] ?? 9) - (rank[b.type] ?? 9))
        .map((row) => ({
          type: row.type || 'person',
          id: row.id,
          label: row.label,
          extra: row.extra,
          href: row.href || `#/person/${row.id}`,
        }));
    }
    return lookupIndex(SEARCH, q)
      .filter((row) => ['person', 'chapter', 'site', 'work'].includes(row.type))
      .sort((a, b) => (rank[a.type] ?? 9) - (rank[b.type] ?? 9))
      .map((row) => {
        const href = row.type === 'chapter' ? `#/chapter/${row.id}`
          : row.type === 'site' ? `#/site/${row.id}`
            : row.type === 'work' ? '#/works'
              : `#/person/${row.id}`;
        return { type: row.type, id: row.id, label: row.label, extra: row.extra, href };
      });
  }

  function hideSuggest() {
    suggest.hidden = true;
    suggest.innerHTML = '';
    suggestItems = [];
    suggestActive = -1;
    searchInput.setAttribute('aria-expanded', 'false');
  }

  function renderSuggest(q) {
    const hits = searchSuggest(q).slice(0, 8);
    suggestItems = hits;
    suggestActive = -1;
    const kindLabel = { person: '人', chapter: '章', site: '地', work: '书' };
    if (!hits.length) {
      suggest.innerHTML = '<p class="suggest-empty">没有直接命中，回车可检索全站。</p>';
    } else {
      suggest.innerHTML = hits.map((hit, index) => `
        <a class="suggest-item" role="option" id="sug-${index}" href="${esc(hit.href)}">
          <span class="kind">${esc(kindLabel[hit.type] || '')}</span>
          <strong>${esc(hit.label)}</strong>
          <span class="muted">${esc(hit.extra || '')}</span>
        </a>`).join('')
        + `<button type="button" class="suggest-all" data-goto-search>全部检索「${esc(q)}」</button>`;
    }
    suggest.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
  }

  function moveSuggest(step) {
    if (!suggestItems.length) return;
    suggestActive = (suggestActive + step + suggestItems.length) % suggestItems.length;
    suggest.querySelectorAll('.suggest-item').forEach((el, index) => {
      el.classList.toggle('active', index === suggestActive);
    });
    searchInput.setAttribute('aria-activedescendant', `sug-${suggestActive}`);
  }

  searchInput.addEventListener('input', debounce(() => {
    const q = searchInput.value.trim();
    if (normalize(q)) {
      loadChunk('suggest').then(() => {
        if (searchInput.value.trim() === q && document.activeElement === searchInput) renderSuggest(q);
      }).catch(hideSuggest);
    } else hideSuggest();
  }, 300));
  searchInput.addEventListener('focus', () => {
    const q = searchInput.value.trim();
    if (normalize(q)) loadChunk('suggest').then(() => {
      if (searchInput.value.trim() === q && document.activeElement === searchInput) renderSuggest(q);
    }).catch(hideSuggest);
  });
  searchInput.addEventListener('keydown', (event) => {
    if (suggest.hidden) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); moveSuggest(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); moveSuggest(-1); }
    else if (event.key === 'Escape') { event.preventDefault(); hideSuggest(); }
    else if (event.key === 'Enter' && suggestActive >= 0) {
      event.preventDefault();
      const hit = suggestItems[suggestActive];
      hideSuggest();
      if (hit?.href) location.hash = hit.href;
    }
  });
  searchInput.addEventListener('blur', () => {
    setTimeout(() => { if (!suggest.contains(document.activeElement)) hideSuggest(); }, 150);
  });
  suggest.addEventListener('mousedown', (event) => event.preventDefault());
  suggest.addEventListener('click', (event) => {
    if (event.target.closest('[data-goto-search]')) {
      event.preventDefault();
      const q = searchInput.value.trim();
      hideSuggest();
      location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/';
    }
  });

  document.body.addEventListener('click', (event) => {
    const close = event.target.closest('[data-close]');
    if (close) {
      closeDrawer();
      return;
    }
    const scrollBtn = event.target.closest('[data-scroll]');
    if (scrollBtn) {
      const target = document.getElementById(scrollBtn.getAttribute('data-scroll'));
      if (target) {
        const jumpBar = document.querySelector('.era-section-jump');
        const jumpHeight = (jumpBar && window.getComputedStyle(jumpBar).position === 'sticky') ? jumpBar.getBoundingClientRect().height : 0;
        const head = document.querySelector('.masthead');
        const gap = jumpHeight ? (jumpHeight + 14) : ((head ? head.getBoundingClientRect().height : 0) + 12);
        const y = target.getBoundingClientRect().top + window.scrollY - gap;
        // 用 instant 不用 smooth：平滑滚动在部分环境下会被静默丢弃，
        // 页内跳转必须每次都落到位，动画不值得拿准确性换。
        window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
      }
      return;
    }
    const pin = event.target.closest('[data-pin-id]');
    if (pin) {
      const siteId = pin.getAttribute('data-pin-id');
      const targetCard = document.getElementById(siteId);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetCard.classList.add('highlight-pulse');
        setTimeout(() => targetCard.classList.remove('highlight-pulse'), 2500);
      } else {
        location.hash = `#/site/${siteId}`;
      }
      return;
    }
    const citeBtn = event.target.closest('[data-cite-claim]');
    if (citeBtn) {
      const claim = claimById.get(citeBtn.getAttribute('data-cite-claim'));
      const unit = claim ? unitById.get(claim['来源实体 ID']) : null;
      const text = claim ? citationText(claim, unit) : '';
      const origText = citeBtn.textContent;
      const done = () => {
        citeBtn.textContent = '✓ 已复制 GB/T 7714 引用';
        setTimeout(() => { citeBtn.textContent = origText; }, 2500);
      };
      if (text && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => { citeBtn.textContent = '请手动复制下方引用'; });
      } else {
        citeBtn.textContent = '请手动复制下方引用';
      }
      return;
    }
    if (event.target.closest('[data-retry-view]')) {
      render();
      return;
    }
    const retryChapter = event.target.closest('[data-retry-chapter]');
    if (retryChapter) {
      const slug = retryChapter.getAttribute('data-retry-chapter');
      const row = (DATA.chapters || []).find((item) => item.slug === slug);
      if (row) delete row.bodyHtml;
      render();
      return;
    }
    const clampBtn = event.target.closest('[data-clamp]');
    if (clampBtn) {
      const box = clampBtn.closest('.clamp');
      const open = box.classList.toggle('open');
      clampBtn.textContent = open ? '收起' : '展开';
      return;
    }
    const claimBtn = event.target.closest('[data-claim]');
    if (claimBtn) {
      const runIds = claimBtn.getAttribute('data-claim-run');
      if (runIds) {
        const list = runIds.split(',').map((id) => claimById.get(id)).filter(Boolean);
        if (list.length) renderClaimRunDrawer(list, claimBtn);
        return;
      }
      const claim = claimById.get(claimBtn.getAttribute('data-claim'));
      if (claim) renderClaimDrawer(claim, claimBtn);
      return;
    }
    const filter = event.target.closest('[data-filter]');
    if (filter) {
      const group = filter.getAttribute('data-filter');
      location.hash = group === '全部' ? '#/people' : `#/people?group=${encodeURIComponent(group)}`;
      return;
    }
    const srcBtn = event.target.closest('[data-src]');
    if (srcBtn) {
      const id = srcBtn.getAttribute('data-src');
      location.hash = id === '全部' ? '#/claims' : `#/claims?src=${encodeURIComponent(id)}`;
      return;
    }
    const volBtn = event.target.closest('[data-vol]');
    if (volBtn) {
      const id = volBtn.getAttribute('data-vol');
      const cur = parseHash().query.src || '';
      location.hash = id === '全部'
        ? `#/claims?src=${encodeURIComponent(cur)}`
        : `#/claims?src=${encodeURIComponent(cur)}&vol=${encodeURIComponent(id)}`;
      return;
    }
    const qtype = event.target.closest('[data-qtype]');
    if (qtype) {
      const id = qtype.getAttribute('data-qtype');
      location.hash = id === '全部' ? '#/questions' : `#/questions?type=${encodeURIComponent(id)}`;
      return;
    }
    const laneFilter = event.target.closest('[data-lane]');
    if (laneFilter) {
      const id = laneFilter.getAttribute('data-lane');
      location.hash = id === '全部' ? '#/lanes' : `#/lanes?lane=${encodeURIComponent(id)}`;
      return;
    }
    const empressEra = event.target.closest('[data-empress-era]');
    if (empressEra) {
      const era = empressEra.getAttribute('data-empress-era');
      location.hash = era === 'yongzheng' ? '#/empresses?era=yongzheng' : '#/empresses';
      return;
    }
    const empressFilter = event.target.closest('[data-empress]');
    if (empressFilter) {
      const id = empressFilter.getAttribute('data-empress');
      const { query } = parseHash();
      location.hash = eraHref('#/empresses', query, { person: id });
      return;
    }
    const princeEra = event.target.closest('[data-prince-era]');
    if (princeEra) {
      const era = princeEra.getAttribute('data-prince-era');
      location.hash = era === 'yongzheng' ? '#/princes?era=yongzheng' : '#/princes';
      return;
    }
    const princeFilter = event.target.closest('[data-prince]');
    if (princeFilter) {
      const id = princeFilter.getAttribute('data-prince');
      const { query } = parseHash();
      location.hash = eraHref('#/princes', query, { status: id });
      return;
    }
    const princessEra = event.target.closest('[data-princess-era]');
    if (princessEra) {
      const era = princessEra.getAttribute('data-princess-era');
      location.hash = era === 'yongzheng' ? '#/princesses?era=yongzheng' : '#/princesses';
      return;
    }
    const princessFilter = event.target.closest('[data-princess]');
    if (princessFilter) {
      const id = princessFilter.getAttribute('data-princess');
      const { query } = parseHash();
      location.hash = eraHref('#/princesses', query, { status: id });
      return;
    }
    const searchCat = event.target.closest('[data-search-cat]');
    if (searchCat) {
      const cat = searchCat.getAttribute('data-search-cat');
      const { query } = parseHash();
      location.hash = cat === 'all'
        ? `#/search?q=${encodeURIComponent(query.q || '')}`
        : `#/search?q=${encodeURIComponent(query.q || '')}&cat=${encodeURIComponent(cat)}`;
      return;
    }
    const princeView = event.target.closest('[data-prince-view]');
    if (princeView) {
      const v = princeView.getAttribute('data-prince-view');
      const { query } = parseHash();
      location.hash = eraHref('#/princes', query, { status: query.status, view: v === 'tree' ? 'tree' : null });
      return;
    }
    const princessView = event.target.closest('[data-princess-view]');
    if (princessView) {
      const v = princessView.getAttribute('data-princess-view');
      const { query } = parseHash();
      location.hash = eraHref('#/princesses', query, { status: query.status, view: v === 'tree' ? 'tree' : null });
      return;
    }
    const stageFilter = event.target.closest('[data-stage]');
    if (stageFilter) {
      const id = stageFilter.getAttribute('data-stage');
      location.hash = id === '全部' ? '#/succession' : `#/succession?stage=${encodeURIComponent(id)}`;
      return;
    }
    const copyBtn = event.target.closest?.('[data-copy-citation]');
    if (copyBtn) {
      const cite = copyBtn.getAttribute('data-copy-citation');
      if (cite) {
        navigator.clipboard?.writeText(cite).then(() => {
          const orig = copyBtn.textContent;
          copyBtn.textContent = '已复制引用 ✓';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = orig;
            copyBtn.classList.remove('copied');
          }, 2000);
        }).catch(() => {});
      }
      return;
    }
    const setFs = event.target.closest?.('[data-set-fs]');
    if (setFs) {
      const s = setFs.getAttribute('data-set-fs');
      currentFs = s;
      preferences.set('fs', currentFs);
      applyFont(currentFs);
      return;
    }
    const row = event.target.closest('[data-href]');
    if (row && !event.target.closest('a, button')) location.hash = row.getAttribute('data-href');
  });

  const toTop = document.getElementById('to-top');
  window.addEventListener('scroll', () => {
    toTop.classList.toggle('show', window.scrollY > 600);
  }, { passive: true });
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const themeBtn = document.getElementById('theme-toggle');
  const THEME_CYCLE = ['auto', 'dark', 'light'];
  const THEME_LABEL = { auto: '自动', dark: '夜读', light: '日读' };
  function applyTheme(mode) {
    document.documentElement.classList.remove('dark', 'light');
    if (mode === 'dark') document.documentElement.classList.add('dark');
    else if (mode === 'light') document.documentElement.classList.add('light');
    if (themeBtn) themeBtn.textContent = THEME_LABEL[mode];
  }
  let currentTheme = preferences.get('theme', 'auto');
  if (!THEME_CYCLE.includes(currentTheme)) currentTheme = 'auto';
  applyTheme(currentTheme);
  themeBtn?.addEventListener('click', () => {
    const idx = THEME_CYCLE.indexOf(currentTheme);
    currentTheme = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    preferences.set('theme', currentTheme);
    applyTheme(currentTheme);
  });

  const fsBtn = document.getElementById('fs-toggle');
  const FS_CYCLE = ['m', 'l', 's'];
  const FS_LABEL = { s: '小', m: '中', l: '大' };
  function applyFont(size) {
    document.documentElement.classList.remove('fs-s', 'fs-l');
    if (size === 's' || size === 'l') document.documentElement.classList.add(`fs-${size}`);
    if (fsBtn) fsBtn.textContent = FS_LABEL[size] || '中';
    document.querySelectorAll('[data-set-fs]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-set-fs') === size);
    });
  }
  let currentFs = preferences.get('fs', 'm');
  if (!FS_CYCLE.includes(currentFs)) currentFs = 'm';
  applyFont(currentFs);
  fsBtn?.addEventListener('click', () => {
    currentFs = FS_CYCLE[(FS_CYCLE.indexOf(currentFs) + 1) % FS_CYCLE.length];
    preferences.set('fs', currentFs);
    applyFont(currentFs);
  });

  // 站内跳转兜底：内置预览面板（AI 页面可视化编辑器）会往页面里注入一段脚本，
  // 把**所有** href 以 # 开头的点击当成页内锚点 preventDefault 掉。本站是纯 hash 路由
  // （#/tianming、#/read、#/lanes…），于是在预览面板里点什么都不动。
  // preventDefault 只挡得住浏览器默认行为，挡不住 JS 主动赋值，所以这里补一条显式跳转。
  document.addEventListener('click', (event) => {
    const link = event.target.closest ? event.target.closest('a[href^="#/"]') : null;
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank') return;
    const want = link.getAttribute('href');
    if (!want || location.hash === want) return;
    event.preventDefault();
    location.hash = want;
  }, true);

  history.scrollRestoration = 'manual';
  window.addEventListener('hashchange', render);
  render();
