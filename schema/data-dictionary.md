# Phase 0 数据字典

## 1. 总体原则

PostgreSQL 是唯一权威写库；TEI、IIIF Manifest、全文索引、向量索引和图数据库均为可重建发布物或读模型。

基本约定：

- 内部主键统一使用 UUID；
- 对外 ID 永久、不可变，例如 `QH-P-000001`、`QH-A-000001`；
- 原文、繁简、异体和转写不在写入时互相覆盖；
- 历史上可能争议的内容以断言表达，不作为人物表中的静态“事实列”；
- 业务对象不硬删除；合并、废止和纠错保留审计链；
- 已发布断言和文本层不得原地改写，修订时创建新版本；
- 机器加工结果与人工审核状态完全分离。

逻辑 schema：

```text
core       实体、异名、词表、时间
history    人物、称号、事件
source     作品、版本、档案、文本层和片段
claim      断言、证据、反证、冲突和审核
media      视觉作品、实物、数字资产、图像区域和版权
ops        人员、加工运行、审计与变更集
```

## 2. 核心表总览

| 表 | 作用 | 关键约束 |
|---|---|---|
| `core.entity` | 所有可被引用对象的统一标识 | 公共 ID 唯一；合并可撤销 |
| `core.entity_name` | 本名、异名、庙号、谥号、转写等 | 名称类型、语言、文字系统、有效期分开 |
| `core.concept_scheme` / `core.concept` | 受控词表 | 词表版本化；业务类型不用频繁改 ENUM |
| `core.time_expression` | 原始纪年和规范化范围 | 原文、公历边界、精度、确定性和算法并存 |
| `history.person` | 人物的低争议骨架 | 父母、生卒等不直接写入此表 |
| `history.title` | 后妃位号、爵位、尊号、职官实体 | 任命和有效期由断言表达 |
| `history.event` | 事件身份 | 时间、地点、参与者均由断言表达 |
| `source.text_work` | 抽象作品，如《清史稿》 | 与具体版本分离；`source_rank` 按 docs/03 §2 定级 |
| `source.text_version` | 刻本、点校本、数字本 | 保存底本与衍生关系，避免伪独立来源 |
| `source.archive_unit` | 全宗—系列—卷—册—件—页 | 馆藏机构＋档号唯一；`source_rank` 默认 A1 |
| `source.text_layer` | OCR、忠实录文、标点、规范化、译释 | 每层独立版本和哈希 |
| `source.text_segment` | 卷、条、页、栏、行、段 | 精确定位和图像区域对齐 |
| `claim.assertion` | 断言身份、状态、版本 | 命题哈希去重；发布后不可原改 |
| `claim.person_relationship` | 生物、礼法、收养、婚姻关系 | 关系类型、时间和排行口径明确 |
| `claim.title_assignment` | 册封、晋封、降位、复爵、追封 | 起止时间和依据不可省略 |
| `claim.event_occurrence` | 事件发生时间和地点 | 本身可争议 |
| `claim.event_participation` | 人物以当时角色参与事件 | 不只存模糊“相关人物” |
| `claim.literal_statement` | 日期、数字、文字属性 | JSON 值按类型验证 |
| `claim.depiction` | 图像表现某人的认定 | 旧定名、可能、否定等状态分开 |
| `claim.evidence_item` | 具体版本/档案件中的证据 | 必须有文本、图像区域或结构化定位 |
| `claim.assertion_evidence` | 支持、反证、背景、仅提及 | “出现名字”不等于支持主张 |
| `claim.conflict_set` | 互斥主张集合 | 可保持未解决，不强选真相 |
| `media.visual_work` | 视觉内容 | 与物理载体、数字照片分离 |
| `media.physical_object` | 绢本、册页、器物等实物 | 馆藏登录号唯一 |
| `media.digital_asset` | 扫描、照片、TEI、OCR、IIIF | 内容哈希唯一，禁止覆盖旧文件 |
| `media.image_region` | 人脸、题跋、印章、文字区域 | IIIF/Web Annotation selector |
| `media.rights_statement` | 许可和允许用途 | 核验人、日期和来源 URL 强制 |
| `media.rights_assignment` | 权利作用范围 | 原作、摄影、录文、译文分别登记 |
| `claim.review_decision` | 人工审核决定 | 审核版本必须与当前行版本一致 |
| `ops.ingest_run` | OCR/NER/LLM 等机器加工 | 模型、版本、参数和输入输出哈希齐全 |
| `ops.audit_log` | 不可变审计日志 | 应用账号无更新/删除权限 |

