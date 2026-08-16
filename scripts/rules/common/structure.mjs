// 朝代无关的结构检查：权利色、外键、枚举、章节链接。
// 清史专属不变量（卷次、冲突组、圣祖系人数等）留在 rules/qing.mjs。

import fs from 'node:fs';
import path from 'node:path';

const GREEN_LICENSES = new Set([
  'Public domain', 'CC0',
  'CC BY 2.0', 'CC BY-SA 2.0',
  'CC BY 3.0', 'CC BY-SA 3.0',
  'CC BY 4.0', 'CC BY-SA 4.0',
]);
const RIGHTS = new Set(['绿', '黄', '红']);
const PORTRAIT_ROLES = new Set(['默认朝服像', '其他真迹', '相关史迹', '御笔书法', '奏折朱批']);
const TASK_STATES = new Set(['未开始', '进行中', '待审核', '已完成', '阻塞', '取消']);
const QUESTION_TYPES = new Set(['事实查询', '关系路径', '版本冲突', '无证据拒答']);
const QUESTION_ACTIONS = new Set(['返回答案', '并陈冲突', '拒绝作答']);
const LANE_COLUMNS = new Set(['后宫趣事', '野史对照', '罕读史料']);
const REVIEW_TRANSCRIPT = new Set(['E1单源回查', 'S二手转述', 'C来源冲突', 'U待核', 'X目前不可证']);
const REVIEW_INDEX = new Set(['E1单源回查', 'S二手索引', 'C来源冲突', 'U待核', 'X目前不可证']);
const TIMELINE_TYPES = new Set(['册立', '册封', '晋封', '生育', '崩逝', '初谥', '改谥', '安葬', '尊封', '时态说明']);

function splitIds(value) {
  return String(value || '').split(/[；;]/).map((item) => item.trim()).filter(Boolean);
}

function httpsOk(value) {
  return /^https:\/\//.test(value || '');
}

