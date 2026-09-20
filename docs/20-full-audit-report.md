# 20 · 全面体检报告（语法 / 排版 / AI 自说自话 / AI 自述错位）

> 生成日期：2026-08-25。范围：全部 65 篇 `content/emperors/**`、`docs/**`、根目录 README/STATUS/CHANGELOG/CONTRIBUTING。
> 方法：7 路分片逐篇通读 + 人工复核高严重项。文言引文（实录/上谕/朱批/口供原文）按原样保留，不计入。
> 对照红线：`docs/04-editorial-and-review-manual.md` §13、`docs/09-voice-and-register.md`、`docs/01` 决策原则 1。

四类问题对应你的原话：**① 语法错误 ② 文字排版错误 ③ AI 语句的自说自话 ④ AI 自述本应在项目文件、却混进了读者层。**
§13.3 允许的克制句式（「不能把 X 写成 Y」「待核」「未回原文」「两说并存」「本库不裁」）不算问题，未列入。

---

## 一、AI 自述错位（本应在项目文件，却写进了读者层）——最严重

这是你点名的第四类，也是项目「证据克制」定位最伤的一类。共同病灶：把**生产过程的元话术**（工作组名、批次号、任务号、轮次、「深挖第一版」「补齐」「新增」）写进了面向读者的章节导语或 README。

| 位置 | 引文 | 问题 | 改法 |
|---|---|---|---|
| `content/emperors/kangxi/09-reign-timeline.md:5` | 康熙深挖·第一版 | 生产轮次话 | 删 |
| `content/emperors/yongzheng/06-reign-timeline.md:6` | 大事记组 · 雍正深挖（对应 task-queue TQ-0010 的雍正侧） | 工作组名 + 任务号写进读者导语 | 删括号与组名，只留纪年口径与已回卷次 |
| `content/emperors/daoguang/03-reign-timeline.md:6` | 大事记组 · 道光深挖 | 工作组名 | 删 |
| `content/emperors/guangxu/03-reign-timeline.md:6` | 大事记组 · 光绪深挖 | 工作组名 | 删 |
| `content/emperors/xuantong/03-reign-timeline.md:6` | 大事记组 · 宣统深挖 | 工作组名 | 删 |
| `content/emperors/nurhaci/03-reign-timeline.md:6` | 大事记组 · 努尔哈赤深挖 | 工作组名 | 删 |
| `content/emperors/huangtaiji/03-reign-timeline.md:6` | 大事记组 · 皇太极深挖 | 工作组名 | 删 |
| `content/emperors/shunzhi/03-reign-timeline.md:6` | 大事记组 · 顺治深挖 | 工作组名 | 删 |
| `content/emperors/guangxu/01-hundred-days-and-arsenic.md:185` | 光绪深挖·第一版 | 生产轮次话 | 删 |
| `content/emperors/xuantong/03-reign-timeline.md:44` / `yongzheng/06:130` | 深挖状态为「第一版」 | 版次工作日志语 | 改「除已钉卷次外，其余月日仍待逐条回查」 |
| `content/emperors/appraisals/README.md:3` | 帝王评传组第一版产出 | 批次口吻导语 | 改「索引级评传总览，范围康熙之外十帝」 |
| `content/emperors/disputes/README.md:3` | 人文兴趣与争议组第一版产出 | 同上 | 同上 |
| `content/emperors/periods/README.md:4,111,112` | 历史脉络组第一版产出 / 下一步（组待续）/ 康雍专题挂接 | 生产元话术 | 删组名与「下一步」，挂接说明移入 docs |
| `content/emperors/reading/README.md:3` | 文献现代解读组第一版产出 | 同上 | 同上 |
| `content/emperors/README.md:50-52` | ## 下一批 …此前未绑来源单元，现已接到 | 进度交代进读者 README | 删节或改成读者入口说明，进度移入工作日志 |
| `content/emperors/README.md:12` | **新增：** 十二帝御制著述…实时数量见 `STATUS.md` | 变更日志口吻 + 指向项目状态文件 | 删「新增：」，STATUS.md 移出正文 |
| `content/emperors/yongzheng/04-dayi-juemilu.md:219,533,535,745,747,813,815` | ## 逐段解读：…（补齐） / 前四条补在卷三后段，第五条「收妃嫔」先行拆过 | 读者层标题「补齐」自报批次 | 标题去「补齐」；正文改按原书编号往下读 |
| `content/emperors/yongzheng/04-dayi-juemilu.md:1002` | 均已按维基文库显式段落完成短摘五件套 | 「五件套」内部生产口令 | 改「已按段落做短摘」或删 |
| `content/emperors/yongzheng/04-dayi-juemilu.md:535` | 仅有结构标题而没有独立正文的节点，不另造主张 | 编辑约束写进逐段解读引言 | 删句 |
| `content/emperors/yongzheng/04-dayi-juemilu.md:515` | 储位层的日期与程序另见 yongzheng-07 | 「今天怎么读」里出现内部斜杠 | 改章节链接 |
| `README.md:168-173` | **开闸 v0.1（本次）** | 「开闸」「本次」生产自述，且整段停在 v0.1、第 3 条写已删的存疑功能 | 删 README「变更记录」（或改一句「版本见 CHANGELOG」） |
| `README.md:158` | 现阶段由用户确定方向，AI 负责…持续扩充 | 面向读者规则节自我交代分工 | 改成资料范围与核验标准 |

