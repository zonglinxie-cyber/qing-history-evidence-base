import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// phase-0/site 是唯一的前端构建产物源；仓库根是供 GitHub Pages 的部署镜像。
// 本脚本把 phase-0/site 同步到仓库根。根目录是可重生成的镜像，不要手改。
// 本地开发直接 `python3 -m http.server --directory phase-0/site`，无需运行本脚本。

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const phaseRoot = path.resolve(scriptDir, '..'); // phase-0
const repoRoot = path.resolve(phaseRoot, '..'); // 仓库根
const siteDir = path.join(phaseRoot, 'site');

const TOP_FILES = ['index.html', 'app.js', 'templates.js', 'search.js', 'styles.css', '.nojekyll'];
const DIRS = ['data', 'media'];

if (!fs.existsSync(siteDir)) {
  console.error(`deploy-sync: 找不到站点目录 ${siteDir}，请先运行 npm run build。`);
  process.exitCode = 1;
} else {
  const copied = [];
  const skipped = [];
  for (const name of TOP_FILES) {
    const src = path.join(siteDir, name);
    const dest = path.join(repoRoot, name);
    if (!fs.existsSync(src)) {
      skipped.push(`${name}（源缺失）`);
      continue;
    }
    fs.copyFileSync(src, dest);
    copied.push(name);
  }
  for (const name of DIRS) {
    const src = path.join(siteDir, name);
    const dest = path.join(repoRoot, name);
    if (!fs.existsSync(src)) {
      skipped.push(`${name}/（源缺失）`);
      continue;
    }
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(src, dest, { recursive: true });
    copied.push(`${name}/`);
  }
  console.log('deploy-sync: phase-0/site → 仓库根');
  console.log(`已同步: ${copied.join(' · ') || '无'}`);
  if (skipped.length) console.log(`跳过: ${skipped.join(' · ')}`);
  console.log('GitHub Pages 从仓库根提供；本地开发请直接 serve phase-0/site。');
}
