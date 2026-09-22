const moduleVersion = new URL(import.meta.url).search;
const [{ esc }, { LIVE_TOPICS }, { JIEDU_FEATURED }] = await Promise.all([
  import('./templates.js' + moduleVersion),
  import('./live-content.js' + moduleVersion),
  import('./qing-content.js' + moduleVersion),
]);

const findTopic = (slug) => LIVE_TOPICS.find((topic) => topic.slug === slug);
const readSaved = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };

// ── 讲解包：字数与时长只做设计估算（口语速度 250—300 字/分钟），一律不写「实测」。
const SPOKEN_RATE = { fast: 300, slow: 250 };
const countSpoken = (...groups) => groups.flat(Infinity).filter((text) => typeof text === 'string' && text).join('').replace(/\s+/g, '').length;
const minutesOf = (chars) => (chars ? `${(chars / SPOKEN_RATE.fast).toFixed(1)}—${(chars / SPOKEN_RATE.slow).toFixed(1)} 分钟` : '—');
const spokenQuote = (list) => (list || []).flatMap((item) => [item.original, item.plain]);
const segmentSpoken = (segment) => countSpoken(segment.paras, spokenQuote(segment.quotes), (segment.compare?.rows || []).flatMap((row) => [row.original, row.plain, row.role]), segment.turn);
function packLength(topic) {
  const pack = topic.pack;
  if (!pack) return null;
  const opening = countSpoken(pack.opening?.text);
  const bySegment = (pack.segments || []).map(segmentSpoken);
  const body = bySegment.reduce((sum, value) => sum + value, 0);
  const qa = countSpoken((pack.qa || []).flatMap((item) => [item.a]));
  return { opening, body, total: opening + body, bySegment, minutes: minutesOf(opening + body), qaMinutes: minutesOf(qa) };
}
const claimRow = (data, id) => data.claims.find((row) => row['Assertion ID'] === id);

export function liveState(value) {
  const topic = findTopic(value?.topic);
  if (!topic) return null;
  const step = Number.isInteger(Number(value.step)) ? Number(value.step) : 0;
  // 只同步观众需要的字段；个人笔记、主播提示不进入消息。
  return { version: 1, topic: topic.slug, step: Math.max(0, Math.min(topic.steps.length - 1, step)), format: value.format === 'portrait' ? 'portrait' : 'landscape' };
}

function sessionName(value) {
  if (/^[a-zA-Z0-9-]{8,80}$/.test(value || '')) return value;
  try {
    let id = sessionStorage.getItem('qing-studio-session');
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('qing-studio-session', id); }
    return id;
  } catch { return `session-${Date.now().toString(36)}`; }
}

