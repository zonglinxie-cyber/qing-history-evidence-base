# 同治卷数据提案（未入库）

本目录只给共享表提供可粘贴的候选行。**尚未写入 `data/`。** 入库前须再跑 `npm run validate`，并把新主张的 `{{claim:}}` 补进对应章节。

新章节正文目前只引用已入库主张（`QH-A-TZ-0001`–`0019`）。下表新 ID 从 `QH-A-TZ-0020` 起号，避免和现库冲突。

| 文件 | 对应共享表 | 行数 |
| --- | --- | --- |
| `chapters.csv` | `data/chapters.csv` | 5 |
| `source-units.csv` | `data/source-units.csv` | 13 |
| `source-claims.csv` | `data/source-claims.csv` | 29（`QH-A-TZ-0020`–`0048`） |
| `source-rights-ledger.csv` | `data/source-rights-ledger.csv` | 1（`SRC-126`） |
| `conflict-sets.csv` | `data/conflict-sets.csv` | 1 |
| `phase0-people.csv` | `data/phase0-people.csv` | 7（`CAND-TZ-*`） |
| `historic-sites.csv` | `data/historic-sites.csv` | 1 |
| `imperial-works.csv` | `data/imperial-works.csv` | 2 |
| `qing-emperor-source-index.csv` | `data/qing-emperor-source-index.csv` | 4 |
| `emperor-timeline.csv` | `data/emperor-timeline.csv` | 12 |
| `tongzhi-empress-timeline.csv` | 尚无同治后妃时态表；列结构依 `docs/08` | 8 |
| `golden-questions.csv` | `data/golden-questions.csv` | 5 |
| `task-queue.csv` | `data/task-queue.csv` | 5 |
| `shared-file-corrections.md` | 既有行文字更正（仍不直接改） | — |

号段已避让并行帝卷与补丁，入库前仍须再核主键：

| 种类 | 本卷提案号 | 避让原因 |
| --- | --- | --- |
| 人物 | `CAND-TZ-*`（入库时重号） | 咸丰卷已占 `QH-P-000187`–`000192` |
| 今地 | `QH-ST-0049` 惠陵 | 宣统卷已让出此号，不另开 |
| 著作 | `QH-W-096`、`QH-W-097` | 康熙占 `080`/`081`，光绪提案 `084`，宣统 `090`–`095` |
| 来源台账 | `SRC-126` | `SRC-067` 会典补丁；`068` 努尔哈赤实录；宣统 `120`–`125` |
| 来源索引 | `IDX-TZ-01`–`04` | 努尔哈赤 `IDX-106`–`111`；宣统 `130`–`138` |
| 黄金问题 | `QH-GQ-TZ-01`–`05` | 补丁已占 `QH-GQ-0087`–`0094` |
| 任务 | `TQ-0039`–`0005` | 不抢 `TQ-0028` |
| 冲突组 | `QH-CF-TZ-DEATH` | 库内尚无同治死因组 |

新主张 `QH-A-TZ-0020`–`0048` 状态一律「审核中」。正文现章不得先写 `{{claim:QH-A-TZ-0020+}}` 或 `{{conflict:QH-CF-TZ-DEATH}}`。

## 人物网络（本轮）

新增 `09-people-network.md` 与对应 `people-candidates.md`（或 `phase0-people.csv` 续行）。章节／主张／金题已追加到本目录 CSV。不要直接粘进 `data/`。
