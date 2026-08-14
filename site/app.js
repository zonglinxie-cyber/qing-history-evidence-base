import {
  esc,
  canEmbed,
  canEmbedSite,
  siteCard,
  homeHtml,
  imgTag,
  featuredSites as pickFeaturedSites,
  sortedSites as sortSites,
} from './templates.js';
import { normalize, lookup as lookupIndex } from './search.js';

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
  kangxiChapter: '',
  chapters: [],
  questions: [],
  coverage: {},
  notice: '',
  suggest: [],
};

const loadedChunks = new Set();
const inflightChunks = new Map();
let SEARCH = { entries: [], postings: {} };

const VIEW_CHUNKS = {
  '': ['home'],
  emperors: ['home'],
  sites: ['home'],
  site: ['home'],
  person: ['home', 'people', 'kangxi'],
  people: ['home', 'people'],
  images: ['home', 'people'],
  image: ['home', 'people'],
  kangxi: ['home', 'kangxi'],
  yongzheng: ['home', 'kangxi'],
  chapter: ['home', 'kangxi'],
  claims: ['home', 'kangxi'],
  claim: ['home', 'kangxi'],
  succession: ['home', 'kangxi'],
  empresses: ['home', 'kangxi'],
  princes: ['home', 'kangxi'],
  princesses: ['home', 'kangxi'],
  lanes: ['home', 'kangxi'],
  lane: ['home', 'kangxi'],
  questions: ['home', 'kangxi'],
  question: ['home', 'kangxi'],
  sources: ['home', 'catalog'],
  source: ['home', 'catalog', 'kangxi'],
  tasks: ['home', 'catalog'],
  search: ['home', 'people', 'kangxi', 'catalog', 'search'],
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
  const chunks = VIEW_CHUNKS[view] || ['home', 'people', 'kangxi', 'catalog'];
  await Promise.all(chunks.map(loadChunk));
}

  const PREDICATES = {
    accession_occurred: '即位',
    ritual_self_designation: '礼仪自称',
    accession_justification: '即位理由',
    delegated_heaven_announcement: '遣官祭告昊天',
    delegated_earth_announcement: '遣官祭告地祇',
    delegated_ancestral_temple_announcement: '遣官祭告太庙',
    delegated_altars_announcement: '遣官祭告社稷',
    performed_mourning_ritual: '几筵行礼',
    paid_respects_to_empress_dowager: '诣皇太后宫',
    ascended_throne_at: '升座地点',
    ceremonial_music_status: '中和乐状态',
    waived_congratulatory_memorial: '免宣贺表',
    issued_general_amnesty: '颁诏大赦',
    announced_next_reign_era: '宣布次年年号',
    testament_self_reported_reign_length: '遗诏自述在位年数',
    testament_self_reported_age: '遗诏自述年龄',
    testament_descendant_count: '遗诏自报子孙数',
    testament_self_reported_learning: '遗诏自述读书',
    testament_self_reported_archery: '遗诏自述骑射',
    testament_claimed_military_planning: '遗诏军事自评',
    testament_claimed_treasury_rule: '遗诏财政自评',
    testament_claimed_palace_decoration: '遗诏行宫叙事',
    testament_claimed_palace_annual_cost: '遗诏宫费自报',
    testament_claimed_riverworks_annual_cost: '遗诏河工自报',
    testament_requested_clan_protection: '遗诏宗室保全',
    testament_identified_yinzhen: '遗诏点名胤禛',
    testament_evaluated_yinzhen: '遗诏评价胤禛',
    designated_successor: '指定继承人',
    illness_became_critical: '疾大渐',
    summoned_yinzhen_from_zhai: '召胤禛于斋所',
    delegated_suburban_sacrifice: '派员恭代南郊',
    summoned_to_bedside: '召至御榻前',
    oral_designated_successor: '御榻口谕指定继承人',
    arrived_at_sleeping_palace: '趋进寝宫',
    explained_worsening_illness: '告以病势日臻',
    visited_to_ask_after_health: '进见问安',
    died_at: '崩逝地点与时刻',
    present_at_bedside: '御榻前在场',
    invested_as_empress: '册为皇后',
    invested_as_consort: '册为妃嫔',
    gave_birth_to: '生育',
    died_on: '崩逝',
    posthumous_title_conferred: '上谥',
    posthumous_title_changed: '改谥',
    buried_at: '安葬',
    honored_as_empress_dowager: '尊为皇太后',
    named_in_table_as: '世表用名',
    listed_as_early_deceased: '早薨未入序',
    described_as_eldest_son: '称为长子',
    adopted_out_to: '过继出',
    father_of_in_table: '世表父系计数',
    table_birth_order: '世表序齿',
    table_daughter_order: '公主表序齿',
    invested_as_princess: '封公主',
    advanced_as_princess: '进封公主',
    posthumously_advanced_as: '追进封',
    married_to: '下嫁',
    born_on: '出生',
    fostered_not_begotten: '抚育非亲生',
    father_of_in_princess_table: '公主表父系计数',
    unsealed_daughter_count: '未封皇女计数',
    consort_title_stripped: '额驸削号',
    absent_from_volume: '本卷缺号',
    stationed_at: '驻跸',
    stated_not_to_invest: '上谕明示不欲立',
    edict_stated_ritual_date: '诏书自述告祭日',
    reported_in_edict: '上谕转述',
    invested_as_heir: '立为皇太子',
    arrested_as_heir: '拘执废太子',
    deposed_as_heir: '废皇太子',
    stripped_of_title: '削爵',
    petitioned_reinstatement: '请复立',
    proposed_as_heir: '被请立为储',
    released_from_confinement: '释放',
    reinstated_as_heir: '复立为皇太子',
    announced_deposition_at_temple: '废储告庙',
    ill_at: '不豫地点',
    appointed_regency_council: '命总理事务',
    recalled_to_capital: '召还京师',
    invested_as_prince: '封王',
    appointed_as: '授职',
    honored_as: '加衔',
    invested_as_duke: '封公',
    coffin_placed_at: '奉安梓宫',
    sealed_heir_edict_behind: '密旨收藏处',
    campaign_concluded: '战事结束',
    reprimanded_for_wording: '责让用语',
    transferred_as: '调任',
    demoted_to: '黜为',
    granted_death: '赐死或令自裁',
    renamed_as: '易名',
    imprisoned: '禁锢',
    imprisoned_at: '禁锢地点',
    institution_noted_as_begun: '记为始设',
    maternal_uncle_of_empress: '后弟',
    received_deathbed_charge: '召受顾命',
  };

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
  }
  function primaryPortrait(emperorId) {
    const list = portraitsByEmperor.get(emperorId) || [];
    return list.find((row) => row['展示角色'] === '默认朝服像') || list[0] || null;
  }

  const ROLE_GROUPS = [
    { role: '默认朝服像', title: '朝服像', hint: '' },
    { role: '其他真迹', title: '其他真迹', hint: '' },
    { role: '相关史迹', title: '相关史迹', hint: '今貌不能倒推当时战场。' },
    { role: '御笔书法', title: '御笔书法', hint: '碑是刻出来的。纸上才是手写。' },
    { role: '奏折朱批', title: '奏折与朱批', hint: '红笔是皇帝批的。黑字是臣工写的。' },
  ];

  function mediaImg(src, alt) {
    return imgTag(src, alt, {
      width: 600,
      height: 800,
      onerror: true,
      sizes: '(max-width: 600px) 45vw, (max-width: 960px) 30vw, 280px',
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
          ${canEmbed(row) ? mediaImg(row['预览文件'], row['对象标题']) : `<span class="img-fallback">${esc(row['对象标题'])}</span>`}
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
    const emperorViews = new Set(['emperors', 'person', 'people', 'images', 'image', 'kangxi', 'yongzheng', 'chapter', 'succession', 'empresses', 'princes', 'princesses', 'questions', 'question']);
    document.querySelectorAll('.nav a').forEach((link) => {
      const href = (link.getAttribute('href') || '#/').replace(/^#/, '') || '/';
      const key = href.split('/').filter(Boolean)[0] || '';
      let on = false;
      if (!key) on = !current || emperorViews.has(current);
      else if (key === 'sites') on = current === 'sites' || current === 'site';
      else if (key === 'lanes') on = current === 'lanes' || current === 'lane';
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

  function renderClaimDrawer(claim, trigger) {
    const unit = unitById.get(claim['来源实体 ID']);
    const source = unit ? sourceById.get(unit.source_entity_id) : null;
    openDrawer(`
      <p class="kicker">依据</p>
      <h2>${esc(PREDICATES[claim['谓词/关系']] || claim['谓词/关系'])}</h2>
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
        </p>` : ''}
    `, trigger);
  }

  function claimCard(claim) {
    const pred = PREDICATES[claim['谓词/关系']] || claim['谓词/关系'];
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
          ? `<a href="#/image/${esc(portrait.visual_id)}">${mediaImg(portrait['预览文件'], portrait['对象标题'])}</a>`
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
    return homeHtml(DATA.emperors, DATA.sites, { onerror: true });
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

  function chapterReadBlock(personId) {
    const chapters = chaptersForPerson(personId);
    const extras = {
      'QH-P-000001': [['#/lanes', '野史怎么说，官书怎么写'], ['#/princes', '儿子怎么排'], ['#/princesses', '女儿怎么排']],
      'QH-P-000002': [['#/kangxi', '康熙朝的储位与对照'], ['#/lanes', '改诏、丹药等传闻']],
      'QH-P-000053': [['#/lane/QH-L-0010', '出家说']],
    };
    const extra = extras[personId] || [];
    if (!chapters.length && !extra.length) return '';
    return `
          <h2>从这几条读</h2>
          ${chapters.map((row) => `<p class="rel"><a href="#/chapter/${esc(row.slug)}">${esc(row.title)}</a></p>`).join('')}
          ${extra.map(([href, label]) => `<p class="rel"><a href="${esc(href)}">${esc(label)}</a></p>`).join('')}
    `;
  }

  function kangxiPage() {
    const chapters = eraChapters('康熙');
    return `
      <div class="reading">
        <p class="kicker">康熙</p>
        <h1>康熙朝</h1>
        <p class="lede">在位六十一年。即位、废太子、畅春园崩逝，都能对到官书里的日子。</p>
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
          <a class="thread" href="#/succession">
            <span class="thread-year">分日</span>
            <h2>储位事件链</h2>
            <p>立、废、复立、再废的数据表。可读章见「两废太子」。</p>
          </a>
        </li>
        <li>
          <a class="thread" href="#/lanes">
            <span class="thread-year">对照</span>
            <h2>野史怎么说，官书怎么写</h2>
            <p>改诏、畅春园、宫斗，都可以对照。对面是已经打开的原文，不互相覆盖。</p>
          </a>
        </li>
      </ol>
      <p class="actions"><a class="link" href="#/yongzheng">雍正朝</a> · <a class="link" href="#/questions">黄金问题</a></p>
    `;
  }

  function yongzhengPage() {
    const chapters = eraChapters('雍正');
    return `
      <div class="reading">
        <p class="kicker">雍正</p>
        <h1>雍正朝</h1>
        <p class="lede">遗诏在崩日，即位礼在七日后。生母、年羹尧、隆科多、军机处，先落到已经打开的《清史稿》。</p>
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
            <p>传闻可以登记。不能覆盖本纪和实录已经写出的句子。</p>
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
      <p class="lede">照片是今天的层。故事在当时。</p>
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

  const EMPEROR_READS = {
    'QH-P-000051': {
      body: '1616 年称汗，国号后金，不是后来的「皇帝」。统一女真诸部，创制满文，整编八旗，迁辽阳、沈阳。萨尔浒一仗挡住明军，晚年在宁远受挫。',
      bound: '当时身份应记汗，不宜直接套后世皇帝称号。宁远炮伤与死因、乌拉那拉氏殉死、前三朝实录后来改写，都还没回原文。',
    },
    'QH-P-000052': {
      body: '1626 年接汗位，年号天聪。1636 年称帝，改国号大清，年号崇德。汗位和帝位是两件事，不能写成一次即位。设六部、内三院，分出蒙古八旗、汉军八旗，两征朝鲜，松锦之战后再入关的局面才打开。',
      bound: '继位是推举还是预定、猝死原因、实录删改，仍是索引。孝庄是后世追尊，当时不是皇后。',
    },
    'QH-P-000053': {
      body: '六岁即位。1644 年入北京，年号才用顺治。幼年由多尔衮摄政，亲政后追罪多尔衮。入关后的剃发、圈地、逃人法，和追击农民军、南明，是同一段。',
      bound: '出家说不能当事实。董鄂妃身份、遗诏怎样形成，都未回原文。孝献、孝康是追尊，当时不是皇后。',
    },
    'QH-P-000001': {
      body: '顺治十八年正月即位，次年改元康熙。在位六十一年。最后死在畅春园。即位礼、崩逝和同一天的遗诏，已经能对到《圣祖实录》。太子立、废、复立、再废是分日记录，不是一条叫「九子夺嫡」的事件。',
      bound: '下面几条线已能核对。遗诏怎样形成、怎样宣读，和雍正朝的改诏传闻，分开看，不合成一句。',
    },
    'QH-P-000002': {
      body: '康熙第四子。表序里的「第四子」和世表里的缺号，不是同一个数字。1722 年即位，次年改元雍正。生母是乌雅氏；佟佳氏是重要抚养者，不能写成生母。',
      bound: '即位要分开看：十三日的口谕和遗诏，辛丑的即位礼，后世改诏说，不是同一条材料。本纪已落到年羹尧、隆科多、军机处和崩日；丹药仍未写入官书。孝恭在康熙朝不是皇后。',
    },
    'QH-P-000019': {
      body: '1735 年即位，次年改元乾隆。1796 年禅位给嘉庆，自己做太上皇，实际管事到 1799 年。在位年数和实际掌权年数，要分开写。平准噶尔、开新疆、修《四库全书》、南巡、英国使团，都还是索引。',
      bound: '出生地、十全武功怎样估价、禅位后谁拍板，都未回原文。继皇后那拉氏无谥、丧仪降格，不能按后来的皇后规格回写。',
    },
    'QH-P-000054': {
      body: '1796 年内禅即位，前三年太上皇还在。嘉庆四年乾隆死后，才真正管事，同年处置和珅。白莲教、天理教攻宫、阿美士德使团，是这段常见的条目，目前只是索引。1796 到 1799 年，名义在位和实际权力不是一回事。',
      bound: '原名永琰，即位后避讳改颙琰。猝死病因未核。反腐叙事需拆制度和个案，不能收成一句「嘉庆反腐」。',
    },
    'QH-P-000055': {
      body: '1820 年即位，次年改元道光。原名绵宁，即位后避讳改旻宁。禁烟、第一次鸦片战争、《南京条约》，是这段最常被提起的事，目前都未逐条回原文。',
      bound: '节俭故事、立储过程里的竞争传说，多是后来说法。孝静成皇后是后来追尊。',
    },
    'QH-P-000056': {
      body: '1850 年即位，次年改元咸丰。在位十一年。太平天国、第二次鸦片战争、圆明园被焚掠、避走热河，是这段的骨架。身后留下赞襄政务的安排，两宫和八大臣怎样分权，要按当时文件看，不能后来倒推成慈禧已经掌权。',
      bound: '「北狩」和「逃离北京」是两种说法。不能把后来的慈禧权势，写成咸丰朝已经如此。祺祥只拟用过，后来改成同治。',
    },
    'QH-P-000057': {
      body: '六岁即位。年号同治从 1862 年到 1874 年；公历卒年是 1875 年，和年号的最后一年不是同一回事。两宫垂帘，1873 年亲政。无子女。',
      bound: '官方记天花。梅毒说多是晚出，不能并写成已核死因。所谓「同治中兴」是后来的评价。阿鲁特氏怎样死，未回原文。',
    },
    'QH-P-000058': {
      body: '生父是醇亲王奕譞。礼法上过继给咸丰，所以能接同治的帝位。1875 年到 1908 年在位。两宫仍垂帘，中间有亲政、甲午、戊戌、庚子、新政。无子女。',
      bound: '生辰异文须以玉牒核对。现代检测支持急性砷中毒，下毒者未知。帝党、后党是后来的叫法，不宜当成当时的机构。',
    },
    'QH-P-000059': {
      body: '1908 年即位，1909 年才是宣统元年，1912 年 2 月 12 日退位。四条日期不是一件事。载沣摄政。无清朝正式庙号、谥号。退位后的小朝廷、1917 年复辟、伪满，都不算清朝连续在位。',
      bound: '幼帝的行为不能算在他本人头上。婉容成婚在 1922 年，已是退位之后。',
    },
  };

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
        <p class="vita">${esc(emperor['生年'])}年–${esc(emperor['卒年'])}年${Number(emperor['卒年']) && Number(emperor['生年']) ? `，享年${Number(emperor['卒年']) - Number(emperor['生年']) + 1}岁` : ''}。在位 ${esc(emperor['在位起'])}年–${esc(emperor['在位止'])}年。${father ? `父 ${esc(father)}。` : ''}${mother ? `母 ${esc(mother)}。` : ''}${emperor['陵寝'] ? `葬 ${esc(emperor['陵寝'])}。` : ''}${emperor['谥号'] ? `谥号 ${esc(emperor['谥号'])}。` : ''}</p>
        ${read.body ? `<p class="lede">${esc(read.body)}</p>` : ''}
        ${read.bound ? `<p class="bound">${esc(read.bound)}</p>` : ''}
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
    if (!person) return `<h1>未找到 ${esc(id)}</h1><p>该 ID 尚未建立人物档。</p>`;
    const claims = DATA.claims.filter((row) => row['主体 ID'] === id || row['客体 ID 或值'] === id);
    return `
      <p class="kicker">${esc(person['人物类型'] || '人物')}</p>
      <h1>${esc(person['规范名'].replace(/^爱新觉罗·/, ''))}</h1>
      <p class="lede">${esc(person['常用名或异名'] || '')}</p>
      <div class="reading">
        ${person['选择理由'] ? `<p class="lede">${esc(person['选择理由'])}</p>` : ''}
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
        ${claims.length ? `<h2>依据</h2>${claims.map(claimCard).join('')}` : ''}
        ${lanesForPerson(id).length ? `<h2>传闻对照</h2>${lanesForPerson(id).map(laneCard).join('')}` : ''}
      </div>
    `;
  }

  const EMPRESS_IDS = ['QH-P-000023', 'QH-P-000060', 'QH-P-000024', 'QH-P-000025'];

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
              <p class="event-line">${personLink(row.person_id)} ${esc(row['当时称号'])} · ${esc(row['事件类型'])} ${evidenceMark(row['证据等级'])}${row['冲突组 ID'] ? ' <span class="mark two">两说并存</span>' : ''}</p>
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
      <p class="lede">皇后身份不能只用最终谥号。生前是妃、贵妃、皇后还是太后，死后才是孝×仁皇后。孝恭在康熙朝不是皇后。</p>
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
      <p class="lede">表序、长子、皇四子不是同一个数字。第四子胤禛不在这一卷，因为他后来是世宗。</p>
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
      <p class="lede">第一女到第二十女。未封十二人，受封八人。常宁之女是抚育，不要算进这二十。</p>
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
              <p class="event-line">${eventSentence(row)} ${evidenceMark(row['证据等级'])}${row['冲突组 ID'] ? ' <span class="mark two">两说并存</span>' : ''}</p>
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

  const HEIR_THREADS = [
    { key: '立储', title: '立太子', stages: ['立储'], lead: '康熙十四年冬，胤礽被立为皇太子。本纪记十二月丙寅，列传记乙丑，差一天。六月择吉下谕的实录条次还没打开。' },
    { key: '初废', title: '初废', stages: ['初废驻跸', '初废拘执', '同日附属', '初废颁示', '初废连带处分', '议储不许', '释放'], lead: '四十七年九月，从驻跸布尔哈苏台，到拘执，再到颁诏，隔了二十天。十八阿哥同日薨，另条而记。释放不是复立。世表作四十六年废，本纪和实录作四十七年。' },
    { key: '复立', title: '复立', stages: ['复立'], lead: '四十八年三月辛巳，授册宝，复立为皇太子。本纪与实录同日。' },
    { key: '再废', title: '再废', stages: ['再废锢禁', '再废告庙'], lead: '五十一年再废。本纪记九月庚戌锢咸安宫，列传记十月。告庙在十一月，不是再废当天。实录条次还没钉。' },
    { key: '请复立被拒', title: '请复立', stages: ['请复立被拒'], lead: '劳之辨奏保被杖，朱天保上书被诛。都不是第四次废立。' },
  ];

  function successionPage(query) {
    const group = query.stage || '全部';
    const threads = group === '全部' ? HEIR_THREADS : HEIR_THREADS.filter((item) => item.key === group);
    return `
      <div class="reading">
        <p class="kicker">储位</p>
        <h1>太子怎样立，怎样废</h1>
        <p class="lede">官书按日记录，不是「九子夺嫡」一条。拘执、诏书里的告祭、颁废，是三天。释放也不是复立。</p>
        <p class="crumb"><a class="link" href="#/kangxi">康熙朝</a></p>
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
      <p class="lede">每条都落到一句原文。</p>
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
    return `
      <p class="kicker">依据</p>
      <h1>${esc(PREDICATES[claim['谓词/关系']] || claim['谓词/关系'])}</h1>
      ${claimCard(claim)}
    `;
  }

  function chapterPage(slug) {
    const list = DATA.chapters || [];
    const chapter = list.find((row) => row.slug === slug) || (slug ? null : list[0]);
    if (!chapter) return `<h1>未找到章节 ${esc(slug || '')}</h1><p><a href="#/">回十二帝</a></p>`;
    const unitIds = String(chapter.unit_ids || '').split(/[；;]/).map((item) => item.trim()).filter(Boolean);
    const grouped = unitIds
      .map((id) => DATA.units.find((unit) => unit.source_unit_id === id))
      .filter(Boolean)
      .map((unit) => ({
        unit,
        claims: DATA.claims.filter((row) => row['来源实体 ID'] === unit.source_unit_id),
      }));
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
    return `
      <div class="reading">
        <p class="kicker">${esc(chapter.era)}</p>
        <h1>${esc(chapter.title)}</h1>
        <p class="lede">${esc(chapter.lede)}</p>
        <p class="actions">${relatedLinks(chapter.related)}</p>
        <p class="crumb"><a class="link" href="${esc(home)}">${esc(homeLabel)}</a></p>
      </div>
      <div class="md">${chapter.bodyHtml || ''}</div>
      ${grouped.map(({ unit, claims }) => `
        <section class="thread-block">
          <h2>${esc(unit['卷次'])} · ${esc(unit['原纪年'])}</h2>
          <p class="thread-lead">${esc(unit['说明'])}</p>
          <p class="actions"><a class="link" href="${esc(safeUrl(unit['直接记录网址']))}" target="_blank" rel="noopener">打开原文</a></p>
          ${claims.map(claimCard).join('')}
        </section>
      `).join('')}
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

  function questionCard(row) {
    const binds = String(row['绑定ID'] || '').split(/[；;]/).map((item) => item.trim()).filter(Boolean);
    const refuse = row['期望行为'] === '拒绝作答';
    return `
      <article class="claim" id="${esc(row.question_id)}">
        <p class="sub">${esc(row['类别'])} · ${esc(row['期望行为'])}</p>
        <p class="sentence"><a href="#/question/${esc(row.question_id)}">${esc(row['问题'])}</a></p>
        ${refuse
          ? `<p class="bound">${esc(row['拒答说明'])}</p>`
          : `<p class="lede">${esc(row['可公开答案'])}</p>`}
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
        <p class="lede">从已经录入的主张里出题。能回答的回到原文；没有证据的必须拒答，不能编。</p>
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
    return `
      <p class="kicker">黄金问题</p>
      <h1>${esc(row['问题'])}</h1>
      ${questionCard(row)}
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
    return `
      <p class="kicker">${esc(era)} · ${esc(portrait['展示角色'])}</p>
      <h1>${esc(portrait['对象标题'])}</h1>
      ${hook ? `<p class="lede">${esc(hook)}</p>` : ''}
      <div class="dossier image-dossier">
        ${canEmbed(portrait) ? `
        <figure class="portrait large${scriptish ? ' script' : ''}">
          ${mediaImg(portrait['预览文件'], portrait['对象标题'])}
        </figure>` : ''}
        <div>
          ${analysis ? `<p>${esc(analysis)}</p>` : ''}
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

  const SOURCE_GROUPS = [
    {
      title: '官书',
      hint: '《清实录》《清史稿》《清会典》这类。我们引文主要从这里来，可按卷页回原文。',
      match: (row) => /实录|清史稿|会典|纪传体|编年史|古籍|汉籍|方志/.test(row['机构或资源'] + row['资源类型']),
    },
    {
      title: '档案',
      hint: '第一历史档案馆、台北故宫等馆藏与目录。原始性强，多数要进馆或遵守阅览规则。',
      match: (row) => /档案|玉牒|谱牒/.test(row['机构或资源'] + row['资源类型']),
    },
    {
      title: '图像',
      hint: '朝服像与相关图像的来源。绿色才嵌入本站，其余只给说明和外链。',
      match: (row) => /图像|博物馆|馆藏|故宫|Wikimedia|照片|Open Access|Open Data/.test(row['机构或资源'] + row['资源类型']),
    },
    {
      title: '工具与数据库',
      hint: '查人名、职官、地名的工具。用来定位，不作引文。',
      match: (row) => /职官|人名|传记资料|地理信息|CBDB|CHGIS|人物结构/.test(row['机构或资源'] + row['资源类型']),
    },
  ];

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
      <p class="lede">能在网上打开，不等于可以整库复制。</p>
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
        <dt>下一动作</dt><dd>${esc(row['下一动作'])}</dd>
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
    return `
      <p class="kicker">检索</p>
      <h1>「${esc(q)}」</h1>
      <h2>人物 ${peopleHits.length}</h2>
      ${peopleHits.length ? `<ul>${peopleHits.map((hit) => `<li><a href="#/person/${esc(hit.id)}">${esc(hit.label)}</a> <span class="muted">${esc(hit.extra || '')}</span></li>`).join('')}</ul>` : '<p class="empty">没有人物命中。</p>'}
      <h2>依据 ${claimHits.length}</h2>
      ${claimHits.length ? claimHits.map(claimCard).join('') : '<p class="empty">没有依据命中。</p>'}
      <h2>后妃 ${empressHits.length}</h2>
      ${empressHits.length ? timelineList(empressHits) : '<p class="empty">没有命中。</p>'}
      <h2>皇子 ${princeHits.length}</h2>
      ${princeHits.length ? `<ul>${princeHits.map((row) => `<li><a href="#/person/${esc(row.person_id)}">${esc(row['规范名'].replace(/^爱新觉罗·/, ''))}</a> <span class="muted">${esc(row['表序标签'])}</span></li>`).join('')}</ul>` : '<p class="empty">没有命中。</p>'}
      <h2>皇女 ${princessHits.length}</h2>
      ${princessHits.length ? `<ul>${princessHits.map((row) => `<li><a href="#/person/${esc(row.person_id)}">${esc(row['规范名'].replace(/^爱新觉罗氏/, ''))}</a> <span class="muted">${esc(row['表序标签'])}</span></li>`).join('')}</ul>` : '<p class="empty">没有命中。</p>'}
      <h2>储位 ${heirHits.length}</h2>
      ${heirHits.length ? heirList(heirHits) : '<p class="empty">没有命中。</p>'}
      <h2>今地 ${siteHits.length}</h2>
      ${siteHits.length ? `<div class="grid cards site-cards">${siteHits.map(siteCard).join('')}</div>` : '<p class="empty">没有今地命中。</p>'}
      <h2>章节 ${chapterHits.length}</h2>
      ${chapterHits.length ? `<ul>${chapterHits.map((hit) => `<li><a href="#/chapter/${esc(hit.id)}">${esc(hit.label)}</a> <span class="muted">${esc(hit.extra || '')}</span></li>`).join('')}</ul>` : '<p class="empty">没有章节命中。</p>'}
      <h2>黄金问题 ${questionHits.length}</h2>
      ${questionHits.length ? `<ul>${questionHits.map((hit) => `<li><a href="#/question/${esc(hit.id)}">${esc(hit.label)}</a> <span class="muted">${esc(hit.extra || '')}</span></li>`).join('')}</ul>` : '<p class="empty">没有问题命中。</p>'}
      <h2>传闻对照 ${laneHits.length}</h2>
      ${laneHits.length ? laneHits.map(laneCard).join('') : '<p class="empty">没有侧栏命中。</p>'}
      <h2>来源 ${sourceHits.length}</h2>
      ${sourceHits.length ? `<ul>${sourceHits.map((row) => `<li><a href="#/source/${esc(row.source_id)}">${esc(row.source_id)} ${esc(row['机构或资源'])}</a></li>`).join('')}</ul>` : '<p class="empty">没有来源命中。</p>'}
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
      main.innerHTML = `<p class="warn">${esc(err.message || '数据未能载入')}。请先运行 <code>node scripts/build-site.mjs</code>。</p>`;
      return;
    }
    if (gen !== renderGen) return;
    let html = '';
    if (isHome) html = home();
    else if (view === 'kangxi') html = kangxiPage();
    else if (view === 'yongzheng') html = yongzhengPage();
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
    else if (view === 'source') html = sourcePage(parts[1]);
    else if (view === 'tasks') html = tasksPage();
    else if (view === 'search') html = searchPage(query.q || '');
    else html = `<h1>没有这个页面</h1><p><a href="#/">回首页</a></p>`;
    main.innerHTML = html;
    const live = document.getElementById('search-status');
    if (live) live.textContent = view === 'search' ? `检索「${query.q || ''}」已更新` : '';
    main.classList.remove('enter');
    void main.offsetWidth;
    main.classList.add('enter');
    window.scrollTo(0, 0);
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
      suggest.innerHTML = '<p class="suggest-empty">没有人物命中。回车看全部检索。</p>';
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

  window.addEventListener('hashchange', () => { render(); });
  render();
