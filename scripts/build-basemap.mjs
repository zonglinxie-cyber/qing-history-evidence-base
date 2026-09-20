#!/usr/bin/env node
// 生成 site/basemap.js —— 遗址地图的地理底图折线（海岸线／省界／主要河流）。
//
// 病根：地图板块原来只有经纬网和圆点，48 处史迹漂在纯色矩形上，读者辨不出地理语境。
// 修法：从 Natural Earth（公有领域）取 1:50m 矢量，裁到地图视野、抽稀、取整，
//       落成一个静态 ES 模块，构建期不再依赖网络。
//
// 用法：
//   node scripts/build-basemap.mjs --fetch   # 联网下载原始 GeoJSON 到缓存目录，再生成
//   node scripts/build-basemap.mjs           # 只用缓存目录里已有的原始文件生成
//
// 原始数据（Natural Earth v5，公有领域，无需署名；此处仍按要求注明来源）：
//   https://www.naturalearthdata.com/
//   https://github.com/nvkelso/natural-earth-vector/tree/master/geojson
//     ne_50m_coastline.geojson
//     ne_50m_rivers_lake_centerlines.geojson
//     ne_50m_admin_1_states_provinces_lines.geojson
//
// 视野常量必须与 site/templates.js 的 sitesMapSvg 保持一致，改了要同时改两处。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const cacheDir = path.join(rootDir, 'data/import/natural-earth');
const outFile = path.join(rootDir, 'site/basemap.js');

// 与 templates.js 的 sitesMapSvg 同源。外扩一点点，让贴边的线能被裁出干净的端点。
const VIEW = { minLon: 104.0, maxLon: 133.0, minLat: 19.5, maxLat: 55.5 };

// 抽稀容差（度）。0.06° 约 6–7 公里：在这个视野下肉眼看不出折角，点数却降一个量级。
const TOLERANCE = { coast: 0.045, province: 0.06, river: 0.05 };
// 太短的碎线（小岛、支汊）不画，否则图上全是点。
const MIN_SPAN = { coast: 0.22, province: 0.9, river: 0.5 };

// 只保留与清代史事关系最紧的干流。其余（勒拿河、色楞格河等境外河）不进图。
// 键是 Natural Earth 的 name 字段原文。
const RIVER_KEEP = new Set([
  'Chang Jiang', 'Yangtze', 'Huang',
  'Amur', 'Heilong Jiang', 'Songhua', 'Liao',
  'Xi', 'Xun', 'Hongshui', 'Nanpan',
  'Han', 'Gan', 'Yuan',
  'Argun’', 'Xiliao', 'Xar Moron',
]);

const SOURCES = [
  { key: 'coast', file: 'ne_50m_coastline.geojson' },
  { key: 'river', file: 'ne_50m_rivers_lake_centerlines.geojson' },
  { key: 'province', file: 'ne_50m_admin_1_states_provinces_lines.geojson' },
];

const BASE_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

function fetchSources() {
  fs.mkdirSync(cacheDir, { recursive: true });
  for (const src of SOURCES) {
    const dest = path.join(cacheDir, src.file);
    if (fs.existsSync(dest)) {
      console.log(`缓存已存在，跳过下载：${src.file}`);
      continue;
    }
    console.log(`下载 ${src.file} …`);
    const res = spawnSync('curl', [
      '-sSL', '--max-time', '120', '-o', dest, `${BASE_URL}/${src.file}`,
    ], { stdio: 'inherit' });
    if (res.status !== 0) throw new Error(`下载失败：${src.file}`);
  }
}

function readLines(file) {
  const geo = JSON.parse(fs.readFileSync(path.join(cacheDir, file), 'utf8'));
  const out = [];
  for (const feature of geo.features) {
    const geom = feature.geometry;
    if (!geom) continue;
    const parts = geom.type === 'LineString' ? [geom.coordinates]
      : geom.type === 'MultiLineString' ? geom.coordinates
        : [];
    for (const coords of parts) out.push({ coords, props: feature.properties || {} });
  }
  return out;
}

// 把一条折线按视野边界切开：出框的段落丢掉，边界的交点补上，
// 免得线从画面中间凭空断掉。
function clipToView(coords) {
  const { minLon, maxLon, minLat, maxLat } = VIEW;
  const inside = ([x, y]) => x >= minLon && x <= maxLon && y >= minLat && y <= maxLat;
  const out = [];
  let run = [];
  const pushRun = () => { if (run.length >= 2) out.push(run); run = []; };
  for (let i = 0; i < coords.length; i += 1) {
    const cur = coords[i];
    const prev = coords[i - 1];
    if (inside(cur)) {
      if (!run.length && prev && !inside(prev)) run.push(crossing(prev, cur));
      run.push(cur);
    } else if (run.length) {
      if (prev && inside(prev)) run.push(crossing(prev, cur));
      pushRun();
    }
  }
  pushRun();
  return out;

  function crossing(a, b) {
    let t0 = 0;
    let t1 = 1;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const edges = [
      [-dx, a[0] - minLon], [dx, maxLon - a[0]],
      [-dy, a[1] - minLat], [dy, maxLat - a[1]],
    ];
    for (const [p, q] of edges) {
      if (p === 0) { if (q < 0) return [b[0], b[1]]; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return [b[0], b[1]]; if (r > t0) t0 = r; }
      else { if (r < t0) return [b[0], b[1]]; if (r < t1) t1 = r; }
    }
    return [a[0] + t0 * dx, a[1] + t0 * dy];
  }
}

