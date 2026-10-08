// 章节正文的 Markdown → HTML 管线：构建期专用，浏览器不参与。
// 从 build-site.mjs 整段搬出，逐字未改；改这里等于改公开正文的渲染与删块口径。
import { stripInternalComments } from './reader.mjs';

export function firstQuote(html) {
  const match = String(html || '').match(/<blockquote[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/);
  return match ? match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) : '';
}

export function escHtml(value) {
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

export function inlineMd(text) {
  let out = escHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\[([^\]]+)\]\(((?:[^()]|\([^()]*\))+)\)/g, (_, label, href) => {
    // 指向仓库内文件（相对路径、*.md、../ 等）的链接在站点上无处可达，只留文字，不生死链。
    if (!/^(https?:\/\/|#\/)/.test(href)) return label;
    const extra = href.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
    return `<a class="link" href="${href}"${extra}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\{\{claim:([A-Za-z0-9-]+)\}\}/g, (_, id) => (
    `<button type="button" class="link claim-ref" data-claim="${escHtml(id)}">依据</button>`
  ));
  return out;
}

const MD_BLOCK = /^(#{1,4} |\- |\d+\. |\||>|---\s*$|\{\{fig:|\{\{conflict:)/;

function readerStatusBlock(raw) {
  const text = String(raw || '').replace(/`/g, '').trim();
  const bits = [];
  if (/\bE1\b/.test(text)) bits.push('已有条目可回查到实录或本纪原文');
  if (/\bS\b|二手/.test(text)) bits.push('其余叙述仍依据后出史书或通行记载');
  if (/\bC\b|来源已拆|来源冲突/.test(text)) bits.push('互异说法并列保存');
  if (/M1/.test(text)) bits.push('由 AI 辅助整理');
  if (/H1|抽查/.test(text)) bits.push('尚未经清史学者审校');
  const summary = bits.length ? bits.join('；') : '本章仍是研究草稿';
  return `<details class="evidence-drawer status"><summary>${escHtml(summary)}</summary><p>以上说明本章材料核对到哪一步。具体卷次和引文见正文角标。</p></details>`;
}

export function mdToHtml(src, fig) {
  const text = stripInternalComments(String(src || '')).replace(/\r\n/g, '\n').replace(/^# .+\n+/, '');
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
    if (/^状态：/.test(line.trim())) {
      html.push(readerStatusBlock(line.replace(/^状态：\s*/, '')));
      i += 1;
      continue;
    }
    if (/^## 待用户抽查/.test(line.trim())) {
      i += 1;
      while (i < lines.length && !/^## /.test(lines[i])) i += 1;
      continue;
    }
    if (/^---\s*$/.test(line.trim())) {
      html.push('<hr>');
      i += 1;
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
      // 引文块最后一行以「——」开头时，作为出处署名单独排（docs/30）。
      const source = quotes.length > 1 && /^——/.test(quotes[quotes.length - 1].trim()) ? quotes.pop().trim() : '';
      html.push(`<blockquote class="quote source-quote"><p>${inlineMd(quotes.filter((q) => q.trim()).join(' '))}</p>${source ? `<footer class="quote-source">${inlineMd(source)}</footer>` : ''}</blockquote>`);
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
      html.push(`<aside class="read-line" id="${escHtml(id)}"><h3>${inlineMd(title)}</h3>${body.join('')}</aside>`);
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
      ? `<details class="evidence-drawer scope"><summary>本章依据哪些材料</summary><p>${inlineMd(paraText.replace(/^范围：\s*/, ''))}</p></details>`
      : paraHtml);
  }
  return wrapDrawers(html.join('\n'));
}

// 编辑工件标记：档号、台账、提案目录、AI 示意图路径、入库指令等。命中这些标记的块整体不上页面；
// 只写读者能懂的史料限度说明（如「五大臣列传未开，不写各人卒年」）的块保留。
const internalLine = /\bQH-[A-Z]+-[A-Z0-9-]+\b|SRC-\d+|研究卡|原子主张|尚未钉|台账|ai-schematics|_cross-cutting-proposals|_data-proposals|双主键|不得写入|入库|工单|转\s?CSV|gap\.csv|\.(?:png|jpe?g|webp)\b|\{\{(?:fig|conflict|claim):|workflow|待升格|回查清单|\.\.\/|(?:data|content|docs)\/[A-Za-z0-9_./-]+/i;

function cleanInternalBlocks(body) {
  return String(body || '')
    .replace(/<(li|p|tr)\b[^>]*>[\s\S]*?<\/\1>/g, (block) => (internalLine.test(block.replace(/<[^>]+>/g, '')) ? '' : block))
    .replace(/<(ul|ol)>\s*<\/\1>/g, '');
}

// 只保留读者能理解的史料说明；“尚未解决”是编辑待办，不进公共页。
function wrapDrawers(html) {
  let out = html.replace(/<h2 id="[^"]+">尚未解决<\/h2>[\s\S]*?(?=<h2|$)/g, '');
  out = out.replace(/<h2 id="[^"]*">待用户抽查<\/h2>[\s\S]*?(?=<h2|$)/g, '');
  // 「待办」是编辑侧的 TODO 清单，不进公共页。
  out = out.replace(/<h2 id="[^"]*">[^<]*待办<\/h2>[\s\S]*?(?=<h2|$)/g, '');
  out = out.replace(/<h2 id="[^"]*">(?:待回查清单|尚待更多材料核对清单)<\/h2>([\s\S]*?)(?=<h2|$)/g,
    (_, body) => `<details class="evidence-drawer"><summary>史料说明</summary>${body}</details>`);
  out = out.replace(/<h2 id="[^"]*">[一二三四五六七八九十]+、实录卷次回查状态<\/h2>([\s\S]*?)(?=<h2|$)/g,
    (_, body) => `<details class="evidence-drawer"><summary>原文定位</summary>${body}</details>`);
  // 「边界」是旧章的史料限制说明：折叠展示，不再整节删掉（0.8.0）。新章写进「史料怎么说」正文节。
  out = out.replace(/<h2 id="[^"]+">边界<\/h2>([\s\S]*?)(?=<h2|$)/g, (_, body) => {
    const kept = cleanInternalBlocks(body);
    return kept.replace(/<[^>]+>/g, '').trim()
      ? `<details class="evidence-drawer"><summary>史料的限度</summary>${kept}</details>`
      : '';
  });
  // 「史料的限度」「原文定位」「本章依据哪些材料」等抽屉同样会漏进编辑行话，统一再过滤一遍；
  // 抽屉被清空就连壳去掉，不留一个展开后只有空白或空列表的折叠框。
  out = out.replace(/(<details class="evidence-drawer[^"]*"><summary>[\s\S]*?<\/summary>)([\s\S]*?)<\/details>/g,
    (_, head, body) => {
      const kept = cleanInternalBlocks(body);
      return kept.replace(/<[^>]+>/g, '').trim() ? `${head}${kept}</details>` : '';
    });
  return wrapTeach(out);
}

export function publicBodyHtml(html, refs = {}) {
  let out = String(html || '');
  const routeRef = (type, id, label, fallback) => {
    const title = refs[type]?.[id];
    return title
      ? `<a class="link" href="#/${type}/${escHtml(id)}">${escHtml(title)}</a>`
      : `<span class="pending-ref" title="条目尚未整理">${escHtml(label || fallback)}</span>`;
  };
  // 「下一步 / 待续」小节不再整节删除：标题由写作者自己起，构建期不替作者决定取舍。
  // 内容里的编辑便笺仍由下面 privateChecklist 逐块清理。
  // 兜底整块删：块里出现内部档号、台账/提案路径、编辑指令或工件文件名时，整段不进公开正文。
  // 读者能读懂的史料限度说明不含这些词，不受影响。
  const privateChecklist = /进入站点前|人工复核|深挖状态|章程原则|待用户抽查|责任人|审核备注|第一版产出|项目北极星指标|技术架构组|结构化入库|接入站点|内容选题库|大事记组|task-queue|\bschema\b|(?:data|content|docs)\/[A-Za-z0-9_./-]+|SRC-\d+|台账|ai-schematics|_cross-cutting-proposals|_data-proposals|双主键|不得写入|入库|工单|转\s?CSV|gap\.csv|\.(?:png|jpe?g|webp)\b|\{\{(?:fig|conflict|claim):|workflow|待升格|回查清单|\.\.\//i;
  out = out.replace(/<(p|li|blockquote)\b[^>]*>[\s\S]*?<\/\1>/g, (block) => {
    const plain = block.replace(/<[^>]+>/g, '');
    if (privateChecklist.test(plain)) {
      console.warn(`[publicBodyHtml] 删块: ${plain.replace(/\s+/g, ' ').trim().slice(0, 120)}`);
      return '';
    }
    return block;
  });
  out = out
    .replace(/<h2 id="骨架">骨架<\/h2>/g, '<h2 id="要点">要点</h2>')
    .replace(/<code>QH-CF-[^<]+<\/code>/g, '相关记载可对读')
    .replace(/<code>QH-A-[^<]+<\/code>/g, '相关依据')
    .replace(/<code>QH-SU-[^<]+<\/code>/g, '相关原文')
    .replace(/<code>QH-W-[^<]+<\/code>/g, '相关文献条目')
    // 人物、遗址、图像、对照四类编号在正文里直接出现时，换成可点的实体链接，
    // 读者看到的是名字而不是档号；名称缺失时退回类型标签。
    .replace(/<code>QH-P-([^<]+)<\/code>/g, (_, suffix) => (
      routeRef('person', `QH-P-${suffix}`, '', '人物档')
    ))
    .replace(/<code>QH-ST-([^<]+)<\/code>/g, (_, suffix) => (
      routeRef('site', `QH-ST-${suffix}`, '', '遗址今况')
    ))
    .replace(/<code>QH-V-([^<]+)<\/code>/g, (_, suffix) => (
      routeRef('image', `QH-V-${suffix}`, '', '图像')
    ))
    .replace(/<code>QH-L-([^<]+)<\/code>/g, (_, suffix) => (
      routeRef('lane', `QH-L-${suffix}`, '', '对照')
    ))
    .replace(/<code>QH-IR-[^<]+<\/code>/g, '图像区域')
    .replace(/<code>IDX-[^<]+<\/code>/g, '检索入口')
    .replace(/<code>CAND-[A-Za-z0-9-]+<\/code>/g, '候选条目')
    // 表格单元格不走上面的块级清理；残留在 td/th 里的台账编号一律中性化，
    // 只含编号的括号一并去掉，免得留下空括号。
    .replace(/<code>SRC-\d+<\/code>/g, '相关来源')
    .replace(/（[^（）]*SRC-\d+[^（）]*）|\([^()]*SRC-\d+[^()]*\)/g, '')
    .replace(/\bSRC-\d+\b/g, '相关来源')
    // 兜底：任何没被上面覆盖的 QH-* 编号都不进公开正文。
    .replace(/<code>QH-[A-Z]+-[^<]*<\/code>/g, '相关条目')
    // 提案号、冲突组编号被中性化后，外围的编辑话术（「提案」「冲突组」「生产表」等）
    // 对读者没有意义；统一换成「争议组／待定条目」这类能读通的说法。
    .replace(/，?共享冲突表尚无此行，提案补行/g, '，尚未立组')
    .replace(/提案勘误，不改生产表/g, '条目待勘误')
    .replace(/提案只登记入口，权利色先标黄/g, '仅登记为待核入口')
    .replace(/提案补挂，不在这里改共享表/g, '尚未立条目')
    .replace(/都已在提案表挂 ID/g, '均已登记')
    .replace(/生产史迹卡/g, '遗址卡')
    .replace(/生产史迹/g, '遗址条目')
    .replace(/生产表/g, '总表')
    .replace(/提案冲突组|冲突组提案/g, '争议组')
    .replace(/冲突组/g, '争议组')
    .replace(/提案/g, '待定条目')
    // 裸写的库内编号（没套 ` 号）同样只给读者可点的名字，不露出档号本身；
    // 反向断言排除属性值里的编号（href/data-claim/alt 等不算外漏）。
    .replace(/(?<![\w"'/=&.-])QH-(V|ST|P|L)-([A-Za-z0-9-]+)\b/g, (_, t, rest) => {
      const type = { V: 'image', ST: 'site', P: 'person', L: 'lane' }[t];
      const fallback = { image: '图像', site: '遗址今况', person: '人物档', lane: '对照' }[type];
      return routeRef(type, `QH-${t}-${rest}`, '', fallback);
    })
    .replace(/(?<![\w"'/=&.-])QH-IR-[A-Za-z0-9-]+\b/g, '图像区域')
    .replace(/(?<![\w"'/=&.-])QH-A-([A-Za-z0-9-]+)\b/g,
      (_, id) => `<a class="link" href="#/claim/QH-A-${escHtml(id)}">这条依据</a>`)
    .replace(/(?<![\w"'/=&.-])QH-(CF|CP)-[A-Za-z0-9-]+\b/g, '相关记载可对读')
    .replace(/(?<![\w"'/=&.-])CAND-[A-Za-z0-9-]+\b/g, '候选条目')
    .replace(/(?<![\w"'/=&.-])SRC-\d+\b/g, '相关来源')
    .replace(/<code>#\/chapter\/([^<]+)<\/code>/g, (_, slug) => (
      routeRef('chapter', slug, refs.chapter?.[slug] || '相关章节待整理', '相关章节待整理')
    ))
    .replace(/<code>#\/site\/([^<]+)<\/code>/g, (_, id) => (
      routeRef('site', id, '', '遗址今况')
    ))
    .replace(/<code>#\/image\/([^<]+)<\/code>/g, (_, id) => (
      routeRef('image', id, '', '图像')
    ))
    .replace(/<code>#\/lane\/([^<]+)<\/code>/g, (_, id) => (
      routeRef('lane', id, '', '对照')
    ))
    .replace(/<code>#\/person\/([^<]+)<\/code>/g, (_, id) => (
      routeRef('person', id, '', '人物')
    ))
    .replace(/<code>#\/question\/([^<]+)<\/code>/g, (_, id) => (
      `<a class="link" href="#/question/${escHtml(id)}">这个问题</a>`
    ))
    .replace(/<code>#\/(works|claims|lanes|sources|ziguangge|hands)<\/code>/g, (_, page) => {
      const labels = { works: '文献专栏', claims: '依据', lanes: '对照', sources: '来源', ziguangge: '紫光阁功臣像', hands: '像与物' };
      return `<a class="link" href="#/${page}">${labels[page] || page}</a>`;
    })
    // Markdown 手写链接也必须指向已登记实体；未完成的提案保留标题但不制造死链。
    .replace(/<a class="link" href="#\/(chapter|person|site|image|lane)\/([^"?]+)">([\s\S]*?)<\/a>/g,
      (full, type, id, label) => (refs[type]?.[id]
        ? full
        : `<span class="pending-ref" title="条目尚未整理">${label}</span>`));
  return out.replace(/<(ul|ol)>\s*<\/\1>/g, '');
}

function wrapTeach(html) {
  return html.replace(
    /(<h2 id="[^"]+">怎么读这件事<\/h2>)([\s\S]*?)(?=<h2|<!--|$)/,
    '$1<div class="teach">$2</div>',
  );
}
