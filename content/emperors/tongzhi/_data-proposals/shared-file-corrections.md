# 同治卷：共享表既有行的文字更正（未改 `data/`）

入库时由主库决定是否改。本文件只列建议。

## `data/chapters.csv`（01–03）

待 `tongzhi-04`–`08` 先登记后，再把 `related` 补上新 slug。不要先写 `#/chapter/tongzhi-04`，结构校验会因缺 slug 失败。

| slug | 建议追加 related（登记后） |
| --- | --- |
| tongzhi-01 | `#/chapter/tongzhi-04`；`#/chapter/tongzhi-06` |
| tongzhi-02 | `#/chapter/tongzhi-05`；`#/chapter/tongzhi-08` |
| tongzhi-03 | `#/chapter/tongzhi-04`；`#/chapter/tongzhi-05`；`#/chapter/tongzhi-06` |

## `data/side-lanes.csv` · `QH-L-0025`

`冲突组 ID` 现空。提案组 `QH-CF-TZ-DEATH` 入库后可填入。官书栏仍须写清：本纪不写病名；脉案是公布刊物转述；实录日页未钉。

## `data/golden-questions.csv` · `QH-GQ-0072`

现答案写「正史含糊。吞金、绝食、被逼均无原始文件」。卷214已开：绝粒是道路传闻，太后斥无据。主张 `QH-A-TZ-0044`/`0045` 入库后，本题可改为返回答案，或与 `QH-GQ-TZ-05` 择一。

## `data/patches/cross-cutting/golden-questions-gap.csv` · `QH-GQ-0089`

惠陵提案 `QH-ST-0049` 入库后，本题「无惠陵独立行」须改写。坐标与始葬名单仍待核，拒答可以保留，但应改指向 `#/site/QH-ST-0049`。

## `data/emperor-timeline.csv` · `TL-TZ-006`

崩条可挂已入库 `QH-A-TZ-0013`。死因对照见 `QH-L-0025`，待冲突组入库后再互链。

## `data/qing-emperors.csv` · `QH-E-10`

「官方记天花，梅毒说待核」可改为「本纪不写病名；脉案层记天花；梅毒说晚出不升格」。不在本目录改该表。
