// 人物「出场」索引与正文姓名连线：构建期扫一遍章正文派生，浏览器不参与。
// 只处理白名单人物（见 <dynasty>-content.js 的 MENTION_PERSONS）；全库自动标注会把正文变成链接网。
// 连线与索引共用这一趟遍历，因为两处口径必须一致：每节只取首处，否则人物页列出的段落
// 在正文里没有对应的链接。折叠的「本章材料」说明不算出场——那里写的是史料范围，不是叙事。
// focus 交给 app.js 的 focusPassage()，它只在 h2/h3/p/li 的 textContent 里做包含匹配，
// 所以锚点取所在小标题；表格单元格里的出场只能跳到该节开头。

const BLOCK_TAGS = new Set(['p', 'li', 'td']);
const SKIP_TAGS = new Set(['a', 'code', 'button', 'h2', 'h3', 'summary', 'figcaption', 'details']);
const VOID_TAGS = new Set(['hr', 'img', 'br', 'input', 'meta', 'link']);
const EXCERPT_LEN = 78;
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' };

function toText(escaped) {
  return String(escaped || '').replace(/&(?:amp|lt|gt|quot);/g, (entity) => ENTITIES[entity] ?? entity);
}

export function plainText(html) {
  return toText(String(html || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function sentenceAround(blockText, name) {
  const text = blockText.trim();
  const sentences = text.split(/(?<=[。；！？])/).map((part) => part.trim()).filter(Boolean);
  const hit = sentences.find((part) => part.includes(name)) || text;
  const at = hit.indexOf(name);
  if (at < 0 || hit.length <= EXCERPT_LEN) return hit;
  const from = Math.max(0, at - 24);
  const to = Math.min(hit.length, Math.max(from + EXCERPT_LEN, at + name.length + 8));
  return `${from > 0 ? '…' : ''}${hit.slice(from, to)}${to < hit.length ? '…' : ''}`;
}

function parseTag(token) {
  const match = token.match(/^<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/);
  if (!match) return null;
  const name = match[2].toLowerCase();
  if (VOID_TAGS.has(name)) return { void: true };
  return { name, close: match[1] === '/', attrs: match[3], id: match[3].match(/\bid="([^"]*)"/)?.[1] || '' };
}

function pickMatch(plain, persons, taken) {
  let best = null;
  for (const person of persons) {
    if (taken.has(person.id)) continue;
    for (const name of person.names) {
      const at = plain.indexOf(name);
      if (at < 0) continue;
      if (!best || at < best.at || (at === best.at && name.length > best.name.length)) {
        best = { at, name, person };
      }
    }
  }
  return best;
}

// 返回 { html, mentions }。mentions 每行一处出场：章、节、摘录、回跳锚点。
export function annotateMentions(html, persons, chapter) {
  const tokens = String(html || '').match(/<[^>]+>|[^<]+/g) || [];
  const out = [];
  const mentions = [];
  const stack = [];
  const takenInSection = new Set();
  const pending = [];
  let section = { id: '', title: '' };

  const innermostBlock = () => {
    for (let i = stack.length - 1; i >= 0; i -= 1) if (stack[i].block) return stack[i];
    return null;
  };
  const insideSkip = () => stack.some((entry) => SKIP_TAGS.has(entry.name));

  const flush = (block) => {
    for (const person of pending) {
      const name = person.names.find((plain) => block.text.includes(plain));
      if (!name) continue;
      mentions.push({
        person_id: person.id,
        chapter_slug: chapter.slug,
        chapter_title: chapter.title,
        era: chapter.era,
        section_title: block.section.title,
        section_id: block.section.id,
        focus: '',
        excerpt: sentenceAround(block.text, name),
      });
    }
    pending.length = 0;
  };

  for (const token of tokens) {
    if (token.startsWith('<')) {
      out.push(token);
      const tag = parseTag(token);
      if (!tag || tag.void) continue;
      if (tag.close) {
        let target = -1;
        for (let i = stack.length - 1; i >= 0; i -= 1) if (stack[i].name === tag.name) { target = i; break; }
        if (target < 0) continue;
        for (let i = stack.length - 1; i >= target; i -= 1) {
          const entry = stack[i];
          if (entry.name === 'h2' || entry.name === 'h3') {
            section = { id: entry.id, title: entry.text.replace(/\s*依据$/, '').trim() };
          }
          if (entry.block) flush(entry);
        }
        stack.length = target;
      } else {
        if (tag.name === 'h2' || tag.name === 'h3') takenInSection.clear();
        // 正文里已经是人物链接的（编号写法由 publicBodyHtml 转换），算作本节的首处，不再补第二个链接。
        if (tag.name === 'a') {
          const linked = tag.attrs.match(/href="#\/person\/(QH-P-\d+)"/)?.[1];
          const person = linked && persons.find((row) => row.id === linked);
          if (person && !takenInSection.has(person.id)) {
            takenInSection.add(person.id);
            pending.push(person);
          }
        }
        stack.push({
          name: tag.name,
          id: tag.id,
          text: '',
          block: BLOCK_TAGS.has(tag.name),
          section,
        });
      }
      continue;
    }

    const plain = toText(token);
    const block = innermostBlock();
    const top = stack[stack.length - 1];
    if (top && top !== block) top.text += plain;
    // 摘录要带上内联链接的文字，否则读出「见 ，」这种断句；「依据」角标是控件，不进摘录。
    if (block && !stack.some((entry) => entry.name === 'button')) block.text += plain;
    if (!block || insideSkip()) {
      out.push(token);
      continue;
    }
    const hit = pickMatch(plain, persons, takenInSection);
    if (!hit) {
      out.push(token);
      continue;
    }
    takenInSection.add(hit.person.id);
    pending.push(hit.person);
    out.push(
      token.slice(0, hit.at),
      `<a class="link" href="#/person/${hit.person.id}">${token.slice(hit.at, hit.at + hit.name.length)}</a>`,
      token.slice(hit.at + hit.name.length),
    );
  }

  // 同一章里出现两个同名小节时，focus 词可能落到错误的那一节；这种情况宁可直接跳章首。
  const ambiguous = new Set(mentions.filter((row) => row.section_id && mentions.some((other) =>
    other !== row && other.section_title === row.section_title && other.section_id !== row.section_id,
  )).map((row) => row.section_title));
  for (const row of mentions) if (!ambiguous.has(row.section_title)) row.focus = row.section_title;

  return { html: out.join(''), mentions };
}
