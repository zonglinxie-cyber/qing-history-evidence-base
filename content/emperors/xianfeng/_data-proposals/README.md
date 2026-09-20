# 咸丰卷数据提案（未入库）

隔离：本目录只提案，**不得**粘进 `data/` 覆盖旧行。未改共享文件，未 commit。

表头均抄自 2026-09-12 工作区 `data/` 对应文件（三张深挖表抄 `docs/08`）。人物用 `CAND-XF-*`，避开同治卷已预占的 `QH-P-000187` 起号。来源台账用 `SRC-110`、`SRC-111`，避开并行卷的 `SRC-067+`。著作用 `QH-W-086`、`QH-W-087`，避开 `QH-W-080+`。卷21 徽号单元用 `QH-SU-XF-QSG-0021H`，避开同治提案已占的 `QH-SU-TZ-QSG-0021H`。

## 入库顺序

1. `source-rights-ledger.csv`（SRC-110、SRC-111）
2. `phase0-people.csv`（主库改正式 `person_id` 后再写主张主体）
3. `source-units.csv`
4. `source-claims.csv`（`QH-A-XF-0032`–`0058`；状态一律「审核中」）
5. `qing-emperor-source-index.csv`
6. `chapters.csv`（QH-CH-XF-04–08）
7. 其余：`imperial-works.csv`、`emperor-portraits.csv`、`emperor-timeline.csv`、`conflict-sets.csv`、`golden-questions.csv`、三张深挖表、`task-queue.csv`

不要单独先合 `chapters.csv` 或 `golden-questions.csv`：续章与问题绑了尚未入库的主张号。已注册的 01–03 **不要**回写新 `{{claim:}}`。

## 章节与主张对照

| 章 | slug | 新主张 | 兼用已有 |
|---|---|---|---|
| 04 | xianfeng-04 | 0034–0037、0056、0057 | 0008、0009 |
| 05 | xianfeng-05 | 0039–0042、0045 | 0001、0010–0015、0017、0019 |
| 06 | xianfeng-06 | 0033、0038、0046–0055 | 0002 |
| 07 | xianfeng-07 | 0044、0058 | 0016、0018；TZ-0001、0002、0007 |
| 08 | xianfeng-08 | 0036、0037、0039、0043 | 0017、0020、0021、0031 |

`QH-A-XF-0032`（即位诏封奕訢恭亲王）供年表选用，续章未挂。

## 不要做的事

- 不要把道光朝《筹办夷务始末》序改挂到 `QH-W-070`。
- 不要把 `QH-P-000187` 当作本卷已分配号。
- 不要新造无绿图遗址（八里桥、天京只挂现有 ST）。
- 户部官票许可未逐件核，不嵌入、不给登录号。

## 人物网络（本轮）

新增 `09-people-network.md` 与对应 `people-candidates.md`（或 `phase0-people.csv` 续行）。章节／主张／金题已追加到本目录 CSV。不要直接粘进 `data/`。
