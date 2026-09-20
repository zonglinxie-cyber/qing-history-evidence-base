// 模板与路由冒烟测试：真实构建产物 + stub DOM（不代替浏览器验收），验证路由与视图渲染。
// 运行前置：npm run build。零第三方依赖，node scripts/test-render.mjs 即可。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const homeData = JSON.parse(fs.readFileSync(path.join(siteDir, 'data', 'home.json'), 'utf8'));
const peopleData = JSON.parse(fs.readFileSync(path.join(siteDir, 'data', 'people.json'), 'utf8'));

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
    open: false,
    showModal() { this.open = true; this.hidden = false; },
    close() { this.open = false; this.hidden = true; },
    getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
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
globalThis.sessionStorage = globalThis.localStorage;
globalThis.history = { scrollRestoration: 'auto' };
globalThis.IntersectionObserver = class {
  observe() {}
  disconnect() {}
};
globalThis.addEventListener = (name, fn) => { (listeners[name] ||= []).push(fn); };
globalThis.removeEventListener = () => {};
globalThis.scrollY = 0;
globalThis.scrollTo = () => {};
globalThis.location = { hash: '' };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.fetch = (url) => {
  const file = path.join(siteDir, url.replace(/^\//, '').split('?')[0]);
  if (!fs.existsSync(file)) return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  return Promise.resolve({ ok: true, json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) });
};

await import(path.join(siteDir, 'app.js'));

async function go(hash) {
  el('main').innerHTML = '';
  globalThis.location.hash = hash;
  for (const fn of listeners['hashchange'] || []) fn();
  const deadline = Date.now() + 4000;
  let html = '';
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 15));
    html = el('main').innerHTML || '';
    if (html && !html.includes('检索中…')) return html;
  }
  return html;
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
  check(`无专题页的年号路由优雅降级 #/${unregistered}`, out.includes('thread') && out.includes('系年不可考者'));
}

const homeHtmlOut = await go('#/');
check('首页精选入口在前、十二帝画像完整、讲解台入口稳定', (homeHtmlOut.match(/class="card emperor-card"/g) || []).length === 12
  && homeHtmlOut.indexOf('reign-scroll-wrap') < homeHtmlOut.indexOf('home-features')
  && homeHtmlOut.indexOf('home-features') < homeHtmlOut.indexOf('home-emperors')
  && homeHtmlOut.includes('#/chapter/jiaqing-04')
  && homeHtmlOut.indexOf('home-paths') < homeHtmlOut.indexOf('home-emperors')
  && homeHtmlOut.includes('href="#/studio"'));
const jieduOut = await go('#/jiedu');
check('逐解全部在自己的页面上', jieduOut.includes('一部一部，逐段读') && (jieduOut.match(/class="thread"/g) || []).length >= 40);
const howOut = await go('#/how');
check('已打开对照入口移到怎么读', howOut.includes('已系年的几处') && howOut.includes('#/chapter/jiaqing-04') && howOut.includes('#/lane/QH-L-0033'));
const materialOut = await go('#/material');
check('材料页收齐三种材料', ['#/works', '#/hands', '#/jiedu']
  .every((h) => materialOut.includes(h)) && !materialOut.includes('href="#/images"'));
check('材料页按朝可下钻', materialOut.includes('#/works?era=') && materialOut.includes('#/jiedu?era='));
check('首页不叠六期评传入口', !homeHtmlOut.includes('由浅入深读全朝') && !homeHtmlOut.includes('#/overview/periods'));
check('首页不写结构化证据仪表', !homeHtmlOut.includes('尚无结构化证据'));
check('研究稿声明已移除', !homeHtmlOut.includes('AI 辅助个人研究库') && !html.includes('并非专家审定本'));
const descriptionTags = html.match(/<meta\s+name="description"\s+content="[^"]*">/g) || [];
check('首页只有一条 description', descriptionTags.length === 1);
check('首页扉页不堆二级入口', homeHtmlOut.includes('page-intro')
  && !homeHtmlOut.includes('home-actions') && !homeHtmlOut.includes('276 年转轴'));
const headerNav = html.match(/<nav class="nav" aria-label="主导航">[\s\S]*?<\/nav>/)?.[0] || '';
const navItems = (headerNav.match(/<a\b/g) || []).length;
check('顶栏主入口为读故事/读史料/讲解台等六项', navItems === 6 && headerNav.includes('遗址今况')
  && headerNav.includes('十二帝') && headerNav.includes('读故事') && headerNav.includes('读史料')
  && headerNav.includes('紫光阁') && headerNav.includes('讲解台')
  && !headerNav.includes('对照') && !headerNav.includes('怎么读')
  && !headerNav.includes('#/claims'));
check('帝卡给全名号并以一句收束', homeHtmlOut.includes('card-vita-line')
  && (homeHtmlOut.match(/class="card-id-row"/g) || []).length === 60
  && (homeHtmlOut.match(/class="card-hook-line"/g) || []).length === 12
  && homeHtmlOut.includes('（雍正第四子）')
  && homeHtmlOut.includes('法天隆运至诚先觉体元立极敷文奋武钦明孝慈神圣纯皇帝'));
check('首页不主推改诏与吕四娘', !homeHtmlOut.includes('#/lane/QH-L-0007')
  && !homeHtmlOut.includes('#/lane/QH-L-0009')
  && !homeHtmlOut.includes('吕四娘'));
const readOut = await go('#/read');
check('读故事总目录按朝列出章节', readOut.includes('按朝读故事')
  && readOut.includes('#/chapter/kangxi-01')
  && readOut.includes('资料')
  && readOut.includes('crumb'));
const pathPage = await go('#/path');
check('转轴年页', pathPage.includes('转轴之处') && pathPage.includes('1912') && pathPage.includes('遗诏与密建储'));
check('内禅转轴接到和珅分日章', pathPage.includes('#/chapter/jiaqing-04'));
const periods = await go('#/overview/periods');
check('全朝专题不再带研究稿警示', !periods.includes('研究草稿｜本章尚未完成全文史料核对'));
const spine = await go('#/spine/power');
check('继承主轴', spine.includes('在位者与决策者') && spine.includes('明立太子'));
const money = await go('#/spine/money');
check('饷和兵主轴', money.includes('财政与兵源') && money.includes('耗羡'));
const chronicleBare = await go('#/chronicle');
check('大事记无年号不默默进康熙', chronicleBare.includes('未找到该大事记') && !chronicleBare.includes('系年可考的'));
const chronicle = await go('#/chronicle/kangxi');
check('康熙大事记', chronicle.includes('系年可考的') && chronicle.includes('同组记载对照') && chronicle.includes('咸安宫'));
const how = await go('#/how');
check('怎么读页', how.includes('日子对得上') && how.includes('咸安宫'));
const yinreng = await go('#/person/QH-P-000004');
check('胤礽页先讲解后收依据', yinreng.includes('两岁立为太子') && yinreng.includes('依据'));
check('胤礽页有 Wikidata、CBDB、ctext 对照', yinreng.includes('wikidata.org/wiki/Q1076775')
  && yinreng.includes('cbdbapi/person.php?id=63608')
  && yinreng.includes('datawiki.pl?if=gb&amp;res=832323'));
