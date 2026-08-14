-- 清史证据库 Phase 0 PostgreSQL schema v0.2.0
-- 建议 PostgreSQL 17+；最低支持版本需在实际部署环境做迁移测试。
-- PostGIS/pgvector 为后续时空和语义检索预留；若开发环境暂未安装，可先注释对应扩展行，核心表当前未使用其专属类型。

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS ltree;
-- 零预算首版不依赖以下可选扩展；确有地图或向量检索需求时再启用。
-- CREATE EXTENSION IF NOT EXISTS postgis;
-- CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS history;
CREATE SCHEMA IF NOT EXISTS source;
CREATE SCHEMA IF NOT EXISTS claim;
CREATE SCHEMA IF NOT EXISTS media;
CREATE SCHEMA IF NOT EXISTS ops;

CREATE TYPE core.entity_type AS ENUM (
  'person','group','organization','place','event','title','office','reign_era','concept',
  'text_work','text_version','archive_unit','visual_work','physical_object','digital_asset'
);
CREATE TYPE core.record_status AS ENUM ('active','merged','deprecated');
CREATE TYPE core.precision_code AS ENUM ('day','month','year','reign','decade','interval','unknown');
CREATE TYPE core.certainty_code AS ENUM ('exact','approximate','uncertain','approximate_uncertain','inferred','unknown');
CREATE TYPE source.layer_type AS ENUM ('ocr_raw','diplomatic','punctuated','normalized','simplified','translation','scholarly_edition');
CREATE TYPE source.layer_status AS ENUM ('draft','reviewed','published','deprecated');
-- 史料证据分级（docs/03 §2）：A1 原始档案 / A2 官修骨架 / B 同时代旁证 / C 后出综述 / D 仅作线索。
-- object_dependent = 博物馆聚合来源「视对象而定」，逐件在 digital_asset/rights 层定级。
CREATE TYPE source.source_rank AS ENUM ('A1','A2','B','C','D','object_dependent');
CREATE TYPE source.mention_review_status AS ENUM ('machine_candidate','editor_confirmed','rejected');
CREATE TYPE claim.assertion_kind AS ENUM ('entity_relation','literal_statement','person_relationship','title_assignment','event_occurrence','event_participation','depiction');
CREATE TYPE claim.assertion_status AS ENUM ('draft','in_review','accepted','disputed','rejected','deprecated');
CREATE TYPE claim.editorial_rank AS ENUM ('preferred','normal','deprecated');
CREATE TYPE claim.acquisition_method AS ENUM ('human_entry','structured_import','rule_extraction','ocr_extraction','ner_extraction','llm_extraction');
CREATE TYPE claim.evidence_stance AS ENUM ('supports','contradicts','contextualizes','mentions_only');
CREATE TYPE claim.evidence_directness AS ENUM ('explicit','inferred','contextual','argument_from_silence');
CREATE TYPE claim.evidence_strength AS ENUM ('primary','strong','moderate','weak','unrated');
CREATE TYPE claim.verification_status AS ENUM ('unverified','editor_verified','human_verified','rejected');
CREATE TYPE claim.conflict_resolution_status AS ENUM ('open','partially_resolved','resolved','unresolvable');
CREATE TYPE claim.value_type AS ENUM ('string','integer','decimal','boolean','time_expression','measurement','uri');
CREATE TYPE claim.review_decision_code AS ENUM ('approve','request_changes','reject','mark_disputed','rights_hold');
CREATE TYPE media.asset_kind AS ENUM ('master_scan','photograph','page_image','thumbnail','ocr_json','tei_xml','iiif_manifest','audio','video','model_3d');
CREATE TYPE media.selector_type AS ENUM ('iiif_xywh','pixel_xywh','percent_xywh','svg','whole_image');
CREATE TYPE media.copyright_status AS ENUM ('public_domain','licensed','copyrighted','permission_required','unknown');
CREATE TYPE media.rights_scope AS ENUM ('physical_object','visual_work','digital_image','metadata','transcription','translation','download','publication');
CREATE TYPE ops.editor_role AS ENUM ('contributor','editor','historian_reviewer','rights_reviewer','administrator');
CREATE TYPE ops.run_status AS ENUM ('queued','running','completed','failed','cancelled');
CREATE TYPE ops.audit_action AS ENUM ('insert','update','status_change','merge','deprecate');

