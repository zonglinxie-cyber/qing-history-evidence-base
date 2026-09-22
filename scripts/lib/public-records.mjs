// 台账行 → 站点公开记录：字段裁剪、编号回读、本地图优先与检索条目。
// 从 build-site.mjs 整段搬出，逐字未改。构建期专用，零 DOM。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';
import { readerCopy, readerMetadata } from './reader.mjs';
import { OPEN_STATE_LABEL } from '../../site/qing-content.js';

// localPreview 查的是发布目录里已切好的本地图，与 build-site 的 siteDir 同一算法。
const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../site');

export function publicCalendarStatus(audit) {
  if (!audit) return { status: 'unknown' };
  if (audit['判定'] === '异常' || /C6(?:b)?:|C11:/.test(audit['标记'] || '')) return { status: 'conflict' };
  if (audit['判定'] === '待核') return { status: 'review' };
  if (audit['判定'] === '通过') return { status: 'checked' };
  return { status: 'not-applicable' };
}

export function localPreview(id, remoteUrl) {
  const remote = String(remoteUrl || '').trim();
  // 优先使用本地缓存；格式按真实内容保存，避免把 PNG 伪装成 .jpg。
  if (id) {
    for (const ext of ['webp', 'png', 'jpg', 'jpeg']) {
      const localRel = `media/${id}.${ext}`;
      if (fs.existsSync(path.join(siteDir, localRel))) return localRel;
    }
  }
  return remote;
}

export function slimPortrait(portrait) {
  if (!portrait) return null;
  return {
    visual_id: portrait.visual_id,
    emperor_id: portrait.emperor_id,
    对象标题: portrait['对象标题'],
    预览文件: localPreview(portrait.visual_id, portrait['预览文件']),
    权利颜色: portrait['权利颜色'],
    可公开展示: portrait['可公开展示'],
    展示角色: portrait['展示角色'],
  };
}

export function pick(row, fields) {
  return Object.fromEntries(fields
    .filter((field) => Object.hasOwn(row || {}, field))
    .map((field) => [field, row[field]]));
}

function publicPortraitProse(value) {
  return (String(value || '').match(/[^!！?？。；;]+[!！?？。；;]?/g) || [])
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !/\bQH-V-|(?:默认展示|默认头像|网格默认|识别系统|识别用头像|只作为其他真迹进入)/.test(sentence))
    .map((sentence) => readerMetadata(readerCopy(sentence)))
    .join('');
}

export function publicPortrait(row) {
  const out = pick(row, [
    'visual_id', 'emperor_id', '对象标题', '图像性质', '图像性质分类', '认定等级',
    '制作年代或摄影日期', '作者或摄影者',
    '文件页', '预览文件', '文件页标示许可', '权利颜色', '可公开展示', '展示角色',
    '关键标注', '画面解析', '释文', '卡片钩子', '馆藏登录号',
  ]);
  out['预览文件'] = localPreview(row.visual_id, row['预览文件']);
  out['制作年代或摄影日期'] = readerMetadata(out['制作年代或摄影日期']);
  out['作者或摄影者'] = readerMetadata(out['作者或摄影者']);
  out['关键标注'] = readerMetadata(out['关键标注']);
  out['画面解析'] = publicPortraitProse(out['画面解析']);
  out['释文'] = publicPortraitProse(out['释文']);
  out['卡片钩子'] = readerMetadata(readerCopy(out['卡片钩子']));
  return out;
}

export function publicClaim(row) {
  // 来源、录文对照和历史编辑决定分别展示，不把机器采纳映射成人工核验。
  return {
    ...pick(row, [
      'Assertion ID', '主体 ID', '谓词/关系', '客体 ID 或值', '原始时间表达', '公历下界', '公历上界', '公历说明',
      '确定性', '来源实体 ID', '卷页/档号/图像定位', '支持引文', '冲突组 ID',
    ]),
  };
}

export function publicAvailability(value) {
  return OPEN_STATE_LABEL[String(value || '').trim()] || '馆藏入口';
}

export function searchEntry(type, id, hay, extra = {}) {
  return { type, id, hay, ...extra };
}

// 拼音（无声调、去空格）并入检索 hay，支持 yinzhen → 胤禛 这类查询
let pyFailed = false;
export function py(text) {
  try {
    return pinyin(String(text || ''), { toneType: 'none', nonZh: 'none' }).replace(/\s+/g, '');
  } catch {
    // 每条索引都调一次，只报一次：退化成空串等于整站拼音检索失效，不能无声通过。
    if (!pyFailed) {
      pyFailed = true;
      console.error('[build] pinyin 调用失败，检索索引本次不含拼音匹配');
    }
    return '';
  }
}
