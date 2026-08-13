import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCsv } from './lib/csv.mjs';
import { CSV_FILES } from './lib/schema.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const dataDir = path.join(root, 'data');
const errors = [];
const warnings = [];

function load(name) {
  return loadCsv(path.join(dataDir, name), {
    name,
    required: CSV_FILES[name]?.required,
    errors,
  });
}

function exactCount(name, rows, expected) {
  if (rows.length !== expected) errors.push(`${name} 行数 ${rows.length}，应为 ${expected}`);
}

function unique(name, rows, key) {
  const seen = new Set();
  for (const row of rows) {
    if (!row[key]) errors.push(`${name} 存在空 ${key}`);
    else if (seen.has(row[key])) errors.push(`${name} 重复 ${key}: ${row[key]}`);
    seen.add(row[key]);
  }
}

const emperors = load('qing-emperors.csv');
const cards = load('qing-emperor-research-cards.csv');
const portraits = load('emperor-portraits.csv');
const crosswalk = load('entity-id-crosswalk.csv');
const people = load('phase0-people.csv');
const sources = load('source-rights-ledger.csv');
const sourceIndex = load('qing-emperor-source-index.csv');
const tasks = load('task-queue.csv');
const vocab = load('controlled-vocabularies.csv');
const kangxiUnits = load('kangxi-source-units.csv');
const kangxiClaims = load('kangxi-source-claims.csv');
const yongzhengUnits = load('yongzheng-source-units.csv');
const yongzhengClaims = load('yongzheng-source-claims.csv');
const questions = load('golden-questions.csv');
const chapters = load('chapters.csv');
const lanes = load('side-lanes.csv');
const empressTimeline = load('kangxi-empress-timeline.csv');
const princes = load('kangxi-princes.csv');
const heirChain = load('kangxi-heir-chain.csv');
const historicSites = load('historic-sites.csv');
const princesses = load('kangxi-princesses.csv');

for (const [name, rows, expected] of [
  ['qing-emperors.csv', emperors, 12],
  ['qing-emperor-research-cards.csv', cards, 12],
  ['entity-id-crosswalk.csv', crosswalk, 12],
  ['phase0-people.csv', people, 86],
  ['source-rights-ledger.csv', sources, 27],
  ['controlled-vocabularies.csv', vocab, 125],
  ['kangxi-source-units.csv', kangxiUnits, 17],
  ['kangxi-source-claims.csv', kangxiClaims, 92],
  ['yongzheng-source-units.csv', yongzhengUnits, 13],
  ['yongzheng-source-claims.csv', yongzhengClaims, 38],
  ['golden-questions.csv', questions, 60],
  ['chapters.csv', chapters, 20],
  ['kangxi-empress-timeline.csv', empressTimeline, 19],
  ['kangxi-princes.csv', princes, 35],
  ['kangxi-heir-chain.csv', heirChain, 18],
  ['kangxi-princesses.csv', princesses, 8],
]) exactCount(name, rows, expected);

for (const [name, rows, key] of [
  ['qing-emperors.csv', emperors, 'emperor_id'],
  ['qing-emperor-research-cards.csv', cards, 'person_id'],
  ['emperor-portraits.csv', portraits, 'visual_id'],
  ['entity-id-crosswalk.csv', crosswalk, 'legacy_emperor_id'],
  ['entity-id-crosswalk.csv', crosswalk, 'person_id'],
  ['phase0-people.csv', people, 'person_id'],
  ['source-rights-ledger.csv', sources, 'source_id'],
  ['qing-emperor-source-index.csv', sourceIndex, 'index_id'],
  ['task-queue.csv', tasks, 'task_id'],
  ['kangxi-source-units.csv', kangxiUnits, 'source_unit_id'],
  ['kangxi-source-claims.csv', kangxiClaims, 'Assertion ID'],
  ['yongzheng-source-units.csv', yongzhengUnits, 'source_unit_id'],
  ['yongzheng-source-claims.csv', yongzhengClaims, 'Assertion ID'],
  ['golden-questions.csv', questions, 'question_id'],
  ['chapters.csv', chapters, 'chapter_id'],
  ['chapters.csv', chapters, 'slug'],
  ['side-lanes.csv', lanes, 'lane_id'],
  ['kangxi-empress-timeline.csv', empressTimeline, 'event_id'],
  ['kangxi-princes.csv', princes, 'person_id'],
  ['kangxi-princesses.csv', princesses, 'person_id'],
  ['kangxi-heir-chain.csv', heirChain, 'event_id'],
  ['historic-sites.csv', historicSites, 'site_id'],
]) unique(name, rows, key);

