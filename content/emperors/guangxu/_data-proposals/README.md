# 光绪卷数据提案

只提案，不改 `data/` 共享文件。导入前须：

1. 核对主键不与并行帝卷碰撞。本卷避开宣统已占 `SRC-067`–`073`、`IDX-106`–`114`、`QH-W-082`/`083`、`QH-ST-0049`/`0050`，以及康熙已占 `QH-W-080`/`081`。人物不擅用 `QH-P-000187+`，见 `people-candidates.md`。
2. 主张状态一律 `审核中`，待 `npm run self-review`。正文现有 `{{claim:QH-A-GX-0001}}` 等已入库 ID 可继续用；`QH-A-GX-0051+` 须先入库再在正文加 `{{claim:}}`。
3. 新章节挂进 `chapters.csv` 后才会进站点；目录里多出来的 md 在合并前不上线。
4. 对照栏 `QH-L-0049` 须再核 `data/patches/cross-cutting/side-lanes-gap.csv`（已用到 `QH-L-0046`–`0048`）。

| 文件 | 对应共享表 |
|---|---|
| `chapters.proposal.csv` | `data/chapters.csv` |
| `source-units.proposal.csv` | `data/source-units.csv` |
| `source-claims.proposal.csv` | `data/source-claims.csv` |
| `conflict-sets.proposal.csv` | `data/conflict-sets.csv` |
| `imperial-works.proposal.csv` | `data/imperial-works.csv` |
| `historic-sites.proposal.csv` | `data/historic-sites.csv` |
| `source-rights-ledger.proposal.csv` | `data/source-rights-ledger.csv` |
| `qing-emperor-source-index.proposal.csv` | `data/qing-emperor-source-index.csv` |
| `side-lanes.proposal.csv` | `data/side-lanes.csv` |
| `people-candidates.md` | `data/phase0-people.csv`（无新 ID） |
| `emperor-portraits-errata.md` | `data/emperor-portraits.csv`（勘误，不新造图号） |
| `shared-file-corrections.md` | 既有行的文字更正（仍不直接改） |

合并顺序建议：台账 → 文献 → 来源单元 → 主张 → 冲突组 → 章节 → 遗址 / 索引 / 对照栏。

引文均来自 2026-09-12 已打开的维基文库《清史稿》卷23、卷24、卷214，或库内已登录图像区域。不新造出处。

## 人物网络（本轮）

新增 `10-people-network.md` 与对应 `people-candidates.md`（或 `phase0-people.csv` 续行）。章节／主张／金题已追加到本目录 CSV。不要直接粘进 `data/`。