// Ramer–Douglas–Peucker。递归版够用：单条线最多几千点。
function simplify(points, tol) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDist = -1;
    let index = -1;
    const [x1, y1] = points[first];
    const [x2, y2] = points[last];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const denom = Math.hypot(dx, dy) || 1e-12;
    for (let i = first + 1; i < last; i += 1) {
      const [px, py] = points[i];
      const dist = Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / denom;
      if (dist > maxDist) { maxDist = dist; index = i; }
    }
    if (maxDist > tol && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

// 闭合环要拆开再抽稀。
// 病根：岛屿海岸线首尾是同一点，直接做 DP 时锚线段长度为 0，所有点到它的距离都算成 0，
//   于是整条环被压成两个相同的点、span 为 0，被 MIN_SPAN 当成碎线丢掉——表现是台湾、
//   海南这类岛屿在地图上凭空消失，而大陆海岸线（开放折线）完全正常，很不容易发现。
// 修法：从离起点最远的那个点把环切成两段开口折线，各自抽稀后再接回去。
function simplifyRing(points, tol) {
  if (points.length < 4) return points;
  const [fx, fy] = points[0];
  const [lx, ly] = points[points.length - 1];
  if (fx !== lx || fy !== ly) return simplify(points, tol);
  let far = 1;
  let best = -1;
  for (let i = 1; i < points.length - 1; i += 1) {
    const dist = Math.hypot(points[i][0] - fx, points[i][1] - fy);
    if (dist > best) { best = dist; far = i; }
  }
  const head = simplify(points.slice(0, far + 1), tol);
  const tail = simplify(points.slice(far), tol);
  return head.concat(tail.slice(1));
}

function span(points) {
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

// 坐标保留两位小数（约 1 公里）。地图只有 880×460 像素，再细也是浪费体积。
const round = (points) => points.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);

function buildLayer(key, lines) {
  const collected = [];
  for (const line of lines) {
    if (key === 'river' && !RIVER_KEEP.has(String(line.props.name || '').trim())) continue;
    if (key === 'province' && String(line.props.ADM0_A3 || '') !== 'CHN') continue;
    for (const run of clipToView(line.coords)) {
      const simplified = simplifyRing(run, TOLERANCE[key]);
      if (simplified.length < 2) continue;
      if (span(simplified) < MIN_SPAN[key]) continue;
      collected.push(round(simplified));
    }
  }
  // 长的先画，短的压在上面；顺序稳定，便于构建可重复。
  collected.sort((a, b) => b.length - a.length);
  return collected;
}

function main() {
  if (process.argv.includes('--fetch')) fetchSources();
  for (const src of SOURCES) {
    if (!fs.existsSync(path.join(cacheDir, src.file))) {
      console.error(`缺少 ${src.file}。先跑一次：node scripts/build-basemap.mjs --fetch`);
      process.exit(1);
    }
  }
  const layers = {};
  for (const src of SOURCES) layers[src.key] = buildLayer(src.key, readLines(src.file));

  const points = Object.values(layers).reduce((n, list) => n + list.reduce((m, l) => m + l.length, 0), 0);
  const body = `// 本文件由 scripts/build-basemap.mjs 生成，请勿手改。
//
// 数据来源：Natural Earth v5（公有领域）1:50m 矢量
//   ne_50m_coastline / ne_50m_rivers_lake_centerlines / ne_50m_admin_1_states_provinces_lines
//   https://www.naturalearthdata.com/
// 处理：裁到经 ${VIEW.minLon}–${VIEW.maxLon}°E、纬 ${VIEW.minLat}–${VIEW.maxLat}°N；
//       Douglas–Peucker 抽稀（海岸 ${TOLERANCE.coast}°／省界 ${TOLERANCE.province}°／河流 ${TOLERANCE.river}°）；
//       坐标取两位小数；省界只取 ADM0_A3=CHN。
// 重新生成：node scripts/build-basemap.mjs --fetch
//
// 这是**现代**地理参照，不是清代疆域。省界尤其如此——清代的省制与今天不同，
// 这一层只帮读者把点位放回今天的中国地图上，不得当史料用。
${Object.entries(layers).map(([key, list]) => `export const ${key.toUpperCase()} = ${JSON.stringify(list)};`).join('\n')}
`;
  fs.writeFileSync(outFile, body);
  console.log(`写入 ${path.relative(rootDir, outFile)}：` +
    Object.entries(layers).map(([k, v]) => `${k} ${v.length} 条`).join('，') +
    `，共 ${points} 个点，${(body.length / 1024).toFixed(1)} KB`);
}

main();
