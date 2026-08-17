import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCsv } from './lib/csv.mjs';
import { CSV_FILES, DATA_MANIFEST, KIND_TO_FIELD, activeDynasties } from './lib/schema.mjs';
import { buildIndex } from '../site/search.js';
import { homeHtml, isChapterIndexable, researchDraftBanner } from '../site/templates.js';
import { pinyin } from 'pinyin-pro';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const dataDir = path.join(root, 'data');
const siteDir = path.join(root, 'site');
const dataOutDir = path.join(siteDir, 'data');
const contentDir = path.join(root, 'content');
const siteBaseUrl = new URL(process.env.SITE_URL || 'https://zonglinxie-cyber.github.io/qing-history-evidence-base/');
if (!siteBaseUrl.pathname.endsWith('/')) siteBaseUrl.pathname += '/';

function load(file) {
  return loadCsv(path.join(dataDir, file), {
    name: file,
    required: CSV_FILES[file]?.required,
  });
}

function localPreview(id, remoteUrl) {
  const remote = String(remoteUrl || '').trim();
  // 优先使用本地缓存；格式按真实内容保存，避免把 PNG 伪装成 .jpg。
  if (id) {
    for (const ext of ['webp', 'png', 'jpg', 'jpeg']) {
      const localRel = `media/${id}.${ext}`;
      if (fs.existsSync(path.join(siteDir, localRel))) return localRel;
    }
  }
  return remote;
}

function slimPortrait(portrait) {
  if (!portrait) return null;
  return {
    visual_id: portrait.visual_id,
    emperor_id: portrait.emperor_id,
    对象标题: portrait['对象标题'],
    预览文件: localPreview(portrait.visual_id, portrait['预览文件']),
    权利颜色: portrait['权利颜色'],
    可公开展示: portrait['可公开展示'],
    展示角色: portrait['展示角色'],
  };
}

function pick(row, fields) {
  return Object.fromEntries(fields
    .filter((field) => Object.hasOwn(row || {}, field))
    .map((field) => [field, row[field]]));
}

// 公共站点只发布读者层。CSV 中的编辑状态、责任人和待办记录不得随 JSON 打包。
const EDITORIAL_COPY = /本库|本表|本轮|未开|尚未开|未拆|待核|待查|待回|待补|待用户|抽查|审核|复核人|录入人|责任人|工作流|任务队列|尚无专章|条次未|索引未|仅登记|H1|E1|S\s*二手/;