**`.workbuddy/memory/*.md`**：三份（MEMORY.md、08-15、08-16）是 AI 工作日志，**未进 git（`git ls-files` 为空，`.gitignore` 已忽略）**，所以不算「混进项目」；但其中 `2026-08-16.md` 自身也有病句（见第二节），若日后纳入仓库须先清理。

---

## 二、语法错误（中文病句 / 缺字 / 错别字 / 数字时间错误）

按严重度从高到低。

### 高
- `content/emperors/xuantong/01-abdication.md:57` —「铁路国**于是**看见弊窥、没看见潜伏」：① 缺「有」，应「铁路国有于是看见弊窦」；② 同页 55 行「白话」层写「弊洞」、57 行「为何这样写」层写「弊窥」，**两层不一致**，统一为「弊窦/弊洞」。
- `content/emperors/xianfeng/01-rehe-and-yuanmingyuan.md:56` —「光绪的终由民国**检测验**」：缺字，「检测验」不成词，应为「检测/鉴定」。
- `content/emperors/yongzheng/04-dayi-juemilu.md:899` —「**四百年后**我们读觉迷录」：书成于雍正七年（1729），至今约三百年，「四百年」错。
- `content/emperors/jiaqing/02-jiaqing-scholarship.md:41` —「**十八年后**以最坏的形式应验」：康熙→嘉庆跨度约一百二十年，「十八年」错。
- `content/emperors/xianfeng/01-rehe-and-yuanmingyuan.md:82` —「**一百一十年后**同一条禁令」：康熙四十四年（1705）→咸丰五年（1855）约一百五十年，数错。
- `content/emperors/jiaqing/04-heshen-transition.md:59` —「相形见**绋**」→「相形见**绌**」。
- `content/emperors/qianlong/02-qianlong-scholarship.md:18` —「文学评价参**差**不齐：批评者…肯定者…」后接「诗中大量涉及…是研究乾隆朝历史的重要侧面材料」——**「重要侧面材料」属 §13.2 空洞尾句**，删。
- `content/emperors/yongzheng/04-dayi-juemilu.md:707` —「劝人造反的活着，死了几十年的学者被戮」：「的」字结构缺中心语，应「劝人造反**的人**活着」。
- `content/emperors/yongzheng/04-dayi-juemilu.md:165` —「值的不是史实，是修辞」→「**值**的不是史实」或「值钱/值得看的」。
- `content/emperors/qianlong/01-ten-complete-and-abdication.md:40` —「禅位…的**执行**仍由本人承担」→「**施行**仍由本人承担」（「执行」搭配不当）。
- `content/emperors/jiaqing/01-internal-abdication.md:7` —「嘉庆即位与禅位之间，权力交接的**执行**仍由本人承担」→ 同上。
- `content/emperors/jiaqing/01-internal-abdication.md:33` —「1796 年嘉庆即位，**却仍**以太上皇训政」：句意不通，「却仍」与主语错位。
- `content/emperors/kangxi/07-taiwan.md:15` —「郑经**于**1683 年病逝」：缺「年」字前的「于」后缺时间词，应为「1683 年病逝」。
- `content/emperors/yongzheng/04-dayi-juemilu.md:335,453` — 雍正原话「我把吕留良说成…」「我即…」：这是**忠实译文，保留**；但 453「我即」后若接解释需确认未把译文当白话。

