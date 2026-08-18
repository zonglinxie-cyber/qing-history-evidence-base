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
  check(`无专题页的年号路由优雅降级 #/${unregistered}`, out.includes('已经写下的') || out.includes('现有章节'));
}

const homeHtmlOut = await go('#/');
check('首页现有可读入口', homeHtmlOut.includes('康熙这一段') && homeHtmlOut.includes('两废太子'));
check('首页已打开对照入口', homeHtmlOut.includes('已经对上日子的几处') && homeHtmlOut.includes('#/chapter/jiaqing-04') && homeHtmlOut.includes('#/lane/QH-L-0033'));
check('首页真迹入口', homeHtmlOut.includes('纸上的字') && homeHtmlOut.includes('#/hands'));
check('首页不叠六期评传入口', !homeHtmlOut.includes('由浅入深读全朝') && !homeHtmlOut.includes('#/overview/periods'));
check('首页不写结构化证据仪表', !homeHtmlOut.includes('尚无结构化证据'));
check('首页醒目标明个人研究稿', homeHtmlOut.includes('AI 辅助个人研究库') && homeHtmlOut.includes('并非专家审定本'));
const descriptionTags = html.match(/<meta\s+name="description"\s+content="[^"]*">/g) || [];
check('首页只有一条研究稿 description', descriptionTags.length === 1
  && descriptionTags[0].includes('AI 辅助个人研究稿'));
check('首页转轴入口', homeHtmlOut.includes('先看这几处转轴') && homeHtmlOut.includes('#/path'));
const headerNav = html.match(/<nav class="nav" aria-label="主导航">[\s\S]*?<\/nav>/)?.[0] || '';
check('顶栏是读者词', headerNav.includes('对照') && headerNav.includes('今地')
  && headerNav.includes('文献') && headerNav.includes('十二帝')
  && !headerNav.includes('#/path') && !headerNav.includes('#/hands')
  && !headerNav.includes('#/claims'));
check('帝卡先给可读章', homeHtmlOut.includes('#/chapter/kangxi-02')
  && homeHtmlOut.includes('两废太子')
  && homeHtmlOut.includes('card-reads')
  && homeHtmlOut.includes('card-vita-line'));
const pathPage = await go('#/path');
check('转轴年页', pathPage.includes('这几处转过轴') && pathPage.includes('1912') && pathPage.includes('密储落地'));
check('内禅转轴接到和珅分日章', pathPage.includes('#/chapter/jiaqing-04'));
const periods = await go('#/overview/periods');
check('全朝专题显示史料核对警示', periods.includes('研究草稿｜本章尚未完成全文史料核对'));
const spine = await go('#/spine/power');
check('继承主轴', spine.includes('谁坐龙椅') && spine.includes('明立太子'));
const money = await go('#/spine/money');
check('饷和兵主轴', money.includes('税从哪来') && money.includes('耗羡'));
const chronicleBare = await go('#/chronicle');
check('大事记无年号不默默进康熙', chronicleBare.includes('还没有这份大事记') && !chronicleBare.includes('日子对得上的'));
const chronicle = await go('#/chronicle/kangxi');
check('康熙大事记', chronicle.includes('日子对得上的') && chronicle.includes('两说并存') && chronicle.includes('咸安宫'));
const how = await go('#/how');
check('怎么读页', how.includes('日子对得上') && how.includes('咸安宫'));
const yinreng = await go('#/person/QH-P-000004');
check('胤礽页先讲解后收依据', yinreng.includes('两岁立为太子') && yinreng.includes('依据'));
const person = await go('#/person/QH-P-000001');
check('人物页渲染（含朝代内容模块）', person.includes('两废太子') || person.includes('分日'));
check('康熙帝页拆栏', person.includes('见诸文书的习惯') && person.includes('当时要解决什么')
  && person.includes('史料说明') && !person.includes('未开') && !person.includes('未拆'));
check('康熙帝页先给出可读章', person.includes('这一朝可读') && person.includes('还想往下读')
  && person.includes('#/chapter/kangxi-02'));
