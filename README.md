# 清史证据库 · Phase 0 项目包

版本：`0.6.0`（[`CHANGELOG.md`](CHANGELOG.md) 由构建自动维护）
建立日期：2026-08-12
当前状态：**个人零预算版持续扩充；实时覆盖与审核数字见 [`STATUS.md`](STATUS.md)**

手机阅读：https://zonglinxie-cyber.github.io/qing-history-evidence-base/

## 项目定义

清史证据库不是“文章更长的清史百科”，而是一套能把人物、关系、事件、史料、画像和争议结论逐条连接到原始证据的历史知识基础设施。

项目从以下纵切片起步，再按统一结构扩展十二帝全时段：

> 围绕“康熙晚年—雍正初年的继承与皇族家庭”，先稳定生产一批可追溯、可审核、可修订、权利清晰的知识单元；随后扩展至十二帝、后妃、皇子女、宗室、大臣、制度、事件和史料索引。

## 本项目包包含什么

| 路径 | 用途 |
|---|---|
| `STATUS.md` | 由 CSV 自动生成的当前覆盖、审核与文献打开程度 |
| `CHANGELOG.md` / `VERSION` | 由 `npm run build` 自动维护的更新日志与语义化版本号 |
| `docs/01-project-charter.md` | 项目使命、范围、角色、交付物和 Go/No-Go 标准 |
| `docs/02-information-architecture.md` | 产品信息架构、核心页面和用户任务 |
| `docs/03-source-and-rights-policy.md` | 史料分级、引用要求、版权三色规则 |
| `docs/04-editorial-and-review-manual.md` | 录文、主张、关系、日期、画像及 AI 使用规范 |
| `docs/archive/` | 已归档的过期规划：SQL schema 候选、六周计划、专家团队、风险登记全表、审查方案、Phase-0 数量门槛与 Go/No-Go 验收、社媒内容策略；现役警戒线见章程第 11 节 |
| `docs/07-zero-budget-production-method.md` | 免费资料边界、证据状态和持续生产循环 |
| `data/phase0-people.csv` | 人物候选权威档；从康雍样本扩至皇子女、大臣与跨朝人物，实时数量见 `STATUS.md` |
| `data/qing-emperors.csv` | 十二帝统一骨架与本纪、实录、故宫入口 |
| `data/qing-emperor-source-index.csv` | 十二帝和通用史料入口索引 |
| `data/emperor-portraits.csv` | 十二帝明黄朝服默认像，以及点进人物页后的其他真迹、相关史迹、御笔书法、奏折朱批（含释文与权利颜色） |
| `data/task-queue.csv` | 可跨轮次恢复的持续生产任务队列 |
| `data/entity-id-crosswalk.csv` | 十二帝展示 ID 到统一人物 ID 的迁移对照，防止重复实体 |
| `data/qing-emperor-research-cards.csv` | 十二帝第一版家庭、事件、争议及实录卷数研究卡 |
| `content/emperors/README.md` | 十二帝第一版可读导航与当前证据边界 |
| `data/kangxi-source-units.csv` | 康熙卷来源单元：实录即位/崩逝/遗诏、卷234初废条次、卷237复立，加后妃传、本纪六七八九、实录卷48册谥诏、皇子世表、公主表、理密亲王传 |
| `data/kangxi-source-claims.csv` | 即位、崩逝、遗诏、四后称号轴、皇子表、皇女表与储位链拆出的原子主张 |
| `data/yongzheng-source-units.csv` | 雍正卷来源单元：《清史稿》卷9本纪切片与卷295隆科多、年羹尧传 |
| `data/yongzheng-source-claims.csv` | 即位、生母、密旨、年隆案、军机处、崩逝拆出的原子主张 |
| `data/qianlong-source-{units,claims}.csv` | 卷15授受大典、太上皇训政表述与高宗崩逝 |
| `data/jiaqing-source-{units,claims}.csv` | 卷16、卷319中的内禅、始亲政、和珅下狱/赐死及二十大罪文本 |
| `data/golden-questions.csv` | 事实查询、关系路径、版本冲突、无证据拒答验收集；实时数量见 `STATUS.md` |
| `data/chapters.csv` | 可读章节目录；正文在 `content/emperors/`，实时数量见 `STATUS.md` |
| `data/kangxi-empress-timeline.csv` | 康熙四后时态称号时间轴；七月/九月册后冲突与孝恭非康熙朝皇后均保留 |
| `data/kangxi-princes.csv` | 康熙皇子全表：卷164入序23人、本卷缺号第四子、早薨未入序11人；表序与长子分栏 |
| `data/kangxi-princesses.csv` | 康熙皇女全表：卷166亲生20人、抚育1人；未封12、受封8；和硕/固伦按时态；荣宪沿用 QH-P-000021 |
| `data/kangxi-heir-chain.csv` | 两废太子事件链：立储、拘执、颁废、复立、再废按日拆分；实录卷234/237已回核乙亥、丁丑、丁酉、辛巳；乙丑/丙寅、四十六/四十七年、九月/十月冲突保留 |
| `data/side-lanes.csv` | 后宫制度、野史对照、罕读史料三栏；官书先出，传闻分列，不升格为已核事实 |
| `content/emperors/kangxi/01-accession-and-testament.md` | 康熙即位与遗诏的首篇证据型短章 |
| `content/emperors/kangxi/02-two-depositions.md` | 两废太子：分日记录，不写成九子夺嫡 |
| `content/emperors/kangxi/03-four-empresses.md` | 康熙四后：生前称号不等于最终谥号 |
| `content/emperors/kangxi/04-prince-table.md` | 表序、长子、皇四子 |
| `content/emperors/kangxi/08-princess-table.md` | 皇女、和硕、固伦：卷166二十女加抚育一女 |
| `content/emperors/yongzheng/01-accession-and-early-reign.md` | 雍正即位、生母、年隆与军机 |
| `site/` | 本地研究稿工作台。首页只拉 `data/home.json`；人物、康熙、来源、检索按路由再拉对应 JSON。打开前先运行 `npm run build` |
| `scripts/build-site.mjs` | 把 CSV 编成确定性的 `site/data/*.json`（按路由拆分），并直出首页 HTML |
| `scripts/build-status.mjs` | 从权威 CSV 重建 `STATUS.md`，防止手工数字漂移 |
| `scripts/build-release.mjs` | 检测数据覆盖指纹变化，自动递增版本号并写入 `CHANGELOG.md` |
| `data/source-rights-ledger.csv` | 第一版来源与版权台账 |
| `data/controlled-vocabularies.csv` | 第一版受控词表 |
| `data/import/README.md` | CSV 到数据库的身份合并、`ALL` 范围值及失败回滚规则 |
| `examples/assertion-example.json` | 一条完整的“关系主张—证据—审核”样例 |
| `scripts/validate-data.mjs` | CSV schema（必填列）、身份、卷次、许可、引用与证据等级门禁检查 |
| `scripts/test-render.mjs` | 零依赖渲染冒烟测试（`npm test`，build 之后运行） |
| `site/qing-content.mjs` | 清朝专属内容常量（谓词译名、帝王小传、储位线程等），与通用壳分离 |
| `LICENSE` / `LICENSE-data` | 代码 MIT；自建数据与文本 CC BY 4.0；第三方材料以权利台账为准 |
| `CONTRIBUTING.md` | 外部纠错/贡献的证据规则与 PR 流程 |
| `.github/ISSUE_TEMPLATE/` | 内容纠错、图像与权利、站点 Bug 三类报错模板 |
| `.github/workflows/` | PR 校验（validate+build+渲染测试）与 main 推送自动发布 gh-pages |