### 中
- `README.md:38` —「实录即位/崩逝/遗诏、卷234初废条次、卷237复立，**加**后妃传、本纪六七八九、实录卷48册谥诏」：电报体缺中心语、粘连、「加」口语粘补。改「实录所载即位/崩逝/遗诏；本纪卷六至九、实录第48册谥诏」。
- `docs/10-next-changes.md:47` —「历史照片 **3 件**：光绪常服照、溥仪在紫禁城」：宣称 3 件只列 2 个名字，补第 3 件或改「2 件」并重算上文 25 件总数。
- `docs/10-next-changes.md:96-98` —「取**除 `朝服像` 外的全部 7 组**…按组分段（**8 个 `h2`，含朝服像**）」：同一节先 7 组后 8 个 h2，自相矛盾。
- `CHANGELOG.md:834` —「**六大**时空多维分类过滤（关外发祥、中枢宫苑、要塞疆土、近代变局、关内外皇陵）」：写「六大」只列 5 项。
- `content/emperors/README.md:8` —「逐文件**核过**公版标示的明黄朝服默认像」缺「对」（核对）；「光绪照片…作为**其他真迹**进入人物页」——光绪照片不能称「真迹」，改「权属已核的历史照片」。
- `content/emperors/yongzheng/04-dayi-juemilu.md:83` —「公开辩驳在帝制时代**极罕见**；罕见本身，就是这份材料**最值得读**的地方」：「极罕见/最值得读」属 §13.2 空洞比较，且「最值得读」是主观价值判断。
- `content/emperors/nurhaci/02-nurhaci-scholarship.md:18` —「在清代官修史书里是**独一份**」：近「绝无仅有」，改「三体合璧体例少见」。
- `content/emperors/guangxu/02-guangxu-scholarship.md:40` —「本库不裁肇事者」后用「但每本账…本库不裁…只把三本账摊开」：长句「它们不互相取消——慢病之人也可以中急性毒；人伦关切也不排除毒」断句冗，可拆。
- `content/emperors/jiaqing/02-jiaqing-scholarship.md:51` —「**1803 年后**仍由军机处处理」：缺主语衔接。
- `content/emperors/huangtaiji/01-khan-and-emperor.md:51` —「**1636 年**才正式以『大清』为国号」：需与同页「1632 满文创制」区分清楚，避免读者误读为 1632 年建国号。改国号在 1636 年（天聪十年四月，同年改元崇德）无误。**本节原稿曾把 1636 年误系于「天命十一年」——天命十一年为 1626 年（皇太极继汗位之年），二者不可混；已更正。**
- `content/emperors/xiantong/... ` 同上。
- `docs/08-filling-more-emperors.md:13` —「回查状态从 `S二手索引` 起步」与同文件 11 行 `S二手转述`、`docs/07` 的 `S 二手转述` 不一致。
- `docs/08-filling-more-emperors.md:25` —「不放康熙朝在位皇后逻辑里」缺介词，应「不放进」。
- `content/emperors/reading/README.md:3` —「光绪遗诏由**民国检测验**」：与 xianfeng 章同一病句，缺字。
- `content/emperors/appraisals/README.md:37` —「**慈禧咸丰朝**」：缺「之/的」或应为「咸丰朝慈禧」（断句）。
- `content/emperors/xuantong/03-reign-timeline.md:5` —「宣统政纪**第一版深挖**」：生产轮次话（见第一节）。
- `content/emperors/xianfeng/01-rehe-and-yuanmingyuan.md:56` —「光绪的终由民国检测验」与 82「一百一十年后」两处数错。

