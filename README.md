# 清史证据库 · Phase 0 项目包

版本：`0.7.2`（[`CHANGELOG.md`](CHANGELOG.md) 由显式 release 命令维护）
建立日期：2026-08-12
当前状态：**个人兴趣项目，持续扩充内容与改善阅读体验；数据统计见 `STATUS.md`（本地 `npm run status` 生成，不入库）**

手机阅读：https://zonglinxie-cyber.github.io/qing-history-evidence-base/

## 直播讲解

打开本地站点的 `#/studio`，从日记、上谕与笔记的具体细节选题。当前备有五组选题，其中曾纪泽备约、雍正钱、雍正刊刻逆书三组配完整讲解包：30—60 秒开场、逐段讲稿与转场、材料对读、观众问答、来源与缺口，时长只按字数给设计估算；四川安家与光绪书案两组仍以主播提示为主。每组配五张观众卡与原文定位，观众窗口支持横竖屏同步翻页。

每组都提供可复制的 AI 续查任务，带上现有原句、出处与待查问题。当前站点不直接调用模型；原文核查、影印校勘与后续入库的范围见 [直播史料选题与查证](docs/直播史料选题与查证.md)。

## 项目定义

这是一个自己玩的清史阅读网站。优先做好：**内容精彩、前端展示逻辑好用、UI 漂亮、数据构建与运行稳定**。

AI 负责查资料、核对和编辑，不要求用户逐条审核，也不要求另找专家签字。人工复核数量、章节成熟度、历法异常数量和媒体体积均不作为构建或发布门槛；不为满足指标删除图片或凑内容覆盖率。历法检查只提供问题线索，基本数据结构、死链和页面运行测试继续用于防止网站损坏。

保留原文出处和具体争议说明，是为了读起来有依据，不是增加审批流程。旧规划中的数量目标和学术审校流程不作为当前开发前置条件。

项目从以下纵切片起步，再按统一结构扩展十二帝全时段：

> 围绕“康熙晚年—雍正初年的继承与皇族家庭”，先稳定生产一批可追溯、可审核、可修订、权利清晰的知识单元；随后扩展至十二帝、后妃、皇子女、宗室、大臣、制度、事件和史料索引。

## 本项目包包含什么