## 如何打开本地工作台

```bash
npm install
npm run validate       # 证据类断言默认 warning；结构 error 照常阻断
npm run validate:strict  # STRICT=1：证据类断言升级为 error
npm run self-review    # 自审：有逐字引文 + 卷页定位且无冲突组 →「已采纳」，其余「审核中」
npm run build          # validate → build-release → build-site → build-data-browser → build-status
npm run status         # 只刷新 STATUS.md
npm test               # 渲染冒烟测试（黄金问题数量由数据动态读取）
npm run watch          # 监视 CSV / 正文变化并重建
python3 -m http.server 8765 --directory site
```

浏览器打开 `http://127.0.0.1:8765/`，或直接用上面的 GitHub Pages 地址。这是研究稿浏览层：主张按自审标「已采纳/审核中」，家庭字段保持「索引级候选」，黄色/红色资源只给元数据和外链。绿色画像已缓存到 `site/media/`，页面不热链 Wikimedia。

## 数据浏览器（#/data，全表只读全家桶）

项目从「先审后发」改为「先发后标」：**审核状态不再是发布门槛**。全部 CSV 原始表（含审核中/待核/冲突内容）立即可浏览、可检索、可标注。

三步用法：

1. `npm run build` —— 构建时 `scripts/build-data-browser.mjs` 由 `data/data-manifest.csv` 驱动，把每张登记表原样序列化为 `site/data/raw.json`（结构 `{ tables: [{ file, kind, reign, columns, rows }] }`，`columns` 为表头、`rows` 为逐行对象，保留原始字段与原始值，绝不手写、不做净化/状态改写）。
2. 打开站点进入 `#/data`：表清单按 kind 分组（主张、来源单元、来源台账、冲突组、人物、皇子、皇女、后妃时态轴、储位链、统治年表、文献、今地、对照、黄金问题、词汇、任务队列等）。
3. 点进任意表：全文搜索框（任意列包含）、按任意列文本筛选、按任意列排序，显示行数与字段名；页面顶行高亮「证据状态/回查状态/状态」等状态列的**真实值**（审核中、S二手转述、E1单源回查、已采纳等原样），前端不改值。