## 3. 实体与名称

### `core.entity`

实体类型包括：

```text
person, group, organization, place, event,
title, office, reign_era, concept,
text_work, text_version, archive_unit,
visual_work, physical_object, digital_asset
```

`canonical_label` 是当前界面标签，不等于历史本名。实体合并时设置 `record_status=merged` 和 `merged_into_id`，禁止循环合并。

### `core.entity_name`

首批名称类型：

```text
birth_name        本名
childhood_name    幼名
taboo_form        避讳前写法
post_taboo_form   避讳后写法
temple_name       庙号
posthumous_name   谥号
honorific         尊号
title_name        爵号/位号式称呼
common_name       现代通称
manchu_name       满文名
transliteration   转写
variant_graph     异体字
```

名称若本身存在史学争议，应以 `historical_assertion_id` 连接证据。

## 4. 时间

`core.time_expression` 同时保存：

```json
{
  "original_text": "康熙六十一年十一月十三日",
  "calendar_code": "chinese-lunisolar-qing",
  "reign_era": "康熙",
  "reign_year": 61,
  "month_no": 11,
  "is_leap_month": false,
  "day_no": 13,
  "edtf_value": "1722-12-20",
  "gregorian_lower": "1722-12-20",
  "gregorian_upper": "1722-12-20",
  "precision_code": "day",
  "certainty_code": "exact",
  "conversion_method": "qing-calendar-converter",
  "conversion_version": "1.0.0"
}
```

精度：`day/month/year/reign/decade/interval/unknown`。  
确定性：`exact/approximate/uncertain/approximate_uncertain/inferred/unknown`。

EDTF 只用于交换；它不能替代清代年号、闰月和原始汉字日期。

## 5. 人物关系

不得只设一个模糊的“父母”或“亲属”关系。首批至少包含：

```text
has_biological_father / biological_father_of
has_biological_mother / biological_mother_of
has_legal_father / legal_father_of
has_legal_mother / legal_mother_of
has_ritual_mother / ritual_mother_of
has_adoptive_parent / adoptive_parent_of
has_foster_parent / foster_parent_of
spouse_of
betrothed_to
member_of_lineage
```

逆关系由查询视图生成，不重复保存一条反向断言。

排行口径必须单独记录：

```text
birth_order
surviving_child_order
male_child_order
source_stated_order
editor_inferred_order
```

## 6. 文献与文本层

层级：

```text
抽象作品
└── 具体版本/档案件
    └── 文本层
        └── 卷/篇/条/页/栏/行/段
            ├── 原始影像区域
            ├── 忠实录文
            ├── 标点
            ├── 规范化
            └── 译释
```

文本层类型：

```text
ocr_raw, diplomatic, punctuated, normalized,
simplified, translation, scholarly_edition
```

已发布文本层不可原地改字；校正后创建下一个 `version_no`。

`locator_json` 示例：

```json
{
  "volume": "9",
  "section": "世宗本纪",
  "page": "3a",
  "column": 2,
  "lineStart": 4,
  "lineEnd": 6
}
```

## 7. 断言与证据

断言类型：

```text
entity_relation, literal_statement, person_relationship,
title_assignment, event_occurrence, event_participation, depiction
```

断言状态：

```text
draft, in_review, accepted, disputed, rejected, deprecated
```

采集方式：

