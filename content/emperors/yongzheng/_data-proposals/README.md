# 雍正目录数据提案

状态：未入库。禁止直接改 `data/` 共享表。主库合并时须先确认主张号不与 `QH-A-YZ-0464` 起撞号。

本目录只服务 `content/emperors/yongzheng/**`。年羹尧档案入口 `IDX-099`–`IDX-105` / `SRC-060`–`SRC-066` 已在共享表，这里不重提新行，章节只引用。

## 文件

| 文件 | 对应共享表 |
| --- | --- |
| `chapters.proposal.csv` | `data/chapters.csv` |
| `source-units.proposal.csv` | `data/source-units.csv` |
| `source-claims.proposal.csv` | `data/source-claims.csv` |
| `NOTES.md` | 校正与缺口，不是表行 |

新章 `收录` 一律 `否`，待总表合并后再改。

## 号段

- 来源单元：`QH-SU-YZ-QSG-0009S`–`0009Z`、`QH-SU-YZ-QSG-0288A`、`QH-SU-YZ-ZPYZ-0126A` / `0126B`
- 主张：`QH-A-YZ-0464`–`0466`、`0468`–`0478`、`0479`–`0483`、`0487`
- 空号 `0467`、`0484`–`0486` 未用，留给主库，避免和并行补丁抢号

## 人物网络（本轮）

新增 `16-people-network.md` 与对应 `people-candidates.md`（或 `phase0-people.csv` 续行）。章节／主张／金题已追加到本目录 CSV。不要直接粘进 `data/`。
