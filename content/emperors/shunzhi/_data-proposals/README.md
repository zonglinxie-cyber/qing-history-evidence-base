# 顺治朝数据提案

本目录是隔离提案，**不得直接并入** `data/`。入库前须：对照表头、分配与十二帝共享表不冲突的正式 ID、跑 `npm run validate`。

正文已引用的既有主张仍是 `QH-A-SZ-0001`–`0043` 与 `QH-A-KX-0156`。新主张、新来源单元、新冲突组、三张深挖表、新章节目录行，都只写在这里。

| 文件 | 对应共享表 | 说明 |
|---|---|---|
| `chapters.csv` | `data/chapters.csv` | 新增 04–10；01–03 的 `unit_ids` 增补建议 |
| `source-units.csv` | `data/source-units.csv` | 本轮新打开的卷4/5/163/166/214/218 与四库总目、孟森短引 |
| `source-claims.csv` | `data/source-claims.csv` | 新主张，状态一律「审核中」，待自审 |
| `conflict-sets.csv` | `data/conflict-sets.csv` | 出家、遗诏、董鄂／董小宛、常宁／常颖、牛钮／钮钮 |
| `shunzhi-empress-timeline.csv` | 尚无顺治后妃轴 | 列结构抄 `kangxi-empress-timeline.csv` |
| `shunzhi-princes.csv` | 尚无顺治皇子表 | 列结构抄 `kangxi-princes.csv` |
| `shunzhi-princesses.csv` | 尚无顺治皇女表 | 列结构抄 `kangxi-princesses.csv` |
| `qing-emperor-source-index.csv` | `data/qing-emperor-source-index.csv` | 新入口 |
| `imperial-works.csv` | `data/imperial-works.csv` | 《劝善要言》《人臣儆心录》开卷状态修正建议 |
| `golden-questions.csv` | `data/golden-questions.csv` | 新黄金问题 |
| `task-queue.csv` | `data/task-queue.csv` | 下一轮实录／起居注任务 |
| `phase0-people.csv` | `data/phase0-people.csv` | 候选人物，ID 为 `QH-P-SZ-PROP-*`，入库时重号 |
| `source-rights-ledger.csv` | `data/source-rights-ledger.csv` | 孟森《董小宛考》维基文库页 |

`QH-P-SZ-PROP-*`、`QH-SU-SZ-PROP-*`、`QH-A-SZ-PROP-*`、`QH-TE-SZ-PROP-*`、`QH-GQ-SZ-PROP-*`、`TQ-SZ-PROP-*`、`IDX-SZ-PROP-*`、`SRC-SZ-PROP-*` 都是提案号，不是已发布主键。新章 04–10 未入共享 `chapters.csv`，正文不用提案主张的 `{{claim:}}` / `{{conflict:}}`。

逃人两处本纪干支本轮已按卷5回改：设督捕官在十年十二月癸未，宽隐匿逃人律在十四年二月己亥。不得再写十一年十二月、十年二月。

## 人物网络（本轮）

新增 `11-people-network.md` 与对应 `people-candidates.md`（或 `phase0-people.csv` 续行）。章节／主张／金题已追加到本目录 CSV。不要直接粘进 `data/`。