### 低（标点 / 引号 / 空格）
- `README.md` 多处中文引语用半角 `""`，与同页「」混用（L11/15/63/149/160/164）。
- `CONTRIBUTING.md:3,26,66` 半角 `""` 混用（「文章更长的清史百科」「尚未找到材料」「没有发生」「九子夺嫡」）。
- `docs/archive/09-content-strategy.md` 全文半角 `""` 与「」混用（L14/20/21/22/24/30/32/38/42/47）。
- `STATUS.md:37` —「"卷级索引"」半角引号 →「卷级索引」。
- `content/emperors/README.md:3,9` — 半角 `""` →「」。
- `content/emperors/shunzhi/02-shunzhi-scholarship.md:10,14,29` — 半角 `""`（「渐习汉俗」「成宗义皇帝」）→「」。
- `content/emperors/huangtaiji/02-huangtaiji-scholarship.md:18` — 半角 `""`（「才成为」）→「」。
- `README.md:78 vs 144;173` —「逐字引文 **+** 卷页定位」半角与「逐字引文 **＋** 卷页定位」全角混用，统一。
- `content/emperors/kangxi/02-two-depositions.md:3,11,12` —「卷 234」与「卷234」空格不一；「卷 237 乙亥」空格。
- `content/emperors/qianlong/03-reign-timeline.md:3` —「卷 414」空格 vs 同页其他无空格。
- `content/emperors/jiaqing/03-reign-timeline.md:5,30` —「卷 16」空格 vs 同页其他无空格。
- `content/emperors/daoguang/02-daoguang-scholarship.md:3` —「宣宗实录 476 卷」空格 vs 同页其他无空格。
- `content/emperors/nurhaci/04-manzhou-shilu.md:18` —「同一句里还有两个数：癸未（万历十一）、太祖年二十五」：所引满洲实录句无「年二十五」，误植本纪层，删「年二十五」或标明。
- `content/emperors/huangtaiji/04-xiaoting-zalu.md:3` — 状态行末双空格（Markdown 行尾空格，破图风险）。

---

## 三、文字排版错误（Markdown 结构）

| 位置 | 问题 | 改法 |
|---|---|---|
| `content/emperors/yongzheng/04-dayi-juemilu.md:941` | `#### 读这一句` 在 `## 骨架` 下直接跳到 4 级，跳过 `###` | 改 `### 读这一句` 或前加 `### 改诏短引` |
| `content/emperors/yongzheng/06-reign-timeline.md:28-32` | 同表年份倒置：1724 行排在 1723（开豁为良）行之前 | 按年月重排 |
| `content/emperors/yongzheng/06-reign-timeline.md:26` | 标题「## 二、财政与制度改革（1723—1730）」，表内却有 1732 年十年六月军机条 | 标题年限改 1723—1732 或搬出行 |
| `content/emperors/yongzheng/06-reign-timeline.md:69-82` | 同篇年表第五、六节三列，其余各节四列（多「状态」） | 补「状态」列对齐 |
| `content/emperors/yongzheng/04-dayi-juemilu.md:10,11,533,535` | 连续 `>` 引用块之间空行被误读为独立引用段 | 检查空行，合并或补分隔 |
| `README.md:125` | 「   - **站点是单朝代运行时**」多两个空格，被收成上一节子项但内容不从属 | 对齐为同级 `-` |
| `CHANGELOG.md:851` | 全文件 851 行，含 0.3.0 → 0.3.164 共 164 个仅改 2 个数字的版本块 | 折叠为「0.3.0–0.3.164：逐条补史料/文字/图像，详见 git 历史」 |

---

## 四、过时 / 与现行配置矛盾（README 最重）

README 多处仍把**已删/已改**的功能当现行写，与 `.github/workflows/deploy.yml`、`CHANGELOG.md`、`package.json` 直接冲突：