CREATE TABLE ops.editor_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  role_code ops.editor_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE core.entity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  entity_type core.entity_type NOT NULL,
  canonical_label text NOT NULL,
  record_status core.record_status NOT NULL DEFAULT 'active',
  merged_into_id uuid REFERENCES core.entity(id),
  created_by uuid REFERENCES ops.editor_account(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CHECK ((record_status = 'merged' AND merged_into_id IS NOT NULL) OR (record_status <> 'merged' AND merged_into_id IS NULL)),
  CHECK (merged_into_id IS NULL OR merged_into_id <> id)
);

CREATE TABLE core.concept_scheme (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  version text NOT NULL,
  namespace_uri text
);

CREATE TABLE core.concept (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id uuid NOT NULL REFERENCES core.concept_scheme(id),
  code text NOT NULL,
  pref_label text NOT NULL,
  definition text,
  broader_id uuid REFERENCES core.concept(id),
  inverse_id uuid REFERENCES core.concept(id),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  external_uri text,
  UNIQUE (scheme_id, code),
  CHECK (broader_id IS NULL OR broader_id <> id),
  CHECK (inverse_id IS NULL OR inverse_id <> id)
);

CREATE TABLE core.relationship_type (
  concept_id uuid PRIMARY KEY REFERENCES core.concept(id),
  inverse_type_id uuid REFERENCES core.concept(id),
  is_symmetric boolean NOT NULL DEFAULT false,
  relation_family text NOT NULL,
  allowed_subject_type core.entity_type NOT NULL DEFAULT 'person',
  allowed_object_type core.entity_type NOT NULL DEFAULT 'person',
  max_accepted_per_subject integer CHECK (max_accepted_per_subject IS NULL OR max_accepted_per_subject > 0)
);

CREATE TABLE core.time_expression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_text text NOT NULL,
  calendar_code text NOT NULL,
  reign_era_id uuid REFERENCES core.entity(id),
  reign_year smallint CHECK (reign_year IS NULL OR reign_year > 0),
  month_no smallint CHECK (month_no IS NULL OR month_no BETWEEN 1 AND 12),
  is_leap_month boolean,
  day_no smallint CHECK (day_no IS NULL OR day_no BETWEEN 1 AND 30),
  edtf_value text,
  gregorian_lower date,
  gregorian_upper date,
  precision_code core.precision_code NOT NULL,
  certainty_code core.certainty_code NOT NULL,
  conversion_method text,
  conversion_version text,
  conversion_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (gregorian_lower IS NULL OR gregorian_upper IS NULL OR gregorian_lower <= gregorian_upper)
);

