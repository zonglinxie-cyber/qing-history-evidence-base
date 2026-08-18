// 朝代无关：docs/04 §13.2 的可机器化判据。
// 「删掉这句后损失的不是史实、日期、人名、数字、卷页或引文，而是语感」
// → ## 骨架 里带评述句式、又无卷页/ID/引文锚点、也无克制语的句子，warning（不是 error）。

import fs from 'node:fs';
import path from 'node:path';
import { EMPEROR_READS } from '../../../site/qing-content.mjs';

// 硬锚点：卷页、ID、书名号、引文。中文纪年不算锚点——评述句里也会写「三年」「十七世纪」。
const ANCHOR = /卷[0-9一二三四五六七八九十百千]+|QH-[A-Z]+-|《[^》]+》|「[^」]+」|『[^』]+』/;
const RESTRAINT = /待核|待回|未回|未拆|不能|不得|两说|未见|不取|尚未|待考|并存|只登记|本条未|不把|不采信/;
// §13.2 语感句：下断语，删掉后只少评价、不少日期人名卷页。
const COMMENTARY = /暴露了|反映了|构成了|具有.{0,10}价值|最大的|最重要|最著名|最为|不仅仅是|(?:是|为).{0,24}(?:大事|转折|标志|特例|之一|关键|集大成|核心矛盾|重要文本|重要线索|重要价值|货币危机|导火索)/;

function extractSections(md, title) {
  const re = new RegExp(`^#{2,4}\\s+${title}\\s*$`, 'gm');
  const starts = [...md.matchAll(re)].map((m) => m.index);
  return starts.map((start) => {
    const after = md.slice(start).replace(/^#{2,4}.+\n/, '');
    const next = after.search(/^#{2,4}\s+/m);
    return next < 0 ? after : after.slice(0, next);
  });
}

function sentences(section) {
  return section
    .split(/\n+/)
    .flatMap((line) => {
      const trimmed = line.replace(/^\s*(?:\d+\.|[-*])\s+/, '').trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('{{')) return [];
      return trimmed.split(/[。！？]/).map((s) => s.trim()).filter(Boolean);
    });
}

function clip(s) {
  const one = s.replace(/\s+/g, ' ');
  return one.length > 60 ? `${one.slice(0, 57)}…` : one;
}

const PROSE_SECTIONS = ['骨架', '怎么读这件事', '分日讲解', '读这一句'];
const EMPTY_PRAISE = /体现了|构成了|重要方面|重要组成部分|重要政策|重要事件|同一.{0,6}的两面/;
const DATE_OR_BOOK = /卷[0-9一二三四五六七八九十百千]+|《[^》]+》|[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]|[0-9]{3,4}\s*年|[十]?[一二三四五六七八九十]+\s*年/;
const HABIT_META = /仍有争议|证据分量|不能并列|不等于已经|本身不能证明|名字本身说明/;
const PSYCH = /试过挣脱|一生受制|自己觉得|欢心|最爱|设计密，执行失败|没有公开算/;
const INTERNAL_COPY = /待用户抽查|主张抽屉|\bH1\b|\bM1\b/;
const QA_PROMPT = /卷\d+|哪个位置|是否等于|本库|主张/;

function collectReadTexts(read) {
  if (!read) return [];
  const out = [];
  if (read.body) out.push(['body', read.body]);
  if (read.evidenceNote) out.push(['史料说明', read.evidenceNote]);
  for (const row of read.problems || []) out.push(['当时要解决什么', row.text || '']);
  for (const row of read.habits || []) out.push(['习惯', row.text || '']);
  for (const row of read.policy || []) out.push([`施政·${row.key || ''}`, row.text || '']);
  for (const row of read.beats || []) {
    out.push(['三拍·当时', row.problem || '']);
    out.push(['三拍·做了', row.did || '']);
    out.push(['三拍·留下', row.left || '']);
  }
  for (const line of read.later || []) out.push(['后人怎么评', line]);
  return out.filter(([, text]) => text);
}

export function checkReaderProse({ questions, warnings }) {
  // 帝卡读者层：只扫可见句子，不扫 claim 字段里的内部编号。
  for (const [personId, read] of Object.entries(EMPEROR_READS || {})) {
    for (const [slot, text] of collectReadTexts(read)) {
      for (const sent of sentences(text)) {
        const bare = sent.replace(/\s+/g, ' ').trim();
        if (bare.length < 10) continue;
        if (EMPTY_PRAISE.test(bare) && !DATE_OR_BOOK.test(bare) && !ANCHOR.test(bare) && !RESTRAINT.test(bare)) {
          warnings.push(`${personId} ${slot} 空评述句：${clip(bare)}`);
        }
        if (INTERNAL_COPY.test(bare) || /QH-A-\d/.test(bare)) {
          warnings.push(`${personId} ${slot} 读者层露出内部编号或编辑词：${clip(bare)}`);
        }
      }
      if (slot === '习惯' && HABIT_META.test(text)) {
        warnings.push(`${personId} 习惯条写成了审核说明：${clip(text)}`);
      }
      if (/^三拍|^当时要解决什么|^习惯/.test(slot) && PSYCH.test(text) && !DATE_OR_BOOK.test(text) && !ANCHOR.test(text)) {
        warnings.push(`${personId} ${slot} 无文本锚点的心理句：${clip(text)}`);
      }
    }
  }

  for (const row of questions || []) {
    const q = String(row['问题'] || '').trim();
    if (QA_PROMPT.test(q)) {
      warnings.push(`${row.question_id} 问法不像口语：${clip(q)}`);
    }
  }
}

export function checkSkeletonProse({ chapters, contentDir, warnings }) {
  for (const row of chapters) {
    const file = path.join(contentDir, row.file);
    if (!fs.existsSync(file)) continue;
    const md = fs.readFileSync(file, 'utf8');
    for (const title of PROSE_SECTIONS) {
      const blocks = extractSections(md, title);
      for (const section of blocks) {
      for (const sent of sentences(section)) {
        const bare = sent.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
        if (bare.length < 12) continue;
        if (!COMMENTARY.test(bare)) continue;
        if (ANCHOR.test(sent) || RESTRAINT.test(sent)) continue;
        warnings.push(`${row.chapter_id} ${title}评述句无卷页/ID/引文锚点：${clip(bare)}`);
      }
      }
    }
  }
}
