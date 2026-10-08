# AGENTS.md

清史证据库：个人项目，`data/*.csv` + `content/**.md` 是权威层，静态站点由 CSV 构建。Node ESM，无框架、无外部服务。

## 常用命令

```bash
npm install
npm run build            # check-calendar → validate → build-release --render-only → build-site
npm test                 # 267 项检查（reader / validate-fixture / render / studio / review 五组）
npm run validate         # 结构校验；仅结构类 error 阻断，证据/文风只提示
npm run validate:strict  # STRICT=1，自查用
npm run check:calendar   # CAL-001 历法机器一致性校验，覆写两个工单 CSV
npm run status           # 重建 STATUS.md（不入库）
npm run errata           # 勘误登记（docs/25）
npm run release          # 唯一维护 VERSION/CHANGELOG/package.json 版本号的入口
npm run serve            # http://127.0.0.1:8765/（HTML/JSON 不缓存）
npm run watch            # 只重建，不起 HTTP
```

`npm test` 读 `site/data/*.json`，**先 `npm run build` 再跑**；全新检出顺序：`npm ci && npm run build && npm test`。

## 铁律

- **CSV 是真相，站点是投影**：改 `data/`、`content/`，不改 `site/` 生成物；`site/data/`、`site/media-manifest.js` 等全部不入库。
- **不编造来源/页码/坐标/引文**；「查不到」登记缺口，不写成「没有发生」。
- 读者正文只按 `docs/30-读本写作契约.md`；证据库字段按 `docs/03`、`docs/04` §1–§12。
- 勘误走 `npm run errata`（`docs/25`），别在别处另记账本。

## `chapters.csv` 的「体裁」列

`章`＝叙事正文（55 行）；`资料`＝年表/世表/索引类查阅章（103 行）。`site/reading.js` 的 `chapterGenre()` 按此分流「读故事」与查阅入口；新增行必填。

## `_data-proposals/` 并表

规则在 `docs/28`：台账→单元→主张→冲突组→章节行→正文挂号的顺序不可倒；`PROP-`/`CAND-` 前缀与撞号必须先改号；提案里的「已采纳」不得抄进生产表。

## 行尾约定（容易踩）

多数 CSV 是 LF；**CRLF 的是 `data/source-units.csv`、`emperor-chronicle.csv`、`ziguangge-batches.csv`**，编辑时保持原行尾，别整表换行尾（曾因此把追加行吞成一条记录，见 docs/28 §6）。

## 不入库物（.gitignore）

`site/data/`、`site/chapter|person|lane|site/`、`site/media-manifest.js`、`site/sitemap.xml`、`STATUS.md`、`data/calendar-audit.csv`、`data/calendar-worksheet.csv`、`media-originals/`、`outputs/`、`data/import/natural-earth/`。`site/index.html` 入库但构建会改其中 `?v=` 指纹与直出内容。

## 部署与其他边界

- `deploy.yml` 仅 `workflow_dispatch` 手动发布；CI 只跑构建冒烟，不设测试/校验关卡；整站 noindex。
- 单朝代运行时：`dynasties.csv` 只允许一个 `active=是`。
- 站点是 hash 路由 SPA：`site/app.js`（约 4800 行）单文件路由，`#/person/{id}` 帝王已并入朝代页，`#/images` 是 `#/hands` 旧别名。
- 文档层：`docs/` 内 dated 轮次记录以文首日期为口径，数量以 `npm run status` 为准。
