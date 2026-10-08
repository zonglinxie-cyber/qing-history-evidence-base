// 真实 Chromium 冒烟：验证关键路由的运行时、语义骨架、重复 ID 与移动端溢出。
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, '../site');
const host = '127.0.0.1';
const httpPort = Number(process.env.BROWSER_TEST_HTTP_PORT || 8876);
const debugPort = Number(process.env.BROWSER_TEST_DEBUG_PORT || 9339);
const base = `http://${host}:${httpPort}/`;

function chromeBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes('/') && fs.existsSync(candidate)) return candidate;
    if (!candidate.includes('/')) {
      const found = spawnSync('which', [candidate], { encoding: 'utf8' }).stdout.trim();
      if (found) return found;
    }
  }
  throw new Error('找不到 Chrome/Chromium；可通过 CHROME_BIN 指定');
}

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
};
const browserPath = chromeBinary();
const server = http.createServer((req, res) => {
  const raw = decodeURIComponent(new URL(req.url, base).pathname);
  const rel = raw === '/' ? 'index.html' : raw.replace(/^\/+/, '');
  const file = path.resolve(siteDir, rel);
  if (!file.startsWith(`${siteDir}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve, reject) => server.listen(httpPort, host, (error) => error ? reject(error) : resolve()));

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qh-browser-'));
const chrome = spawn(browserPath, [
  '--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
  '--disable-gpu', '--disable-extensions', '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;
try {
  let targets;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://${host}:${debugPort}/json/list`);
      if (response.ok) { targets = await response.json(); break; }
    } catch {}
    await sleep(50);
  }
  const target = targets?.find((item) => item.type === 'page');
  if (!target) throw new Error('Chrome DevTools 未就绪');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });

  let seq = 0;
  const pending = new Map();
  const runtimeErrors = [];
  const responseErrors = [];
  const requests = [];
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const [resolve, reject] = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
      return;
    }
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails?.text || 'runtime exception');
    if (message.method === 'Network.responseReceived'
      && message.params.response.status >= 400
      && message.params.response.url.startsWith(base)) {
      responseErrors.push(`${message.params.response.status} ${message.params.response.url}`);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, [resolve, reject]);
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'evaluate failed');
    return result.result.value;
  };
  await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable')]);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: base });
  await sleep(1000);

  const routes = ['#/', '#/read', '#/jiaqing', '#/chapter/jiaqing-04', '#/chapter/yongzheng-04', '#/chapter/kangxi-01', '#/chapter/guangxu-07', '#/chapter/shunzhi-05', '#/chapter/tongzhi-05', '#/chapter/huangtaiji-13', '#/chapter/huangtaiji-12', '#/chapter/huangtaiji-08', '#/chapter/jiaqing-11', '#/chapter/xianfeng-08', '#/chapter/nurhaci-11', '#/lane/QH-L-0032', '#/works', '#/claim/QH-A-KX-0180', '#/search?q=如意', '#/search?q=找不到的测试词', '#/studio/treaty-paper', '#/screen/treaty-paper'];
  const failures = [];
  function check(name, ok) {
    if (!ok) failures.push(name);
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  }
  const waitFor = async (expression) => {
    for (let i = 0; i < 80; i += 1) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    throw new Error(`等待失败：${expression}`);
  };
  check('首页不加载讲解台代码与完整讲稿', !requests.some((url) => /\/(studio|live-content)\.js(?:\?|$)/.test(url)));
  const screenshotDir = process.env.BROWSER_SCREENSHOT_DIR;
  if (screenshotDir) fs.mkdirSync(screenshotDir, { recursive: true });
  async function screenshot(name) {
    if (!screenshotDir) return;
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshotDir, `${name}.png`), Buffer.from(shot.data, 'base64'));
  }
  const viewports = { 390: { height: 844, mobile: true }, 768: { height: 1024, mobile: false }, 1440: { height: 1000, mobile: false } };
  for (const width of [390, 768, 1440]) {
    const { height, mobile } = viewports[width];
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    for (const route of routes) {
      await evaluate(`location.hash=${JSON.stringify(route)}`);
      await sleep(800);
      const state = await evaluate(`(() => {
        const ids = [...document.querySelectorAll('[id]')].map((node) => node.id).filter(Boolean);
        const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
        const main = document.querySelector('main');
        return {
          h1: main?.querySelector('h1')?.textContent.trim() || '',
          text: main?.textContent.trim().slice(0, 80) || '',
          duplicates: [...new Set(duplicates)],
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          wideTablesOk: [...document.querySelectorAll('main table')]
            .filter((table) => table.getBoundingClientRect().width > document.documentElement.clientWidth + 1)
            .every((table) => {
              for (let node = table.parentElement; node && node !== document.body; node = node.parentElement) {
                const ox = getComputedStyle(node).overflowX;
                if (ox === 'auto' || ox === 'scroll') return true;
              }
              return false;
            }),
          hasTable: !!document.querySelector('main table'),
          // 已加载完的图片里：naturalWidth 为 0 即破损；宽高比偏差 >6% 且非 cover/contain 裁切即视为变形。
          brokenImgs: [...document.querySelectorAll('main img')].filter((img) => img.complete && img.naturalWidth === 0).length,
          skewedImgs: [...document.querySelectorAll('main img')].filter((img) => {
            if (!img.complete || !img.naturalWidth || !img.offsetHeight) return false;
            const fit = getComputedStyle(img).objectFit;
            if (fit === 'cover' || fit === 'contain') return false;
            const natural = img.naturalWidth / img.naturalHeight;
            const rendered = img.getBoundingClientRect().width / img.getBoundingClientRect().height;
            return Math.abs(natural - rendered) / natural > 0.06;
          }).length,
        };
      })()`);
      check(`${width}px ${route} · ${state.h1}`, !!state.h1 && !!state.text
        && !/载入中|检索中|暂时没有打开/.test(state.text) && !state.duplicates.length && state.overflow <= 1
        && (!state.hasTable || state.wideTablesOk)
        && state.brokenImgs === 0 && state.skewedImgs === 0);
      if (['#/', '#/read', '#/jiaqing', '#/chapter/jiaqing-04', '#/chapter/yongzheng-04', '#/studio/treaty-paper', '#/search?q=如意'].includes(route)) {
        await screenshot(`${width}-${route.replace(/[^\w\u4e00-\u9fff]/g, '-')}`);
      }
      if (route === '#/') {
        check(`${width}px 十二帝画像紧随长卷进入前两屏`, await evaluate(`(() => {
          const cards = document.querySelector('.home-emperors');
          return document.querySelectorAll('.home-emperors .emperor-card').length === 12
            && document.querySelectorAll('.reign-track .reign-seg').length === 12
            && !!cards && cards.getBoundingClientRect().top + window.scrollY <= ${width === 390 ? 1688 : 1800};
        })()`));
        check(`${width}px 首页不再直出精选卡与三格入口`, await evaluate(`(() => {
          const main = document.querySelector('main');
          return !main.querySelector('.reading-picks') && !main.querySelector('.home-paths')
            && !!main.querySelector('.home-more a[href="#/jiedu"]');
        })()`));
        check(`${width}px 讲解台入口稳定可达`, await evaluate(`!!document.querySelector('.nav a[href="#/studio"]')`));
      }
      if (route === '#/read') {
        check(`${width}px 精选阅读入口位于前两屏`, await evaluate(`(() => {
          const features = document.querySelector('.read-features');
          return !!features && features.getBoundingClientRect().top + window.scrollY <= ${width === 390 ? 1688 : 1800};
        })()`));
        check(`${width}px 读故事页精选不少于六项`, await evaluate(`document.querySelectorAll('.read-features .reading-pick').length >= 6`));
        if (screenshotDir) {
          await evaluate(`document.querySelector('.read-features').scrollIntoView({ behavior: 'instant', block: 'start' })`);
          await sleep(200);
          await screenshot(`${width}-read-stories`);
        }
      }
    }
  }

  await evaluate(`location.hash='#/read'`);
  await waitFor(`!!document.querySelector('.read-features')`);
  await evaluate(`document.querySelector('.read-features a[href*="guangxu-01"]').click()`);
  await waitFor(`!!document.querySelector('.passage-focus')`);
  check('精选故事直达正文选段，不绕到讲解台', await evaluate(`location.hash.startsWith('#/chapter/guangxu-01') && document.querySelector('.passage-focus').textContent.includes('备约细工')`));
  await evaluate(`location.hash='#/read'`);
  await waitFor(`!!document.querySelector('.read-features')`);
  const pickHrefs = await evaluate(`[...document.querySelectorAll('.read-features a[href*="#/chapter"]')].map((a) => new URL(a.getAttribute('href'), location.href).hash).filter((h) => h.includes('focus='))`);
  check(`精选直达选段不少于六项（实际 ${pickHrefs.length}）`, pickHrefs.length >= 6);
  for (const href of pickHrefs) {
    await evaluate(`location.hash=${JSON.stringify(href)}`);
    await sleep(600);
    const slug = href.match(/#\/chapter\/([\w-]+)/)[1];
    check(`直达选段命中：${slug}`, await evaluate(`location.hash.startsWith('#/chapter/${slug}') && !!document.querySelector('.passage-focus')`));
  }

  // 讲解台交互回归：翻页、键盘、按段笔记、刷新恢复、画幅、切题与观众直达地址的优先级。
  await evaluate(`location.hash='#/studio/treaty-paper?session=browser-reg'`);
  await waitFor(`!!document.querySelector('[data-live-root="treaty-paper"] [data-live-next]')`);
  const total = Number((await evaluate(`document.querySelector('[data-live-progress]').textContent`)).split('/')[1].trim());
  check(`讲解台初始进度 1/${total}`, (await evaluate(`document.querySelector('[data-live-progress]').textContent`)) === `1 / ${total}`);
  await evaluate(`document.querySelector('[data-live-next]').click()`);
  check('点「下一段」前进', (await evaluate(`document.querySelector('[data-live-progress]').textContent`)) === `2 / ${total}`);
  await evaluate(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))`);
  check('方向键翻段', (await evaluate(`document.querySelector('[data-live-progress]').textContent`)) === `3 / ${total}`);
  const lastStepTitle = await evaluate(`document.querySelector('[data-live-step="${total - 1}"]').lastChild.textContent.trim()`);
  await evaluate(`(() => { const t = document.querySelector('#live-note'); t.value = '回归测试笔记'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  check('笔记写入并提示保存', (await evaluate(`document.querySelector('[data-note-status]').textContent`)).includes('已保存到当前浏览器'));
  await send('Page.navigate', { url: `${base}?probe=studio#/studio/treaty-paper?session=browser-reg` });
  await waitFor(`!!document.querySelector('[data-live-progress]')`);
  check('刷新恢复段落进度与笔记', (await evaluate(`document.querySelector('[data-live-progress]').textContent`)) === `3 / ${total}`
    && (await evaluate(`document.querySelector('#live-note').value`)) === '回归测试笔记');
  await evaluate(`document.querySelector('[data-live-step="0"]').click()`);
  check('笔记按段独立', (await evaluate(`document.querySelector('#live-note').value`)) === '');
  await evaluate(`(() => { const s = document.querySelector('[data-live-format]'); s.value = 'portrait'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  check('画幅切换落到预览与地址', await evaluate(`document.querySelector('.studio-preview').dataset.format === 'portrait' && location.hash.includes('format=portrait')`));
  await evaluate(`location.hash='#/screen/yongzheng-rumour-book?session=browser-reg'`);
  await waitFor(`!!document.querySelector('[data-live-root="yongzheng-rumour-book"]')`);
  check('切题直达观众地址只呈现本题、不露主播端', await evaluate(`!!document.querySelector('[data-live-root="yongzheng-rumour-book"]')
    && location.hash.startsWith('#/screen/yongzheng-rumour-book') && !document.querySelector('.studio-notes')`));
  await evaluate(`location.hash=${JSON.stringify(`#/screen/treaty-paper?session=browser-reg&step=${total - 1}&format=landscape`)}`);
  await waitFor(`!!document.querySelector('[data-live-root="treaty-paper"] .studio-preview')`);
  check('观众 step 参数压过旧会话存档', await evaluate(`document.querySelector('.studio-preview').textContent.includes(${JSON.stringify(lastStepTitle.slice(0, 8))})`)
    && lastStepTitle.length >= 8);
  await send('Page.navigate', { url: `${base}?probe=studio2#/studio/treaty-paper?session=browser-reg` });
  await waitFor(`!!document.querySelector('[data-live-progress]')`);
  check('观众端画幅选择不回写讲解台', (await evaluate(`document.querySelector('[data-live-format]').value`)) === 'portrait');

  // 横竖屏仿真：手机竖屏打开观众地址时，即使 URL 写着 landscape 也按竖屏排版；横放手机则尊重参数。
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, orientation: 'portrait' });
  await send('Page.navigate', { url: `${base}?probe=orientation#/screen/treaty-paper?session=browser-reg&step=1&format=landscape` });
  await waitFor(`!!document.querySelector('[data-live-root="treaty-paper"] .studio-preview')`);
  check('手机竖屏观众端强制竖屏排版，压过 URL 的 landscape', await evaluate(`window.matchMedia('(orientation: portrait)').matches
    && document.querySelector('.studio-preview').dataset.format === 'portrait'`));
  await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true, orientation: 'landscape' });
  await send('Page.navigate', { url: `${base}?probe=orientation2#/screen/treaty-paper?session=browser-reg&step=1&format=landscape` });
  await waitFor(`!!document.querySelector('[data-live-root="treaty-paper"] .studio-preview')`);
  check('横放手机观众端尊重 landscape 参数', await evaluate(`window.matchMedia('(orientation: landscape)').matches
    && document.querySelector('.studio-preview').dataset.format === 'landscape'`));
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  // 目录定位：章内目录点开末节，标题应滚入视口顶部附近。
  await evaluate(`location.hash='#/chapter/kangxi-01'`);
  await waitFor(`!!document.querySelector('.chapter-shell')`);
  await evaluate(`(() => { const d = document.querySelector('.chapter-toc'); if (d?.tagName === 'DETAILS') d.open = true; })()`);
  const tocOk = await evaluate(`!!document.querySelector('.chapter-toc [data-scroll]')`);
  check('长章提供章内目录', tocOk);
  if (tocOk) {
    await evaluate(`(() => { const btns = document.querySelectorAll('.chapter-toc [data-scroll]'); btns[btns.length - 1].click(); })()`);
    await sleep(900);
    check('目录点击滚到对应小节', await evaluate(`(() => {
      const btns = document.querySelectorAll('.chapter-toc [data-scroll]');
      const target = document.getElementById(btns[btns.length - 1].getAttribute('data-scroll'));
      return !!target && window.scrollY > 300 && Math.abs(target.getBoundingClientRect().top) < window.innerHeight;
    })()`));
  }

  await evaluate(`location.hash='#/search?q=雍正&cat=chapter'`);
  await waitFor(`document.querySelector('.search-stories') && document.querySelector('h1').textContent.includes('雍正')`);
  await evaluate(`window.scrollTo(0, 500)`);
  await sleep(150);
  const searchY = await evaluate('window.scrollY');
  await evaluate(`document.querySelector('.search-story h3 a').click()`);
  await waitFor(`!!document.querySelector('.chapter-shell')`);
  check('文章提供返回搜索结果入口', await evaluate(`!!document.querySelector('.reading-time a[href*="cat=chapter"]')`));
  await evaluate('history.back()');
  await waitFor(`!!document.querySelector('.search-stories')`);
  await sleep(200);
  check('返回搜索保留关键词、类别与滚动位置', await evaluate(`document.getElementById('q').value === '雍正'
    && document.querySelector('[data-search-cat="chapter"]').getAttribute('aria-selected') === 'true'
    && Math.abs(window.scrollY - ${searchY}) < 40`));

  // 出场反向索引的运行时闭环：正文人名可点 → 人物页列出篇章与摘录 → 点回去落在对应段落。
  // 只看 .md（正文本体），章末「接着读下去」里的人物卡不算连线；摘录出自表格单元的那条也要跳一次，
  // 因为锚点只认标题与段落，那类出场只能落到所在小标题。
  const mentionRows = (JSON.parse(fs.readFileSync(path.join(siteDir, 'data', 'd-qing.json'), 'utf8')).personMentions || [])
    .filter((row) => row.person_id === 'QH-P-000124');
  const mentionHref = (row) => `#/chapter/${encodeURIComponent(row.chapter_slug)}${row.focus ? `?focus=${encodeURIComponent(row.focus)}` : ''}`;
  const bodyRows = mentionRows.filter((row) => row.chapter_slug === 'qianlong-12');
  await evaluate(`location.hash='#/chapter/qianlong-12'`);
  await waitFor(`!!document.querySelector('.chapter-body .md')`);
  const nameLinks = await evaluate(`[...document.querySelectorAll('.chapter-body .md a[href="#/person/QH-P-000124"]')].map((a) => a.textContent.trim())`);
  check(`正文人名连线（${nameLinks.length} 处 / 该章出行 ${bodyRows.length} 条）`,
    nameLinks.length >= bodyRows.length && nameLinks.every((text) => text.includes('和珅')));
  await evaluate(`document.querySelector('.chapter-body .md a[href="#/person/QH-P-000124"]').click()`);
  await waitFor(`!!document.getElementById('p-mention')`);
  check('点正文人名落到该人物页', await evaluate(`location.hash === '#/person/QH-P-000124'
    && document.querySelector('h1').textContent.includes('和珅')`));

  const mentionCards = await evaluate(`(() => {
    const section = document.getElementById('p-mention').closest('section');
    return [...section.querySelectorAll('.claim a[href*="#/chapter"]')].map((a) => a.getAttribute('href'));
  })()`);
  check(`人物页出场与构建产物逐条一致（${mentionCards.length} 条 / ${new Set(mentionRows.map((row) => row.chapter_slug)).size} 篇）`,
    mentionCards.length === mentionRows.length
    && mentionCards.every((href, index) => href === mentionHref(mentionRows[index])));
  for (const row of [mentionRows[0],
    mentionRows.find((item) => item.chapter_slug === 'qianlong-04'),
    mentionRows.find((item) => !item.focus)].filter(Boolean)) {
    await evaluate(`location.hash=${JSON.stringify(mentionHref(row))}`);
    await sleep(600);
    const focused = await evaluate(`document.querySelector('.passage-focus')?.textContent.trim() || ''`);
    check(row.focus ? `出场跳回 ${row.chapter_slug} 的「${row.focus}」` : `无锚点出场落到 ${row.chapter_slug} 篇首`,
      row.focus ? focused.includes(row.focus)
        : focused === '' && await evaluate(`!!document.querySelector('.chapter-shell')`));
  }

  // 真正阻断一个数据请求，再通过页面按钮恢复；不把预期的网络失败当正常加载成功。
  await send('Network.setBlockedURLs', { urls: ['*/data/people.json*'] });
  await send('Page.navigate', { url: `${base}?probe=retry#/jiaqing` });
  await waitFor(`!!document.querySelector('[data-retry-view]')`);
  await send('Network.setBlockedURLs', { urls: [] });
  await evaluate(`document.querySelector('[data-retry-view]').click()`);
  await waitFor(`!!document.querySelector('.era-start')`);
  check('数据失败可在原页面重试恢复', await evaluate(`document.querySelector('h1').textContent === '嘉庆'`));

  // 禁止本地存储时，阅读、主题和字号仍能正常使用。
  const injected = await send('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });` });
  await send('Page.navigate', { url: `${base}?probe=storage#/chapter/jiaqing-04` });
  await waitFor(`!!document.querySelector('.chapter-shell')`);
  await evaluate(`document.getElementById('theme-toggle').click(); document.querySelector('[data-set-fs="l"]').click();`);
  check('存储不可用仍可阅读和调节字号', await evaluate(`document.documentElement.classList.contains('fs-l') && !!document.querySelector('.chapter-body')`));
  await screenshot('1440-dark-story');
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected.identifier });

  // 回归：直开页面时人名已随 people 块解析，不再裸出 QH-P- ID（VIEW_CHUNKS 曾漏挂 people）。
  // 等各自页面的标志元素出现再判：index.html 直出了首页 SSR，innerText 非空不代表路由渲染完成。
  const routeReady = {
    '#/succession': `document.querySelector('main h1')?.textContent.includes('储位')`,
    '#/empresses': `!!document.querySelector('[data-empress-era]')`,
    '#/princes': `!!document.querySelector('[data-prince-era]')`,
  };
  for (const route of ['#/succession', '#/empresses', '#/princes']) {
    await send('Page.navigate', { url: `${base}?probe=ids-${route.slice(2)}${route}` });
    await waitFor(routeReady[route]);
    check(`直开 ${route} 不裸出人名ID`, await evaluate(`!/QH-P-\\d/.test(document.querySelector('main').innerText)`));
  }
  // 回归：朝代笺签选中态必须是朱底纸字，不被 .filters button.on 的朱字盖掉。
  for (const route of ['#/empresses', '#/princes']) {
    await send('Page.navigate', { url: `${base}?probe=tab-${route.slice(2)}${route}` });
    await waitFor(`!!document.querySelector('.era-tab-item.active')`);
    check(`${route} 选中签可辨（前景≠底色）`, await evaluate(`(() => {
      const cs = getComputedStyle(document.querySelector('.era-tab-item.active'));
      return cs.color !== cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
    })()`));
  }
  // 回归：章内目录编号与题名同一行（li 改 grid 悬挂缩进）。
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}?probe=toc#/chapter/yongzheng-04c` });
  await waitFor(`!!document.querySelector('.chapter-toc')`);
  await evaluate(`(() => { const d = document.querySelector('.chapter-toc'); if (d?.tagName === 'DETAILS') d.open = true; })()`);
  check('目录编号与题名同行', await evaluate(`[...document.querySelectorAll('.chapter-toc li')].every((li) => {
    const btn = li.querySelector('button');
    return btn && Math.abs(li.getBoundingClientRect().top - btn.getBoundingClientRect().top) <= 4;
  })`));
  // 回归：储位页归属「十二帝」导航，不再点亮「读故事」。
  await send('Page.navigate', { url: `${base}?probe=nav#/succession` });
  await waitFor(routeReady['#/succession']);
  check('储位页导航落在十二帝', await evaluate(`document.querySelector('.nav a[aria-current]')?.getAttribute('href') === '#/'`));

  // 回归：空 slug 的 #/chapter/ 必须落到「未找到」，不能空页。
  await send('Page.navigate', { url: `${base}?probe=emptyslug#/chapter/` });
  await waitFor(`document.querySelector('main h1')?.textContent.includes('未找到')`);
  check('空 slug 章节路由优雅降级', await evaluate(`document.querySelector('main h1').textContent.includes('未找到')`));

  // 回归：灯箱对本地图先试 @2x 高清档，且保留 ?v= 内容戳（曾因丢 query 串回旧图）。
  await send('Page.navigate', { url: `${base}?probe=lightbox#/sites` });
  await waitFor(`!!document.querySelector('main h1')`);
  await evaluate(`location.hash='#/site/QH-ST-0014'`);
  await waitFor(`!!document.querySelector('img[data-lightbox]')`);
  await evaluate(`document.querySelector('img[data-lightbox]').click()`);
  await waitFor(`document.getElementById('lightbox')?.open === true`);
  check('灯箱优先取 @2x 且保留 ?v= 指纹', await evaluate(`(() => {
    const src = document.getElementById('lightbox-img')?.src || '';
    return /@2x\\.(?:jpe?g|png|webp)/i.test(src) && /[?&]v=/.test(src);
  })()`));

  // 回归：正文里所有链接都带链接样式（class），不再有裸 <a>。
  check('正文链接全部带 class', await evaluate(`[...document.querySelectorAll('main a[href]')].every((a) => a.classList.length > 0)`));

  if (runtimeErrors.length) failures.push(`运行时异常：${runtimeErrors.join('；')}`);
  if (responseErrors.length) failures.push(`本地资源错误：${responseErrors.join('；')}`);
  if (failures.length) {
    failures.forEach((line) => console.error(`FAIL: ${line}`));
    process.exitCode = 1;
  } else {
    console.log('真实 Chromium 冒烟全部通过');
  }
} finally {
  try { socket?.close(); } catch {}
  const exited = new Promise((resolve) => chrome.once('exit', resolve));
  chrome.kill('SIGTERM');
  await Promise.race([exited, sleep(2000)]);
  await new Promise((resolve) => server.close(resolve));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(profile, { recursive: true, force: true });
      break;
    } catch (error) {
      if (attempt === 4) console.warn(`WARN: 临时 Chrome profile 未能清理：${error.message}`);
      else await sleep(100);
    }
  }
}
