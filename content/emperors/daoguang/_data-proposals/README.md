# 道光卷数据提案

只提案，不改 `data/` 共享文件。导入前须：

1. 核对主键不与并行帝卷提案碰撞。本卷回避宣统卷已声明的 `SRC-067+`、`IDX-106+`、`QH-P-000187+`，改用 `SRC-162+`、`IDX-165+`、人物「待分配」。
2. 主张状态一律 `审核中`，待 `npm run self-review`。
3. 新章节挂进 `chapters.csv` 后，正文现有已采纳 `{{claim:QH-A-DG-0001}}` 等可继续用；新 ID 须先入库再在正文加 `{{claim:}}`。
4. `{{conflict:}}` 同样须先入库。正文目前只写冲突组代号，未使用该语法。

| 文件 | 对应共享表 |
|---|---|
| `source-rights-ledger.csv` | `data/source-rights-ledger.csv` |
| `source-units.csv` | `data/source-units.csv` |
| `source-claims.csv` | `data/source-claims.csv` |
| `chapters.csv` | `data/chapters.csv` |
| `conflict-sets.csv` | `data/conflict-sets.csv` |
| `imperial-works.csv` | `data/imperial-works.csv` |
| `historic-sites.csv` | `data/historic-sites.csv` |
| `qing-emperor-source-index.csv` | `data/qing-emperor-source-index.csv` |
| `emperor-timeline.csv` | `data/emperor-timeline.csv` |
| `daoguang-empress-timeline.csv` | 新表，列模板同 `data/yongzheng-empress-timeline.csv` |
| `daoguang-princes.csv` | 新表，列模板同 `data/yongzheng-princes.csv` |
| `daoguang-princesses.csv` | 新表，列模板同 `data/kangxi-princesses.csv` |
| `golden-questions.csv` | `data/golden-questions.csv` |
| `task-queue.csv` | `data/task-queue.csv` |
| `side-lanes.csv` | `data/side-lanes.csv` |
| `shared-file-corrections.md` | 既有错行的文字更正（仍不直接改） |
| `people-candidates.md` | 人物候选，无新共享 ID |

## 人物网络（本轮）

新增 `08-people-network.md` 与对应 `people-candidates.md`（或 `phase0-people.csv` 续行）。章节／主张／金题已追加到本目录 CSV。不要直接粘进 `data/`。
