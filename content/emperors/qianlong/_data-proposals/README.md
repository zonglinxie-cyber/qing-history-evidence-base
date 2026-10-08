# 乾隆目录提案（未写入共享 `data/`）

本目录只给合并用的候选行。**不要**直接改 `data/source-claims.csv`、`data/chapters.csv` 等共享表。引文均来自已打开的维基文库《清史稿》卷11、12、14、15、16、86、104、154、166、319，或《喇嘛说》《日知荟说》已开短引，或本库已登录图像，不新造出处。

| 文件 | 对应共享表 | 说明 |
| --- | --- | --- |
| `chapters.proposal.csv` | `data/chapters.csv` | 07–17。07/08 只登记并行章，不新造 FW/CU 主张 |
| `source-units.proposal.csv` | `data/source-units.csv` | 本职 09–17 单元 |
| `source-claims.proposal.csv` | `data/source-claims.csv` | 45 条，`QH-A-QL-0109` 起；空号见 NOTES |
| `source-units.csv` / `source-claims.csv` | 同上 | 并行裕陵谒陵条：`QH-SU-QL-QSG-0086A`、`QH-A-QL-0100` |
| `qianlong-princesses.csv` | `data/phase0-people.csv` 一类 | 11 行，`CAND-QL-*` |
| `imperial-works.csv` | `data/imperial-works.csv` | `QH-W-090`–`093` |
| `emperor-portraits-errata.md` | `data/emperor-portraits.csv` | 南巡图 / 大阅图 / E06M 不新造 |
| `historic-sites-errata.md` | `data/historic-sites.csv` | 裕陵今貌 ≠ 四年九月葬条 |
| `conflict-sets-notes.md` | `data/conflict-sets.csv` | 只写 docs/23 须查什么 |
| `NOTES.md` | — | 校正与缺口 |
| `_write_ziguangge.py` | 会写共享 `data/` | 并行紫光阁稿，**未执行** |

共享表已登记 01–06（sort 60/61/65–68）。新章 sort：07=62，08=63，09=64，10=69，11=71，12=72，13=73，14=74，15=77，16=79，17=80。避开嘉庆 70/75/76/78。

主张一律「审核中」。公历写「换算依陈垣《二十史朔闰表》，尚未逐条核录。」清史稿 `source_entity_id` = `SRC-025`。《喇嘛说》《日知荟说》标「待登记」，不编造 SRC。

**合并择一：** `0090`/`0091` 空出，十全记用已有 `QH-A-CU-0001`/`0002`。`QH-A-QL-0094` 与 `QH-A-JQ-0009` 并存。`QH-W-090` 起入库前再核最大 `QH-W-*`（康熙提案已用 080/081）。

## 人物网络（本轮）

新增 `19-people-network.md` 与对应 `people-candidates.md`（或 `phase0-people.csv` 续行）。章节／主张／金题已追加到本目录 CSV。不要直接粘进 `data/`。
