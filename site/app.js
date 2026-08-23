import {
  esc,
  canEmbed,
  canEmbedSite,
  siteCard,
  homeHtml,
  noOrphan,
  imgTag,
  largestVariant,
  noEvidenceBanner,
  researchDraftBanner,
  siteEraLabel,
  featuredSites as pickFeaturedSites,
  sortedSites as sortSites,
} from './templates.js';
import { normalize, lookup as lookupIndex, buildIndex } from './search.js';
import { EMPEROR_READS, EMPRESS_IDS, HEIR_THREADS, SOURCE_GROUPS, PATH_NODES, SPINE_POWER, SPINE_MONEY, ERA_PINNED, JIEDU_FEATURED, SITE_DETAILS } from './qing-content.mjs';

const DATA = {
  emperors: [],
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
  questions: [],
  predicates: {},
  coverage: {},
  notice: '',
  release: null,
  suggest: [],
  conflictSets: [],
  chronicle: [],
  overviews: [],
  raw: { tables: [] },
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
  chapter: ['home', REIGN_CHUNK],
  claims: ['home', REIGN_CHUNK, 'people'],
  claim: ['home', REIGN_CHUNK, 'people'],
  succession: ['home', REIGN_CHUNK],
  empresses: ['home', REIGN_CHUNK],
  princes: ['home', REIGN_CHUNK],
  princesses: ['home', REIGN_CHUNK],
  lanes: ['home', REIGN_CHUNK, 'people'],
  lane: ['home', REIGN_CHUNK, 'people'],
  questions: ['home', REIGN_CHUNK],
  question: ['home', REIGN_CHUNK],
  sources: ['home', 'catalog'],
  source: ['home', 'catalog', REIGN_CHUNK],
  works: ['home', REIGN_CHUNK],
  how: ['home'],
  changelog: ['home', 'release'],
  path: ['home', REIGN_CHUNK],
  spine: ['home', REIGN_CHUNK],
  chronicle: ['home', REIGN_CHUNK],
  overview: ['home', REIGN_CHUNK],
  data: ['raw'],
  review: [],
  search: ['home', 'people', REIGN_CHUNK, 'catalog', 'search'],
};

