// 端到端渲染冒烟测试：真实构建产物 + stub DOM，验证路由与视图渲染。
// 运行前置：npm run build。零第三方依赖，node scripts/test-render.mjs 即可。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = process.argv[2] || path.resolve(scriptDir, '../site');
const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
const configMatch = html.match(/<script type="application\/json" id="dynasty-config">(.*?)<\/script>/);
if (!configMatch) {
  console.error('FAIL: index.html 缺少 #dynasty-config，请先运行 npm run build');
  process.exit(1);
}
const config = configMatch[1];
const dynastyConfig = JSON.parse(config);
const reignData = JSON.parse(fs.readFileSync(path.join(siteDir, 'data', `${dynastyConfig.chunk}.json`), 'utf8'));

const els = new Map();
function fakeEl(id) {
  return {
    id,
    dataset: {},
    style: {},
    hidden: false,
    textContent: '',
    innerHTML: '',
    value: '',
    offsetWidth: 0,
    addEventListener() {},
    removeEventListener() {},
    removeAttribute() {},
    setAttribute() {},
    getAttribute() { return null; },
    closest() { return null; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {},
    querySelector() { return fakeEl('q-' + Math.random()); },
    querySelectorAll() { return []; },
    focus() {},
    blur() {},
  };
}
function el(id) {
  if (!els.has(id)) els.set(id, fakeEl(id));
  return els.get(id);
}

globalThis.document = {
  documentElement: fakeEl('html'),
  getElementById(id) {
    if (id === 'dynasty-config') return { textContent: config };
    return el(id);
  },
  createElement() { return fakeEl('gen'); },
  addEventListener() {},
  removeEventListener() {},
  querySelector() { return fakeEl('gen'); },
  querySelectorAll() { return []; },
  body: fakeEl('body'),
  head: fakeEl('head'),
};
const listeners = {};
globalThis.window = globalThis;
const memoryStore = {};
globalThis.localStorage = {
  getItem: (key) => (Object.hasOwn(memoryStore, key) ? memoryStore[key] : null),
  setItem: (key, value) => { memoryStore[key] = String(value); },
  removeItem: (key) => { delete memoryStore[key]; },
};
globalThis.addEventListener = (name, fn) => { (listeners[name] ||= []).push(fn); };
globalThis.removeEventListener = () => {};
globalThis.scrollY = 0;
globalThis.scrollTo = () => {};
globalThis.location = { hash: '' };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.fetch = (url) => {
  const file = path.join(siteDir, url.replace(/^\//, ''));
  if (!fs.existsSync(file)) return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  return Promise.resolve({ ok: true, json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) });
};

await import(path.join(siteDir, 'app.js'));

async function go(hash) {
  globalThis.location.hash = hash;
  for (const fn of listeners['hashchange'] || []) fn();
  await new Promise((r) => setTimeout(r, 120));
  return el('main').innerHTML;
}

let failed = 0;
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ': ' + name);
  if (!cond) failed++;
}
function escExpected(value) {
  return String(value ?? '').replace(/[&<>\"]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[ch]));
}

// 年号专题路由：注册表命中（康熙/雍正）+ 未建专题页的年号优雅降级（年号路由泛化验收点）
const eras = Object.keys(JSON.parse(config).eras);
const registeredEras = ['kangxi', 'yongzheng'];
for (const slug of registeredEras) {
  const out = await go(`#/${slug}`);
  check(`专题页渲染 #/${slug}`, out.includes('thread'));
}
const unregistered = eras.find((slug) => !registeredEras.includes(slug));
if (unregistered) {
  const out = await go(`#/${unregistered}`);
  check(`无专题页的年号路由优雅降级 #/${unregistered}`, out.includes('尚未建立'));
}

const homeHtmlOut = await go('#/');
check('首页现有可读入口', homeHtmlOut.includes('康熙这一段') && homeHtmlOut.includes('两废太子'));
check('首页转轴入口', homeHtmlOut.includes('先看这几处转轴') && homeHtmlOut.includes('#/path'));
const pathPage = await go('#/path');
check('转轴年页', pathPage.includes('这几处转过轴') && pathPage.includes('1912') && pathPage.includes('密储落地'));
const spine = await go('#/spine/power');
check('继承主轴', spine.includes('谁坐龙椅') && spine.includes('明立太子'));
const chronicle = await go('#/chronicle/kangxi');
check('康熙大事记', chronicle.includes('日子对得上的') && chronicle.includes('两说并存') && chronicle.includes('咸安宫'));
const how = await go('#/how');
check('怎么读页', how.includes('日子对得上') && how.includes('咸安宫'));
const yinreng = await go('#/person/QH-P-000004');
check('胤礽页先讲解后收依据', yinreng.includes('两岁立为太子') && yinreng.includes('依据'));
const person = await go('#/person/QH-P-000001');
check('人物页渲染（含朝代内容模块）', person.includes('两废太子') || person.includes('分日'));
check('康熙帝页拆栏', person.includes('见诸文书的习惯') && person.includes('当时要解决什么') && person.includes('本朝未开') === false && person.includes('未开'));
const nurhaci = await go('#/person/QH-P-000051');
check('努尔哈赤帝页有结构且非康熙腔', nurhaci.includes('当时要解决什么') && nurhaci.includes('吞并女真各部') && !nurhaci.includes('择吉不是册立'));
const xuantong = await go('#/person/QH-P-000059');
check('宣统帝页有结构', xuantong.includes('三岁不能算决策') && xuantong.includes('宣统政纪'));
const qlChron = await go('#/chronicle/qianlong');
check('无条次朝大事记不编年表', qlChron.includes('还没有逐日的官书条'));
const chapter = await go('#/chapter/kangxi-02');
check('章节插图语法渲染为权利受检 figure', chapter.includes('fig-inline') && chapter.includes('<img'));
check('样板章原文块', chapter.includes('source-quote') && chapter.includes('選擇吉期具奏'));
check('样板章行内主张', /data-claim="QH-A-KX-0\d+"/.test(chapter));
check('样板章目录与上下篇', chapter.includes('chapter-toc') && chapter.includes('chapter-nav') && chapter.includes('上一篇'));
check('章节提供可分享静态链接', chapter.includes('chapter/kangxi-02/'));
check('样板章冲突并排', chapter.includes('claim-compare') && chapter.includes('QH-CF-KX-INVEST-DAY'));
check('样板章原文块', chapter.includes('source-quote'));
check('样板章行内主张', chapter.includes('data-claim="QH-A-KX-0124"') || chapter.includes('data-claim="QH-A-KX-0086"'));
check('样板章目录', chapter.includes('chapter-toc') && chapter.includes('data-scroll'));
check('样板章上下篇', chapter.includes('chapter-nav') && chapter.includes('上一篇') && chapter.includes('下一篇'));
check('样板章依据摘要不倾倒主张卡', chapter.includes('本章打开过的卷') && !chapter.includes('thread-block'));
check('两废章读这一句', chapter.includes('read-line') && chapter.includes('不能写成对质全文'));
const kx01 = await go('#/chapter/kangxi-01');
check('即位章原文块', kx01.includes('source-quote') && kx01.includes('上即皇帝位') && kx01.includes('崩於寢宮'));
check('即位章行内主张', kx01.includes('data-claim="QH-A-KX-0001"') && kx01.includes('data-claim="QH-A-KX-0033"'));
check('即位章目录与怎么读', kx01.includes('chapter-toc') && kx01.includes('data-scroll') && kx01.includes('怎么读这件事'));
check('即位章冲突并排', kx01.includes('claim-compare') && kx01.includes('QH-CF-KX-SUCCESSION'));
check('即位章上下篇', kx01.includes('chapter-nav') && kx01.includes('下一篇'));
check('即位章读这一句', kx01.includes('read-line') && kx01.includes('不能把「深肖朕躬」写成'));
const yz01 = await go('#/chapter/yongzheng-01');
check('雍正即位章原文块', yz01.includes('source-quote') && yz01.includes('即皇帝位') && yz01.includes('子刻'));
check('雍正即位章行内主张', yz01.includes('data-claim="QH-A-YZ-0039"') && yz01.includes('data-claim="QH-A-YZ-0041"'));
check('雍正即位章目录与怎么读', yz01.includes('chapter-toc') && yz01.includes('怎么读这件事'));
check('雍正即位章冲突并排', yz01.includes('claim-compare') && yz01.includes('QH-CF-YZ-NIAN-DEATH') && yz01.includes('QH-CF-YZ-DEATH'));
const sevenDays = await go('#/chapter/yongzheng-07');
check('康雍七日链专题形成证据闭环', sevenDays.includes('七日链')
  && sevenDays.includes('data-claim="QH-A-KX-0037"')
  && sevenDays.includes('data-claim="QH-A-YZ-0039"')
  && sevenDays.includes('claim-compare')
  && sevenDays.includes('继承记录为什么不能合成一条')
  && sevenDays.includes('本章打开过的卷'));
check('路由更新页面标题', document.title === '从十三日崩逝到二十日即位 · 清史读本');
const searchCn = await go('#/search?q=胤禛');
check('检索高亮 mark 生效', searchCn.includes('<mark>'));
const searchPy = await go('#/search?q=yinzhen');
check('拼音检索 yinzhen 命中胤禛', searchPy.includes('QH-P-000002'));
const works = await go('#/works');
check('文献专栏按帝分组且有专论入口', works.includes('大义觉迷录') && works.includes('读专论') && works.includes('乾隆'));
check('文献打开状态徽章', works.includes('条次已钉') || works.includes('主张已拆'));
check('起居注不假装可读原文', works.includes('入口已登记') && works.includes('馆藏／咨询入口'));
const juemilu = await go('#/chapter/yongzheng-04');
check('大义觉迷录专论章渲染', juemilu.includes('自辩') && juemilu.includes('禁毁'));
const goldenFailures = [];
for (const row of reignData.questions || []) {
  const out = await go(`#/question/${row.question_id}`);
  const expected = row['期望行为'] === '拒绝作答' ? row['拒答说明'] : row['可公开答案'];
  const binds = String(row['绑定ID'] || '').split(/[；;]/).map((id) => id.trim()).filter(Boolean);
  if (!out.includes(escExpected(row['问题'])) || !out.includes(escExpected(expected))
    || binds.some((id) => !out.includes(id))) {
    goldenFailures.push(row.question_id);
  }
}
if (goldenFailures.length) console.error(`黄金问题渲染失败: ${goldenFailures.join(', ')}`);
check(`黄金问题全量验收 ${reignData.questions?.length || 0} 道`, goldenFailures.length === 0);
const adoptedClaim = await go('#/claim/QH-A-KX-0014');
check('主张页公开采纳与复核记录', adoptedClaim.includes('已采纳')
  && adoptedClaim.includes('zonglinxie-cyber') && adoptedClaim.includes('2026-08-15'));
const claimCf = await go('#/claim/QH-A-KX-0070');
check('主张页同组异说并排区块', claimCf.includes('同组异说') && claimCf.includes('QH-CF-KX-INVEST-DAY'));
const images = await go('#/images');
check('画像总览带灯箱属性', images.includes('data-lightbox'));
const imagePage = await go('#/image/QH-V-E04');
check('图像详情页主图带灯箱属性', imagePage.includes('data-lightbox'));
const unknown = await go('#/no-such-page');
check('未知路由 404', unknown.includes('没有这个页面'));

// 灯箱高清变体：Wikimedia 缩略图应取最大档
const { largestVariant, noOrphan } = await import(path.join(siteDir, 'templates.js'));
const thumb = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.jpg/960px-Example.jpg';
check('largestVariant 取最大档', largestVariant(thumb).includes('/1280px-Example.jpg'));
check('largestVariant 本地图原样', largestVariant('media/QH-V-E04.jpg') === 'media/QH-V-E04.jpg');
check('句末不孤字', noOrphan('以官书原文为底本，逐条整理。').includes('class="nobr">整理。'));
const homeOut = await go('#/');
check('首页导语句末不孤字', homeOut.includes('class="nobr"') && homeOut.includes('整理。'));

// 可分享静态页：全部章节可打开，只有来源闭环章节进入 sitemap。
const staticMissing = [];
const indexableChapters = [];
const noindexChapters = [];
for (const chapterRow of reignData.chapters || []) {
  const file = path.join(siteDir, 'chapter', chapterRow.slug, 'index.html');
  if (!fs.existsSync(file)) { staticMissing.push(chapterRow.slug); continue; }
  const page = fs.readFileSync(file, 'utf8');
  const indexable = Boolean(String(chapterRow.unit_ids || '').trim()) && /E1\s*单源回查/.test(chapterRow.status || '');
  if (indexable) indexableChapters.push(chapterRow);
  else noindexChapters.push(chapterRow);
  if (!page.includes(`<meta name="robots" content="${indexable ? 'index,follow' : 'noindex,follow'}">`)
    || !page.includes('<link rel="canonical"') || !page.includes('application/ld+json')) {
    staticMissing.push(`${chapterRow.slug}:meta`);
  }
}
const staticEvidence = fs.readFileSync(path.join(siteDir, 'chapter', 'yongzheng-07', 'index.html'), 'utf8');
const sitemap = fs.readFileSync(path.join(siteDir, 'sitemap.xml'), 'utf8');
check(`静态章节全量生成 ${reignData.chapters?.length || 0} 篇`, staticMissing.length === 0);
check('静态证据页保留可回主张链接', staticEvidence.includes('href="#/claim/QH-A-KX-0037"')
  && !staticEvidence.includes('<button type="button" class="link claim-ref"'));
check(`sitemap 只收证据闭环章节 ${indexableChapters.length} 篇`,
  indexableChapters.every((row) => sitemap.includes(`/chapter/${row.slug}/`))
  && noindexChapters.every((row) => !sitemap.includes(`/chapter/${row.slug}/`)));
check('robots.txt 指向 sitemap', fs.readFileSync(path.join(siteDir, 'robots.txt'), 'utf8').includes('/sitemap.xml'));
check('首页带 canonical 与结构化数据', html.includes('rel="canonical"')
  && html.includes('"@type":"WebSite"') && html.includes('property="og:url"'));

console.log(failed ? `渲染测试 ${failed} 项失败` : '渲染测试全部通过');
process.exit(failed ? 1 : 0);