const nurhaci = await go('#/person/QH-P-000051');
check('努尔哈赤帝页有结构且非康熙腔', nurhaci.includes('当时要解决什么') && nurhaci.includes('吞并女真各部') && !nurhaci.includes('择吉不是册立'));
const xuantong = await go('#/person/QH-P-000059');
check('宣统帝页有结构', xuantong.includes('三岁不能算决策') && xuantong.includes('宣统政纪'));
const qlChron = await go('#/chronicle/qianlong');
check('无条次朝大事记不编年表', qlChron.includes('还没有逐日的官书条') && qlChron.includes('#/qianlong'));
check('无条次朝大事记仍给出已写章节', qlChron.includes('#/chapter/qianlong-01') || qlChron.includes('十全'));
const qlEra = await go('#/qianlong');
check('乾隆朝页钉住已打开对照', qlEra.includes('#/lane/QH-L-0033') && qlEra.includes('#/chapter/jiaqing-04') && qlEra.includes('已经写下的'));
const questionsPage = await go('#/questions');
check('问题页不再自称导读或黄金问题', questionsPage.includes('这类问题，现在停在这里') && !questionsPage.includes('从问题进入清史') && !questionsPage.includes('黄金问题'));
check('问题页先放三道拒答', questionsPage.includes('八亿两') && questionsPage.includes('抗旨断发') && questionsPage.includes('九子夺嫡是哪一天'));
const heshen = await go('#/lane/QH-L-0032');
check('和珅对照栏', heshen.includes('第五天下狱') && heshen.includes('八亿两'));
check('和珅对照栏挂上拒答', heshen.includes('#/question/QH-GQ-0068') || heshen.includes('八亿两吗'));
const nala = await go('#/lane/QH-L-0033');
check('继皇后对照栏', nala.includes('那拉氏') && nala.includes('不择一'));
const hands = await go('#/hands');
check('真迹手稿页', hands.includes('纸上的字，才是这一笔') && hands.includes('雍正朱批') && hands.includes('入承大统诏') && !hands.includes('黄金问题'));
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
check('章节提供可分享静态链接', chapter.includes('chapter/kangxi-02/'));
check('样板章冲突并排', chapter.includes('claim-compare') && chapter.includes('立储日'));
check('样板章原文块', chapter.includes('source-quote'));
check('样板章行内主张', chapter.includes('data-claim="QH-A-KX-0124"') || chapter.includes('data-claim="QH-A-KX-0086"'));
check('样板章目录', chapter.includes('chapter-toc') && chapter.includes('data-scroll'));
check('样板章上下篇', chapter.includes('chapter-nav') && chapter.includes('上一篇') && chapter.includes('下一篇'));
check('样板章依据摘要不倾倒主张卡', chapter.includes('本章可回查的卷') && !chapter.includes('thread-block'));
check('两废章读这一句', /<aside class="read-line"[\s\S]*不能写成对质全文[\s\S]*<\/aside>/.test(chapter));
const kx01 = await go('#/chapter/kangxi-01');
check('即位章原文块', kx01.includes('source-quote') && kx01.includes('上即皇帝位') && kx01.includes('崩於寢宮'));
check('即位章行内主张', kx01.includes('data-claim="QH-A-KX-0001"') && kx01.includes('data-claim="QH-A-KX-0033"'));
check('即位章目录与怎么读', kx01.includes('chapter-toc') && kx01.includes('data-scroll') && kx01.includes('怎么读这件事'));
check('即位章冲突并排', kx01.includes('claim-compare') && kx01.includes('口谕、遗诏、本纪九'));
check('即位章上下篇', kx01.includes('chapter-nav') && kx01.includes('下一篇'));
check('即位章读这一句', /<aside class="read-line"[\s\S]*不能把「深肖朕躬」写成[\s\S]*<\/aside>/.test(kx01));
const yz01 = await go('#/chapter/yongzheng-01');
check('雍正即位章原文块', yz01.includes('source-quote') && yz01.includes('即皇帝位') && yz01.includes('子刻'));
check('雍正即位章行内主张', yz01.includes('data-claim="QH-A-YZ-0039"') && yz01.includes('data-claim="QH-A-YZ-0041"') && yz01.includes('data-claim="QH-A-YZ-0043"'));
check('雍正即位章目录与怎么读', yz01.includes('chapter-toc') && yz01.includes('怎么读这件事'));
check('雍正即位章冲突并排', yz01.includes('claim-compare') && yz01.includes('年羹尧死法') && yz01.includes('本纪己丑与实录子刻'));
check('雍正即位章读这一句', /<aside class="read-line"[\s\S]*永遠禁錮[\s\S]*不能把四十一款[\s\S]*<\/aside>/.test(yz01));
const junjiQuote = yz01.match(/<blockquote class="quote source-quote"><p>([^<]*策勒克[^<]*)<\/p><\/blockquote>/);
check('雍正即位章军机实录不是始设', yz01.includes('data-claim="QH-A-YZ-0044"') && Boolean(junjiQuote) && !/始於此|始于此/.test(junjiQuote[1]));
const yz7Quote = yz01.match(/<blockquote class="quote source-quote"><p>([^<]*密為辦理[^<]*)<\/p><\/blockquote>/);
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
check('混合证据等级章节仍显示史料核对警示', heshenChapter.includes('研究草稿｜本章尚未完成全文史料核对'));
const heshenPerson = await go('#/person/QH-P-000124');
check('和珅人物页接入主张', heshenPerson.includes('钮祜禄·和珅')
  && heshenPerson.includes('QH-A-JQ-0006'));
