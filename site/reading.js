// 纯章节规则：构建统计也会调用，不依赖站点派生产物。
/**
 * 整章证据是否已闭环：绑定来源单元、达到 E1，且没有同时声明 S 级混合内容。
 * 只决定页内证据闭环标记，不再决定 robots。
 */
export function isChapterEvidenceClosed(status, unitCount) {
  const value = String(status ?? '').trim();
  const hasE1 = /(?:^|[/；])\s*E1\s*单源回查/.test(value);
  const hasSecondaryDraft = /(?:^|[/；])\s*S\s*二手/.test(value);
  return Number(unitCount) > 0 && hasE1 && !hasSecondaryDraft;
}

/**
 * chapters.csv「收录」是内部推荐目录标记；整站 noindex，不控制搜索引擎。
 */
export function isChapterIndexable(chapter) {
  return String(chapter?.['收录'] || '').trim() === '是';
}

/** 保留证据记录的时间精度，不把区间下界当作发生日。 */
export function calendarDate(record) {
  const calendar = record?.calendar;
  if (calendar?.status === 'conflict') return '公历换算待核（暂不展示精确值）';
  const lower = String(record?.['公历下界'] || '').trim();
  const upper = String(record?.['公历上界'] || '').trim();
  let value = '';
  if (lower && upper) value = lower === upper ? lower : `${lower}—${upper}（范围）`;
  else if (lower) value = `${lower} 起（仅有下界）`;
  else if (upper) value = `截至 ${upper}（仅有上界）`;
  else value = record?.['公历说明'] || '尚未换算';
  return calendar?.status === 'review' && value !== '尚未换算' ? `${value}（待核）` : value;
}

export function chapterGenre(chapter) {
  const slug = String(chapter?.slug || '');
  const title = String(chapter?.title || '');
  if (/reign-timeline|年表/.test(`${slug} ${title}`)) return '资料';
  if (/-scholarship$/.test(slug) || /prince-table|princess-table/.test(slug)) return '资料';
  return '章';
}

/** 各朝复用章序；必须先排朝次，再排章序。动态页与静态页共用。 */
export function orderedChapters(chapters, emperors, genre = '') {
  const order = new Map(emperors.map((row, index) => [row.person_id, Number(row['顺序'] || index + 1)]));
  return chapters.filter((row) => !genre || chapterGenre(row) === genre).slice().sort((a, b) => (
    (order.get(a.person_id) ?? 99) - (order.get(b.person_id) ?? 99)
    || Number(a.sort || 0) - Number(b.sort || 0)
    || a.slug.localeCompare(b.slug)
  ));
}

/** 叙事组只说明可对读；不自动断言同组材料相互冲突。 */
export function comparisonLabel(groupId) {
  return groupId === 'QH-CF-KX-SUCCESSION' ? '相关记载对读' : '同组记载对照';
}