## 存疑标记（先发后标的最小闭环）

三步用法：

1. 在 `#/claim`（主张抽屉）、`#/chapter`（章节）、`#/lane`（对照）、`#/site`（今地）页点「标存疑」，弹轻表单选原因（暂不确定 / 疑似错误 / 待回查原文 / 其他）+ 备注；保存后按钮变「已标存疑（YYYY-MM-DD）」，可再点编辑/取消。
2. 存疑数据只存在浏览器 `localStorage`（key `qh-review-notes`），刷新不丢、不上传、不改仓库。
3. 打开 `#/review`：按时间倒序列出全部本地标注，一键导出 `review-notes.csv`（UTF-8 带 BOM，防 Excel 乱码）、一键清空。

> 本地标注不会自动同步；如需沉淀，把导出的 CSV 按模板列 `target_type,target_id,reason,note,created_at`（见 `data/review-notes.csv`）放入 `data/` 后重新构建。

## STRICT 开关（校验门禁分级）

`scripts/validate-data.mjs` 把规则分两类：

- **结构性规则永远按 error 阻断**：行读不出 / 必填缺失 / 主键重复 / 跨文件重复 / 未知外键引用 / 枚举无效 / 章节 era 无效 / 清史稿卷次异常等。
- **证据与编辑类断言默认按 warning、不阻断**：`qing.mjs` 中「不得把 X 写成 Y」「必须保留冲突组」「必须挂 QH-A-*/QH-CF-*」等。

三步用法：

1. `npm run validate` —— 默认：证据类断言只 warning，`process.exitCode` 不为 1，不阻断。
2. `npm run validate:strict`（等价 `STRICT=1 node scripts/validate-data.mjs`）—— 证据类断言升级为 error 阻断。
3. `npm run build` 串行执行 validate → build-site → build-data-browser → build-status：证据类 warning 不失败、结构 error 才失败。

## 目录关系与部署

- **`site/` 是唯一的前端构建产物源**。`scripts/build-site.mjs` 把 CSV/正文编成 `site/data/*.json`、直出首页 HTML，并生成 `site/chapter/<slug>/` 可分享静态页、`sitemap.xml` 与 `robots.txt`。所有前端改动只改 `site/*`（`app.js`/`templates.js`/`search.js`/`styles.css`；清朝专属内容常量在 `site/qing-content.mjs`）。
- **收录与证据等级分开**：`data/chapters.csv` 的 `收录` 列（是/否）决定 sitemap 与 `<meta name="robots">`。当前默认放行康雍全部可读章，以及其余各朝代表章；文献索引章和年表章仍 `noindex`。证据是否闭环只决定页内研究草稿横幅，不再挡收录。部署到其他域名时可用 `SITE_URL=https://example.com/base/ npm run build` 改写 canonical。
  - **站点是单朝代运行时**：`#dynasty-config`、首页直出与 `home/people/catalog.json` 一次只承载一个朝代。切换当前朝代 = 在 `dynasties.csv` 只保留一个 `active=是` 并备齐该朝内容模块与数据。同时启用多个朝代时 `build` 会报错拦截（并非并存）——多朝代并存需要先把数据块前缀化为 `d-<code>`、给前端加朝代切换器，属后续改造而非纯 CSV 操作。
