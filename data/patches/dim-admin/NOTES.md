# 制度/财政维度补丁（dim-admin）

代理 A。2026-09-12。未改工作区总表，未提交 git。

## 做了什么

加厚 `content/emperors/yongzheng/02-yongzheng-reforms.md`：摊丁入亩（本纪山西 / 食货志直隶两说并列）、耗羡「归公」三层用词、养廉银后出总数、奏折日常（封达、亲批、不假手、与阁臣撰拟分途、灯下批折、缴回与选刻）。不写军机处始设。

新开 `content/emperors/kangxi/14-fuyi-tandingenmu.md`（`QH-CH-KX-14` / `kangxi-14`）：一条鞭定义、三联串票、永不加赋本纪短诏与食货志长句并列。未开 `yongzheng/09-huohao-yanglian.md`。未改 `kangxi/12-yellow-river.md`。

## 条数

- 来源单元 17 条：`QH-SU-AD-0001`–`0017`
- 主张 24 条：`QH-A-AD-0001`–`0024`
- 新章节 1 条：`QH-CH-KX-14`
- 无新来源，未写 `source-rights-ledger.csv`

主张均有逐字短引 + 卷页/维基文库定位 + 无冲突组，补丁里标「已采纳」。合并后若跑 `npm run self-review`，以脚本为准。

## 复用已有 SRC

| SRC | 材料 | 新单元 |
|---|---|---|
| SRC-025 | 清史稿卷8、卷9、卷121 | AD-0001–0009 |
| SRC-054 | 世宗圣训卷15、卷23 | AD-0010–0014 |
| SRC-033 | 硃批諭㫖卷首御笔 | AD-0015–0017 |

正文继续引用原章已有主张：`QH-A-YZ-0066`–`0069`、`0093`–`0097`、`0165`。未新开实录（SRC-027 / SRC-031）日条：摊丁、火耗、永不加赋的实录页尚未钉到 ctext chapter / sillok 条次，不编造。

未用《皇朝文献通考》《古今图书集成》《万寿盛典》：台账无对应 SRC，不新开红色/不明来源。

## 审核中 / 未做成已核的事

补丁主张本身不挂「审核中」。下列只在正文边界和编辑备注里标明，未假装已核：

- 实录日级原文（永不加赋、山西/直隶摊丁、耗羡各谕）
- 《清会典》、赋役全书、养廉分省分额
- 朱批原件（台北故宫）
- 密折起止、军机处始设（不在本任务）
- 公历日级：一律「依 CAL-001，尚未逐条核录」；正文对人写陈垣《二十史朔闰表》。四年、七年十二月标了或跨公历年

异说并列、未建冲突组（任务禁止学术史冲突组）：

- 摊丁起点：本纪元年山西 vs 食货志直隶李维钧
- 「归公」：食货志提解火耗归公 vs 圣训/本纪拒收入公帑
- 诺敏（食货志）vs 诺岷（圣训）
- 本纪「摺奏自此始」vs 既有康熙朝朱批层

## 改了哪些文件

可改正文：

- `content/emperors/yongzheng/02-yongzheng-reforms.md`（加厚；标题改为「摊丁、耗羡归公与奏折日常」）
- `content/emperors/kangxi/14-fuyi-tandingenmu.md`（新建）

补丁：

- `data/patches/dim-admin/source-units.csv`
- `data/patches/dim-admin/source-claims.csv`
- `data/patches/dim-admin/chapters.csv`
- `data/patches/dim-admin/NOTES.md`

## 合并时请手工做的事

1. 把三份补丁数据行追加进总表（保留表头各一份）。
2. `QH-CH-YZ-02` 的 `title` / `lede` / `unit_ids` 总表未改。合并后建议：
   - title：摊丁、耗羡归公与奏折日常
   - lede：补摊丁两说与奏折日常
   - unit_ids 追加：`QH-SU-AD-0006` 至 `0017`（以及若要把康熙对照挂上，`0001`–`0005` 可只留在 KX-14）
3. `related` 可互加 `#/chapter/kangxi-14` 与 `#/chapter/yongzheng-02`。

## ID 形态

任务要求 `QH-SU-AD-0001`、`QH-A-AD-0001`、`QH-CH-KX-14`。现有 `validate-data.mjs` 只查主键唯一、朝次枚举、外键，未见中缀白名单。

临时目录合并三份补丁后跑 `npm run validate`：本补丁的 AD / KX-14 ID 未被拒绝。当时副本另有 13 条 `QH-CH-NH-01` 未知主张（`QH-A-NH-*`），属于其他未合并补丁，与本包无关。未合并前，工作区直接 `validate` 会因 `yongzheng-02` 引用尚未入总表的 `QH-A-AD-*` 报未知主张，属预期。

若日后总表规则改成必须带朝次中缀，应改成（仍只用 AD 段号，不改总表现有行）：

- `QH-SU-KX-AD-0001` / `QH-SU-YZ-AD-0006` / `QH-SU-SZ-AD-0003`
- `QH-A-KX-AD-0001` / `QH-A-YZ-AD-0005` / `QH-A-SZ-AD-0003`

`reign` 已按史实填 `kangxi` / `yongzheng` / `shunzhi`。`QH-A-AD-0003` 主体是 `QH-P-000053`（顺治）。

## 未做

CAL-001 具书核录、档案穿透、冲突组、皇子皇女、UI、双主轴栏目、git 提交、修改任何共享总表。