| 路径 | 用途 |
|---|---|
| `STATUS.md` | 由 `npm run status` 从 CSV 重建的当前覆盖、审核与文献打开程度；内嵌构建 commit，不入库，随用随生成 |
| `CHANGELOG.md` / `VERSION` | 由显式 `npm run release` 维护的更新日志与语义化版本号 |
| `docs/01-project-charter.md` | 项目使命、范围、角色、交付物和 Go/No-Go 标准 |
| `docs/02-information-architecture.md` | 产品信息架构、核心页面和用户任务 |
| `docs/03-source-and-rights-policy.md` | 史料**性质**分级（三级：`同时代·官方` / `同时代·私撰` / `后出`，2026-09-11 由六级压缩）、引用要求、版权三色规则 |
| `docs/04-editorial-and-review-manual.md` | 证据库：录文、主张、关系、日期、画像及 AI 使用规范 |
| `docs/30-读本写作契约.md` | **读者正文怎么写**（0.8.0 起唯一写作规则，替代旧 §13 禁词表） |
| `docs/archive/` | 已归档的过期规划：SQL schema 候选、六周计划、专家团队、风险登记全表、审查方案、Phase-0 数量门槛与 Go/No-Go 验收、社媒内容策略；现役警戒线见章程第 11 节 |
| `docs/07-zero-budget-production-method.md` | 免费资料边界、证据状态和持续生产循环 |
| `docs/21-史学评估与补充方案.md` | 史学角度的系统评估与换算基准登记（CAL-001）；按 P0/P1/P2 排列的补充方案与复算命令。**注意**：其中 §1.1「新增 A3」已被当晚的三级压缩推翻，该节仅存留档 |
| `docs/22-CAL-001核录工单.md` | CAL-001 逐条核录的工单与方法：11 项可复算的机器一致性检查、423 个待核表达的工单、已发现的硬矛盾与待决事项；边界是「机器通过≠已具书核录」 |
| `docs/23-冲突组学术史登记说明.md` | 冲突组的 `研究综述`／`主要论著`／`综述状态` 三列怎么用：登记标准（只登记可核实的书目、页码一律不写）、18 组的现状（已登记 9／部分 1／待补 8）与各自须查什么 |
| `docs/26-P0落地记录.md` | 图片与展陈线的 P0 执行记录：地图为什么必须换投影（原投影横向拉伸 3–4.5 倍）、16 件朱批奏折里哪几件真的画得出「朱批区」、图证互指的实际增幅与没绑上主张的原因 |
| `docs/25-勘误流程.md` | 勘误怎么提、怎么记、怎么改：`npm run errata` 一行登记、`位置ID` 填法、状态取值、改完后的复跑命令，以及「出处必须真实」这条红线为什么不能放宽 |
| `docs/24-档案穿透试点-年羹尧案.md` | 档案穿透试点的方案与核录工单：为什么「须到馆」不是停止理由（雍正朝核心档案已有 40 册影印本等公开出版物）、三级路由、已登记的 7 个入口、年羹尧案的逐项核录步骤、权利红线与诚实缺口 |
| `data/phase0-people.csv` | 人物候选权威档；从康雍样本扩至皇子女、大臣与跨朝人物；十二帝与康雍核心另有 `wikidata_qid` / `cbdb_id` / `ctext_entity` 对照列，实时数量见 `STATUS.md` |
| `data/qing-emperors.csv` | 十二帝统一骨架与本纪、实录、故宫入口 |
| `data/qing-emperor-source-index.csv` | 十二帝和通用史料入口索引 |
| `data/emperor-portraits.csv` | 十二帝明黄朝服默认像，以及点进人物页后的其他真迹、相关史迹、御笔书法、奏折朱批（含释文与权利颜色） |
| `data/task-queue.csv` | 可跨轮次恢复的持续生产任务队列 |
| `data/entity-id-crosswalk.csv` | 十二帝展示 ID 到统一人物 ID 的迁移对照，防止重复实体 |
| `data/qing-emperor-research-cards.csv` | 十二帝家庭、事件、争议及实录卷数研究卡 |
| `content/emperors/README.md` | 十二帝可读导航与当前证据边界 |
| `data/source-units.csv` | 全部来源单元（含 `reign` 朝次列与 `stable_locator` 稳定卷页）：实录、本纪、列传与专题短引的卷页定位 |
| `data/source-claims.csv` | 全部原子主张（含 `reign` 朝次列）：即位、崩逝、遗诏、家庭、储位与各朝已拆条 |
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
| `scripts/lib/chapter-html.mjs` | 章正文 Markdown → 读者 HTML：块解析、标题锚点、抽屉与按语包装、删块提示 |
| `scripts/lib/public-records.mjs` | 记录 → 公开字段：裁剪主张、肖像与检索条目，证据状态措辞在此统一 |
| `scripts/build-status.mjs` | 从权威 CSV 重建 `STATUS.md`，防止手工数字漂移 |
| `scripts/build-release.mjs` | 在显式 release 时检测数据覆盖指纹变化、递增版本号并写入 `CHANGELOG.md` |
| `data/source-rights-ledger.csv` | 来源与版权台账 |
| `data/calendar-baseline.csv` | 公历换算基准登记：CAL-001＝陈垣《二十史朔闰表》（唯一基准）、CAL-004＝已作废的「通行年表」泛指。结构化数据写 CAL-001，面向读者的正文写基准名（见 `docs/03` §7）。核录进度与机器校验见 `docs/22` |
| `data/calendar-audit.csv` | CAL-001 机器校验的逐条判定（892 条）。内部工作表，不登记 manifest、不进站点；由 `npm run check:calendar` 生成 |
| `data/calendar-worksheet.csv` | CAL-001 核录工单（423 个唯一时间表达，按年月排序，附空白核录栏）。内部工作表，不登记 manifest、不进站点 |
| `data/controlled-vocabularies.csv` | 受控词表 |
| `data/import/README.md` | CSV 到数据库的身份合并、`ALL` 范围值及失败回滚规则 |
| `examples/assertion-example.json` | 一条完整的“关系主张—证据—审核”样例 |
| `scripts/validate-data.mjs` | 结构校验（必填列、主键、外键、枚举、卷次）；证据与文风类只提示、不阻断 |
| `scripts/check-calendar-baseline.mjs` | CAL-001 机器一致性校验（`npm run check:calendar`）：年号纪年边界、确定性×精度、同一表达一致性、日干支与年干支自洽、月内干支序、跨年陷阱；产出逐条判定与核录工单 |
| `scripts/test-render.mjs` | 零依赖渲染冒烟测试（`npm test`，build 之后运行） |
| `site/qing-content.js` | 清朝专属内容常量（谓词译名、帝王小传、储位线程等），与通用壳分离 |
| `LICENSE` / `LICENSE-data` | 代码 MIT；自建数据与文本 CC BY 4.0；第三方材料以权利台账为准 |
| `CONTRIBUTING.md` | 外部纠错/贡献的证据规则与 PR 流程 |
| `.github/ISSUE_TEMPLATE/` | 内容纠错、图像与权利、站点 Bug 三类报错模板 |
| `.github/workflows/` | PR 校验（validate+build+渲染测试）；`deploy.yml` 仅手动触发（`workflow_dispatch`），不随 push 自动发布 |

