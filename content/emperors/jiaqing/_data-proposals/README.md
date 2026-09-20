# 嘉庆朝数据提案（未入库）

隔离规则：这些文件**不得**直接粘进 `data/` 覆盖旧行。入库前须：

1. 由主库分配 `person_id`（本目录用 `CAND-JQ-*`，避免与并行帝卷撞号）；
2. 核对 `QH-A-JQ-0018` 起是否仍空号；
3. 把 `chapters.csv` 的 `file` 路径、`unit_ids`、`related` 与正文对一遍；
4. 新章现状多为 `S 二手转述`；绑定 unit 并回主张后，可升 `E1 单源回查`。
5. `work_id` 用 `QH-W-JQ-01`，`index_id` 用 `IDX-JQ-*`，`question_id` 用 `QH-GQ-JQ-*`，导入时改成主库空号。

表头均抄自 2026-09-12 工作区 `data/` 对应文件，不改共享表。

| 文件 | 内容 |
|---|---|
| `chapters.csv` | 新章 QH-CH-JQ-05–14，收录=否，sort 79–88 |
| `source-units.csv` | 卷16选条、卷214/165/166/221 |
| `source-claims.csv` | QH-A-JQ-0018–0043 |
| `conflict-sets.csv` | QH-CF-JQ-TIANLI-HEADCOUNT |
| `conflict-sets-notes.md` | 不升格为冲突组的分层 |
| `phase0-people.csv` | 后妃、皇子、皇女、癸酉人名候选 |
| `jiaqing-princes.csv` | 五子；第二子本卷缺号 |
| `jiaqing-princesses.csv` | 九女 |
| `jiaqing-empress-timeline.csv` | 孝淑／孝和时态轴 |
| `qing-emperor-source-index.csv` | IDX-JQ-01–08 |
| `golden-questions.csv` | QH-GQ-JQ-01–08 |
| `imperial-works.csv` | 《钦定平定教匪纪略》入口 |
| `shared-table-notes.md` | 今地补挂与已有 QH-W 交叉，不改共享表 |

## 人物网络（本轮）

新增 `15-people-network.md` 与对应 `people-candidates.md`（或 `phase0-people.csv` 续行）。章节／主张／金题已追加到本目录 CSV。不要直接粘进 `data/`。
