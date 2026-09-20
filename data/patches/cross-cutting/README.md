# 横切数据提案（未进权威层）

本目录是 2026-09-12 总目／遗漏项代理的 **CSV 提案**。  
**不是** `data/` 权威表，**未**登记 `data-manifest.csv`，构建与校验都不会读这里。

生成：`python3 data/patches/cross-cutting/_generate.py`（只读现有 `data/*.csv`，不写回本体）。

| 文件 | 对应现表／新表 | 可否直接合并 |
|---|---|---|
| `title-reign-catalog.csv` | 建议新表 | 否。须先加 manifest `kind` 与校验 |
| `imperial-family-index.csv` | 建议新表 | 否。无 `person_id` 的行不能当外键 |
| `tomb-ritual-index.csv` | 建议新表 | 否。缺行无坐标 |
| `palace-object-index.csv` | 建议新表 | 否。只归类已有 6 件 |
| `visual-rights-index.csv` | 派生索引 | 建议构建期生成，不入库 |
| `document-type-vocab.csv` | `controlled-vocabularies.csv` 增补 | 可讨论合并；须改词表校验 |
| `shilu-juan-index.csv` | 从 `imperial-works` 抽出 | 不必入库 |
| `manchu-source-index.csv` | 建议新表 | 否。只挂已有 work／source |
| `palace-tour-index.csv` | 建议新表 | 否。缺行无图无坐标 |
| `late-qing-photo-index.csv` | 派生 | 人物像缺权利颜色，先补列 |
| `golden-questions-gap.csv` | `golden-questions.csv` | 表头一致，可审后追加 |
| `side-lanes-gap.csv` | `side-lanes.csv` | 表头一致，可审后追加 |
| `source-families-gap.csv` | `source-families.csv` | 表头一致，可审后追加 |
| `overviews-gap.csv` | `overviews.csv` | 表头一致；进站点才需要 |
| `historic-sites-consistency-patch.csv` | `historic-sites.csv` 三行补丁 | 表头一致；只改人物接线与「不在人物档」文案 |
| `phase0-people-type-patch.csv` | `phase0-people.csv` | 只建议改弘历人物类型，不改 ID |

说明见 `docs/27-遗漏项与横切补全.md`。