## 如何打开本地工作台

```bash
npm install
npm run validate       # 只输出提示；仅结构/外键类 error 会阻断
npm run validate:strict  # 可选自查：把证据断言升级为 error
npm run self-review    # 只读登记与变更检查；不改状态，不等于来源复核
npm run build          # validate → build-release --render-only → build-site
npm run status         # 只刷新 STATUS.md
npm test               # 渲染冒烟测试（黄金问题数量由数据动态读取）
npm run watch          # 监视 CSV / 正文变化并重建
npm run serve          # 本地预览 http://127.0.0.1:8765/（HTML 与 JSON 不缓存，只 media/ 长缓存；产物变化时页面自动重载）
```

浏览器打开 `http://127.0.0.1:8765/`，或直接用上面的 GitHub Pages 地址。这是研究稿浏览层：主张保留历史编辑状态，另显示登记与逐条复核状态，家庭字段保持「索引级候选」，黄色/红色资源只给元数据和外链。绿色画像已缓存到 `site/media/`，页面不热链 Wikimedia。

## 原始表只在仓库里

站点不再镜像整表，也不再派生 SQLite。权威 CSV 只在仓库 `data/`。旧地址 `#/data` 仍可用，页面只链到 GitHub `data/`，避免旧链接 404。

## 校验分级（内容不再被机器拦）

`scripts/validate-data.mjs` 只在一件事上阻断：**数据结构必须能读出来**。

- **结构类 error（唯一阻断项）**：行读不出 / 必填缺失 / 主键重复 / 跨文件重复 / 未知外键引用 / 枚举无效 / 章节 era 无效 / 清史稿卷次异常等。
- **证据、编辑类（只提示）**：`qing.mjs` 里的「不得把 X 写成 Y」「必须保留冲突组」——只查 CSV 数据，不查正文文风，不影响构建。文风检查已于 0.8.0 删除。

用法：

1. `npm run validate` —— 输出提示，只有结构类 error 会让它以非 0 退出。
2. `npm run validate:strict`（等价 `STRICT=1 node scripts/validate-data.mjs`）—— 可选自查：把证据断言升级为 error。
3. `npm run build` 串行执行 validate → build-release --render-only → build-site：内容类问题不失败，结构 error 才失败。生成的 `site/data/*.json` 不入库，CI 与本地都会重建。

质量基线（原先的「warning ≤ 1、断言 ≤ 0、黄金问题 ≥ 86」）已于 2026-09-11 取消：告警是给人看的雷达，不是构建闸门。

## 目录关系与部署

- **`data/` 与 `content/` 是权威层**。`scripts/build-site.mjs` 编成 `site/data/*.json`、直出首页 HTML 与 `robots.txt`（允许抓取，不投递 sitemap）。`site/data/` 与 `site/media-manifest.js` 都是派生，不入库；旧 `site/chapter/`、`person/`、`lane/`、`site/` 分享页目录和 `sitemap.xml` 由构建清理、不再生成。`site/index.html` 仍是入库的首页模板（构建会更新其中的直出内容），`robots.txt` 与带来源说明的 `basemap.js` 继续入库。手写前端只改 `site/app.js`、`templates.js`、`search.js`、`styles.css`、`qing-content.js`。
  - **构建期反向引用浏览器模块要守层**：`scripts/` 只能静态 import 无浏览器依赖的纯模块（`reading.js`、`media-paths.js`、`qing-content.js`、`live-content.js`）。`templates.js` 是唯一例外——它动态 import 构建期才生成的 `media-manifest.js`，所以必须先跑 `buildMediaManifest()`。浏览器与构建共用的规则只写一处：本地图片的 stem 与变体后缀在 `site/media-paths.js`，证据等级措辞在 `site/reading.js`。
  - **站点是单朝代运行时**：`#dynasty-config`、首页直出与 `home/people/catalog.json` 一次只承载一个朝代。切换当前朝代 = 在 `dynasties.csv` 只保留一个 `active=是` 并备齐该朝内容模块与数据。同时启用多个朝代时 `build` 会报错拦截（并非并存）——多朝代并存需要先把数据块前缀化为 `d-<code>`、给前端加朝代切换器，属后续改造而非纯 CSV 操作。