```text
human_entry, structured_import, rule_extraction,
ocr_extraction, ner_extraction, llm_extraction
```

完全相同的命题以规范 JSON 计算 SHA-256。相同命题遇到第二来源时，应添加证据而不是复制断言。

证据与断言的关系：

```text
supports       支持
contradicts    反证
contextualizes 提供背景
mentions_only  只提及，不足以支持
```

直接性：`explicit/inferred/contextual/argument_from_silence`。

两个现代重印本如果来自同一底本，只属于同一 `source_family_entity_id`，不能算独立证据。

## 8. 图像、实物和权利

必须区分：

```text
视觉作品 → 物理原件 → 数字照片/扫描 → 衍生缩略图
```

“某画像描绘某人物”以 `claim.depiction` 表达，而非图片表中的无来源字段。认定类型：

```text
inscription_explicit
catalog_attribution
scholarly_identification
traditional_identification
probable
possible
rejected_identification
```

权利必须区分作用于：

```text
physical_object, visual_work, digital_image, metadata,
transcription, translation, download, publication
```

`UNKNOWN` 只能外链或显示合法范围内的受限缩略图，不能自动开放下载。

## 9. 审核和版本

断言从 `in_review` 进入 `accepted` 前必须满足：

- 至少一条 `supports` 证据；
- 证据不是 `mentions_only`；
- 具体版本、卷页段、档号或图像区域可解析；
- 至少一名人类审核者批准；
- 审核者所审 `row_version` 等于当前版本；
- OCR/NER/LLM 抽取不得自动采纳；
- 创建者不得审核自己的关键 A 级断言；
- 存在可信反证时必须进入冲突组；
- 生父母、继承、精确生卒、画像认定、作者归属和重大事件原则上需要两个独立来源家族；只有一份时填写豁免理由。

## 10. 标准映射

### TEI P5

| 数据库 | TEI |
|---|---|
| 作品/版本 | `teiHeader/sourceDesc/biblStruct` |
| 档案件 | `msDesc/msIdentifier/msContents` |
| 文本片段 | `div/p/ab/l @xml:id` |
| 实体名称 | `persName/placeName/orgName` |
| 实体链接 | `@ref` |
| 图像区域 | `facsimile/surface/zone` 与 `@facs` |
| 异文 | `app/lem/rdg` |
| 修订 | `respStmt/revisionDesc/change` |

数据库是编辑主流程；TEI 为确定性生成的发布物，不允许两边同时手工修改。

### IIIF 3.0 / Web Annotation

| 数据库 | 映射 |
|---|---|
| 数字资产 | Manifest / Canvas / ImageService3 |
| 图像区域 | SpecificResource Selector |
| OCR/录文 | Annotation body |
| 权利 URL | `rights` |
| 署名 | `requiredStatement` |

### EDTF

- 确切年：`1722`
- 不确定：`1722?`
- 约数：`1722~`
- 区间：`1722/1723`
- 开放终点：`1722/..`

## 11. Phase 0 强制验收查询

1. `accepted` 断言中无零证据记录；
2. `accepted` 断言中无人类审核缺失记录；
3. 任意引文可回到具体版本及文本片段；
4. 任意图像认定可回到作品、实物或图像区域；
5. 公开数字资产无版权记录缺失；
6. 生父、生母、配偶查询可生成正确逆关系；
7. 同一人物异名检索回到同一实体；
8. 历史日期可显示原文、公历范围、换算工具和版本；
9. 冲突断言不会被搜索接口隐藏；
10. 任一已采纳断言可导出完整“命题—证据—反证—审核”JSON；
11. 随机抽查 100 条断言，卷页定位成功率 100%；
12. 黄金问题不出现无证据人物关系或画像认定；
13. 已采纳断言不存在仅由 C/D 级来源支持的情况；生父母、继承、精确生卒、画像认定等高风险断言至少有两个独立来源家族（Phase 0 CSV 层由 `validate-data.mjs` 证据等级门禁执行）。

