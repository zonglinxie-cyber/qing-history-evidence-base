-- 清史证据库 Phase 0：零预算导入就绪补丁
-- 前置：schema.sql v0.2.0。目标是允许“只保存元数据和外链”，并记录每次 CSV 导入。

BEGIN;

-- 这些编辑、时间、名称、权利和审核记录也需要稳定公开标识，不能只暴露数据库 UUID。
ALTER TABLE ops.editor_account ADD COLUMN IF NOT EXISTS public_id text;
ALTER TABLE core.time_expression ADD COLUMN IF NOT EXISTS public_id text;
ALTER TABLE core.entity_name ADD COLUMN IF NOT EXISTS public_id text;
ALTER TABLE media.rights_statement ADD COLUMN IF NOT EXISTS public_id text;
ALTER TABLE media.image_region ADD COLUMN IF NOT EXISTS public_id text;
ALTER TABLE claim.review_decision ADD COLUMN IF NOT EXISTS public_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_editor_account_public_id ON ops.editor_account(public_id) WHERE public_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_time_expression_public_id ON core.time_expression(public_id) WHERE public_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_entity_name_public_id ON core.entity_name(public_id) WHERE public_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_rights_statement_public_id ON media.rights_statement(public_id) WHERE public_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_image_region_public_id ON media.image_region(public_id) WHERE public_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_decision_public_id ON claim.review_decision(public_id) WHERE public_id IS NOT NULL;

-- 卷、章、页、档案件、条目是证据定位单位，不应全部伪装成独立作品或人物实体。
CREATE TABLE IF NOT EXISTS source.source_unit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  source_entity_id uuid NOT NULL REFERENCES core.entity(id),
  parent_unit_id uuid REFERENCES source.source_unit(id),
  unit_kind text NOT NULL CHECK (unit_kind IN ('volume','chapter','section','page','folio','record','file','item','image','other')),
  label text NOT NULL,
  ordinal integer CHECK (ordinal IS NULL OR ordinal >= 0),
  locator_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  external_uri text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_unit_id IS NULL OR parent_unit_id <> id)
);
CREATE INDEX IF NOT EXISTS ix_source_unit_source ON source.source_unit(source_entity_id, unit_kind, ordinal);

ALTER TABLE claim.evidence_item ADD COLUMN IF NOT EXISTS source_unit_id uuid REFERENCES source.source_unit(id);

-- 可浏览不等于可下载：远程链接、IIIF 和纯元数据记录不强制要求本地文件或哈希。
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'media' AND t.typname = 'access_mode'
  ) THEN
    CREATE TYPE media.access_mode AS ENUM ('local','remote_link','iiif','metadata_only');
  END IF;
END
$do$;

ALTER TABLE media.digital_asset ADD COLUMN IF NOT EXISTS access_mode media.access_mode NOT NULL DEFAULT 'local';
ALTER TABLE media.digital_asset ALTER COLUMN storage_uri DROP NOT NULL;
ALTER TABLE media.digital_asset ALTER COLUMN sha256 DROP NOT NULL;
ALTER TABLE media.digital_asset DROP CONSTRAINT IF EXISTS ck_digital_asset_access_location;
ALTER TABLE media.digital_asset ADD CONSTRAINT ck_digital_asset_access_location CHECK (
  (access_mode = 'local' AND storage_uri IS NOT NULL AND sha256 IS NOT NULL)
  OR (access_mode = 'remote_link' AND source_url IS NOT NULL)
  OR (access_mode = 'iiif' AND COALESCE(iiif_manifest_uri, iiif_image_service_uri, source_url) IS NOT NULL)
  OR access_mode = 'metadata_only'
);

-- 每次导入都有批次、源文件哈希、结果和逐行错误，失败可定位，不静默吞掉脏数据。
CREATE TABLE IF NOT EXISTS ops.import_batch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  source_file text NOT NULL,
  source_sha256 char(64) NOT NULL,
  schema_version text NOT NULL,
  status ops.run_status NOT NULL DEFAULT 'queued',
  rows_seen integer NOT NULL DEFAULT 0 CHECK (rows_seen >= 0),
  rows_inserted integer NOT NULL DEFAULT 0 CHECK (rows_inserted >= 0),
  rows_updated integer NOT NULL DEFAULT 0 CHECK (rows_updated >= 0),
  rows_rejected integer NOT NULL DEFAULT 0 CHECK (rows_rejected >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  note text,
  CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at)
);

CREATE TABLE IF NOT EXISTS ops.import_error (
  id bigserial PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES ops.import_batch(id),
  row_number integer NOT NULL CHECK (row_number > 0),
  natural_key text,
  error_code text NOT NULL,
  error_message text NOT NULL,
  row_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