function readerCopy(value) {
  return String(value || '').trim()
    .replace(/入口见\s*IDX-\d+/g, '可从文献目录查看访问入口')
    .replace(/\bIDX-\d+\b/g, '相关目录条目')
    .replace(/当前项目深挖的核心史料/g, '理解该朝的重要史料')
    .replace(/项目尚未逐件打开，不拆主张/g, '目前尚无逐件原文定位')
    .replace(/十二帝研究卡已写/g, '现有资料记载')
    .replace(/人物档沿用\s*QH-P-[A-Z0-9-]+\s*，不另编号。?/g, '')
    .replace(/人物档常用/g, '本页采用')
    .replace(/人物档见/g, '另见人物条目：')
    .replace(/见人物档/g, '另见人物条目')
    .replace(/不自动合成一个人/g, '不能仅凭同姓视为同一人')
    .replace(/额驸同名不合并/g, '同名额驸不能因此视为同一人')
    .replace(/朱天保尚未建档。?/g, '')
    .replace(/和数据页的关系/g, '延伸阅读')
    .replace(/全表可接入/g, '完整表格见')
    .replace(/分日事件链见站点/g, '分日事件链见')
    .replace(/主张见/g, '相关依据见')
    .replace(/人物见/g, '相关人物见')
    .replace(/见解读组，不入正文/g, '此处不作定论')
    .replace(/康雍样本把她登记为/g, '现有资料将她视为')
    .replace(/这是本页后宫栏最有用的一条/g, '关键在于分清三种母职')
    .replace(/本页已收一道装开页为其他真迹，许可公版。?/g, '现存道装册页可供对照。')
    .replace(/默认头像仍用朝服像。?/g, '')
    .replace(/野史可以登记，但不能覆盖已列原文的实录文本/g, '野史传说不能覆盖现有《实录》文本')
    .replace(/本页未见到可定位的\s*A1\/A2\s*材料/g, '目前没有可定位的一手材料')
    .replace(/A1\/A2\s*材料/g, '一手材料')
    .replace(/本栏目前只列出冲突/g, '现有材料存在冲突')
    .replace(/本页尚未为孝庄建立人物档。?/g, '')
    .replace(/没有人物档、没有打开的原始诏旨之前，目前只列出传说，不建婚姻关系边/g, '在缺少可直接回查的原始诏旨时，只能把它列为传说，不能认定婚姻关系')
    .replace(/本页只给入口和制度说明/g, '这里仅说明访问条件与材料层级')
    .replace(/本页把一史馆原档默认黄色\/红色：只存档号、短引文、外链/g, '一史馆原档宜只保存档号、短引文和外链，未经授权不复制图像')
    .replace(/本页康熙即位、崩逝、初废拘执、颁废、复立条都链到该站的具体条次/g, '这里所列康熙即位、崩逝、初废拘执、颁废与复立均可回到该站的具体条目')
    .replace(/另有人物档/g, '两人有不同记录')
    .replace(/本页禁止用/g, '不宜用')
    .replace(/先登记入口/g, '现阶段仅提供访问入口')
    .replace(/目前只列出入口/g, '现阶段仅提供访问入口')
    .replace(/原文原文/g, '原文')
    .replace(/已确认卷次锚点/g, '可直接回查的卷次')
    .replace(/尚待更多材料确认项/g, '待定位事件')
    .replace(/卷次状态/g, '原文位置')
    .replace(/卷\s*(\d+)\s*待条次复核/g, '卷 $1 的具体条目待确认')
    .replace(/约卷\s*([^,，；;<]+)(?:前后)?，尚待更多材料确认/g, '可能在卷 $1 附近，具体位置待确认')
    .replace(/研究卡列为骨架，未回原文/g, '现有页面尚未提供相应原文定位')
    .replace(/研究卡列为骨架/g, '现有资料列为重要事件')
    .replace(/研究卡记/g, '现有资料记')
    .replace(/研究卡里的另一组骨架/g, '另一组重要议题')
    .replace(/研究卡/g, '现有资料')
    .replace(/康雍深挖卷|康雍深挖/g, '康雍专题')
    .replace(/深挖版统治年表/g, '专题统治年表')
    .replace(/深挖核心/g, '重点议题')
    .replace(/原子主张/g, '逐条结论')
    .replace(/证据抽屉/g, '依据说明')
    .replace(/卷页回链/g, '原文定位')
    .replace(/冲突组/g, '同组异说')
    .replace(/\bE1\b/g, '原文可回查')
    .replace(/原文可回查《清史稿》层/g, '《清史稿》可回查')
    .replace(/骨架年份已回查/g, '关键年份已核对')
    .replace(/已回查/g, '已核对')
    .replace(/这段的骨架/g, '这一时期的关键事件')
    .replace(/能钉到卷、日、条次/g, '能够定位到卷、日期和条目')
    .replace(/实录卷(\d+)钉到/g, '《实录》卷$1记于')
    .replace(/仍待逐次钉入实录/g, '仍需逐次核对《实录》原文')
    .replace(/钉入实录/g, '核对《实录》原文')
    .replace(/钉到/g, '定位到')
    .replace(/未回原文/g, '现有页面尚未提供原文定位')
    .replace(/未回实录条次/g, '现有页面尚未提供《实录》条目定位')
    .replace(/主张未单拆，见该来源单元。/g, '相关记载见所列原文。')
    .replace(/打开原文后再建来源单元。/g, '目前没有足以支持结论的可回查原文。')
    .replace(/本页均为索引，不拆原子主张|本章只做登记和入口，不拆原子主张|本页目前只列出书名与版本层次，不拆条/g, '本页介绍文献范围与版本差异；具体引文请从文献链接查看')
    .replace(/只做登记和入口/g, '只介绍文献范围与阅读入口')
    .replace(/不拆原子主张|不拆条/g, '暂不逐条列出依据')
    .replace(/公历只作对照，换算依通行年表，待独立历法库复核。/g, '公历日期暂采用通行年表换算。')
    .replace(/公历日期采用通行年表对照，仍须历法库复核。/g, '公历日期暂采用通行年表换算。')
    .replace(/待独立历法库复核|仍须历法库复核/g, '换算尚待核对')
    .replace(/独立历法库|历法库/g, '历法资料')
    .replace(/本库的做法/g, '本页的处理方式')
    .replace(/本库/g, '本页')
    .replace(/本页尚未为孝庄建立人物档。?/g, '')
    .replace(/没有人物档、没有打开的原始诏旨之前，(?:目前)?只列出传说，不建婚姻关系边/g, '在缺少可直接回查的原始诏旨时，只能把它列为传说，不能认定婚姻关系')
    .replace(/本页禁止用/g, '不宜用')
    .replace(/本表/g, '此表')
    .replace(/本轮/g, '目前')
    .replace(/尚未打开|未打开|还没打开|原文未开|尚未开|未开/g, '尚无可直接回查的原文')
    .replace(/尚未回查|未回查|待回核|待回查/g, '尚待更多材料核对')
    .replace(/尚未逐条比对|未逐条比对/g, '尚待逐条比对')
    .replace(/尚未拆成主张|未拆成主张|尚未拆出主张|未拆出主张/g, '尚未列出逐条依据')
    .replace(/尚未拆入|未拆入|尚未拆|未拆/g, '尚未列出逐条依据')
    .replace(/待核实|待核/g, '尚待更多材料确认')
    .replace(/待查/g, '尚待查证')
    .replace(/只登记/g, '目前只列出')
    .replace(/已登记/g, '已列出')
    .replace(/尚未登记/g, '尚未列出')
    .replace(/登记书名/g, '列出书名')
    .replace(/人物档把他登记为/g, '现有材料将他列为')
    .replace(/分层登记/g, '应分层理解')
    .replace(/实录条次尚未钉|条次尚未钉/g, '尚无可直接回查的实录条目')
    .replace(/对应条次尚未钉/g, '对应实录条目尚无可直接回查的定位')
    .replace(/(?:本页)?尚未钉到/g, '目前尚无可直接回查的')
    .replace(/不假装已回条次/g, '因此不据此作定论')
    .replace(/本页尚未完成这条链/g, '现有材料还不足以呈现完整决策链')
    .replace(/已打开/g, '已列原文')
    .replace(/已钉[^,，。；;]*/g, '已列出相关原文条目')
    .replace(/其余事件仍为索引/g, '其余事件仅作概览')
    // 最后一层只处理前述替换后才形成的读者文案，防止「本库→本页」留下编辑口吻。
    .replace(/本页只收前两层的尚待更多材料确认线索/g, '现有材料仅支持前两层的线索')
    .replace(/这是本页后宫栏最有用的一条：有趣，是因为制度细，不是因为秘闻。三种母职必须分栏/g, '关键在于分清生母、抚养者与嫡母三种身份，而不是把它们写成宫廷秘闻')
    .replace(/本页已收一道装开页为其他真迹，许可公版。?/g, '现存道装册页可供对照。')
    .replace(/野史可以登记，但不能覆盖已列原文的实录文本/g, '野史传说不能覆盖现有《实录》文本')
    .replace(/本栏目前只列出冲突/g, '现有材料存在冲突')
    .replace(/没有人物档、没有打开的原始诏旨之前，(?:目前)?只列出传说，不建婚姻关系边/g, '在缺少可直接回查的原始诏旨时，只能把它列为传说，不能认定婚姻关系')
    .replace(/本页只给入口和制度说明/g, '这里仅说明访问入口与材料层级')
    .replace(/本页家庭字段仍是待取证/g, '其中亲属关系尚待玉牒等材料核对')
    .replace(/本页把一史馆原档默认黄色\/红色：只存档号、短引文、外链/g, '一史馆原档宜只保存档号、短引文和外链，未经授权不复制图像')
    .replace(/本页康熙即位、崩逝、初废拘执、颁废、复立条都链到该站的具体条次/g, '这里所列康熙即位、崩逝、初废拘执、颁废与复立均可回到该站的具体条目')
    .replace(/本页人物档已把她登记为弘历生母/g, '现有材料将她列为弘历生母')
    .replace(/玉牒原文尚无可直接回查的原文/g, '玉牒原文尚未列出可直接回查的位置')
    .replace(/本页尚未逐件核对，目前只列出入口/g, '现阶段仅提供访问入口，尚未完成逐件核对')
    .replace(/本页尚无可直接回查的原文后妃传与玉牒对应段落/g, '目前尚未列出《后妃传》与玉牒对应段落的原文位置')
    .replace(/本页尚无可直接回查的原文咸丰朝后妃传对应段落/g, '目前尚未列出咸丰朝《后妃传》对应段落的原文位置')
    .replace(/晚清笔记说法，降级登记/g, '这一说法仅见于晚清笔记，证据层级较低')
    .replace(/出生传说按来源登记/g, '出生传说应注明来源')
    .replace(/人物档与后妃传把/g, '人物资料与《后妃传》将')
    .replace(/在人物档为/g, '人物资料记为')
    .replace(/人物档用名/g, '本页用名')
    .replace(/可以登记来源/g, '可以注明来源')
    .replace(/本页未见到/g, '目前没有见到')
    .replace(/本页尚未定位到/g, '目前尚未定位到')
    .replace(/本页尚无可直接回查的原文/g, '目前尚无可直接回查的原文')
    .replace(/本页目前只打开/g, '目前可直接回查的材料仅有')
    .replace(/本页站在清史角度登记/g, '此处从清史角度表述')
    .replace(/本页均为索引/g, '此处仅作索引')
    .replace(/本页未登记/g, '此处未列出')
    .replace(/本页未对勘/g, '尚未对勘')
    .replace(/本页未核查/g, '此处尚未核查')
    .replace(/本页不静默改字/g, '此处保留异文')
    .replace(/本页不取一个总数/g, '此处不采用单一总数')
    .replace(/本页不作裁判/g, '此处不作裁断')
    .replace(/开国骨架/g, '开国主线')
    .replace(/军事骨架/g, '军事脉络')
    .replace(/战争骨架/g, '战争概况')
    .replace(/制度骨架/g, '制度体系')
    .replace(/尚未逐条拆解|未逐条拆解/g, '尚未逐条核对')
    .replace(/待回原文/g, '尚待核对原文')
    .replace(/未逐条回原文/g, '尚未逐条核对原文')
    .replace(/未回《/g, '尚未核对《')
    .replace(/未回案档/g, '尚未核对案档')
    .replace(/未回原件/g, '尚未核对原件')
    .replace(/逐条依据条/g, '逐条依据')
    .replace(/目前目前/g, '目前');
}

function readerProse(value) {
  const text = readerCopy(value);
  if (!text) return '';
  return (text.match(/[^!！?？。；;]+[!！?？。；;]?/g) || [text])
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !EDITORIAL_COPY.test(sentence))
    .join('');
}

function readerMetadata(value) {
  return String(value || '')
    .replace(/待核权/g, '商业使用条件尚未确认，请以来源机构最新权利说明为准')
    .replace(/待核/g, '有待考证')
    .replace(/待查/g, '有待查证');
}

function publicPortraitProse(value) {
  return (String(value || '').match(/[^!！?？。；;]+[!！?？。；;]?/g) || [])
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !/\bQH-V-|(?:默认展示|默认头像|网格默认|识别系统|识别用头像|只作为其他真迹进入)/.test(sentence))
    .map((sentence) => readerMetadata(readerCopy(sentence)))
    .join('');
}

