import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from './rules/common/structure.mjs';

const contentDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../content');
const errors = [];
const warnings = [];
const empty = [];

const baseFixture = {
  errors,
  warnings,
  contentDir,
  emperors: empty,
  portraits: empty,
  crosswalk: empty,
  people: empty,
  sources: empty,
  sourceIndex: empty,
  tasks: [{ task_id: 'TQ-X', 前置任务: 'TQ-MISSING' }],
  vocab: empty,
  units: empty,
  claims: empty,
  questions: empty,
  chapters: empty,
  lanes: empty,
  empressTimeline: empty,
  heirChain: empty,
  historicSites: empty,
  works: empty,
  conflictSets: empty,
  emperorTimeline: empty,
  imageRegions: [{ region_id: 'QH-IR-BAD', visual_id: 'QH-V-MISSING', assertion_id: 'QH-A-MISSING' }],
  iiifManifests: [{ visual_id: 'QH-V-MISSING2' }],
};
check(baseFixture);

const joined = errors.join('\n');
let failed = 0;
function checkName(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ': ' + name);
  if (!cond) failed += 1;
}
checkName('坏样本触发未知画像', joined.includes('QH-IR-BAD') && joined.includes('QH-V-MISSING'));
checkName('坏样本触发未知主张外键', joined.includes('QH-A-MISSING'));
checkName('坏样本触发未知 IIIF 画像', joined.includes('QH-V-MISSING2'));
checkName('坏样本触发未知前置任务', joined.includes('TQ-MISSING'));
// 未知日期可保留，但不能静默丢失原始纪年或填写原因来掩盖坏日期。
for (const [name, row, expected] of [
  ['无公历且无原因须阻断', { 原始时间表达: '某年' }, true],
  ['未知年份有原文及原因可保留', { 原始时间表达: '某年', 公历说明: '原文没有给出年份' }, false],
  ['有原因但原始纪年缺失须阻断', { 公历说明: '尚未换算' }, true],
  ['单边公历且无原因须阻断', { 原始时间表达: '某年以后', 公历下界: '1881-01-01' }, true],
  ['未定原因不掩盖格式错误', { 原始时间表达: '某年', 公历说明: '待校', 公历下界: '1881' }, true],
]) {
  const dateErrors = [];
  check({ ...baseFixture, errors: dateErrors, warnings: [], claims: [{ 'Assertion ID': 'DATE-FIXTURE', ...row }] });
  checkName(name, dateErrors.some((message) => /缺少公历对照|公历下界格式无效/.test(message)) === expected);
}
// 图像分类与 AI 图红线（2026-09-11 接通）。
// 背景：词表里早就写着「AI 再现」，但数据层从未接上分类列，全库 0 行标注，
// 于是「本站没有 AI 图」既不能证明也无从拦截。这组 fixture 锁住三条行为：
//   ① 分类取值必须落在词表内；② 标为「AI 再现」必须写明生成方式；③ 合法值不得误报。
const NATURE_TERMS = ['历史原件', '后世历史艺术', '现代插画', 'AI 再现', '文献影像', '现代实景影像'];
const DEPICTION_TERMS = ['题名明确', '馆藏著录认定', '学术研究认定', '传统传称', '很可能', '可能', '已否定认定'];
const imageVocab = [
  ...NATURE_TERMS.map((label, i) => ({ scheme_code: 'image_nature', term_code: `n${i}`, 中文标签: label, 是否启用: 'true' })),
  ...DEPICTION_TERMS.map((label, i) => ({ scheme_code: 'depiction_identification', term_code: `d${i}`, 中文标签: label, 是否启用: 'true' })),
];
const portraitRow = (extra) => ({
  visual_id: 'QH-V-TEST',
  emperor_id: 'QH-E-01',
  展示角色: '其他真迹',
  关键标注: '标注',
  画面解析: '画面说明文字。',
  文件页: 'https://example.org/file',
  权利颜色: '黄',
  可公开展示: '仅外链',
  ...extra,
});
function imageErrors(row) {
  const found = [];
  check({
    ...baseFixture,
    errors: found,
    warnings: [],
    vocab: imageVocab,
    portraits: [portraitRow(row)],
    tasks: [],
    imageRegions: [],
    iiifManifests: [],
  });
  return found;
}
const IMAGE_RULE_RE = /图像性质分类无效|认定等级无效|未写明生成方式/;
checkName('分类值合法时不报分类相关错误',
  !imageErrors({ 图像性质分类: '历史原件', 认定等级: '题名明确' })
    .some((m) => IMAGE_RULE_RE.test(m)));
