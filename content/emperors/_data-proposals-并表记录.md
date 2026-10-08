# 十二帝提案并表记录（2026-10-08）

按 `docs/28-十二帝补全总账与并表预案.md` 的碰撞、准入、依赖与审核态政策，将十二帝 `_data-proposals/*.csv` 与 `content/emperors/_cross-cutting-proposals/` 横切提案并入 `data/*.csv` 生产表。并表由确定性脚本一次跑成（基线 `0b82ad3`，逐表比对、全量引用改写、EOL/BOM 保形），**未提交**。

## 一、总量

| 动作 | 行数 |
|---|---|
| 新增 insert | 716 |
| 更新 update | 123 |
| 跳过 skip | 93 |
| 重编号 renumber | 42 |

### 新增明细（按表）

| 表 | +行 |
|---|---|
| source-claims | 186 |
| source-units | 129 |
| phase0-people | 80（另有 36 行以新铸号并入，见重编号） |
| qing-emperor-source-index | 60 |
| golden-questions | 55 |
| source-rights-ledger | 44 |
| emperor-timeline | 34 |
| controlled-vocabularies | 30 |
| imperial-works | 29 |
| conflict-sets | 21 |
| task-queue | 15 |
| data-manifest | 14（新轴表登记） |
| source-families | 11 |
| side-lanes | 6 |
| historic-sites | 1 |
| emperor-portraits | 1（QH-V-E09E） |

### 更新明细（按表）

emperor-timeline 36、chapters 34、golden-questions 20、source-rights-ledger 5、source-claims 5、image-regions 5、historic-sites 4、qing-emperor-source-index 3、side-lanes 3、章节 md 3、source-units 1、imperial-works 1、shunzhi-empress-timeline 1、daoguang-empress-timeline 1、phase0-people 1。

### 跳过明细（93 行）

| 表 | 行数 | 主因 |
|---|---|---|
| source-claims | 61 | 51 行已在生产且提案字段差异以生产为准；4 行依赖未入库单元；2 行（KX-0194/0195）与 AD 系同条，引用改指 AD-0004/AD-0001；YZ-0466 同条弃提案；其余同号去重 |
| historic-sites | 10 | 缺文件页/经纬度（ST-0049/0051/0061/0070–0075），ST-0052 慕陵经纬为约数按预案不造坐标 |
| conflict-sets | 8 | 努尔哈赤八组已在生产 |
| phase0-people | 7 | QH-P-000201–206/214 已在生产 |
| source-units | 3 | QH-SU-QL-YSP-0001A、QH-SU-QL-1928-0001A/0002A 直接记录网址空缺，提案自注不伪造 URL → 不入库 |
| source-rights-ledger | 2 | SRC-131/132 横切行与皇太极、道光提案同源同号 → 去重 |
| xianfeng-empress-timeline | 2 | QH-TE-XF-12/13 引文空缺（提案自注待对齐后补）→ 不并入，防伪引文 |

依赖剔除连带：QL-YSP/1928 三单元未入库 → QH-A-QL-0101/0102/0104 三主张不入库。

## 二、碰撞与重编号（42 项）

### 乾隆 0042–0044 紫光阁 vs 公主表

- 生产 `QH-A-QL-0042/0043/0044` 为紫光阁功臣像赞三条，**保持原号原义不动**。
- 提案公主表三条在提案源文件已预重号为 `QH-A-QL-0109/0110/0111`，按新号入库。
- 引用改写按章定向：`content/emperors/qianlong/17-princess-table.md` 三处 0042–0044 → 0109–0111；`18-ziguangge-heroes.md` 保持 0042–0044 不变。校验：`QL-0042` 仍为「写诸功臣像于紫光阁」，`QL-0109` 为公主表总条。

### 顺治 PROP 归位

提案标识符 `QH-P/QH-SU/QH-A/QH-CF/QH-TE/QH-GQ/TQ/IDX/SRC/QH-W-SZ-PROP-*` 经映射表统一落为生产号：人物提案号在提案源文件已预重号至 QH-P-000370+，章节引用按行序对应表改写；生产表内遗留 `QH-A-SZ-PROP-0081/0044/0051` 三条归位为 `QH-A-SZ-0081/0044/0051`；`content/emperors/shunzhi/11-people-network.md` 与 `kangxi/19-people-network.md` 内 PROP/废弃号全部改写。并表后 `data/` 与章节正文中 PROP 残留为 0（提案目录内保留为源工件）。

### 其他重号

- 道光子女/妃嫔 20 人「待分配」→ `QH-P-000216–000234`；生母六人 → `QH-P-000235–000240`。
- 乾隆皇女候选 `CAND-QL-*` 11 人 → `QH-P-000241–000251`。
- 咸丰台账 `SRC-110/111` 与生产同号（天朝田亩制度、资政新篇）→ `SRC-151/152`。
- 宣统御制 `QH-W-090–095` 整段与乾隆提案 090–093 撞号 → 改号 `QH-W-098–103` 区间。

## 三、就地调和（生产为准）