check('和珅人物页先讲分日', heshenPerson.includes('第五天下狱') && heshenPerson.includes('#/chapter/jiaqing-04'));
const searchHeshen = await go('#/search?q=和珅');
check('全站检索命中和珅', searchHeshen.includes('QH-P-000124') && searchHeshen.includes('<mark>'));
const searchCn = await go('#/search?q=胤禛');
check('检索高亮 mark 生效', searchCn.includes('<mark>'));
const searchPy = await go('#/search?q=yinzhen');
check('拼音检索 yinzhen 命中胤禛', searchPy.includes('QH-P-000002'));
const searchJuemilu = await go('#/search?q=觉迷录');
check('检索觉迷录落到专论章', searchJuemilu.includes('#/chapter/yongzheng-04'));
const works = await go('#/works');
check('文献专栏按帝分组且有专论入口', works.includes('大义觉迷录') && works.includes('读专论') && works.includes('乾隆'));
check('文献可读性徽章', works.includes('可查原文条目') || works.includes('已关联逐条依据'));
check('起居注不假装可读原文', works.includes('馆藏入口') && works.includes('馆藏／咨询入口'));
const juemilu = await go('#/chapter/yongzheng-04');
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
check('未完成全章核对的章节显示警示', juemilu.includes('研究草稿｜本章尚未完成全文史料核对'));
check('纯原文闭环章节不误标为研究草稿', !kx01.includes('研究草稿｜本章尚未完成全文史料核对'));
const goldenFailures = [];
for (const row of reignData.questions || []) {
  const out = await go(`#/question/${row.question_id}`);
  const expected = row.evidenceGap ? row.explanation : row.answer;
  if (!out.includes(escExpected(row.question)) || !out.includes(escExpected(expected))
    || (row.links || []).some((link) => !out.includes(escExpected(link.label)))) {
    goldenFailures.push(row.question_id);
  }
}
if (goldenFailures.length) console.error(`黄金问题渲染失败: ${goldenFailures.join(', ')}`);
check(`黄金问题全量验收 ${reignData.questions?.length || 0} 道`, goldenFailures.length === 0);
const adoptedClaim = await go('#/claim/QH-A-KX-0014');
check('主张页公开读者核对状态但不暴露编辑身份', adoptedClaim.includes('已核对')
  && !adoptedClaim.includes('zonglinxie-cyber') && !adoptedClaim.includes('2026-08-15'));