checkName('分类值超出词表须阻断',
  imageErrors({ 图像性质分类: '朱批奏折原件', 认定等级: '题名明确' })
    .some((m) => /图像性质分类无效/.test(m)));
checkName('认定等级超出词表须阻断',
  imageErrors({ 图像性质分类: '历史原件', 认定等级: '文件题名明确（故宫博物院藏品）' })
    .some((m) => /认定等级无效/.test(m)));
checkName('标为 AI 再现却不写生成方式须阻断',
  imageErrors({ 图像性质分类: 'AI 再现', 认定等级: '题名明确' })
    .some((m) => /未写明生成方式/.test(m)));
checkName('标为 AI 再现且写明生成方式可放行',
  !imageErrors({ 图像性质分类: 'AI 再现', 认定等级: '题名明确', 画面解析: '本条为 AI 生成示意图，不作为史料。' })
    .some((m) => /未写明生成方式/.test(m)));

// 图像区域坐标必须落在 0–1 内（2026-09-11 补）。
// 背景：区域框是归一化坐标，越界不会让构建报错，只会在浏览器里把框画到图外面，
//   属于"测试跑全绿、看起来才知道错"的一类。这里锁住数值与边界两条。
function regionErrors(region) {
  const found = [];
  check({
    ...baseFixture,
    errors: found,
    warnings: [],
    portraits: [portraitRow({ 图像性质分类: '历史原件', 认定等级: '题名明确' })],
    tasks: [],
    imageRegions: [{ region_id: 'QH-IR-TEST', visual_id: 'QH-V-TEST', region_label: '朱批区', ...region }],
    iiifManifests: [],
  });
  return found;
}
const REGION_RULE_RE = /区域坐标不是数字|区域越界/;
checkName('区域坐标合法时不报错',
  !regionErrors({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }).some((m) => REGION_RULE_RE.test(m)));
checkName('区域坐标不是数字须阻断',
  regionErrors({ x: '左', y: 0.2, w: 0.3, h: 0.4 }).some((m) => /区域坐标不是数字/.test(m)));
checkName('区域越界须阻断',
  regionErrors({ x: 0.8, y: 0.2, w: 0.4, h: 0.4 }).some((m) => /区域越界/.test(m)));
checkName('区域负值须阻断',
  regionErrors({ x: -0.1, y: 0.2, w: 0.3, h: 0.4 }).some((m) => /区域越界/.test(m)));

for (const scheme of ['assertion_predicate', 'relationship_type']) {
  const e=[];
  check({...baseFixture, errors:e, warnings:[], tasks:[], imageRegions:[], iiifManifests:[],
    vocab:[{scheme_code:scheme,term_code:'registered_relation'}],
    claims:[{'Assertion ID':'TEST','谓词/关系':'registered_relation'}]});
  checkName(scheme+' 的已登记谓词可使用', !e.some(m=>m.includes('谓词未登记')));
}
const predicateErrors=[];
check({...baseFixture, errors:predicateErrors, warnings:[], tasks:[], imageRegions:[], iiifManifests:[],
  vocab:[{scheme_code:'assertion_predicate',term_code:'registered_relation'}],
  claims:[{'Assertion ID':'TEST','谓词/关系':'unknown_relation'}]});
checkName('未知谓词阻断构建', predicateErrors.some(m=>m.includes('谓词未登记')));

if (failed) {
  console.error(`validate fixture ${failed} 项失败`);
  process.exit(1);
}
console.log('validate fixture 全部通过');