function sourceList(step, data) {
  const claims = step.claims.map((id) => data.claims.find((row) => row['Assertion ID'] === id)).filter(Boolean);
  const groups = new Map();
  for (const id of new Set(claims.map((row) => row['来源实体 ID']))) {
    const unit = data.units.find((row) => row.source_unit_id === id);
    if (!unit) continue;
    const key = [unit['史料名'], unit['卷次'], unit['直接记录网址']].join('|');
    const group = groups.get(key) || { unit, locators: [] };
    const locator = unit['当日条次'] || unit['原纪年'];
    if (locator && !group.locators.includes(locator)) group.locators.push(locator);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ unit, locators }) => {
    const label = [unit['史料名'], unit['卷次'], locators.join('、')].filter(Boolean).join(' · ');
    const url = unit?.['直接记录网址'];
    return url && /^https?:\/\//.test(url)
      ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`
      : `<span>${esc(label)}</span>`;
  }).join('；');
}

export function researchBrief(topic, data) {
  const ids = topicClaimIds(topic);
  const evidence = ids.map((id) => {
    const row = claimRow(data, id);
    const unit = data.units.find((item) => item.source_unit_id === row?.['来源实体 ID']);
    return `${row?.['卷页/档号/图像定位'] || id}\n原文摘引：${row?.['支持引文'] || '缺失'}\n回查入口：${unit?.['直接记录网址'] || '缺失'}`;
  }).join('\n\n');
  const gaps = topic.pack?.gaps?.length ? `\n讲稿里已经写明但仍未落实的环节（请优先补齐这些，不要另起话题）：\n${topic.pack.gaps.map((line, i) => `${i + 1}. ${line}`).join('\n')}\n` : '';
  return `请围绕「${topic.title}」继续做史料研究，为一场历史直播提供新的可核查内容。\n\n要回答的问题：${topic.pack?.question || topic.title}\n已有观察：${topic.angle}\n当前核查范围：${topic.limit}\n\n已定位材料（公开录文，不等于已经校勘的原件）：\n${evidence}\n\n优先追查：\n${topic.leads.map((line, i) => `${i + 1}. ${line}`).join('\n')}\n${gaps}\n请实际检索和打开原典，追踪引用来源。对每个新发现提供书名、作者、版本、卷页或档号、原文短引、上下文、可访问链接、核查日期和材料性质。找不到影印或档案时明确写未取得，不以目录或搜索摘要冒充读过正文。区分同源转载与独立旁证，保留相反材料；不得补造原话、人物心理、精确日期或数字。\n\n交付：最有价值的三个新发现、各自的证据与解释、一个可口述的开场、逐段的完整讲稿（含转场句与材料对读），以及仍未解决的问题。新鲜度来自具体材料与对读发现，不宣称独家秘史。`;
}

// 讲解包引用的主张并入备课材料，避免讲稿里出现的依据在下方面板缺席。
function topicClaimIds(topic) {
  const pack = topic.pack;
  const fromPack = pack ? [
    ...(pack.sources || []).flatMap((row) => row.claims || []),
    ...(pack.qa || []).flatMap((row) => row.claims || []),
    ...(pack.segments || []).flatMap((segment) => [...(segment.quotes || []).map((item) => item.claim), ...((segment.compare?.rows || []).map((row) => row.claim))]),
  ] : [];
  return [...new Set([...topic.steps.flatMap((step) => step.claims), ...fromPack].filter(Boolean))];
}

function researchDesk(topic, data) {
  const ids = topicClaimIds(topic);
  return `<section class="studio-research"><div class="studio-research-head"><div><p class="kicker">备课材料</p><h2>原句所在与追查方向</h2></div><button type="button" class="reader-tool-btn" data-research-copy>复制继续查证任务</button></div>
    <p>${esc(topic.angle)}</p><p class="studio-provenance">${esc(topic.provenance)} · 录文回查于 ${esc(topic.checkedAt || '2026-09-08')}</p><p class="sub">${esc(topic.limit)}</p>
    <details class="studio-passages"><summary>展开 ${ids.length} 条原文与定位</summary>${ids.map((id) => {
      const row = data.claims.find((claim) => claim['Assertion ID'] === id);
      if (!row) return '';
      return `<article><h3>${esc(row['卷页/档号/图像定位'])}</h3><blockquote>${esc(row['支持引文'])}</blockquote><p>${sourceList({ claims: [id] }, data)} · <button class="link" type="button" data-claim="${esc(id)}">依据记录</button></p></article>`;
    }).join('')}</details>
    <h3>三个继续查证的方向</h3><ol>${topic.leads.map((line) => `<li>${esc(line)}</li>`).join('')}</ol><p class="sub" data-research-status role="status">复制后可交给你使用的 AI 继续检索；此页面不会自动联网研究。</p><textarea class="research-copy-fallback" aria-label="继续查证任务" rows="10" readonly hidden></textarea></section>`;
}

export function liveCard(state, data) {
  const topic = findTopic(state.topic);
  const step = topic.steps[state.step];
  const claim = (id) => data.claims.find((row) => row['Assertion ID'] === id);
  const quote = step.quote ? claim(step.quote) : null;
  return `<article class="live-card" data-format="${state.format}" aria-label="观众画面">
    <div class="live-card-inner">
      <header class="live-card-meta"><span>清史读本 · ${esc(topic.era)}</span><span>${esc(step.kind)} · ${state.step + 1}/${topic.steps.length}</span></header>
      <div class="live-card-content">
        <h2>${esc(step.title)}</h2>
        ${step.timeline ? `<ol class="live-timeline">${step.timeline.map((item) => `<li><span>${esc(claim(item.claim)?.['原始时间表达'] || '材料待载入')}</span><strong>${esc(item.label)}</strong></li>`).join('')}</ol>` : ''}
        ${quote ? `<blockquote lang="zh-Hant">${esc(quote['支持引文'])}</blockquote>${step.plain ? `<p class="live-plain">${esc(step.plain)}</p>` : ''}<p class="live-quote-note">原文摘引 · ${esc(quote['原始时间表达'])}</p>` : ''}
        ${step.points ? `<ul class="live-points">${step.points.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}
      </div>
      <footer class="live-card-source"><span class="live-source-kind">${esc(topic.provenance.split(' · ')[0])}</span><span>${sourceList(step, data) || '暂无可回查材料'}</span></footer>
    </div>
  </article>`;
}

const claimButton = (id) => `<button class="link" type="button" data-claim="${esc(id)}">${esc(id)}</button>`;

function quoteBlock(item, data) {
  const row = claimRow(data, item.claim);
  const source = item.source || row?.['卷页/档号/图像定位'] || '';
  return `<figure class="pack-quote"><blockquote lang="zh-Hant">${esc(item.original)}</blockquote><figcaption>${esc(source)}${item.claim ? ` · ${claimButton(item.claim)}` : ''}</figcaption><p class="pack-plain"><span>白话</span>${esc(item.plain)}</p></figure>`;
}

function compareBlock(compare, data) {
  return `<section class="pack-compare"><h4>材料对读 · ${esc(compare.title)}</h4><ol class="pack-compare-rows">${compare.rows.map((row) => `<li><span class="pack-compare-tag">${esc(row.tag)}</span><blockquote lang="zh-Hant">${esc(row.original)}</blockquote><p class="pack-plain"><span>白话</span>${esc(row.plain)}</p>${row.role ? `<p class="pack-compare-role">${esc(row.role)}</p>` : ''}<p class="pack-compare-src">${esc(row.source || '')}${row.claim ? ` · ${claimButton(row.claim)}` : ''}</p></li>`).join('')}</ol></section>`;
}

function openingBlock(pack) {
  const chars = countSpoken(pack.opening.text);
  return `<article class="pack-opening"><h3><span>30—60 秒开场</span>逐字，可直接照读</h3><p class="pack-len">${chars} 字 · ${esc(pack.opening.seconds || minutesOf(chars))}</p><p class="pack-spoken">${esc(pack.opening.text)}</p></article>`;
}

function segmentBlock(segment, index, data, length) {
  const chars = length.bySegment[index];
  return `<article class="pack-segment" data-pack-card="${segment.card ?? 0}">
    <header><p class="kicker">${esc(segment.label)} · 对应观众卡 ${(segment.card ?? 0) + 1}</p><h3>${esc(segment.heading)}</h3><p class="pack-len">${chars} 字 · ${minutesOf(chars)}（设计估算）</p></header>
    ${(segment.paras || []).map((text) => `<p class="pack-spoken">${esc(text)}</p>`).join('')}
    ${(segment.quotes || []).map((item) => quoteBlock(item, data)).join('')}
    ${segment.compare ? compareBlock(segment.compare, data) : ''}
    ${segment.turn ? `<p class="pack-turn"><span>转场</span>${esc(segment.turn)}</p>` : ''}
    ${segment.watch ? `<p class="pack-watch"><span>口径提醒</span>${esc(segment.watch)}</p>` : ''}
  </article>`;
}

// 讲解台正文：整份讲稿以正常字号完整可读，不只是提示词。
export function packSection(topic, data) {
  const pack = topic.pack;
  if (!pack) return '';
  const length = packLength(topic);
  return `<section class="studio-pack" aria-label="完整讲稿">
    <header class="studio-pack-head"><div><p class="kicker">讲解包 · 可照读</p><h2>${esc(topic.title)}</h2></div>
      <dl class="studio-pack-runtime"><div><dt>设计时长</dt><dd>${esc(length.minutes)}</dd></div><div><dt>讲稿字数</dt><dd>开场 ${length.opening} 字 ＋ 正文 ${length.body} 字</dd></div><div><dt>估算依据</dt><dd>字数 ÷ 口语 250—300 字/分钟；设计估算，未做真人计时</dd></div></dl></header>
    <div class="studio-pack-frame"><h3>这一场要回答的问题</h3><p class="pack-spoken">${esc(pack.question)}</p><h4>核心发现</h4><p class="pack-spoken">${esc(pack.finding)}</p></div>
    ${openingBlock(pack)}
    <div class="studio-pack-body"><h3>讲稿正文（逐段，含转场句与材料对读）</h3>${pack.segments.map((segment, index) => segmentBlock(segment, index, data, length)).join('')}</div>
    <section class="studio-pack-qa"><h3>观众问与答</h3>${pack.qa.map((item) => `<article><h4>问：${esc(item.q)}</h4><p>${esc(item.a)}</p>${item.claims?.length ? `<p class="pack-claims">依据 ${item.claims.map(claimButton).join(' ')}</p>` : ''}</article>`).join('')}</section>
    <section class="studio-pack-sources"><h3>来源与定位：每条史实绑定主张</h3><ol>${pack.sources.map((row) => `<li><span>${esc(row.fact)}</span>${row.claims.map(claimButton).join(' ')}<em>${esc(row.where)}</em></li>`).join('')}</ol>
      <h4>未解决问题 / 材料缺口</h4><ul class="studio-pack-gaps">${pack.gaps.map((line) => `<li>${esc(line)}</li>`).join('')}</ul></section>
  </section>`;
}

// 侧栏：当前这段的完整口述稿，替代原来单薄的提示词。
function inlineScript(topic, step, data) {
  const stepData = topic.steps[step];
  const pack = topic.pack;
  if (!pack) return esc(stepData.notes || '');
  const segments = pack.segments.filter((segment) => (segment.card ?? 0) === step);
  const body = segments.map((segment, index) => {
    const chars = segmentSpoken(segment);
    return `<h3>${esc(segment.heading)}</h3><p class="pack-len">${chars} 字 · ${minutesOf(chars)}</p>${(segment.paras || []).map((text) => `<p class="pack-spoken">${esc(text)}</p>`).join('')}${(segment.quotes || []).map((item) => quoteBlock(item, data)).join('')}${segment.compare ? compareBlock(segment.compare, data) : ''}${segment.turn ? `<p class="pack-turn"><span>转场</span>${esc(segment.turn)}</p>` : ''}`;
  }).join('');
  const watch = [...segments.map((segment) => segment.watch), stepData.notes].filter(Boolean);
  return `${step === 0 ? openingBlock(pack) : ''}<div class="pack-inline">${body}</div>${watch.length ? `<p class="pack-inline-watch"><span>口径提醒</span>${watch.map((line) => `<span class="pack-watch-line">${esc(line)}</span>`).join('')}</p>` : ''}`;
}

// 章节入口：讲稿依赖整页时（该章正在分层重构），不写行内锚点 focus。
const chapterLink = (topic) => (topic.chapterFocus ? `#/chapter/${topic.chapter}?focus=${encodeURIComponent(topic.chapterFocus)}` : `#/chapter/${topic.chapter}`);

export function studioPage(data, slug, query = {}, audience = false) {
  const topic = findTopic(slug);
  if (!topic) {
    if (slug) return '<h1>没有这组讲解</h1><p><a href="#/studio">← 讲解台选题</a></p>';
    const last = liveState(readSaved('qing-studio-last'));
    return `<div class="page-intro reading"><p class="kicker">讲解台 · 史料选题</p><h1>从史料细节中选题</h1><p class="lede">连续读几天日记，把一则笔记读到结尾，再追一句话经过了谁的转述。AI 帮助检索与对读，开讲要有原文可回查。</p>${last ? `<p><a class="reader-tool-btn" href="#/studio/${last.topic}?step=${last.step}&format=${last.format}">继续上次：${esc(findTopic(last.topic).title)}</a></p>` : ''}</div>
      <div class="studio-topic-grid">${LIVE_TOPICS.map((item, index) => `<article class="studio-topic"><p class="kicker">${String(index + 1).padStart(2, '0')} · ${esc(item.era)}</p><h2>${esc(item.title)}</h2><p>${esc(item.description)}</p><div class="studio-topic-angle"><span>这次发现</span><p>${esc(item.angle)}</p></div><p class="studio-provenance">${esc(item.provenance)}</p><p class="sub">${item.steps.length} 张讲解卡 · 原文定位 · 继续查证线索${item.pack ? ` · 完整讲稿约 ${packLength(item).total} 字，设计时长 ${packLength(item).minutes}` : ''}</p><div class="actions"><a class="reader-tool-btn primary" href="#/studio/${item.slug}">准备这场讲解</a><a class="link" href="${chapterLink(item)}">相关章节</a></div></article>`).join('')}</div>
      <section class="studio-intro"><h2>从新材料续写讲稿</h2><ol><li>先看本题原文与上下文，记下值得追问的细节。</li><li>复制查证任务，让 AI 继续找影印、前后条目和独立旁证；把新发现核对后再写进讲稿。</li><li>准备好后打开观众窗口，选择横屏或竖屏，用上一段、下一段控制讲解。</li></ol><p>已准备 ${LIVE_TOPICS.length} 组史料选题，其中 ${LIVE_TOPICS.filter((item) => item.pack).length} 组带可照读的完整讲稿。<a class="link" href="#/jiedu">继续从 ${JIEDU_FEATURED.length} 个原典选读主题找线索</a>。展示窗口与讲解台在同一浏览器中同步，直播推流由你的直播软件完成。</p></section>`;
  }
  const session = sessionName(query.session);
  const saved = liveState(readSaved(`qing-live-${session}`));
  const state = liveState({ topic: slug, step: query.step ?? (saved?.topic === slug ? saved.step : 0), format: query.format || saved?.format });
  if (audience) return `<section class="studio-screen" data-live-root="${topic.slug}" data-session="${session}" data-audience="true"><h1 class="visually-hidden">${esc(topic.title)} · 观众展示</h1><div class="studio-preview">${liveCard(state, data)}</div><div class="screen-controls"><button type="button" class="reader-tool-btn" data-live-fullscreen>全屏展示</button><a data-live-back href="#/studio/${topic.slug}?session=${session}">← 讲解台</a><span data-live-connection>正在连接讲解台…</span></div></section>`;
  return `<section class="studio-host" data-live-root="${topic.slug}" data-session="${session}">
    <header class="studio-heading"><div><p class="kicker"><a href="#/studio">讲解台</a> · ${esc(topic.era)}</p><h1>${esc(topic.title)}</h1>${topic.pack ? `<p class="studio-heading-q">${esc(topic.pack.question)}</p>` : ''}</div><div class="studio-open"><a class="reader-tool-btn primary" data-live-screen href="#/screen/${topic.slug}?session=${session}&step=${state.step}" target="qing-audience-${session}" rel="noopener">观众展示窗口 ↗</a><span data-live-connection>展示窗口尚未连接</span></div></header>
    <div class="studio-workspace">
      <nav class="studio-outline" aria-label="讲解段落"><h2>讲解进度</h2><ol>${topic.steps.map((step, index) => `<li><button type="button" data-live-step="${index}"><span>${index + 1} · ${esc(step.kind)}</span>${esc(step.title)}</button></li>`).join('')}</ol><a class="link" href="${chapterLink(topic)}">${topic.chapterFocus ? '← 相关选段' : '← 相关章节'}</a></nav>
      <div class="studio-stage"><div class="studio-stage-tools"><span>观众画面预览</span><label>画幅 <select data-live-format aria-label="展示画幅"><option value="landscape">横屏 16:9</option><option value="portrait">竖屏 9:16</option></select></label></div><div class="studio-preview">${liveCard(state, data)}</div><div class="studio-controls"><button class="reader-tool-btn" type="button" data-live-prev>上一段</button><span data-live-progress role="status"></span><button class="reader-tool-btn primary" type="button" data-live-next>下一段</button></div><p class="sub">也可用 ← → 翻段；在笔记中输入时不会触发翻页。</p></div>
      <aside class="studio-notes"><h2>${topic.pack ? '这一段讲稿' : '主播提示'} <span>仅自己可见</span></h2><div data-live-script class="studio-script-inline"></div><div class="studio-question" data-live-question></div><label for="live-note">我的补充</label><textarea id="live-note" rows="4" placeholder="记下自己的例子、过渡句或观众提问…"></textarea><small data-note-status>笔记保存在当前浏览器</small><div class="studio-evidence" data-live-evidence></div><div class="studio-timer"><span>本场计时</span><output data-live-clock>00:00</output><button type="button" class="reader-tool-btn" data-live-timer>开始</button><button type="button" class="reader-tool-btn" data-live-reset>归零</button></div></aside>
    </div>${packSection(topic, data)}${researchDesk(topic, data)}</section>`;
}

export function mountStudio(main, data, slug, query, audience = false) {
  const root = main.querySelector('[data-live-root]');
  if (!root || !findTopic(root.getAttribute('data-live-root'))) return () => {};
  const session = root.dataset.session;
  const stateKey = `qing-live-${session}`;
  const saved = liveState(readSaved(stateKey));
  // 题目只由地址里的 slug 决定：换选题、或直接打开观众地址时，旧会话存档不得把画面带回上一题。
  const sameTopic = Boolean(saved && saved.topic === slug);
  // 手机竖屏打开观众窗口时按竖屏排版，不沿用别处选定的横屏幻灯；观众端的画幅不回写讲解台。
  const phoneScreen = audience && typeof window !== 'undefined' && window.matchMedia?.('(orientation: portrait) and (max-width: 860px)').matches;
  let state = liveState({ topic: slug, step: query.step ?? (sameTopic ? saved.step : 0), format: (phoneScreen ? 'portrait' : '') || query.format || (sameTopic ? saved.format : '') });
  if (sameTopic && query.step === undefined) state = liveState({ ...saved, topic: slug, format: state.format });
  let channel = null;
  try { if (typeof BroadcastChannel === 'function') channel = new BroadcastChannel(stateKey); } catch {}
  const select = (selector) => root.querySelector(selector);
  const connection = select('[data-live-connection]');
  let controlsTimeout;
  const showControls = () => {
    root.dataset.controls = 'show';
    clearTimeout(controlsTimeout);
    controlsTimeout = setTimeout(() => { delete root.dataset.controls; }, 2200);
  };
  if (audience) { root.addEventListener('pointermove', showControls); showControls(); }
  const storageOK = save(`qing-studio-storage-check`, true);
  let lastAck = 0;
  let lastStateAt = Date.now();
  const post = (message) => channel?.postMessage(message);
  const noteKey = () => `qing-studio-note-${state.topic}-${state.step}`;
  // 观众窗口的地址必须留在 #/screen/…，否则刷新后会把观众端读成讲解台。
  const stateUrl = (view) => `#/${view}/${state.topic}?session=${session}&step=${state.step}&format=${state.format}`;
  const url = () => stateUrl(audience ? 'screen' : 'studio');

  function paint() {
    const topic = findTopic(state.topic);
    const step = topic.steps[state.step];
    select('.studio-preview').innerHTML = liveCard(state, data);
    select('.studio-preview').dataset.format = state.format;
    if (audience) {
      select('[data-live-back]').href = stateUrl('studio');
      document.title = `${topic.title} · 观众画面`;
      return;
    }
    root.querySelectorAll('[data-live-step]').forEach((button) => {
      const active = Number(button.dataset.liveStep) === state.step;
      button.classList.toggle('on', active);
      if (active) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    });
    select('[data-live-prev]').disabled = state.step === 0;
    select('[data-live-next]').disabled = state.step === topic.steps.length - 1;
    select('[data-live-progress]').textContent = `${state.step + 1} / ${topic.steps.length}`;
    select('[data-live-script]').innerHTML = inlineScript(topic, state.step, data);
    root.querySelectorAll('.pack-segment').forEach((element) => element.classList.toggle('on', Number(element.dataset.packCard) === state.step));
    select('[data-live-question]').textContent = step.question ? `问观众：${step.question}` : '';
    select('[data-live-question]').hidden = !step.question;
    select('#live-note').value = readSaved(noteKey()) || '';
    select('[data-note-status]').textContent = storageOK ? '笔记保存在当前浏览器' : '浏览器无法保存笔记，请另行记录';
    select('[data-live-format]').value = state.format;
    select('[data-live-screen]').href = `#/screen/${state.topic}?session=${session}&step=${state.step}&format=${state.format}`;
    select('[data-live-evidence]').innerHTML = `<h3>本段依据</h3>${step.claims.map((id, index) => `<button type="button" class="link" data-claim="${esc(id)}">依据 ${index + 1}</button>`).join(' · ')}`;
    history.replaceState(null, '', url());
  }
  function publish() {
    save(stateKey, state);
    save('qing-studio-last', state);
    post({ type: 'state', state });
  }
  function receive(value) {
    const next = liveState(value);
    if (!next) return;
    lastStateAt = Date.now();
    if (JSON.stringify(state) !== JSON.stringify(next)) { state = next; paint(); }
    connection.textContent = channel ? '跟随讲解台' : '跟随讲解台 · 浏览器同步';
    post({ type: 'ack' });
  }
  const onStorage = (event) => { if (audience && event.key === stateKey) { try { receive(JSON.parse(event.newValue)); } catch {} } };
  window.addEventListener('storage', onStorage);
  if (channel) channel.onmessage = ({ data: message }) => {
    if (audience && message?.type === 'state') receive(message.state);
    if (!audience && message?.type === 'ready') publish();
    if (!audience && message?.type === 'ack') { lastAck = Date.now(); connection.textContent = '观众窗口已连接'; }
  };
  function navigate(index) { state = liveState({ ...state, step: index }); paint(); publish(); }
  const onKey = (event) => {
    if (audience) { showControls(); return; }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('input, textarea, select, [contenteditable], dialog')) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); navigate(state.step + (event.key === 'ArrowRight' ? 1 : -1)); }
  };
  window.addEventListener('keydown', onKey);
  const onClick = async (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-live-fullscreen')) {
      try { await document.documentElement.requestFullscreen(); } catch { connection.textContent = '可使用浏览器菜单进入全屏'; }
      button.blur();
    }
    if (audience) return;
    if (button.hasAttribute('data-research-copy')) {
      const brief = researchBrief(findTopic(state.topic), data);
      try {
        await navigator.clipboard.writeText(brief);
        select('[data-research-status]').textContent = '已复制：包含现有原文、定位与待查问题，可粘贴给 AI 继续研究。';
      } catch {
        const fallback = select('.research-copy-fallback');
        fallback.hidden = false; fallback.value = brief; fallback.focus(); fallback.select();
        select('[data-research-status]').textContent = '请复制下方已选中的查证任务。';
      }
    }
    if (button.hasAttribute('data-live-step')) navigate(Number(button.dataset.liveStep));
    if (button.hasAttribute('data-live-prev')) navigate(state.step - 1);
    if (button.hasAttribute('data-live-next')) navigate(state.step + 1);
  };
  root.addEventListener('click', onClick);
  if (!audience) {
    select('[data-live-format]').addEventListener('change', (event) => { state = liveState({ ...state, format: event.target.value }); paint(); publish(); });
    select('#live-note').addEventListener('input', (event) => { select('[data-note-status]').textContent = save(noteKey(), event.target.value) ? '已保存到当前浏览器' : '保存失败，请另行记录'; });
  }
  const timerKey = `qing-studio-timer-${session}`;
  let timer = readSaved(timerKey) || { elapsed: 0, started: 0 };
  if (!Number.isFinite(timer.elapsed) || !Number.isFinite(timer.started)) timer = { elapsed: 0, started: 0 };
  function tick() {
    if (audience) {
      post({ type: 'ready' });
      if (channel && Date.now() - lastStateAt > 8000) connection.textContent = '讲解台未响应，保留当前画面';
      return;
    }
    const seconds = Math.floor((timer.elapsed + (timer.started ? Date.now() - timer.started : 0)) / 1000);
    select('[data-live-clock]').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    select('[data-live-timer]').textContent = timer.started ? '暂停' : '开始';
    if (channel && lastAck && Date.now() - lastAck > 7000) connection.textContent = '展示窗口未响应，请检查窗口';
  }
  if (!audience) {
    select('[data-live-timer]').addEventListener('click', () => {
      if (timer.started) { timer.elapsed += Date.now() - timer.started; timer.started = 0; } else timer.started = Date.now();
      save(timerKey, timer); tick();
    });
    select('[data-live-reset]').addEventListener('click', () => { timer = { elapsed: 0, started: 0 }; save(timerKey, timer); tick(); });
  }
  paint();
  if (audience) {
    post({ type: 'ready' });
    if (saved) connection.textContent = '已恢复展示画面，等待讲解台';
  } else { publish(); tick(); }
  if (!channel) connection.textContent = storageOK ? '使用浏览器同步，请翻页确认展示窗口' : '同步不可用，可在展示窗口直接打开本段';
  const interval = setInterval(tick, audience ? 2500 : 1000);
  return () => { clearInterval(interval); clearTimeout(controlsTimeout); channel?.close(); window.removeEventListener('storage', onStorage); window.removeEventListener('keydown', onKey); root.removeEventListener('click', onClick); root.removeEventListener('pointermove', showControls); };
}