- 发现内容错误：`npm run errata -- --loc <位置ID> --text "<问题>"`（见 [`docs/25-勘误流程.md`](docs/25-勘误流程.md)）；
- **发布由 GitHub Actions 手动触发**：`deploy.yml` 仅 `workflow_dispatch`，不随 push 自动公开。需要更新线上版本时，到 Actions → Deploy Pages → Run workflow 手动运行。
- 前置条件：仓库 Settings → Actions → General → Workflow permissions 需选 **Read and write**（GITHUB_TOKEN 要推送 gh-pages）。
- 新检出先运行 `npm ci && npm run build && npm test`，再用 `npm run serve` 预览；`watch` 只负责重建，不启动 HTTP 服务。别改用 `python3 -m http.server`：它只发 `Last-Modified`、不发 `Cache-Control`，浏览器会按文件年龄猜新鲜度，而版本号 `?v=` 写在 `index.html` 里，这份 HTML 一被缓存整站就退回旧构建。CI 和手动 Pages 发布都先完整构建与测试，再上传整个 `site/`，包含被 Git 忽略的生成文件。

## 推荐阅读顺序

1. 项目章程；
2. 来源与版权规范；
3. 编辑审核规范；
4. 零预算生产方法；
5. 数据字典（`data/` 各 CSV 表头）。

## 五项默认原则（方法约定，不参与构建拦截；前四条管证据库）

1. **证据库与读本分层。** 事实以带证据的原子主张存进 CSV；读者看的文章是独立作品，可以写背景、人物、场景和今人研究，按 [`docs/30-读本写作契约.md`](docs/30-读本写作契约.md) 写。
2. **关系边必须有证据。** 生母、嫡母、养母、承嗣、过继、婚配和政治关系不得混写。
3. **历史时间必须保留原值。** 年号纪年、闰月、公历换算、精度和换算方法同时保存。
4. **能浏览不等于能复制。** 每件图片、档案和数据库资源先进入版权台账，再决定本地保存、外链或禁用。
5. **AI 没有定论权。** AI 产出（候选录文、实体、主张和叙事草稿）按「先发后标」直接进研究稿并带状态徽标；自审只检查登记与变化，不自动采纳；旧采纳不等于核实，录文对照记录见 `data/review-records.json`。

## 执行边界

**公开可及路径不设人为上限。** 「须到馆」「须机构账号」「须数据库权限」不作为停止理由，按已刊档案汇编 → 公开在线检索目录 → 公共图书馆藏本 → 开放数据集 的顺序继续找路；只有全部走完仍无入口才登记缺口。

法律与权利红线（不做让步）：

- 不绕过任何访问控制，不批量镜像一史馆、故宫、中研院或其他受限数据库；
- 不发布未经逐项核权的馆藏高清图；
- 免费可公开访问但再利用权不明的资料，只保存自建元数据、档号、必要短引文和外部链接。

内容边界：

- 目标包含十二帝完整骨架，并持续向后妃、皇子女和宗室扩充；
- 不承诺一次性完成“全部清史”，按可核验批次持续生产；
- 不把《清史稿》当最终事实裁判；
- 不编造残字、原文引文、对话和心理活动；死因、动机、争议可以讲，要说明依据或说明是推测；
- 不把历史画像、后世历史画和 AI 想象图混在同一类别。

## 零预算规则

本项目不设置预算、招聘或付费授权前置条件。只用可公开核验的资料：自建元数据、档号、必要短引文和外部链接；结论以卷页定位与冲突组为准，不以生成速度或条目数量为准。

免费可公开访问但再利用权不明的资料，只保存自建元数据、档号、必要短引文和外部链接。只有逐件确认公版、开放许可或明确授权的图像才允许本地嵌入。缺少一手材料的结论标为“待核”或“有争议”，不得为了内容数量写成确定事实。

## 完成定义

一个批次做完了，看四件事是否说得清：结构化记录齐全、来源可追、权利状态明确、争议不被掩盖。文件数量与文章字数不作考核。

## 变更记录

详见 [`CHANGELOG.md`](CHANGELOG.md)，由显式 `npm run release` 维护。

## 当前验证与发布边界

`npm run build` 只校验并生成站点，`npm run status` 显式刷新状态报告，`npm run release` 才维护版本和变更日志。后者不发布网站。`npm test` 包含 stub DOM 模板测试，不等于真实浏览器验收。整站 noindex，“收录”列只代表内部推荐。源码、依赖与实际产物一起验收，不能拿历史版本号代表当前脏工作区。