function publicPortrait(row) {
  const out = pick(row, [
    'visual_id', 'emperor_id', '对象标题', '图像性质', '制作年代或摄影日期', '作者或摄影者',
    '文件页', '预览文件', '文件页标示许可', '权利颜色', '可公开展示', '展示角色',
    '关键标注', '画面解析', '释文', '卡片钩子', '馆藏登录号',
  ]);
  out['预览文件'] = localPreview(row.visual_id, row['预览文件']);
  out['制作年代或摄影日期'] = readerMetadata(out['制作年代或摄影日期']);
  out['作者或摄影者'] = readerMetadata(out['作者或摄影者']);
  out['关键标注'] = readerMetadata(out['关键标注']);
  out['画面解析'] = publicPortraitProse(out['画面解析']);
  out['释文'] = publicPortraitProse(out['释文']);
  out['卡片钩子'] = readerMetadata(readerCopy(out['卡片钩子']));
  return out;
}

function publicClaim(row) {
  return {
    ...pick(row, [
      'Assertion ID', '主体 ID', '谓词/关系', '客体 ID 或值', '原始时间表达', '公历下界', '公历上界',
      '确定性', '来源实体 ID', '卷页/档号/图像定位', '支持引文', '证据立场', '证据直接性', '证据强度', '冲突组 ID',
    ]),
    '公开状态': row['状态'] === '已采纳' ? '已核对' : '待进一步核对',
  };
}

function publicEvidence(value) {
  const code = String(value || '').trim()[0];
  return ({ E: '已列原文', C: '存在异说', S: '参考线索', U: '尚不确定' })[code] || '';
}

function publicAvailability(value) {
  return ({
    L0: '馆藏入口', L1: '可查目录', L2: '可查原文条目', L3: '已关联逐条依据',
  })[String(value || '').trim()] || '馆藏入口';
}

function searchEntry(type, id, hay, extra = {}) {
  return { type, id, hay, ...extra };
}

// 拼音（无声调、去空格）并入检索 hay，支持 yinzhen → 胤禛 这类查询
function py(text) {
  try {
    return pinyin(String(text || ''), { toneType: 'none', nonZh: 'none' }).replace(/\s+/g, '');
  } catch {
    return '';
  }
}

function countBy(rows, field) {
  const out = {};
  for (const row of rows) {
    const val = row[field] || '';
    out[val] = (out[val] || 0) + 1;
  }
  return out;
}

function writeJson(name, payload) {
  const file = path.join(dataOutDir, name);
  const json = `${JSON.stringify(payload)}\n`;
  fs.writeFileSync(file, json);
  return { name, bytes: json.length };
}

function escHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[ch]));
}

function headingSlug(raw, used) {
  const plain = String(raw).replace(/<[^>]+>/g, '').trim();
  let base = plain.replace(/[：:]/g, '-').replace(/\s+/g, '-').replace(/[「」『』《》]/g, '');
  if (!base) base = 'section';
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

function inlineMd(text) {
  let out = escHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const safe = /^(https?:\/\/|#\/)/.test(href) ? href : '#';
    const extra = safe.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
    return `<a class="link" href="${escHtml(safe)}"${extra}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\{\{claim:([A-Za-z0-9-]+)\}\}/g, (_, id) => (
    `<button type="button" class="link claim-ref" data-claim="${escHtml(id)}">看依据</button>`
  ));
  return out;
}

const MD_BLOCK = /^(#{1,3} |\- |\d+\. |\||>|\{\{fig:|\{\{conflict:)/;

function mdToHtml(src, fig) {
  const text = String(src || '').replace(/\r\n/g, '\n').replace(/^# .+\n+/, '');
  const lines = text.split('\n');
  const html = [];
  const usedIds = new Set();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    // 内部复核信息不进阅读正文：状态行与「待用户抽查」清单只在研究稿与 CSV 里保留
    if (/^状态：/.test(line.trim())) {
      i += 1;
      continue;
    }
    if (/^## 待用户抽查/.test(line.trim())) {
      i += 1;
      while (i < lines.length && !/^## /.test(lines[i])) i += 1;
      continue;
    }
    // 插图语法：整行 {{fig:QH-V-E01}} 或 {{fig:QH-V-E01|自定义图注}}，权利检查在构建期完成
    const figMatch = line.trim().match(/^\{\{fig:([A-Za-z0-9-]+)(?:\|([^}]*))?\}\}$/);
    if (figMatch) {
      html.push(fig ? fig(figMatch[1], (figMatch[2] || '').trim()) : '');
      i += 1;
      continue;
    }
    const conflictMatch = line.trim().match(/^\{\{conflict:([A-Za-z0-9-]+)(?:\|([^}]*))?\}\}$/);
    if (conflictMatch) {
      const id = conflictMatch[1];
      const label = (conflictMatch[2] || '').trim();
      html.push(`<div class="claim-compare conflict-embed" data-conflict="${escHtml(id)}"${label ? ` data-label="${escHtml(label)}"` : ''}></div>`);
      i += 1;
      continue;
    }
    if (line.startsWith('>')) {
      const quotes = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quotes.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      html.push(`<blockquote class="quote source-quote"><p>${inlineMd(quotes.join(' '))}</p></blockquote>`);
      continue;
    }
    if (line.startsWith('## ')) {
      const title = line.slice(3);
      const id = headingSlug(title, usedIds);
      html.push(`<h2 id="${escHtml(id)}">${inlineMd(title)}</h2>`);
      i += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      const title = line.slice(4);
      const id = headingSlug(title, usedIds);
      html.push(`<h3 id="${escHtml(id)}">${inlineMd(title)}</h3>`);
      i += 1;
      continue;
    }
    if (line.startsWith('#### ')) {
      const title = line.slice(5);
      const id = headingSlug(title, usedIds);
      const body = [];
      i += 1;
      let sawField = false;
      while (i < lines.length && !/^#{1,4} /.test(lines[i]) && !lines[i].startsWith('>') && !lines[i].startsWith('{{')) {
        if (!lines[i].trim()) {
          i += 1;
          continue;
        }
        const field = lines[i].match(/^\*\*(原文|今译|当时|今天还读|不能写成)\*\*\s*(.*)$/);
        if (field) {
          sawField = true;
          body.push(`<p class="read-field" data-field="${escHtml(field[1])}"><strong>${escHtml(field[1])}</strong>　${inlineMd(field[2])}</p>`);
          i += 1;
          continue;
        }
        if (sawField) break;
        body.push(`<p>${inlineMd(lines[i])}</p>`);
        i += 1;
      }
      html.push(`<aside class="read-line" id="${escHtml(id)}"><h4>${inlineMd(title)}</h4>${body.join('')}</aside>`);
      continue;
    }
    if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(`<li>${inlineMd(lines[i].slice(2))}</li>`);
        i += 1;
      }
      html.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li>${inlineMd(lines[i].replace(/^\d+\. /, ''))}</li>`);
        i += 1;
      }
      html.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        const cells = lines[i].split('|').slice(1, -1).map((cell) => cell.trim());
        if (!/^[-: ]+$/.test(cells.join(''))) rows.push(cells);
        i += 1;
      }
      if (rows.length) {
        const [head, ...body] = rows;
        html.push(`<div class="table-wrap"><table><thead><tr>${head.map((cell) => `<th>${inlineMd(cell)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inlineMd(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      }
      continue;
    }
    const para = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !MD_BLOCK.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    const paraText = para.join(' ');
    const paraHtml = `<p>${inlineMd(paraText)}</p>`;
    html.push(paraText.startsWith('范围：')
      ? `<details class="evidence-drawer scope"><summary>本章范围</summary>${paraHtml}</details>`
      : paraHtml);
  }
  return wrapDrawers(html.join('\n'));
}

