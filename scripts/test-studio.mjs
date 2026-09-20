import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calendarDate, orderedChapters, chapterGenre } from '../site/reading.js';
import { LIVE_TOPICS } from '../site/live-content.js';
import { JIEDU_FEATURED } from '../site/qing-content.js';
import { liveCard, liveState, researchBrief, studioPage } from '../site/studio.js';
const data = JSON.parse(fs.readFileSync(new URL('../site/data/d-qing.json', import.meta.url)));
const home = JSON.parse(fs.readFileSync(new URL('../site/data/home.json', import.meta.url)));
assert.equal(calendarDate({公历下界:'1776-01-01',公历上界:'1776-12-31'}), '1776-01-01—1776-12-31（范围）');
assert.equal(calendarDate({公历下界:'1661-02-07',公历上界:'1661-02-07'}), '1661-02-07');
assert.equal(calendarDate({公历上界:'1722-12-20'}), '截至 1722-12-20（仅有上界）');
assert.equal(calendarDate({公历说明:'原文仅记某年'}), '原文仅记某年');
const ordered = orderedChapters(data.chapters, home.emperors, chapterGenre(data.chapters.find(c=>c.slug==='kangxi-01')));
assert.equal(ordered[ordered.findIndex(c=>c.slug==='kangxi-01')+1].slug,'kangxi-02');
assert.deepEqual(liveState({topic:'treaty-paper',step:999,notes:'主播私密',format:'portrait'}),{version:1,topic:'treaty-paper',step:4,format:'portrait'});
assert.equal(liveState({topic:'unknown'}),null);
assert.equal(liveState({topic:'treaty-paper',step:-8,format:'other'}).step,0);
for(const topic of LIVE_TOPICS) {
  assert.equal(topic.steps.length,5);
  for (const [stepIndex, step] of topic.steps.entries()) {
    for (const id of step.claims) {
      const claim = data.claims.find(row=>row['Assertion ID']===id);
      assert.ok(claim?.['支持引文'],`${topic.slug}: ${id} 有原文`);
      const unit = data.units.find(row=>row.source_unit_id===claim['来源实体 ID']);
      assert.match(unit?.['直接记录网址'] || '',/^https:\/\//,`${id} 可回查`);
    }
    if(step.quote) assert.ok(step.claims.includes(step.quote));
    for(const format of ['landscape','portrait']) {
      const card = liveCard({topic:topic.slug,step:stepIndex,format},data);
      assert.ok(!card.includes(step.notes),'观众卡不含主播提示');
      assert.ok(card.includes('live-card-source'));
    }
  }
  const brief = researchBrief(topic,data);
  assert.ok(brief.includes(topic.leads[0]) && brief.includes('原文摘引：') && brief.includes('回查入口：'));
  const audience = studioPage(data,topic.slug,{session:'studio-fixture-2026'},true);
  assert.ok(!audience.includes('textarea') && !audience.includes('主播提示') && !audience.includes('data-research-copy'));
}
const desk = data.claims.find(row=>row['Assertion ID']==='QH-A-GX-0044');
assert.equal(desk['原始时间表达'],'某年');
assert.equal(desk['公历下界'],'');
assert.equal(desk['公历上界'],'');
assert.ok(desk['公历说明']);
assert.equal(data.claims.find(row=>row['Assertion ID']==='QH-A-GX-0020')['主体 ID'],'QH-P-000186');
for(const item of JIEDU_FEATURED) {
  assert.ok(item.focus,`${item.title}: 有选段定位`);
  const slug=item.href.split('/').pop();
  const chapter=JSON.parse(fs.readFileSync(new URL(`../site/data/chapter/${slug}.json`,import.meta.url)));
  const text=chapter.bodyHtml || chapter.chapter?.bodyHtml || '';
  // 与浏览器 focusPassage 相同的公开段落范围，避免只命中目录或删掉的编辑注。
  assert.ok([...text.matchAll(/<(?:h2|h3|p|li)\b[^>]*>([\s\S]*?)<\/(?:h2|h3|p|li)>/g)].some(match=>match[1].replace(/<[^>]+>/g,'').includes(item.focus)),`${item.title}: 公开正文可定位 ${item.focus}`);
}
console.log('PASS: 日期精度、同朝篇序、选题来源、观众内容隔离、查证任务和 48 个段落入口');
