export const CSV_FILES = {
  'qing-emperors.csv': {
    required: ['emperor_id', '规范名', '年号或通称', '庙号', '生年', '卒年', '在位起', '在位止', '清史稿本纪', '故宫人物页', '皇子序', '谥号'],
    unique: ['emperor_id'],
    count: 12,
  },
  'qing-emperor-research-cards.csv': {
    required: ['person_id', 'legacy_emperor_id', '姓名', '故宫人物页'],
    unique: ['person_id'],
    count: 12,
  },
  'emperor-portraits.csv': {
    required: ['visual_id', 'emperor_id', '对象标题', '文件页', '权利颜色', '可公开展示', '展示角色', '关键标注', '画面解析'],
    unique: ['visual_id'],
  },
  'entity-id-crosswalk.csv': {
    required: ['person_id', 'legacy_emperor_id', 'canonical_name', 'status'],
    unique: ['legacy_emperor_id', 'person_id'],
    count: 12,
  },
  'phase0-people.csv': {
    required: ['person_id', '分组', '规范名', '人物类型'],
    unique: ['person_id'],
    count: 86,
  },
  'source-rights-ledger.csv': {
    required: ['source_id', '机构或资源', '权利颜色', '资源网址'],
    unique: ['source_id'],
    count: 27,
  },
  'qing-emperor-source-index.csv': {
    required: ['index_id', 'emperor_id', '资源名称', '访问网址'],
    unique: ['index_id'],
  },
  'task-queue.csv': {
    required: ['task_id', 'emperor_id', '任务', '状态', '优先级'],
    unique: ['task_id'],
  },
  'controlled-vocabularies.csv': {
    required: ['scheme_code', 'term_code', '中文标签'],
    count: 125,
  },
  'kangxi-source-units.csv': {
    required: ['source_unit_id', 'source_entity_id', '史料名', '卷次', '直接记录网址'],
    unique: ['source_unit_id'],
    count: 17,
  },
  'kangxi-source-claims.csv': {
    required: ['Assertion ID', '主体 ID', '谓词/关系', '来源实体 ID', '支持引文', '公历下界', '公历上界', '状态'],
    unique: ['Assertion ID'],
    count: 92,
  },
  'yongzheng-source-units.csv': {
    required: ['source_unit_id', 'source_entity_id', '史料名', '卷次', '直接记录网址'],
    unique: ['source_unit_id'],
    count: 13,
  },
  'yongzheng-source-claims.csv': {
    required: ['Assertion ID', '主体 ID', '谓词/关系', '来源实体 ID', '支持引文', '公历下界', '公历上界', '状态'],
    unique: ['Assertion ID'],
    count: 38,
  },
  'golden-questions.csv': {
    required: ['question_id', '类别', '问题', '期望行为', '路由'],
    unique: ['question_id'],
    count: 60,
  },
  'chapters.csv': {
    required: ['chapter_id', 'slug', 'person_id', 'era', 'title', 'file', 'lede'],
    unique: ['chapter_id', 'slug'],
    count: 20,
  },
  'side-lanes.csv': {
    required: ['lane_id', '栏目', '标题', '通行说法', '官书或档案怎么写', '差异或读法', '证据状态', '权利颜色', '使用说明'],
    unique: ['lane_id'],
  },
  'kangxi-empress-timeline.csv': {
    required: ['event_id', 'person_id', '当时称号', '事件类型', '来源单元', '引文'],
    unique: ['event_id'],
    count: 19,
  },
  'kangxi-princes.csv': {
    required: ['person_id', '表序', '收录状态', '规范名', '父亲ID'],
    unique: ['person_id'],
    count: 35,
  },
  'kangxi-princesses.csv': {
    required: ['person_id', '表序', '规范名', '生母ID', '收录状态'],
    unique: ['person_id'],
    count: 8,
  },
  'kangxi-heir-chain.csv': {
    required: ['event_id', 'person_id', '阶段', '事件类型', '来源单元', '引文'],
    unique: ['event_id'],
    count: 18,
  },
  'historic-sites.csv': {
    required: ['site_id', '事件', '当时', '今日', '今地说明', '边界', '卡片钩子', '证据状态', '权利颜色', '文件页'],
    unique: ['site_id'],
  },
};