// 只保留读者能理解的史料说明；“尚未解决”是编辑待办，不进公共页。
function wrapDrawers(html) {
  let out = html.replace(/<h2 id="[^"]+">尚未解决<\/h2>[\s\S]*?(?=<h2|$)/g, '');
  out = out.replace(/<h2 id="[^"]*">待用户抽查<\/h2>[\s\S]*?(?=<h2|$)/g, '');
  out = out.replace(/<h2 id="[^"]*">(?:待回查清单|尚待更多材料核对清单)<\/h2>([\s\S]*?)(?=<h2|$)/g,
    (_, body) => `<details class="evidence-drawer"><summary>史料说明</summary>${body}</details>`);
  out = out.replace(/<h2 id="[^"]*">[一二三四五六七八九十]+、实录卷次回查状态<\/h2>([\s\S]*?)(?=<h2|$)/g,
    (_, body) => `<details class="evidence-drawer"><summary>原文定位</summary>${body}</details>`);
  out = out.replace(/<h2 id="[^"]+">边界<\/h2>([\s\S]*?)(?=<h2|$)/g, (_, body) => (
    EDITORIAL_COPY.test(body)
      ? ''
      : `<details class="evidence-drawer"><summary>史料说明</summary>${body}</details>`
  ));
  return wrapTeach(out);
}