CREATE TABLE core.entity_name (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES core.entity(id),
  name_text text NOT NULL,
  normalized_text text NOT NULL,
  name_type_id uuid NOT NULL REFERENCES core.concept(id),
  language_tag text NOT NULL,
  script_code text,
  romanization_scheme text,
  valid_from_time_id uuid REFERENCES core.time_expression(id),
  valid_to_time_id uuid REFERENCES core.time_expression(id),
  is_preferred boolean NOT NULL DEFAULT false,
  historical_assertion_id uuid,
  record_status core.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_entity_preferred_name ON core.entity_name(entity_id, language_tag, COALESCE(script_code,'')) WHERE is_preferred AND record_status = 'active';

CREATE TABLE core.external_identifier (
  entity_id uuid NOT NULL REFERENCES core.entity(id),
  scheme_code text NOT NULL,
  identifier_value text NOT NULL,
  canonical_uri text,
  source_url text,
  checked_at timestamptz NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  PRIMARY KEY (entity_id, scheme_code, identifier_value),
  UNIQUE (scheme_code, identifier_value)
);

CREATE TABLE history.person (
  entity_id uuid PRIMARY KEY REFERENCES core.entity(id),
  sex_concept_id uuid REFERENCES core.concept(id),
  clan_entity_id uuid REFERENCES core.entity(id),
  house_entity_id uuid REFERENCES core.entity(id),
  sort_key text,
  catalog_note text
);

CREATE TABLE history.title (
  entity_id uuid PRIMARY KEY REFERENCES core.entity(id),
  title_kind_id uuid NOT NULL REFERENCES core.concept(id),
  rank_order integer,
  parent_title_id uuid REFERENCES core.entity(id),
  institution_context_id uuid REFERENCES core.entity(id)
);

CREATE TABLE history.event (
  entity_id uuid PRIMARY KEY REFERENCES core.entity(id),
  event_type_id uuid NOT NULL REFERENCES core.concept(id),
  short_label text NOT NULL,
  catalog_note text
);

CREATE TABLE media.rights_statement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rights_code text NOT NULL,
  rights_uri text,
  copyright_status media.copyright_status NOT NULL,
  rights_holder_id uuid REFERENCES core.entity(id),
  attribution_text text,
  commercial_use_allowed boolean,
  derivatives_allowed boolean,
  jurisdiction text,
  valid_from_time_id uuid REFERENCES core.time_expression(id),
  valid_to_time_id uuid REFERENCES core.time_expression(id),
  source_url text NOT NULL,
  checked_at timestamptz NOT NULL,
  checked_by uuid NOT NULL REFERENCES ops.editor_account(id),
  note text
);

CREATE TABLE source.text_work (
  entity_id uuid PRIMARY KEY REFERENCES core.entity(id),
  work_type_id uuid NOT NULL REFERENCES core.concept(id),
  canonical_title text NOT NULL,
  primary_language text,
  composition_time_id uuid REFERENCES core.time_expression(id),
  catalog_note text,
  source_rank source.source_rank NOT NULL
);

CREATE TABLE source.text_version (
  entity_id uuid PRIMARY KEY REFERENCES core.entity(id),
  work_id uuid NOT NULL REFERENCES core.entity(id),
  version_type_id uuid NOT NULL REFERENCES core.concept(id),
  version_statement text NOT NULL,
  publisher_org_id uuid REFERENCES core.entity(id),
  publication_place_id uuid REFERENCES core.entity(id),
  publication_time_id uuid REFERENCES core.time_expression(id),
  base_version_id uuid REFERENCES core.entity(id),
  bibliographic_citation text NOT NULL,
  rights_statement_id uuid REFERENCES media.rights_statement(id),
  CHECK (base_version_id IS NULL OR base_version_id <> entity_id)
);

CREATE TABLE source.archive_unit (
  entity_id uuid PRIMARY KEY REFERENCES core.entity(id),
  parent_unit_id uuid REFERENCES core.entity(id),
  repository_org_id uuid NOT NULL REFERENCES core.entity(id),
  fonds_code text,
  reference_code text NOT NULL,
  unit_level_id uuid NOT NULL REFERENCES core.concept(id),
  title text NOT NULL,
  unit_time_id uuid REFERENCES core.time_expression(id),
  extent_text text,
  language_tags text[],
  rights_statement_id uuid REFERENCES media.rights_statement(id),
  source_rank source.source_rank NOT NULL DEFAULT 'A1',
  UNIQUE (repository_org_id, reference_code),
  CHECK (parent_unit_id IS NULL OR parent_unit_id <> entity_id)
);

