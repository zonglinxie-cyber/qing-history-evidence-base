# 康熙目录提案（未写入共享 `data/`）

本目录只给合并用的候选行。**不要**直接改 `data/source-claims.csv`、`data/chapters.csv` 等共享表——那是隔离规则。引文均来自已打开的维基文库《清史稿》卷6–8、卷214，或本库已登录的图像区域，不新造出处。

| 文件 | 对应共享表 | 行数 |
|---|---|---|
| `chapters.csv` | `data/chapters.csv` | 3（kangxi-16/17/18；14 赋役、15 八旗已占用） |
| `source-units.csv` | `data/source-units.csv` | 9 |
| `source-claims.csv` | `data/source-claims.csv` | 12 |
| `image-regions.csv` | `data/image-regions.csv` | 解绑 3 + 绑杨琳 3；新框不造假坐标 |
| `emperor-portraits-errata.md` | `data/emperor-portraits.csv` | `QH-V-E04I` 馆藏勘误 |
| `imperial-works.csv` | `data/imperial-works.csv` | 《明史》《清文鉴》入口 |
| `conflict-sets-notes.md` | `data/conflict-sets.csv` | 康熙待补 5 组：只写须查什么 |

主张 ID 从 `QH-A-KX-0187` 起，避开现库最大号 `QH-A-KX-0186`。合并前须再跑主键检查。

**与并行提案的重复：** `QH-A-KX-0194`（摺奏自此始）、`QH-A-KX-0195`（滋生丁银）与 `data/patches/dim-admin` 的 `QH-A-AD-0004` / `QH-A-AD-0001` 同条。合并时择一或互链，不要双主键。`QH-W-080`《明史》、`QH-W-081`《清文鉴》入库前再核最大 `QH-W-*`。`QH-SU-KX-YL-0001` 的 `source_entity_id` 暂用 `SRC-025` 占位不合适——杨琳折是图像层，合并时应改绑已有画像/Commons 来源号，不要新造未登记 SRC。

## 人物网络（本轮）

新增 `19-people-network.md` 与对应 `people-candidates.md`（或 `phase0-people.csv` 续行）。章节／主张／金题已追加到本目录 CSV。不要直接粘进 `data/`。
