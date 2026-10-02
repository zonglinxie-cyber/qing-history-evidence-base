// 各朝年表的 Markdown 表 → 帝页时间骨架：构建期解析一次，浏览器不读 Markdown。
// 只认「年份 | 纪年 | 事件」表；实录卷次回查、待回查清单那类表不是系事条目，不进时间线。
// 事件格必须走公开正文同一套内联渲染和删块口径（publicBodyHtml），
// 否则帝页就多出一条绕过编辑文案与内部编号检查的通道。
import { stripInternalComments } from './reader.mjs';
import { inlineMd, publicBodyHtml } from './chapter-html.mjs';

const CN_MONTH = {
  正: 1, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12, 冬: 11,
};
const CN_MONTH_RE = /(十[一二]|[正二三四五六七八九十]|冬)月/;

function yearOf(cell) {
  return String(cell || '').match(/\d{4}/)?.[0] || '';
}

// 只有年份（或连年份也只到朝）的条目落在年中，同年的逐日条仍排在它前后各自的日期上。
function sortKey(yearCell, reignYear) {
  const year = yearOf(yearCell);
  if (!year) return '9999-06-15';
  const month = CN_MONTH_RE.exec(String(reignYear || ''));
  return `${year}-${String(month ? CN_MONTH[month[1]] : 6).padStart(2, '0')}-15`;
}

function publicCell(text, refs) {
  const raw = String(text || '').trim();
  // 「—」是表格里占位的空栏；「冲突组」三个字后面跟的编号本来就由渲染换成「相关记载可对读」。
  if (!raw || raw === '—') return '';
  const html = publicBodyHtml(`<p>${inlineMd(raw.replace(/^冲突组\s+/, ''))}</p>`, refs).trim();
  if (!html || html === '<p></p>') return '';
  // 行内「依据」角标摘出文字，交给渲染端放进条目尾部的操作行——与逐日条同一位置。
  return html
    .replace(/<button type="button" class="link claim-ref"[^>]*>依据<\/button>\s*/g, '')
    .replace(/^<p>/, '')
    .replace(/<\/p>$/, '')
    .trim();
}

function claimIds(...cells) {
  const ids = cells.flatMap((cell) => [...String(cell || '').matchAll(/\{\{claim:([A-Za-z0-9-]+)\}\}/g)].map((m) => m[1]));
  return [...new Set(ids)];
}

export function parseReignTimeline(markdown, refs) {
  const rows = [];
  let group = '';
  let inTable = false;
  for (const raw of stripInternalComments(String(markdown || '')).replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      group = line.slice(3).replace(/^[一二三四五六七八九十]+、/, '').trim();
      inTable = false;
      continue;
    }
    if (!line.startsWith('|')) {
      inTable = false;
      continue;
    }
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (!cells.length || cells.every((cell) => /^[-: ]+$/.test(cell))) continue;
    if (cells[0] === '年份' && cells[1] === '纪年') {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    const [yearCell, reignYear, event, note] = cells;
    const eventHtml = publicCell(event, refs);
    if (!eventHtml) continue;
    rows.push({
      group,
      year: yearOf(yearCell),
      year_label: yearCell === '—' ? '' : yearCell,
      reign_year: reignYear,
      event_html: eventHtml,
      note_html: publicCell(note, refs),
      claims: claimIds(event, note),
      sort: sortKey(yearCell, reignYear),
    });
  }
  return rows;
}
