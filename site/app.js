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
  featuredSites as pickFeaturedSites,
  sortedSites as sortSites,
} from './templates.js';
import { normalize, lookup as lookupIndex } from './search.js';
import { EMPEROR_READS, EMPRESS_IDS, HEIR_THREADS, SOURCE_GROUPS, PATH_NODES, SPINE_POWER, OPEN_STATE_LABEL } from './qing-content.mjs';

const DATA = {
  emperors: [],
  sites: [],
  people: [],
  sources: [],
  sourceIndex: [],
  tasks: [],
  units: [],
  claims: [],
  lanes: [],
  empressTimeline: [],
  princes: [],
  princesses: [],
  heirChain: [],
  portraits: [],
  crosswalk: [],
  regions: [],
  iiif: [],
  kangxiChapter: '',
  chapters: [],
  questions: [],
  predicates: {},
  coverage: {},
  notice: '',
  suggest: [],
  conflictSets: [],
  chronicle: [],
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
// 朝代专题页注册表：清代为 kangxi/yongzheng；新朝代在此注册自己的专题页函数。
const ERA_PAGES = { kangxi: kangxiPage, yongzheng: yongzhengPage };
const VIEW_CHUNKS = {
  '': ['home'],
  emperors: ['home'],
  sites: ['home'],
  site: ['home'],
  person: ['home', 'people', REIGN_CHUNK],
  people: ['home', 'people'],
  images: ['home', 'people'],
  image: ['home', 'people'],
  chapter: ['home', REIGN_CHUNK],
  claims: ['home', REIGN_CHUNK, 'people'],
  claim: ['home', REIGN_CHUNK, 'people'],
  succession: ['home', REIGN_CHUNK],
  empresses: ['home', REIGN_CHUNK],
  princes: ['home', REIGN_CHUNK],
  princesses: ['home', REIGN_CHUNK],
  lanes: ['home', REIGN_CHUNK],
  lane: ['home', REIGN_CHUNK],
  questions: ['home', REIGN_CHUNK],
  question: ['home', REIGN_CHUNK],
  sources: ['home', 'catalog'],
  source: ['home', 'catalog', REIGN_CHUNK],
  works: ['home', REIGN_CHUNK],
  how: ['home'],
  path: ['home', REIGN_CHUNK],
  spine: ['home', REIGN_CHUNK],
  chronicle: ['home', REIGN_CHUNK],
  overview: ['home', REIGN_CHUNK],
  tasks: ['home', 'catalog'],
  search: ['home', 'people', REIGN_CHUNK, 'catalog', 'search'],
};

async function loadChunk(name) {
  if (loadedChunks.has(name)) return;
  if (inflightChunks.has(name)) return inflightChunks.get(name);
  const pending = fetch(`data/${name}.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`无法载入 data/${name}.json`);
      return res.json();
    })
    .then((payload) => {
      if (name === 'search') SEARCH = payload;
      else Object.assign(DATA, payload);
      loadedChunks.add(name);
      reindex();
    })
    .finally(() => inflightChunks.delete(name));
  inflightChunks.set(name, pending);
  return pending;
}

async function ensureView(view) {
  const eraChunks = ['home', REIGN_CHUNK];
  const chunks = VIEW_CHUNKS[view] || (DYNASTY.eras[view] ? eraChunks : ['home', 'people', REIGN_CHUNK, 'catalog']);
  await Promise.all(chunks.map(loadChunk));
}

function eraPage(slug) {
  const page = ERA_PAGES[slug];
  if (page) return page();
  const eraLabel = DYNASTY.eras[slug];
  if (!eraLabel) return `<h1>没有这个页面</h1><p class="actions"><a class="link" href="#/">回十二帝</a></p>`;
  const chapters = eraChapters(eraLabel);
  const emperor = (DATA.emperors || []).find((e) => {
    const era = String(e['年号或通称'] || '').split('；')[0];
    return era === eraLabel;
  });
  const read = emperor ? EMPEROR_READS[emperor.person_id] : null;
  const lede = read?.body ? read.body.split('。')[0] + '。' : '';
  const sites = emperor ? sitesForEmperor(emperor.emperor_id).slice(0, 2) : [];
  const works = emperor ? (DATA.works || []).filter((w) => w.emperor_id === emperor.emperor_id) : [];
  const opened = works.filter((w) => ['L2', 'L3'].includes(w.open_state));
  const workLine = opened.length
    ? `已钉 ${opened.length} 种文献的条次。`
    : works.length
      ? `文献栏登记了 ${works.length} 种书，条次还没打开。`
      : '文献入口还没写成这一朝的专条。';
  return `
    <div class="reading">
      <p class="kicker">${esc(eraLabel)}</p>
      <h1>${esc(eraLabel)}朝</h1>
      ${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
      <p class="muted">专题页尚未建立。下面是已经写成的章。空栏不拿邻朝填。</p>
    </div>
    ${chapters.length ? `<ol class="threads">
      ${chapters.map((row) => `
        <li>
          <a class="thread" href="#/chapter/${esc(row.slug)}">
            <span class="thread-year">${esc(row.era)}</span>
            <h2>${esc(row.title)}</h2>
            <p>${esc(row.lede)}</p>
          </a>
        </li>`).join('')}
    </ol>` : '<p class="empty">尚无章节。</p>'}
    ${sites.length ? `
      <h2>今天在哪儿</h2>
      <div class="grid cards site-cards">${sites.map(siteCard).join('')}</div>` : ''}
    <p class="bound">${esc(workLine)}</p>
    ${read?.bound ? `<p class="bound">${esc(read.bound)}</p>` : ''}
    <p class="actions">
      ${emperor ? `<a class="link" href="#/person/${esc(emperor.person_id)}">先说这个人</a> · ` : ''}
      <a class="link" href="#/works">文献</a> ·
      <a class="link" href="#/">回十二帝</a>
    </p>
  `;
}


  const main = document.getElementById('main');
  const drawer = document.getElementById('drawer');
  const scrim = document.getElementById('scrim');
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
    { role: '御笔书法', title: '御笔书法', hint: '碑是刻出来的。纸上才是手写。' },
    { role: '奏折朱批', title: '奏折与朱批', hint: '红笔是皇帝批的。黑字是臣工写的。' },
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
    const cls = status === '已完成' || status === '已采纳' ? 'green'
      : status === '进行中' || status === '审核中' ? 'amber'
        : status === '阻塞' ? 'red' : 'indigo';
    return `<span class="chip ${cls}">${esc(status)}</span>`;
  }

  function predicateLabel(code) {
    return (DATA.predicates || {})[code] || code;
  }

  function evidenceMark(state) {
    if (!state) return '';
    if (state.startsWith('E')) return '<span class="mark ok">已回原文</span>';
    if (state.startsWith('C')) return '<span class="mark two">两说并存</span>';
    if (state.startsWith('S')) return '<span class="mark">后出转述</span>';
    return `<span class="mark">${esc(state)}</span>`;
  }

  function gloss(text) {
    return String(text || '')
      .replace(/不得写成/g, '不宜读成')
      .replace(/不得把/g, '不宜把')
      .replace(/不得标为/g, '不宜当作')
      .replace(/不得并入本条。?/g, '')
      .replace(/本库禁止[^.。]*[。.]?/g, '')
      .replace(/用户尚未抽查[^.。]*[。.]?/g, '');
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

  function laneCard(row) {
    return `
      <article class="lane-card" id="${esc(row.lane_id)}">
        <header>
          <strong><a href="#/lane/${esc(row.lane_id)}">${esc(row['标题'])}</a></strong>
        </header>
        <p class="muted">${lanePeople(row).map(personLink).join('、')}</p>
        <div class="split">
          <div class="said unofficial"><h3>通行 / 野史</h3><p>${esc(row['通行说法'])}</p>${row['野史笔记或影视怎么写'] ? `<p class="muted">${esc(row['野史笔记或影视怎么写'])}</p>` : ''}</div>
          <div class="said official"><h3>官书 / 档案</h3><p>${esc(row['官书或档案怎么写'])}</p></div>
        </div>
        <p><strong>怎么读</strong>　${esc(row['差异或读法'])}</p>
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
      else if (key === 'sites') on = current === 'sites' || current === 'site';
      else if (key === 'works') on = current === 'works';
      else on = key === current;
      link.classList.toggle('active', on);
    });
  }

  let drawerTrigger = null;

  function closeDrawer() {
    if (drawer.hidden) return;
    drawer.hidden = true;
    scrim.hidden = true;
    drawer.innerHTML = '';
    document.removeEventListener('keydown', onDrawerKeydown);
    const trigger = drawerTrigger;
    drawerTrigger = null;
    if (trigger && document.contains(trigger)) trigger.focus();
  }

  function onDrawerKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
    }
  }

  function openDrawer(html, trigger) {
    drawerTrigger = trigger || null;
    drawer.innerHTML = `<button class="close" type="button" data-close>关闭</button>${html}`;
    drawer.hidden = false;
    scrim.hidden = false;
    document.addEventListener('keydown', onDrawerKeydown);
    requestAnimationFrame(() => drawer.querySelector('.close')?.focus());
  }

  // 灯箱：img[data-lightbox] 点击放大预览，不打断卡片导航
  let lightboxTrigger = null;

  function openLightbox(img, trigger) {
    const box = document.getElementById('lightbox');
    const boxImg = document.getElementById('lightbox-img');
    const boxCap = document.getElementById('lightbox-cap');
    if (!box || !boxImg) return;
    lightboxTrigger = trigger || null;
    const caption = img.getAttribute('data-lightbox') || img.alt || '';
    const base = img.getAttribute('data-src') || img.currentSrc || img.src;
    // 本地缓存图优先试 1280px 档（cache-media.mjs --hires 产物），404 时回退 960
    const localHi = base.match(/^media\/[^@]+\.jpg$/) ? base.replace(/\.jpg$/, '@2x.jpg') : '';
    boxImg.onerror = localHi ? () => { boxImg.onerror = null; boxImg.src = base; } : null;
    boxImg.src = localHi || largestVariant(base);
    boxImg.alt = caption;
    if (boxCap) boxCap.textContent = caption;
    box.hidden = false;
    document.addEventListener('keydown', onLightboxKeydown);
    requestAnimationFrame(() => document.getElementById('lightbox-close')?.focus());
  }

  function closeLightbox() {
    const box = document.getElementById('lightbox');
    if (!box || box.hidden) return;
    box.hidden = true;
    document.removeEventListener('keydown', onLightboxKeydown);
    const trigger = lightboxTrigger;
    lightboxTrigger = null;
    if (trigger && document.contains(trigger)) trigger.focus();
  }

  function onLightboxKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLightbox();
    }
  }

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
      </dl>
      ${unit ? `<p>${esc(unit['史料名'])} ${esc(unit['卷次'])} ${esc(unit['原纪年'])}${unit['当日条次'] ? ` · 第 ${esc(unit['当日条次'])} 条` : ''}</p>
        <p class="actions">
            <a class="link" href="${esc(safeUrl(unit['直接记录网址']))}" target="_blank" rel="noopener">打开原文</a>
          ${source ? `<a class="link" href="#/source/${esc(source.source_id)}">来源说明</a>` : ''}
          <button class="link" type="button" data-cite="${esc(citationText(claim, unit))}">复制引用条</button>
        </p>` : ''}
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
        <p class="sub">${esc(claim['原始时间表达'])}${claim['公历下界'] ? ` · ${esc(claim['公历下界'])}` : ''}${claim['冲突组 ID'] ? ' · 两说并存' : ''}</p>
        <p class="quote">「${esc(claim['支持引文'])}」</p>
        <p class="actions">
          <button class="link" data-claim="${esc(claim['Assertion ID'])}">看依据</button>
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

  function relatedLinks(value) {
    const labels = {
      '#/kangxi': '康熙朝',
      '#/yongzheng': '雍正朝',
      '#/succession': '储位链',
      '#/empresses': '四后时间轴',
      '#/princes': '皇子表',
      '#/princesses': '皇女表',
      '#/lanes': '传闻对照',
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

  function emperorPack(read, emperor) {
    if (!read) return '';
    const hasPack = read.habits || read.policy || read.beats || read.problems;
    if (!hasPack) {
      return `
        ${read.body ? `<div class="emperor-bio">${read.body.split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('')}</div>` : ''}
        ${read.bound ? `<p class="bound">${esc(read.bound)}</p>` : ''}`;
    }
    const eraSlug = String(emperor['年号或通称'] || '').split('；')[0];
    const chronicleHref = eraSlug === '康熙' ? '#/chronicle/kangxi' : '';
    return `
      <div class="emperor-bio">${(read.body || '').split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      ${read.bound ? `<p class="bound">${esc(read.bound)}</p>` : ''}
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
              <p class="sub">${esc(row.key)} · ${esc(row.state)}</p>
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
    const rows = chronicleRows(emperorId).filter((row) => row['年号级收录'] === '是');
    if (!rows.length) return '';
    return `
      <h2>这一朝大事</h2>
      <div class="chronicle-list">${rows.map(chronicleItem).join('')}</div>
    `;
  }

  function pathPage() {
    return `
      <div class="reading">
        <p class="kicker">读路</p>
        <h1>这几处转过轴</h1>
        <p class="lede">称汗、称帝、入关、密储、内禅、条约、热河、退位。走完这一页，再点皇帝。</p>
      </div>
      <ol class="threads path-nodes">
        ${PATH_NODES.map((node) => `
          <li>
            <a class="thread" href="${esc(node.href)}">
              <span class="thread-year">${esc(node.year)}　${lampChip(node.lamp)}</span>
              <h2>${esc(node.title)}</h2>
              <p>${esc(node.text)}</p>
            </a>
          </li>`).join('')}
      </ol>
      <p class="actions"><a class="link" href="#/spine/power">谁坐龙椅，谁拍板</a> · <a class="link" href="#/kangxi">康熙朝</a> · <a class="link" href="#/how">日子怎么对</a></p>
    `;
  }

  function spinePage(slug) {
    if (slug && slug !== 'power') {
      return `<h1>还没有这条主轴</h1><p class="actions"><a class="link" href="#/path">回转轴年</a></p>`;
    }
    return `
      <div class="reading">
        <p class="kicker">继承与拍板</p>
        <h1>谁坐龙椅，不等于谁拍板</h1>
        <p class="lede">明立太子失败过。密旨后来才写成办法。禅了位，太上皇还批折子。幼帝那几年，拍板的人另有其人。</p>
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
      <p class="actions"><a class="link" href="#/path">转轴年</a> · <a class="link" href="#/succession">康熙储位全链</a></p>
    `;
  }

  function chroniclePage(slug) {
    const emperor = (DATA.emperors || []).find((row) => {
      const era = String(row['年号或通称'] || '').split('；')[0];
      return era === '康熙' && (!slug || slug === 'kangxi');
    });
    if (!emperor || (slug && slug !== 'kangxi')) {
      return `<h1>还没有这份大事记</h1><p class="actions"><a class="link" href="#/kangxi">回康熙朝</a></p>`;
    }
    const rows = chronicleRows(emperor.emperor_id);
    const byYear = new Map();
    for (const row of rows) {
      const year = String(row['公历下界'] || '').slice(0, 4) || '未系年';
      const list = byYear.get(year) || [];
      list.push(row);
      byYear.set(year, list);
    }
    return `
      <div class="reading">
        <p class="kicker">康熙大事记</p>
        <h1>日子对得上的十六件</h1>
        <p class="lede">只收已经打开的官书条。三藩、台湾、雅克萨不在这里。冲突年写成两说，不择一。</p>
        <p class="crumb"><a class="link" href="#/kangxi">康熙朝</a></p>
      </div>
      ${[...byYear.entries()].map(([year, list]) => `
        <section class="chronicle-year">
          <h2>${esc(year)}</h2>
          <div class="chronicle-list">${list.map(chronicleItem).join('')}</div>
        </section>`).join('')}
    `;
  }

  function chapterReadBlock(personId) {
    const chapters = chaptersForPerson(personId);
    const extras = {
      'QH-P-000001': [['#/chapter/kangxi-02', '两废太子'], ['#/chapter/kangxi-01', '即位、崩逝与遗诏'], ['#/succession', '储位全链'], ['#/princes', '儿子怎么排'], ['#/princesses', '女儿怎么排']],
      'QH-P-000002': [['#/kangxi', '康熙朝的储位与对照'], ['#/lanes', '改诏、丹药等传闻']],
      'QH-P-000053': [['#/lane/QH-L-0010', '出家说']],
    };
    const extra = extras[personId] || [];
    if (!chapters.length && !extra.length) return '';
    return `
          <h2>可以接着看</h2>
          ${chapters.map((row) => `<p class="rel"><a href="#/chapter/${esc(row.slug)}">${esc(row.title)}</a></p>`).join('')}
          ${extra.map(([href, label]) => `<p class="rel"><a href="${esc(href)}">${esc(label)}</a></p>`).join('')}
    `;
  }

  function kangxiPage() {
    const chapters = eraChapters('康熙');
    const bySlug = Object.fromEntries(chapters.map((row) => [row.slug, row]));
    const pinned = [
      { slug: 'kangxi-02', year: '1675–1712', href: '#/chapter/kangxi-02' },
      { slug: 'kangxi-01', year: '1661 · 1722', href: '#/chapter/kangxi-01' },
      { slug: '', year: '分日', href: '#/succession', title: '太子怎样立，怎样废', lede: '从择吉到再废，一天一天排下来。拘执那天还没颁诏。放出来，也不等于又立回去。' },
      { slug: '', year: '胤礽', href: '#/person/QH-P-000004', title: '胤礽', lede: '两岁被立，三十五岁再废。中间废过一次，又立过一次。' },
    ];
    const satellites = [
      { href: '#/empresses', year: '后妃', title: '康熙四后', lede: '活着的时候是妃、是后、是太后。孝恭两个字，是她死后才有的。' },
      { href: '#/princes', year: '皇子', title: '康熙的儿子', lede: '表上第一子是胤禔。后妃传说承瑞才是长子。第四子胤禛，这一卷里没有他的行。' },
      { href: '#/princesses', year: '皇女', title: '康熙的女儿', lede: '亲生二十人，受封八人。固伦若是追进，人已经不在了。' },
    ];
    const used = new Set(['kangxi-01', 'kangxi-02']);
    const rest = chapters.filter((row) => !used.has(row.slug));
    function threadItem(year, href, title, lede) {
      return `
          <li>
            <a class="thread" href="${esc(href)}">
              <span class="thread-year">${esc(year)}</span>
              <h2>${esc(title)}</h2>
              <p>${esc(lede)}</p>
            </a>
          </li>`;
    }
    return `
      <div class="reading">
        <p class="kicker">康熙</p>
        <h1>康熙朝</h1>
        <p class="lede">在位六十一年。太子立过、废过、又立、再废。日子对得上的留下，对不上的也留下。</p>
        <p class="actions"><a class="link" href="#/chronicle/kangxi">大事记十六件</a> · <a class="link" href="#/path">276年转轴</a> · <a class="link" href="#/spine/power">谁拍板</a></p>
      </div>
      <ol class="threads">
        ${pinned.map((item) => {
          const ch = item.slug ? bySlug[item.slug] : null;
          return threadItem(item.year, item.href, ch?.title || item.title, ch?.lede || item.lede);
        }).join('')}
        ${satellites.map((item) => threadItem(item.year, item.href, item.title, item.lede)).join('')}
        ${rest.map((row) => threadItem(row.era, `#/chapter/${row.slug}`, row.title, row.lede)).join('')}
        <li>
          <a class="thread" href="#/lanes">
            <span class="thread-year">对照</span>
            <h2>野史怎么说，官书怎么写</h2>
            <p>改诏、畅春园、后宫。通行说法和已经打开的官书放在一起。</p>
          </a>
        </li>
      </ol>
      <p class="actions"><a class="link" href="#/how">怎么读</a> · <a class="link" href="#/yongzheng">雍正朝</a></p>
    `;
  }

  function yongzhengPage() {
    const chapters = eraChapters('雍正');
    return `
      <div class="reading">
        <p class="kicker">雍正</p>
        <h1>雍正朝</h1>
        <p class="lede">遗诏在崩日，即位礼在七日后。改诏传闻、年羹尧案、隆科多案、军机处设立，都发生在这十三年里。</p>
      </div>
      <ol class="threads">
        ${chapters.map((row) => `
          <li>
            <a class="thread" href="#/chapter/${esc(row.slug)}">
              <span class="thread-year">${esc(row.era)}</span>
              <h2>${esc(row.title)}</h2>
              <p>${esc(row.lede)}</p>
            </a>
          </li>`).join('')}
        <li>
          <a class="thread" href="#/lanes">
            <span class="thread-year">对照</span>
            <h2>改诏、丹药、吕四娘</h2>
            <p>改诏、丹药、吕四娘——通行说法和官书原文放在一起，看差在哪里。</p>
          </a>
        </li>
      </ol>
      <p class="actions"><a class="link" href="#/kangxi">康熙朝</a> · <a class="link" href="#/person/QH-P-000002">胤禛</a> · <a class="link" href="#/questions">黄金问题</a></p>
    `;
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
    });
  }

  function sitesForEmperor(emperorId) {
    return sortedSites().filter((site) => splitIds(site['相关皇帝ID']).includes(emperorId));
  }

  function sitesPage() {
    const rows = sortedSites();
    return `
      <div class="page-head story">
        <h1>全部今地</h1>
      </div>
      <p class="lede">每一处今地，都对应一段当时的记录。照片是今貌，不是历史现场。</p>
      <p class="crumb"><a class="link" href="#/">回首页</a></p>
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
      <p class="kicker">今地 · ${esc(site['事件'])}</p>
      <h1 class="site-page-title">${esc(hook)}</h1>
      <div class="dossier image-dossier site-page">
        <figure class="portrait large site-hero">
          ${canEmbedSite(site) ? siteImg(site['预览文件'], hook) : ''}
          <figcaption>
            <p class="muted">${esc(site['作者或摄影者'] || '')}${site['制作年代或摄影日期'] ? ` · ${esc(site['制作年代或摄影日期'])}` : ''} · ${esc(site['文件页标示许可'])}</p>
          </figcaption>
        </figure>
        <div>
          <h2>当时</h2>
          <p>${esc(site['当时'])}</p>
          <h2>今日</h2>
          <p>${esc(site['今日'])}</p>
          <h2>怎么对上</h2>
          <p>${esc(site['今地说明'])}</p>
          <p class="bound">${esc(site['边界'])}</p>
          ${site['待核问题'] ? `<aside class="callout"><h2>证据说明 · ${esc((site['证据状态'] || '').slice(1) || '待核')}</h2><p>${esc(site['待核问题'])}</p></aside>` : ''}
          ${emperors.length ? `<dl class="kv">
            <dt>相关</dt><dd>${emperors.map((emperor) => `<a href="#/person/${esc(emperor.person_id)}">${esc(emperor['年号或通称'].split('；')[0])}</a>`).join(' · ')}</dd>
          </dl>` : ''}
          <p class="actions">
            <a class="link" href="#/">回十二帝</a>
            <a class="link" href="#/sites">全部今地</a>
            <a class="link" href="${esc(safeUrl(site['文件页']))}" target="_blank" rel="noopener">${esc(sourcePageLabel(site))}</a>
          </p>
          ${others.length ? `
            <h2>别处</h2>
            <div class="grid cards site-cards">${others.map(siteCard).join('')}</div>` : ''}
        </div>
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
              <tr data-href="#/person/${esc(row.person_id)}" tabindex="0" role="link" aria-label="查看 ${esc(row['规范名'].replace(/^爱新觉罗·/, ''))}">
                <td>${esc(row['规范名'].replace(/^爱新觉罗·/, ''))}</td>
                <td>${esc(row['常用名或异名'])}</td>
                <td>${esc(row['人物类型'])}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }


  function emperorPage(emperor) {
    const id = emperor.person_id;
    const card = emperor.card;
    const portrait = emperor.portrait || primaryPortrait(emperor.emperor_id);
    const others = (emperor.portraits || portraitsByEmperor.get(emperor.emperor_id) || [])
      .filter((row) => row.visual_id !== portrait?.visual_id);
    const read = EMPEROR_READS[id] || {};
    const father = emperor['父亲'] || '';
    const mother = emperor['母亲'] || '';
    const era = emperor['年号或通称'].split('；')[0];
    const aliases = [emperor['规范名'], emperor['庙号']].filter(Boolean).join(' · ');
    return `
      <p class="kicker">皇帝</p>
      <h1>${esc(era)}</h1>
      <p class="lede">${esc(aliases)}</p>
      <div class="emperor-read">
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
        ${eraChronicleBlock(emperor.emperor_id)}
        ${chapterReadBlock(id)}
        ${sitesForEmperor(emperor.emperor_id).length ? `
          <h2>今天在哪儿</h2>
          <div class="grid cards site-cards">${sitesForEmperor(emperor.emperor_id).map(siteCard).join('')}</div>
        ` : ''}
        <p class="actions">
          ${emperor['故宫人物页'] || card?.['故宫人物页'] ? `<a class="link" href="${esc(safeUrl(emperor['故宫人物页'] || card['故宫人物页']))}" target="_blank" rel="noopener">故宫人物页</a>` : ''}
        </p>
        ${groupedMedia(others)}
      </div>
    `;
  }

  function personPage(id) {
    const emperor = emperorByPerson.get(id);
    if (emperor) return emperorPage(emperor);
    const person = peopleById.get(id);
    if (!person) return `<h1>未找到 ${esc(id)}</h1><p>该编号尚未建立人物条目。</p>`;
    const claims = DATA.claims.filter((row) => row['主体 ID'] === id || row['客体 ID 或值'] === id);
    const yinreng = id === 'QH-P-000004';
    return `
      <p class="kicker">${esc(person['人物类型'] || '人物')}</p>
      <h1>${esc(person['规范名'].replace(/^爱新觉罗·/, ''))}</h1>
      <p class="lede">${esc(person['常用名或异名'] || '')}</p>
      <div class="reading">
        ${yinreng ? `<p class="lede">嫡子。两岁立为太子，做了三十三年。废过，立过，又废。拘执、颁诏、告祭，不是同一天。</p>
        <p class="bound">再废那两天，实录只写拘执和废黜。咸安宫只见于后出的本纪和列传。起居注还没打开。</p>
        <p class="actions"><a class="link" href="#/chapter/kangxi-02">读两废太子</a> · <a class="link" href="#/succession">看分日全链</a></p>` : (person['选择理由'] ? `<p class="lede">${esc(person['选择理由'])}</p>` : '')}
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
        ${lanesForPerson(id).length ? `<h2>传闻对照</h2>${lanesForPerson(id).map(laneCard).join('')}` : ''}
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
              <p class="event-line">${personLink(row.person_id)} ${esc(row['当时称号'])} · ${esc(row['事件类型'])} ${evidenceMark(row['回查状态'])}${row['冲突组 ID'] ? ' <span class="mark two">两说并存</span>' : ''}</p>
              <p class="quote">「${esc(row['引文'])}」</p>
              ${row['备注'] ? `<p class="gloss">${esc(gloss(row['备注']))}</p>` : ''}
              ${row['主张 ID'] ? `<p class="actions"><button class="link" data-claim="${esc(row['主张 ID'])}">看依据</button></p>` : ''}
            </div>
          </li>`).join('')}
      </ol>`;
  }

  function empressesPage(query) {
    const person = query.person || '全部';
    const rows = (DATA.empressTimeline || []).filter((row) => person === '全部' || row.person_id === person);
    const filters = ['全部', ...EMPRESS_IDS];
    return `
      <p class="kicker">后妃</p>
      <h1>康熙四后</h1>
      <p class="lede">活着的时候是妃、是后、是太后。孝诚、孝昭、孝懿、孝恭，是死后才加上去的。孝恭在康熙朝不是皇后。</p>
      <p class="warn">赫舍里氏册后，后妃传记四年七月，本纪记四年九月辛卯。两说都在，不抹平。</p>
      <p class="crumb"><a class="link" href="#/kangxi">康熙朝</a></p>
      <div class="filters">
        ${filters.map((item) => {
          const label = item === '全部' ? '四人全轴' : personName(item);
          return `<button type="button" data-empress="${esc(item)}" class="${item === person ? 'on' : ''}" aria-pressed="${item === person}">${esc(label)}</button>`;
        }).join('')}
      </div>
      ${timelineList(rows)}
      <p class="actions"><a class="link" href="#/claims">打开相关主张</a> · <a class="link" href="#/lanes">后宫侧记</a></p>
    `;
  }

  function princeById(id) {
    return (DATA.princes || []).find((row) => row.person_id === id) || null;
  }

  function princeCard(id) {
    const row = princeById(id);
    if (!row && id !== 'QH-P-000001') return '';
    if (id === 'QH-P-000001') {
      const n = (DATA.princes || []).length;
      return `<h2>皇子</h2>
        <p class="thread-lead">表序不是玉牒。第四子不在《清史稿》圣祖系这一卷，早殇另列。</p>
        <p class="actions"><a class="link" href="#/princes">读全表</a></p>`;
    }
    return `
      <h2>在皇子表里</h2>
      <p class="rel">${esc(row['表序标签'])} · ${esc(row['收录状态'])}${row['冲突组 ID'] ? ' · 两说并存' : ''}</p>
      <p class="quote">「${esc(row['世表摘要'] || row['后妃传子女句'])}」</p>
      <p class="gloss">生母候选：${row['生母人物ID'] ? personLink(row['生母人物ID']) : esc(row['生母候选名'] || '待核')}。${esc(gloss(row['备注'] || ''))}</p>
      <p class="actions"><a class="link" href="#/princes">读全表</a></p>`;
  }

  function princesPage(query) {
    const status = query.status || '全部';
    const groups = ['全部', '入序正文', '本卷缺号', '早薨附列'];
    const rows = (DATA.princes || []).filter((row) => status === '全部' || row['收录状态'] === status);
    return `
      <p class="kicker">皇子</p>
      <h1>康熙的儿子</h1>
      <p class="lede">表上第一子是胤禔。后妃传说承瑞才是长子。第四子胤禛不在这一卷，不是康熙没有这个儿子。</p>
      <p class="warn">世表以胤禔为第一子；后妃传以承瑞为长子。早殇未入序，仍是儿子。</p>
      <p class="crumb"><a class="link" href="#/kangxi">康熙朝</a></p>
      <div class="filters">
        ${groups.map((item) => `<button type="button" data-prince="${esc(item)}" class="${item === status ? 'on' : ''}" aria-pressed="${item === status}">${esc(item)}</button>`).join('')}
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>表序</th><th>规范名</th><th>世表用名</th><th>收录</th><th>生母候选</th><th>世表摘要</th></tr></thead>
          <tbody>
            ${rows.map((row) => `
              <tr data-href="#/person/${esc(row.person_id)}" tabindex="0" role="link" aria-label="查看 ${esc(row['规范名'].replace(/^爱新觉罗·/, ''))}">
                <td>${esc(row['表序'] || '—')}</td>
                <td>${esc(row['规范名'].replace(/^爱新觉罗·/, ''))}</td>
                <td>${esc(row['世表用名'] || '本卷无行')}</td>
                <td>${esc(row['收录状态'])}</td>
                <td>${esc(row['生母候选名'] || '待核')}</td>
                <td>${esc(row['世表摘要'])}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="actions"><a class="link" href="#/empresses">后妃</a> · <a class="link" href="#/princesses">皇女</a> · <a class="link" href="#/succession">储位</a></p>
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
        <p class="thread-lead">表序不是玉牒。和硕、固伦会改。常宁之女是抚育，不是亲生第二十一女。</p>
        <p class="actions"><a class="link" href="#/princesses">读全表</a></p>`;
    }
    return `
      <h2>在皇女表里</h2>
      <p class="rel">${esc(row['表序标签'])} · ${esc(row['收录状态'])}</p>
      <p class="quote">「${esc(row['封号摘要'] || row['生薨摘要'])}」</p>
      <p class="gloss">生母候选：${row['生母人物ID'] ? personLink(row['生母人物ID']) : esc(row['生母候选名'] || '待核')}。${esc(gloss(row['备注'] || ''))}</p>
      <p class="actions"><a class="link" href="#/princesses">读全表</a></p>`;
  }

  function princessesPage(query) {
    const status = query.status || '全部';
    const groups = ['全部', '入序受封', '未封', '抚育附列'];
    const rows = (DATA.princesses || []).filter((row) => status === '全部' || row['收录状态'] === status);
    return `
      <p class="kicker">皇女</p>
      <h1>康熙的女儿</h1>
      <p class="lede">亲生二十人，受封八人。固伦若是追进，人已经不在了。常宁之女是抚育，不要算进这二十。</p>
      <p class="warn">和硕、固伦是当时的封号。追进固伦，人已经薨了。表序不是玉牒。</p>
      <p class="crumb"><a class="link" href="#/kangxi">康熙朝</a></p>
      <div class="filters">
        ${groups.map((item) => `<button type="button" data-princess="${esc(item)}" class="${item === status ? 'on' : ''}" aria-pressed="${item === status}">${esc(item)}</button>`).join('')}
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>表序</th><th>规范名</th><th>收录</th><th>生母候选</th><th>封号</th><th>下嫁</th></tr></thead>
          <tbody>
            ${rows.map((row) => `
              <tr data-href="#/person/${esc(row.person_id)}" tabindex="0" role="link" aria-label="查看 ${esc(row['规范名'].replace(/^爱新觉罗氏/, ''))}">
                <td>${esc(row['表序'] || '—')}</td>
                <td>${esc(row['规范名'].replace(/^爱新觉罗氏/, ''))}</td>
                <td>${esc(row['收录状态'])}</td>
                <td>${esc(row['生母候选名'] || (row['收录状态'] === '抚育附列' ? '表未记生母' : '待核'))}</td>
                <td>${esc(row['封号摘要'])}</td>
                <td>${esc(row['下嫁摘要'] || '—')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="actions"><a class="link" href="#/princes">皇子</a> · <a class="link" href="#/empresses">后妃</a> · <a class="link" href="#/chapter/kangxi-08">怎么读这张表</a></p>
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
              <p class="event-line">${eventSentence(row)} ${evidenceMark(row['回查状态'])}${row['冲突组 ID'] ? ' <span class="mark two">两说并存</span>' : ''}</p>
              <p class="quote">「${esc(row['引文'])}」</p>
              ${row['备注'] ? `<p class="gloss">${esc(gloss(row['备注']))}</p>` : ''}
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
        <p class="lede">六月先择吉，十二月才册立。四十七年九月，驻跸、拘执、颁诏，隔了二十天。放出来不是又立回去。五十一年再废，实录写成两天。</p>
        <p class="crumb"><a class="link" href="#/kangxi">康熙朝</a> · <a class="link" href="#/chapter/kangxi-02">两废太子</a></p>
      </div>
      <aside class="gap-card">
        <h2>咸安宫</h2>
        <p>本纪和列传写他再废后关在这里。实录那两天只写拘执、废黜，没有这个地名。</p>
        <p>起居注该日还没打开。所以地点只记在后出的那一层，不提前写进实录。</p>
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
      <p class="actions"><a class="link" href="#/person/QH-P-000004">胤礽</a> · <a class="link" href="#/lanes">传闻对照</a> · <a class="link" href="#/princes">皇子</a></p>
    `;
  }

  function lanesPage(query) {
    const lane = query.lane || '全部';
    const groups = ['全部', '后宫趣事', '野史对照', '罕读史料'];
    const rows = (DATA.lanes || []).filter((row) => lane === '全部' || row['栏目'] === lane);
    return `
      <p class="kicker">对照</p>
      <h1>传闻怎么说，官书怎么写</h1>
      <p class="lede">通行说法和影视在这边。对面是已经打开的官书。</p>
      <p class="crumb"><a class="link" href="#/kangxi">康熙朝</a></p>
      <div class="filters">
        ${groups.map((item) => `<button type="button" data-lane="${esc(item)}" class="${item === lane ? 'on' : ''}" aria-pressed="${item === lane}">${esc(item)}</button>`).join('')}
      </div>
      ${rows.map(laneCard).join('')}
    `;
  }

  function lanePage(id) {
    const row = (DATA.lanes || []).find((item) => item.lane_id === id);
    if (!row) return `<h1>未找到条目 ${esc(id)}</h1>`;
    const related = (DATA.lanes || []).filter((item) => item.lane_id !== id && item['栏目'] === row['栏目']).slice(0, 6);
    return `
      <p class="kicker">${esc(row['栏目'])}</p>
      <h1>${esc(row['标题'])}</h1>
      ${laneCard(row)}
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
    const siblings = list
      .filter((row) => row.person_id === chapter.person_id)
      .slice()
      .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
    const idx = siblings.findIndex((row) => row.slug === chapter.slug);
    const prev = idx > 0 ? siblings[idx - 1] : null;
    const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
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
    const body = expandConflicts(chapter.bodyHtml || '');
    const toc = chapterToc(body);
    const status = String(chapter.status || '').trim();
    return `
      <div class="reading">
        <p class="kicker">${esc(chapter.era)}</p>
        <h1>${esc(chapter.title)}</h1>
        <p class="lede">${noOrphan(chapter.lede)}</p>
        ${status ? `<p class="status-chip">${esc(status)}</p>` : ''}
        <p class="crumb"><a class="link" href="${esc(home)}">${esc(homeLabel)}</a></p>
        ${toc.length ? `<nav class="chapter-toc" aria-label="本章目录">
          <p class="toc-label">本章目录</p>
          <ol>${toc.map((item) => `<li><button type="button" class="link" data-scroll="${esc(item.id)}">${esc(item.title)}</button></li>`).join('')}</ol>
        </nav>` : ''}
      </div>
      <div class="md">${body}</div>
      ${units.length ? `<section class="chapter-evidence">
        <h2>本章打开过的卷</h2>
        <p>${units.length} 处来源，${claimCount} 条主张。正文里的「看依据」对着原文。</p>
        <p class="actions">${units.map((unit) => `<a class="link" href="#/claims?unit=${esc(unit.source_unit_id)}">${esc(unit['卷次'] || unit.source_unit_id)}</a>`).join(' · ')}</p>
      </section>` : ''}
      ${chapter.related ? `<p class="chapter-related">${relatedLinks(chapter.related)}</p>` : ''}
      ${chapterNav(chapter, list)}
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
      <div class="reading">
        <p class="kicker">脉络</p>
        <h1>${esc(ov.title)}</h1>
        <p class="lede">${noOrphan(ov.lede)}</p>
        <p class="crumb"><a class="link" href="#/">回十二帝</a></p>
        ${toc.length ? `<nav class="chapter-toc" aria-label="本章目录">
          <p class="toc-label">本章目录</p>
          <ol>${toc.map((item) => `<li><button type="button" class="link" data-scroll="${esc(item.id)}">${esc(item.title)}</button></li>`).join('')}</ol>
        </nav>` : ''}
      </div>
      <div class="md">${body}</div>
      ${(prev || next) ? `<nav class="chapter-nav" aria-label="上下篇">
        ${prev ? `<a class="link" href="#/overview/${esc(prev.slug)}">上一篇 ${esc(prev.title)}</a>` : '<span></span>'}
        ${next ? `<a class="link" href="#/overview/${esc(next.slug)}">下一篇 ${esc(next.title)}</a>` : '<span></span>'}
      </nav>` : ''}
    `;
  }

  function bindHref(id) {
    if (/^QH-A-/.test(id)) return `#/claim/${id}`;
    if (/^QH-P-/.test(id)) return `#/person/${id}`;
    if (/^QH-ST-/.test(id)) return `#/site/${id}`;
    if (/^QH-L-/.test(id)) return `#/lane/${id}`;
    if (/^QH-SU-/.test(id)) return `#/claims?unit=${encodeURIComponent(id)}`;
    if (/^QH-CH-/.test(id)) return `#/chapter/${id}`;
    return '';
  }

  function questionCard(row, opts = {}) {
    const binds = String(row['绑定ID'] || '').split(/[；;]/).map((item) => item.trim()).filter(Boolean);
    const refuse = row['期望行为'] === '拒绝作答';
    return `
      <article class="claim" id="${esc(row.question_id)}">
        <p class="sub">${esc(row['类别'])} · ${esc(row['期望行为'])}</p>
        <p class="sentence"><a href="#/question/${esc(row.question_id)}">${esc(row['问题'])}</a></p>
        ${opts.hideBound ? '' : (refuse
          ? `<p class="bound">${esc(row['拒答说明'])}</p>`
          : `<p class="lede">${esc(row['可公开答案'])}</p>`)}
        <p class="actions">
          ${row['路由'] ? `<a class="link" href="${esc(row['路由'])}">查看相关页</a>` : ''}
          ${binds.map((id) => {
            const href = bindHref(id);
            return href ? `<a class="link" href="${esc(href)}">${esc(id)}</a>` : `<span class="chip">${esc(id)}</span>`;
          }).join(' ')}
        </p>
      </article>
    `;
  }

  function questionsPage(query) {
    const group = query.type || '全部';
    const types = ['全部', '事实查询', '关系路径', '版本冲突', '无证据拒答'];
    const rows = (DATA.questions || []).filter((row) => group === '全部' || row['类别'] === group);
    return `
      <div class="reading">
        <p class="kicker">验收</p>
        <h1>黄金问题</h1>
        <p class="lede">按事实查询、关系路径、版本冲突、无证据拒答分组。能回答的给出处，没有证据的标明不可证。</p>
      </div>
      <div class="filters">
        ${types.map((item) => `<button type="button" data-qtype="${esc(item)}" class="${item === group ? 'on' : ''}" aria-pressed="${item === group}">${esc(item)}</button>`).join('')}
      </div>
      ${rows.map(questionCard).join('')}
    `;
  }

  function questionPage(id) {
    const row = (DATA.questions || []).find((item) => item.question_id === id);
    if (!row) return `<h1>未找到问题 ${esc(id)}</h1><p><a href="#/questions">回黄金问题</a></p>`;
    const refuse = row['期望行为'] === '拒绝作答';
    return `
      <p class="kicker">黄金问题</p>
      <h1>${esc(row['问题'])}</h1>
      ${refuse ? noEvidenceBanner('此处公开材料不足，不可证', row['拒答说明']) : ''}
      ${questionCard(row, { hideBound: refuse })}
      <p class="crumb"><a class="link" href="#/questions">全部问题</a></p>
    `;
  }

  function imagesPage() {
    return `
      <div class="page-head">
        <h1>画像</h1>
      </div>
      ${DATA.emperors.map((emperor) => {
        const list = emperor.portraits || portraitsByEmperor.get(emperor.emperor_id) || [];
        const primary = list.find((row) => row['展示角色'] === '默认朝服像') || list[0];
        const others = list.filter((row) => row !== primary);
        return `
          <section class="panel image-row">
            <h2>${esc(emperor['年号或通称'].split('；')[0])} · ${esc(emperor['规范名'])}</h2>
            <div class="split">
              <div>${portraitBlock(primary, `<a class="link" href="#/person/${esc(emperor.person_id)}">人物页</a>`)}</div>
              <div>
                ${others.length ? others.map((row) => `
                  <a class="alt-card" href="#/image/${esc(row.visual_id)}">
                    ${canEmbed(row) ? mediaImg(row['预览文件'], row['对象标题']) : `<div class="img-fallback">${esc(row['展示角色'])}</div>`}
                    <div>
                      <strong>${esc(row['对象标题'])}</strong>
                      <p class="muted">${esc(joinPublic([row['展示角色'], row['图像性质'], row['制作年代或摄影日期']]))}</p>
                      ${row['卡片钩子'] ? `<p class="muted">${esc(row['卡片钩子'])}</p>` : ''}
                    </div>
                  </a>`).join('') : '<p class="muted">目前只有朝服正像。</p>'}
              </div>
            </div>
          </section>`;
      }).join('')}
    `;
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
    const facts = [
      portrait['制作年代或摄影日期'] ? `<dt>年代</dt><dd>${esc(portrait['制作年代或摄影日期'])}</dd>` : '',
      portrait['作者或摄影者'] ? `<dt>作者</dt><dd>${esc(portrait['作者或摄影者'])}</dd>` : '',
      portrait['文件页标示许可'] ? `<dt>许可</dt><dd>${esc(portrait['文件页标示许可'])}</dd>` : '',
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
      <p class="kicker">${esc(era)} · ${esc(portrait['展示角色'])}</p>
      <h1>${esc(portrait['对象标题'])}</h1>
      ${hook ? `<p class="lede">${esc(hook)}</p>` : ''}
      <div class="dossier image-dossier">
        ${canEmbed(portrait) ? `
        <figure class="portrait large${scriptish ? ' script' : ''}">
          ${manifest ? `<div class="osd-viewer" data-manifest="${esc(manifest)}" data-fallback="${esc(portrait['预览文件'])}" data-alt="${esc(portrait['对象标题'])}"><noscript><img src="${esc(portrait['预览文件'])}" alt="${esc(portrait['对象标题'])}"></noscript></div>` : `<div class="image-regions">
            ${mediaImg(portrait['预览文件'], portrait['对象标题'], portrait['对象标题'])}
            ${overlayHtml}
          </div>`}
        </figure>` : ''}
        <div>
          ${analysis ? `<p>${esc(analysis)}</p>` : ''}
          ${regionLinksHtml}
          ${portrait['释文'] ? `<h2>释文</h2>${transcriptionBlock(portrait)}` : ''}
          ${canEmbed(portrait) ? `<div class="chips">${annotationChips(portrait)}</div>` : ''}
          ${facts ? `<dl class="kv">${facts}</dl>` : ''}
          <p class="actions">
            ${emperor ? `<a class="link" href="#/person/${esc(emperor.person_id)}">回到人物页</a>` : ''}
            ${sourceUrl ? `<a class="link" href="${esc(sourceUrl)}" target="_blank" rel="noopener">${esc(sourcePageLabel(portrait))}</a>` : ''}
          </p>
          ${groupedMedia(siblings)}
        </div>
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
    const label = OPEN_STATE_LABEL[state] || '入口已登记';
    return `<span class="open-state open-${esc(state || 'L0')}">${esc(label)}</span>`;
  }

  function worksPage() {
    const works = DATA.works || [];
    const workCard = (w) => {
      const opened = w.open_state === 'L2' || w.open_state === 'L3';
      const entryLabel = opened ? '打开条次' : '馆藏／咨询入口';
      return `
      <article class="card work-card">
        <div class="meta">
          <div class="era">${esc(w['文献类型'])} · ${esc(w['成书年代'])} · ${openStateChip(w.open_state)}</div>
          <h2>${esc(w['文献名称'])}</h2>
          ${w['卷数'] ? `<p class="muted">${esc(w['卷数'])}</p>` : ''}
          <p>${esc(w['内容概述'])}</p>
          ${w['备注'] ? `<p class="muted">${esc(w['备注'])}</p>` : ''}
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
      .filter((g) => g.rows.length);
    const groupedIds = new Set(groups.flatMap((g) => g.rows.map((w) => w.work_id)));
    const rest = works.filter((w) => !groupedIds.has(w.work_id));
    return `
      <p class="kicker">文献</p>
      <h1>十二帝著述与官修书</h1>
      <p class="lede">能打开条次的，才写进叙事。只登记了入口的书，不假装已经读过原文。</p>
      ${featured.length ? `<h2>专论</h2><div class="grid cards work-grid">${featured.map(workCard).join('')}</div>` : ''}
      ${groups.map((g) => {
        const era = String(g.e['年号或通称'] || '').split('；')[0];
        const read = EMPEROR_READS[g.e.person_id];
        const intro = read?.body ? read.body.split('。')[0] + '。' : '';
        return `
        <h2>${esc(era)}</h2>
        ${intro ? `<p class="muted" style="max-width:var(--read);margin-bottom:16px">${esc(intro)}</p>` : ''}
        <div class="grid cards work-grid">${g.rows.map(workCard).join('')}</div>`;
      }).join('')}
      ${rest.length ? `<h2>汇编</h2><div class="grid cards work-grid">${rest.map(workCard).join('')}</div>` : ''}
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
      <div class="chips">${rightsChip(row['权利颜色'])}<span class="chip">${esc(row['证据等级'])}</span>${statusChip(row['状态'])}</div>
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
      ${relatedUnits.length ? `<h2>已拆来源单元</h2>${relatedUnits.map((unit) => `<p><a href="#/claims?unit=${esc(unit.source_unit_id)}">${esc(unit.source_unit_id)}</a> ${esc(unit['卷次'])} ${esc(unit['原纪年'])}</p>`).join('')}` : ''}
    `;
  }

  function taskRow(row) {
    return `
      <li class="task-row">
        <div class="task-main">
          <p class="task-title">${esc(row['任务'])}</p>
          ${row['上次完成位置'] ? `<p class="muted">${esc(row['上次完成位置'])}</p>` : ''}
          ${row['下一步动作'] ? `<p class="task-next">下一步：${esc(row['下一步动作'])}</p>` : ''}
        </div>
        <div class="task-side">${statusChip(row['状态'])}<span class="task-pri ${row['优先级'] === 'P0' ? 'p0' : ''}">${esc(row['优先级'])}</span></div>
      </li>`;
  }

  function tasksPage() {
    const doing = DATA.tasks.filter((row) => row['状态'] === '进行中');
    const todo = DATA.tasks.filter((row) => row['状态'] === '未开始');
    const done = DATA.tasks.filter((row) => row['状态'] === '已完成');
    return `
      <div class="page-head story">
        <h1>还在做的事</h1>
      </div>
      <p class="lede">一条线做完，再开下一条。</p>
      <div class="task-summary">
        <div><b>${doing.length}</b><span>进行中</span></div>
        <div><b>${todo.length}</b><span>待开</span></div>
        <div><b>${done.length}</b><span>已完成</span></div>
      </div>
      ${doing.length ? `<h2>进行中</h2><ul class="task-list">${doing.map(taskRow).join('')}</ul>` : ''}
      ${todo.length ? `<h2>待开</h2><ul class="task-list">${todo.map(taskRow).join('')}</ul>` : ''}
      ${done.length ? `<details class="task-done"><summary>已完成 ${done.length} 条</summary><ul class="task-list">${done.map(taskRow).join('')}</ul></details>` : ''}
    `;
  }

  function highlightHtml(text, q) {
    const safe = esc(text);
    const needle = String(q || '').trim();
    if (!needle) return safe;
    const chars = [...needle].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    try {
      return safe.replace(new RegExp(chars.join('[·\\s；;，,。.\-_/]*'), 'gi'), (m) => `<mark>${m}</mark>`);
    } catch {
      return safe;
    }
  }

  function searchPage(q) {
    const needle = normalize(q);
    if (!needle) return `<h1>检索</h1><p>输入年号、庙号、本名、异名或 ID。</p>`;
    const hits = lookupIndex(SEARCH, q);
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
    return `
      <p class="kicker">检索</p>
      <h1>「${esc(q)}」</h1>
      <p class="muted">共 ${total} 条命中</p>
      <h2>人物 ${peopleHits.length}</h2>
      ${peopleHits.length ? `<ul>${peopleHits.map((hit) => `<li><a href="#/person/${esc(hit.id)}">${highlightHtml(hit.label, q)}</a> <span class="muted">${highlightHtml(hit.extra || '', q)}</span></li>`).join('')}</ul>` : '<p class="empty">无人物命中。</p>'}
      ${claimHits.length ? `<h2>依据 ${claimHits.length}</h2>${claimHits.map(claimCard).join('')}` : ''}
      ${empressHits.length ? `<h2>后妃 ${empressHits.length}</h2>${timelineList(empressHits)}` : ''}
      ${princeHits.length ? `<h2>皇子 ${princeHits.length}</h2><ul>${princeHits.map((row) => `<li><a href="#/person/${esc(row.person_id)}">${esc(row['规范名'].replace(/^爱新觉罗·/, ''))}</a> <span class="muted">${esc(row['表序标签'])}</span></li>`).join('')}</ul>` : ''}
      ${princessHits.length ? `<h2>皇女 ${princessHits.length}</h2><ul>${princessHits.map((row) => `<li><a href="#/person/${esc(row.person_id)}">${esc(row['规范名'].replace(/^爱新觉罗氏/, ''))}</a> <span class="muted">${esc(row['表序标签'])}</span></li>`).join('')}</ul>` : ''}
      ${heirHits.length ? `<h2>储位 ${heirHits.length}</h2>${heirList(heirHits)}` : ''}
      ${siteHits.length ? `<h2>今地 ${siteHits.length}</h2><div class="grid cards site-cards">${siteHits.map(siteCard).join('')}</div>` : ''}
      ${chapterHits.length ? `<h2>章节 ${chapterHits.length}</h2><ul>${chapterHits.map((hit) => `<li><a href="#/chapter/${esc(hit.id)}">${highlightHtml(hit.label, q)}</a> <span class="muted">${highlightHtml(hit.extra || '', q)}</span></li>`).join('')}</ul>` : ''}
      ${questionHits.length ? `<h2>黄金问题 ${questionHits.length}</h2><ul>${questionHits.map((hit) => `<li><a href="#/question/${esc(hit.id)}">${highlightHtml(hit.label, q)}</a> <span class="muted">${highlightHtml(hit.extra || '', q)}</span></li>`).join('')}</ul>` : ''}
      ${laneHits.length ? `<h2>传闻对照 ${laneHits.length}</h2>${laneHits.map(laneCard).join('')}` : ''}
      ${sourceHits.length ? `<h2>来源 ${sourceHits.length}</h2><ul>${sourceHits.map((row) => `<li><a href="#/source/${esc(row.source_id)}">${esc(row.source_id)} ${esc(row['机构或资源'])}</a></li>`).join('')}</ul>` : ''}
      ${workHits.length ? `<h2>文献 ${workHits.length}</h2><ul>${workHits.map((hit) => `<li><a href="#/works">${highlightHtml(hit.label, q)}</a> <span class="muted">${highlightHtml(hit.extra || '', q)}</span></li>`).join('')}</ul>` : ''}
    `;
  }

  function howToReadPage() {
    return `
      <div class="reading how-read">
        <p class="kicker">读法</p>
        <h1>日子对得上，就写日子</h1>
        <p class="lede">实录写到哪一天，就停在哪一天。后出的本纪、列传、世表若不一样，两说都在，不抹平。</p>
        <div class="md">
          <h2>实录、本纪、列传、世表</h2>
          <p>实录能对到卷和条次，仍是官修，不是原档。本纪后出，有时多写实录当天没有的话。列传可以跟本纪差一天。世表常把几年收成一句。后出的那一层，不拿来改前面一层。</p>
          <h2>审核中</h2>
          <p>原文对上了，还没人具名说「就这样定」。可以读，不是终审。</p>
          <h2>空白的图</h2>
          <p>只有绿标能嵌进来。黄的只给说明和外链。网上看得见，不等于能放进这个站。</p>
          <h2>咸安宫</h2>
          <p>本纪和列传写他关在这里。实录再废那两天没有这个地名。起居注还没打开，就不补。</p>
        </div>
        <p class="actions"><a class="link" href="#/path">转轴年</a> · <a class="link" href="#/chapter/kangxi-02">两废太子</a> · <a class="link" href="#/kangxi">康熙朝</a></p>
      </div>
    `;
  }

  let renderGen = 0;
  async function render() {
    const gen = ++renderGen;
    closeDrawer();
    const { parts, query, path } = parseHash();
    setNav(path === '/' ? '/' : `/${parts[0]}`);
    const view = parts[0] || '';
    const isHome = !view || view === 'emperors';
    if (isHome && main.dataset.ssr === 'home') {
      delete main.dataset.ssr;
      ensureView('').catch(() => {});
      return;
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
    else if (view === 'chapter') html = chapterPage(parts[1]);
    else if (view === 'questions') html = questionsPage(query);
    else if (view === 'question') html = questionPage(parts[1]);
    else if (view === 'images') html = imagesPage();
    else if (view === 'image') html = imagePage(parts[1]);
    else if (view === 'sites') html = sitesPage();
    else if (view === 'site') html = sitePage(parts[1]);
    else if (view === 'lanes') html = lanesPage(query);
    else if (view === 'lane') html = lanePage(parts[1]);
    else if (view === 'empresses') html = empressesPage(query);
    else if (view === 'princes') html = princesPage(query);
    else if (view === 'princesses') html = princessesPage(query);
    else if (view === 'succession') html = successionPage(query);
    else if (view === 'sources') html = sourcesPage();
    else if (view === 'works') html = worksPage();
    else if (view === 'source') html = sourcePage(parts[1]);
    else if (view === 'tasks') html = tasksPage();
    else if (view === 'search') html = searchPage(query.q || '');
    else if (view === 'how') html = howToReadPage();
    else if (view === 'path') html = pathPage();
    else if (view === 'spine') html = spinePage(parts[1]);
    else if (view === 'chronicle') html = chroniclePage(parts[1]);
    else if (view === 'overview') html = overviewPage(parts[1]);
    else html = `<h1>没有这个页面</h1><p><a href="#/">回首页</a></p>`;
    destroyOsdViewers();
    main.innerHTML = html;
    const live = document.getElementById('search-status');
    if (live) live.textContent = view === 'search' ? `检索「${query.q || ''}」已更新` : '';
    main.classList.remove('enter');
    void main.offsetWidth;
    main.classList.add('enter');
    window.scrollTo(0, 0);
    initOsdViewers();
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

  function searchPeople(q) {
    const needle = normalize(q);
    if (!needle) return [];
    const rows = DATA.suggest || [];
    if (rows.length) {
      return rows.filter((row) => normalize(row.hay).includes(needle)).map((row) => ({
        id: row.id,
        label: row.label,
        extra: row.extra,
      }));
    }
    return lookupIndex(SEARCH, q).filter((row) => row.type === 'person');
  }

  function hideSuggest() {
    suggest.hidden = true;
    suggest.innerHTML = '';
    suggestItems = [];
    suggestActive = -1;
    searchInput.setAttribute('aria-expanded', 'false');
  }

  function renderSuggest(q) {
    const hits = searchPeople(q).slice(0, 8);
    suggestItems = hits;
    suggestActive = -1;
    if (!hits.length) {
      suggest.innerHTML = '<p class="suggest-empty">无人物命中，回车可检索全站。</p>';
    } else {
      suggest.innerHTML = hits.map((hit, index) => `
        <a class="suggest-item" role="option" id="sug-${index}" href="#/person/${esc(hit.id)}">
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
      if (hit) location.hash = `#/person/${encodeURIComponent(hit.id)}`;
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
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const citeBtn = event.target.closest('[data-cite]');
    if (citeBtn) {
      const text = citeBtn.getAttribute('data-cite') || '';
      const done = () => { citeBtn.textContent = '已复制'; };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => { citeBtn.textContent = text; });
      } else {
        citeBtn.textContent = text;
      }
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
    const empressFilter = event.target.closest('[data-empress]');
    if (empressFilter) {
      const id = empressFilter.getAttribute('data-empress');
      location.hash = id === '全部' ? '#/empresses' : `#/empresses?person=${encodeURIComponent(id)}`;
      return;
    }
    const princeFilter = event.target.closest('[data-prince]');
    if (princeFilter) {
      const id = princeFilter.getAttribute('data-prince');
      location.hash = id === '全部' ? '#/princes' : `#/princes?status=${encodeURIComponent(id)}`;
      return;
    }
    const princessFilter = event.target.closest('[data-princess]');
    if (princessFilter) {
      const id = princessFilter.getAttribute('data-princess');
      location.hash = id === '全部' ? '#/princesses' : `#/princesses?status=${encodeURIComponent(id)}`;
      return;
    }
    const stageFilter = event.target.closest('[data-stage]');
    if (stageFilter) {
      const id = stageFilter.getAttribute('data-stage');
      location.hash = id === '全部' ? '#/succession' : `#/succession?stage=${encodeURIComponent(id)}`;
      return;
    }
    const row = event.target.closest('tr[data-href]');
    if (row) location.hash = row.getAttribute('data-href');
  });

  document.body.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const row = event.target.closest('tr[data-href]');
    if (!row) return;
    event.preventDefault();
    location.hash = row.getAttribute('data-href');
  });

  scrim.addEventListener('click', closeDrawer);

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
    themeBtn.textContent = THEME_LABEL[mode];
  }
  let currentTheme = localStorage.getItem('theme') || 'auto';
  if (!THEME_CYCLE.includes(currentTheme)) currentTheme = 'auto';
  applyTheme(currentTheme);
  themeBtn.addEventListener('click', () => {
    const idx = THEME_CYCLE.indexOf(currentTheme);
    currentTheme = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    localStorage.setItem('theme', currentTheme);
    applyTheme(currentTheme);
  });

  window.addEventListener('hashchange', () => { render(); });
  render();
