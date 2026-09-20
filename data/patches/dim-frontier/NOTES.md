# 军事制度 / 边疆 / 外交补丁（dim-frontier）

代理 B。2026-09-12。未改工作区总表，未提交 git。

## 做了什么

加厚既有边疆章的善后/制度段（**未挂** `QH-A-FW-*`，以免总表未并入时 `validate` 报未知主张）：

- `content/emperors/kangxi/07-taiwan.md`：范围扩到卷260善后与卷7设府；时间轴补 1684 四月己酉设府；要点5写弃留/设府。声明列传是史稿转述、不是原疏标题页；本纪无三县名。链到 `kangxi-15`。
- `content/emperors/kangxi/10-yakesa-nerchinsk.md`：加「制度层：设将军」——二十二年黑龙江将军、二十四年六月永驻官兵会议、九月墨尔根城屯田。恰克图十一款标为雍正五年另约，链到 `qianlong-07`。
- `content/emperors/kangxi/11-galdan.md`：范围含编旗三句；时间轴按年序补 1689/1691/1692；要点5写编旗。本纪用「多罗诺尔」，通行「多伦诺尔」只作对照，不改本纪用字。链到 `qianlong-07`。

新开两章（正文已挂 `{{claim:QH-A-FW-*}}`）：

- `content/emperors/kangxi/15-banners-and-green-standard.md`（`QH-CH-KX-15` / `kangxi-15`）：八旗始制、驻防四类、绿营开端、黑龙江将军、台湾设府。不用 14 号（14 留给 dim-admin 赋役章）。
- `content/emperors/qianlong/07-lifanyuan-frontier.md`（`QH-CH-QL-07` / `qianlong-07`）：理藩院职掌与更名、朝贡只落到王会/徕远两句、盟旗、驻藏两说、伊犁将军与参赞、恰克图互市与复市。

未改 `yongzheng-02`、`qianlong-01`、同治/光绪章、亲属表。未做年羹尧档案、军机处始设、财政赋役、皇子关系。

## 条数

- 来源单元 15 条：`QH-SU-FW-0001`–`0015`
- 主张 31 条：`QH-A-FW-0001`–`0031`
- 新章节 2 条：`QH-CH-KX-15`（sort **57**，避开 dim-admin 的 `kangxi-14` sort 56）、`QH-CH-QL-07`（sort 62，接在 `qianlong-06` 的 61 后）
- 新来源 1 条：`SRC-071`（会典**目录层**，不拆主张；避开紫光阁已占的 `SRC-067`–`070`）

复用既有单元：`QH-SU-KX-QSG-0260`（卷260 施琅传善后，挂 `QH-A-FW-0010`、`0011`）。

`reign` 用 `dynasties.csv` 的 era slug：太祖条 `tianming`，崇德三年更名 `tiancong`（库内无独立 `chongde`），不用 `nurhaci` / `huangtaiji`。

## 复用已有 SRC

| SRC | 材料 | 新单元 / 主张 |
|---|---|---|
| SRC-025 | 清史稿卷7、12、115、117、130、131、153、260 | FW-0001–0015；主张 0001–0031（0010/0011 挂既有 0260） |

打开方式：维基文库 `https://zh.wikisource.org/wiki/清史稿/卷N`。未新开实录日条，不编造 ctext/sillok 卷页。

正文公历写「依陈垣《二十史朔闰表》，尚未逐条核录」。主张备注写「依 CAL-001，尚未逐条核录」或「公历月日待按 CAL-001 核录」。

## 新来源 SRC-071

维基文库《钦定大清会典》。本批只核目录：卷七十九理藩院、卷九十五至九十七八旗都统与兵制。**正文标注未完，不拆主张**，不得用目录冒充已开正文。

## 审核中

| ID | 为何审核中 |
|---|---|
| `QH-A-FW-0007` | 兵志「综天下制兵都六十六万人」：后出汇总数，本库不取总数 |
| `QH-A-FW-0008` | 兵志「用旗、绿兵至四十万」：后出汇总，不作兵力统计 |

其余有逐字短引 + 卷定位的标「已采纳」（文本层）。《清史稿》一律后出，不作终审。未建冲突组。

两说并存、不择一：

- 驻藏：职官志雍正五年置（`0025`）vs 兵志乾隆十五年除王爵设驻藏大臣（`0026`）
- 伊犁将军：职官志二十七年置（`0022`）vs 本纪十月乙巳以明瑞为之（`0023`）；参赞是十一月庚申另条（`0024`）
- 喀尔喀：本纪三十一年三路（`0015`）vs 职官志外扎萨克四部八十六旗（`0020`，三音诺颜部分出在雍正十年）

## 主张一览

| 段 | ID | 内容 |
|---|---|---|
| 八旗绿营 | 0001–0008 | 四旗/牛录、驻防四类、黑龙江将军（志+本纪）、绿营始建；0007/0008 审核中 |
| 台湾善后 | 0009–0011 | 本纪设府；施琅传「断不可弃」；县三府一巡道一 |
| 雅克萨驻防 | 0012 | 二十四年六月永驻官兵会议 |
| 喀尔喀编旗 | 0013–0015 | 两翼扎萨克、多罗诺尔编旗、三路 |
| 理藩院/朝贡 | 0016–0021 | 尚书职掌、崇德三年更名、旗籍、王会、典属、徕远 |
| 伊犁 | 0022–0024 | 将军设年、明瑞、参赞 |
| 驻藏 | 0025–0027 | 雍正五年 / 乾隆十五年两说；五十七年西藏旗兵始 |
| 恰克图 | 0028–0029 | 雍正五年十一款；乾隆三十三年复市、库伦办事大臣 |
| 盟旗/将军职掌 | 0030–0031 | 乾隆元年六会盟长；驻防将军职掌句 |

## 改了哪些文件

可改正文：

- `content/emperors/kangxi/07-taiwan.md`
- `content/emperors/kangxi/10-yakesa-nerchinsk.md`
- `content/emperors/kangxi/11-galdan.md`
- `content/emperors/kangxi/15-banners-and-green-standard.md`（新建）
- `content/emperors/qianlong/07-lifanyuan-frontier.md`（新建）

补丁：

- `data/patches/dim-frontier/source-units.csv`
- `data/patches/dim-frontier/source-claims.csv`
- `data/patches/dim-frontier/chapters.csv`
- `data/patches/dim-frontier/source-rights-ledger.csv`
- `data/patches/dim-frontier/NOTES.md`

## 合并时请手工做的事

1. 把四份补丁数据行追加进总表（保留表头各一份）。先并入，再跑 `npm run validate`。
2. 并入后如要在既有 07/10/11 挂主张，再补 `{{claim:}}`：
   - 07：`QH-A-FW-0009`、`0010`、`0011`
   - 10：`QH-A-FW-0005`、`0012`
   - 11：`QH-A-FW-0013`、`0014`、`0015`
3. 既有章 `related` 可互加 `#/chapter/kangxi-15`、`#/chapter/qianlong-07`。`QH-CH-KX-07` / `10` / `11` 的 `unit_ids` 总表未改。
4. 未合并前，工作区直接 `validate` **看不到**新章（不在主 `chapters.csv`）。07/10/11 故意不挂新 ID。

## 未做

军费岁额、驿传则例、海防专志、会典理藩院/八旗正文、金瓶掣签、钦定藏内善后章程、光绪新疆建省、朝贡通论教材、条约汉满文本、CAL-001 具书核录、档案穿透、冲突组、git 提交、修改任何共享总表。