CREATE TABLE ops.ingest_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL,
  tool_name text NOT NULL,
  tool_version text NOT NULL,
  model_name text,
  model_version text,
  parameters_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_sha256 char(64) NOT NULL,
  output_sha256 char(64),
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  status ops.run_status NOT NULL,
  CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE TABLE media.digital_asset (
  entity_id uuid PRIMARY KEY REFERENCES core.entity(id),
  asset_kind media.asset_kind NOT NULL,
  storage_uri text NOT NULL,
  source_url text,
  mime_type text NOT NULL,
  byte_size bigint CHECK (byte_size IS NULL OR byte_size >= 0),
  sha256 char(64) NOT NULL UNIQUE,
  width_px integer CHECK (width_px IS NULL OR width_px > 0),
  height_px integer CHECK (height_px IS NULL OR height_px > 0),
  iiif_manifest_uri text,
  iiif_canvas_uri text,
  iiif_image_service_uri text,
  derived_from_asset_id uuid REFERENCES core.entity(id),
  produced_by_run_id uuid REFERENCES ops.ingest_run(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (derived_from_asset_id IS NULL OR derived_from_asset_id <> entity_id)
);

CREATE TABLE media.visual_work (
  entity_id uuid PRIMARY KEY REFERENCES core.entity(id),
  visual_type_id uuid NOT NULL REFERENCES core.concept(id),
  canonical_title text NOT NULL,
  catalog_note text
);

CREATE TABLE media.physical_object (
  entity_id uuid PRIMARY KEY REFERENCES core.entity(id),
  object_type_id uuid NOT NULL REFERENCES core.concept(id),
  visual_work_id uuid REFERENCES core.entity(id),
  holding_org_id uuid REFERENCES core.entity(id),
  accession_number text,
  materials_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  dimensions_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  catalog_source_url text
);
CREATE UNIQUE INDEX uq_holding_accession ON media.physical_object(holding_org_id, accession_number) WHERE accession_number IS NOT NULL;

CREATE TABLE media.image_region (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES core.entity(id),
  selector_type media.selector_type NOT NULL,
  selector_json jsonb NOT NULL,
  label text,
  created_by uuid REFERENCES ops.editor_account(id)
);

CREATE TABLE media.rights_assignment (
  subject_entity_id uuid NOT NULL REFERENCES core.entity(id),
  rights_statement_id uuid NOT NULL REFERENCES media.rights_statement(id),
  rights_scope media.rights_scope NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_entity_id, rights_statement_id, rights_scope)
);
CREATE UNIQUE INDEX uq_current_rights_scope ON media.rights_assignment(subject_entity_id, rights_scope) WHERE is_current;

CREATE TABLE source.text_layer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  text_version_id uuid REFERENCES core.entity(id),
  archive_unit_id uuid REFERENCES core.entity(id),
  layer_type source.layer_type NOT NULL,
  language_tag text NOT NULL,
  script_code text,
  base_layer_id uuid REFERENCES source.text_layer(id),
  version_no integer NOT NULL DEFAULT 1 CHECK (version_no > 0),
  layer_status source.layer_status NOT NULL DEFAULT 'draft',
  tei_asset_id uuid REFERENCES core.entity(id),
  tei_schema_version text,
  content_sha256 char(64) NOT NULL,
  produced_by_run_id uuid REFERENCES ops.ingest_run(id),
  created_by uuid REFERENCES ops.editor_account(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CHECK (num_nonnulls(text_version_id, archive_unit_id) = 1),
  CHECK (base_layer_id IS NULL OR base_layer_id <> id),
  CHECK ((layer_status = 'published' AND published_at IS NOT NULL) OR layer_status <> 'published')
);
CREATE UNIQUE INDEX uq_text_layer_version
  ON source.text_layer(text_version_id, layer_type, language_tag, COALESCE(script_code,''), version_no)
  WHERE text_version_id IS NOT NULL;
