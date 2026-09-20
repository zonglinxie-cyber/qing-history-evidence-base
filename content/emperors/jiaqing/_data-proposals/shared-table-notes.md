# 共享表补挂说明（本轮不改 `data/`）

## historic-sites.csv

| site_id | 建议 |
|---|---|
| QH-ST-0005 热河行宫 | `相关皇帝ID` 加 `QH-E-07`；`相关人物ID` 加 `QH-P-000054`；待核问题补「嘉庆二十五年崩条只写行宫，不得径改烟波致爽」 |
| QH-ST-0036 九州清晏 | 同上加嘉庆；说明八年还驻圆明园未写殿名 |
| QH-ST-0004 圆明园被焚掠 | 可加嘉庆为「此期园居」交叉，但卡片钩子须继续钉在咸丰十年焚掠，避免错层 |
| QH-ST-0042 军机处值房 | 已含嘉庆；箭头升格须回宫史，见 jiaqing-13 |

## imperial-works.csv

建议新增一行（work_id 待主库分配）：

- 文献名称：钦定平定教匪纪略
- 文献类型：方略／敕编
- 皇帝：QH-E-07
- 证据状态：S二手索引
- dedicated_chapter：jiaqing-08
- open_state：L0
- 备注：本轮未开卷，只登记书名

已有 QH-W-035–038、QH-W-059 不必改卷数；`dedicated_chapter` 可补 `jiaqing-12`。

## emperor-portraits.csv

QH-V-E07 / E07B / E07C 已在库。待核仍是：E07 绘制年份与寿皇殿原件页；E07B 档号、具奏人、二十五年十二月批者；E07C 故宫对象页。不新增图像行。

## data-manifest.csv

若建 `jiaqing-princes.csv` 等三表，按雍正三表例加 `reign=jiaqing` 行。本轮只提案，不建 `data/` 文件。