| 位置 | 矛盾 | 现行事实 |
|---|---|---|
| `README.md:70,126` | 「main 推送自动发布 gh-pages」「发布由 GitHub Actions 自动完成」 | `deploy.yml` 已改 `on: workflow_dispatch`（手动）；CHANGELOG 0.6.0「自动发布改为手动触发」 |
| `README.md:123-124` | 「生成 `sitemap.xml` 与 `robots.txt`」「`收录` 列决定 sitemap」「页内研究草稿横幅」 | 0.6.0 已停 sitemap、全站 `noindex`、删章节草稿横幅 |
| `README.md:98-106,171` | 教读者点「标存疑」→ `#/review` → localStorage 导出 `review-notes.csv` | CHANGELOG 0.5.0「删除本地存疑标注系统」；`test-render.mjs` 已确认无此功能 |
| `README.md:119` | 「`npm run build` 串行执行 validate → build-site → build-data-browser → build-status」 | 漏了 `package.json` 与 L79 都有的 `build-release`；正确序：validate → build-release → build-site → build-data-browser → build-status |
| `README.md:136` | 「5. 技术团队再阅读数据字典」 | 零预算个人库突然冒出「技术团队」，改「（可选）数据字典」 |
| `STATUS.md:18-19` | 「进入 sitemap 的章节」「证据闭环、可去掉草稿横幅的章节」 | 已废指标名，改生成模板用词 |
| `CONTRIBUTING.md:39` | 「`npm run validate` 必须全绿（0 errors / 0 warnings）」 | 默认 validate 对证据类 warning 不失败，未提 `validate:strict` |
| `CONTRIBUTING.md:60` | 「（见 LICENSE 与 LICENSE-data）;」 | 中文括号后接英文分号 |

---

## 五、AI 语句的自说自话（§13.2 空洞评述 / 自我叮嘱）

- `content/emperors/yongzheng/08-yuzhi-wenji-prefaces.md:8` —「两层都不许删」：作者自我叮嘱，改「两层都要留着」或删。
- `content/emperors/qianlong/02-qianlong-scholarship.md:18,64` —「重要侧面材料」「本库记录现状，不取终局性结论」尾句冗（后半是克制句，前半是空洞尾句，删前半）。
- `content/emperors/yongzheng/04-dayi-juemilu.md:83,165,899` — 见第二节高/中严重项。
- `content/emperors/nurhaci/02-nurhaci-scholarship.md:18` —「独一份」，见第二节。
- `content/emperors/daoguang/03-reign-timeline.md:28,36` —「咸丰朝由盛转衰的过渡期」「外战内乱」单标签概括，§13.2 禁「盛世/衰世」类，改「中衰期的内外交困」并标「史家评价」。

---

## 六、`.workbuddy/memory/2026-08-16.md` 自身病句（未进 git，但建议清理）

- L42「**批次1** 解读组」与 L46「**批次 1** 全部完成」：数字—汉字空格不一。
- L55「**死死于**铁路国有前一年」：多一「死」字，应「死于」。
- L88「**执行**记录」→「施行/执行」可保留但与前文统一。
- L127「均如实标注**不沿**「全胜」评价」：「不沿」不成词，改「不沿用/不沿袭」。
- L135「**17子10女**，序齿17、未命名3」：先 17 子又叠「序齿 17、未命名 3」，17 与 20（17+3）打架。

---

## 七、代码 / 构建

- 全部 `.mjs` 通过 `node --check`（scripts/ + site/），无语法错误。
- `node scripts/build-status.mjs` 正常生成 STATUS.md（claims 881 / chapters 58 / source-bound 58 / indexable 36 / review-items 53）。
- 无 JS 语法/排版问题；问题集中在 Markdown 文案与配置一致性。

---

## 优先级建议

1. **先修第一节（AI 自述错位）**——直接伤害「证据克制」定位，且多为机械删除（组名/批次号/任务号）。
2. **再修第四节（过时功能）**——README/CONTRIBUTING 与 `deploy.yml`/`CHANGELOG`/`package.json` 矛盾，读者会被误导。
3. **然后修第二节高严重（病句/数字错/错别字）**——影响可信度。
4. 低严重标点/空格统一可批量替换。
5. `.workbuddy/memory/` 不进 git，可不优先，但若纳入仓库须先清理第六节。

> 本报告为只读审计，未改动任何源文件。修复时按 `docs/01` §8 变更控制：方向性改动先在 README「变更记录」加一行（或改指向 CHANGELOG），git 历史即决策记录。