const yinti = await go('#/person/QH-P-000012');
check('胤禵页只有 Wikidata、不假装有 CBDB', yinti.includes('wikidata.org/wiki/Q3375172') && !yinti.includes('cbdbapi'));
const yongzhengEra = await go('#/yongzheng');
check('雍正帝页 Wikidata 是 Q317839', yongzhengEra.includes('wikidata.org/wiki/Q317839') && !yongzhengEra.includes('Q17751'));
const person = await go('#/person/QH-P-000001');
check('人物页渲染（含朝代内容模块）', person.includes('两废太子') || person.includes('分日'));
check('康熙帝页整篇叙事且留台账', person.includes('文书所见') && person.includes('明立太子这条路在这一朝走到了尽头')
  && person.includes('史料说明') && !person.includes('未开') && !person.includes('未拆'));
check('康熙帝页有 Wikidata 对照', person.includes('wikidata.org/wiki/Q17790'));
check('康熙帝页六段合一且保留专题链', ['生平与施政', '御容与器物', '大事与储位', '史料与遗址'].every((title) => person.includes(title))
  && person.includes('#/chapter/kangxi-02') && person.includes('储位立废') && person.includes('#/succession'));
check('帝卷像与物收成横排', person.includes('thumbs-row') && person.includes('全部像与物')
  && person.includes('本朝章目') && !person.includes('表与对照') && !person.includes('era-toc'));