CREATE UNIQUE INDEX uq_archive_layer_version
  ON source.text_layer(archive_unit_id, layer_type, language_tag, COALESCE(script_code,''), version_no)
  WHERE archive_unit_id IS NOT NULL;

CREATE TABLE source.text_segment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id uuid NOT NULL REFERENCES source.text_layer(id),
  parent_segment_id uuid REFERENCES source.text_segment(id),
  path ltree,
  segment_type_id uuid NOT NULL REFERENCES core.concept(id),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  xml_id text NOT NULL,
  locator_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  text_original text NOT NULL,
  text_normalized text,
  facsimile_region_id uuid REFERENCES media.image_region(id),
  content_sha256 char(64) NOT NULL,
  UNIQUE (layer_id, xml_id),
  UNIQUE (layer_id, parent_segment_id, ordinal),
  CHECK (parent_segment_id IS NULL OR parent_segment_id <> id)
);

CREATE TABLE source.text_mention (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id uuid NOT NULL REFERENCES source.text_segment(id),
  char_start integer NOT NULL CHECK (char_start >= 0),
  char_end integer NOT NULL,
  surface_text text NOT NULL,
  entity_id uuid REFERENCES core.entity(id),
  mention_type_id uuid NOT NULL REFERENCES core.concept(id),
  confidence numeric CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  review_status source.mention_review_status NOT NULL DEFAULT 'machine_candidate',
  produced_by_run_id uuid REFERENCES ops.ingest_run(id),
  CHECK (char_end > char_start)
);

