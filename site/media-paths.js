// 本地图像各档的命名规则，全站唯一出处。
// 浏览器侧（templates.js 拼 srcset 与 ?v=）和构建侧（build-media-manifest.mjs 生成
// stem → 内容指纹清单）此前各写一份正则，只靠注释要求两边一致：stem 算法一旦分叉，
// 指纹查不到就退化成无版本 URL，缓存失效静默失灵。这里把它收成一份。
// 零依赖，Node 与浏览器直接可用。

// 一档本地图：文件名后缀 + srcset 里报的像素宽。
export const LOCAL_VARIANTS = [['-480', 480], ['-960', 960], ['@2x', 1280]];

const SUFFIXES = LOCAL_VARIANTS.map(([suffix]) => suffix).join('|');
const FILE_RE = new RegExp(`^(?:media/)?([a-z0-9-]+?)(?:${SUFFIXES})?(\\.(?:jpe?g|png|webp))$`, 'i');
const VARIANT_RE = new RegExp(`(?:${SUFFIXES})\\.[a-z0-9]+$`, 'i');

/**
 * 认本地图片路径：接受裸文件名或 `media/…`，返回带 `media/` 前缀的 `{ stem, ext }`；
 * 不是图片则返回 null。stem 去掉变体后缀与扩展名，主图与它的各档共用一个。
 */
export function mediaPath(src) {
  const m = FILE_RE.exec(String(src || '').trim());
  return m ? { stem: `media/${m[1]}`, ext: m[2] } : null;
}

/** 清单用的 stem：认不出来时原样当作自己的 stem，与旧构建侧一致，不让新文件静默丢指纹。 */
export function stemOf(name) {
  return mediaPath(name)?.stem ?? `media/${name}`;
}

/** 变体档与主图同内容、同比例，清单只需主图一条。 */
export function isVariant(name) {
  return VARIANT_RE.test(String(name));
}
