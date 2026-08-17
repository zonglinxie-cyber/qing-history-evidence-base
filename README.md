# 清史证据库 · Phase 0 项目包

版本：`0.3.0`
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
| `docs/01-project-charter.md` | 项目使命、范围、角色、交付物和 Go/No-Go 标准 |
| `docs/02-information-architecture.md` | 产品信息架构、核心页面和用户任务 |
| `docs/03-source-and-rights-policy.md` | 史料分级、引用要求、版权三色规则 |
| `docs/04-editorial-and-review-manual.md` | 录文、主张、关系、日期、画像及 AI 使用规范 |
| `docs/05-six-week-execution-plan.md` | 零预算六批次执行计划、依赖与验收 |
| `docs/06-risk-register.md` | 风险登记、触发条件、责任人和应对方案 |
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
| `data/kangxi-source-claims.csv` | 即位、崩逝、遗诏、四后称号轴、皇子表、皇女表与储位链拆出的审核中原子主张 |
| `data/yongzheng-source-units.csv` | 雍正卷来源单元：《清史稿》卷9本纪切片与卷295隆科多、年羹尧传 |
| `data/yongzheng-source-claims.csv` | 即位、生母、密旨、年隆案、军机处、崩逝拆出的审核中原子主张 |
| `data/qianlong-source-{units,claims}.csv` | 卷15授受大典、太上皇训政表述与高宗崩逝 |
| `data/jiaqing-source-{units,claims}.csv` | 卷16、卷319中的内禅、始亲政、和珅下狱/赐死及二十大罪文本 |
| `data/golden-questions.csv` | 事实查询、关系路径、版本冲突、无证据拒答验收集；实时数量见 `STATUS.md` |
| `data/chapters.csv` | 可读章节目录；正文在 `content/emperors/`，实时数量见 `STATUS.md` |
| `data/kangxi-empress-timeline.csv` | 康熙四后时态称号时间轴；七月/九月册后冲突与孝恭非康熙朝皇后均保留 |
| `data/kangxi-princes.csv` | 康熙皇子全表：卷164入序23人、本卷缺号第四子、早薨未入序11人；表序与长子分栏 |
| `data/kangxi-princesses.csv` | 康熙皇女全表：卷166亲生20人、抚育1人；未封12、受封8；和硕/固伦按时态；荣宪沿用 QH-P-000021 |
| `data/kangxi-heir-chain.csv` | 两废太子事件链：立储、拘执、颁废、复立、再废按日拆分；实录卷234/237已回核乙亥、丁丑、丁酉、辛巳；乙丑/丙寅、四十六/四十七年、九月/十月冲突保留 |
| `data/side-lanes.csv` | 后宫趣事、野史对照、罕读史料三栏；传闻与官书分列，不升格为已核事实 |
| `content/emperors/kangxi/01-accession-and-testament.md` | 康熙即位与遗诏的首篇证据型短章 |
| `content/emperors/kangxi/02-two-depositions.md` | 两废太子：分日记录，不写成九子夺嫡 |
| `content/emperors/kangxi/03-four-empresses.md` | 康熙四后：生前称号不等于最终谥号 |
| `content/emperors/kangxi/04-prince-table.md` | 表序、长子、皇四子 |
| `content/emperors/kangxi/08-princess-table.md` | 皇女、和硕、固伦：卷166二十女加抚育一女 |
| `content/emperors/yongzheng/01-accession-and-early-reign.md` | 雍正即位、生母、年隆与军机 |
| `site/` | 本地研究稿工作台。首页只拉 `data/home.json`；人物、康熙、来源、检索按路由再拉对应 JSON。打开前先运行 `npm run build` |
| `scripts/build-site.mjs` | 把 CSV 编成确定性的 `site/data/*.json`（按路由拆分），并直出首页 HTML |
| `scripts/build-status.mjs` | 从权威 CSV 重建 `STATUS.md`，防止手工数字漂移 |
| `data/source-rights-ledger.csv` | 第一版来源与版权台账 |
| `data/controlled-vocabularies.csv` | 第一版受控词表 |
| `schema/schema.sql` | PostgreSQL Phase 0 权威主库候选结构；部署前必须在目标 PostgreSQL/扩展版本上跑迁移测试 |
| `schema/002-zero-budget-import-readiness.sql` | 零预算导入补丁：来源定位单元、远程链接资产、导入批次和公开 ID |
| `schema/data-dictionary.md` | 表、字段、约束及标准映射说明 |
| `data/import/README.md` | CSV 到数据库的身份合并、`ALL` 范围值及失败回滚规则 |
| `examples/assertion-example.json` | 一条完整的“关系主张—证据—审核”样例 |
| `scripts/validate-data.mjs` | CSV schema（必填列）、身份、卷次、许可、引用与证据等级门禁检查 |
| `scripts/test-render.mjs` | 零依赖渲染冒烟测试（`npm test`，build 之后运行） |
| `site/qing-content.mjs` | 清朝专属内容常量（谓词译名、帝王小传、储位线程等），与通用壳分离 |
| `LICENSE` / `LICENSE-data` | 代码 MIT；自建数据与文本 CC BY 4.0；第三方材料以权利台账为准 |
| `CONTRIBUTING.md` / `CODE_OF_CONDUCT.md` | 社区共建的证据规则、PR 流程与行为准则 |
| `.github/ISSUE_TEMPLATE/` | 内容纠错、图像与权利、站点 Bug 三类报错模板 |
| `.github/workflows/` | PR 校验（validate+build+渲染测试）与 main 推送自动发布 gh-pages |
| `outputs/qing-history-phase0/清史证据库_Phase0_工作台.xlsx` | 可直接分工、筛选和更新的工作簿 |