CREATE TABLE claim.conflict_set (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  title text NOT NULL,
  question_text text NOT NULL,
  resolution_status claim.conflict_resolution_status NOT NULL DEFAULT 'open',
  preferred_assertion_id uuid,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE claim.assertion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  assertion_kind claim.assertion_kind NOT NULL,
  assertion_status claim.assertion_status NOT NULL DEFAULT 'draft',
  editorial_rank claim.editorial_rank NOT NULL DEFAULT 'normal',
  certainty_code core.certainty_code NOT NULL,
  confidence numeric CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  conflict_set_id uuid REFERENCES claim.conflict_set(id),
  supersedes_assertion_id uuid REFERENCES claim.assertion(id),
  proposition_hash char(64) NOT NULL,
  acquisition_method claim.acquisition_method NOT NULL,
  produced_by_run_id uuid REFERENCES ops.ingest_run(id),
  editorial_note text,
  created_by uuid REFERENCES ops.editor_account(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CHECK (supersedes_assertion_id IS NULL OR supersedes_assertion_id <> id)
);
CREATE UNIQUE INDEX uq_live_proposition ON claim.assertion(proposition_hash) WHERE assertion_status <> 'deprecated';

ALTER TABLE core.entity_name ADD CONSTRAINT fk_entity_name_assertion FOREIGN KEY (historical_assertion_id) REFERENCES claim.assertion(id);
ALTER TABLE claim.conflict_set ADD CONSTRAINT fk_conflict_preferred_assertion FOREIGN KEY (preferred_assertion_id) REFERENCES claim.assertion(id);

CREATE TABLE claim.person_relationship (
  assertion_id uuid PRIMARY KEY REFERENCES claim.assertion(id),
  subject_person_id uuid NOT NULL REFERENCES core.entity(id),
  relationship_type_id uuid NOT NULL REFERENCES core.relationship_type(concept_id),
  object_person_id uuid NOT NULL REFERENCES core.entity(id),
  valid_from_time_id uuid REFERENCES core.time_expression(id),
  valid_to_time_id uuid REFERENCES core.time_expression(id),
  child_order integer CHECK (child_order IS NULL OR child_order > 0),
  order_basis_id uuid REFERENCES core.concept(id),
  qualifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (subject_person_id <> object_person_id)
);

CREATE TABLE claim.title_assignment (
  assertion_id uuid PRIMARY KEY REFERENCES claim.assertion(id),
  person_id uuid NOT NULL REFERENCES core.entity(id),
  title_id uuid NOT NULL REFERENCES core.entity(id),
  assignment_kind_id uuid NOT NULL REFERENCES core.concept(id),
  institution_id uuid REFERENCES core.entity(id),
  start_time_id uuid REFERENCES core.time_expression(id),
  end_time_id uuid REFERENCES core.time_expression(id),
  assignment_event_id uuid REFERENCES core.entity(id),
  predecessor_assignment_id uuid REFERENCES claim.title_assignment(assertion_id),
  qualifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (predecessor_assignment_id IS NULL OR predecessor_assignment_id <> assertion_id)
);

CREATE TABLE claim.event_occurrence (
  assertion_id uuid PRIMARY KEY REFERENCES claim.assertion(id),
  event_id uuid NOT NULL REFERENCES core.entity(id),
  occurrence_time_id uuid REFERENCES core.time_expression(id),
  place_id uuid REFERENCES core.entity(id),
  parent_event_id uuid REFERENCES core.entity(id),
  sequence_no integer,
  qualifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (num_nonnulls(occurrence_time_id, place_id, parent_event_id) >= 1)
);

CREATE TABLE claim.event_participation (
  assertion_id uuid PRIMARY KEY REFERENCES claim.assertion(id),
  event_id uuid NOT NULL REFERENCES core.entity(id),
  participant_entity_id uuid NOT NULL REFERENCES core.entity(id),
  role_type_id uuid NOT NULL REFERENCES core.concept(id),
  participation_time_id uuid REFERENCES core.time_expression(id),
  qualifiers jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE claim.entity_relation (
  assertion_id uuid PRIMARY KEY REFERENCES claim.assertion(id),
  subject_entity_id uuid NOT NULL REFERENCES core.entity(id),
  predicate_id uuid NOT NULL REFERENCES core.concept(id),
  object_entity_id uuid NOT NULL REFERENCES core.entity(id),
  valid_from_time_id uuid REFERENCES core.time_expression(id),
  valid_to_time_id uuid REFERENCES core.time_expression(id),
  qualifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (subject_entity_id <> object_entity_id)
);

CREATE TABLE claim.literal_statement (
  assertion_id uuid PRIMARY KEY REFERENCES claim.assertion(id),
  subject_entity_id uuid NOT NULL REFERENCES core.entity(id),
  predicate_id uuid NOT NULL REFERENCES core.concept(id),
  value_type claim.value_type NOT NULL,
  value_json jsonb NOT NULL,
  unit_concept_id uuid REFERENCES core.concept(id),
  valid_time_id uuid REFERENCES core.time_expression(id),
  qualifiers jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE claim.depiction (
  assertion_id uuid PRIMARY KEY REFERENCES claim.assertion(id),
  visual_entity_id uuid NOT NULL REFERENCES core.entity(id),
  image_region_id uuid REFERENCES media.image_region(id),
  depicted_entity_id uuid NOT NULL REFERENCES core.entity(id),
  identification_type_id uuid NOT NULL REFERENCES core.concept(id),
  qualifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (visual_entity_id <> depicted_entity_id)
);

CREATE TABLE claim.evidence_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  source_entity_id uuid NOT NULL REFERENCES core.entity(id),
  text_segment_id uuid REFERENCES source.text_segment(id),
  char_start integer,
  char_end integer,
  image_region_id uuid REFERENCES media.image_region(id),
  locator_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  quoted_text text,
  quoted_text_sha256 char(64),
  evidence_kind_id uuid NOT NULL REFERENCES core.concept(id),
  source_family_entity_id uuid NOT NULL REFERENCES core.entity(id),
  external_uri text,
  captured_at timestamptz NOT NULL,
  created_by uuid REFERENCES ops.editor_account(id),
  verification_status claim.verification_status NOT NULL DEFAULT 'unverified',
  CHECK (text_segment_id IS NOT NULL OR image_region_id IS NOT NULL OR locator_json <> '{}'::jsonb),
  CHECK ((char_start IS NULL AND char_end IS NULL) OR (char_start >= 0 AND char_end > char_start))
);

CREATE TABLE claim.assertion_evidence (
  assertion_id uuid NOT NULL REFERENCES claim.assertion(id),
  evidence_id uuid NOT NULL REFERENCES claim.evidence_item(id),
  stance claim.evidence_stance NOT NULL,
  directness claim.evidence_directness NOT NULL,
  strength claim.evidence_strength NOT NULL DEFAULT 'unrated',
  interpretation_note text,
  linked_by uuid REFERENCES ops.editor_account(id),
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assertion_id, evidence_id, stance)
);

CREATE TABLE claim.assertion_link (
  assertion_id uuid NOT NULL REFERENCES claim.assertion(id),
  related_assertion_id uuid NOT NULL REFERENCES claim.assertion(id),
  link_type text NOT NULL CHECK (link_type IN ('contradicts','supports','duplicates','refines','supersedes','depends_on')),
  rationale text,
  PRIMARY KEY (assertion_id, related_assertion_id, link_type),
  CHECK (assertion_id <> related_assertion_id)
);

CREATE TABLE claim.review_decision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assertion_id uuid NOT NULL REFERENCES claim.assertion(id),
  reviewer_id uuid NOT NULL REFERENCES ops.editor_account(id),
  decision claim.review_decision_code NOT NULL,
  review_note text NOT NULL,
  waiver_reason text,
  reviewed_row_version integer NOT NULL CHECK (reviewed_row_version > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE claim.assertion_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assertion_id uuid NOT NULL REFERENCES claim.assertion(id),
  from_status claim.assertion_status,
  to_status claim.assertion_status NOT NULL,
  changed_by uuid REFERENCES ops.editor_account(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ops.change_set (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES ops.editor_account(id),
  reason text NOT NULL,
  ticket_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ops.audit_log (
  id bigserial PRIMARY KEY,
  change_set_id uuid REFERENCES ops.change_set(id),
  table_name text NOT NULL,
  row_pk text NOT NULL,
  action ops.audit_action NOT NULL,
  before_json jsonb,
  after_json jsonb,
  changed_by uuid REFERENCES ops.editor_account(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- Phase 0 检查视图：公开/已采纳断言必须至少有一条有效支持证据。
CREATE VIEW claim.v_accepted_without_support AS
SELECT a.id, a.public_id
FROM claim.assertion a
WHERE a.assertion_status = 'accepted'
  AND NOT EXISTS (
    SELECT 1 FROM claim.assertion_evidence ae
    WHERE ae.assertion_id = a.id AND ae.stance = 'supports'
  );

CREATE VIEW claim.v_accepted_without_human_review AS
SELECT a.id, a.public_id
FROM claim.assertion a
WHERE a.assertion_status = 'accepted'
  AND NOT EXISTS (
    SELECT 1 FROM claim.review_decision rd
    WHERE rd.assertion_id = a.id
      AND rd.decision = 'approve'
      AND rd.reviewed_row_version = a.row_version
  );

CREATE VIEW media.v_assets_without_current_rights AS
SELECT da.entity_id
FROM media.digital_asset da
WHERE NOT EXISTS (
  SELECT 1 FROM media.rights_assignment ra
  WHERE ra.subject_entity_id = da.entity_id AND ra.is_current
);

COMMENT ON SCHEMA claim IS '所有可争议历史事实及其证据、反证、冲突、审核与版本。';
COMMENT ON TABLE claim.assertion IS '断言身份表；具体命题位于与 assertion_kind 对应的一个子表。';
COMMENT ON TABLE claim.evidence_item IS '具体版本、档案件或图像区域中的可定位证据。';
COMMENT ON TABLE media.rights_statement IS '对数字图、原作、元数据、转录和译文分别记录的权利声明。';