const claimCf = await go('#/claim/QH-A-KX-0070');
check('主张页同组异说并排区块', claimCf.includes('同组异说') && claimCf.includes('QH-CF-KX-INVEST-DAY'));
const images = await go('#/images');
check('画像总览带灯箱属性', images.includes('data-lightbox'));
const imagePage = await go('#/image/QH-V-E04');
check('图像详情页主图带灯箱属性', imagePage.includes('data-lightbox'));
const sitePage = await go('#/site/QH-ST-0013');
check('今地页主图带灯箱属性', sitePage.includes('data-lightbox'));
check('今地卡带灯箱属性', homeHtmlOut.includes('data-lightbox="畅春园"') || homeHtmlOut.includes('data-lightbox="畅春园'));
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
  const indexable = Boolean(chapterRow.indexable);
  if (indexable) indexableChapters.push(chapterRow);
  else noindexChapters.push(chapterRow);
  if (!page.includes(`<meta name="robots" content="${indexable ? 'index,follow' : 'noindex,follow'}">`)
    || !page.includes('<link rel="canonical"') || !page.includes('application/ld+json')) {
    staticMissing.push(`${chapterRow.slug}:meta`);
  }
  if (!indexable && !page.includes('研究草稿｜本章尚未完成全文史料核对')) {
    staticMissing.push(`${chapterRow.slug}:draft-banner`);
  }
  if (!indexable && !page.includes('研究草稿（未完成整章史料核对）：')) {
    staticMissing.push(`${chapterRow.slug}:draft-description`);
  }
}
const staticEvidence = fs.readFileSync(path.join(siteDir, 'chapter', 'yongzheng-07', 'index.html'), 'utf8');
const sitemap = fs.readFileSync(path.join(siteDir, 'sitemap.xml'), 'utf8');
check(`静态章节全量生成 ${reignData.chapters?.length || 0} 篇`, staticMissing.length === 0);
check('静态证据页保留可回主张链接', staticEvidence.includes('href="./#/claim/QH-A-KX-0037"')
  && !staticEvidence.includes('<button type="button" class="link claim-ref"'));
const staticBareHash = (reignData.chapters || []).filter((row) => {
  const page = fs.readFileSync(path.join(siteDir, 'chapter', row.slug, 'index.html'), 'utf8');
  return /href="#\//.test(page);
}).map((row) => row.slug);
check('静态章站内路由带 ./#/', staticBareHash.length === 0);
const kx01Static = fs.readFileSync(path.join(siteDir, 'chapter', 'kangxi-01', 'index.html'), 'utf8');
check('康熙即位章静态导语不把崩地写成畅春园', !kx01Static.includes('崩逝那天人在畅春园') && kx01Static.includes('寝宫'));
const yz04Static = fs.readFileSync(path.join(siteDir, 'chapter', 'yongzheng-04', 'index.html'), 'utf8');
check('觉迷录静态章内联冲突引文', yz04Static.includes('claim-compare') && yz04Static.includes('將「十」字改為「于」字') && !yz04Static.includes('在交互版查看相关异说'));
check('觉迷录静态交叉引用保留标题', yz04Static.includes('传位十四子与改诏') && !yz04Static.includes('>相关章节<'));
check('静态章顶栏是读者词', yz04Static.includes('对照') && yz04Static.includes('今地')
  && !yz04Static.includes('href="./#/path"') && !yz04Static.includes('href="./#/hands"'));
check(`sitemap 只收证据闭环章节 ${indexableChapters.length} 篇`,
  indexableChapters.every((row) => sitemap.includes(`/chapter/${row.slug}/`))
  && noindexChapters.every((row) => !sitemap.includes(`/chapter/${row.slug}/`)));
check('robots.txt 指向 sitemap', fs.readFileSync(path.join(siteDir, 'robots.txt'), 'utf8').includes('/sitemap.xml'));
check('首页带 canonical 与结构化数据', html.includes('rel="canonical"')
  && html.includes('"@type":"WebSite"') && html.includes('property="og:url"'));

