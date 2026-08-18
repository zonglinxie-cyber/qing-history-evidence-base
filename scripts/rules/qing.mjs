// 清朝历史不变量：防常见清史错误的 QA 规则。
// 权利色 / 外键 / 枚举 / 章节链接在 rules/common/structure.mjs；本文件只放清史专属检查。

export function check(ctx) {
  const {
    errors,
    emperors, cards, people, units, claims, chapters,
    empressTimeline, princes, princesses, heirChain, historicSites,
    works, emperorTimeline, families,
  } = ctx;
  const chronicle = ctx.chronicle || [];

  const sourceUnitIds = new Set(units.map((r) => r.source_unit_id));
  const claimById = new Map(claims.map((row) => [row['Assertion ID'], row]));
  for (const row of chronicle) {
    for (const id of String(row['主张IDs'] || '').split(/[；;]/).map((s) => s.trim()).filter(Boolean)) {
      if (!claimById.has(id)) errors.push(`${row.entry_id} 指向未知主张 ${id}`);
    }
    for (const id of String(row['来源单元'] || '').split(/[；;]/).map((s) => s.trim()).filter(Boolean)) {
      if (!sourceUnitIds.has(id)) errors.push(`${row.entry_id} 指向未知来源单元 ${id}`);
    }
  }
  const knownPersonIds = new Set([...people.map((r) => r.person_id), ...ctx.crosswalk.map((r) => r.person_id)]);
  const cardIds = new Set(cards.map((r) => r.person_id));

  // 十二帝：清史稿卷次与故宫人物页
  const qsgVolumes = ['卷1 ', '卷2', '卷4', '卷6', '卷9 ', '卷10', '卷16', '卷17', '卷20', '卷21', '卷23', '卷25 '];
  emperors.forEach((row, i) => {
    if (!row['清史稿本纪'].startsWith(qsgVolumes[i])) errors.push(`${row.emperor_id} 清史稿卷次异常: ${row['清史稿本纪']}`);
    if (!/^https:\/\//.test(row['故宫人物页'])) errors.push(`${row.emperor_id} 故宫人物页不是 HTTPS`);
  });
  // 「前任/继任」是政治序列字段，必须与排序后的相邻皇帝逐项闭合；礼法承嗣另建关系，不得污染本链。
  const orderedEmperors = [...emperors].sort((a, b) => Number(a['顺序']) - Number(b['顺序']));
  orderedEmperors.forEach((row, i) => {
    if (Number(row['顺序']) !== i + 1) errors.push(`${row.emperor_id} 顺序异常: ${row['顺序']}，应为 ${i + 1}`);
    const expectedPredecessor = i === 0 ? '' : orderedEmperors[i - 1]['规范名'];
    const expectedSuccessor = i === orderedEmperors.length - 1 ? '' : orderedEmperors[i + 1]['规范名'];
    if (String(row['前任'] || '').trim() !== expectedPredecessor) {
      errors.push(`${row.emperor_id} 政治前任异常: ${row['前任'] || '空'}，应为 ${expectedPredecessor || '空'}`);
    }
    if (String(row['继任'] || '').trim() !== expectedSuccessor) {
      errors.push(`${row.emperor_id} 政治继任异常: ${row['继任'] || '空'}，应为 ${expectedSuccessor || '空'}`);
    }
  });
  for (const map of ctx.crosswalk) {
    if (!cardIds.has(map.person_id)) errors.push(`${map.person_id} 缺少十二帝研究卡`);
  }
  if (ctx.portraits.length < 19) errors.push(`emperor-portraits.csv 行数 ${ctx.portraits.length}，至少应为 19`);

  for (const claim of claims) {
    if (claim['Assertion ID'] === 'QH-A-KX-0037' && /畅春园|清溪书屋/.test(`${claim['客体 ID 或值']}${claim['支持引文']}`)) {
      errors.push('QH-A-KX-0037 不得把寝宫改写成畅春园或清溪书屋');
    }
  }

  // 高风险命题采纳门禁：生母、承嗣、即位合法性、死因等原则上需两个独立来源家族（编辑审核手册 §9）
  const highRiskPredicates = new Set([
    'gave_birth_to', 'fostered_not_begotten', 'adopted_out_to',
    'accession_occurred', 'accession_justification', 'oral_designated_successor', 'designated_successor',
    'invested_as_heir', 'arrested_as_heir', 'deposed_as_heir',
    'testament_identified_yinzhen', 'sealed_heir_edict_behind', 'received_deathbed_charge', 'ascended_throne_at',
    'died_on', 'died_at', 'illness_became_critical', 'granted_death',
  ]);
  const familiesByProposition = new Map();
  for (const claim of claims) {
    if (!highRiskPredicates.has(claim['谓词/关系'])) continue;
    const key = `${claim['主体 ID']}|${claim['谓词/关系']}|${claim['客体 ID 或值']}`;
    const families = familiesByProposition.get(key) || new Set();
    if (claim['来源家族 ID']) families.add(claim['来源家族 ID']);
    familiesByProposition.set(key, families);
  }
  for (const claim of claims) {
    if (claim['状态'] !== '已采纳' || !highRiskPredicates.has(claim['谓词/关系'])) continue;
    const key = `${claim['主体 ID']}|${claim['谓词/关系']}|${claim['客体 ID 或值']}`;
    const fams = [...(familiesByProposition.get(key) || [])];
    const independentPair = fams.some((a, i) => fams.some((b, j) => j > i && ctx.independentFamilies(a, b)));
    if (!independentPair) {
      errors.push(`${claim['Assertion ID']} 高风险命题采纳时缺两个独立来源家族（独立性按 source-families.csv 派生树判定；清史稿与实录同祖不算独立）`);
    }
  }
  for (const id of ['QH-A-KX-0039', 'QH-A-KX-0040']) {
    if (claimById.get(id)?.['冲突组 ID'] !== 'QH-CF-KX-EMPRESS-DATE') {
      errors.push(`${id} 必须保留册后七月/九月冲突组 QH-CF-KX-EMPRESS-DATE`);
    }
  }
  if (!people.some((row) => row.person_id === 'QH-P-000060')) {
    errors.push('缺少孝昭仁皇后人物 ID QH-P-000060');
  }
  for (const claim of claims) {
    if (claim['主体 ID'] === 'QH-P-000025' && claim['谓词/关系'] === 'invested_as_empress' && /康熙/.test(claim['原始时间表达'])) {
      errors.push(`${claim['Assertion ID']} 不得把孝恭写成康熙朝皇后`);
    }
  }
  if (claimById.get('QH-A-YZ-0032')?.['冲突组 ID'] !== 'QH-CF-YZ-DEATH') {
    errors.push('QH-A-YZ-0032 必须保留崩逝冲突组 QH-CF-YZ-DEATH');
  }
  if (/丹药|圆明园|清溪书屋/.test(`${claimById.get('QH-A-YZ-0032')?.['客体 ID 或值'] || ''}${claimById.get('QH-A-YZ-0032')?.['支持引文'] || ''}`)) {
    errors.push('QH-A-YZ-0032 不得把丹药或圆明园写进本纪崩条');
  }
  if (claimById.get('QH-A-YZ-0030')?.['冲突组 ID'] !== 'QH-CF-YZ-JUNJI'
    || claimById.get('QH-A-YZ-0045')?.['冲突组 ID'] !== 'QH-CF-YZ-JUNJI'
    || claimById.get('QH-A-YZ-0046')?.['冲突组 ID'] !== 'QH-CF-YZ-JUNJI') {
    errors.push('军机处时点须三面挂 QH-CF-YZ-JUNJI：本纪十年、实录七年密办、年表七年军机房');
  }
  if (String(claimById.get('QH-A-YZ-0044')?.['冲突组 ID'] || '').trim()) {
    errors.push('QH-A-YZ-0044 恤赠条不得挂军机冲突组');
  }
  if (/軍機房|军机房/.test(claimById.get('QH-A-YZ-0045')?.['支持引文'] || '')) {
    errors.push('QH-A-YZ-0045 不得把军机房写入实录引文');
  }
  if (!/密為辦理/.test(claimById.get('QH-A-YZ-0045')?.['支持引文'] || '')) {
    errors.push('QH-A-YZ-0045 必须保留密为办理');
  }
  if (claimById.get('QH-A-YZ-0026')?.['冲突组 ID'] !== 'QH-CF-YZ-NIAN-DEATH'
    || claimById.get('QH-A-YZ-0038')?.['冲突组 ID'] !== 'QH-CF-YZ-NIAN-DEATH') {
    errors.push('必须保留年羹尧赐死/自裁冲突组 QH-CF-YZ-NIAN-DEATH');
  }
  if (claimById.get('QH-A-YZ-0029')?.['冲突组 ID'] !== 'QH-CF-YZ-LONGKEDUO-COUNTS'
    || claimById.get('QH-A-YZ-0036')?.['冲突组 ID'] !== 'QH-CF-YZ-LONGKEDUO-COUNTS'
    || claimById.get('QH-A-YZ-0043')?.['冲突组 ID'] !== 'QH-CF-YZ-LONGKEDUO-COUNTS') {
    errors.push('必须保留隆科多五十款/四十一款冲突组 QH-CF-YZ-LONGKEDUO-COUNTS');
  }
  const yz43 = `${claimById.get('QH-A-YZ-0043')?.['支持引文'] || ''}${claimById.get('QH-A-YZ-0043')?.['客体 ID 或值'] || ''}`;
  if (!/四十一/.test(yz43) || !/暢春園外/.test(yz43) || /五十/.test(yz43)) {
    errors.push('QH-A-YZ-0043 必须保留实录四十一款与畅春园外，不得写入本纪五十款');
  }
  const yz44 = `${claimById.get('QH-A-YZ-0044')?.['支持引文'] || ''}${claimById.get('QH-A-YZ-0044')?.['编辑备注'] || ''}`;
  if (/始於此|始于此/.test(claimById.get('QH-A-YZ-0044')?.['支持引文'] || '')) {
    errors.push('QH-A-YZ-0044 不得把本纪「始于此」写入实录引文');
  }
  if (!/策勒克/.test(yz44) || !/辦理軍機大臣/.test(claimById.get('QH-A-YZ-0044')?.['支持引文'] || '')) {
    errors.push('QH-A-YZ-0044 必须保留办理军机大臣议奏追封策勒克');
  }

  if (!chapters.some((row) => row.slug === 'kangxi-01') || !chapters.some((row) => row.slug === 'yongzheng-01')) {
    errors.push('必须同时有康熙即位章与雍正即位章');
  }

  // 已修正的高频纪年误压缩必须进入机器门禁，避免下次批量改写又退回旧口径。
  const htCard = cards.find((row) => row.legacy_emperor_id === 'QH-E-02');
  const htSkeleton = String(htCard?.['重大事件骨架'] || '');
  if (!/1631[^；]*六部/.test(htSkeleton) || !/1636[^；]*内三院/.test(htSkeleton)) {
    errors.push('皇太极研究卡必须分写「1631设六部」与「1636文馆改内三院」');
  }
  const guangxuCard = cards.find((row) => row.legacy_emperor_id === 'QH-E-11');
  const guangxuReign = String(guangxuCard?.['在位口径'] || '');
  if (/1874年底安排帝位/.test(guangxuReign)
    || !/同治十三年十二月/.test(guangxuReign)
    || !/公历1875年1月/.test(guangxuReign)
    || !/光绪元年即位/.test(guangxuReign)
    || !/1875—1908/.test(guangxuReign)) {
    errors.push('光绪研究卡必须区分同治十三年十二月（公历1875年1月）议立与光绪元年即位');
  }
  const htWork = (works || []).find((row) => row.work_id === 'QH-W-004');
  if (!/1631年设六部/.test(htWork?.['内容概述'] || '') || !/1636年文馆改内三院/.test(htWork?.['内容概述'] || '')) {
    errors.push('QH-W-004 必须分写1631六部与1636内三院，不得压成同年');
  }
  const htAccessionChapter = chapters.find((row) => row.slug === 'huangtaiji-01');
  const htTimelineChapter = chapters.find((row) => row.slug === 'huangtaiji-03');
  for (const chapter of [htAccessionChapter, htTimelineChapter].filter(Boolean)) {
    if (!/1626.*继汗位.*1627.*改元天聪/.test(chapter.lede || '')) {
      errors.push(`${chapter.chapter_id} 必须分写1626继汗位、翌年1627改元天聪`);
    }
  }
  const htTimelineRows = (emperorTimeline || []).filter((row) => row.emperor_id === 'QH-E-02');
  const htSuccession = htTimelineRows.find((row) => row.timeline_id === 'TL-HT-002');
  if (!/1627.*改元天聪/.test(htSuccession?.event || '')) {
    errors.push('TL-HT-002 必须注明1626继汗位、翌年1627改元天聪');
  }
  const korea1627 = htTimelineRows.find((row) => row.year === '1627' && /朝鲜/.test(row.event || ''));
  const korea1636 = htTimelineRows.find((row) => row.year === '1636' && /朝鲜/.test(row.event || ''));
  if (!korea1627 || !/丁卯/.test(korea1627.event || '')) errors.push('皇太极年表缺少1627年第一次征朝鲜（丁卯之役）');
  if (!korea1636 || !/1636—1637/.test(korea1636.event || '') || !/丙子/.test(korea1636.event || '')) {
    errors.push('皇太极年表缺少1636—1637年第二次征朝鲜（丙子之役）');
  }
  const korea1627Index = (emperorTimeline || []).findIndex((row) => row.timeline_id === korea1627?.timeline_id);
  const ministries1631Index = (emperorTimeline || []).findIndex((row) => row.timeline_id === 'TL-HT-006');
  if (korea1627Index < 0 || ministries1631Index < 0 || korea1627Index > ministries1631Index) {
    errors.push('皇太极年表物理顺序必须把1627丁卯之役排在1631设六部之前');
  }

  const shunzhiChapter = chapters.find((row) => row.slug === 'shunzhi-01');
  const shunzhiLede = String(shunzhiChapter?.lede || '');
  if (/年号才用顺治/.test(shunzhiLede)
    || !/1643.*盛京.*翌年改元顺治/.test(shunzhiLede)
    || !/1644.*再次.*登极/.test(shunzhiLede)) {
    errors.push('顺治导语必须分写1643盛京即位并定翌年改元、1644北京再次登极');
  }
  const shunzhiRegency = (emperorTimeline || []).find((row) => row.timeline_id === 'TL-SZ-004');
  if (shunzhiRegency?.year !== '1643'
    || !/济尔哈朗/.test(shunzhiRegency?.event || '')
    || !/多尔衮/.test(shunzhiRegency?.event || '')
    || !/辅政|摄政/.test(shunzhiRegency?.event || '')) {
    errors.push('顺治辅政/摄政时间轴必须从1643即位起，并同时保留济尔哈朗与多尔衮');
  }
  const yongzhengTimelineChapter = chapters.find((row) => row.slug === 'yongzheng-06');
  if (/暴毙|猝死/.test(yongzhengTimelineChapter?.lede || '') || !/崩逝|薨/.test(yongzhengTimelineChapter?.lede || '')) {
    errors.push('雍正年表导语只能写有据的崩逝/薨，不得写暴毙或猝死');
  }

  const familyById = new Map((families || []).map((row) => [row.family_id, row]));
  for (const id of ['QH-SF-QSL-QL', 'QH-SF-QSL-JQ']) {
    if (!familyById.has(id)) errors.push(`来源家族缺少 ${id}`);
  }
  const qsgParents = new Set(String(familyById.get('QH-SF-QSG')?.derives_from || '').split(/[；;]/).filter(Boolean));
  for (const id of ['QH-SF-QSL-KX', 'QH-SF-QSL-YZ', 'QH-SF-QSL-QL', 'QH-SF-QSL-JQ']) {
    if (!qsgParents.has(id)) errors.push(`QH-SF-QSG 派生树缺少 ${id}`);
  }

  for (const event of empressTimeline) {
    if (event.person_id === 'QH-P-000025' && event['当时称号'] === '皇后' && /康熙/.test(event['原纪年'])) {
      errors.push(`${event.event_id} 不得把孝恭写成康熙朝皇后`);
    }
  }

  // 皇子卷164
  const princeStatuses = new Set(['入序正文', '早薨附列', '本卷缺号']);
  const missingFourth = princes.filter((row) => row['收录状态'] === '本卷缺号');
  if (missingFourth.length !== 1 || missingFourth[0].person_id !== 'QH-P-000002' || missingFourth[0]['表序'] !== '4') {
    errors.push('卷164缺号行必须且只能是第四子胤禛 QH-P-000002');
  }
  if (princes.filter((row) => row['收录状态'] === '入序正文').length !== 23) {
    errors.push('卷164入序正文应为23人（第一至二十四子缺第四）');
  }
  if (princes.filter((row) => row['收录状态'] === '早薨附列').length !== 11) {
    errors.push('卷164早薨附列应为11人');
  }
  const firstSon = princes.find((row) => row['表序'] === '1');
  if (firstSon?.person_id !== 'QH-P-000003') errors.push('表序第一子必须是胤禔 QH-P-000003');
  for (const prince of princes) {
    if (!knownPersonIds.has(prince.person_id)) errors.push(`${prince.person_id} 皇子表人物未入人物档`);
    if (!princeStatuses.has(prince['收录状态'])) errors.push(`${prince.person_id} 收录状态无效`);
    if (prince['父亲ID'] !== 'QH-P-000001') errors.push(`${prince.person_id} 父亲必须是玄烨`);
    if (prince['生母人物ID'] && !knownPersonIds.has(prince['生母人物ID'])) {
      errors.push(`${prince.person_id} 生母人物ID未知: ${prince['生母人物ID']}`);
    }
    if (prince['收录状态'] === '入序正文' && prince['表序'] === '4') {
      errors.push('第四子不得标为卷164入序正文');
    }
  }

  // 皇女卷166
  const princessStatuses = new Set(['入序受封', '未封', '抚育附列']);
  if (princesses.filter((row) => row['收录状态'] === '入序受封').length !== 8) {
    errors.push('卷166入序受封应为8人');
  }
  if (princesses.filter((row) => row['收录状态'] === '未封').length !== 12) {
    errors.push('卷166未封应为12人');
  }
  const foster = princesses.filter((row) => row['收录状态'] === '抚育附列');
  if (foster.length !== 1 || foster[0].person_id !== 'QH-P-000123' || foster[0]['父亲ID'] === 'QH-P-000001') {
    errors.push('抚育附列必须且只能是纯禧 QH-P-000123，父亲不得写成玄烨');
  }
  const thirdDaughter = princesses.find((row) => row['表序'] === '3');
  if (thirdDaughter?.person_id !== 'QH-P-000021') errors.push('表序第三女必须是荣宪 QH-P-000021');
  if (claimById.get('QH-A-KX-0095')?.['客体 ID 或值'] !== '和硕荣宪公主') {
    errors.push('QH-A-KX-0095 初封必须是和硕荣宪，不得写成固伦');
  }
  if (claimById.get('QH-A-KX-0106')?.['谓词/关系'] !== 'posthumously_advanced_as') {
    errors.push('QH-A-KX-0106 温宪固伦必须标为追进');
  }
  if (claimById.get('QH-A-KX-0110')?.['谓词/关系'] !== 'posthumously_advanced_as') {
    errors.push('QH-A-KX-0110 纯悫固伦必须标为追进');
  }
  for (const princess of princesses) {
    if (!knownPersonIds.has(princess.person_id)) errors.push(`${princess.person_id} 皇女表人物未入人物档`);
    if (!princessStatuses.has(princess['收录状态'])) errors.push(`${princess.person_id} 收录状态无效`);
    if (!princess['表序'] || !princess['规范名']) errors.push(`${princess.person_id} 缺少表序或规范名`);
    if (princess['收录状态'] !== '抚育附列' && princess['父亲ID'] !== 'QH-P-000001') {
      errors.push(`${princess.person_id} 亲生女父亲必须是玄烨`);
    }
    if (princess['生母人物ID'] && !knownPersonIds.has(princess['生母人物ID'])) {
      errors.push(`${princess.person_id} 生母人物ID未知: ${princess['生母人物ID']}`);
    }
  }

  // 皇子/立废冲突组
  if (claimById.get('QH-A-KX-0058')?.['冲突组 ID'] !== 'QH-CF-KX-PRINCE-ORDER'
    || claimById.get('QH-A-KX-0066')?.['冲突组 ID'] !== 'QH-CF-KX-PRINCE-ORDER') {
    errors.push('必须保留第一子/长子冲突组 QH-CF-KX-PRINCE-ORDER');
  }
  for (const id of ['QH-A-KX-0070', 'QH-A-KX-0071']) {
    if (claimById.get(id)?.['冲突组 ID'] !== 'QH-CF-KX-INVEST-DAY') {
      errors.push(`${id} 必须保留立储乙丑/丙寅冲突组 QH-CF-KX-INVEST-DAY`);
    }
  }
  for (const id of ['QH-A-KX-0073', 'QH-A-KX-0074', 'QH-A-KX-0089']) {
    if (claimById.get(id)?.['冲突组 ID'] !== 'QH-CF-KX-DEPOSE-YEAR') {
      errors.push(`${id} 必须保留初废四十六/四十七年冲突组 QH-CF-KX-DEPOSE-YEAR`);
    }
  }
  for (const id of ['QH-A-KX-0081', 'QH-A-KX-0082']) {
    if (claimById.get(id)?.['冲突组 ID'] !== 'QH-CF-KX-DEPOSE2-MONTH') {
      errors.push(`${id} 必须保留再废九月/十月冲突组 QH-CF-KX-DEPOSE2-MONTH`);
    }
  }

  // 储位链：分日绑定与事件类型
  const heirTypes = new Set(['立储', '择吉下谕', '驻跸', '宣示罪状拘执', '废储颁示', '削爵', '削爵幽禁', '奏保被杖', '议储不许', '释放', '复立', '再废锢禁', '告庙', '上书请复立', '薨逝', '上谕转述']);
  const dingchou = heirChain.find((row) => row.event_id === 'QH-HS-0003');
  const dingyou = heirChain.find((row) => row.event_id === 'QH-HS-0004');
  if (!dingchou || !dingyou || dingchou['原纪年'] === dingyou['原纪年']) {
    errors.push('初废拘执与颁废必须分成丁丑、丁酉两日');
  }
  for (const id of ['QH-SU-KX-0234A', 'QH-SU-KX-0234B', 'QH-SU-KX-0234C', 'QH-SU-KX-0234D', 'QH-SU-KX-0234E', 'QH-SU-KX-0237A']) {
    if (!sourceUnitIds.has(id)) errors.push(`储位链缺少实录来源单元 ${id}`);
  }
  const yihai = heirChain.find((row) => row.event_id === 'QH-HS-0016');
  const yunxie = heirChain.find((row) => row.event_id === 'QH-HS-0017');
  const wuxu = heirChain.find((row) => row.event_id === 'QH-HS-0018');
  if (!yihai || !/乙亥/.test(yihai['原纪年']) || yihai['来源单元'] !== 'QH-SU-KX-0234A') {
    errors.push('乙亥驻跸必须绑定实录卷234九月二日条');
  }
  if (!yunxie || yunxie.person_id !== 'QH-P-000015' || yunxie['事件类型'] !== '薨逝') {
    errors.push('允祄薨必须单独成条，不得并入废太子');
  }
  if (!wuxu || !/戊戌/.test(wuxu['原纪年']) || wuxu['来源单元'] !== 'QH-SU-KX-0234E') {
    errors.push('戊戌允禔奏必须绑定实录卷234九月二十五日条');
  }
  if (dingchou['来源单元'] !== 'QH-SU-KX-0234B' || dingyou['来源单元'] !== 'QH-SU-KX-0234D') {
    errors.push('丁丑拘执与丁酉颁废的主来源必须是实录条次');
  }
  if (/剋母|狂易|疯/.test(`${claimById.get('QH-A-KX-0086')?.['客体 ID 或值'] || ''}${claimById.get('QH-A-KX-0089')?.['客体 ID 或值'] || ''}`)) {
    errors.push('实录拘执/颁废主张不得把剋母或狂易写成客体事实');
  }
  for (const event of heirChain) {
    if (!heirTypes.has(event['事件类型'])) errors.push(`${event.event_id} 事件类型无效: ${event['事件类型']}`);
    if (/九子夺嫡/.test(`${event['阶段']}${event['事件类型']}${event['引文']}`)) {
      errors.push(`${event.event_id} 不得把九子夺嫡写成事件`);
    }
  }

  for (const site of historicSites) {
    if (!/^QH-ST-\d{4}$/.test(site.site_id)) errors.push(`${site.site_id} 今地编号必须是 QH-ST-四位数字`);
    if (site['事件'] === '萨尔浒之战' && /兴京|新宾/.test(site['今日'])) {
      errors.push(`${site.site_id} 不得把萨尔浒主战场写成兴京或新宾`);
    }
  }

  for (const id of ['QH-A-KX-0121', 'QH-A-KX-0122', 'QH-A-KX-0123']) {
    if (claimById.get(id)?.['状态'] !== '审核中') {
      errors.push(`${id} 必须保持审核中`);
    }
  }
  for (const claim of claims) {
    const note = `${claim['备注'] || ''}${claim['说明'] || ''}`;
    if (/未打开/.test(note) && /已钉/.test(note)) {
      errors.push(`${claim['Assertion ID']} 备注不得同时写未打开与已钉`);
    }
  }
  for (const row of chronicle) {
    const lo = row['公历下界'];
    const hi = row['公历上界'] || lo;
    if (!lo) continue;
    for (const id of String(row['主张IDs'] || '').split(/[；;]/).map((s) => s.trim()).filter(Boolean)) {
      const claim = claimById.get(id);
      if (!claim) continue;
      const cLo = claim['公历下界'];
      const cHi = claim['公历上界'] || cLo;
      if (cLo && (cLo < lo || cHi > hi)) {
        const conflict = String(row['冲突组'] || '').trim();
        if (conflict && String(claim['冲突组 ID'] || '').trim() === conflict) continue;
        errors.push(`${row.entry_id} 公历 ${lo}–${hi} 盖不住 ${id} 的 ${cLo}–${cHi}`);
      }
    }
  }
  const pendingSets = new Set(
    (ctx.conflictSets || [])
      .filter((row) => /第二面待补|单面/.test(`${row['现行编辑判断'] || ''}${row['保留意见'] || ''}`))
      .map((row) => row.conflict_set_id),
  );
  for (const row of emperorTimeline || []) {
    if (pendingSets.has(row.conflict_set_id)) continue;
    if (/设军机处（军机房）/.test(row.event || '') && !/不择一|待补|待开/.test(row.event || '')) {
      errors.push(`${row.timeline_id} 不得把军机处七年说写成定点`);
    }
  }
}
