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
  // chapters.csv 的「体裁」列是显式判断：章＝叙事正文，资料＝年表/世表/索引类查阅章。
  // 读不到列值时才退回 slug/题名规则（旧数据、未过构建的半成品行）。
  const explicit = String(chapter?.['体裁'] || '').trim();
  if (explicit === '章' || explicit === '资料') return explicit;
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

// 证据状态的说法：数据里是 E/C/S/U 首字母，读者看到的是中文，提示句解释这一级凭什么。
// 构建侧写进 JSON、遗址卡与正文标记都读同一份。此前四处各抄一张表，改文案只改得动一处，
// 其余三处就变成说不清哪版为真的旧说法。
const EVIDENCE_LABEL = { E: '已列原文', C: '存在异说', S: '参考线索', U: '尚不确定' };

// 按读者看到的字样取提示；正文标记会另起更短的口径（已回原文／两说并存／后出转述），一并登记。
export const EVIDENCE_HINT = {
  '已列原文': '能回到实录或本纪的具体条目',
  '已回原文': '能回到实录或本纪的具体条目',
  '存在异说': '同一件事有两种以上写法，并列保存',
  '两说并存': '同一件事有两种以上写法，并列保存',
  '参考线索': '依据后出史书或通行叙述，尚未对到日级原文',
  '后出转述': '依据后出史书或通行叙述，尚未对到日级原文',
  '尚不确定': '现有材料还不足以判定',
};

/** 状态原文（可能写成「E1 单源回查」这类带说明的串）按首字母定级。 */
export function evidenceLabel(status) {
  return EVIDENCE_LABEL[String(status || '').trim()[0]] || '';
}