async function loadChunk(name) {
  if (loadedChunks.has(name)) return;
  if (inflightChunks.has(name)) return inflightChunks.get(name);
  const pending = fetch(`data/${name}.json${ASSET_V}`)
    .then((res) => {
      if (!res.ok) throw new Error(`无法载入 data/${name}.json`);
      return res.json();
    })
    .then((payload) => {
      if (name === 'search') SEARCH = payload.postings ? payload : buildIndex(payload.entries || []);
      else if (name === 'raw') DATA.raw = payload;
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
  const res = await fetch(`data/chapter/${encodeURIComponent(slug)}.json${ASSET_V}`);
  if (!res.ok) {
    if (row) {
      row.bodyHtml = `<p class="warn">正文加载失败，<button type="button" class="link" data-retry-chapter="${esc(slug)}">点此重试</button></p>`;
    }
    return;
  }
  const payload = await res.json();
  if (row) row.bodyHtml = payload.bodyHtml;
  else (DATA.chapters ||= []).push(payload);
}

function eraPage(slug) {
  const eraLabel = DYNASTY.eras[slug];
  if (!eraLabel) return `<h1>没有这个页面</h1><p class="actions"><a class="link" href="#/">回十二帝</a></p>`;
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

  const ROLE_GROUPS = [
    { role: '默认朝服像', title: '朝服像', hint: '' },
    { role: '其他真迹', title: '其他真迹', hint: '' },
    { role: '相关史迹', title: '相关史迹', hint: '今貌不能倒推当时战场。' },
    { role: '御笔书法', title: '御笔书法', hint: '碑是刻出来的，纸上才是手写。' },
    { role: '奏折朱批', title: '奏折与朱批', hint: '红笔是皇帝批的，黑字是臣工写的。' },
  ];

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

  function joinPublic(parts) {
    return parts.map((item) => String(item || '').trim()).filter((item) => item && item !== '待核').join(' · ');
  }

  function sourcePageLabel(portrait) {
    const url = portrait['文件页'] || '';
    if (/zh\.wikisource\.org/.test(url)) return '维基文库';
    if (/wikimedia\.org/.test(url)) return 'Wikimedia 文件页';
    if (/qingarchives\.npm/.test(url)) return '台北故宫清档';
    if (/digitalarchive\.npm|npm\.gov\.tw|npm\.edu\.tw/.test(url)) return '台北故宫';
    if (/dpm\.org\.cn/.test(url)) return '故宫';
    return '打开来源';
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

  function textMediaCard(row) {
    return `
      <article class="doc-card">
        <p class="muted">${esc(row['展示角色'])}</p>
        <strong>${esc(row['对象标题'])}</strong>
        ${transcriptionBlock(row)}
        <p class="actions">
          <a class="link" href="#/image/${esc(row.visual_id)}">看全文</a>
          ${safeUrl(row['文件页']) ? `<a class="link" href="${esc(safeUrl(row['文件页']))}" target="_blank" rel="noopener">${esc(sourcePageLabel(row))}</a>` : ''}
        </p>
      </article>`;
  }

  function groupedMedia(list) {
    return ROLE_GROUPS.map(({ role, title, hint }) => {
      const rows = list.filter((row) => row['展示角色'] === role);
      if (!rows.length) return '';
      const pics = rows.filter(canEmbed);
      const texts = rows.filter((row) => !canEmbed(row));
      return `
        <h2>${esc(title)}</h2>
        ${hint ? `<p class="muted">${esc(hint)}</p>` : ''}
        ${pics.length ? `<div class="thumbs">${pics.map(thumbCard).join('')}</div>` : ''}
        ${texts.map(textMediaCard).join('')}
        ${pics.filter((row) => row['释文']).map((row) => `
          <article class="doc-card">
            <strong>${esc(row['对象标题'])}</strong>
            ${transcriptionBlock(row)}
            <p class="actions">
              <a class="link" href="#/image/${esc(row.visual_id)}">看全文</a>
              <a class="link" href="${esc(safeUrl(row['文件页']))}" target="_blank" rel="noopener">${esc(sourcePageLabel(row))}</a>
            </p>
          </article>`).join('')}
      `;
    }).join('');
  }

  function personName(id) {
    const emperor = emperorByPerson.get(id);
    if (emperor) return emperor['年号或通称'].split('；')[0];
    const person = peopleById.get(id);
    if (person) return person['规范名'].replace(/^爱新觉罗·/, '');
    return id;
  }

  function personHref(id) {
    if (peopleById.has(id) || emperorByPerson.has(id)) return `#/person/${encodeURIComponent(id)}`;
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

  function statusChip(status) {
    const cls = status === '已核对' ? 'green' : status === '待进一步核对' ? 'amber' : 'indigo';
    return `<span class="chip ${cls}">${esc(status)}</span>`;
  }

  function predicateLabel(code) {
    return (DATA.predicates || {})[code] || code;
  }

  const EVIDENCE_HINT = {
    '已列原文': '能回到实录或本纪的具体条目',
    '已回原文': '能回到实录或本纪的具体条目',
    '存在异说': '同一件事有两种以上写法，并列保存',
    '两说并存': '同一件事有两种以上写法，并列保存',
    '参考线索': '依据后出史书或通行叙述，尚未对到日级原文',
    '后出转述': '依据后出史书或通行叙述，尚未对到日级原文',
    '尚不确定': '现有材料还不足以判定',
  };

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
    if (url.startsWith('#/')) return `<a class="link" href="${esc(url)}">打开本站条目</a>`;
    const safe = safeUrl(url);
    if (!safe) return '';
    return `<a class="link" href="${esc(safe)}" target="_blank" rel="noopener">打开来源</a>`;
  }

  function linkifyInternal(text) {
    return esc(text).replace(/#\/chapter\/[A-Za-z0-9-]+/g, (m) => `<a class="link" href="${m}">见本站章</a>`);
  }

  function laneCard(row) {
    return `
      <article class="lane-card" id="${esc(row.lane_id)}">
        <header>
          <strong><a href="#/lane/${esc(row.lane_id)}">${esc(row['标题'])}</a></strong>
          ${row['栏目'] ? `<span class="lane-chip">${esc(row['栏目'])}</span>` : ''}
        </header>
        <p class="muted">${lanePeople(row).map(personLink).join('、')}</p>
        <div class="split">
          <div class="said official">
            <div class="said-head"><span class="said-tag official-tag">官书 · 原文</span><h3>官书怎么写</h3></div>
            <p>${esc(row['官书或档案怎么写'])}</p>
          </div>
          <div class="said unofficial">
            <div class="said-head"><span class="said-tag unofficial-tag">通行说法 · 传闻</span><h3>通行说法</h3></div>
            <p>${esc(row['通行说法'])}</p>
            ${row['野史笔记或影视怎么写'] ? `<p class="muted">${esc(row['野史笔记或影视怎么写'])}</p>` : ''}
          </div>
        </div>
        <p><strong>怎么读</strong>　${linkifyInternal(row['差异或读法'])}</p>
        <p class="actions">
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
    const pathViews = new Set(['path', 'spine', 'chronicle']);
    document.querySelectorAll('.nav a').forEach((link) => {
      const href = (link.getAttribute('href') || '#/').replace(/^#/, '') || '/';
      const key = href.split('/').filter(Boolean)[0] || '';
      let on = false;
      if (!key) on = !current;
      else if (key === 'path') on = pathViews.has(current);
      else if (key === 'lanes') on = current === 'lanes' || current === 'lane';
      else if (key === 'sites') on = current === 'sites' || current === 'site';
      // 材料是一条轴，它下面四种材料页都算它亮
      else if (key === 'material') on = ['material', 'works', 'hands', 'jiedu', 'images', 'image'].includes(current);
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
    openDrawer(`
      <p class="kicker">依据</p>
      <h2>${esc(predicateLabel(claim['谓词/关系']))}</h2>
      <p class="quote">「${esc(claim['支持引文'])}」</p>
      <dl class="kv">
        <dt>谁</dt><dd>${personLink(claim['主体 ID'])}</dd>
        <dt>何事</dt><dd>${objectDisplay(claim)}</dd>
        <dt>纪年</dt><dd>${esc(claim['原始时间表达'])}</dd>
        <dt>公历</dt><dd>${esc(claim['公历下界'] || claim['公历上界'] || '尚未换算')}</dd>
        <dt>出处</dt><dd>${esc(claim['卷页/档号/图像定位'])}</dd>
        <dt>证据</dt><dd>${esc([claim['证据直接性'], claim['证据强度']].filter(Boolean).join(' · '))}</dd>
        <dt>核对</dt><dd>${esc(claim['公开状态'] || '待进一步核对')}</dd>
      </dl>
      ${unit ? `<p>${esc(unit['史料名'])} ${esc(unit['卷次'])} ${esc(unit['原纪年'])}${unit['当日条次'] ? ` · 第 ${esc(unit['当日条次'])} 条` : ''}</p>
        <p class="actions">
            <a class="link" href="${esc(safeUrl(unit['直接记录网址']))}" target="_blank" rel="noopener">打开原文</a>
          ${source ? `<a class="link" href="#/source/${esc(source.source_id)}">来源说明</a>` : ''}
          <button class="link" type="button" data-cite-claim="${esc(claim['Assertion ID'])}">复制引用条</button>
        </p>` : ''}
      <p class="actions">${reviewButton('claim', claim['Assertion ID'])}</p>
    `, trigger);
  }

  function citationText(claim, unit) {
    const book = unit?.['史料名'] || '';
    const juan = unit?.['卷次'] || '';
    const day = unit?.['原纪年'] || claim['原始时间表达'] || '';
    const seq = unit?.['当日条次'] ? `第 ${unit['当日条次']} 条` : '';
    const loc = claim['卷页/档号/图像定位'] || '';
    const id = claim['Assertion ID'] || '';
    return [book, juan, day, seq, loc, id].filter(Boolean).join('，');
  }

  function claimCard(claim) {
    const pred = predicateLabel(claim['谓词/关系']);
    return `
      <article class="claim" id="${esc(claim['Assertion ID'])}">
        <p class="sentence">${personLink(claim['主体 ID'])} ${esc(pred)} ${objectDisplay(claim)}</p>
        <div class="chips">${statusChip(claim['公开状态'] || '待进一步核对')}${claim['证据强度'] ? `<span class="chip">证据${esc(claim['证据强度'])}</span>` : ''}</div>
        <p class="sub">${esc(claim['原始时间表达'])}${claim['公历下界'] ? ` · ${esc(claim['公历下界'])}` : ''}${claim['冲突组 ID'] ? ' · 两说并存' : ''}</p>
        <p class="quote">「${esc(claim['支持引文'])}」</p>
        <p class="actions">
          <button class="link" data-claim="${esc(claim['Assertion ID'])}">看依据</button>
          ${reviewButton('claim', claim['Assertion ID'])}
        </p>
      </article>
    `;
  }

  function portraitBlock(portrait, extra = '', figureClass = '') {
    if (!portrait) return '';
    return `
      <figure class="portrait${figureClass ? ` ${figureClass}` : ''}">
        ${canEmbed(portrait)
          ? `<a href="#/image/${esc(portrait.visual_id)}">${mediaImg(portrait['预览文件'], portrait['对象标题'], portrait['对象标题'])}</a>`
          : `<a class="img-fallback" href="#/image/${esc(portrait.visual_id)}">${esc(portrait['对象标题'])}</a>`}
        <figcaption>
          <strong>${esc(portrait['对象标题'])}</strong>
          <p class="muted">${esc(joinPublic([portrait['展示角色'], portrait['制作年代或摄影日期']]))}</p>
          ${transcriptionBlock(portrait)}
          <p class="actions">
            ${portrait['释文'] ? `<a class="link" href="#/image/${esc(portrait.visual_id)}">看全文</a>` : ''}
            <a class="link" href="${esc(safeUrl(portrait['文件页']))}" target="_blank" rel="noopener">${esc(sourcePageLabel(portrait))}</a>
            ${extra}
          </p>
        </figcaption>
      </figure>
    `;
  }

  function annotationChips(portrait) {
    return (portrait['关键标注'] || '').split('；').filter(Boolean)
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
    { key: 'jiedu', href: '#/jiedu', title: '逐解', hint: '原典拆成短引，每段配白话、「为何这样写」和「不能写成」。' },
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

  // 「这一朝的材料」——朝代页原来一个字都没链到文献/真迹/逐解。
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
      ${sites.length ? `<h2>今天在哪儿</h2>
      <div class="grid cards site-cards">${sites.map(siteCard).join('')}</div>` : ''}
      <p class="bound">${esc(workLine)}日子还对不回去的，不编年表。</p>
      ${read?.evidenceNote ? `<details class="evidence-drawer"><summary>史料说明</summary><p>${esc(read.evidenceNote)}</p></details>` : ''}
      ${reignMaterialBlock(eraLabel)}`;
  }

  function reignMaterialBlock(eraLabel) {
    const e = reignRecord(eraLabel);
    if (!e) return '';
    const q = encodeURIComponent(eraLabel);
    const nWorks = (DATA.works || []).filter((w) => w.emperor_id === e.emperor_id).length;
    const nVisuals = (portraitsByEmperor.get(e.emperor_id) || []).filter(visualGroup).length;
    const nJiedu = (JIEDU_FEATURED || []).filter((x) => x.era === eraLabel).length;
    const bits = [
      nWorks ? `<a class="link" href="#/works?era=${q}">文献 ${nWorks} 种</a>` : '',
      nVisuals ? `<a class="link" href="#/hands?era=${q}">像与物 ${nVisuals} 件</a>` : '',
      nJiedu ? `<a class="link" href="#/jiedu?era=${q}">逐解 ${nJiedu} 篇</a>` : '',
    ].filter(Boolean);
    return bits.length ? `<h2>这一朝的材料</h2><p class="actions">${bits.join(' · ')}</p>` : '';
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
        <h1>这一朝留下了什么</h1>
        <p class="lede">三种材料：写下的书、留下的像与物、逐段的解读。先挑一种，或者直接从某一朝进去。</p>
      </div>
      <div class="mat-kinds">${MATERIAL_KINDS.map((k) => `
        <a class="mat-kind" href="${esc(k.href)}">
          <span class="mat-kind-n">${count[k.key]}</span>
          <h2>${esc(k.title)}</h2>
          <p>${esc(k.hint)}</p>
        </a>`).join('')}</div>
      <h2 class="mat-head">按朝看</h2>
      <div class="table-wrap"><table class="mat-table">
        <thead><tr><th>朝</th><th>文献</th><th>像与物</th><th>逐解</th></tr></thead>
        <tbody>${rows.map((r) => `
          <tr>
            <th scope="row"><a href="${esc(r.href)}">${esc(r.era)}<span>${esc(r.who)}</span></a></th>
            ${materialCell(r.works, 'works', r.era)}
            ${materialCell(r.visuals, 'hands', r.era)}
            ${materialCell(r.jiedu, 'jiedu', r.era)}
          </tr>`).join('')}</tbody>
      </table></div>
      <p class="actions"><a class="link" href="#/path">276 年转轴</a> · <a class="link" href="#/sources">用过哪些材料</a> · <a class="link" href="#/how">怎么读</a></p>
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

  // 逐解全部：首页只留六篇，其余从这里进。
  function jieduPage(query = {}) {
    const only = query.era || '';
    const rows = (JIEDU_FEATURED || []).filter((r) => !only || r.era === only);
    const groups = groupByReign(rows, (r) => r.era);
    return `
      <div class="reading">
        <p class="kicker">逐解</p>
        <h1>一部一部读</h1>
        <p class="lede">原典拆成短引，每段配白话、「为何这样写」、「今天怎么读」和「不能写成」。${only ? `${esc(only)}朝 ${rows.length} 篇。` : `共 ${rows.length} 篇，按朝排。`}</p>
        ${only ? `<p class="actions"><a class="link" href="#/jiedu">看全部 ${(JIEDU_FEATURED || []).length} 篇</a> · <a class="link" href="#/material">回材料</a></p>` : ''}
      </div>
      ${only ? '' : `<nav class="era-jump" aria-label="按朝跳转">${groups
        .map(([era, items]) => `<button type="button" data-scroll="jiedu-${esc(era)}">${esc(era)}<i>${items.length}</i></button>`).join('')}</nav>`}
      ${groups.map(([era, items]) => `
        ${reignHead(era, items.length, '篇', `jiedu-${era}`)}
        <ol class="threads">${items.map((item) => `
          <li>
            <a class="thread" href="${esc(item.href)}">
              <h2>${esc(item.title)}</h2>
              <p>${esc(item.text)}</p>
            </a>
          </li>`).join('')}</ol>`).join('')}
      <p class="actions">
        <a class="link" href="#/works">文献</a> ·
        <a class="link" href="#/lanes">说法对照</a> ·
        <a class="link" href="#/">回十二帝</a>
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
            <p>${esc((row['差异或读法'] || '').split('。')[0] || row['标题'])}</p>
          </a>
        </li>`).join('')}</ol>
    </section>`;
  }

  function relatedLinks(value) {
    const labels = {
      '#/kangxi': '康熙朝',
      '#/yongzheng': '雍正朝',
      '#/succession': '储位链',
      '#/empresses': '四后时间轴',
      '#/princes': '皇子表',
      '#/princesses': '皇女表',
      '#/lanes': '对照',
      '#/site/QH-ST-0013': '今地：畅春园',
      '#/site/QH-ST-0021': '景陵',
      '#/site/QH-ST-0022': '泰陵',
      '#/person/QH-P-000004': '胤礽',
      '#/person/QH-P-000002': '胤禛',
      '#/person/QH-P-000025': '乌雅氏',
      '#/claims': '依据',
      '#/works': '文献',
      '#/path': '转轴年',
      '#/spine/power': '继承与拍板',
      '#/spine/money': '饷和兵',
      '#/chronicle/kangxi': '康熙大事记',
    };
    return String(value || '').split(/[；;]/).map((item) => item.trim()).filter(Boolean)
      .map((href) => {
        let label = labels[href];
        if (!label) {
          const siteId = href.match(/^#\/site\/(QH-ST-\d+)$/)?.[1];
          const site = siteId && (DATA.sites || []).find((row) => row.site_id === siteId);
          if (site) label = `今地：${site['事件']}`;
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
        return `<a class="link" href="${esc(href)}">${esc(label || href.replace(/^#\//, ''))}</a>`;
      })
      .join(' · ');
  }

  function chaptersForPerson(personId) {
    return (DATA.chapters || [])
      .filter((row) => row.person_id === personId)
      .slice()
      .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
  }

  function lampChip(lamp) {
    if (!lamp) return '';
    return `<span class="lamp lamp-${esc(lamp)}">${esc(lamp)}</span>`;
  }

  function dynastyReadsBlock(emperor) {
    if (!emperor) return '';
    const ready = emperor.reads?.chapters?.length
      ? emperor.reads.chapters
      : chaptersForPerson(emperor.person_id).slice(0, 3).map((row) => ({
        slug: row.slug, title: row.title, lede: row.lede,
      }));
    const lane = emperor.reads?.lane || null;
    if (!ready.length && !lane) return '';
    return `
      <h2>这一朝可读</h2>
      <ol class="threads">
        ${ready.map((row) => {
          const full = (DATA.chapters || []).find((item) => item.slug === row.slug);
          const lede = row.lede || full?.lede || '';
          return `<li>
            <a class="thread" href="#/chapter/${esc(row.slug)}">
              <span class="thread-year">${esc(full?.era || '')}</span>
              <h2>${esc(row.title)}</h2>
              ${lede ? `<p>${esc(lede)}</p>` : ''}
            </a>
          </li>`;
        }).join('')}
      </ol>
      ${lane ? `<p class="actions"><a class="link" href="#/lane/${esc(lane.id)}">对照：${esc(lane.title)}</a></p>` : ''}`;
  }

  function emperorPack(read, emperor) {
    if (!read) return '';
    const hasPack = read.habits || read.policy || read.beats || read.problems;
    if (!hasPack) {
      return read.body ? `<div class="emperor-bio">${read.body.split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('')}</div>` : '';
    }
    const hasChronicle = chronicleRows(emperor.emperor_id).length > 0;
    const chronicleHref = hasChronicle && emperor.chronicleSlug ? `#/chronicle/${emperor.chronicleSlug}` : '';
    return `
      <div class="emperor-bio">${(read.body || '').split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      ${read.problems?.length ? `
        <h2>当时要解决什么</h2>
        <div class="pack-cards">
          ${read.problems.map((row) => `
            <article class="pack-card">
              <h3>${esc(row.title)}</h3>
              <p>${esc(row.text)}</p>
              ${row.href ? `<p class="actions"><a class="link" href="${esc(row.href)}">看这一段</a></p>` : ''}
            </article>`).join('')}
        </div>` : ''}
      ${read.habits?.length ? `
        <h2>见诸文书的习惯</h2>
        <ul class="habit-list">
          ${read.habits.map((row) => `
            <li>
              <p>${esc(row.text)}</p>
              <p class="sub">${esc(row.when)} · ${esc(row.layer)}</p>
              ${row.claim ? `<p class="actions"><button class="link" data-claim="${esc(row.claim)}">看依据</button></p>` : ''}
            </li>`).join('')}
        </ul>` : ''}
      ${read.policy?.length ? `
        <h2>施政</h2>
        <div class="policy-grid">
          ${read.policy.map((row) => `
            <article class="policy-cell">
              <p class="sub">${esc(row.key)}</p>
              <p>${esc(row.text)}</p>
              ${row.href ? `<p class="actions"><a class="link" href="${esc(row.href)}">打开</a></p>` : ''}
            </article>`).join('')}
        </div>` : ''}
      ${read.beats?.length ? `
        <h2>当时 · 做了什么 · 留下什么</h2>
        <ol class="beat-list">
          ${read.beats.map((row) => `
            <li>
              <p><strong>当时</strong>　${esc(row.problem)}</p>
              <p><strong>做了</strong>　${esc(row.did)}</p>
              <p><strong>留下</strong>　${esc(row.left)}</p>
              ${row.href ? `<p class="actions"><a class="link" href="${esc(row.href)}">看原文那一段</a></p>` : ''}
            </li>`).join('')}
        </ol>` : ''}
      ${read.later?.length ? `
        <h2>后人怎么评</h2>
        <ul class="later-list">${read.later.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}
      ${chronicleHref ? `<p class="actions"><a class="link" href="${esc(chronicleHref)}">这一朝大事记</a></p>` : ''}
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
    const site = row['今地ID'] ? `#/site/${row['今地ID']}` : '';
    const chapter = row['章节slug'] ? `#/chapter/${row['章节slug']}` : '';
    return `
      <article class="chronicle-item" id="${esc(row.entry_id)}">
        <p class="sub">${esc(row['原纪年'])}${row['公历下界'] ? ` · ${esc(row['公历下界'])}` : ''}${row['冲突组'] ? ' · 两说并存' : ''}</p>
        <h3>${esc(row['标题'])}</h3>
        <p>${esc(row['说明'])}</p>
        <p class="actions">
          ${claims.map((id) => `<button class="link" type="button" data-claim="${esc(id)}">看依据</button>`).join(' ')}
          ${chapter ? `<a class="link" href="${esc(chapter)}">章</a>` : ''}
          ${site ? `<a class="link" href="${esc(site)}">今地</a>` : ''}
        </p>
      </article>`;
  }

  function eraChronicleBlock(emperorId) {
    const all = chronicleRows(emperorId).filter((row) => row['年号级收录'] === '是');
    if (!all.length) return '';
    const prefer = new Set(['QH-CR-KX-0001', 'QH-CR-KX-0005', 'QH-CR-KX-0011', 'QH-CR-KX-0014', 'QH-CR-KX-0016']);
    const rows = all.filter((row) => prefer.has(row.entry_id));
    const shown = rows.length ? rows : all.slice(0, 5);
    const more = all.length > shown.length;
    const era = ((DATA.emperors || []).find((e) => e.emperor_id === emperorId)?.['年号或通称'] || '').split('；')[0];
    const href = (DATA.emperors || []).find((row) => row.emperor_id === emperorId)?.chronicleSlug
      ? `#/chronicle/${(DATA.emperors || []).find((row) => row.emperor_id === emperorId).chronicleSlug}`
      : '';
    return `
      <h2>这一朝大事</h2>
      <div class="chronicle-list">${shown.map(chronicleItem).join('')}</div>
      ${more && href ? `<p class="actions"><a class="link" href="${esc(href)}">其余 ${all.length - shown.length} 件</a></p>` : ''}
    `;
  }

  function pathPage() {
    return `
      <div class="reading">
        <p class="kicker">转轴</p>
        <h1>这几处转过轴</h1>
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
      <p class="actions"><a class="link" href="#/spine/power">谁坐龙椅，谁拍板</a> · <a class="link" href="#/spine/money">饷和兵</a> · <a class="link" href="#/hands">真迹手稿</a> · <a class="link" href="#/questions?type=%E8%AF%81%E6%8D%AE%E8%BE%B9%E7%95%8C">现有材料答不了</a></p>
    `;
  }

  function spinePage(slug) {
    if (slug === 'money') {
      return `
        <div class="reading">
          <p class="kicker">饷和兵</p>
          <h1>税从哪来，兵谁养</h1>
          <p class="lede">从三藩的藩饷、康熙遗诏中的河工岁费，到雍正的耗羡归公和咸丰朝湘军就地筹饷——这几条财政线索，条次没打开的，只当入口。</p>
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
        <p class="actions"><a class="link" href="#/path">转轴年</a> · <a class="link" href="#/spine/power">谁拍板</a></p>
      `;
    }
    if (slug && slug !== 'power') {
      return `<h1>还没有这条主轴</h1><p class="actions"><a class="link" href="#/path">回转轴年</a></p>`;
    }
    return `
      <div class="reading">
        <p class="kicker">继承与拍板</p>
        <h1>谁坐龙椅，不等于谁拍板</h1>
        <p class="lede">明立太子失败过，密旨后来才写成办法。禅了位，太上皇还在批折子，幼帝那几年，拍板的人另有其人。</p>
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
      <p class="actions"><a class="link" href="#/path">转轴年</a> · <a class="link" href="#/spine/money">饷和兵</a> · <a class="link" href="#/succession">康熙储位全链</a></p>
    `;
  }

  function chroniclePage(slug) {
    if (!slug) {
      return `<h1>还没有这份大事记</h1><p class="lede">要看哪一朝，写在地址后面。康熙有十六件。</p><p class="actions"><a class="link" href="#/chronicle/kangxi">康熙大事记</a> · <a class="link" href="#/">回十二帝</a></p>`;
    }
    const emperor = (DATA.emperors || []).find((row) => row.chronicleSlug === slug)
      || (DATA.emperors || []).find((row) => {
        const era = String(row['年号或通称'] || '').split('；')[0];
        return era === slug;
      });
    if (!emperor) {
      return `<h1>还没有这份大事记</h1><p class="actions"><a class="link" href="#/">回十二帝</a></p>`;
    }
    const rows = chronicleRows(emperor.emperor_id);
    const era = String(emperor['年号或通称'] || '').split('；')[0];
    const back = emperor.eraSlug || slug;
    if (!rows.length) {
      const opened = eraChapters(era);
      return `
        <div class="reading">
          <p class="kicker">${esc(era)}大事记</p>
          <h1>还没有逐日的官书条</h1>
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
      const year = String(row['公历下界'] || '').slice(0, 4) || '未系年';
      const list = byYear.get(year) || [];
      list.push(row);
      byYear.set(year, list);
    }
    return `
      <div class="reading">
        <p class="kicker">${esc(era)}大事记</p>
        <h1>日子对得上的 ${rows.length} 件</h1>
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

  function chapterReadBlock(personId) {
    const shown = new Set((emperorByPerson.get(personId)?.reads?.chapters || []).map((row) => row.slug));
    const chapters = chaptersForPerson(personId).filter((row) => !shown.has(row.slug));
    const extras = {
      'QH-P-000001': [['#/chapter/kangxi-02', '两废太子'], ['#/chapter/kangxi-01', '即位、崩逝与遗诏'], ['#/succession', '储位全链'], ['#/princes', '儿子怎么排'], ['#/princesses', '女儿怎么排']],
      'QH-P-000002': [['#/kangxi', '康熙朝的储位与对照'], ['#/lanes', '改诏、丹药等传闻']],
      'QH-P-000019': [['#/lane/QH-L-0033', '继皇后对照'], ['#/chapter/jiaqing-04', '内禅与和珅分日']],
      'QH-P-000053': [['#/lane/QH-L-0010', '出家说'], ['#/image/QH-V-E03C', '多尔衮令旨'], ['#/hands', '真迹手稿']],
      'QH-P-000054': [['#/lane/QH-L-0032', '和珅对照'], ['#/question/QH-GQ-0068', '八亿两答不了'], ['#/image/QH-V-E07B', '嘉庆朱批']],
      'QH-P-000051': [['#/chapter/nurhaci-01', '本纪怎么写称汗'], ['#/hands', '真迹手稿']],
      'QH-P-000052': [['#/chapter/huangtaiji-01', '汗位与帝位'], ['#/hands', '真迹手稿']],
      'QH-P-000055': [['#/chapter/daoguang-01', '议款这一句'], ['#/image/QH-V-E08C', '道光朱批']],
      'QH-P-000056': [['#/chapter/xianfeng-01', '幸木兰'], ['#/image/QH-V-E09C', '咸丰朱批']],
      'QH-P-000057': [['#/chapter/tongzhi-01', '祺祥不是纪年'], ['#/image/QH-V-E10C', '入承大统诏']],
      'QH-P-000058': [['#/chapter/guangxu-01', '继文宗为子'], ['#/image/QH-V-E11C', '光绪朱批']],
      'QH-P-000059': [['#/chapter/xuantong-01', '统治权公诸全国'], ['#/hands', '真迹手稿']],
    };
    const extra = (extras[personId] || []).filter(([href]) => {
      const slug = String(href).match(/^#\/chapter\/([^/?#]+)$/)?.[1];
      return !slug || !shown.has(slug);
    });
    if (!chapters.length && !extra.length) return '';
    return `
          <h2>其余篇目</h2>
          ${chapters.map((row) => `<p class="rel"><a href="#/chapter/${esc(row.slug)}">${esc(row.title)}</a></p>`).join('')}
          ${extra.map(([href, label]) => `<p class="rel"><a href="${esc(href)}">${esc(label)}</a></p>`).join('')}
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
    if (era === '康熙') {
      const bySlug = Object.fromEntries(chapters.map((row) => [row.slug, row]));
      const featured = [
        { slug: 'kangxi-02', year: '1675–1712', href: '#/chapter/kangxi-02' },
        { slug: 'kangxi-01', year: '1661 · 1722', href: '#/chapter/kangxi-01' },
        { year: '分日', href: '#/succession', title: '太子怎样立，怎样废', lede: '从择吉到再废，一天一天排下来。拘执那天还没颁诏，放出来也不等于又立回去。' },
        { year: '胤礽', href: '#/person/QH-P-000004', title: '胤礽', lede: '两岁被立，三十五岁再废。中间废过一次，又立过一次。' },
        { year: '后妃', href: '#/empresses', title: '康熙四后', lede: '活着的时候是妃、是后、是太后，孝恭两个字是死后才有的。' },
        { year: '皇子', href: '#/princes', title: '康熙的儿子', lede: '表上第一子是胤禔，但后妃传说承瑞才是长子。' },
        { year: '皇女', href: '#/princesses', title: '康熙的女儿', lede: '亲生二十人，受封八人；固伦若是追进，人已经不在了。' },
      ];
      const used = new Set(featured.map((item) => item.slug).filter(Boolean));
      return `<ol class="threads">${featured.map((item) => {
        const chapter = item.slug ? bySlug[item.slug] : null;
        return reignThreadItem(item.year, item.href, chapter?.title || item.title, chapter?.lede || item.lede);
      }).join('')}${chapters.filter((row) => !used.has(row.slug)).map((row) => reignThreadItem(row.era, `#/chapter/${row.slug}`, row.title, row.lede)).join('')}
      ${reignThreadItem('对照', '#/lanes', '野史怎么说，官书怎么写', '改诏、畅春园、后宫。通行说法和已经打开的官书放在一起。')}</ol>`;
    }
    if (era === '雍正') {
      return `<ol class="threads">${chapters.map((row) => reignThreadItem(row.era, `#/chapter/${row.slug}`, row.title, row.lede)).join('')}
        ${reignThreadItem('对照', '#/lanes', '改诏、丹药、吕四娘', '通行说法和官书原文放在一起，看差在哪里。')}</ol>`;
    }
    const pinned = ERA_PINNED[slug] || [];
    const pinnedHrefs = new Set(pinned.map((row) => row.href));
    const rest = chapters.filter((row) => !pinnedHrefs.has(`#/chapter/${row.slug}`));
    const items = [
      ...pinned.map((row) => reignThreadItem(row.year, row.href, row.title, row.text)),
      ...rest.map((row) => reignThreadItem(row.era, `#/chapter/${row.slug}`, row.title, row.lede)),
    ];
    return items.length ? `<ol class="threads">${items.join('')}</ol>` : '<p class="empty">这一朝还没有可读的章。</p>';
  }

  function portraitKind(portrait) {
    if (!portrait) return '';
    const blob = [portrait['图像性质'], portrait['制作年代或摄影日期'], portrait['作者或摄影者'], portrait['关键标注']].join('');
    if (/照片/.test(portrait['图像性质'] || '')) return '照片';
    if (/追绘/.test(blob)) return '后世追绘';
    if (/郎世宁/.test(blob)) return '郎世宁';
    if (/立像/.test(blob)) return '朝服立轴';
    return '朝服定妆';
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
      <div class="page-head story">
        <h1>全部今地</h1>
      </div>
      <p class="lede">每一处今地，都对应一段当时的记录。照片是今貌，不是历史现场。全库已收录 <strong>${allRows.length}</strong> 处关键历史地景。</p>
      <div class="filters site-filters" style="margin-bottom: 24px; display: flex; flex-wrap: wrap; gap: 8px;">
        ${SITE_CATEGORIES.map((item) => `<a href="#/sites?cat=${encodeURIComponent(item.label)}" class="facet-btn${item.label === activeCat ? ' active' : ''}">${esc(item.label)}</a>`).join('')}
      </div>
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
    if (!site) return `<h1>未找到今地 ${esc(id)}</h1><p><a href="#/">回首页</a></p>`;
    const emperors = splitIds(site['相关皇帝ID']).map((emperorId) => emperorByLegacy.get(emperorId)).filter(Boolean);
    const others = relatedSites(site);
    const hook = site['卡片钩子'] || site['事件'];
    return `
      <div class="site-page-shell">
        <p class="kicker">${esc(siteEraLabel(site))} · ${esc(site['事件'])}</p>
        <h1 class="site-page-title">${esc(hook)}</h1>
        <div class="image-meta-actions">
          ${reviewButton('site', id)}
          <a class="link" href="site/${esc(id)}/">可分享链接</a>
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
            ${emperors.length ? `<dl class="kv">
              <dt>相关</dt><dd>${emperors.map((emperor) => `<a href="#/person/${esc(emperor.person_id)}">${esc(emperor['年号或通称'].split('；')[0])}</a>`).join(' · ')}</dd>
            </dl>` : ''}
            <div class="actions">
              <a class="btn" href="#/sites">全部今地</a>
              ${emperors.length ? `<a class="btn" href="#/person/${esc(emperors[0].person_id)}">相关朝代</a>` : ''}
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
              <h2>别处今地</h2>
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
        <h1>人物</h1>
      </div>
      <p class="lede">雍正、胤禛、世宗，是同一个人。</p>
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


  function reignVisualSection(number, title, keys, rows) {
    const groups = VISUAL_GROUPS.filter((group) => keys.includes(group.key))
      .map((group) => ({ group, rows: rows.filter((row) => visualGroup(row)?.key === group.key) }))
      .filter((item) => item.rows.length);
    return `<section class="reign-section reign-visual" data-reign-part="${esc(title)}">
      <h2 class="reign-part">${number} ${esc(title)}</h2>
      ${groups.length ? groups.map(({ group, rows: items }) => {
        const pics = items.filter(canEmbed);
        const texts = items.filter((row) => !canEmbed(row));
        return `
          <h3>${esc(group.title)} <span class="muted">${items.length} 件</span></h3>
          ${pics.length ? `<div class="thumbs">${pics.map(thumbCard).join('')}</div>` : ''}
          ${texts.length ? texts.map(textMediaCard).join('') : ''}
        `;
      }).join('') : '<p class="empty">这一类材料目前尚未收录。</p>'}
    </section>`;
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
    const aliases = [emperor['规范名'], emperor['庙号']].filter(Boolean).join(' · ');
    return `
      <div class="era-shell emperor-page">
        <div class="era-main">
          <div class="reading">
            <p class="kicker">${esc(era)}</p>
            <h1>${esc(era)}</h1>
            <p class="lede">${esc(aliases)}</p>
            <p class="crumb"><a class="link" href="person/${esc(id)}/">可分享链接</a></p>
          </div>
          <section class="reign-section emperor-read" data-reign-part="人">
            <h2 class="reign-part">① 人</h2>
            ${portraitBlock(portrait, '', 'portrait-lead')}
            <dl class="kv vita-kv">
              <dt>生卒</dt><dd>${esc(emperor['生年'])}年–${esc(emperor['卒年'])}年${Number(emperor['卒年']) && Number(emperor['生年']) ? `（${Number(emperor['卒年']) - Number(emperor['生年']) + 1}岁）` : ''}</dd>
              <dt>在位</dt><dd>${esc(emperor['在位起'])}年–${esc(emperor['在位止'])}年</dd>
              ${father ? `<dt>父</dt><dd>${esc(father)}</dd>` : ''}
              ${mother ? `<dt>母</dt><dd>${esc(mother)}</dd>` : ''}
              ${emperor['陵寝'] ? `<dt>葬</dt><dd>${esc(emperor['陵寝'])}</dd>` : ''}
              ${emperor['谥号'] ? `<dt>谥号</dt><dd>${esc(emperor['谥号'])}</dd>` : ''}
            </dl>
            ${emperorPack(read, emperor)}
            ${(emperor.credibility?.claims || 0) === 0 ? noEvidenceBanner('还没有逐日的官书条', '这一朝目前只有骨架，日子还对不回去。') : ''}
            <p class="actions">${emperor['故宫人物页'] || card?.['故宫人物页'] ? `<a class="link" href="${esc(safeUrl(emperor['故宫人物页'] || card['故宫人物页']))}" target="_blank" rel="noopener">故宫人物页</a>` : ''}</p>
          </section>
          ${reignVisualSection('②', '相', ['court', 'life', 'photo', 'site'], visuals)}
          ${reignVisualSection('③', '笔', ['brush', 'rescript', 'edict'], visuals)}
          ${reignVisualSection('④', '物', ['object'], visuals)}
          <section class="reign-section" data-reign-part="事">
            <h2 class="reign-part">⑤ 事</h2>
            ${eraChronicleBlock(emperor.emperor_id)}
            ${reignEventsBlock(emperor)}
          </section>
        </div>
        <aside class="era-rail">
          <h2 class="reign-part">⑥ 料</h2>
          ${reignTail(era)}
          <p class="actions"><a class="link" href="#/works?era=${encodeURIComponent(era)}">文献</a> · <a class="link" href="#/jiedu?era=${encodeURIComponent(era)}">逐解</a><br><a class="link" href="#/lanes">对照</a> · <a class="link" href="#/path">转轴</a> · <a class="link" href="#/">回十二帝</a></p>
        </aside>
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
    return `
      <p class="kicker">${esc(person['人物类型'] || '人物')}</p>
      <h1>${esc(person['规范名'].replace(/^爱新觉罗·/, ''))}</h1>
      <p class="lede">${esc(person['常用名或异名'] || '')}</p>
      <p class="crumb"><a class="link" href="person/${esc(id)}/">可分享链接</a></p>
      ${personPortraitBlock(id)}
      <div class="reading">
        ${yinreng ? `<p class="lede">嫡子，两岁立为太子，做了三十三年。经历了废黜、复立、再废，而拘执、颁诏、告祭都不是同一天。</p>
        <details class="evidence-drawer"><summary>史料说明</summary><p>实录在再废当日记拘执与废黜；咸安宫地名见于后出的本纪和列传，不应把不同层次的记载合成同一日的现场纪录。</p></details>
        <p class="actions"><a class="link" href="#/chapter/kangxi-02">读两废太子</a> · <a class="link" href="#/succession">看分日全链</a></p>` : ''}
        ${heshen ? `<p class="lede">太上皇崩后第五天下狱，第十五日赐死。二十条是上谕列罪，不是抄家清册。</p>
        <details class="evidence-drawer"><summary>史料说明</summary><p>《清史稿》卷16分日；卷319转录二十大罪。已打开的列传没有「八亿两」这一总数。</p></details>
        <p class="actions"><a class="link" href="#/chapter/jiaqing-04">读分日</a> · <a class="link" href="#/lane/QH-L-0032">对照通行说法</a></p>` : ''}
        ${princeCard(id)}
        ${princessCard(id)}
        ${heirEventsFor(id).length ? `<div class="thread-block">
          <h2>储位</h2>
          ${heirList(heirEventsFor(id))}
          <p class="actions"><a class="link" href="#/succession">读全链</a></p>
        </div>` : ''}
        ${empressEventsFor(id).length ? `<div class="thread-block">
          <h2>称号</h2>
          ${timelineList(empressEventsFor(id))}
          <p class="actions"><a class="link" href="#/empresses">读四后全轴</a></p>
        </div>` : ''}
        ${claims.length ? `<details class="claims-drawer"><summary>依据 ${claims.length} 条</summary>${claims.map(claimCard).join('')}</details>` : ''}
        ${lanesForPerson(id).length ? `<h2>对照</h2>${lanesForPerson(id).map(laneCard).join('')}` : ''}
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
              <span class="muted">${esc(row['公历下界'] || '')}${row['公历上界'] && row['公历上界'] !== row['公历下界'] ? `–${esc(row['公历上界'])}` : ''}</span>
            </div>
            <div class="what">
              <p class="event-line">${personLink(row.person_id)} ${esc(row['当时称号'])} · ${esc(row['事件类型'])} ${evidenceMark(row['公开证据状态'])}${row['冲突组 ID'] ? ' <span class="mark two">两说并存</span>' : ''}</p>
              <p class="quote">「${esc(row['引文'])}」</p>
              ${row['主张 ID'] ? `<p class="actions"><button class="link" data-claim="${esc(row['主张 ID'])}">看依据</button></p>` : ''}
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
      <p class="kicker">后妃</p>
      <h1>${yongzheng ? '雍正后妃' : '康熙四后'}</h1>
      <p class="lede">${yongzheng
        ? '潜邸是嫡福晋、侧福晋、格格。皇后、贵妃、谦妃，是后来的号。'
        : '活着的时候是妃、是后、是太后，孝诚、孝昭、孝懿、孝恭都是死后才加上去的。孝恭在康熙朝不是皇后。'}</p>
      <p class="warn">${yongzheng
        ? '时态称号按后妃传原文。谦妃子作弘適，世表作弘曕，不择一。'
        : '赫舍里氏册后，后妃传记四年七月，本纪记四年九月辛卯。两说都在，不抹平。'}</p>
      <p class="crumb"><a class="link" href="#/${yongzheng ? 'yongzheng' : 'kangxi'}">${yongzheng ? '雍正朝' : '康熙朝'}</a></p>
      <div class="filters">
        <button type="button" data-empress-era="kangxi" class="${yongzheng ? '' : 'on'}" aria-pressed="${yongzheng ? 'false' : 'true'}">圣祖</button>
        <button type="button" data-empress-era="yongzheng" class="${yongzheng ? 'on' : ''}" aria-pressed="${yongzheng ? 'true' : 'false'}">世宗</button>
      </div>
      <div class="filters">
        ${filters.map((item) => {
          const label = item === '全部' ? (yongzheng ? '全轴' : '四人全轴') : personName(item);
          return `<button type="button" data-empress="${esc(item)}" class="${item === person ? 'on' : ''}" aria-pressed="${item === person}">${esc(label)}</button>`;
        }).join('')}
      </div>
      ${timelineList(rows)}
      <p class="actions"><a class="link" href="#/claims">打开相关主张</a> · <a class="link" href="#/lanes">对照</a></p>
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
        <p class="actions"><a class="link" href="#/princes">读全表</a></p>`;
    }
    if (id === 'QH-P-000002') {
      return `<h2>皇子</h2>
        <p class="thread-lead">卷165缺第四子弘历。表序不是玉牒。</p>
        <p class="actions"><a class="link" href="#/princes?era=yongzheng">读世宗系</a></p>`;
    }
    const era = row['父亲ID'] === 'QH-P-000002' ? 'yongzheng' : 'kangxi';
    return `
      <h2>在皇子表里</h2>
      <p class="rel">${esc(row['表序标签'])} · ${esc(row['收录状态'])}${row['冲突组 ID'] ? ' · 两说并存' : ''}</p>
      <p class="quote">「${esc(row['世表摘要'] || row['后妃传子女句'])}」</p>
      <p class="gloss">生母候选：${row['生母人物ID'] ? personLink(row['生母人物ID']) : esc(row['生母候选名'] || '未详')}。</p>
      <p class="actions"><a class="link" href="${era === 'yongzheng' ? '#/princes?era=yongzheng' : '#/princes'}">读全表</a></p>`;
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
      <p class="kicker">皇子</p>
      <h1>${yongzheng ? '雍正的儿子' : '康熙的儿子'}</h1>
      <p class="lede">${yongzheng
        ? '表上没有第四子这一行，缺号的是弘历，弘时只写早薨，弘曕过继给了允礼。'
        : '表上第一子是胤禔，但后妃传说承瑞才是长子。第四子胤禛不在这一卷，但并非康熙没有这个儿子。'}</p>
      <p class="warn">${yongzheng
        ? '表序不是玉牒。后妃传弘適与世表弘曕是异写，不择一。'
        : '世表以胤禔为第一子；后妃传以承瑞为长子。早殇未入序，仍是儿子。'}</p>
      <p class="crumb"><a class="link" href="#/${yongzheng ? 'yongzheng' : 'kangxi'}">${yongzheng ? '雍正朝' : '康熙朝'}</a></p>
      <div class="filters">
        <button type="button" data-prince-era="kangxi" class="${yongzheng ? '' : 'on'}" aria-pressed="${yongzheng ? 'false' : 'true'}">圣祖系</button>
        <button type="button" data-prince-era="yongzheng" class="${yongzheng ? 'on' : ''}" aria-pressed="${yongzheng ? 'true' : 'false'}">世宗系</button>
      </div>
      <div class="filters">
        ${groups.map((item) => `<button type="button" data-prince="${esc(item)}" class="${item === status ? 'on' : ''}" aria-pressed="${item === status}">${esc(item)}</button>`).join('')}
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
        <p class="actions"><a class="link" href="#/princesses">读全表</a></p>`;
    }
    return `
      <h2>在皇女表里</h2>
      <p class="rel">${esc(row['表序标签'])} · ${esc(row['收录状态'])}</p>
      <p class="quote">「${esc(row['封号摘要'] || row['生薨摘要'])}」</p>
      <p class="gloss">生母候选：${row['生母人物ID'] ? personLink(row['生母人物ID']) : esc(row['生母候选名'] || '未详')}。</p>
      <p class="actions"><a class="link" href="#/princesses">读全表</a></p>`;
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
      <p class="kicker">皇女</p>
      <h1>${yongzheng ? '雍正的女儿' : '康熙的女儿'}</h1>
      <p class="lede">${yongzheng
        ? '亲生四女，只有第二女长成，雍正元年追进和硕怀恪。三个抚育女不是亲生。'
        : '亲生二十人，受封八人。固伦若是追进，人已经不在了，常宁之女是抚育，不要算进这二十。'}</p>
      <p class="warn">${yongzheng
        ? '公主表在卷166，不在卷167；追进不是生前进封，表序也不是玉牒。'
        : '和硕、固伦是当时的封号，追进固伦时人已经薨了，表序也不是玉牒。'}</p>
      <p class="crumb"><a class="link" href="#/${yongzheng ? 'yongzheng' : 'kangxi'}">${yongzheng ? '雍正朝' : '康熙朝'}</a></p>
      <div class="filters">
        <button type="button" data-princess-era="kangxi" class="${yongzheng ? '' : 'on'}" aria-pressed="${yongzheng ? 'false' : 'true'}">圣祖系</button>
        <button type="button" data-princess-era="yongzheng" class="${yongzheng ? 'on' : ''}" aria-pressed="${yongzheng ? 'true' : 'false'}">世宗系</button>
      </div>
      <div class="filters">
        ${groups.map((item) => `<button type="button" data-princess="${esc(item)}" class="${item === status ? 'on' : ''}" aria-pressed="${item === status}">${esc(item)}</button>`).join('')}
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
      <p class="actions"><a class="link" href="${yongzheng ? '#/princes?era=yongzheng' : '#/princes'}">皇子</a> · <a class="link" href="${yongzheng ? '#/empresses?era=yongzheng' : '#/empresses'}">后妃</a> · <a class="link" href="${yongzheng ? '#/chapter/yongzheng-05' : '#/chapter/kangxi-08'}">怎么读这张表</a></p>
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
              <span class="muted">${esc(row['公历下界'] || '')}${row['公历上界'] && row['公历上界'] !== row['公历下界'] ? `–${esc(row['公历上界'])}` : ''}</span>
            </div>
            <div class="what">
              <p class="event-line">${eventSentence(row)} ${evidenceMark(row['公开证据状态'])}${row['冲突组 ID'] ? ' <span class="mark two">两说并存</span>' : ''}</p>
              <p class="quote">「${esc(row['引文'])}」</p>
              <p class="actions">
                ${row['主张 ID'] ? `<button class="link" data-claim="${esc(row['主张 ID'])}">看依据</button>` : ''}
                <a class="link" href="#/person/${esc(row.person_id)}">${esc(personName(row.person_id))}</a>
              </p>
            </div>
          </li>`).join('')}
      </ol>`;
  }


  function successionPage(query) {
    const group = query.stage || '全部';
    const threads = group === '全部' ? HEIR_THREADS : HEIR_THREADS.filter((item) => item.key === group);
    return `
      <div class="reading">
        <p class="kicker">储位</p>
        <h1>太子怎样立，怎样废</h1>
        <p class="lede">六月先择吉，十二月才册立。四十七年九月，驻跸、拘执、颁诏，隔了二十天，放出来不等于又立回去。五十一年再废，实录写成两天。</p>
        <p class="crumb"><a class="link" href="#/kangxi">康熙朝</a> · <a class="link" href="#/chapter/kangxi-02">两废太子</a></p>
      </div>
      <aside class="gap-card">
        <h2>咸安宫</h2>
        <p>本纪和列传写他再废后关在这里。实录那两天只写拘执、废黜，没有这个地名。</p>
        <p>起居注该日还没打开。所以地点只记在后出的那一层，不提前写进实录。</p>
      </aside>
      <aside class="gap-card">
        <h2>别朝的继位层</h2>
        <p>本页数康熙一条链。别的继位文本在各自章里：<a class="link" href="#/chapter/yongzheng-07">雍正·十三日崩逝到二十日即位</a>、<a class="link" href="#/chapter/daoguang-04">道光·密匣两启</a>、<a class="link" href="#/chapter/xianfeng-01">咸丰·序层回銮</a>、<a class="link" href="#/chapter/guangxu-01">光绪·懿旨立嗣</a>、<a class="link" href="#/chapter/xuantong-01">宣统·退位诏</a>。匣、旨、诏，生产者各不相同。</p>
        <p>清代自己排过一次序：<a class="link" href="#/chapter/qianlong-01">乾隆传位诏</a>把口谕、密缄、明诏摆成一排，「以今视昔，孰逾于此」。排序者是乾隆，自述非公论——但枢纽的四种文本，本朝人自己也对过账。</p>
      </aside>
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
      <p class="kicker">对照</p>
      <h1>官书怎么写，传闻怎么说</h1>
      <p class="lede">先看已经打开的官书。对面才是通行说法和影视。</p>
      <p class="crumb"><a class="link" href="#/kangxi">康熙朝</a></p>
      <div class="filters">
        ${groups.map((item) => `<button type="button" data-lane="${esc(item.id)}" class="${item.id === lane ? 'on' : ''}" aria-pressed="${item.id === lane}">${esc(item.label)}</button>`).join('')}
      </div>
      ${lane === '全部'
        ? groups.slice(1).map((g) => {
            const items = (DATA.lanes || []).filter((row) => row['栏目'] === g.id);
            if (!items.length) return '';
            return `
              <h2 class="lane-group">${esc(g.label)}<span class="lane-group-n">${items.length} 条</span></h2>
              <p class="muted lane-group-hint">${esc(LANE_HINT[g.id] || '')}</p>
              ${items.map(laneCard).join('')}`;
          }).join('')
        : rows.map(laneCard).join('')}
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
      <p class="crumb"><a class="link" href="lane/${esc(id)}/">可分享链接</a></p>
      <p class="actions">${reviewButton('lane', id)}</p>
      ${laneCard(row)}
      ${questions.length ? `<h2>这类问题</h2>${questions.map((item) => questionCard(item)).join('')}` : ''}
      <p class="actions"><a class="link" href="#/lanes">回到对照</a> ${laneHref(row['来源入口'])}</p>
      ${related.length ? `<h2>同一栏其他条目</h2>${related.map((item) => `<p><a href="#/lane/${esc(item.lane_id)}">${esc(item['标题'])}</a></p>`).join('')}` : ''}
    `;
  }

  function claimsPage(query) {
    const selected = query.unit || '全部';
    const units = ['全部', ...DATA.units.map((row) => row.source_unit_id)];
    const rows = DATA.claims.filter((row) => selected === '全部' || row['来源实体 ID'] === selected);
    return `
      <div class="page-head">
        <h1>依据</h1>
      </div>
      <p class="lede">一条主张对应一句原文、一个出处。可按来源卷次筛选。</p>
      <div class="filters">
        ${units.map((item) => {
          const rec = unitById.get(item);
          const label = item === '全部' ? '全部' : `${rec?.['史料名'] || ''} ${rec?.['卷次'] || item}`.trim();
          return `<button type="button" data-unit="${esc(item)}" class="${item === selected ? 'on' : ''}" aria-pressed="${item === selected}">${esc(label)}</button>`;
        }).join('')}
      </div>
      ${rows.map(claimCard).join('')}
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
        return `<section class="claim-compare"><h3>${esc(heading)}</h3>${rows.map((row) => claimCard(row)).join('')}</section>`;
      },
    );
  }

  function chapterNav(chapter, list) {
    let prev = chapter.prev_slug ? { slug: chapter.prev_slug, title: chapter.prev_title } : null;
    let next = chapter.next_slug ? { slug: chapter.next_slug, title: chapter.next_title } : null;
    if (!prev && !next) {
      const siblings = list
        .filter((row) => row.person_id === chapter.person_id)
        .slice()
        .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
      const idx = siblings.findIndex((row) => row.slug === chapter.slug);
      prev = idx > 0 ? siblings[idx - 1] : null;
      next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
    }
    if (!prev && !next) return '';
    return `<nav class="chapter-nav" aria-label="上下篇">
      ${prev ? `<a class="link" href="#/chapter/${esc(prev.slug)}">上一篇 ${esc(prev.title)}</a>` : '<span></span>'}
      ${next ? `<a class="link" href="#/chapter/${esc(next.slug)}">下一篇 ${esc(next.title)}</a>` : '<span></span>'}
    </nav>`;
  }

  function chapterPage(slug) {
    const list = DATA.chapters || [];
    const chapter = list.find((row) => row.slug === slug) || (slug ? null : list[0]);
    if (!chapter) return `<h1>未找到章节 ${esc(slug || '')}</h1><p><a href="#/">回十二帝</a></p>`;
    const unitIds = String(chapter.unit_ids || '').split(/[；;]/).map((item) => item.trim()).filter(Boolean);
    const units = unitIds.map((id) => DATA.units.find((unit) => unit.source_unit_id === id)).filter(Boolean);
    const claimCount = units.reduce((n, unit) => (
      n + (DATA.claims || []).filter((row) => row['来源实体 ID'] === unit.source_unit_id).length
    ), 0);
    const home = chapter.era === '康熙'
      ? '#/kangxi'
      : chapter.era === '雍正'
        ? '#/yongzheng'
        : chapter.person_id
          ? `#/person/${chapter.person_id}`
          : '#/';
    const homeLabel = (chapter.era === '康熙' || chapter.era === '雍正')
      ? `${chapter.era}朝`
      : (chapter.era || '人物');
    const expandedBody = expandConflicts(chapter.bodyHtml || '');
    const short = chapterIsShort(chapter);
    const compact = short ? extractLeadingEvidenceDrawers(expandedBody) : { drawers: [], body: expandedBody };
    const body = compact.body;
    const toc = short ? [] : chapterToc(body);
    const compactMeta = short && (chapter.draft || compact.drawers.length) ? `
      <div class="chapter-meta-row" aria-label="本章研究说明">
        ${chapter.draft ? `<details class="chapter-meta-item research-meta"><summary>研究状态</summary>${researchDraftBanner('chapter')}</details>` : ''}
        ${compact.drawers.join('')}
      </div>` : '';
    return `
      <div class="chapter-shell">
      <div class="reading chapter-head">
        <p class="kicker">${esc(chapter.era)}</p>
        <h1>${esc(chapter.title)}</h1>
        <p class="lede">${noOrphan(chapter.lede)}</p>
        ${short ? compactMeta : (chapter.draft ? researchDraftBanner('chapter') : '')}
        <p class="crumb"><a class="link" href="${esc(home)}">${esc(homeLabel)}</a> · <a class="link" href="chapter/${esc(chapter.slug)}/">可分享链接</a></p>
        <p class="actions">${reviewButton('chapter', chapter.slug)}</p>
      </div>
      ${toc.length ? `<nav class="chapter-toc" aria-label="本章目录">
        <p class="toc-label">本章目录</p>
        <ol>${toc.map((item) => `<li><button type="button" class="link" data-scroll="${esc(item.id)}">${esc(item.title)}</button></li>`).join('')}</ol>
      </nav>` : ''}
      <div class="chapter-body">
      <div class="md">${body}</div>
      ${units.length ? `<section class="chapter-evidence">
        <h2>本章可回查的卷</h2>
        <p>${units.length} 处来源，${claimCount} 条主张。正文里的「看依据」对着原文。</p>
        <p class="actions">${units.map((unit) => `<a class="link" href="#/claims?unit=${esc(unit.source_unit_id)}">${esc(unit['卷次'] || unit.source_unit_id)}</a>`).join(' · ')}</p>
      </section>` : ''}
      ${chapter.related ? `<p class="chapter-related">${relatedLinks(chapter.related)}</p>` : ''}
      ${relatedLaneCards(chapter)}
      ${chapterNav(chapter, list)}
      </div>
      </div>
    `;
  }

  function overviewPage(slug) {
    const list = DATA.overviews || [];
    const ov = list.find((row) => row.slug === slug) || (slug ? null : list[0]);
    if (!ov) return `<h1>未找到专题 ${esc(slug || '')}</h1><p><a href="#/">回十二帝</a></p>`;
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
        ${researchDraftBanner('chapter')}
        <p class="crumb"><a class="link" href="#/">回十二帝</a></p>
      </div>
      ${toc.length ? `<nav class="chapter-toc" aria-label="本章目录">
        <p class="toc-label">本章目录</p>
        <ol>${toc.map((item) => `<li><button type="button" class="link" data-scroll="${esc(item.id)}">${esc(item.title)}</button></li>`).join('')}</ol>
      </nav>` : ''}
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
          ${row.route ? `<a class="link" href="${esc(row.route)}">查看相关页</a>` : ''}
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
      <div class="reading">
        <p class="kicker">现有材料答不了</p>
        <h1>这类问题，现在停在这里</h1>
        <p class="lede">有的能对到卷和日子。有的只能说：现有材料不够，不能写成事实。</p>
      </div>
      <div class="filters">
        ${types.map((item) => `<button type="button" data-qtype="${esc(item.id)}" class="${item.id === group ? 'on' : ''}" aria-pressed="${item.id === group}">${esc(item.label)}</button>`).join('')}
      </div>
      ${pinned.length ? `<h2>先看这三问</h2>${pinned.map((row) => questionCard(row)).join('')}` : ''}
      ${rest.map(questionCard).join('')}
    `;
  }

  function questionPage(id) {
    const row = (DATA.questions || []).find((item) => item.question_id === id);
    if (!row) return `<h1>未找到问题 ${esc(id)}</h1><p><a href="#/questions">回这类问题</a></p>`;
    return `
      <p class="kicker">${esc(row.evidenceGap ? '现有材料不够' : '能对到日子')}</p>
      <h1>${esc(row.question)}</h1>
      ${row.evidenceGap ? noEvidenceBanner('现有材料不足以下结论', row.explanation) : ''}
      ${questionCard(row, { hideBound: row.evidenceGap })}
      <p class="crumb"><a class="link" href="#/questions">全部这类问题</a></p>
    `;
  }

  function visualThread(row, group) {
    return `
      <li>
        <a class="thread" href="#/image/${esc(row.visual_id)}">
          <span class="thread-year">${esc(group.title)}</span>
          <h2>${esc(row['对象标题'])}</h2>
          <p>${esc(row['卡片钩子'] || row['画面解析'] || row['图像性质'] || '')}</p>
        </a>
      </li>`;
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
      <div class="reading">
        <p class="kicker">像与物</p>
        <h1>画的、写的、用的、拍下来的</h1>
        <p class="lede">朝服像、行乐图、御笔、朱批、诏书、器物和照片，都按材料本身的性质归类。</p>
        ${only ? `<p class="actions"><a class="link" href="#/hands">看全部</a> · <a class="link" href="#/material">回材料</a></p>` : ''}
      </div>
      ${all.length ? `<nav class="era-jump" aria-label="按组跳转">${VISUAL_GROUPS
        .filter((group) => all.some((item) => item.group.key === group.key))
        .map((group) => `<button type="button" data-scroll="visual-${group.key}">${esc(group.title)}<i>${all.filter((item) => item.group.key === group.key).length}</i></button>`).join('')}</nav>` : ''}
      ${VISUAL_GROUPS.map((group) => {
        const items = all.filter((item) => item.group.key === group.key);
        if (!items.length) return '';
        return `${reignHead(group.title, items.length, '件', `visual-${group.key}`)}
          <ol class="threads">${items.map(({ row }) => visualThread(row, group)).join('')}</ol>`;
      }).join('')}
      <p class="actions"><a class="link" href="#/works">文献</a> · <a class="link" href="#/jiedu">逐解</a> · <a class="link" href="#/path">转轴</a></p>
    `;
  }

  // 旧的画像总览链接保留为别名，和 #/hands 渲染同一份完整清单。
  function imagesPage(query = {}) {
    return handsPage(query);
  }

  function imagePage(id) {
    const portrait = portraitById.get(id);
    if (!portrait) return `<h1>未找到图像 ${esc(id)}</h1>`;
    const emperor = emperorByLegacy.get(portrait.emperor_id);
    const siblings = (portraitsByEmperor.get(portrait.emperor_id) || []).filter((row) => row.visual_id !== id);
    const scriptish = ['御笔书法', '奏折朱批'].includes(portrait['展示角色']);
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
          <div class="image-meta-actions">
            ${reviewButton('image', id)}
            <a class="link" href="image/${esc(id)}/">可分享链接</a>
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
              <h2>这一朝的其他像与物</h2>
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

  function worksPage(query = {}) {
    const only = query.era || '';
    const works = DATA.works || [];
    const workCard = (w) => {
      const opened = Boolean(w.hasDirectText);
      const entryLabel = opened ? '查看原文条目' : '馆藏／咨询入口';
      return `
      <article class="card work-card">
        <div class="meta">
          <div class="era">${esc(w['文献类型'])} · ${esc(w['成书年代'])} · ${openStateChip(w.availability)}</div>
          <h2>${esc(w['文献名称'])}</h2>
          ${w['卷数'] ? `<p class="muted">${esc(w['卷数'])}</p>` : ''}
          <p>${esc(w['内容概述'])}</p>
          <p class="actions">
            ${w['dedicated_chapter'] ? `<a class="link" href="#/chapter/${esc(w['dedicated_chapter'])}">读专论</a>` : ''}
            ${safeUrl(w['来源入口']) ? `<a class="link" href="${esc(safeUrl(w['来源入口']))}" target="_blank" rel="noopener">${esc(entryLabel)}</a>` : ''}
          </p>
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
      <p class="kicker">文献</p>
      <h1>十二帝著述与官修书</h1>
      <p class="lede">已列出原文条目的文献可直接回查；其余项目只提供馆藏或查阅入口。</p>
      ${only
        ? `<p class="actions"><a class="link" href="#/works">看全部 ${works.length} 种</a> · <a class="link" href="#/material">回材料</a></p>`
        : `<nav class="era-jump" aria-label="按朝跳转">${groups
            .map((g) => String(g.e['年号或通称'] || '').split('；')[0])
            .map((era) => `<button type="button" data-scroll="works-${esc(era)}">${esc(era)}</button>`).join('')}</nav>`}
      ${!only && featured.length ? `<h2>专论</h2><div class="grid cards work-grid">${featured.map(workCard).join('')}</div>` : ''}
      ${groups.map((g) => {
        const era = String(g.e['年号或通称'] || '').split('；')[0];
        const read = EMPEROR_READS[g.e.person_id];
        const intro = read?.lede || '';
        return `
        ${reignHead(era, g.rows.length, '种', `works-${era}`)}
        ${intro ? `<p class="muted era-group-intro">${esc(intro)}</p>` : ''}
        <div class="grid cards work-grid">${g.rows.map(workCard).join('')}</div>`;
      }).join('')}
      ${!only && rest.length ? `<h2>汇编</h2><div class="grid cards work-grid">${rest.map(workCard).join('')}</div>` : ''}
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
        <h1>用过哪些材料</h1>
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
        <a class="link" href="${esc(row['资源网址'])}" target="_blank" rel="noopener">打开资源</a>
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
    const total = peopleHits.length + claimHits.length + empressHits.length + princeHits.length + princessHits.length + heirHits.length + siteHits.length + chapterHits.length + questionHits.length + laneHits.length + sourceHits.length + workHits.length;

    const categories = [
      { id: 'all', label: '全部', count: total },
      { id: 'person', label: '人物', count: peopleHits.length },
      { id: 'claim', label: '依据', count: claimHits.length },
      { id: 'chapter', label: '章节', count: chapterHits.length },
      { id: 'lane', label: '对照', count: laneHits.length },
      { id: 'site', label: '今地', count: siteHits.length },
      { id: 'empress', label: '后妃', count: empressHits.length },
      { id: 'prince', label: '皇子', count: princeHits.length },
      { id: 'princess', label: '皇女', count: princessHits.length },
      { id: 'heir', label: '储位', count: heirHits.length },
      { id: 'question', label: '这类问题', count: questionHits.length },
      { id: 'work', label: '文献与来源', count: workHits.length + sourceHits.length },
    ].filter((c) => c.id === 'all' || c.count > 0);

    const showAll = activeCat === 'all';

    return `
      <p class="kicker">检索</p>
      <h1>「${esc(q)}」</h1>
      <p class="muted">共 ${total} 条命中</p>
      <div class="filters search-facets" role="tablist" aria-label="检索类别筛选">
        ${categories.map((c) => `
          <button type="button" class="facet-btn ${c.id === activeCat ? 'on' : ''}" data-search-cat="${esc(c.id)}" role="tab" aria-selected="${c.id === activeCat ? 'true' : 'false'}">
            ${esc(c.label)} <span class="facet-count">${c.count}</span>
          </button>
        `).join('')}
      </div>

      ${(showAll || activeCat === 'person') ? `
        <h2>人物 ${peopleHits.length}</h2>
        ${peopleHits.length ? `<ul>${clipBlock(peopleHits, (hit) => `<li><a href="#/person/${esc(hit.id)}">${highlightHtml(hit.label, q)}</a> <span class="muted">${highlightHtml(hit.extra || '', q)}</span></li>`)}</ul>` : (activeCat === 'person' ? '<p class="empty">无人物命中。</p>' : '')}
      ` : ''}

      ${(showAll || activeCat === 'claim') ? (claimHits.length ? `<h2>依据 ${claimHits.length}</h2>${clipBlock(claimHits, claimCard)}` : (activeCat === 'claim' ? '<p class="empty">无依据命中。</p>' : '')) : ''}

      ${(showAll || activeCat === 'empress') ? (empressHits.length ? `<h2>后妃 ${empressHits.length}</h2>${timelineList(empressHits)}` : (activeCat === 'empress' ? '<p class="empty">无后妃命中。</p>' : '')) : ''}

      ${(showAll || activeCat === 'prince') ? (princeHits.length ? `<h2>皇子 ${princeHits.length}</h2><ul>${princeHits.map((row) => `<li><a href="#/person/${esc(row.person_id)}">${esc(row['规范名'].replace(/^爱新觉罗·/, ''))}</a> <span class="muted">${esc(row['表序标签'])}</span></li>`).join('')}</ul>` : (activeCat === 'prince' ? '<p class="empty">无皇子命中。</p>' : '')) : ''}

      ${(showAll || activeCat === 'princess') ? (princessHits.length ? `<h2>皇女 ${princessHits.length}</h2><ul>${princessHits.map((row) => `<li><a href="#/person/${esc(row.person_id)}">${esc(row['规范名'].replace(/^爱新觉罗氏/, ''))}</a> <span class="muted">${esc(row['表序标签'])}</span></li>`).join('')}</ul>` : (activeCat === 'princess' ? '<p class="empty">无皇女命中。</p>' : '')) : ''}

      ${(showAll || activeCat === 'heir') ? (heirHits.length ? `<h2>储位 ${heirHits.length}</h2>${heirList(heirHits)}` : (activeCat === 'heir' ? '<p class="empty">无储位命中。</p>' : '')) : ''}

      ${(showAll || activeCat === 'site') ? (siteHits.length ? `<h2>今地 ${siteHits.length}</h2><div class="grid cards site-cards">${siteHits.map(siteCard).join('')}</div>` : (activeCat === 'site' ? '<p class="empty">无今地命中。</p>' : '')) : ''}

      ${(showAll || activeCat === 'chapter') ? (chapterHits.length ? `<h2>章节 ${chapterHits.length}</h2><ul>${clipBlock(chapterHits, (hit) => `<li><a href="#/chapter/${esc(hit.id)}">${highlightHtml(hit.label, q)}</a> <span class="muted">${highlightHtml(hit.extra || '', q)}</span></li>`)}</ul>` : (activeCat === 'chapter' ? '<p class="empty">无章节命中。</p>' : '')) : ''}

      ${(showAll || activeCat === 'question') ? (questionHits.length ? `<h2>这类问题 ${questionHits.length}</h2><ul>${questionHits.map((hit) => `<li><a href="#/question/${esc(hit.id)}">${highlightHtml(hit.label, q)}</a> <span class="muted">${highlightHtml(hit.extra || '', q)}</span></li>`).join('')}</ul>` : (activeCat === 'question' ? '<p class="empty">无问题命中。</p>' : '')) : ''}

      ${(showAll || activeCat === 'lane') ? (laneHits.length ? `<h2>对照 ${laneHits.length}</h2>${laneHits.map(laneCard).join('')}` : (activeCat === 'lane' ? '<p class="empty">无对照命中。</p>' : '')) : ''}

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
    return `
      <div class="reading how-read">
        <p class="kicker">读法</p>
        <h1>日子对得上，就写日子</h1>
        <p class="lede">实录写到哪一天，就停在哪一天。后出的本纪、列传、世表若不一样，两说都在，不抹平。</p>
        <nav class="how-toc" aria-label="本页小节">
          <p class="toc-label">本页小节</p>
          <ol><li><button type="button" data-scroll="how-1">实录、本纪、列传、世表</button></li><li><button type="button" data-scroll="how-2">怎么看核对状态</button></li><li><button type="button" data-scroll="how-3">空白的图</button></li><li><button type="button" data-scroll="how-4">咸安宫</button></li><li><button type="button" data-scroll="how-5">逐解：一部一部读原典</button></li><li><button type="button" data-scroll="how-6">三账不互相取消</button></li><li><button type="button" data-scroll="how-7">继位文本的生产者</button></li><li><button type="button" data-scroll="how-8">文本引文本</button></li><li><button type="button" data-scroll="how-9">目录层</button></li><li><button type="button" data-scroll="how-10">物质层</button></li></ol>
        </nav>
        <section class="now-read">
          <div class="page-head story">
            <h2>已经对上日子的几处</h2>
          </div>
          <p class="lede">和珅不是第五天处死的，继后那拉氏在官书里也没有被写成抗旨宫斗，十三日崩逝到二十日才举行即位礼。</p>
          <ol class="threads now-read-list">
            <li>
              <a class="thread" href="#/chapter/jiaqing-04">
                <span class="thread-year">1796–99</span>
                <h2>内禅之后：太上皇崩与和珅案</h2>
                <p>第五天下狱，十五日后赐死；二十条是上谕中的列罪，不是抄家清册。</p>
              </a>
            </li>
            <li>
              <a class="thread" href="#/lane/QH-L-0033">
                <span class="thread-year">继后</span>
                <h2>继皇后那拉氏</h2>
                <p>官书有断发的叙述，但没有写成抗旨宫斗。姓氏有两说，不择其一。</p>
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
        <div class="md">
          <h2 id="how-1">实录、本纪、列传、世表</h2>
          <p>实录能对到卷和条次，但仍是官修，不是原档。本纪后出，有时会多写实录当天没有的话；列传可以跟本纪差一天，世表常把几年收成一句。后出的那一层，不拿来改前面一层。</p>
          <h2 id="how-2">怎么看核对状态</h2>
          <p>「已核对」表示页面所引文字与所列出处已对应；它不等于学界已对事件的所有解释形成定论。把鼠标停在页内标记上，也可以看到同一句解释。</p>
          <ul>
            <li><strong>已列原文</strong>：能回到实录或本纪的具体条目。</li>
            <li><strong>参考线索</strong>：依据后出史书或通行叙述，尚未对到日级原文。</li>
            <li><strong>存在异说</strong>：同一件事有两种以上写法，并列保存，不择一抹平。</li>
          </ul>
          <h2 id="how-3">空白的图</h2>
          <p>只有绿标能嵌进来，黄的只给说明和外链。网上看得见，不等于能放进这个站。</p>
          <h2 id="how-4">咸安宫</h2>
          <p>本纪和列传写他关在这里，实录在再废当日没有这个地名。因此，「再废当日即拘于咸安宫」不应只凭后出本纪与列传写成现场纪录。</p>
          <h2 id="how-5">逐解：一部一部读原典</h2>
          <p>有的书适合一张一张读。《大义觉迷录》当机器读：上谕是自辩层，口供是谣言层，吕案判词是话语层。每段短引配白话、「为何这样写」、「今天怎么读」和「不能写成」。掌故跟官书互勘，官书跟私记互勘，两层不并成一层。</p>
          <h2 id="how-6">三账不互相取消</h2>
          <p>同治死因摆四层：实录不写病因，脉案写二十六天天花，野史晚出梅毒说，市井挽联写「可怜天子出天花」——脉案写病症，挽联写因果。光绪死因也摆三账：脉案记慢病骤重，密信记人伦，发丝记急性砷。三账各记各的，不互相取消——慢病之人也可以中急性毒。本库不裁死因，只记每本账的抄送面：脉案抄送军机，密信写给私交，发丝交给仪器。野史自己也有两问：占文灵验，先问占文写于事前还是事后——彗星「宰相当之」是事后排出来的预告；排年相邻，先问相邻是不是因果——讲官切直「上有怒意」排在「圣躬不豫」之前，怒意是情绪层，不是死因层；讲筵层还有一泪：听「女戎之祸」下泪，曰其中必有小人——泪归泪，因果归因果。同一场事变也有两半：庚子年，掌故记西安的除夕，口述记出逃的途次——驻与途，是同一场庚子两个方向看；琐记还记行在缺什么：不用鱼的传单、木晷、青瓷缸代冰桶——行在是用缺什么记什么的；但礼的账照旧：行在立春，春牛图由驿驰至、咬春沿明制——缺的是物，不缺的是礼。保驾的账记人：夜立寝门外一呼「臣春煊在此保驾」——庚子三本账之外，还有这一声。寿典还是年表：六旬庆典遇甲午战、七旬庆典遇日俄战；同一年有谕不受徽号，也有折报效与独劾——谕是门面，折是人心。败后的账也要读：甲午和议既成，究主战者之罪，枝叶先披、本根按眷顾留——败战找罪人，账按眷顾深浅分批结。军械的账在最底：光绪十四年后不购新械，武库空如洗，战衅既开才议购五批——纪律与器物，都在甲午前四年写好。保案的账记陆军：区区小事侈陈功绩、大开保案，惶遽之中失履以袜行——用人层海军陆军各一笔。机器喻记系统：引擎、锅炉、马达速率之不敌，出货固宜不若——仅归咎货出之一部，谁任其咎。舆论的账最快：同治崩市井写挽联，甲午败市井演丑戏——「奈何夺我三眼翎」，舆论层永远比官书快一天。开衅时还有一纸合词：主帅、大将、行人同请班师，闻变先归的是项城——逃过一次的人，后来被一道遗诏点名。辛酉还有一笔反向的账：恭邸当国，阴行肃顺政策、亲用汉臣——赢者拿位，行的却是败者之策。西市的账记现场：牛车上不肯跪，刽子以大铁柄敲之——败方拒认在文本里，不肯跪在刑场上。北洋的账也要读：朝廷大事悉咨后行、北洋章奏所请无不予——对外守住全权的字，对内让出咨询的笔。商人的账也要读：关外军需咸经其肆，几年后不经日而肆闭——赢的账和倒的账，记在同一朝。</p>
          <h2 id="how-7">继位文本的生产者</h2>
          <p>康熙用册宝立太子，废立都写到日子；雍正凭口谕即位，事后写一部书自辩；嘉庆的匣在承德启，道光的匣在圆明园启；咸丰的遗诏写「赞襄政务」，没写「垂帘」——辛酉争的就是这八个字与两个字的距离；当年的驳谕引祖制说向无垂帘之礼，胜保的抗章说「原不必以朱谕之有无为定」，三文本对打，政变是这堆文本问题的武力解；捕肃顺时门内那声「若是母旨意，我却不受」，是败方对同一问的输着答；写抗章的胜保，逮问时仍疏请垂帘、自居拥戴——抗章之声与自诉之笔同一支手；赢方阵营里惇王斥谋诛三奸「其非」——辛酉四种声：败方拒认、抗章质问、罪臣自诉、宗室斥非；言路层还有一声笑：直言极谏不加罪，朱批「陆都老爷醋矣」——避走的、拒认的、笑答的，同一个皇帝三副面孔；赢后半年，两宫又命翰林编《治平宝鉴》，把前史垂帘事迹编成法戒——先赢，再编先例；戊戌年两边各写一份：皇帝写衣带诏求救，政变方写征医谕说帝疾；光绪三十三年，罢瞿鸿禨的旨是奕劻袖折回私宅拟的——枢臣的去留，旨从庆邸出；光绪三十四年，德宗遗诏的另一端是「命诛世凯」，被监国与张之洞力解——两条遗命，一被私宅接、一被力解；同治崩后是懿旨立嗣，宣统末年是退位诏。匣、旨、诏都生产合法性，生产者各不相同；宣统末年还有一层：拒签的宗社党良弼挨了最后一刺，刺后四天授全权谕下——缺席的签字人，也是契约的一部分。读继位与退位，先问文本是谁写的，再问文本里没写什么、谁没来得及写。</p>
          <h2 id="how-8">文本引文本</h2>
          <p>制度有记忆，靠的是文本自己引自己。康熙四十四年禁太监与宫女认亲戚，一句「断乎不可」；咸丰五年珳常在案，谕里写「从前康熙年间已曾奉有圣训」，罚则加重到家属发新疆——一百一十年后，嗣朝引前朝为成案。火线也一样：康熙防（看守不缺人）、乾隆救（火起开门放王公大臣）、道光算（鹿数拆瞒报）。读宫规，不只读一条禁令，读它的百年生命史：谁立的、谁引的、谁加重的、谁修的、谁让它自己写自己的。防亲线里康熙立、咸丰引并加重，咸丰六年那道谕末还写着「此旨著续入现行则例」——谕命令自己进入则例；同治八年安得海出京即诛，五日后申谕约束太监——先诛一人、再申一谕，个案之后是则例；火线里康熙防、乾隆救、道光算；和珅案后嘉庆亲读则例、下令修理。文本引文本的地方，就是制度记得自己的地方。</p>
          <h2 id="how-9">目录层</h2>
          <p>正文没上线的书，目录也能读。《清季外交史料选辑》只开导言与目录，可中法、马关两串电报标题按收到日排好：恫吓、为质、攻基隆、允赔仍和；不服、不可允、请公断、血书、人心稍定。标题不等于内容，但序列是源自己的排序——节奏、情绪、捷报与败报的并排，都写在目录里。读目录层，读的是编年的诚实：它不裁胜负，只排日子。</p>
          <h2 id="how-10">物质层</h2>
          <p>条约先是物质，再是文本。曾纪泽在彼得堡改约，日记里记的是：外部送来写约的纸，尺寸比先前加大，连日画的格全不合；写约的硬纸，打算用糖板印底再写，试演良久。画押那天，「遂将条约章程、卡伦单专条画押盖印，酉初二刻毕」。纸的尺寸、格的画法、试写的笔，都是交涉的一部分——读条约，问一句它是怎么被写出来的。</p>
        </div>
        <p class="actions"><a class="link" href="#/chapter/yongzheng-04">大义觉迷录</a> · <a class="link" href="#/chapter/yongzheng-02">朱批三批</a> · <a class="link" href="#/chapter/kangxi-13">庭训格言</a> · <a class="link" href="#/chapter/daoguang-04">密匣两启</a> · <a class="link" href="#/chapter/xianfeng-01">咸丰遗诏</a> · <a class="link" href="#/chapter/xuantong-01">退位诏</a> · <a class="link" href="#/path">转轴年</a></p>
      </div>
    `;
  }

  function changelogPage() {
    const release = DATA.release || {};
    const entries = release.entries || [];
    const updatedAt = release.updatedAt ? `最近构建 ${esc(release.updatedAt)}` : '';
    return `
      <div class="reading">
        <p class="kicker">清史证据库</p>
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

  // ===== 开闸 v0.1：数据浏览器（#/data） + 存疑标记（#/review / 标存疑） =====

  const KIND_LABELS = {
    emperors: '帝王', research_cards: '研究卡', portraits: '画像', image_regions: '图像区域',
    iiif_manifests: 'IIIF 清单', crosswalk: 'ID 对照', people: '人物', sources: '来源台账',
    source_index: '来源索引', tasks: '任务队列', vocab: '词汇', source_units: '来源单元',
    source_claims: '主张', questions: '黄金问题', chapters: '章节', lanes: '对照',
    empress_timeline: '后妃时态轴', princes: '皇子', princesses: '皇女', heir_chain: '储位链',
    sites: '今地', works: '文献', chronicle: '统治年表', families: '来源家族',
    conflict_sets: '冲突组', community_corrections: '社区纠错', overview: '综述',
    emperor_timeline: '统治年表',
  };

  const REVIEW_KEY = 'qh-review-notes';
  const REVIEW_TYPE_LABEL = { claim: '主张', chapter: '章节', lane: '对照', site: '今地' };

  function loadReviewNotes() {
    try {
      const raw = JSON.parse(localStorage.getItem(REVIEW_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  }
  function saveReviewNotes(list) {
    try { localStorage.setItem(REVIEW_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  }
  function reviewNoteFor(type, id) {
    return loadReviewNotes().find((n) => n.target_type === type && n.target_id === id);
  }
  function reviewButton(type, id) {
    const note = reviewNoteFor(type, id);
    const when = String(note?.updated_at || note?.created_at || '').slice(0, 10);
    return note
      ? `<button type="button" class="review-mark set" data-review="${esc(type)}:${esc(id)}">已标存疑${when ? `（${esc(when)}）` : ''}</button>`
      : `<button type="button" class="review-mark" data-review="${esc(type)}:${esc(id)}">标存疑</button>`;
  }
  function reviewHref(n) {
    if (n.target_type === 'claim') return `#/claim/${encodeURIComponent(n.target_id)}`;
    if (n.target_type === 'chapter') return `#/chapter/${encodeURIComponent(n.target_id)}`;
    if (n.target_type === 'lane') return `#/lane/${encodeURIComponent(n.target_id)}`;
    if (n.target_type === 'site') return `#/site/${encodeURIComponent(n.target_id)}`;
    return '#/';
  }

  function makeGithubIssueUrl(n) {
    const targetLabel = REVIEW_TYPE_LABEL[n.target_type] || n.target_type;
    let targetDetails = '';
    if (n.target_type === 'claim') {
      const claim = claimById.get(n.target_id);
      if (claim) targetDetails = `\n- 相关表述: ${claim['主体 ID'] ? personName(claim['主体 ID']) : ''} ${predicateLabel(claim['谓词/关系'])} ${claim['客体 ID 或值'] || ''}\n- 支持引文: 「${claim['支持引文'] || ''}」\n- 史料来源: ${claim['来源实体 ID'] || ''}`;
    } else if (n.target_type === 'chapter') {
      const ch = (DATA.chapters || []).find((c) => c.slug === n.target_id);
      if (ch) targetDetails = `\n- 章节标题: ${ch.title || n.target_id}`;
    } else if (n.target_type === 'lane') {
      const ln = (DATA.lanes || []).find((l) => l.lane_id === n.target_id);
      if (ln) targetDetails = `\n- 对照标题: ${ln['标题'] || n.target_id}\n- 官书表述: ${ln['官书或档案怎么写'] || ''}`;
    } else if (n.target_type === 'site') {
      const st = (DATA.sites || []).find((s) => s.site_id === n.target_id);
      if (st) targetDetails = `\n- 遗址名称: ${st['遗址名称'] || n.target_id}\n- 现存位置: ${st['现存位置'] || ''}`;
    }
    const body = `### 出错位置
${n.target_id} (${targetLabel})${targetDetails}

### 当前表述
存疑原因：${n.reason || '暂不确定'}

### 你的修正
${n.note || '（请在此补充修正内容）'}

### 证据来源
（请在此补充史料名、卷次或在线链接，无证据的修正不予采纳）

### 你与该材料的熟悉程度
我核对过原文
`;
    const title = `[纠错] ${targetLabel} ${n.target_id}`;
    return `https://github.com/zonglinxie-cyber/qing-history-evidence-base/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=content-correction`;
  }

  let reviewTarget = { type: '', id: '' };
  const noteDialogEl = document.getElementById('note-dialog');
  function openReviewDialog(type, id) {
    reviewTarget = { type, id };
    const note = reviewNoteFor(type, id);
    const target = document.getElementById('note-target');
    if (target) target.textContent = `${REVIEW_TYPE_LABEL[type] || type} · ${id}`;
    const form = document.getElementById('note-form');
    if (form && typeof form.reset === 'function') form.reset();
    const radios = [...(noteDialogEl?.querySelectorAll?.('input[name="note-reason"]') || [])];
    const pick = radios.find((r) => r.value === (note?.reason || '暂不确定'));
    if (pick) pick.checked = true;
    const text = document.getElementById('note-text');
    if (text) text.value = note?.note || '';
    const removeBtn = document.getElementById('note-remove');
    if (removeBtn) removeBtn.hidden = !note;
    const ghBtn = document.getElementById('note-github-issue');
    if (ghBtn) {
      ghBtn.href = makeGithubIssueUrl({ target_type: type, target_id: id, reason: note?.reason, note: note?.note });
    }
    openModal(noteDialogEl);
  }
  function saveReviewNote() {
    const reason = noteDialogEl?.querySelector?.('input[name="note-reason"]:checked')?.value || '暂不确定';
    const text = document.getElementById('note-text');
    const note = String(text?.value || '').trim();
    const now = new Date().toISOString().slice(0, 10);
    const list = loadReviewNotes();
    const existing = list.find((n) => n.target_type === reviewTarget.type && n.target_id === reviewTarget.id);
    if (existing) {
      existing.reason = reason;
      existing.note = note;
      existing.updated_at = now;
    } else {
      list.push({ target_type: reviewTarget.type, target_id: reviewTarget.id, reason, note, created_at: now, updated_at: now });
    }
    saveReviewNotes(list);
    closeModal(noteDialogEl);
    render();
  }
  function removeReviewNote() {
    saveReviewNotes(loadReviewNotes().filter((n) => !(n.target_type === reviewTarget.type && n.target_id === reviewTarget.id)));
    closeModal(noteDialogEl);
    render();
  }
  function exportReviewNotes() {
    const fields = ['target_type', 'target_id', 'reason', 'note', 'created_at'];
    const csvRows = [fields.join(',')].concat(
      loadReviewNotes().map((n) => fields.map((f) => {
        const s = String(n[f] ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')),
    );
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'review-notes.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function clearReviewNotes() {
    if (typeof confirm === 'function' && !confirm('确定清空全部本地存疑标注？此操作不可撤销。')) return;
    saveReviewNotes([]);
    render();
  }

  function reviewPage() {
    const notes = loadReviewNotes().slice()
      .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')));
    const list = notes.map((n) => `
      <article class="review-note">
        <p class="sentence">${esc(REVIEW_TYPE_LABEL[n.target_type] || n.target_type)} · <a class="link" href="${esc(reviewHref(n))}">${esc(n.target_id)}</a></p>
        <div class="chips"><span class="chip">${esc(n.reason)}</span><span class="chip muted">${esc(n.updated_at || n.created_at)}</span></div>
        ${n.note ? `<p class="bound">${esc(n.note)}</p>` : ''}
        <div class="review-actions">
          <a class="link" target="_blank" rel="noopener" href="${esc(makeGithubIssueUrl(n))}">一键向 GitHub 提 Issue 纠错 ↗</a>
          <a class="link" href="${esc(reviewHref(n))}">回页面查看</a>
        </div>
      </article>`).join('');
    return `
      <p class="kicker">存疑</p>
      <h1>本地存疑标注${notes.length ? `（${notes.length}）` : ''}</h1>
      <p class="lede">按时间倒序列出这台浏览器里标过的存疑项。数据只存 localStorage，不上传、不改仓库。</p>
      <p class="actions">${notes.length ? `<button type="button" class="link" data-export-notes>导出 review-notes.csv</button><button type="button" class="link" data-clear-notes>一键清空</button>` : ''}</p>
      ${notes.length ? `<div class="review-list">${list}</div>` : '<p class="muted">还没有存疑标注。到主张、章节、对照或今地页点「标存疑」即可记录。</p>'}
      <p class="muted">本地标注不会自动同步；如需沉淀，把导出的 review-notes.csv 放入 data/ 后重新构建，或直接点击条目下方的「一键向 GitHub 提 Issue 纠错」。</p>
    `;
  }

  let dataState = { file: '', q: '', fcol: '', fval: '', sort: null, desc: false };
  function dataTables() { return (DATA.raw && DATA.raw.tables) || []; }
  function dataTableByFile(file) { return dataTables().find((t) => t.file === file); }

  function filteredDataRows(table) {
    let rows = table.rows.slice();
    const q = String(dataState.q || '').trim().toLowerCase();
    if (q) rows = rows.filter((r) => table.columns.some((c) => String(r[c] ?? '').toLowerCase().includes(q)));
    const fcol = dataState.fcol;
    const fval = String(dataState.fval || '').trim().toLowerCase();
    if (fcol && fval) rows = rows.filter((r) => String(r[fcol] ?? '').toLowerCase().includes(fval));
    if (dataState.sort) {
      const col = dataState.sort;
      const dir = dataState.desc ? -1 : 1;
      rows.sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? ''), 'zh-Hans-CN', { numeric: true }) * dir);
    }
    return rows;
  }

  function dataPage(query) {
    const tables = dataTables();
    const file = query.file || '';
    if (!file) {
      const kinds = [...new Set(tables.map((t) => t.kind))];
      return `
        <p class="kicker">数据浏览器</p>
        <h1>全部数据表</h1>
        <p class="lede">由 data/data-manifest.csv 驱动构建，${tables.length} 张表全量可浏览。原始字段、原始值原样显示，不在前端改写或净化。</p>
        ${kinds.map((kind) => {
          const group = tables.filter((t) => t.kind === kind);
          return `<section class="data-kind">
            <h2>${esc(KIND_LABELS[kind] || kind)} <span class="muted">${group.length}</span></h2>
            <ul class="data-files">${group.map((t) => `<li><a class="link" href="#/data?file=${encodeURIComponent(t.file)}">${esc(t.file)}</a> <span class="muted">${t.columns.length} 列 · ${t.rows.length} 行${t.reign ? ` · ${esc(t.reign)}` : ''}</span></li>`).join('')}</ul>
          </section>`;
        }).join('')}
        <p class="actions"><a class="link" href="#/review">本地存疑标注</a></p>
      `;
    }
    const table = dataTableByFile(file);
    if (!table) return `<h1>未找到表 ${esc(file)}</h1><p class="actions"><a class="link" href="#/data">回到表清单</a></p>`;
    if (dataState.file !== file) dataState = { file, q: '', fcol: '', fval: '', sort: null, desc: false };
    return dataTableHtml(table);
  }

  function dataTableHtml(table) {
    const shown = filteredDataRows(table);
    const statusCols = table.columns.filter((c) => /状态$/.test(c));
    return `
      <p class="kicker">数据浏览器 · ${esc(KIND_LABELS[table.kind] || table.kind)}</p>
      <h1>${esc(table.file)}</h1>
      <p class="crumb">
        <a class="link" href="#/data">回到表清单</a>
        <span class="muted">${table.columns.length} 列 · ${table.rows.length} 行${table.reign ? ` · ${esc(table.reign)}` : ''}</span>
      </p>
      ${statusCols.length ? `<div class="status-strip">${statusCols.map((c) => {
        const vals = [...new Set(table.rows.map((r) => String(r[c] ?? '').trim()).filter(Boolean))];
        return `<p><strong>${esc(c)}</strong>${vals.length ? vals.map((v) => `<span class="chip">${esc(v)}</span>`).join('') : '<span class="muted">（无值）</span>'}</p>`;
      }).join('')}</div>` : ''}
      <div class="data-tools">
        <label class="data-tool">全文搜索 <input type="search" data-tsearch value="${esc(dataState.q)}" placeholder="任意列包含…"></label>
        <label class="data-tool">按列筛选 <select data-dfilter-col>${['', ...table.columns].map((c) => `<option value="${esc(c)}"${c === dataState.fcol ? ' selected' : ''}>${c ? esc(c) : '（不筛选）'}</option>`).join('')}</select></label>
        <label class="data-tool">含 <input type="text" data-dfilter-val value="${esc(dataState.fval)}" placeholder="该列包含…"></label>
        <p class="muted" id="data-count">显示 ${shown.length} / ${table.rows.length} 行</p>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>${table.columns.map((c) => `<th><button type="button" class="data-sort" data-dsort="${esc(c)}">${esc(c)}${dataState.sort === c ? (dataState.desc ? ' ↓' : ' ↑') : ''}</button></th>`).join('')}</tr></thead>
          <tbody id="data-tbody">${shown.length ? shown.map((r) => `<tr>${table.columns.map((c) => `<td>${esc(r[c])}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${table.columns.length}" class="muted">无匹配行</td></tr>`}</tbody>
        </table>
      </div>
    `;
  }

  function renderDataTbody() {
    const table = dataTableByFile(dataState.file);
    const body = document.getElementById('data-tbody');
    if (!table || !body) return;
    const shown = filteredDataRows(table);
    body.innerHTML = shown.length
      ? shown.map((r) => `<tr>${table.columns.map((c) => `<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${table.columns.length}" class="muted">无匹配行</td></tr>`;
    const count = document.getElementById('data-count');
    if (count) count.textContent = `显示 ${shown.length} / ${table.rows.length} 行`;
    updateDataSortButtons();
  }
  function updateDataSortButtons() {
    document.querySelectorAll?.('[data-dsort]')?.forEach((btn) => {
      const col = btn.getAttribute('data-dsort');
      if (!col) return;
      btn.textContent = col + (dataState.sort === col ? (dataState.desc ? ' ↓' : ' ↑') : '');
    });
  }

  document.body.addEventListener('input', (event) => {
    const t = event.target;
    if (!t || typeof t.matches !== 'function') return;
    if (t.matches('[data-tsearch]')) { dataState.q = t.value; renderDataTbody(); }
    else if (t.matches('[data-dfilter-val]')) { dataState.fval = t.value; renderDataTbody(); }
  });
  document.body.addEventListener('change', (event) => {
    const t = event.target;
    if (t && typeof t.matches === 'function' && t.matches('[data-dfilter-col]')) {
      dataState.fcol = t.value;
      renderDataTbody();
    }
  });

  noteDialogEl?.addEventListener('cancel', (event) => { event.preventDefault(); closeModal(noteDialogEl); });
  noteDialogEl?.addEventListener('click', (event) => { if (event.target === noteDialogEl) closeModal(noteDialogEl); });
  document.getElementById('note-cancel')?.addEventListener('click', () => closeModal(noteDialogEl));
  document.getElementById('note-remove')?.addEventListener('click', removeReviewNote);
  document.getElementById('note-form')?.addEventListener('submit', (event) => { event.preventDefault(); saveReviewNote(); });

  let renderGen = 0;
  async function render() {
    const gen = ++renderGen;
    closeDrawer();
    const { parts, query, path } = parseHash();
    setNav(path === '/' ? '/' : `/${parts[0]}`);
    const view = parts[0] || '';
    const isHome = !view;
    if (isHome && main.dataset.ssr === 'home') {
      delete main.dataset.ssr;
      ensureView('').catch(() => {});
      return;
    }
    if (view === 'search' && !loadedChunks.has('search')) {
      main.innerHTML = '<p class="kicker">检索</p><h1>检索中…</h1>';
    }
    try {
      await ensureView(view);
    } catch (err) {
      if (gen !== renderGen) return;
      console.error(err);
      main.innerHTML = '<p class="warn">数据未能载入，请刷新页面重试。</p>';
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
    else if (view === 'chapter') {
      await loadChapterBody(parts[1]);
      if (gen !== renderGen) return;
      html = chapterPage(parts[1]);
    }
    else if (view === 'questions') html = questionsPage(query);
    else if (view === 'question') html = questionPage(parts[1]);
    else if (view === 'images') html = imagesPage(query);
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
    else if (view === 'search') html = searchPage(query.q || '', query);
    else if (view === 'how') html = howToReadPage();
    else if (view === 'changelog') html = changelogPage();
    else if (view === 'material') html = materialPage();
    else if (view === 'jiedu') html = jieduPage(query);
    else if (view === 'path') html = pathPage();
    else if (view === 'spine') html = spinePage(parts[1]);
    else if (view === 'chronicle') html = chroniclePage(parts[1]);
    else if (view === 'overview') html = overviewPage(parts[1]);
    else if (view === 'data') html = dataPage(query);
    else if (view === 'review') html = reviewPage();
    else html = `<h1>没有这个页面</h1><p><a href="#/">回首页</a></p>`;
    // 版心分档：读栏给纯文字页，表栏给分栏/年表，满栏只给卡片网格。
    // 原先只有朝代页和逐解收窄，其余一律 70rem 硬撑，右半边是空的。
    const FULL_VIEWS = new Set(['sites', 'works', 'images', 'people', 'princes', 'princesses', 'empresses', 'data']);
    const TABLE_VIEWS = new Set(['material', 'lanes', 'person', 'chronicle', 'claims', 'succession', 'search', 'sources', 'review', 'image', 'site', 'hands']);
    const isEmperorRoute = Boolean(DYNASTY.eras[view] || (view === 'person' && emperorByPerson.has(parts[1])));
    // 按内容性质分档，不按页面分：同一帝王的年号路由和旧人物路由共用 era 壳。
    main.dataset.layout = isHome || FULL_VIEWS.has(view)
      ? 'full'
      : view === 'chapter' ? (chapterIsShort((DATA.chapters || []).find((row) => row.slug === parts[1])) ? 'reading' : 'chapter')
      : view === 'how' ? 'how'
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
    const skipTop = /[?&](unit|qtype|era)=/.test(routeKey);
    let saved = 0;
    try { saved = Number(sessionStorage.getItem(`scroll:${routeKey}`) || 0); } catch (err) { saved = 0; }
    if (skipTop) {
      /* keep current offset for filter-only routes */
    } else if (saved > 0) {
      window.scrollTo(0, saved);
    } else {
      window.scrollTo(0, 0);
    }
    main.focus({ preventScroll: true });
    initOsdViewers();
    highlightToc();
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

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const q = searchInput.value.trim();
    hideSuggest();
    location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/';
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
      ensureView('').then(() => renderSuggest(q));
    } else hideSuggest();
  }, 300));
  searchInput.addEventListener('focus', () => {
    const q = searchInput.value.trim();
    if (normalize(q)) ensureView('').then(() => renderSuggest(q));
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
        const head = document.querySelector('.masthead');
        const gap = (head ? head.getBoundingClientRect().height : 0) + 12;
        const y = target.getBoundingClientRect().top + window.scrollY - gap;
        // 用 instant 不用 smooth：平滑滚动在部分环境下会被静默丢弃，
        // 页内跳转必须每次都落到位，动画不值得拿准确性换。
        window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
      }
      return;
    }
    const sortBtn = event.target.closest('[data-dsort]');
    if (sortBtn) {
      const col = sortBtn.getAttribute('data-dsort');
      if (dataState.sort === col) dataState.desc = !dataState.desc;
      else { dataState.sort = col; dataState.desc = false; }
      renderDataTbody();
      return;
    }
    const reviewBtn = event.target.closest('[data-review]');
    if (reviewBtn) {
      const raw = reviewBtn.getAttribute('data-review');
      const sep = raw.indexOf(':');
      openReviewDialog(raw.slice(0, sep), raw.slice(sep + 1));
      return;
    }
    const exportBtn = event.target.closest('[data-export-notes]');
    if (exportBtn) { exportReviewNotes(); return; }
    const clearBtn = event.target.closest('[data-clear-notes]');
    if (clearBtn) { clearReviewNotes(); return; }
    const citeBtn = event.target.closest('[data-cite-claim]');
    if (citeBtn) {
      const claim = claimById.get(citeBtn.getAttribute('data-cite-claim'));
      const unit = claim ? unitById.get(claim['来源实体 ID']) : null;
      const text = claim ? citationText(claim, unit) : '';
      const done = () => { citeBtn.textContent = '已复制'; };
      if (text && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(done);
      } else {
        done();
      }
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
    const claimBtn = event.target.closest('[data-claim]');
    if (claimBtn) {
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
    const unit = event.target.closest('[data-unit]');
    if (unit) {
      const id = unit.getAttribute('data-unit');
      location.hash = id === '全部' ? '#/claims' : `#/claims?unit=${encodeURIComponent(id)}`;
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
  const THEME_LABEL = { auto: '自动', dark: '暗色', light: '亮色' };
  function applyTheme(mode) {
    document.documentElement.classList.remove('dark', 'light');
    if (mode === 'dark') document.documentElement.classList.add('dark');
    else if (mode === 'light') document.documentElement.classList.add('light');
    if (themeBtn) themeBtn.textContent = THEME_LABEL[mode];
  }
  let currentTheme = localStorage.getItem('theme') || 'auto';
  if (!THEME_CYCLE.includes(currentTheme)) currentTheme = 'auto';
  applyTheme(currentTheme);
  themeBtn?.addEventListener('click', () => {
    const idx = THEME_CYCLE.indexOf(currentTheme);
    currentTheme = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    localStorage.setItem('theme', currentTheme);
    applyTheme(currentTheme);
  });

  const fsBtn = document.getElementById('fs-toggle');
  const FS_CYCLE = ['m', 'l', 's'];
  const FS_LABEL = { s: '小', m: '中', l: '大' };
  function applyFont(size) {
    document.documentElement.classList.remove('fs-s', 'fs-l');
    if (size === 's' || size === 'l') document.documentElement.classList.add(`fs-${size}`);
    if (fsBtn) fsBtn.textContent = FS_LABEL[size] || '中';
  }
  let currentFs = localStorage.getItem('fs') || 'm';
  if (!FS_CYCLE.includes(currentFs)) currentFs = 'm';
  applyFont(currentFs);
  fsBtn?.addEventListener('click', () => {
    currentFs = FS_CYCLE[(FS_CYCLE.indexOf(currentFs) + 1) % FS_CYCLE.length];
    localStorage.setItem('fs', currentFs);
    applyFont(currentFs);
  });

  history.scrollRestoration = 'manual';
  let lastHash = location.hash || '#/';
  window.addEventListener('hashchange', () => {
    try { sessionStorage.setItem(`scroll:${lastHash}`, String(window.scrollY)); } catch (err) { /* ignore */ }
    lastHash = location.hash || '#/';
    render();
  });
  render();