export function check(ctx) {
  const {
    errors, warnings, contentDir,
    emperors, portraits, crosswalk, people, sources, sourceIndex, tasks, vocab,
    units, claims, questions, chapters, lanes, empressTimeline,
    heirChain, historicSites, works,
  } = ctx;

  const emperorIds = new Set(emperors.map((r) => r.emperor_id));
  const crosswalkByLegacy = new Map(crosswalk.map((r) => [r.legacy_emperor_id, r]));
  const knownPersonIds = new Set([...people.map((r) => r.person_id), ...crosswalk.map((r) => r.person_id)]);
  const sourceIds = new Set(sources.map((r) => r.source_id));
  const sourceUnitIds = new Set(units.map((r) => r.source_unit_id));
  const claimById = new Map(claims.map((row) => [row['Assertion ID'], row]));
  const siteIds = new Set(historicSites.map((row) => row.site_id));
  const laneIds = new Set(lanes.map((row) => row.lane_id));
  const emperorPersonIds = new Set(crosswalk.map((row) => row.person_id));
  const chapterSlugs = new Set(chapters.map((row) => row.slug));

  // 展示 ID 对照
  for (const emperor of emperors) {
    const map = crosswalkByLegacy.get(emperor.emperor_id);
    if (!map) errors.push(`${emperor.emperor_id} 缺少人物 ID 对照`);
    else if (map.canonical_name !== emperor['规范名']) errors.push(`${emperor.emperor_id} 对照姓名不一致`);
  }

  // 画像：角色、权利一致性、默认朝服像
  const primaryByEmperor = new Map();
  for (const portrait of portraits) {
    if (!emperorIds.has(portrait.emperor_id)) errors.push(`${portrait.visual_id} 引用了未知皇帝 ${portrait.emperor_id}`);
    if (!PORTRAIT_ROLES.has(portrait['展示角色'])) errors.push(`${portrait.visual_id} 展示角色无效: ${portrait['展示角色']}`);
    if (!portrait['关键标注'] || !portrait['画面解析']) errors.push(`${portrait.visual_id} 缺少标注或解析`);
    if (!httpsOk(portrait['文件页'])) errors.push(`${portrait.visual_id} 文件页不是 HTTPS`);
    if (portrait['预览文件'] && !httpsOk(portrait['预览文件'])) errors.push(`${portrait.visual_id} 预览文件不是 HTTPS`);
    if (portrait['权利颜色'] === '绿') {
      if (!GREEN_LICENSES.has(portrait['文件页标示许可'])) errors.push(`${portrait.visual_id} 绿色许可无效: ${portrait['文件页标示许可']}`);
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

  // 来源索引与任务
  for (const row of sourceIndex) {
    if (row.emperor_id !== 'ALL' && !emperorIds.has(row.emperor_id)) errors.push(`${row.index_id} 范围值无效: ${row.emperor_id}`);
  }
  for (const task of tasks) {
    if (task.emperor_id !== 'ALL' && !emperorIds.has(task.emperor_id)) errors.push(`${task.task_id} 范围值无效: ${task.emperor_id}`);
    if (!TASK_STATES.has(task['状态'])) errors.push(`${task.task_id} 状态无效: ${task['状态']}`);
  }

  // 来源台账
  for (const source of sources) {
    if (!RIGHTS.has(source['权利颜色'])) errors.push(`${source.source_id} 权利颜色无效`);
    if (!httpsOk(source['资源网址'])) warnings.push(`${source.source_id} 资源网址需人工确认`);
  }

  // 来源单元与主张：引用、定位、已采纳具名复核
  for (const unit of units) {
    if (!sourceIds.has(unit.source_entity_id)) errors.push(`${unit.source_unit_id} 引用了未知来源 ${unit.source_entity_id}`);
    if (!httpsOk(unit['直接记录网址'])) errors.push(`${unit.source_unit_id} 直接记录网址无效`);
  }
  const predicates = new Set(
    (vocab || []).filter((r) => r.scheme_code === 'assertion_predicate' && r['是否启用'] !== 'false').map((r) => r.term_code),
  );
  for (const claim of claims) {
    if (!sourceUnitIds.has(claim['来源实体 ID'])) errors.push(`${claim['Assertion ID']} 引用了未知来源单元 ${claim['来源实体 ID']}`);
    if (!claim['卷页/档号/图像定位'] || !claim['支持引文']) errors.push(`${claim['Assertion ID']} 缺少定位或支持引文`);
    if (!claim['公历下界'] || !claim['公历上界']) errors.push(`${claim['Assertion ID']} 缺少公历对照`);
    if (claim['状态'] === '已采纳' && !String(claim['复核人'] || '').trim()) {
      errors.push(`${claim['Assertion ID']} 标为已采纳但复核人为空；H1 抽查必须由具名复核人完成`);
    }
    const pred = claim['谓词/关系'];
    if (pred && predicates.size && !predicates.has(pred)) {
      errors.push(`${claim['Assertion ID']} 谓词未登记: ${pred}`);
    }
  }

  // 黄金问题
  for (const row of questions) {
    if (!QUESTION_TYPES.has(row['类别'])) errors.push(`${row.question_id} 类别无效: ${row['类别']}`);
    if (!QUESTION_ACTIONS.has(row['期望行为'])) errors.push(`${row.question_id} 期望行为无效: ${row['期望行为']}`);
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

  // 章节：文件、外键、相关链接
  const chapterPersons = new Set();
  for (const row of chapters) {
    if (!row.title || !row.lede || !row.file) errors.push(`${row.chapter_id} 缺少标题、导语或文件`);
    if (!row.person_id) errors.push(`${row.chapter_id} 缺少 person_id`);
    else if (!emperorPersonIds.has(row.person_id)) errors.push(`${row.chapter_id} 引用了未知皇帝人物 ${row.person_id}`);
    else chapterPersons.add(row.person_id);
    const chapterFile = path.join(contentDir, row.file);
    if (!fs.existsSync(chapterFile)) errors.push(`${row.chapter_id} 找不到正文 ${row.file}`);
    for (const unitId of splitIds(row.unit_ids)) {
      if (!sourceUnitIds.has(unitId)) errors.push(`${row.chapter_id} 引用了未知来源单元 ${unitId}`);
    }
    for (const href of splitIds(row.related)) {
      const sId = href.match(/^#\/site\/([^/?#]+)$/)?.[1];
      const lId = href.match(/^#\/lane\/([^/?#]+)$/)?.[1];
      const pId = href.match(/^#\/person\/([^/?#]+)$/)?.[1];
      const cSlug = href.match(/^#\/chapter\/([^/?#]+)$/)?.[1];
      if (sId) {
        if (!siteIds.has(sId)) errors.push(`${row.chapter_id} 引用了未知今地 ${sId}`);
      } else if (lId) {
        if (!laneIds.has(lId)) errors.push(`${row.chapter_id} 引用了未知侧记 ${lId}`);
      } else if (pId) {
        if (!emperorPersonIds.has(pId) && !people.some((p) => p.person_id === pId)) {
          errors.push(`${row.chapter_id} 引用了未知人物 ${pId}`);
        }
      } else if (cSlug) {
        if (!chapterSlugs.has(cSlug)) errors.push(`${row.chapter_id} 引用了未知章节 ${cSlug}`);
      } else if (!/^#\//.test(href)) {
        errors.push(`${row.chapter_id} 相关链接无法解析: ${href}`);
      }
    }
  }
  for (const personId of emperorPersonIds) {
    if (!chapterPersons.has(personId)) errors.push(`皇帝 ${personId} 尚无可读章节`);
  }

  // 侧记
  if (lanes.length < 12) errors.push(`side-lanes.csv 行数 ${lanes.length}，至少应为 12`);
  for (const lane of lanes) {
    if (!LANE_COLUMNS.has(lane['栏目'])) errors.push(`${lane.lane_id} 栏目无效: ${lane['栏目']}`);
    if (!REVIEW_TRANSCRIPT.has(lane['证据状态'])) errors.push(`${lane.lane_id} 证据状态无效: ${lane['证据状态']}`);
    if (!RIGHTS.has(lane['权利颜色'])) errors.push(`${lane.lane_id} 权利颜色无效`);
    if (!lane['标题'] || !lane['差异或读法'] || !lane['使用说明']) errors.push(`${lane.lane_id} 缺少标题、读法或使用说明`);
    if (lane['栏目'] === '罕读史料' && !lane['罕读原因']) errors.push(`${lane.lane_id} 罕读史料缺少罕读原因`);
    if (lane['栏目'] === '野史对照' && !lane['野史笔记或影视怎么写']) errors.push(`${lane.lane_id} 野史对照缺少野史说法`);
    for (const pid of splitIds(lane['相关人物ID'])) {
      if (!knownPersonIds.has(pid)) errors.push(`${lane.lane_id} 引用了未知人物 ${pid}`);
    }
  }

  // 后妃时态轴：外键与回查状态。孝恭等朝专属规则在 qing.mjs。
  for (const event of empressTimeline) {
    if (!knownPersonIds.has(event.person_id)) errors.push(`${event.event_id} 引用了未知人物 ${event.person_id}`);
    if (!sourceUnitIds.has(event['来源单元'])) errors.push(`${event.event_id} 引用了未知来源单元 ${event['来源单元']}`);
    if (!TIMELINE_TYPES.has(event['事件类型'])) errors.push(`${event.event_id} 事件类型无效: ${event['事件类型']}`);
    if (!REVIEW_TRANSCRIPT.has(event['回查状态'])) errors.push(`${event.event_id} 回查状态无效: ${event['回查状态']}`);
    if (!event['引文'] || !event['当时称号']) errors.push(`${event.event_id} 缺少当时称号或引文`);
  }

  // 储位链：外键与回查状态。分日绑定、事件类型枚举在 qing.mjs。
  for (const event of heirChain) {
    if (!knownPersonIds.has(event.person_id)) errors.push(`${event.event_id} 引用了未知人物 ${event.person_id}`);
    if (!sourceUnitIds.has(event['来源单元'])) errors.push(`${event.event_id} 引用了未知来源单元 ${event['来源单元']}`);
    if (!REVIEW_TRANSCRIPT.has(event['回查状态'])) errors.push(`${event.event_id} 回查状态无效: ${event['回查状态']}`);
    if (!event['引文'] || !event['阶段']) errors.push(`${event.event_id} 缺少阶段或引文`);
    if (event['主张 ID'] && !claimById.has(event['主张 ID'])) {
      errors.push(`${event.event_id} 引用了未知主张 ${event['主张 ID']}`);
    }
  }

  // 今地：字段、权利、首页。编号格式与萨尔浒在 qing.mjs。
  if (historicSites.length < 5) errors.push(`historic-sites.csv 行数 ${historicSites.length}，至少应为 5`);
  for (const site of historicSites) {
    if (!site['事件'] || !site['当时'] || !site['今日'] || !site['今地说明'] || !site['边界'] || !site['卡片钩子']) {
      errors.push(`${site.site_id} 缺少事件、当时、今日、说明、边界或钩子`);
    }
    if (site['首页'] && !/^\d+$/.test(site['首页'])) {
      errors.push(`${site.site_id} 首页序号必须是正整数`);
    }
    if (!REVIEW_INDEX.has(site['证据状态'])) errors.push(`${site.site_id} 证据状态无效: ${site['证据状态']}`);
    if (!['绿', '黄'].includes(site['权利颜色'])) errors.push(`${site.site_id} 权利颜色无效: ${site['权利颜色']}`);
    if (!httpsOk(site['文件页'])) errors.push(`${site.site_id} 文件页不是 HTTPS`);
    if (site['权利颜色'] === '绿') {
      if (!GREEN_LICENSES.has(site['文件页标示许可'])) errors.push(`${site.site_id} 绿色许可无效: ${site['文件页标示许可']}`);
      if (!site['预览文件'] || !httpsOk(site['预览文件'])) errors.push(`${site.site_id} 绿色资源缺少 HTTPS 预览文件`);
    } else if (site['预览文件']) {
      errors.push(`${site.site_id} 黄色资源不应嵌入预览图`);
    }
    for (const emperorId of splitIds(site['相关皇帝ID'])) {
      if (!emperorIds.has(emperorId)) errors.push(`${site.site_id} 引用了未知皇帝 ${emperorId}`);
    }
    for (const personId of splitIds(site['相关人物ID'])) {
      if (!knownPersonIds.has(personId)) errors.push(`${site.site_id} 引用了未知人物 ${personId}`);
    }
  }
  const homeRanks = historicSites.map((row) => row['首页']).filter(Boolean);
  if (new Set(homeRanks).size !== homeRanks.length) errors.push('historic-sites.csv 首页序号重复');
  if (homeRanks.length < 8) errors.push(`首页精选今地 ${homeRanks.length} 条，至少应为 8`);

  const OPEN_STATES = new Set(['L0', 'L1', 'L2', 'L3']);
  for (const work of works) {
    if (!REVIEW_INDEX.has(work['证据状态'])) {
      errors.push(`${work.work_id} 证据状态无效: ${work['证据状态']}`);
    }
    if (!OPEN_STATES.has(work.open_state)) {
      errors.push(`${work.work_id} open_state 无效: ${work.open_state}`);
    }
  }
  for (const row of sourceIndex) {
    if (row.open_state && !OPEN_STATES.has(row.open_state)) {
      errors.push(`${row.index_id} open_state 无效: ${row.open_state}`);
    }
  }
}