// 公开投影门禁：编辑待办、人员身份与 QA 字段不得进入任何可下载 JSON 或静态正文。
const publicJsonFiles = ['home.json', 'people.json', `${dynastyConfig.chunk}.json`, 'catalog.json', 'search.json'];
check('d-qing 章目不含正文', (reignData.chapters || []).every((row) => !row.bodyHtml));
const chapterJsonDir = path.join(siteDir, 'data', 'chapter');
const chapterJsonMissing = (reignData.chapters || []).filter((row) => (
  !fs.existsSync(path.join(chapterJsonDir, `${row.slug}.json`))
)).map((row) => row.slug);
check(`章体按 slug 懒加载 ${reignData.chapters?.length || 0} 篇`, chapterJsonMissing.length === 0);
const homeSuggest = JSON.parse(fs.readFileSync(path.join(siteDir, 'data', 'home.json'), 'utf8')).suggest || [];
check('建议框含章、今地、书名', ['person', 'chapter', 'site', 'work'].every((type) => homeSuggest.some((row) => row.type === type)));
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
const staticChapterText = (reignData.chapters || []).map((row) => (
  fs.readFileSync(path.join(siteDir, 'chapter', row.slug, 'index.html'), 'utf8')
)).join('\n');
const privateCopy = /选择理由|核心待核主张|待用户抽查|进入站点前|人工复核|M1\s*AI回查|待H1抽查|\bE1\b|\bIDX-\d+\b|任务队列|上次完成位置|下一步动作|下一步（|待续|第一版产出|项目北极星指标|技术架构组|结构化入库|接入站点|大事记组|task-queue|研究卡|和数据页的关系|全表可接入|尚未建档|见解读组|实录卷次回查状态|原子主张|证据抽屉|深挖版|康雍深挖|历法库|卷级索引|逐次钉入|能钉到|实录卷\d+钉到|不拆原子主张|不拆条|待核权|主张未单拆|打开原文后再建来源单元|尚未钉|分层登记|人物档把他登记为|不假装已回|本库|本轮|未开|未拆|尚无专章|逐款查档/;
check('公开 JSON 不含内部字段', leakedKeyPaths.length === 0);
const chapterJsonText = (reignData.chapters || []).map((row) => {
  const file = path.join(chapterJsonDir, `${row.slug}.json`);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}).join('\n');
check('公开 JSON 与静态章节不含编辑待办文案', !privateCopy.test(`${publicJsonText}\n${html}\n${staticChapterText}\n${chapterJsonText}`));
const publicChapterBodies = (reignData.chapters || []).map((row) => {
  const file = path.join(chapterJsonDir, `${row.slug}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).bodyHtml || '' : '';
}).join('\n');
const publicChapterText = publicChapterBodies.replace(/<[^>]+>/g, ' ');
check('章节正文不显示内部编号', !/\bQH-(?:W|CF|P|L|ST|CH|SU)-[A-Z0-9-]+\b/.test(publicChapterText));
check('章节正文不显示原始路由或骨架标题', !/<code>#\//.test(publicChapterBodies)
  && !/<h2 id="骨架">骨架<\/h2>/.test(publicChapterBodies));
const publicHome = JSON.parse(fs.readFileSync(path.join(siteDir, 'data', 'home.json'), 'utf8'));
const siteReaderText = (publicHome.sites || []).map((row) => [row['当时'], row['今日'], row['今地说明'], row['卡片钩子']].join(' ')).join('\n');
check('今地文案不显示内部地点编号', !/\bQH-ST-\d+\b/.test(siteReaderText));
const overviewReaderText = (reignData.overviews || []).map((row) => `${row.lede} ${row.bodyHtml.replace(/<[^>]+>/g, ' ')}`).join('\n');
check('全朝专题不显示证据等级码或编辑术语', !/\bE1\b|原子主张|证据抽屉|深挖版|康雍深挖|骨架年份/.test(overviewReaderText));

console.log(failed ? `渲染测试 ${failed} 项失败` : '渲染测试全部通过');
process.exit(failed ? 1 : 0);