- 51 条已在生产的提案主张存在字段差异（谓词、来源实体、状态、主体等），一律**保留生产行**，差异记入日志；提案引用改指生产号。
- 章节不新增不复制：34 个既有章节就地并入提案可用 `unit_ids` 与 `related` 链接（努尔哈赤 4、顺治 11、乾隆 2、道光 2、同治 2、光绪 5、宣统 5 等章）；无新章注册——提案章其引用单元未齐者不登记。
- 横切勘误落库：ST-0028 葬者名单改正（宣统无清陵），ST-0011/0017/0026 挂林则徐、洪秀全人物档。

## 四、规范化动作（全部入日志）

- 导入主张审核态：186 条新主张全部 `审核中`（生产 已采纳 925 条并表前后不变）；提案 `已采纳/候选` 一律降为 `审核中`。
- 台账等级枚举：SRC-147–150「现代制作」→「后出」（校验器枚举仅收 同时代·官方/同时代·私撰/后出；本库自制示意图按后出层级登记）。
- 时间轴证据状态回落：TL-DG-008–014、TL-XF-007–014、TL-TZ-007–018、TL-XT-013 等 36 行由 `S二手转述` 降为 `S二手索引`（绑定单元为《清史稿》本纪索引 IDX-048 级，尚未转录，不冒称转述级）；道光行 QH-SU 引用改指 IDX-048；TL-XT-008 补挂 QH-A-XT-0018 保 E1 绑定。
- 黄金问题：绑定非法前缀（QH-GQ/QH-E/QH-IR/CAL-*）摘除或改指；QH-GQ-0102 因反方仅有单元无主张而由「并陈冲突」降档「返回答案」（不伪造冲突组）；期望行为动词归入枚举；公开答案内内部工件名（研究卡、黄金问题）改为公开措辞。
- 侧车道：QH-L-0047/0048 证据状态 `S二手索引`→`S二手转述`（车道枚举只收转述级），并删内部工件名。
- 图像区：IR-0001/0002/0003 解除误挂主张；IR-0007/0009 改挂 QH-A-KX-0198。
- 谓词补登：`regency_arranged` 等 30 条受控词入库。
- 事件类型归并：TL-SZ-014 追封→册封、QH-TE-0082 追册→册封。
- 行修复：SRC-125/SRC-165 题名内逗号列错位重建（SRC-165 落 同时代·私撰/黄，网址留空待确认）；QH-SU-SZ-MS-0001AR1 缺列归位；IDX-XF-07/08、IDX-137 空网址行状态加「入口待核」。
- QH-A-SZ-0119 提案误填台账号 SRC-025 → 指回 QH-SU-SZ-0005HR1；QH-A-KX-0197 公历界对齐 KX-0053；QH-A-DG-0032/0034 主体待分配改指新档；QH-A-AD-0005 元年→二年九月甲寅订正落定。

## 五、新轴表与清单登记（data-manifest +14）

新建并登记：`shunzhi-empress-timeline(10)/shunzhi-princes(8)/shunzhi-princesses(9)`、`jiaqing-empress-timeline(9)/jiaqing-princes(5)/jiaqing-princesses(9)`、`daoguang-empress-timeline(13)/daoguang-princes(9)/daoguang-princesses(10)`、`xianfeng-empress-timeline(15)/xianfeng-princes(2)/xianfeng-princesses(2)`、`tongzhi-empress-timeline(8)`、`qianlong-princesses(11)`。顺治公主表三行（QH-P-000403/0404/0405）「父亲ID」为生父硕塞/济度/岳乐而抚育在世祖，生父未入人物档，留注待补。

## 六、校验 · 构建 · 测试

- `npm run validate`：**errors 0 / warnings 12 / assertions 6**（基线 0/1/6）。
- `npm run build`：成功；Home emperors 12、sites 49、search entries 2917。
- `npm test`：reader 单测、validate fixture、渲染测试全部通过。
- 测试口径一处随并表更新：`scripts/test-render.mjs` 像与物页计数 64→65（新增 QH-V-E09E 一件，属真实增量非回归）。

### 遗留 12 条警告（提示级，不阻断）

- `SRC-036/165/147/148/149/150` 资源网址需人工确认（6）——网址待人工核实，非数据错误。
- `QH-SU-KX-YL-0001` 单元证据等级高于台账上限（1）——单元级更细的合理越级，待台账回核。
- `QH-CF-SZ-MONK/-DONGE`、`QH-CF-JQ-TIANLI-HEADCOUNT`、`QH-CF-DG-YIZHI-NAME`、`QH-CF-GX-CHONGLING-YU` 冲突组当前仅 1 条主张（5）——组已建、对家主张待后续提案补齐，属结构性待办。

### 备注

- 5 条新主张编辑备注含「人物新档待分配」（GX-0052/0056/0060/0082、XT-0017），仅备注字段，人物档排期后续。
- `data/import/README.md` 废止说明、`data/overviews.csv` BOM 归一等为工作区既有改动，非本轮并表产出。
- 审计明细存于合并日志（insert/update/skip/renumber/note 全量条目），可逐行回溯。
