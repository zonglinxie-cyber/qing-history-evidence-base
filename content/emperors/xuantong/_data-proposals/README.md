# 宣统卷数据提案

只提案，不改 `data/` 共享文件。导入前须再跑主键检查。

本卷预留块（避开已入库最大号，以及并行帝卷已占用的 `SRC-067+`、`QH-W-080+`、`QH-ST-0049`）：

| 种类 | 本卷提案号 |
|---|---|
| 权利台账 | `SRC-120`–`SRC-165`（卷86仍用已有 `SRC-025`） |
| 来源索引 | `IDX-130`–`IDX-138` |
| 文献 | `QH-W-115`–`QH-W-095` |
| 今地 | 仅 `QH-ST-0061`（华龙）。惠陵不新开，让同治卷 `QH-ST-0049` |
| 主张 | `QH-A-XT-0016`–`0028`，状态一律 `审核中` |
| 单元 | `QH-SU-XT-QSG-0025E–J`、`0086A`、`0022A`、`YD-0001A/0002A`、`SHWY-0001A` |
| 章节 | `QH-CH-XT-04`–`12` |
| 年表 | `TL-XT-007`–`013` |
| 冲突组 | `QH-CF-XT-*`（正文不用 `{{conflict:}}`，待入库） |

人物新档不要擅用 `QH-P-*`；见 `people-candidates.md`。

新主张未写入已挂 `chapters.csv` 的 01–03 正文。续章也未绑 `QH-A-XT-0016+`，等共享表导入后再加 `{{claim:}}`。

| 文件 | 对应共享表 |
|---|---|
| `source-rights-ledger.proposal.csv` | `data/source-rights-ledger.csv` |
| `source-units.proposal.csv` | `data/source-units.csv` |
| `source-claims.proposal.csv` | `data/source-claims.csv` |
| `chapters.proposal.csv` | `data/chapters.csv` |
| `conflict-sets.proposal.csv` | `data/conflict-sets.csv` |
| `imperial-works.proposal.csv` | `data/imperial-works.csv` |
| `historic-sites.proposal.csv` | `data/historic-sites.csv` |
| `qing-emperor-source-index.proposal.csv` | `data/qing-emperor-source-index.csv` |
| `emperor-timeline.proposal.csv` | `data/emperor-timeline.csv` |
| `shared-file-corrections.md` | 既有错行的文字更正（仍不直接改） |
| `people-candidates.md` | 人物候选，无新 ID |

## 人物网络（本轮）

新增 `13-people-network.md` 与对应 `people-candidates.md`（或 `phase0-people.csv` 续行）。章节／主张／金题已追加到本目录 CSV。不要直接粘进 `data/`。
