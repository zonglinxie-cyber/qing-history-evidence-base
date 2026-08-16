// 朝代无关：docs/04 §13.2 的可机器化判据。
// 「删掉这句后损失的不是史实、日期、人名、数字、卷页或引文，而是语感」
// → ## 骨架 里带评述句式、又无卷页/ID/引文锚点、也无克制语的句子，warning（不是 error）。

import fs from 'node:fs';
import path from 'node:path';

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