const emperorIds = new Set(emperors.map((r) => r.emperor_id));
const qsgVolumes = ['卷1 ', '卷2', '卷4', '卷6', '卷9 ', '卷10', '卷16', '卷17', '卷20', '卷21', '卷23', '卷25 '];
emperors.forEach((row, i) => {
  if (!row['清史稿本纪'].startsWith(qsgVolumes[i])) errors.push(`${row.emperor_id} 清史稿卷次异常: ${row['清史稿本纪']}`);
  if (!/^https:\/\//.test(row['故宫人物页'])) errors.push(`${row.emperor_id} 故宫人物页不是 HTTPS`);
});

const crosswalkByLegacy = new Map(crosswalk.map((r) => [r.legacy_emperor_id, r]));
for (const emperor of emperors) {
  const map = crosswalkByLegacy.get(emperor.emperor_id);
  if (!map) errors.push(`${emperor.emperor_id} 缺少人物 ID 对照`);
  else if (map.canonical_name !== emperor['规范名']) errors.push(`${emperor.emperor_id} 对照姓名不一致`);
}

const cardIds = new Set(cards.map((r) => r.person_id));
for (const map of crosswalk) {
  if (!cardIds.has(map.person_id)) errors.push(`${map.person_id} 缺少十二帝研究卡`);
}

if (portraits.length < 19) errors.push(`emperor-portraits.csv 行数 ${portraits.length}，至少应为 19`);
const portraitRoles = new Set(['默认朝服像', '其他真迹', '相关史迹', '御笔书法', '奏折朱批']);
const greenLicenses = new Set(['Public domain', 'CC0', 'CC BY 2.0', 'CC BY-SA 2.0', 'CC BY 3.0', 'CC BY-SA 3.0', 'CC BY 4.0', 'CC BY-SA 4.0']);
const primaryByEmperor = new Map();
for (const portrait of portraits) {
  if (!emperorIds.has(portrait.emperor_id)) errors.push(`${portrait.visual_id} 引用了未知皇帝 ${portrait.emperor_id}`);
  if (!portraitRoles.has(portrait['展示角色'])) errors.push(`${portrait.visual_id} 展示角色无效: ${portrait['展示角色']}`);
  if (!portrait['关键标注'] || !portrait['画面解析']) errors.push(`${portrait.visual_id} 缺少标注或解析`);
  if (!/^https:\/\//.test(portrait['文件页'])) errors.push(`${portrait.visual_id} 文件页不是 HTTPS`);
  if (portrait['预览文件'] && !/^https:\/\//.test(portrait['预览文件'])) errors.push(`${portrait.visual_id} 预览文件不是 HTTPS`);
  if (portrait['权利颜色'] === '绿') {
    if (!greenLicenses.has(portrait['文件页标示许可'])) errors.push(`${portrait.visual_id} 绿色许可无效: ${portrait['文件页标示许可']}`);
    if (portrait['可本地保存'] !== '是' || portrait['可公开展示'] !== '是') {
      errors.push(`${portrait.visual_id} 绿色使用字段不一致`);
    }
    if (!portrait['预览文件']) errors.push(`${portrait.visual_id} 绿色资源缺少预览文件`);
  } else if (portrait['权利颜色'] === '黄') {
    if (portrait['可公开展示'] !== '仅外链') errors.push(`${portrait.visual_id} 黄色资源必须仅外链`);
    if (portrait['预览文件']) errors.push(`${portrait.visual_id} 黄色资源不应嵌入预览图`);
  } else {
    errors.push(`${portrait.visual_id} 权利颜色无效: ${portrait['权利颜色']}`);
  }
  if (['奏折朱批', '御笔书法'].includes(portrait['展示角色']) && !portrait['释文']) {
    warnings.push(`${portrait.visual_id} 缺少释文`);
  }
  if (portrait['展示角色'] === '默认朝服像') {
    if (portrait['权利颜色'] !== '绿') errors.push(`${portrait.visual_id} 默认朝服像必须为绿色`);
    if (!portrait['卡片钩子']) errors.push(`${portrait.visual_id} 默认朝服像缺少卡片钩子`);
    if (primaryByEmperor.has(portrait.emperor_id)) errors.push(`${portrait.emperor_id} 存在多张默认朝服像`);
    primaryByEmperor.set(portrait.emperor_id, portrait.visual_id);
  }
}
for (const emperorId of emperorIds) {
  if (!primaryByEmperor.has(emperorId)) errors.push(`${emperorId} 缺少默认朝服像`);
}

for (const row of sourceIndex) {
  if (row.emperor_id !== 'ALL' && !emperorIds.has(row.emperor_id)) errors.push(`${row.index_id} 范围值无效: ${row.emperor_id}`);
}

const taskStates = new Set(['未开始', '进行中', '待审核', '已完成', '阻塞', '取消']);
for (const task of tasks) {
  if (task.emperor_id !== 'ALL' && !emperorIds.has(task.emperor_id)) errors.push(`${task.task_id} 范围值无效: ${task.emperor_id}`);
  if (!taskStates.has(task['状态'])) errors.push(`${task.task_id} 状态无效: ${task['状态']}`);
}

for (const source of sources) {
  if (!['绿', '黄', '红'].includes(source['权利颜色'])) errors.push(`${source.source_id} 权利颜色无效`);
  if (!/^https:\/\//.test(source['资源网址'])) warnings.push(`${source.source_id} 资源网址需人工确认`);
}

const sourceIds = new Set(sources.map((r) => r.source_id));
const allUnits = [...kangxiUnits, ...yongzhengUnits];
const allClaims = [...kangxiClaims, ...yongzhengClaims];
const sourceUnitIds = new Set(allUnits.map((r) => r.source_unit_id));
for (const unit of allUnits) {
  if (!sourceIds.has(unit.source_entity_id)) errors.push(`${unit.source_unit_id} 引用了未知来源 ${unit.source_entity_id}`);
  if (!/^https:\/\//.test(unit['直接记录网址'])) errors.push(`${unit.source_unit_id} 直接记录网址无效`);
}
for (const claim of allClaims) {
  if (!sourceUnitIds.has(claim['来源实体 ID'])) errors.push(`${claim['Assertion ID']} 引用了未知来源单元 ${claim['来源实体 ID']}`);
  if (!claim['卷页/档号/图像定位'] || !claim['支持引文']) errors.push(`${claim['Assertion ID']} 缺少定位或支持引文`);
  if (!claim['公历下界'] || !claim['公历上界']) errors.push(`${claim['Assertion ID']} 缺少公历对照`);
  if (claim['状态'] === '已采纳') errors.push(`${claim['Assertion ID']} 未经 H1 抽查却标为已采纳`);
  if (claim['Assertion ID'] === 'QH-A-KX-0037' && /畅春园|清溪书屋/.test(`${claim['客体 ID 或值']}${claim['支持引文']}`)) {
    errors.push('QH-A-KX-0037 不得把寝宫改写成畅春园或清溪书屋');
  }
}

const claimById = new Map(allClaims.map((row) => [row['Assertion ID'], row]));
for (const id of ['QH-A-KX-0039', 'QH-A-KX-0040']) {
  if (claimById.get(id)?.['冲突组 ID'] !== 'QH-CF-KX-EMPRESS-DATE') {
    errors.push(`${id} 必须保留册后七月/九月冲突组 QH-CF-KX-EMPRESS-DATE`);
  }
}
if (!people.some((row) => row.person_id === 'QH-P-000060')) {
  errors.push('缺少孝昭仁皇后人物 ID QH-P-000060');
}
for (const claim of allClaims) {
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
if (claimById.get('QH-A-YZ-0030')?.['冲突组 ID'] !== 'QH-CF-YZ-JUNJI') {
  errors.push('QH-A-YZ-0030 必须保留军机处冲突组 QH-CF-YZ-JUNJI');
}
if (claimById.get('QH-A-YZ-0026')?.['冲突组 ID'] !== 'QH-CF-YZ-NIAN-DEATH'
  || claimById.get('QH-A-YZ-0038')?.['冲突组 ID'] !== 'QH-CF-YZ-NIAN-DEATH') {
  errors.push('必须保留年羹尧赐死/自裁冲突组 QH-CF-YZ-NIAN-DEATH');
}
if (claimById.get('QH-A-YZ-0029')?.['冲突组 ID'] !== 'QH-CF-YZ-LONGKEDUO-COUNTS'
  || claimById.get('QH-A-YZ-0036')?.['冲突组 ID'] !== 'QH-CF-YZ-LONGKEDUO-COUNTS') {
  errors.push('必须保留隆科多五十款/四十一款冲突组 QH-CF-YZ-LONGKEDUO-COUNTS');
}

const questionTypes = new Set(['事实查询', '关系路径', '版本冲突', '无证据拒答']);
const questionActions = new Set(['返回答案', '并陈冲突', '拒绝作答']);
for (const row of questions) {
  if (!questionTypes.has(row['类别'])) errors.push(`${row.question_id} 类别无效: ${row['类别']}`);
  if (!questionActions.has(row['期望行为'])) errors.push(`${row.question_id} 期望行为无效: ${row['期望行为']}`);
  if (!row['问题'] || !row['路由']) errors.push(`${row.question_id} 缺少问题或路由`);
  if (row['期望行为'] === '拒绝作答' && !row['拒答说明']) {
    errors.push(`${row.question_id} 拒答题缺少拒答说明`);
  }
  if (row['期望行为'] !== '拒绝作答' && !row['可公开答案']) {
    errors.push(`${row.question_id} 缺少可公开答案`);
  }
}
const refuseCount = questions.filter((row) => row['类别'] === '无证据拒答').length;
const conflictCount = questions.filter((row) => row['类别'] === '版本冲突').length;
if (refuseCount < 10) errors.push(`无证据拒答黄金问题 ${refuseCount} 道，至少应为 10`);
if (conflictCount < 10) errors.push(`版本冲突黄金问题 ${conflictCount} 道，至少应为 10`);

const chapterEras = new Set(['天命', '天聪', '顺治', '康熙', '雍正', '乾隆', '嘉庆', '道光', '咸丰', '同治', '光绪', '宣统']);
const knownRoutes = new Set(['#/kangxi', '#/yongzheng', '#/succession', '#/empresses', '#/princes', '#/lanes']);
const siteIds = new Set(historicSites.map((row) => row.site_id));
const laneIds = new Set(lanes.map((row) => row.lane_id));
const emperorPersonIds = new Set(crosswalk.map((row) => row.person_id));
const chapterPersons = new Set();
for (const row of chapters) {
  if (!chapterEras.has(row.era)) errors.push(`${row.chapter_id} 朝次无效: ${row.era}`);
  if (!row.title || !row.lede || !row.file) errors.push(`${row.chapter_id} 缺少标题、导语或文件`);
  if (!row.person_id) errors.push(`${row.chapter_id} 缺少 person_id`);
  else if (!emperorPersonIds.has(row.person_id)) errors.push(`${row.chapter_id} 引用了未知皇帝人物 ${row.person_id}`);
  else chapterPersons.add(row.person_id);
  const chapterFile = path.join(root, 'content', row.file);
  if (!fs.existsSync(chapterFile)) errors.push(`${row.chapter_id} 找不到正文 ${row.file}`);
  for (const unitId of String(row.unit_ids || '').split(/[；;]/).map((item) => item.trim()).filter(Boolean)) {
    if (!sourceUnitIds.has(unitId)) errors.push(`${row.chapter_id} 引用了未知来源单元 ${unitId}`);
  }
  for (const href of String(row.related || '').split(/[；;]/).map((item) => item.trim()).filter(Boolean)) {
    const siteId = href.match(/^#\/site\/(QH-ST-\d+)$/)?.[1];
    const laneId = href.match(/^#\/lane\/(QH-L-\d+)$/)?.[1];
    const personId = href.match(/^#\/person\/(QH-P-\d+)$/)?.[1];
    if (siteId) {
      if (!siteIds.has(siteId)) errors.push(`${row.chapter_id} 引用了未知今地 ${siteId}`);
    } else if (laneId) {
      if (!laneIds.has(laneId)) errors.push(`${row.chapter_id} 引用了未知侧记 ${laneId}`);
    } else if (personId) {
      if (!emperorPersonIds.has(personId) && !people.some((p) => p.person_id === personId)) {
        errors.push(`${row.chapter_id} 引用了未知人物 ${personId}`);
      }
    } else if (!knownRoutes.has(href)) {
      errors.push(`${row.chapter_id} 相关链接无法解析: ${href}`);
    }
  }
}
if (!chapters.some((row) => row.slug === 'kangxi-01') || !chapters.some((row) => row.slug === 'yongzheng-01')) {
  errors.push('必须同时有康熙即位章与雍正即位章');
}
for (const personId of emperorPersonIds) {
  if (!chapterPersons.has(personId)) errors.push(`皇帝 ${personId} 尚无可读章节`);
}

if (lanes.length < 12) errors.push(`side-lanes.csv 行数 ${lanes.length}，至少应为 12`);
const laneColumns = new Set(['后宫趣事', '野史对照', '罕读史料']);
const laneEvidence = new Set(['E1单源回查', 'S二手转述', 'C来源冲突', 'U待核', 'X目前不可证']);
const knownPersonIds = new Set([
  ...people.map((r) => r.person_id),
  ...crosswalk.map((r) => r.person_id),
]);
const timelineTypes = new Set(['册立', '册封', '晋封', '生育', '崩逝', '初谥', '改谥', '安葬', '尊封', '时态说明']);
for (const event of empressTimeline) {
  if (!knownPersonIds.has(event.person_id)) errors.push(`${event.event_id} 引用了未知人物 ${event.person_id}`);
  if (!sourceUnitIds.has(event['来源单元'])) errors.push(`${event.event_id} 引用了未知来源单元 ${event['来源单元']}`);
  if (!timelineTypes.has(event['事件类型'])) errors.push(`${event.event_id} 事件类型无效: ${event['事件类型']}`);
  if (!event['引文'] || !event['当时称号']) errors.push(`${event.event_id} 缺少当时称号或引文`);
  if (event.person_id === 'QH-P-000025' && event['当时称号'] === '皇后' && /康熙/.test(event['原纪年'])) {
    errors.push(`${event.event_id} 不得把孝恭写成康熙朝皇后`);
  }
}
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
for (const princess of princesses) {
  if (!knownPersonIds.has(princess['生母ID'])) errors.push(`${princess.person_id} 生母ID未知: ${princess['生母ID']}`);
  if (!princess['表序'] || !princess['规范名']) errors.push(`${princess.person_id} 缺少表序或规范名`);
}
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
const heirTypes = new Set(['立储', '驻跸', '宣示罪状拘执', '废储颁示', '削爵', '削爵幽禁', '奏保被杖', '议储不许', '释放', '复立', '再废锢禁', '告庙', '上书请复立', '薨逝', '上谕转述']);
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
  if (!knownPersonIds.has(event.person_id)) errors.push(`${event.event_id} 引用了未知人物 ${event.person_id}`);
  if (!sourceUnitIds.has(event['来源单元'])) errors.push(`${event.event_id} 引用了未知来源单元 ${event['来源单元']}`);
  if (!heirTypes.has(event['事件类型'])) errors.push(`${event.event_id} 事件类型无效: ${event['事件类型']}`);
  if (!event['引文'] || !event['阶段']) errors.push(`${event.event_id} 缺少阶段或引文`);
  if (/九子夺嫡/.test(`${event['阶段']}${event['事件类型']}${event['引文']}`)) {
    errors.push(`${event.event_id} 不得把九子夺嫡写成事件`);
  }
  if (event['主张 ID'] && !claimById.has(event['主张 ID'])) {
    errors.push(`${event.event_id} 引用了未知主张 ${event['主张 ID']}`);
  }
}
for (const lane of lanes) {
  if (!laneColumns.has(lane['栏目'])) errors.push(`${lane.lane_id} 栏目无效: ${lane['栏目']}`);
  if (!laneEvidence.has(lane['证据状态'])) errors.push(`${lane.lane_id} 证据状态无效: ${lane['证据状态']}`);
  if (!['绿', '黄', '红'].includes(lane['权利颜色'])) errors.push(`${lane.lane_id} 权利颜色无效`);
  if (!lane['标题'] || !lane['差异或读法'] || !lane['使用说明']) errors.push(`${lane.lane_id} 缺少标题、读法或使用说明`);
  if (lane['栏目'] === '罕读史料' && !lane['罕读原因']) errors.push(`${lane.lane_id} 罕读史料缺少罕读原因`);
  if (lane['栏目'] === '野史对照' && !lane['野史笔记或影视怎么写']) errors.push(`${lane.lane_id} 野史对照缺少野史说法`);
  for (const pid of (lane['相关人物ID'] || '').split(/[；;]/).map((item) => item.trim()).filter(Boolean)) {
    if (!knownPersonIds.has(pid)) errors.push(`${lane.lane_id} 引用了未知人物 ${pid}`);
  }
}

if (historicSites.length < 5) errors.push(`historic-sites.csv 行数 ${historicSites.length}，至少应为 5`);
const siteEvidence = new Set(['E1单源回查', 'S二手索引', 'C来源冲突', 'U待核', 'X目前不可证']);
function splitIds(value) {
  return String(value || '').split(/[；;]/).map((item) => item.trim()).filter(Boolean);
}
for (const site of historicSites) {
  if (!/^QH-ST-\d{4}$/.test(site.site_id)) errors.push(`${site.site_id} 今地编号必须是 QH-ST-四位数字`);
  if (!site['事件'] || !site['当时'] || !site['今日'] || !site['今地说明'] || !site['边界'] || !site['卡片钩子']) {
    errors.push(`${site.site_id} 缺少事件、当时、今日、说明、边界或钩子`);
  }
  if (site['首页'] && !/^\d+$/.test(site['首页'])) {
    errors.push(`${site.site_id} 首页序号必须是正整数`);
  }
  if (!siteEvidence.has(site['证据状态'])) errors.push(`${site.site_id} 证据状态无效: ${site['证据状态']}`);
  if (!['绿', '黄'].includes(site['权利颜色'])) errors.push(`${site.site_id} 权利颜色无效: ${site['权利颜色']}`);
  if (!/^https:\/\//.test(site['文件页'])) errors.push(`${site.site_id} 文件页不是 HTTPS`);
  if (site['权利颜色'] === '绿') {
    if (!greenLicenses.has(site['文件页标示许可'])) errors.push(`${site.site_id} 绿色许可无效: ${site['文件页标示许可']}`);
    if (!site['预览文件'] || !/^https:\/\//.test(site['预览文件'])) errors.push(`${site.site_id} 绿色资源缺少 HTTPS 预览文件`);
  } else if (site['预览文件']) {
    errors.push(`${site.site_id} 黄色资源不应嵌入预览图`);
  }
  for (const emperorId of splitIds(site['相关皇帝ID'])) {
    if (!emperorIds.has(emperorId)) errors.push(`${site.site_id} 引用了未知皇帝 ${emperorId}`);
  }
  for (const personId of splitIds(site['相关人物ID'])) {
    if (!knownPersonIds.has(personId)) errors.push(`${site.site_id} 引用了未知人物 ${personId}`);
  }
  if (site['事件'] === '萨尔浒之战' && /兴京|新宾/.test(site['今日'])) {
    errors.push(`${site.site_id} 不得把萨尔浒主战场写成兴京或新宾`);
  }
}
const homeRanks = historicSites.map((row) => row['首页']).filter(Boolean);
if (new Set(homeRanks).size !== homeRanks.length) errors.push('historic-sites.csv 首页序号重复');
if (homeRanks.length < 8) errors.push(`首页精选今地 ${homeRanks.length} 条，至少应为 8`);

const summary = {
  emperors: emperors.length,
  research_cards: cards.length,
  portraits: portraits.length,
  people: people.length,
  sources: sources.length,
  source_index: sourceIndex.length,
  tasks: tasks.length,
  controlled_terms: vocab.length,
  kangxi_source_units: kangxiUnits.length,
  kangxi_reviewed_claims: kangxiClaims.length,
  yongzheng_source_units: yongzhengUnits.length,
  yongzheng_reviewed_claims: yongzhengClaims.length,
  golden_questions: questions.length,
  chapters: chapters.length,
  empress_timeline: empressTimeline.length,
  kangxi_princes: princes.length,
  kangxi_princesses: princesses.length,
  kangxi_heir_chain: heirChain.length,
  historic_sites: historicSites.length,
  side_lanes: lanes.length,
  errors: errors.length,
  warnings: warnings.length,
};

console.log(JSON.stringify(summary, null, 2));
if (warnings.length) console.log(`WARNINGS\n- ${warnings.join('\n- ')}`);
if (errors.length) {
  console.error(`ERRORS\n- ${errors.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('PASS: CSV 身份、卷次、许可、范围值和引用一致性检查通过。');
}