## 如何打开本地工作台

```bash
npm install
npm run validate
npm run build          # 构建站点并同步 STATUS.md
npm run status         # 只刷新 STATUS.md
npm test               # 渲染冒烟测试（含 64 道黄金问题全量验收）
npm run watch          # 监视 CSV / 正文变化并重建
python3 -m http.server 8765 --directory site
```

浏览器打开 `http://127.0.0.1:8765/`，或直接用上面的 GitHub Pages 地址。这是研究稿浏览层：主张保持「审核中」，家庭字段保持「索引级候选」，黄色/红色资源只给元数据和外链。绿色画像已缓存到 `site/media/`，页面不热链 Wikimedia。

## 目录关系与部署

- **`site/` 是唯一的前端构建产物源**。`scripts/build-site.mjs` 把 CSV/正文编成 `site/data/*.json`、直出首页 HTML，并生成 `site/chapter/<slug>/` 可分享静态页、`sitemap.xml` 与 `robots.txt`。所有前端改动只改 `site/*`（`app.js`/`templates.js`/`search.js`/`styles.css`；清朝专属内容常量在 `site/qing-content.mjs`）。
- **不是所有文章都进入搜索引擎**：只有同时绑定 `unit_ids` 且状态含 E1 的章节进入 sitemap；其余静态页自动标记 `noindex`，避免把卷级索引包装成已核内容。部署到其他域名时可用 `SITE_URL=https://example.com/base/ npm run build` 改写 canonical。
  - **站点是单朝代运行时**：`#dynasty-config`、首页直出与 `home/people/catalog.json` 一次只承载一个朝代。切换当前朝代 = 在 `dynasties.csv` 只保留一个 `active=是` 并备齐该朝内容模块与数据。同时启用多个朝代时 `build` 会报错拦截（并非并存）——多朝代并存需要先把数据块前缀化为 `d-<code>`、给前端加朝代切换器，属后续改造而非纯 CSV 操作。
- **发布由 GitHub Actions 自动完成**：推送 `main` 后，`.github/workflows/deploy.yml` 运行校验、构建与渲染测试，把 `site/` 发布到 `gh-pages` 分支（GitHub Pages 从该分支服务）。无需再手工同步；`npm run deploy` 的根目录镜像方式已废弃。
- 前置条件：仓库 Settings → Actions → General → Workflow permissions 需选 **Read and write**（GITHUB_TOKEN 要推送 gh-pages）。
- 本地开发**不要**起在仓库根（缺静态站点文件），直接 `python3 -m http.server --directory site`。

## 推荐阅读顺序

1. 项目章程；
2. 来源与版权规范；
3. 编辑审核规范；
4. 零预算生产方法与六批次计划；
5. 打开工作簿开始分派任务；
6. 技术团队再阅读数据字典和 SQL。

## 已锁定的五项原则

1. **文章不是事实源。** 事实首先保存为带证据的原子主张，文章只是派生视图。
2. **关系边必须有证据。** 生母、嫡母、养母、承嗣、过继、婚配和政治关系不得混写。
3. **历史时间必须保留原值。** 年号纪年、闰月、公历换算、精度和换算方法同时保存。
4. **能浏览不等于能复制。** 每件图片、档案和数据库资源先进入版权台账，再决定本地保存、外链或禁用。
5. **AI 没有发布权。** AI 只生成候选录文、候选实体、候选主张和叙事草稿；人工复核后才可发布。

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