const nurhaci = await go('#/person/QH-P-000051');
check('努尔哈赤帝页有结构且非康熙腔', nurhaci.includes('十三副遗甲') && nurhaci.includes('兼并女真') && !nurhaci.includes('择吉与册立是两道程序'));
const xuantong = await go('#/person/QH-P-000059');
check('宣统帝页有结构', xuantong.includes('载沣以摄政王监国') && xuantong.includes('宣统政纪'));
const qlChron = await go('#/chronicle/qianlong');
check('无条次朝大事记不编年表', qlChron.includes('尚无逐日官书条') && qlChron.includes('#/qianlong'));
check('无条次朝大事记仍给出已写章节', qlChron.includes('#/chapter/qianlong-01') || qlChron.includes('十全'));
const qlEra = await go('#/qianlong');
check('乾隆朝页钉住已打开对照', qlEra.includes('#/lane/QH-L-0033') && qlEra.includes('#/chapter/jiaqing-04') && qlEra.includes('系年不可考者'));
const emperorRouteFailures = [];
const emperorVisualFailures = [];
for (const emperor of homeData.emperors || []) {
  const slug = emperor.eraSlug;
  const era = String(emperor['年号或通称'] || '').split('；')[0];
  const expectedVisuals = (peopleData.portraits || []).filter((row) => row.emperor_id === emperor.emperor_id).length;
  const byEra = await go(`#/${slug}`);
  const eraLayout = el('main').dataset.layout;
  const byPerson = await go(`#/person/${emperor.person_id}`);
  const personLayout = el('main').dataset.layout;
  const visualList = await go(`#/hands?era=${encodeURIComponent(era)}`);
  if (byEra !== byPerson || eraLayout !== 'era' || personLayout !== 'era') emperorRouteFailures.push(slug);
  if ((visualList.match(/#\/image\//g) || []).length !== expectedVisuals || !byEra.includes(`像与物 ${expectedVisuals} 件`)) emperorVisualFailures.push(slug);
}
check('十二帝年号路由与旧人物路由内容及版心一致', emperorRouteFailures.length === 0);
check('十二帝材料计数与各朝像与物清单一致', emperorVisualFailures.length === 0);
const qlUnified = await go('#/qianlong');
check('乾隆合并页显示至少 11 件视觉材料且遗址今况不重复', (qlUnified.match(/#\/image\//g) || []).length >= 11
  && (qlUnified.match(/<h2>遗址今况<\/h2>/g) || []).length === 1);
const questionsPage = await go('#/questions');
check('问题页不再自称导读或黄金问题', questionsPage.includes('此类问题暂无答案') && !questionsPage.includes('从问题进入清史') && !questionsPage.includes('黄金问题'));
check('问题页先放三道拒答', questionsPage.includes('八亿两') && questionsPage.includes('抗旨断发') && questionsPage.includes('九子夺嫡是哪一天'));
check('问题页不把分类做成主筛', !questionsPage.includes('事实查询') && !questionsPage.includes('无证据拒答')
  && !questionsPage.includes('版本冲突') && !questionsPage.includes('关系路径') && !questionsPage.includes('证据边界'));
const heshen = await go('#/lane/QH-L-0032');
check('和珅对照栏', heshen.includes('第五天下狱') && heshen.includes('八亿两'));
check('对照栏先出官书', heshen.includes('官书／档案摘要') && heshen.includes('材料如何记')
  && heshen.indexOf('材料如何记') < heshen.indexOf('通行说法'));
const lanesOut = await go('#/lanes');
check('后宫栏改称制度', lanesOut.includes('后宫制度') && !lanesOut.includes('后宫趣事')
  && lanesOut.includes('官书与传闻'));
check('和珅对照栏挂上拒答', heshen.includes('#/question/QH-GQ-0068') || heshen.includes('八亿两吗'));
const nala = await go('#/lane/QH-L-0033');
check('继皇后对照栏', nala.includes('那拉氏') && nala.includes('不择一'));
const hands = await go('#/hands');
check('像与物页 64 件全部有入口', hands.includes('图像与器物')
  && hands.includes('器物') && hands.includes('便服·行乐·戎装·化身') && hands.includes('历史照片')
  && (hands.match(/#\/image\//g) || []).length === 64 && !hands.includes('黄金问题'));
const qianlongVisuals = await go('#/hands?era=乾隆');
check('乾隆像与物按组显示且不少于 11 件', (qianlongVisuals.match(/#\/image\//g) || []).length >= 11
  && qianlongVisuals.includes('visual-object') && qianlongVisuals.includes('visual-life'));
const szChapter = await go('#/chapter/shunzhi-01');
check('顺治章拆出本纪入关句', szChapter.includes('大軍入關') && szChapter.includes('data-claim="QH-A-SZ-0002"') && /<aside class="read-line"[\s\S]*不能写成皇帝亲征[\s\S]*<\/aside>/.test(szChapter));
const xtChapter = await go('#/chapter/xuantong-01');
check('宣统章拆出逊位句', xtChapter.includes('將統治權公諸全國') && xtChapter.includes('data-claim="QH-A-XT-0001"'));
const refuse = await go('#/question/QH-GQ-0072');
check('阿鲁特拒答', refuse.includes('拒绝作答') || refuse.includes('不可证') || refuse.includes('正史含糊'));
const chapter = await go('#/chapter/kangxi-02');
check('章节插图语法渲染为权利受检 figure', chapter.includes('fig-inline') && chapter.includes('<img'));
check('样板章原文块', chapter.includes('source-quote') && chapter.includes('選擇吉期具奏'));
check('样板章行内主张', /data-claim="QH-A-KX-0\d+"/.test(chapter));
check('样板章目录与上下篇', chapter.includes('chapter-toc') && chapter.includes('chapter-nav') && chapter.includes('上一篇'));
check('章节可分享链接指向站内哈希', chapter.includes('href="#/chapter/kangxi-02"') && chapter.includes('分享本页'));
check('样板章冲突并排', chapter.includes('claim-compare') && chapter.includes('立储日'));
check('样板章原文块', chapter.includes('source-quote'));
check('样板章行内主张', chapter.includes('data-claim="QH-A-KX-0124"') || chapter.includes('data-claim="QH-A-KX-0086"'));
check('样板章目录', chapter.includes('chapter-toc') && chapter.includes('data-scroll'));
check('样板章上下篇', chapter.includes('chapter-nav') && chapter.includes('上一篇') && chapter.includes('下一篇'));
check('样板章依据摘要不倾倒主张卡', chapter.includes('本章可回查的卷') && !chapter.includes('thread-block'));
// 取样改用明确的短章：qianlong-03 放行被吞句子后正文 2031 字，刚好越过 2000 分界，属边界效应。
const shortChapter = await go('#/chapter/xuantong-03');
check('短章使用 reading 单栏且元信息收成一行', el('main').dataset.layout === 'reading'
  && !shortChapter.includes('class="chapter-toc"') && shortChapter.includes('class="chapter-meta-row"')
  && (shortChapter.match(/class="chapter-meta-item/g) || []).length === 2);
// 依据页改两级筛选后，站内旧的 ?unit= 链接必须仍能落到正确的书和卷
const legacyUnit = await go('#/claims?unit=QH-SU-KX-0001');
check('旧的 ?unit= 依据链接仍可用', legacyUnit.includes('圣祖仁皇帝实录') && legacyUnit.includes('卷1'));
check('两废章读这一句', /<aside class="read-line"[\s\S]*不能写成对质全文[\s\S]*<\/aside>/.test(chapter));
const kx01 = await go('#/chapter/kangxi-01');
check('即位章原文块', kx01.includes('source-quote') && kx01.includes('上即皇帝位') && kx01.includes('崩於寢宮'));
check('即位章行内主张', kx01.includes('data-claim="QH-A-KX-0001"') && kx01.includes('data-claim="QH-A-KX-0033"'));
check('即位章目录与怎么读', kx01.includes('chapter-toc') && kx01.includes('data-scroll') && kx01.includes('怎么读这件事'));
check('即位章冲突并排', kx01.includes('claim-compare') && kx01.includes('口谕、遗诏、本纪九'));
check('即位章上下篇', kx01.includes('chapter-nav') && kx01.includes('下一篇'));
check('即位章读这一句', /<aside class="read-line"[\s\S]*不能把「深肖朕躬」写成[\s\S]*<\/aside>/.test(kx01));
check('即位章先讲故事再折材料', kx01.includes('八岁的玄烨即皇帝位') && kx01.includes('本章依据哪些材料') && kx01.includes('已有条目可回查到实录或本纪原文') && !kx01.includes('这不是一条叫'));
const kx01Body = kx01.match(/<div class="md">([\s\S]*?)<section class="chapter-next">/)?.[1] || kx01;
check('即位章看依据改成角标', kx01Body.includes('cite-n') && !/<[^>]*claim-ref[^>]*>依据</.test(kx01Body));
check('即位章记载对读可折叠', kx01.includes('conflict-fold') && kx01.includes('相关记载对读') && !kx01.includes('此处两说并存'));
check('即位章章尾衔接下一篇与延伸阅读', kx01.includes('接着读下去') && kx01.includes('换个角度读') && kx01.includes('chapter-next'));
check('即位章角标贴在引文上', /source-quote[\s\S]*cite-n[\s\S]*<\/blockquote>/.test(kx01Body)
  && !/<p>\s*<(?:button|a)\b[^>]*claim-ref/.test(kx01Body));
const succession = await go('#/succession');
check('储位接到七日', succession.includes('顾命与即位') && succession.includes('口谕令') && succession.includes('满汉遗诏原件'));
const yinzhenEra = await go('#/person/QH-P-000002');
check('雍正帝页有七日储位', yinzhenEra.includes('储位') && yinzhenEra.includes('即皇帝位') && yinzhenEra.includes('七日全链'));
const princesPageHtml = await go('#/princes');
check('皇子页写清玉牒未见', princesPageHtml.includes('玉牒未开') && princesPageHtml.includes('合法核验路径仍不通'));
const testamentQ = await go('#/question/QH-GQ-0084');
check('遗诏原件拒答', testamentQ.includes('拒绝作答') || testamentQ.includes('不可证') || testamentQ.includes('不是原件'));
const yz01 = await go('#/chapter/yongzheng-01');
check('雍正即位章原文块', yz01.includes('source-quote') && yz01.includes('即皇帝位') && yz01.includes('子刻'));
check('雍正即位章行内主张', yz01.includes('data-claim="QH-A-YZ-0039"') && yz01.includes('data-claim="QH-A-YZ-0041"') && yz01.includes('data-claim="QH-A-YZ-0043"'));
check('雍正即位章目录与怎么读', yz01.includes('chapter-toc') && yz01.includes('怎么读这件事'));
check('雍正即位章冲突并排', yz01.includes('claim-compare') && yz01.includes('年羹尧死法') && yz01.includes('本纪己丑与实录子刻'));
check('雍正即位章读这一句', /<aside class="read-line"[\s\S]*永遠禁錮[\s\S]*不能把四十一款[\s\S]*<\/aside>/.test(yz01));
const junjiQuote = yz01.match(/<blockquote class="quote source-quote"><p>([^<]*策勒克[^<]*)/);
check('雍正即位章军机实录不是始设', yz01.includes('data-claim="QH-A-YZ-0044"') && Boolean(junjiQuote) && !/始於此|始于此/.test(junjiQuote[1]));
const yz7Quote = yz01.match(/<blockquote class="quote source-quote"><p>([^<]*密為辦理[^<]*)/);
check('雍正即位章七年军需密办不是军机房', yz01.includes('data-claim="QH-A-YZ-0045"') && yz01.includes('data-claim="QH-A-YZ-0046"') && Boolean(yz7Quote) && !/軍機房|军机房/.test(yz7Quote[1]));
const sevenDays = await go('#/chapter/yongzheng-07');
check('康雍七日链专题形成证据闭环', sevenDays.includes('七日链')
  && sevenDays.includes('data-claim="QH-A-KX-0037"')
  && sevenDays.includes('data-claim="QH-A-YZ-0039"')
  && sevenDays.includes('claim-compare')
  && sevenDays.includes('继承记录为什么不能合成一条')
  && sevenDays.includes('本章可回查的卷'));
check('路由更新页面标题', document.title === '从十三日崩逝到二十日即位 · 清史读本');
const heshenChapter = await go('#/chapter/jiaqing-04');
check('嘉庆和珅案形成分日证据闭环', heshenChapter.includes('五日下狱')
  && heshenChapter.includes('十五日后赐死')
  && heshenChapter.includes('data-claim="QH-A-JQ-0008"')
  && heshenChapter.includes('claim-compare')
  && heshenChapter.includes('本章可回查的卷'));
check('和珅章读这一句', /<aside class="read-line"[\s\S]*擁戴自居[\s\S]*<\/aside>/.test(heshenChapter)
  && !/<aside class="read-line"[^>]*>[\s\S]*賜自尽[\s\S]*<\/aside>/.test(heshenChapter));
check('混合证据等级章节不再带研究稿警示', !heshenChapter.includes('研究草稿｜本章尚未完成全文史料核对'));
const heshenPerson = await go('#/person/QH-P-000124');
check('和珅人物页接入主张', heshenPerson.includes('钮祜禄·和珅')
  && heshenPerson.includes('QH-A-JQ-0006'));
check('和珅人物页先讲分日', heshenPerson.includes('第五天下狱') && heshenPerson.includes('#/chapter/jiaqing-04'));
const searchHeshen = await go('#/search?q=和珅');
check('全站检索命中和珅', searchHeshen.includes('QH-P-000124') && searchHeshen.includes('<mark>'));
check('搜索先展示可读文章与命中片段', searchHeshen.includes('class="search-story"')
  && searchHeshen.indexOf('先读文章') < searchHeshen.indexOf('<h2>人物'));
const bodySearch = await go('#/search?q=如意');
check('正文关键词能找到文章', bodySearch.includes('#/chapter/jiaqing-04') && bodySearch.includes('<mark>如意</mark>'));
const searchCn = await go('#/search?q=胤禛');
check('检索高亮 mark 生效', searchCn.includes('<mark>'));
const searchPy = await go('#/search?q=yinzhen');
check('拼音检索 yinzhen 命中胤禛', searchPy.includes('QH-P-000002'));
const searchJuemilu = await go('#/search?q=觉迷录');
check('检索觉迷录落到专论章', searchJuemilu.includes('#/chapter/yongzheng-04'));
const works = await go('#/works');
check('文献专栏按帝分组且有专论入口', works.includes('大义觉迷录') && works.includes('专论') && works.includes('乾隆'));
check('文献可读性徽章', works.includes('可查原文条目') || works.includes('已关联逐条依据'));
check('起居注不假装可读原文', works.includes('馆藏入口') && works.includes('馆藏／咨询入口'));
const juemilu = await go('#/chapter/yongzheng-04');
check('长章保留 chapter 版心与目录侧栏', el('main').dataset.layout === 'chapter'
  && juemilu.includes('class="chapter-toc"') && (juemilu.match(/data-scroll=/g) || []).length >= 15);
check('大义觉迷录专论章渲染', juemilu.includes('自辩') && juemilu.includes('缴书'));
check('觉迷录短引与实录条次入章', juemilu.includes('data-claim="QH-A-YZ-0047"')
  && juemilu.includes('data-claim="QH-A-YZ-0049"')
  && juemilu.includes('data-claim="QH-A-YZ-0050"')
  && juemilu.includes('data-claim="QH-A-YZ-0051"')
  && juemilu.includes('data-claim="QH-A-QL-0007"')
  && juemilu.includes('data-claim="QH-A-QL-0008"'));
check('觉迷录改诏传闻不是曾静原供也不是已证伪', juemilu.includes('耿六格')
  && juemilu.includes('將「十」字改為「于」字')
  && juemilu.includes('不是曾静原供')
  && /不得写[「"]已证伪/.test(juemilu));
check('觉迷录停讲不是销毁完成', juemilu.includes('停其講解') && juemilu.includes('候朕再降諭旨') && juemilu.includes('不得改写成销毁完成'));
check('曾静死法不写乾隆元年', juemilu.includes('凌遲處死') && juemilu.includes('雍正十三年十二月') && juemilu.includes('不是乾隆元年十二月'));
check('觉迷录读这一句', /<aside class="read-line"[\s\S]*將「十」字改為「于」字[\s\S]*不能写成已经证伪[\s\S]*<\/aside>/.test(juemilu)
  || /<aside class="read-line"[\s\S]*將「十」字改為「于」字[\s\S]*不能写成已证伪[\s\S]*<\/aside>/.test(juemilu));
check('未完成全章核对的章节不再带警示', !juemilu.includes('研究草稿｜本章尚未完成全文史料核对'));
check('纯原文闭环章节不误标为研究草稿', !kx01.includes('研究草稿｜本章尚未完成全文史料核对'));
const closedShortChapters = ['kangxi-13', 'yongzheng-08', 'nurhaci-04', 'huangtaiji-04', 'daoguang-04', 'kangxi-11', 'yongzheng-02', 'kangxi-06', 'kangxi-07', 'kangxi-10', 'kangxi-12', 'nurhaci-01', 'huangtaiji-01', 'shunzhi-01', 'qianlong-01', 'qianlong-06', 'jiaqing-01', 'daoguang-01', 'xianfeng-01', 'tongzhi-01', 'guangxu-01', 'xuantong-01', 'daoguang-02', 'jiaqing-02', 'qianlong-02', 'xianfeng-02', 'guangxu-02', 'kangxi-05', 'yongzheng-03', 'nurhaci-02', 'shunzhi-02', 'tongzhi-02', 'huangtaiji-02', 'xuantong-02', 'kangxi-04', 'kangxi-08', 'yongzheng-05', 'qianlong-04', 'qianlong-05', 'nurhaci-03', 'huangtaiji-03', 'shunzhi-03', 'jiaqing-03', 'daoguang-03', 'xianfeng-03', 'tongzhi-03', 'guangxu-03', 'xuantong-03', 'yongzheng-01', 'kangxi-09', 'yongzheng-06'];
const closedShortStillDraft = closedShortChapters.filter((slug) => {
  const file = path.join(siteDir, 'data', 'chapter', `${slug}.json`);
  const page = JSON.parse(fs.readFileSync(file, 'utf8')).bodyHtml || '';
  return page.includes('研究草稿｜本章尚未完成全文史料核对');
});
check('范围已钉的短解读章不误标为研究草稿', closedShortStillDraft.length === 0);
const goldenFailures = [];
const goldenRows = reignData.questions || [];
for (const row of goldenRows) {
  const out = await go(`#/question/${row.question_id}`);
  const expected = row.evidenceGap ? row.explanation : row.answer;
  if (!out.includes(escExpected(row.question)) || !out.includes(escExpected(expected))
    || (row.links || []).some((link) => !out.includes(escExpected(link.label)))) {
    goldenFailures.push(row.question_id);
  }
}
if (goldenFailures.length) console.error(`黄金问题渲染失败: ${goldenFailures.join(', ')}`);
check(`黄金问题渲染全量通过（${goldenRows.length} 道）`, goldenFailures.length === 0);
// 黄金问题数量不再设下限门禁：增删数据都不该让测试变红。
// 原先的「≥ 基线」断言已随质量基线一并取消，这里只报告实际条数。
console.log(`INFO: 黄金问题 ${goldenRows.length} 道（不设下限门禁）`);
const adoptedClaim = await go('#/claim/QH-A-KX-0014');
// 2026-09-11 改：主张页不再输出内部核对状态。
// 旧断言要求页面出现「已核对」——但「已核对」只是 row['状态']=='已采纳' 的映射，
// 而「已采纳」的机器含义仅是「AI 自审通过」，读者会误读为人工核验过。该断言已随列删减一并撤销。
check('主张页回到引文且不暴露内部状态或编辑身份',
  adoptedClaim.includes('class="quote"')
  && !adoptedClaim.includes('已核对') && !adoptedClaim.includes('待进一步核对')
  && !adoptedClaim.includes('zonglinxie-cyber') && !adoptedClaim.includes('2026-08-15'));
check('主张页有返回面包屑', adoptedClaim.includes('#/claims') && adoptedClaim.includes('class="crumb"'));
const claimCf = await go('#/claim/QH-A-KX-0070');
check('主张页同组异说并排区块', claimCf.includes('同组异说') && claimCf.includes('QH-CF-KX-INVEST-DAY'));
const imagePage = await go('#/image/QH-V-E04');
check('图像详情页主图带灯箱属性', imagePage.includes('data-lightbox'));
const sitePage = await go('#/site/QH-ST-0013');
check('今地页主图带灯箱属性', sitePage.includes('data-lightbox'));
const sitesOut = await go('#/sites');
check('今地卡带灯箱属性', sitesOut.includes('data-lightbox="畅春园"') || sitesOut.includes('data-lightbox="畅春园'));
const unknown = await go('#/no-such-page');
check('未知路由 404', unknown.includes('未找到该页面'));

const dataList = await go('#/data');
check('旧数据页改指向仓库 CSV', dataList.includes('原始数据表') && dataList.includes('tree/main/data'));

// 灯箱高清变体：Wikimedia 缩略图应取最大档
const { largestVariant, mediaSrcset, noOrphan, attachOrphanCites } = await import(path.join(siteDir, 'templates.js'));
// 本地媒体 URL 现在带内容指纹 `?v=xxxxxxxx` 做缓存失效，比对落盘文件前先去查询串。
const bareUrl = (u) => String(u).split('?')[0];
const localMedia = fs.readdirSync(path.join(siteDir, 'media')).filter(name => /\.(jpe?g|png|webp)$/i.test(name));
const brokenCandidates = localMedia.flatMap(name => mediaSrcset(`media/${name}`).srcset.split(',')
  .map(item => item.trim().split(/\s+/)[0]).filter(Boolean))
  .filter(file => !fs.existsSync(path.join(siteDir, bareUrl(file))));
check('所有本地响应式图片候选均存在', brokenCandidates.length === 0);
check('本地媒体 URL 均带内容指纹', localMedia.every(name => /\?v=[a-f0-9]{8}$/.test(mediaSrcset(`media/${name}`).src)));
check('缺少高清原图时灯箱使用现有档位', bareUrl(largestVariant('media/QH-ST-0039.webp')) === 'media/QH-ST-0039-960.webp');
check('单独成段的角标贴回引文', attachOrphanCites(
  '<blockquote class="quote source-quote"><p>上即皇帝位。</p></blockquote><p><a class="link claim-ref" href="#/claim/QH-A-KX-0001"><sup class="cite-n">1</sup></a></p>',
).includes('上即皇帝位。 <a class="link claim-ref"') && attachOrphanCites(
  '<blockquote class="quote source-quote"><p>上即皇帝位。</p></blockquote><p><a class="link claim-ref" href="#/claim/QH-A-KX-0001"><sup class="cite-n">1</sup></a></p>',
).includes('</blockquote>') && !attachOrphanCites(
  '<blockquote class="quote source-quote"><p>上即皇帝位。</p></blockquote><p><a class="link claim-ref" href="#/claim/QH-A-KX-0001"><sup class="cite-n">1</sup></a></p>',
).includes('<p><a class="link claim-ref"'));
const thumb = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.jpg/960px-Example.jpg';
check('largestVariant 取最大档', largestVariant(thumb).includes('/1280px-Example.jpg'));
check('largestVariant 本地图取 1280 档', bareUrl(largestVariant('media/QH-V-E04.webp')) === 'media/QH-V-E04@2x.webp');
const e04entries = ((html.match(/srcset="([^"]*QH-V-E04[^"]*)"/) || [])[1] || '').split(',').map(s => s.trim()).filter(Boolean);
check('本地图 srcset 含 480/960/1280', e04entries.length === 3
  && ['480', '960', '1280'].every(width => e04entries.some(entry => entry.endsWith(`${width}w`)))
  && e04entries.every(entry => /^media\/QH-V-E04(?:-(?:480|960)|@2x)?\.webp\?v=[a-f0-9]{8} \d+w$/.test(entry)));
// 回归：今地 site_id 含数字后缀（QH-ST-0001），mediaSrcset 不得把它误判成宽度档而截成 QH-ST.jpg
check('今地数字 ID 图不被 mediaSrcset 截断', bareUrl(largestVariant('media/QH-ST-0001.webp')) === 'media/QH-ST-0001@2x.webp');
check('今地图不用占位 QH-ST.jpg', !html.includes('media/QH-ST.jpg'));
check('句末不孤字', noOrphan('以官书原文为底本，逐条整理。').includes('class="nobr">整理。'));
const homeOut = await go('#/');
check('首页导语句末不孤字', /class="nobr">[^<]{2,}<\/span>/.test(homeOut));

check('不再生成静态分享页', !fs.existsSync(path.join(siteDir, 'chapter', 'kangxi-01', 'index.html'))
  && !fs.existsSync(path.join(siteDir, 'person', 'QH-P-000001', 'index.html')));
check('不再生成 sitemap', !fs.existsSync(path.join(siteDir, 'sitemap.xml')));
const robotsTxt = fs.readFileSync(path.join(siteDir, 'robots.txt'), 'utf8');
check('robots.txt 不投递 sitemap 但允许抓取', !robotsTxt.includes('sitemap')
  && robotsTxt.includes('Allow: /'));
check('首页 noindex 且保留 canonical', html.includes('rel="canonical"')
  && html.includes('<meta name="robots" content="noindex,follow">'));
check('进站即恢复手选主题', html.includes("localStorage.getItem('theme')")
  && html.indexOf("localStorage.getItem('theme')") < html.indexOf('styles.css'));
check('首页帝像位于首屏之后，全部懒加载', html.includes('loading="lazy"')
  && !html.includes('fetchpriority="high"'));
check('依据抽屉与灯箱使用 dialog', html.includes('<dialog id="drawer"')
  && html.includes('<dialog id="lightbox"')
  && !html.includes('id="scrim"'));
const peopleTable = await go('#/people');
check('人物表首列是真实链接', peopleTable.includes('<a href="#/person/')
  && !peopleTable.includes('role="link"'));
const princesTable = await go('#/princes');
check('皇子表首列是真实链接', princesTable.includes('<a href="#/person/')
  && !princesTable.includes('role="link"'));

// 公开投影门禁：编辑待办、人员身份与 QA 字段不得进入任何可下载 JSON 或静态正文。
const publicJsonFiles = ['home.json', 'suggest.json', 'people.json', `${dynastyConfig.chunk}.json`, 'catalog.json', 'search.json'];
check('d-qing 章目不含正文', (reignData.chapters || []).every((row) => !row.bodyHtml));
const chapterJsonDir = path.join(siteDir, 'data', 'chapter');
const chapterJsonMissing = (reignData.chapters || []).filter((row) => (
  !fs.existsSync(path.join(chapterJsonDir, `${row.slug}.json`))
)).map((row) => row.slug);
check(`章体按 slug 懒加载 ${reignData.chapters?.length || 0} 篇`, chapterJsonMissing.length === 0);
const homePayload = JSON.parse(fs.readFileSync(path.join(siteDir, 'data', 'home.json'), 'utf8'));
const homeSuggest = JSON.parse(fs.readFileSync(path.join(siteDir, 'data', 'suggest.json'), 'utf8')).suggest || [];
check('搜索建议与更新日志不进入首页首包', !Object.hasOwn(homePayload, 'suggest') && !Object.hasOwn(homePayload, 'release'));
check('建议框按需数据含章、今地、书名', ['person', 'chapter', 'site', 'work'].every((type) => homeSuggest.some((row) => row.type === type)));
const juemiluWork = (reignData.works || []).find((row) => String(row['文献名称'] || '').includes('大义觉迷录'));
check('文献命中可落到专论章', Boolean(juemiluWork?.dedicated_chapter) && juemiluWork.dedicated_chapter === 'yongzheng-04');
const privateKeys = new Set([
  '选择理由', '核心待核主张', '责任人', '责任角色', '审核备注', '复核人', '复核日期', '录入人', '编辑备注',
  '获取方式', '待核问题', '备注', '期望行为', '绑定ID', '拒答说明', 'markdown', 'file', 'sourceIndex', 'tasks', '下一动作',
]);
const leakedKeyPaths = [];
function findPrivateKeys(value, at = '') {
  if (Array.isArray(value)) return value.forEach((item, i) => findPrivateKeys(item, `${at}[${i}]`));
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (privateKeys.has(key)) leakedKeyPaths.push(`${at}.${key}`);
    findPrivateKeys(child, `${at}.${key}`);
  }
}
const publicJsonText = publicJsonFiles.map((name) => {
  const text = fs.readFileSync(path.join(siteDir, 'data', name), 'utf8');
  if (name !== 'search.json') findPrivateKeys(JSON.parse(text), name);
  return text;
}).join('\n');
const privateCopy = /选择理由|核心待核主张|待用户抽查|进入站点前|人工复核|M1\s*AI回查|待H1抽查|\bE1\b|\bIDX-\d+\b|任务队列|上次完成位置|下一步动作|下一步（|待续|第一版产出|项目北极星指标|技术架构组|结构化入库|接入站点|大事记组|task-queue|研究卡|和数据页的关系|全表可接入|尚未建档|见解读组|实录卷次回查状态|原子主张|证据抽屉|深挖版|康雍深挖|历法库|卷级索引|逐次钉入|能钉到|实录卷\d+钉到|不拆原子主张|不拆条|待核权|主张未单拆|打开原文后再建来源单元|尚未钉|分层登记|人物档把他登记为|不假装已回|尚无专章|逐款查档/;
check('公开 JSON 不含内部字段', leakedKeyPaths.length === 0);
const chapterJsonText = (reignData.chapters || []).map((row) => {
  const file = path.join(chapterJsonDir, `${row.slug}.json`);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}).join('\n');
check('公开 JSON 与章节正文不含编辑待办文案', !privateCopy.test(`${publicJsonText}\n${html}\n${chapterJsonText}`));
const publicChapterBodies = (reignData.chapters || []).map((row) => {
  const file = path.join(chapterJsonDir, `${row.slug}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).bodyHtml || '' : '';
}).join('\n');
const publicChapterText = publicChapterBodies.replace(/<[^>]+>/g, ' ');
check('章节正文不显示内部编号', !/\bQH-(?:W|CF|P|L|ST|CH|SU)-[A-Z0-9-]+\b/.test(publicChapterText));
check('章节正文不显示原始路由或骨架标题', !/<code>#\//.test(publicChapterBodies)
  && !/<h2 id="骨架">骨架<\/h2>/.test(publicChapterBodies));
check('Markdown 分隔线渲染为 hr', !/<p>---<\/p>/.test(publicChapterBodies)
  && !(reignData.overviews || []).some((row) => /<p>---<\/p>/.test(row.bodyHtml || '')));
check('读一句标题不跳过 h3', !/<aside class="read-line"[^>]*>\s*<h4>/.test(publicChapterBodies));
const publicHome = JSON.parse(fs.readFileSync(path.join(siteDir, 'data', 'home.json'), 'utf8'));
const siteReaderText = (publicHome.sites || []).map((row) => [row['当时'], row['今日'], row['今地说明'], row['卡片钩子']].join(' ')).join('\n');
check('今地文案不显示内部地点编号', !/\bQH-ST-\d+\b/.test(siteReaderText));
const overviewReaderText = (reignData.overviews || []).map((row) => `${row.lede} ${row.bodyHtml.replace(/<[^>]+>/g, ' ')}`).join('\n');
check('全朝专题不显示证据等级码或编辑术语', !/\bE1\b|原子主张|证据抽屉|深挖版|康雍深挖|骨架年份/.test(overviewReaderText));

// qing-content.js 里的三条轴（转轴 / 决策归属 / 军饷与兵源）是手写常量，不跟数据走。
// 内容可以手写，但它指向的章节必须真实存在，否则会悄悄变成死链。
const contentSrc = fs.readFileSync(path.join(siteDir, 'qing-content.js'), 'utf8');
const knownSlugs = new Set((reignData.chapters || []).map((row) => row.slug));
const referencedSlugs = [...contentSrc.matchAll(/#\/chapter\/([\w-]+)/g)].map((m) => m[1]);
const deadSlugs = [...new Set(referencedSlugs)].filter((slug) => !knownSlugs.has(slug));
check(`手写常量里的章节链接都存在${deadSlugs.length ? `（死链：${deadSlugs.join('、')}）` : ''}`, deadSlugs.length === 0);

// 主题展：手写常量只负责编排，引用的条目必须真实存在，否则展览里会出现空槽。
const contentModule = await import(path.join(siteDir, 'qing-content.js'));
const knownVisuals = new Set([...(peopleData.portraits || []), ...(peopleData.personPortraits || [])]
  .map((row) => row.visual_id));

// 构建后正文门禁：不能只验证手写常量，所有公开 href 都必须能落到已登记实体。
const routeIds = {
  chapter: new Set((reignData.chapters || []).map((row) => row.slug)),
  person: new Set([...(peopleData.people || []).map((row) => row.person_id), ...(homeData.emperors || []).map((row) => row.person_id)]),
  site: new Set((homeData.sites || []).map((row) => row.site_id)),
  image: knownVisuals,
  lane: new Set((reignData.lanes || []).map((row) => row.lane_id)),
};
const publicBodies = [
  ...(reignData.chapters || []).map((row) => {
    const file = path.join(chapterJsonDir, `${row.slug}.json`);
    return [row.slug, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).bodyHtml || '' : ''];
  }),
  ...(reignData.overviews || []).map((row) => [`overview/${row.slug}`, row.bodyHtml || '']),
];
const deadBodyRoutes = [];
for (const [owner, body] of publicBodies) {
  for (const match of body.matchAll(/href="#\/(chapter|person|site|image|lane)\/([^"?]+)(?:\?[^"#]*)?"/g)) {
    if (!routeIds[match[1]]?.has(match[2])) deadBodyRoutes.push(`${owner} → ${match[1]}/${match[2]}`);
  }
}
check(`公开正文站内链接都有目标${deadBodyRoutes.length ? `（${deadBodyRoutes.slice(0, 8).join('；')}）` : ''}`, deadBodyRoutes.length === 0);
const knownEvents = new Set((reignData.heirChain || []).map((row) => row.event_id));
const exhibitions = contentModule.EXHIBITIONS || [];
const missingVisuals = [];
const missingEvents = [];
for (const exhibition of exhibitions) {
  for (const section of exhibition.sections || []) {
    for (const item of section.items || []) {
      if (item.visual && !knownVisuals.has(item.visual)) missingVisuals.push(`${exhibition.slug}/${item.visual}`);
      if (item.event && !knownEvents.has(item.event)) missingEvents.push(`${exhibition.slug}/${item.event}`);
    }
  }
}
check(`主题展引用的图像都存在${missingVisuals.length ? `（缺：${missingVisuals.join('、')}）` : ''}`, missingVisuals.length === 0);
check(`主题展引用的储位事件都存在${missingEvents.length ? `（缺：${missingEvents.join('、')}）` : ''}`, missingEvents.length === 0);
check('主题展没有空节', exhibitions.length > 0
  && exhibitions.every((row) => (row.sections || []).length > 0
    && row.sections.every((section) => (section.items || []).length > 0)));

for (const exhibition of exhibitions) {
  const out = await go(`#/exhibit/${exhibition.slug}`);
  const count = exhibition.sections.reduce((sum, section) => sum + section.items.length, 0);
  check(`主题展「${exhibition.title}」渲染出全部 ${count} 件`,
    (out.match(/class="exhibit-item/g) || []).length === count && out.includes(exhibition.title));
}
const exhibitsIndex = await go('#/exhibits');
check('主题展目录列出全部展览', exhibitions.every((row) => exhibitsIndex.includes(`#/exhibit/${row.slug}`)));
check('材料页列出全部主题展', exhibitions.every((row) => materialOut.includes(`#/exhibit/${row.slug}`)));


// 朝服像「御容」读法：只挂在朝服像上，不能糊到别的图类上。
const noteKey = contentModule.COURT_PORTRAIT_NOTE.title;
const courtOut = await go('#/image/QH-V-E04');
check('朝服像页挂出「御容」读法', courtOut.includes(noteKey) && courtOut.includes('不能据面貌判断年龄'));
const photoOut = await go('#/image/QH-V-E11B');
check('非朝服像不挂「御容」读法', !photoOut.includes(noteKey));
const handsOut = await go('#/hands');
check('像与物页有主题展入口', handsOut.includes('href="#/exhibits"'));
check('像与物页挂出「御容」读法', handsOut.includes(noteKey));

// 图证互指：区域必须带说明，绑了主张的要能点进主张页。
const regionRows = peopleData.regions || [];
check('图证区域带说明文字', regionRows.length > 0 && regionRows.every((row) => String(row.note || '').trim()));
check('图证区域坐标都在 0–1 内', regionRows.every((row) => ['x', 'y', 'w', 'h']
  .every((key) => Number(row[key]) >= 0 && Number(row[key]) <= 1)
  && Number(row.x) + Number(row.w) <= 1.0001 && Number(row.y) + Number(row.h) <= 1.0001));
const gxEdict = await go('#/image/QH-V-E10C');
check('载湉入承大统诏挂到主张', gxEdict.includes('#/claim/QH-A-GX-0001') && gxEdict.includes('用宝'));
const gxColor = await go('#/image/QH-V-E11C');
check('光绪朝朱批折画出朱批区与正文区', gxColor.includes('朱批区') && gxColor.includes('奏折正文'));
const unembeddable = await go('#/image/QH-V-E05G');
check('不能嵌图的条目也列出区域与主张', unembeddable.includes('区域与主张') && unembeddable.includes('#/claim/QH-A-YZ-0165'));

// 地图底图：折线数据必须在，且投影不能把南北画反（雅克萨在北、虎门在南）。
const basemap = await import(path.join(siteDir, 'basemap.js'));
check('地图底图三层都有折线', basemap.COAST.length > 0 && basemap.RIVER.length > 0 && basemap.PROVINCE.length > 0);
const mapOut = await go('#/sites');
const pinY = (id) => {
  const m = mapOut.match(new RegExp(`data-pin-id="${id}"[\\s\\S]{0,200}?class="pin-pulse" cx="([\\d.]+)" cy="([\\d.]+)"`));
  return m ? Number(m[2]) : null;
};
const yakesa = pinY('QH-ST-0009');
const humen = pinY('QH-ST-0011');
check('地图投影南北不反', yakesa !== null && humen !== null && yakesa < humen);
check('地图画出底图与图例', mapOut.includes('class="map-coast"') && mapOut.includes('class="map-river"')
  && mapOut.includes('class="map-province"') && mapOut.includes('现代') && mapOut.includes('不是清代疆域'));

// 被埋的页面：overview 这 5 篇曾经全站零入口。至少要能从一个页面走到。
const overviewIndex = await go('#/overview');
check('脉络目录列出全部专题', (reignData.overviews || [])
  .every((row) => overviewIndex.includes(`#/overview/${row.slug}`)));
const pathOut = await go('#/path');
check('全朝专题有站内入口', pathOut.includes('href="#/overview"') || materialOut.includes('href="#/overview"'));

// 存疑标注系统已移除，不该再有残留
check('无存疑标注残留', !html.includes('标存疑') && !html.includes('note-dialog') && !html.includes('#/review'));

check('不再派生 SQLite', !fs.existsSync(path.join(siteDir, 'data', 'qing.sqlite'))
  && !fs.existsSync(path.join(siteDir, 'data', 'raw.json')));

const zggList = await go('#/ziguangge');
check('紫光阁名册能从乾隆专题进入', (await go('#/qianlong')).includes('#/ziguangge') && zggList.includes('傅恒') && zggList.includes('海兰察') && zggList.includes('西域前五十'));
check('紫光阁核心百人与后绘骨架都在', zggList.includes('西域后五十') && zggList.includes('金川前五十') && zggList.includes('台湾前二十') && zggList.includes('廓尔喀前十五'));
const zggPerson = await go('#/ziguangge/fuheng');
check('紫光阁单人深链', zggPerson.includes('傅恒') && zggPerson.includes('酇侯不战') && zggPerson.includes('位列紫光阁的理由'));
check('紫光阁生成图免责标注在名册或说明里', zggList.includes('据史料描述生成，非原像') || zggPerson.includes('据史料描述生成，非原像'));

const studio = await go('#/studio');
check('讲解台以史料选题为入口', studio.includes('曾纪泽') && studio.includes('逆书') && studio.includes('七百金'));
const hostStudio = await go('#/studio/treaty-paper?session=render-fixture');
check('讲解页提供原文、个人笔记与续查任务', (hostStudio.includes('主播提示') || hostStudio.includes('这一段讲稿')) && hostStudio.includes('連日所畫格皆不可用') && hostStudio.includes('复制继续查证任务') && hostStudio.includes('我的补充'));

// 验收「三套讲解包的全文在界面中可读，不只是写在仓库里」：开场、逐段讲稿、问答、估算口径必须出现在主播页面。
{
  const { LIVE_TOPICS } = await import(pathToFileURL(path.join(siteDir, 'live-content.js')).href);
  const packed = LIVE_TOPICS.filter((topic) => topic.pack);
  check('完整讲解包不少于三组', packed.length >= 3);
  for (const topic of packed) {
    const page = await go(`#/studio/${topic.slug}?session=render-pack`);
    const firstPara = topic.pack.segments?.[0]?.paras?.[0] || '';
    check(`${topic.slug} 讲解包全文在界面可读`, page.includes(topic.pack.opening.text.slice(0, 18))
      && firstPara.length > 0 && page.includes(firstPara.slice(0, 18))
      && page.includes(topic.pack.qa[0].q.slice(0, 12))
      && page.includes('设计估算，未做真人计时'));
    check(`${topic.slug} 时长口径不写「实测」`, !page.includes('实测'));
  }
}
const audienceStudio = await go('#/screen/treaty-paper?session=render-fixture');
check('观众页不生成主播提示、讲稿或笔记框', audienceStudio.includes('观众画面') && !audienceStudio.includes('主播提示') && !audienceStudio.includes('这一段讲稿') && !audienceStudio.includes('textarea') && el('main').dataset.layout === 'full');
check('观众展示页有 H1', /<h1\b/.test(audienceStudio));

const searchData = JSON.parse(fs.readFileSync(path.join(siteDir, 'data', 'search.json'), 'utf8'));
const searchEntries = searchData.entries || [];
const duplicateSearchKeys = searchEntries.map((row) => `${row.type}:${row.id}`)
  .filter((key, index, all) => all.indexOf(key) !== index);
const knownPersonIds = new Set([...(peopleData.people || []).map((row) => row.person_id), ...(homeData.emperors || []).map((row) => row.person_id)]);
const mistypedPeople = searchEntries.filter((row) => row.type === 'person' && !knownPersonIds.has(row.id));
check(`搜索索引类型正确${mistypedPeople.length ? `（误标 ${mistypedPeople.length} 条）` : ''}`, mistypedPeople.length === 0);
check(`搜索索引不重复${duplicateSearchKeys.length ? `（重复 ${duplicateSearchKeys.length} 条）` : ''}`, duplicateSearchKeys.length === 0);

const worksOut = await go('#/works');
const workIds = [...worksOut.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
check('文献页没有重复 id', workIds.length === new Set(workIds).size);
const conflictClaim = (reignData.claims || []).find((row) => row.calendar?.status === 'conflict');
if (conflictClaim) {
  const conflictOut = await go(`#/claim/${conflictClaim['Assertion ID']}`);
  const rawDate = conflictClaim['公历下界'];
  check('历法冲突主张不展示精确公历', conflictOut.includes('日期换算异常')
    && conflictOut.includes('公历换算待核')
    && (!rawDate || !conflictOut.includes(`>${escExpected(rawDate)}<`)));
}

console.log(failed ? `渲染测试 ${failed} 项失败` : '渲染测试全部通过');
process.exit(failed ? 1 : 0);
