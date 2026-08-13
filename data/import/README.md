# CSV 导入规则

本目录说明“研究用 CSV”如何进入 PostgreSQL。当前 CSV 是可读的采集层，不是可直接复制进所有权威表的数据库转储。

## 身份合并

1. `qing-emperors.csv.emperor_id` 是旧展示键，暂时保留以兼容已有文件。
2. 导入人物前必须先连接 `entity-id-crosswalk.csv`，使用 `person_id` 作为人物自然键。
3. 康熙、雍正、乾隆已经存在于 `phase0-people.csv`，不得再以 `QH-E-*` 创建第二个人物。
4. “皇帝”是人物在一段时间内的称号或统治身份，不是另一个人物实体。
5. 同一自然键多次出现时执行更新或送人工合并队列，不允许静默新增。

## 范围值

`ALL` 表示“跨十二帝的通用来源或任务范围”，不是人物外键。导入 `qing-emperor-source-index.csv` 和 `task-queue.csv` 时应进入范围字段或关联表，不能写入 `core.entity.id`。

## 来源与文件

- 有明确开放许可且确实下载到本地的文件，记为 `media.digital_asset.access_mode = local`，并计算 SHA-256。
- 只有网页、馆藏目录或受限图像入口时，记为 `remote_link` 或 `metadata_only`；保存来源 URL、抓取日期和自建摘要，不伪造本地文件。
- IIIF 清单或图像服务记为 `iiif`，但仍须单独记录权利状态。
- 卷、章、页、档案件和条目进入 `source.source_unit`，证据再精确连到该定位单元。

## 批次与失败规则

1. 导入前运行 `node scripts/validate-data.mjs`；任何错误都停止导入。
2. 为每个输入文件计算 SHA-256，并创建一条 `ops.import_batch`。
3. 单个文件在一个数据库事务中导入；外键、唯一键或受控词失败时回滚该文件。
4. 每一条失败记录写入 `ops.import_error`，保留原始行、行号和错误代码。
5. 只有“校验通过、事务提交、行数对账一致”才把批次标记为 `completed`。
6. 数据库 UUID 只作内部键；对外链接、引用和跨文件连接均使用稳定 `public_id`。