- **发布由 GitHub Actions 自动完成**：推送 `main` 后，`.github/workflows/deploy.yml` 运行校验、构建与渲染测试，把 `site/` 发布到 `gh-pages` 分支（GitHub Pages 从该分支服务）。无需再手工同步。根目录镜像部署脚本已删除。
- 前置条件：仓库 Settings → Actions → General → Workflow permissions 需选 **Read and write**（GITHUB_TOKEN 要推送 gh-pages）。
- 本地开发**不要**起在仓库根（缺静态站点文件），直接 `python3 -m http.server --directory site`。

## 推荐阅读顺序

1. 项目章程；
2. 来源与版权规范；
3. 编辑审核规范；
4. 零预算生产方法；
5. 技术团队再阅读数据字典。

## 已锁定的五项原则

1. **文章不是事实源。** 事实首先保存为带证据的原子主张，文章只是派生视图。
2. **关系边必须有证据。** 生母、嫡母、养母、承嗣、过继、婚配和政治关系不得混写。
3. **历史时间必须保留原值。** 年号纪年、闰月、公历换算、精度和换算方法同时保存。
4. **能浏览不等于能复制。** 每件图片、档案和数据库资源先进入版权台账，再决定本地保存、外链或禁用。
5. **AI 没有定论权。** AI 产出（候选录文、实体、主张和叙事草稿）按「先发后标」直接进研究稿并带状态徽标；采纳由自审判定（逐字引文＋卷页定位＋无冲突组），只有「已采纳」可作定论式陈述，人随时可标存疑推翻。

## 零预算执行边界

- 目标包含十二帝完整骨架，并持续向后妃、皇子女和宗室扩充；
- 不承诺一次性完成“全部清史”，按可核验批次持续生产；
- 不批量镜像一史馆、故宫、中研院或其他受限数据库；
- 不把《清史稿》当最终事实裁判；
- 不发布未经逐项核权的馆藏高清图；
- 不让模型自动补写残字、死因、动机或争议结论；
- 不把历史画像、后世历史画和 AI 想象图混在同一类别。

## 零预算规则

本项目不设置预算、招聘或付费授权前置条件。现阶段由用户确定方向，AI 负责公开资料检索、整理、建模、引用、交叉核验和持续扩充。

免费可公开访问但再利用权不明的资料，只保存自建元数据、档号、必要短引文和外部链接。只有逐件确认公版、开放许可或明确授权的图像才允许本地嵌入。缺少一手材料的结论标为“待核”或“有争议”，不得为了内容数量写成确定事实。

## 完成定义

每一个批次的完成标准是：结构化记录齐全、来源可追、权利状态明确、争议不被掩盖。文件数量、文章字数和“看起来很丰富”都不构成完成。

## 变更记录

- **开闸 v0.1（本次）**：
  1. `data/data-manifest.csv` 登记 `yongzheng-princesses.csv`（雍正公主表 7 行），`npm run validate` 加载该表并列出行数与字段，`qing.mjs` 卷166世宗系（入序受封 1 / 未封 3 / 抚育 3）规则生效。
  2. 新增 `scripts/build-data-browser.mjs` 与 `#/data` 前端路由：全量 CSR 原值出表，含搜索/筛选/排序与状态列高亮。
  3. 存疑标记：四大页面「标存疑」按钮 + `#/review` + `data/review-notes.csv` 模板（localStorage 闭环，CSV 导出带 BOM）。
  4. 校验门禁分级：`validate-data.mjs` 分流结构/证据两类，证据类默认 warning，`STRICT=1` 恢复 error；`package.json build` 串行化。
  5. 自审：`scripts/self-review.mjs`（`npm run self-review`）把「等人审」改成「AI 自审」——有逐字引文 + 卷页定位且无冲突组标「已采纳」，其余标「审核中」；取消复核人/复核日期与 A1/A2、双来源门禁。