function publicBodyHtml(html) {
  let out = String(html || '');
  // 统治年表的首段原本混入了“大事记组／task-queue／深挖”等生产便笺。
  // 公开页只保留对读者有用的纪年口径，不保留编辑进度。
  out = out.replace(
    /<blockquote\b[^>]*>[\s\S]*?大事记组[\s\S]*?<\/blockquote>/g,
    (block) => {
      const plain = block.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const marker = '纪年口径：';
      const chronology = plain.includes(marker) ? plain.slice(plain.lastIndexOf(marker) + marker.length).trim() : '';
      return `<p>本表按年列出关键事件。${escHtml(chronology)}</p>`;
    },
  );
  // 完整删掉编辑阶段的“下一步／待续”章节，不让研发计划变成读者正文。
  out = out.replace(
    /<h2\b[^>]*>(?:(?!<\/h2>)[\s\S])*(?:下一步|待续)(?:(?!<\/h2>)[\s\S])*<\/h2>[\s\S]*?(?=<h2\b|$)/g,
    '',
  );
  // 纯编辑验收项直接不发布。
  const privateChecklist = /进入站点前|人工复核|深挖状态|章程原则|待用户抽查|责任人|审核备注|第一版产出|项目北极星指标|技术架构组|结构化入库|接入站点|内容选题库|大事记组|task-queue|\bschema\b|(?:data|content)\/[A-Za-z0-9_./-]+/i;
  out = out.replace(/<(p|li|blockquote)\b[^>]*>[\s\S]*?<\/\1>/g, (block) => (
    privateChecklist.test(block.replace(/<[^>]+>/g, '')) ? '' : block
  ));
  out = out.replace(/人物档沿用\s*<a\b[^>]*>[\s\S]*?<\/a>\s*，不另编号。?/g, '');
  out = out.replace(/<details class="evidence-drawer scope">[\s\S]*?<\/details>/g, '');
  // 把必要的证据不足改成读者口径，而不是工作队列口径。
  out = readerCopy(out)
    .replace(/本库的做法/g, '本页的处理方式')
    .replace(/本库/g, '本页')
    .replace(/本表/g, '此表')
    .replace(/本轮/g, '目前')
    .replace(/尚未打开|未打开|还没打开/g, '尚无可直接回查的原文')
    .replace(/尚未回查|未回查|待回核|待回查/g, '尚待更多材料核对')
    .replace(/尚未逐条比对|未逐条比对/g, '尚待逐条比对')
    .replace(/尚未拆入|未拆入|尚未拆|未拆/g, '尚未列出逐条依据')
    .replace(/待核实|待核/g, '尚待更多材料确认')
    .replace(/待查/g, '尚待查证')
    .replace(/只登记/g, '目前只列出')
    .replace(/尚未登记/g, '尚未列出')
    .replace(/登记书名/g, '列出书名')
    .replace(/已打开/g, '已列原文')
    .replace(/本页不写/g, '这里不作')
    .replace(/本页禁止/g, '这里不作')
    .replace(/本章只把这些数字作为卷级索引，尚未逐项核表/g, '这些数字暂作参考，仍需逐项核对')
    .replace(/本章只保留卷级索引/g, '此处只列出事件概览')
    .replace(/卷次尚待更多材料确认/g, '原文位置待确认')
    .replace(/卷级索引/g, '参考线索')
    .replace(/实录卷\s*([0-9/]+)\s*已回查/g, '《实录》卷 $1 可回查')
    .replace(/实录卷\s*([0-9/]+)\s*已核对/g, '《实录》卷 $1 可回查')
    .replace(/年份已回查/g, '年份已核对')
    .replace(/<h2 id="骨架">骨架<\/h2>/g, '<h2 id="要点">要点</h2>')
    .replace(/<p>---<\/p>/g, '')
    .replace(/<th>状态<\/th>/g, '<th>依据</th>')
    .replace(/<td>卷级索引<\/td>/g, '<td>参考线索</td>')
    .replace(/<td>卷次尚待更多材料确认<\/td>/g, '<td>原文位置待确认</td>')
    .replace(/(?:冲突组|同组异说)\s*QH-CF-[A-Z0-9-]+/g, '存在异说')
    .replace(/\bQH-W-\d+\b/g, '相关文献条目')
    .replace(/<code>相关文献条目<\/code>/g, '相关文献条目')
    .replace(/<code>QH-CF-[^<]+<\/code>/g, '相关异说')
    .replace(/<code>QH-A-[^<]+<\/code>/g, '相关依据')
    .replace(/<code>QH-SU-[^<]+<\/code>/g, '相关原文')
    .replace(/<code>#\/chapter\/([^<]+)<\/code>/g, '<a class="link" href="#/chapter/$1">相关章节</a>')
    .replace(/<code>#\/site\/([^<]+)<\/code>/g, '<a class="link" href="#/site/$1">相关今地</a>')
    .replace(/<code>#\/lane\/([^<]+)<\/code>/g, '<a class="link" href="#/lane/$1">相关对照</a>')
    .replace(/<code>#\/person\/([^<]+)<\/code>/g, '<a class="link" href="#/person/$1">相关人物</a>')
    .replace(/<code>#\/question\/([^<]+)<\/code>/g, '<a class="link" href="#/question/$1">相关问题</a>')
    .replace(/<code>#\/(works|claims|lanes|sources)<\/code>/g, '<a class="link" href="#/$1">查看相关页</a>');
  out = out.replace(/<(ul|ol)>\s*<\/\1>/g, '');
  return out;
}

function wrapTeach(html) {
  return html.replace(
    /(<h2 id="[^"]+">怎么读这件事<\/h2>)([\s\S]*?)(?=<h2|<!--|$)/,
    '$1<div class="teach">$2</div>',
  );
}
function staticChapterBody(html) {
  return String(html || '')
    .replace(
      /<button type="button" class="link claim-ref" data-claim="([A-Za-z0-9-]+)">看依据<\/button>/g,
      (_, id) => `<a class="link claim-ref" href="#/claim/${escHtml(id)}">看依据</a>`,
    )
    .replace(
      /<div class="claim-compare conflict-embed" data-conflict="([A-Za-z0-9-]+)"(?: data-label="[^"]*")?><\/div>/g,
      () => '<aside class="read-line"><h4>同组异说</h4><p><a class="link" href="#/claims">在交互版查看相关异说</a></p></aside>',
    );
}

function staticChapterHtml({ chapter, units, portrait, prev, next, indexable }) {
  const canonical = new URL(`chapter/${encodeURIComponent(chapter.slug)}/`, siteBaseUrl).href;
  const image = portrait?.['预览文件'] ? new URL(portrait['预览文件'], siteBaseUrl).href : '';
  const robots = indexable ? 'index,follow' : 'noindex,follow';
  const description = indexable ? chapter.lede : `研究草稿（未完成整章史料核对）：${chapter.lede}`;
  const structured = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: chapter.title,
    description,
    inLanguage: 'zh-Hans',
    isPartOf: { '@type': 'WebSite', name: '清史读本', url: siteBaseUrl.href },
    url: canonical,
    ...(image ? { image } : {}),
  }).replace(/</g, '\\u003c');
  const evidence = units.length
    ? `<section class="chapter-evidence">
        <h2>本章可回查的卷</h2>
        <p>${units.length} 处结构化来源。逐条主张与原文链接请进入交互版。</p>
        <p class="actions">${units.map((unit) => `<a class="link" href="#/claims?unit=${escHtml(unit.source_unit_id)}">${escHtml([unit['史料名'], unit['卷次']].filter(Boolean).join(' '))}</a>`).join(' · ')}</p>
      </section>`
    : `<p class="bound">本章尚未列出可直接回查的原文出处，请将正文视为研究草稿。</p>`;
  const nav = (prev || next) ? `<nav class="chapter-nav" aria-label="上下篇">
      ${prev ? `<a class="link" href="chapter/${escHtml(prev.slug)}/">上一篇 ${escHtml(prev.title)}</a>` : '<span></span>'}
      ${next ? `<a class="link" href="chapter/${escHtml(next.slug)}/">下一篇 ${escHtml(next.title)}</a>` : '<span></span>'}
    </nav>` : '';
  return `<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="../../">
  <title>${escHtml(chapter.title)} · 清史读本</title>
  <meta name="description" content="${escHtml(description)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${escHtml(canonical)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="清史读本">
  <meta property="og:title" content="${escHtml(chapter.title)}">
  <meta property="og:description" content="${escHtml(description)}">
  <meta property="og:url" content="${escHtml(canonical)}">
  ${image ? `<meta property="og:image" content="${escHtml(image)}">` : ''}
  <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
  <meta name="theme-color" content="#f4efe4" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#191512" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📜</text></svg>">
  <link rel="stylesheet" href="styles.css?v=10">
  <script type="application/ld+json">${structured}</script>
</head>
<body>
  <a class="skip" href="#main">跳到正文</a>
  <header class="masthead static-masthead">
    <a class="brand" href="./">清史读本</a>
    <nav class="nav" aria-label="主导航">
      <a href="./#/path">转轴</a><a href="./">十二帝</a><a href="./#/hands">手稿</a><a href="./#/sites">今地</a><a href="./#/works">文献</a>
    </nav>
  </header>
  <main id="main" tabindex="-1">
    <article>
      <div class="reading">
        <p class="kicker">${escHtml(chapter.era)}</p>
        <h1>${escHtml(chapter.title)}</h1>
        <p class="lede">${escHtml(chapter.lede)}</p>
${indexable ? '' : `        ${researchDraftBanner('chapter')}\n`}        <p class="crumb"><a class="link" href="#/chapter/${escHtml(chapter.slug)}">打开交互版与主张抽屉</a></p>
      </div>
      <div class="md">${staticChapterBody(chapter.bodyHtml)}</div>
      ${evidence}
      ${nav}
    </article>
  </main>
  <footer class="foot">
    <p class="foot-links"><a href="#/how">怎么读</a> · <a href="#/questions">现有材料答不了</a> · <a href="#/sources">来源</a></p>
    <p class="foot-note">AI 辅助个人研究稿；未经专业清史学者全面审校。</p>
    <p class="foot-links"><a href="https://github.com/zonglinxie-cyber/qing-history-evidence-base" rel="noopener">开源仓库</a></p>
  </footer>
</body>
</html>
`;
}

function writeStaticChapterPages({ chapters, units, portraits, emperors }) {
  const chapterDir = path.join(siteDir, 'chapter');
  fs.rmSync(chapterDir, { recursive: true, force: true });
  fs.mkdirSync(chapterDir, { recursive: true });
  const unitById = new Map(units.map((unit) => [unit.source_unit_id, unit]));
  const emperorByPerson = new Map(emperors.map((emperor) => [emperor.person_id, emperor]));
  const primaryByEmperor = new Map();
  for (const portrait of portraits) {
    if (portrait['展示角色'] === '默认朝服像') primaryByEmperor.set(portrait.emperor_id, portrait);
  }
  const indexable = [];
  for (const chapter of chapters) {
    if (!/^[a-z0-9-]+$/.test(chapter.slug)) throw new Error(`静态章节 slug 非法: ${chapter.slug}`);
    const sourceUnits = String(chapter.unit_ids || '').split(/[；;]/).map((id) => unitById.get(id.trim())).filter(Boolean);
    const canIndex = isChapterIndexable(chapter.status, sourceUnits.length);
    const siblings = chapters.filter((row) => row.person_id === chapter.person_id)
      .slice().sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
    const at = siblings.findIndex((row) => row.slug === chapter.slug);
    const emperor = emperorByPerson.get(chapter.person_id);
    const page = staticChapterHtml({
      chapter,
      units: sourceUnits,
      portrait: emperor ? primaryByEmperor.get(emperor.emperor_id) : null,
      prev: at > 0 ? siblings[at - 1] : null,
      next: at >= 0 && at < siblings.length - 1 ? siblings[at + 1] : null,
      indexable: canIndex,
    });
    const out = path.join(chapterDir, chapter.slug);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'index.html'), page);
    if (canIndex) indexable.push(chapter);
  }

  const urls = [siteBaseUrl.href, ...indexable.map((chapter) => new URL(`chapter/${encodeURIComponent(chapter.slug)}/`, siteBaseUrl).href)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escHtml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(siteDir, 'sitemap.xml'), sitemap);
  fs.writeFileSync(path.join(siteDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap.xml', siteBaseUrl).href}\n`);
  return { total: chapters.length, indexable: indexable.length };
}


// 装载本朝文件（含 shared 共享文件），按 kind 合并；返回 { dynasty, data: {field: rows} }。
// 主张行保留 manifest.reign，供覆盖度按朝分组；不从 Assertion ID 正则推朝次。
function loadDynasty(dynasty) {
  const byKind = new Map();
  for (const entry of DATA_MANIFEST) {
    if (entry.dynasty !== dynasty.code && entry.dynasty !== 'shared') continue;
    const rows = load(entry.file).map((r) => (
      entry.kind === 'source_claims' ? { ...r, _reign: entry.reign } : r
    ));
    const list = byKind.get(entry.kind) || [];
    byKind.set(entry.kind, list.concat(rows));
  }
  const data = {};
  for (const [kind, field] of Object.entries(KIND_TO_FIELD)) {
    data[field] = byKind.get(kind) || [];
  }
  return { dynasty, data };
}

function slimDynasty(dynasty) {
  return {
    code: dynasty.code,
    label: dynasty.label,
    kicker: dynasty.kicker,
    headline: dynasty.headline,
    lede: dynasty.lede,
    // slug → 年号标签；前端据此解析朝代专题路由与数据块
    eras: Object.fromEntries(dynasty.reignEras.map((era) => [era.slug, era.label])),
  };
}

function buildDynasty({ dynasty, data }) {
  const {
    emperors, cards, portraits, crosswalk, people, sources, sourceIndex, tasks,
    units, claims, questions, chapters: chapterRows, lanes, empressTimeline,
    princes, princesses, heirChain, historicSites, imageRegions, iiifManifests,
    works, vocab, conflictSets, chronicle, overviews: overviewRows, emperorTimeline,
  } = data;

  for (const row of portraits) {
    row['预览文件'] = localPreview(row.visual_id, row['预览文件']);
  }
  for (const row of historicSites) {
    row['预览文件'] = localPreview(row.site_id, row['预览文件']);
  }

  const portraitsByEmperor = new Map();
  for (const row of portraits) {
    const list = portraitsByEmperor.get(row.emperor_id) || [];
    list.push(row);
    portraitsByEmperor.set(row.emperor_id, list);
  }
  function primaryPortrait(emperorId) {
    const list = portraitsByEmperor.get(emperorId) || [];
    return list.find((row) => row['展示角色'] === '默认朝服像') || list[0] || null;
  }
  const crosswalkByLegacy = new Map(crosswalk.map((row) => [row.legacy_emperor_id, row]));

  // 人物卡只公布证据条数与已核对数，不暴露内部审核状态。
  const credibilityByPerson = new Map();
  for (const claim of claims) {
    const pid = claim['主体 ID'];
    if (!pid) continue;
    let c = credibilityByPerson.get(pid);
    if (!c) {
      c = { claims: 0, checked: 0 };
      credibilityByPerson.set(pid, c);
    }
    c.claims += 1;
    if (claim['状态'] === '已采纳') c.checked += 1;
  }
  const emptyCredibility = () => ({ claims: 0, checked: 0 });

  const emperorRecords = emperors.map((emperor) => {
    const map = crosswalkByLegacy.get(emperor.emperor_id);
    const personId = map?.person_id || '';
    return {
      ...pick(emperor, [
        'emperor_id', '顺序', '规范名', '年号或通称', '庙号', '谥号', '生年', '卒年', '在位起', '在位止', '在位年数',
        '皇子序', '外号', '父亲', '母亲', '前任', '继任', '陵寝', '故宫人物页',
      ]),
      person_id: personId,
      portrait: slimPortrait(primaryPortrait(emperor.emperor_id)),
      credibility: credibilityByPerson.get(personId) || emptyCredibility(),
    };
  });

  // 章节插图：构建期权利检查。绿色且可公开展示才嵌图；黄色/红色只给说明与外链。
  const portraitsByVisual = new Map(portraits.map((p) => [p.visual_id, p]));
  function chapterFig(id, overrideCaption) {
    const portrait = portraitsByVisual.get(id);
    if (!portrait) {
      console.warn(`WARN: 章节插图未知 ${id}`);
      return `<figure class="fig-inline"><div class="img-fallback">图像未找到：${escHtml(id)}</div></figure>`;
    }
    const title = portrait['对象标题'] || id;
    const caption = overrideCaption || title;
    const license = portrait['文件页标示许可'] || '';
    const fileUrl = /^https:\/\//.test(portrait['文件页'] || '') ? portrait['文件页'] : '';
    const embeddable = portrait['权利颜色'] === '绿' && portrait['可公开展示'] === '是' && portrait['预览文件'];
    if (!embeddable) {
      return `<figure class="fig-inline fig-restricted"><div class="img-fallback">${escHtml(title)} · 权利受限，不嵌入</div><figcaption>${escHtml(caption)}${fileUrl ? ` · <a href="${escHtml(fileUrl)}" target="_blank" rel="noopener">看文件页</a>` : ''}</figcaption></figure>`;
    }
    const src = localPreview(portrait.visual_id, portrait['预览文件']);
    return `<figure class="fig-inline"><a href="#/image/${escHtml(id)}"><img src="${escHtml(src)}" alt="${escHtml(title)}" loading="lazy" decoding="async"></a><figcaption><strong>${escHtml(caption)}</strong>${license ? ` · ${escHtml(license)}` : ''}${fileUrl ? ` · <a href="${escHtml(fileUrl)}" target="_blank" rel="noopener">文件页</a>` : ''}</figcaption></figure>`;
  }

  const chapters = chapterRows.map((row) => {
    const file = path.join(contentDir, row.file);
    const markdown = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const status = (markdown.match(/^状态：\s*(.+)$/m)?.[1] || '').replace(/`/g, '').trim();
    return { ...row, markdown, bodyHtml: publicBodyHtml(mdToHtml(markdown, chapterFig)), status };
  });

  const overviews = (overviewRows || []).map((row) => {
    const file = path.join(contentDir, row.file);
    const markdown = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    return { ...row, markdown, bodyHtml: publicBodyHtml(mdToHtml(markdown, chapterFig)) };
  });

  const unitById = new Map(units.map((row) => [row.source_unit_id, row]));
  const personById = new Map(people.map((row) => [row.person_id, row]));
  const siteById = new Map(historicSites.map((row) => [row.site_id, row]));
  const laneById = new Map(lanes.map((row) => [row.lane_id, row]));
  const chapterById = new Map(chapters.map((row) => [row.chapter_id, row]));

  const publicPeople = people.map((row) => ({
    ...pick(row, ['person_id', '分组', '规范名', '人物类型']),
    '常用名或异名': readerMetadata(row['常用名或异名']),
  }));
  const publicPortraits = portraits.map(publicPortrait);
  const publicCrosswalk = crosswalk.map((row) => pick(row, ['person_id', 'legacy_emperor_id']));
  const publicRegions = imageRegions.map((row) => pick(row, [
    'region_id', 'visual_id', 'region_label', 'x', 'y', 'w', 'h', 'assertion_id', 'evidence_stance',
  ]));
  const publicIiif = iiifManifests.map((row) => pick(row, ['visual_id', 'iiif_manifest']));
  const publicUnits = units.map((row) => pick(row, [
    'source_unit_id', 'source_entity_id', '史料名', '卷次', '原纪年', '当日条次', '直接记录网址', '证据等级',
  ]));
  const publicClaims = claims.map(publicClaim);
  const publicLanes = lanes.map((row) => ({
    ...pick(row, ['lane_id', '栏目', '相关人物ID', '标题', '来源入口', '冲突组 ID']),
    '通行说法': readerProse(row['通行说法']),
    '官书或档案怎么写': readerProse(row['官书或档案怎么写']),
    '野史笔记或影视怎么写': readerProse(row['野史笔记或影视怎么写']),
    '差异或读法': readerProse(row['差异或读法']),
  }));
  const publicEmpressTimeline = empressTimeline.map((row) => ({
    ...pick(row, [
      'event_id', 'person_id', '当时称号', '事件类型', '原纪年', '公历下界', '公历上界', '来源单元', '引文', '冲突组 ID', '主张 ID', '排序键',
    ]),
    '公开证据状态': publicEvidence(row['回查状态']),
  }));
  const publicPrinces = princes.map((row) => pick(row, [
    'person_id', '表序', '表序标签', '收录状态', '规范名', '世表用名', '异名', '父亲ID', '生母人物ID', '生母候选名', '生母来源', '世表摘要', '后妃传子女句', '冲突组 ID', '排序键',
  ]));
  const publicPrincesses = princesses.map((row) => pick(row, [
    'person_id', '表序', '表序标签', '收录状态', '规范名', '公主表用名', '异名', '父亲ID', '生母人物ID', '生母候选名', '生母来源', '封号摘要', '下嫁摘要', '生薨摘要', '额驸事略', '冲突组 ID', '排序键',
  ]));
  const publicHeirChain = heirChain.map((row) => ({
    ...pick(row, [
      'event_id', 'person_id', '阶段', '事件类型', '原纪年', '公历下界', '公历上界', '地点', '来源单元', '引文', '冲突组 ID', '主张 ID', '相关人物ID', '排序键',
    ]),
    '公开证据状态': publicEvidence(row['回查状态']),
  }));
  const publicSites = historicSites.map((row) => {
    const out = pick(row, [
      'site_id', '相关皇帝ID', '相关人物ID', '事件', '当时', '今日', '今地说明', '卡片钩子', '权利颜色', '文件页', '预览文件', '文件页标示许可', '作者或摄影者', '制作年代或摄影日期', '排序', '首页',
    ]);
    for (const field of ['当时', '今日', '今地说明', '卡片钩子']) {
      out[field] = readerCopy(out[field]).replace(/\bQH-ST-\d+\b/g, (id) => siteById.get(id)?.['事件'] || '相关地点');
    }
    out['预览文件'] = localPreview(row.site_id, row['预览文件']);
    out['公开证据状态'] = publicEvidence(row['证据状态']);
    return out;
  });
  const publicWorks = works.map((row) => ({
    ...pick(row, [
      'work_id', 'emperor_id', '文献名称', '文献类型', '编纂者/作者', '成书年代', '卷数', '内容概述', '来源入口', '排序', 'dedicated_chapter',
    ]),
    '卷数': readerMetadata(row['卷数']),
    '内容概述': readerCopy(row['内容概述']),
    availability: publicAvailability(row.open_state),
    hasDirectText: row.open_state === 'L2' || row.open_state === 'L3',
  }));
  const publicSources = sources.map((row) => ({
    ...pick(row, [
      'source_id', '机构或资源', '资源类型', '证据等级', '核心内容', '访问方式', '权利颜色', '可本地保存', '可公开展示', '可商业使用', '使用策略', '限制摘要', '资源网址', '权利或规则网址',
    ]),
    '核心内容': readerCopy(row['核心内容']),
    '访问方式': readerCopy(row['访问方式']),
    '可商业使用': readerMetadata(row['可商业使用']),
    '使用策略': readerCopy(row['使用策略']),
    '限制摘要': readerCopy(row['限制摘要']),
  }));
  const publicConflictSets = (conflictSets || []).map((row) => pick(row, ['conflict_set_id', '议题']));
  const publicChronicle = (chronicle || []).map((row) => ({
    ...pick(row, [
      'entry_id', 'emperor_id', '层级', 'parent_id', '事件类型', '标题', '原纪年', '公历下界', '公历上界', '精度', '主张IDs', '来源单元', '冲突组', '今地ID', '章节slug', '年号级收录', '排序键',
    ]),
    '说明': readerCopy(row['说明']),
  }));
  const publicChapters = chapters.map((row) => {
    const sourceCount = String(row.unit_ids || '').split(/[；;]/).map((id) => id.trim()).filter((id) => unitById.has(id)).length;
    return {
      ...pick(row, ['chapter_id', 'slug', 'person_id', 'era', 'title', 'unit_ids', 'related', 'sort']),
      lede: readerCopy(row.lede),
      bodyHtml: row.bodyHtml,
      indexable: isChapterIndexable(row.status, sourceCount),
    };
  });
  const publicOverviews = overviews.map((row) => ({
    ...pick(row, ['overview_id', 'slug', 'title', 'sort']),
    lede: readerCopy(row.lede),
    bodyHtml: row.bodyHtml,
  }));

  function questionLink(id) {
    const value = String(id || '').trim();
    if (!value) return null;
    if (/^QH-A-/.test(value)) return { href: `#/claim/${value}`, label: '相关依据' };
    if (/^QH-P-/.test(value)) return { href: `#/person/${value}`, label: personById.get(value)?.['规范名'] || '相关人物' };
    if (/^QH-ST-/.test(value)) return { href: `#/site/${value}`, label: siteById.get(value)?.['事件'] || '相关今地' };
    if (/^QH-L-/.test(value)) return { href: `#/lane/${value}`, label: laneById.get(value)?.['标题'] || '相关对照' };
    if (/^QH-SU-/.test(value)) {
      const unit = unitById.get(value);
      return { href: `#/claims?unit=${encodeURIComponent(value)}`, label: [unit?.['史料名'], unit?.['卷次']].filter(Boolean).join(' ') || '相关原文' };
    }
    if (/^QH-CH-/.test(value)) {
      const chapter = chapterById.get(value);
      return chapter ? { href: `#/chapter/${chapter.slug}`, label: chapter.title } : null;
    }
    return null;
  }

  const publicQuestions = questions.map((row) => ({
    question_id: row.question_id,
    category: row['类别'] === '无证据拒答' ? '证据边界' : row['类别'],
    question: readerCopy(row['问题']),
    answer: row['期望行为'] === '拒绝作答' ? '' : readerCopy(row['可公开答案']),
    evidenceGap: row['期望行为'] === '拒绝作答',
    explanation: row['期望行为'] === '拒绝作答' ? readerCopy(row['拒答说明']) : '',
    route: row['路由'],
    links: String(row['绑定ID'] || '').split(/[；;]/).map(questionLink).filter(Boolean),
  }));

  // 按朝归集主张总量：朝次来自 manifest.reign（经 loadDynasty 写入 _reign），不是 ID 前缀
  const eraBySlug = Object.fromEntries(dynasty.reignEras.map((e) => [e.slug, e.label]));
  const claimsByReign = {};
  for (const row of claims) {
    const reign = eraBySlug[row._reign] || '其他';
    claimsByReign[reign] = (claimsByReign[reign] || 0) + 1;
    delete row._reign;
  }
  const coverage = {
    emperors: emperors.length,
    people: people.length,
    sources: sources.length,
    claims: claims.length,
    claimsByReign,
    checkedClaims: claims.filter((row) => row['状态'] === '已采纳').length,
    portraits: portraits.length,
    lanes: lanes.length,
    empressEvents: empressTimeline.length,
    princes: princes.length,
    princesses: princesses.length,
    heirEvents: heirChain.length,
    sites: historicSites.length,
    questions: questions.length,
    chapters: chapters.length,
  };

  const suggest = [];
  const seenPeople = new Set();
  for (const emperor of emperorRecords) {
    seenPeople.add(emperor.person_id);
    suggest.push({
      id: emperor.person_id,
      label: emperor['年号或通称'].split('；')[0],
      extra: emperor['规范名'],
      hay: [emperor.person_id, emperor.emperor_id, emperor['规范名'], emperor['年号或通称'], emperor['庙号'], emperor['父亲'], emperor['母亲'], py([emperor['规范名'], emperor['年号或通称'], emperor['庙号']].join(''))].join(' '),
    });
  }
  for (const person of people) {
    if (seenPeople.has(person.person_id)) continue;
    const aliases = readerMetadata(person['常用名或异名']);
    suggest.push({
      id: person.person_id,
      label: person['规范名'].replace(/^爱新觉罗·/, ''),
      extra: aliases,
      hay: [person.person_id, person['规范名'], aliases, person['人物类型'], py([person['规范名'], aliases].join(''))].join(' '),
    });
  }

  const searchEntries = [
    ...suggest.map((row) => searchEntry('person', row.id, row.hay, { label: row.label, extra: row.extra })),
    ...publicClaims.map((row) => searchEntry('claim', row['Assertion ID'], [row['主体 ID'], row['谓词/关系'], row['客体 ID 或值'], row['原始时间表达'], row['支持引文']].join(' '))),
    ...publicSources.map((row) => searchEntry('source', row.source_id, [row['机构或资源'], row['资源类型'], row['核心内容']].join(' '))),
    ...publicLanes.map((row) => searchEntry('lane', row.lane_id, [row['标题'], row['通行说法'], row['官书或档案怎么写'], row['野史笔记或影视怎么写'], row['差异或读法']].join(' '))),
    ...publicEmpressTimeline.map((row) => searchEntry('empress', row.event_id, [row['当时称号'], row['事件类型'], row['原纪年'], row['引文'], py(row['当时称号'])].join(' '))),
    ...publicPrinces.map((row) => searchEntry('prince', row.person_id, [row['规范名'], row['异名'], row['表序标签'], row['世表摘要'], py(row['规范名'])].join(' '), {
      label: row['规范名'].replace(/^爱新觉罗·/, ''),
      extra: row['表序标签'],
    })),
    ...publicPrincesses.map((row) => searchEntry('princess', row.person_id, [row['规范名'], row['异名'], row['表序标签'], row['封号摘要'], row['下嫁摘要'], py(row['规范名'])].join(' '), {
      label: row['规范名'].replace(/^爱新觉罗氏/, ''),
      extra: row['表序标签'],
    })),
    ...publicHeirChain.map((row) => searchEntry('heir', row.event_id, [row['阶段'], row['事件类型'], row['原纪年'], row['引文']].join(' '))),
    ...publicWorks.map((row) => searchEntry('work', row.work_id, [row['文献名称'], row['文献类型'], row['内容概述'], row['成书年代']].join(' '), {
      label: row['文献名称'],
      extra: row['文献类型'],
    })),
    ...publicSites.map((row) => searchEntry('site', row.site_id, [row['事件'], row['当时'], row['今日'], row['今地说明'], row['卡片钩子']].join(' '))),
    ...publicQuestions.map((row) => searchEntry('question', row.question_id, [row.question, row.answer, row.explanation, row.category].join(' '), {
      label: row.question,
      extra: row.category,
    })),
    ...publicChapters.map((row) => searchEntry('chapter', row.slug, [row.title, row.lede, row.era, row.bodyHtml.replace(/<[^>]+>/g, ' ')].join(' '), {
      label: row.title,
      extra: row.era,
    })),
  ];

  const slim = slimDynasty(dynasty);
  const written = [
    writeJson(`d-${dynasty.code}.json`, {
      units: publicUnits,
      claims: publicClaims,
      lanes: publicLanes,
      empressTimeline: publicEmpressTimeline,
      princes: publicPrinces,
      princesses: publicPrincesses,
      heirChain: publicHeirChain,
      chapters: publicChapters,
      questions: publicQuestions,
      works: publicWorks,
      conflictSets: publicConflictSets,
      chronicle: publicChronicle,
      overviews: publicOverviews,
      predicates: Object.fromEntries(
        (vocab || [])
          .filter((row) => row.scheme_code === 'assertion_predicate')
          .map((row) => [row.term_code, row['中文标签']]),
      ),
    }),
    writeJson('home.json', {
      // 构建产物必须可重复；发布时间由部署平台提供，不写入每次变化的当前时间。
      notice: '引文可回原文。家谱尚未用玉牒核对。',
      dynasty: slim,
      emperors: emperorRecords,
      sites: publicSites,
      coverage,
      credibility: {
        totalClaims: claims.length,
        checkedClaims: claims.filter((row) => row['状态'] === '已采纳').length,
        emperorsWithClaims: emperorRecords.filter((e) => (e.credibility?.claims || 0) > 0).length,
      },
      suggest,
    }),
    writeJson('people.json', { people: publicPeople, portraits: publicPortraits, crosswalk: publicCrosswalk, regions: publicRegions, iiif: publicIiif }),
    writeJson('catalog.json', { sources: publicSources }),
  ];

  // 首页直出：kicker/h1/lede 取自 dynasty 对象
  const indexPath = path.join(siteDir, 'index.html');
  let indexHtml = fs.readFileSync(indexPath, 'utf8');
  const homeRe = /<main id="main"[^>]*>[\s\S]*?<\/main>/;
  if (homeRe.test(indexHtml)) {
    const home = homeHtml(slim, emperorRecords, historicSites, { onerror: false });
    indexHtml = indexHtml.replace(homeRe, `<main id="main" tabindex="-1" data-ssr="home">\n${home}\n  </main>`);
  } else {
    console.warn('WARN: index.html 未找到 <main id="main">，跳过直出。');
  }
  // 注入朝代配置：app.js 启动时同步读取 #dynasty-config，决定数据块与专题路由
  const dynastyConfig = {
    code: dynasty.code,
    label: dynasty.label,
    chunk: `d-${dynasty.code}`,
    eras: slim.eras,
  };
  const configTag = `  <script type="application/json" id="dynasty-config">${JSON.stringify(dynastyConfig)}</script>\n`;
  const configRe = /[ \t]*<script type="application\/json" id="dynasty-config">[\s\S]*?<\/script>\n?/;
  indexHtml = configRe.test(indexHtml)
    ? indexHtml.replace(configRe, configTag)
    : indexHtml.replace('</head>', `${configTag}</head>`);
  const homePortrait = portraits.find((row) => row.emperor_id === 'QH-E-04' && row['展示角色'] === '默认朝服像')
    || portraits.find((row) => row['展示角色'] === '默认朝服像');
  const homeImage = homePortrait?.['预览文件'] ? new URL(homePortrait['预览文件'], siteBaseUrl).href : '';
  const homeDescription = `AI 辅助个人研究稿（仅部分史料已回查）：${dynasty.lede}`;
  const homeStructured = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'WebSite', name: '清史读本',
    url: siteBaseUrl.href, inLanguage: 'zh-Hans', description: homeDescription,
  }).replace(/</g, '\\u003c');
  const discoveryMeta = `  <!-- generated-site-meta:start -->
  <meta name="robots" content="index,follow">
  <meta name="description" content="${escHtml(homeDescription)}">
  <link rel="canonical" href="${escHtml(siteBaseUrl.href)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="清史读本">
  <meta property="og:title" content="清史读本">
  <meta property="og:description" content="${escHtml(homeDescription)}">
  <meta property="og:url" content="${escHtml(siteBaseUrl.href)}">
  ${homeImage ? `<meta property="og:image" content="${escHtml(homeImage)}">` : ''}
  <meta name="twitter:card" content="${homeImage ? 'summary_large_image' : 'summary'}">
  <script type="application/ld+json">${homeStructured}</script>
  <!-- generated-site-meta:end -->`;
  const discoveryMetaRe = /  <!-- generated-site-meta:start -->[\s\S]*?  <!-- generated-site-meta:end -->/;
  indexHtml = discoveryMetaRe.test(indexHtml)
    ? indexHtml.replace(discoveryMetaRe, discoveryMeta)
    : indexHtml.replace('</head>', `${discoveryMeta}\n</head>`);
  fs.writeFileSync(indexPath, indexHtml);

  const staticPages = writeStaticChapterPages({ chapters, units, portraits, emperors: emperorRecords });
  return { dynasty: dynasty.code, written, searchEntries, emperorCount: emperorRecords.length, siteCount: historicSites.length, staticPages };
}

function build() {
  fs.mkdirSync(dataOutDir, { recursive: true });

  const activeList = activeDynasties();
  if (activeList.length === 0) {
    console.error('ERROR: dynasties.csv 没有 active=是 的朝代，无法构建。请指定一个 active 朝代。');
    process.exit(1);
  }
  if (activeList.length > 1) {
    console.error(
      `ERROR: 检测到多个 active 朝代（${activeList.map((d) => d.code).join(', ')}），但本站是单朝代运行时：`,
      '#dynasty-config、首页直出与 home/people/catalog.json 一次只能承载一个朝代，同时构建会互相覆盖（后写者胜）而非并存。',
      '请把 dynasties.csv 里除目标外的朝代设为 active=否；真正的多朝代并存需先把数据块前缀化为 d-<code> 并给前端加朝代切换器。',
    );
    process.exit(1);
  }

  const allSearchEntries = [];
  const reports = [];
  for (const dynasty of activeList) {
    const loaded = loadDynasty(dynasty);
    const report = buildDynasty(loaded);
    allSearchEntries.push(...report.searchEntries);
    reports.push(report);
  }

  const searchWritten = writeJson('search.json', buildIndex(allSearchEntries));
  reports.push({ dynasty: 'search', written: [searchWritten] });

  // 清理已被 d-${code}.json 取代的旧产物
  const legacyDataJs = path.join(siteDir, 'data.js');
  if (fs.existsSync(legacyDataJs)) fs.unlinkSync(legacyDataJs);
  const legacyKangxi = path.join(dataOutDir, 'kangxi.json');
  if (fs.existsSync(legacyKangxi)) fs.unlinkSync(legacyKangxi);

  const summary = reports
    .flatMap((r) => r.written.map((item) => `${item.name} ${item.bytes}B`))
    .join(', ');
  console.log(`Wrote site/data/{${reports.flatMap((r) => r.written.map((item) => item.name)).join(', ')}} (${summary})`);
  const home = reports.find((r) => r.dynasty !== 'search');
  if (home) console.log(`Home emperors ${home.emperorCount}, sites ${home.siteCount}, search entries ${allSearchEntries.length}; static chapters ${home.staticPages.total}, indexable ${home.staticPages.indexable}`);
}

build();

if (process.argv.includes('--watch')) {
  let timer = null;
  const kick = (event, filename) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`rebuild after ${event} ${filename || ''}`);
      try {
        build();
      } catch (err) {
        console.error(err);
      }
    }, 200);
  };
  fs.watch(dataDir, { recursive: true }, kick);
  fs.watch(contentDir, { recursive: true }, kick);
  fs.watch(path.join(siteDir, 'templates.js'), kick);
  console.log('watching data/, content/, site/templates.js');
}
