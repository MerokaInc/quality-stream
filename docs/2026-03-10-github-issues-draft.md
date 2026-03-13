# M-Alpha Data Platform — GitHub Issues Draft

## Team & Timeline

| Period | Engineers | Focus |
|---|---|---|
| Mar 10-13 | Junjian, Nigel, Othman (all 3) | CDK foundation, local dev setup, project scaffolding |
| Mar 14 - Apr 5 | Nigel + Othman | Ingestion pipelines, consolidated layer, early treasure maps if delivered |
| Apr 6 - May 5 | All 3 (Junjian returns) | Aggregate layer, remaining treasure maps, demo prep |

### Treasure Map Timeline (from Data Science Team)

Treasure maps may start arriving **as early as Mar 14** and continue through Apr 4. This means:
- Some treasure maps may land **during Phase 1-2**, before the aggregate layer is built
- Nigel/Othman may need to context-switch to productionize early treasure maps alongside source pipeline work
- Early treasure maps could also **reshape consolidated/aggregate schema** — better to know sooner
- If a treasure map arrives and its upstream data sources aren't ingested yet, prioritize those sources first

## Priority Legend

- **P0 Must-Have** — demo doesn't work without this
- **P1 Should-Have** — makes demo significantly better, do if time allows
- **P2 Nice-to-Have** — deprioritize or cut entirely

## Dependency Map

```
Phase 0: Setup
  ├── CDK Foundation (S3, Redshift, IAM)          ← everything depends on this
  └── Local Dev Harness (DuckDB, fixtures)         ← all pipeline dev depends on this
        │
Phase 1: First Pipeline (NPPES as template) — two parallel tracks
  ├── Track A: shared ingestion utils → NPPES Ingest → Raw
  ├── Track B: shared transform utils → NPPES Transform → Unified
  ├── PipelineStack CDK (Glue jobs)
  └── CI Pipeline (lint, test, CDK synth)          ← all PRs go through this
        │
Phase 2: Remaining P0 Sources (parallel work)
  ├── PECOS, Medicare Util, MIPS, Care Compare, DOL 5500
  ├── Each follows NPPES pattern
  └── Consolidated layer (practice_profile as first join)
        │
Phase 3: Treasure Maps + Consolidated Logic
  ├── Remaining consolidated modules
  ├── Aggregate layer
  └── Treasure map productionization
        │
Phase 4: Query Interface + Demo
  ├── Slack bot (keyword → SQL)
  └── Demo rehearsal
```

---

## Phase 0: Setup (Mar 10-13)

### [EPIC-000] Project Scaffolding & Repo Boilerplate
**Priority**: P0 Must-Have
**Phase**: 0

Create the `m-alpha-data` repo structure with all directories, empty modules, and config files so the team can start working in parallel immediately.

- [ ] Initialize repo with `README.md`, `.gitignore`, `Makefile`, root `pyproject.toml`
- [ ] `pipeline/base/` — `malpha_common` package skeleton with `pyproject.toml` and empty modules (`s3.py`, `manifest.py`, `lineage.py`, `validation.py`, `transforms.py`, `iceberg.py`, `redshift.py`)
- [ ] `pipeline/sources/` — empty source directories with `__init__.py` for all 6 P0 sources (`nppes/`, `pecos/`, `medicare_util/`, `mips/`, `care_compare/`, `dol_5500/`)
- [ ] `pipeline/consolidated/` — empty goal directories (`practice_profile/`, `practice_quality/`, `practice_cost/`, `employer_profile/`, `practice_employer/`)
- [ ] `pipeline/aggregate/` — empty goal directories (`market_comparison/`, `provider_summary/`, `employer_savings/`)
- [ ] `app/slackbot/` — empty placeholder
- [ ] `infra/cdk/` — empty CDK skeleton (just enough for `cdk init` equivalent)
- [ ] `tests/` — `conftest.py`, `fixtures/handcrafted/`, `fixtures/sampled/`, `unit/`, `integration/`
- [ ] `scripts/` — `setup_local.sh`, `download_sample_data.sh` (placeholder)
- [ ] `docs/` directory
- [ ] Ruff config (in `pyproject.toml` or `ruff.toml`)
- [ ] `.github/workflows/` — placeholder CI workflow

**Acceptance**: `git clone` → `make setup` installs deps. Repo structure matches tech design doc. Team can immediately start filling in modules without stepping on each other.

**Notes**: This is day-1 work. Get the skeleton committed so everyone has a place to put their code. Actual logic comes in subsequent epics.

---

### [EPIC-001] CDK Foundation Stack
**Priority**: P0 Must-Have

**Phase**: 0

Set up the CDK project and deploy core infrastructure that everything else depends on.

- [ ] Initialize CDK project in repo (`infra/cdk/`)
- [ ] FoundationStack: S3 buckets (`malpha-raw-{env}`, `malpha-unified-{env}`)
- [ ] FoundationStack: Redshift Serverless (namespace, workgroup, `consolidated` + `aggregate` schemas)
- [ ] FoundationStack: IAM roles (Glue execution, Redshift access, Lambda execution)
- [ ] FoundationStack: Secrets Manager (Redshift credentials)
- [ ] Per-engineer environment config (`environments.py` with dev, prod, ng, ot, jj prefixes)
- [ ] Deploy to dev environment, verify resources created
- [ ] Document: how to deploy/destroy personal environment (`cdk deploy --context env=ng`)

**Acceptance**: `cdk deploy --context env=dev` creates all foundation resources. Another engineer can `cdk deploy --context env=ng` to get their own isolated environment.

**Notes**: This is the critical path — nothing else can start on AWS without this. Prioritize S3 + IAM first (ingestion needs it), Redshift can follow shortly after.

---

### [EPIC-002] Local Development Harness
**Priority**: P0 Must-Have
**Phase**: 0

Set up the local dev environment so engineers can develop and test pipeline code without AWS.

- [ ] Root `pyproject.toml` with dev dependencies (pytest, ruff, duckdb, etc.)
- [ ] `pipeline/base/` package scaffolding (`malpha_common` with `pyproject.toml`)
- [ ] `tests/conftest.py` — DuckDB in-memory setup, temp table helpers
- [ ] `tests/fixtures/handcrafted/` — minimal sample CSVs (10-20 rows each) for NPPES to start
- [ ] `Makefile` with `setup`, `test`, `test-unit`, `test-integ`, `lint` targets
- [ ] `scripts/setup_local.sh` — install deps, verify DuckDB works
- [ ] One working example: NPPES transform runs locally against DuckDB with fixture data

**Acceptance**: `make setup && make test` passes on a fresh clone. Any engineer can start developing immediately.

---

### [EPIC-003] CI Pipeline
**Priority**: P0 Must-Have
**Phase**: 0

GitHub Actions workflow so every PR gets validated.

- [ ] `.github/workflows/ci.yml`
- [ ] Lint job: `ruff check` + `ruff format --check`
- [ ] Test job: `pytest tests/unit tests/integration` (DuckDB, no AWS creds needed)
- [ ] CDK synth job: `cd infra/cdk && cdk synth` (validates infra code)

**Acceptance**: PR to `main` triggers all 3 checks. No AWS credentials needed in CI.

**Notes**: Could potentially be folded into EPIC-000 (project scaffolding) since the CI workflow file is part of the repo boilerplate. Keeping separate for now — revisit during sprint planning.

---

## Phase 1: Foundation (Mar 12-20)

### [EPIC-004a] Shared Library — Ingestion Utilities
**Priority**: P0 Must-Have
**Phase**: 1

Shared utilities needed for the ingestion path (download → Raw S3). Can be built in parallel with EPIC-004b.

- [ ] `s3.py` — S3 read/write helpers, path construction (`raw_path()`, `unified_path()`)
- [ ] `manifest.py` — `read_manifest()`, `update_manifest()`, `get_latest_version()`
- [ ] `lineage.py` — `generate_run_id()`, lineage column helpers
- [ ] Unit tests for each module

**Acceptance**: Ingestion scripts can import `malpha_common` to write to S3 and manage manifests.

---

### [EPIC-004b] Shared Library — Transform & Warehouse Utilities
**Priority**: P0 Must-Have
**Phase**: 1

Shared utilities needed for the transform path (Raw → Unified) and warehouse loading (Unified → Redshift). Can be built in parallel with EPIC-004a.

- [ ] `transforms.py` — shared reusable functions: dedup rows, type casting, NPI normalization (NPI is a 10-digit provider ID but sources format it differently — as integer, with spaces, missing leading zeros — this ensures all sources output a consistent zero-padded 10-char string so cross-source joins work)
- [ ] `iceberg.py` — Iceberg table read/write (via PyIceberg or Glue connector)
- [ ] `redshift.py` — connection helper, COPY/LOAD to Redshift
- [ ] `validation.py` — row count check, null rate check, schema match check
- [ ] Unit tests for each module

**Acceptance**: Transform and consolidated scripts can import `malpha_common` for shared transform functions, Iceberg writes, and Redshift loads.

**Notes**: `transforms.py` contains **reusable building blocks** (e.g., `normalize_npi()`, `dedup_by_columns()`, `cast_types()`). Each source's own `transform.py` (e.g., `sources/nppes/transform.py`) is the **orchestrator** that calls these shared functions with source-specific column mappings and logic.

---

### [EPIC-005a] NPPES Ingestion Pipeline (Download → Raw)
**Priority**: P0 Must-Have
**Phase**: 1

First source ingestion. This becomes the ingestion template for all other sources. Can be built in parallel with EPIC-005b once EPIC-004a is done.

- [ ] `sources/nppes/ingest.py` — download from CMS, determine version from filename, write to Raw S3, update manifest
- [ ] `sources/nppes/schema.py` — schema definition, validation rules
- [ ] Glue job definition in CDK (PipelineStack) for NPPES ingest
- [ ] `tests/fixtures/handcrafted/nppes_sample.csv` — edge cases (null NPIs, duplicate rows, bad types)
- [ ] `tests/unit/test_nppes_ingest.py`
- [ ] Deploy to personal cloud, run ingest, verify raw data lands in S3

**Acceptance**: NPPES raw data lands in `s3://malpha-raw-{env}/nppes/{version}/{date}/`. Manifest updated. Tests pass locally.

**Depends on**: EPIC-004a (ingestion utilities).

**Notes**: MVP scope is manual/one-time ingestion only — run `ingest.py` to download and land data in S3. Scheduled/continuous ingestion (EventBridge triggers, "no new data" detection) is tracked separately in EPIC-027 (P2, post-MVP).

---

### [EPIC-005b] NPPES Transform Pipeline (Raw → Unified)
**Priority**: P0 Must-Have
**Phase**: 1

First source transform. This becomes the transform template for all other sources.

- [ ] `sources/nppes/transform.py` — read from Raw, clean/type/dedup using shared `transforms.py` functions, add lineage columns, write to Unified Iceberg table
- [ ] Glue job definition in CDK (PipelineStack) for NPPES transform
- [ ] `tests/unit/test_nppes_transform.py`
- [ ] `tests/integration/test_nppes_pipeline.py` — full flow against DuckDB
- [ ] Deploy to personal cloud, run transform, verify data in Unified layer (queryable via Athena)
- [ ] **Write a short "How to add a new source" guide** — template for remaining sources

**Acceptance**: NPPES data flows Raw → Unified → queryable via Athena. Tests pass locally (DuckDB) and in personal cloud. Clear template exists for remaining sources.

**Depends on**: EPIC-004b (transform utilities), EPIC-005a (raw data available).

---

### [EPIC-006] PipelineStack CDK — Glue Job Infra
**Priority**: P0 Must-Have
**Phase**: 1

CDK stack for pipeline resources. Grows as sources are added.

Each source gets **3 separate Glue jobs**:
1. **Ingest** — download from public source → Raw S3 (I/O-bound)
2. **Transform** — Raw → Unified Iceberg (may need PySpark for large files)
3. **Load** — Unified → Redshift consolidated (COPY command)

Decoupled so each step can be re-run independently, retried on failure, and scaled differently.

- [ ] PipelineStack: parameterized Glue job definitions (3 per source: ingest, transform, load)
- [ ] Glue Catalog: database + Iceberg table definitions
- [ ] Build `malpha_common` wheel as part of CDK deploy step
- [ ] Upload wheel to `s3://malpha-unified-{env}/_libs/`
- [ ] Glue job config: `--extra-py-files` pointing to wheel on S3

**Acceptance**: `cdk deploy --context env=dev` creates Glue jobs. Jobs can be triggered manually and import `malpha_common`.

**Notes**: For MVP, jobs are triggered manually in order (ingest → transform → load). Orchestration via Step Functions is tracked in EPIC-022 (P1). Can be combined with EPIC-005 work — listed separately for tracking.

---

## Phase 2: P0 Data Sources (Mar 21 - Apr 5)

> After NPPES is done as template, remaining sources follow the same pattern. Consolidated layer work can start in parallel once upstream sources are in Unified.

### [TASK-007] PECOS Ingestion + Transform Pipeline
**Priority**: P0 Must-Have
**Phase**: 2

Copy NPPES pattern for PECOS (Medicare enrollment data).

- [ ] `sources/pecos/ingest.py` — download, determine version (quarter), write to Raw, update manifest
- [ ] `sources/pecos/schema.py` — Iceberg schema
- [ ] `sources/pecos/transform.py` — clean, type, dedup, write to Unified
- [ ] Glue job definitions added to PipelineStack
- [ ] `tests/fixtures/handcrafted/pecos_sample.csv`
- [ ] `tests/unit/test_pecos_transform.py`
- [ ] `tests/integration/test_pecos_pipeline.py`

**Acceptance**: PECOS flows Raw → Unified. Tests pass locally.

**Ref**: Follow pattern in `sources/nppes/`. See "How to add a new source" guide.

---

### [TASK-008] Medicare Utilization Ingestion + Transform Pipeline
**Priority**: P0 Must-Have
**Phase**: 2

- [ ] `sources/medicare_util/ingest.py`
- [ ] `sources/medicare_util/schema.py`
- [ ] `sources/medicare_util/transform.py`
- [ ] Glue job definitions
- [ ] Fixtures + unit tests + integration tests

**Acceptance**: Medicare Utilization flows Raw → Unified. Tests pass locally.

---

### [TASK-009] MIPS Ingestion + Transform Pipeline
**Priority**: P0 Must-Have
**Phase**: 2

- [ ] `sources/mips/ingest.py`
- [ ] `sources/mips/schema.py`
- [ ] `sources/mips/transform.py`
- [ ] Glue job definitions
- [ ] Fixtures + unit tests + integration tests

**Acceptance**: MIPS flows Raw → Unified. Tests pass locally.

---

### [TASK-010] Care Compare Ingestion + Transform Pipeline
**Priority**: P0 Must-Have
**Phase**: 2

- [ ] `sources/care_compare/ingest.py`
- [ ] `sources/care_compare/schema.py`
- [ ] `sources/care_compare/transform.py`
- [ ] Glue job definitions
- [ ] Fixtures + unit tests + integration tests

**Acceptance**: Care Compare flows Raw → Unified. Tests pass locally.

---

### [TASK-011] DOL Form 5500 Ingestion + Transform Pipeline
**Priority**: P0 Must-Have
**Phase**: 2

- [ ] `sources/dol_5500/ingest.py`
- [ ] `sources/dol_5500/schema.py`
- [ ] `sources/dol_5500/transform.py`
- [ ] Glue job definitions
- [ ] Fixtures + unit tests + integration tests

**Acceptance**: DOL 5500 flows Raw → Unified. Tests pass locally.

---

### [EPIC-012] Consolidated Layer — Practice Profile (First Join)
**Priority**: P0 Must-Have
**Phase**: 2

First cross-source join: NPPES + PECOS → `consolidated.practice` + `consolidated.provider`. This proves the Unified → Consolidated pattern.

**Schema pattern — source-specific + resolved columns:**

Each row in `consolidated.practice` is one NPI. The table keeps **both** the raw values from each source (for transparency/debugging) and a **resolved "golden" column** (the best-available value picked by resolution logic):

```
consolidated.practice:
  npi (PK)
  -- source-specific columns (kept for auditability)
  nppes_name, nppes_address, nppes_specialty, ...
  pecos_name, pecos_enrollment_type, ...
  -- resolved / golden columns (business logic picks best value)
  practice_name         ← resolution: prefer PECOS, fall back to NPPES (or per treasure map)
  practice_address
  practice_specialty
  ownership_type        ← independent / hospital-affiliated / PE-backed (from treasure map, NULL until available)
  -- lineage
  _run_id, _updated_at
```

Resolution logic starts simple (e.g., `COALESCE(pecos_name, nppes_name)`) and gets refined as data science validates which source is more reliable per field. Treasure maps may redefine resolution rules.

**Note**: One expected treasure map is a classification model that identifies whether an organization is independent vs hospital-affiliated vs PE-backed using public data signals. When that lands, `ownership_type` gets populated here in consolidated — this is the source of truth. Downstream layers (aggregate) inherit it from here.

- [ ] `consolidated/practice_profile/build.py` — read NPPES + PECOS from Unified, join on NPI, write to Redshift
- [ ] Define `consolidated.practice` schema with source-specific + resolved columns
- [ ] Define `consolidated.provider` schema
- [ ] Implement resolution logic for golden columns (start with COALESCE, refine later)
- [ ] Lineage: `_run_id`, `_updated_at` on every row
- [ ] Unit tests (DuckDB with fixture data from both sources — include cases where sources disagree)
- [ ] Integration test: full flow Unified → Redshift (personal cloud)

**Acceptance**: `SELECT npi, nppes_name, pecos_name, practice_name FROM consolidated.practice LIMIT 10` returns joined data with both source values and resolved name.

**Depends on**: EPIC-005a/005b (NPPES), TASK-007 (PECOS) in Unified layer.

---

### [EPIC-013] Consolidated Layer — Quality Metrics
**Priority**: P0 Must-Have
**Phase**: 2

Load step: read MIPS + Care Compare from Unified Iceberg, join on NPI, write to `consolidated.quality_metrics` in Redshift. (Ingest + transform for these sources are handled in TASK-009 and TASK-010.)

Same source-specific + resolved column pattern as EPIC-012:

```
consolidated.quality_metrics:
  npi (PK/FK → practice)
  -- source-specific
  mips_quality_score, mips_cost_score, mips_improvement_score, ...
  care_compare_overall_rating, care_compare_patient_experience, ...
  -- resolved (start with raw scores; composite tiering TBD by treasure map)
  composite_quality_score   ← simple average or weighted — refine when data science defines rules
  -- lineage
  _run_id, _updated_at
```

- [ ] `consolidated/practice_quality/build.py` — Glue job: read MIPS + Care Compare from Unified, join on NPI, write to Redshift
- [ ] Define `consolidated.quality_metrics` schema with source-specific + resolved columns
- [ ] Glue job definition in PipelineStack
- [ ] Unit tests (DuckDB — include cases where only one source has data for a given NPI)
- [ ] Integration test: Unified → Redshift (personal cloud)

**Acceptance**: `SELECT npi, mips_quality_score, care_compare_overall_rating FROM consolidated.quality_metrics LIMIT 10` returns joined data.

**Depends on**: TASK-009 (MIPS in Unified), TASK-010 (Care Compare in Unified).

**Notes**: Composite tiering (Gold/Silver/Bronze) is business logic — defer to treasure map. For now, just land the raw scores from each source.

---

### [EPIC-014] Consolidated Layer — Cost / Revenue Metrics
**Priority**: P0 Must-Have
**Phase**: 2

Load step: read Medicare Utilization from Unified Iceberg, write to `consolidated.revenue_metrics` + `consolidated.service` in Redshift.

**Data coverage caveat**: Medicare Utilization covers **Medicare fee-for-service claims only**. Patients on private insurance, Medicaid, uninsured, or Medicare Advantage are not captured. This is a partial cost signal, not full practice revenue. This is a known limitation and aligns with PRD Assumption #1 (public data sufficiency). Future data sources (e.g., commercial claims, if available) could supplement this.

- [ ] `consolidated/practice_cost/build.py` — Glue job: read Medicare Utilization from Unified, write to Redshift
- [ ] Define `consolidated.revenue_metrics` schema (per-practice cost aggregates from Medicare)
- [ ] Define `consolidated.service` schema (procedure-level detail)
- [ ] Glue job definition in PipelineStack
- [ ] Unit tests + integration tests

**Acceptance**: `SELECT npi, total_medicare_charges, total_medicare_payments FROM consolidated.revenue_metrics LIMIT 10` returns per-practice cost data.

**Depends on**: TASK-008 (Medicare Utilization in Unified).

---

### [EPIC-015] Consolidated Layer — Employer Profile (Structured Data Only)
**Priority**: P1 Should-Have
**Phase**: 2

Load step: read DOL 5500 **structured/CSV bulk data** from Unified → `consolidated.employer` in Redshift.

**Scope**: Structured fields only from DOL EFAST2 bulk download — employer name, EIN, plan type, participant count, total assets, total expenses, plan year. This is the data already ingested in TASK-011.

**Out of scope for this ticket**: DOL 5500 also has **PDF attachments** (Schedule A, Schedule C, auditor reports) containing rich financial detail — insurance carrier info, broker fees, investment breakdowns, detailed plan financials. Extracting data from these PDFs requires OCR/LLM and is tracked separately in EPIC-029.

- [ ] `consolidated/employer_profile/build.py` — Glue job: read DOL 5500 from Unified, write to Redshift
- [ ] Define `consolidated.employer` schema (structured fields: name, EIN, plan type, participant count, total assets, total expenses)
- [ ] Glue job definition in PipelineStack
- [ ] Unit tests + integration tests

**Acceptance**: `SELECT employer_name, participant_count, total_assets FROM consolidated.employer LIMIT 10` returns employer data.

**Depends on**: TASK-011 (DOL 5500 in Unified).

**Notes**: Important for the full story but demo can work with practice-side data alone. P1 because if time is tight, practice data is more critical. The structured data alone gives us a useful employer signal; PDF extraction (EPIC-029) would make it much richer.

---

### [TASK-016] Deploy Sources to Cloud (E2E Validation)
**Priority**: P0 Must-Have
**Phase**: 2

Deploy and validate each source pipeline end-to-end in dev environment. **Don't wait for all 6 — deploy each source as soon as it's ready.** This runs in parallel with source development throughout Phase 2.

Per-source checklist:
- [ ] NPPES: ingest → transform → consolidated → verify in Redshift
- [ ] PECOS: ingest → transform → consolidated → verify in Redshift
- [ ] Medicare Utilization: ingest → transform → consolidated → verify in Redshift
- [ ] MIPS: ingest → transform → consolidated → verify in Redshift
- [ ] Care Compare: ingest → transform → consolidated → verify in Redshift
- [ ] DOL 5500: ingest → transform → consolidated → verify in Redshift
- [ ] Cross-source spot checks: sample queries joining across consolidated tables

**Acceptance**: All 6 sources flow Raw → Unified → Consolidated in dev. Data verified via spot checks.

**Notes**: Could break each source into its own sub-issue if tracking per-source progress becomes useful. Keeping as checklist for now to reduce issue overhead.

---

## Phase 3: Treasure Maps + Aggregate (Apr 6 - Apr 17)

> All 3 engineers available. Focus shifts to ambiguous treasure map work + aggregate layer.

### [EPIC-017] Aggregate Layer — Market Comparison View
**Priority**: P0 Must-Have

**Phase**: 3

Pre-computed view that powers the core demo query: "compare independent practices vs hospital-affiliated by cost and quality in region X."

- [ ] `aggregate/market_comparison/build.py` (or Redshift materialized view)
- [ ] Reads from `consolidated.practice`, `consolidated.quality_metrics`, `consolidated.revenue_metrics`
- [ ] Computes: `cost_delta_vs_hospital`, `quality_delta`, `regional_markup_pct`, `opportunity_score`
- [ ] Tests

**Acceptance**: `SELECT * FROM aggregate.market_comparison WHERE region = 'MA'` returns meaningful comparison data.

**Depends on**: EPIC-012, EPIC-013, EPIC-014.

**Notes**: This is a placeholder aggregate view based on our current understanding. The exact metrics, comparisons, and schema should be confirmed with the team and may shift depending on how fast treasure maps come in — if data science delivers a treasure map that defines a better demo query, this epic adapts to serve that instead. Revisit scope when Phase 3 starts.

---

### [EPIC-018] Treasure Map Productionization (First)
**Priority**: P0 Must-Have

**Phase**: 3

Take the first validated data science notebook/script and productionize it into the pipeline.

- [ ] Receive notebook + business question description from data science team
- [ ] Identify which sources/transforms are needed
- [ ] Map to existing pipeline modules or create new consolidated/aggregate modules
- [ ] Write structured Python, add lineage, add tests
- [ ] Validate locally (DuckDB) → personal cloud → dev
- [ ] Produce demo-ready query output

**Acceptance**: The business question from the treasure map is answerable via SQL against Redshift with real data.

**Depends on**: Data science team delivers at least one validated treasure map.

**Notes**:
- **Timeline is flexible** — if a treasure map is delivered early (Mar 14 - Apr 5), this moves up and gets worked on during Phase 1-2 alongside source pipelines. Don't wait for Phase 3.
- **May require additional data sources** beyond the 6 P0 sources. Treasure maps may reference data we haven't ingested yet — if so, new ingestion tickets get created and prioritized accordingly.
- **Break into sub-issues as needed** — each treasure map is different in scope. Once we see the actual notebook/script, break this into concrete sub-tasks (new source ingestion, new consolidated module, new aggregate view, etc.).

**Risk**: If no treasure map is ready, fall back to EPIC-017 (market comparison from P0 data) as the demo output.

---

### [EPIC-019] Consolidated Layer — Practice-Employer Linkage
**Priority**: P1 Should-Have
**Phase**: 3

Geo-match practices ↔ employers using location data.

- [ ] `consolidated/practice_employer/build.py`
- [ ] Create `consolidated.practice_employer` junction table
- [ ] Geo-matching logic (zip code / county level)
- [ ] Tests

**Acceptance**: Can query "which employers are near this practice" or "which practices serve this employer's region."

**Notes**: Depends on employer data (EPIC-015). If employer consolidated is cut, this is also cut.

---

### [EPIC-020] Aggregate Layer — Practice Summary
**Priority**: P1 Should-Have
**Phase**: 3

Practice-level (organization / NPI Type 2) dashboard metrics — one row per practice with key stats. This is about practices (independent clinics, hospital-affiliated groups, PE-backed entities), not individual physicians.

- [ ] `aggregate/practice_summary/build.py`
- [ ] Combines quality + cost + profile into a single summary row per practice NPI
- [ ] Tests

**Acceptance**: `SELECT * FROM aggregate.practice_summary WHERE npi = '1234567890'` returns a complete practice snapshot.

**Notes**: `ownership_type` (independent / hospital-affiliated / PE-backed) lives in `consolidated.practice` (EPIC-012) and gets inherited here. This summary doesn't compute it — just passes it through alongside the aggregated metrics.

---

### [EPIC-021] Aggregate Layer — Employer Savings Estimates
**Priority**: P2 Nice-to-Have

**Phase**: 3

Employer overpayment estimates — compelling board story but depends on multiple P1 items.

- [ ] `aggregate/employer_savings/build.py`
- [ ] Depends on practice-employer linkage + cost data
- [ ] Tests

**Depends on**: EPIC-015, EPIC-019, EPIC-014.

**Notes**: Cut if employer-side data isn't ready. The demo can focus on practice-side comparisons.

---

### [EPIC-022] Step Functions Orchestration
**Priority**: P1 Should-Have
**Phase**: 3

Replace manual Glue job triggers with orchestrated pipeline.

- [ ] Step Function: `full_refresh` — ingest all → transform all → consolidated → aggregate
- [ ] Error handling + retry logic
- [ ] CDK additions to PipelineStack

**Acceptance**: One-click full pipeline refresh.

**Notes**: Manual triggers work fine for demo. This is about reliability and repeatability. Do if there's time, otherwise just run jobs in order manually.

---

## Phase 4: Query Interface + Demo (Apr 18 - Apr 27)

### [EPIC-023] Slack Bot — Keyword Query Interface
**Priority**: P1 Should-Have
**Phase**: 4

Simple Slack bot: keyword → parameterized SQL → Redshift → formatted result.

- [ ] AppStack CDK: Lambda + API Gateway
- [ ] Lambda handler: parse Slack event, match keyword, extract params
- [ ] Query registry: 3-5 pre-built queries (top practices, practice comparison, etc.)
- [ ] Redshift query execution + result formatting
- [ ] Deploy to Slack workspace
- [ ] `help` command listing available queries

**Acceptance**: In Slack, type "top practices in MA" → bot returns formatted results from Redshift.

**Depends on**: Aggregate layer populated (EPIC-017 minimum).

**Notes**: Moved to P1. The demo can work with direct SQL queries shown in a Redshift console or simple script. The Slack bot makes it more impressive but isn't strictly required. If time is tight, a simple Python CLI or notebook that runs the same queries is a valid fallback.

---

### [EPIC-024] Demo Preparation (Placeholder)
**Priority**: P0 Must-Have
**Phase**: 4

Placeholder ticket. Engineering doesn't demo directly — we prepare materials and support leadership to demo at the board meeting. Board papers due Apr 27. Board meeting May 5.

- [ ] Work with leadership to define demo scenarios / queries that tell the Meroka story
- [ ] Verify all demo queries return correct, meaningful results
- [ ] Prepare supporting materials (pipeline architecture diagram, data flow, sample outputs)
- [ ] Ensure demo environment is stable and data is current
- [ ] Fallback plan: if Slack bot isn't ready, prepare SQL console / notebook outputs
- [ ] Support board paper content: what was built, what it shows, what's next

**Acceptance**: Leadership can confidently demo the data platform at the board meeting. Demo environment is stable. Board papers submitted by Apr 27.

**Notes**: Scope TBD — depends on what leadership needs. Will be refined closer to the date.

---

## Phase 2-3: Continuous / Cross-Cutting

### [TASK-025] Data Quality Checks Per Source
**Priority**: P1 Should-Have
**Phase**: 2-3

Add validation checks at each pipeline layer.

- [ ] Row count assertions per source (expected range)
- [ ] Null rate checks on key columns (NPI should never be null)
- [ ] Schema match validation (columns exist, types correct)
- [ ] Log/alert on failures (CloudWatch for MVP)

**Acceptance**: Pipeline logs show validation results. Bad data is flagged, not silently loaded.

---

### [TASK-026] Sample Data Download Script
**Priority**: P1 Should-Have
**Phase**: 1-2

Script to fetch small subsets of real public data for integration test fixtures.

- [ ] `scripts/download_sample_data.sh` — download first 1000 rows from each P0 source
- [ ] Save to `tests/fixtures/sampled/`
- [ ] Document: where each source comes from, how to refresh

**Acceptance**: `./scripts/download_sample_data.sh` populates fixture directory. Integration tests can use real (sampled) data.

---

### [EPIC-027] Scheduling / Continuous Ingestion
**Priority**: P2 Nice-to-Have
**Phase**: post-MVP

Set up EventBridge rules to trigger ingestion on a schedule (weekly/monthly per source).

- [ ] EventBridge cron rules per source
- [ ] Handle "no new data available" gracefully (idempotent, skip if same version)
- [ ] Monitoring: alert if scheduled run fails

**Notes**: For MVP, manual triggers are fine. Sources update monthly/quarterly — manual is manageable. Automate post-MVP.

---

### [EPIC-028] Slack Bot with LLM Query Generation
**Priority**: P2 Nice-to-Have (Out of Scope for MVP)
**Phase**: post-MVP

Natural language → SQL via Bedrock. Separate product effort.

**Notes**: Explicitly out of scope per PRD. Listed here for backlog tracking only.

---

### [EPIC-029] DOL 5500 PDF Extraction — Exploration
**Priority**: P2 Nice-to-Have
**Phase**: post-MVP

DOL 5500 filings include **PDF attachments** (Schedule A, Schedule C, auditor reports) with rich employer financial data not available in the structured CSV bulk download. This ticket is an exploration spike to assess feasibility.

**What's in the PDFs:**
- Schedule A: insurance carrier details, premiums paid, commissions
- Schedule C: service provider fees (brokers, consultants, actuaries)
- Auditor reports: detailed plan financials
- Investment schedules: asset allocation breakdowns

**Approach options to explore:**
- [ ] Spike: download sample PDFs from DOL EFAST2, assess structure/consistency
- [ ] Evaluate extraction approaches: (a) Textract/OCR → structured parsing, (b) LLM extraction via Bedrock (send PDF pages → extract fields), (c) hybrid
- [ ] Estimate volume: how many PDFs per year? storage/compute cost?
- [ ] Assess consistency: are PDFs templated enough for reliable extraction, or too varied?
- [ ] Prototype: extract key fields from 10-20 sample PDFs, measure accuracy
- [ ] If viable: define schema for extracted fields, integrate into `consolidated.employer` or new table

**Acceptance**: Written assessment of feasibility, recommended approach, estimated effort. Go/no-go decision for productionization.

**Depends on**: EPIC-015 (structured employer data in place first).

**Notes**: This could significantly enrich the employer story (broker fees, carrier details, plan costs) but is a meaningful effort. Don't start until structured data path is working and team has bandwidth.

---

## Summary: Priority Matrix

### P0 Must-Have (Demo doesn't work without these)

| # | Issue | Phase | Depends On |
|---|---|---|---|
| 000 | Project Scaffolding & Repo Boilerplate | 0 | — |
| 001 | CDK Foundation Stack | 0 | — |
| 002 | Local Dev Harness | 0 | — |
| 003 | CI Pipeline | 0 | — |
| 004a | Shared Library — Ingestion Utilities | 1 | 002 |
| 004b | Shared Library — Transform & Warehouse Utilities | 1 | 002 |
| 005a | NPPES Ingestion (Download → Raw) | 1 | 004a |
| 005b | NPPES Transform (Raw → Unified) | 1 | 004b, 005a |
| 006 | PipelineStack CDK — Glue Jobs | 1 | 001 |
| 007 | PECOS Pipeline | 2 | 005a/005b (pattern) |
| 008 | Medicare Utilization Pipeline | 2 | 005a/005b (pattern) |
| 009 | MIPS Pipeline | 2 | 005a/005b (pattern) |
| 010 | Care Compare Pipeline | 2 | 005a/005b (pattern) |
| 011 | DOL 5500 Pipeline | 2 | 005a/005b (pattern) |
| 012 | Consolidated — Practice Profile | 2 | 005, 007 |
| 013 | Consolidated — Quality Metrics | 2 | 009, 010 |
| 014 | Consolidated — Cost/Revenue | 2 | 008 |
| 016 | E2E Cloud Validation | 2 | 007-014 |
| 017 | Aggregate — Market Comparison | 3 | 012, 013, 014 |
| 018 | Treasure Map Productionization | 1-4 (ongoing) | data science delivery |
| 024 | Demo Preparation | 4 | 017 or 018 |

### P1 Should-Have (Makes demo significantly better)

| # | Issue | Phase | Depends On |
|---|---|---|---|
| 015 | Consolidated — Employer Profile | 2 | 011 |
| 019 | Consolidated — Practice-Employer Link | 3 | 015 |
| 020 | Aggregate — Practice Summary | 3 | 012, 013, 014 |
| 022 | Step Functions Orchestration | 3 | 006 |
| 023 | Slack Bot — Keyword Query | 4 | 017 |
| 025 | Data Quality Checks | 2-3 | 007-011 |
| 026 | Sample Data Download Script | 1-2 | — |

### P2 Nice-to-Have (Cut or post-MVP)

| # | Issue | Phase | Depends On |
|---|---|---|---|
| 021 | Aggregate — Employer Savings | 3 | 015, 019 |
| 027 | Scheduling / Continuous Ingestion | post-MVP | 022 |
| 028 | Slack Bot with LLM | post-MVP | 023 |
| 029 | DOL 5500 PDF Extraction — Exploration | post-MVP | 015 |

---

## Sprint Plan

### Week 0 (Mar 10-13) — All 3 engineers
- EPIC-000: Project scaffolding & repo boilerplate (day 1)
- EPIC-001: CDK Foundation Stack (S3 + Redshift + IAM)
- EPIC-002: Local dev harness
- EPIC-003: CI pipeline

### Week 1 (Mar 14-20) — Nigel + Othman
Two parallel tracks:
- **Track A (ingestion path)**: EPIC-004a (shared ingestion utils) → EPIC-005a (NPPES ingest)
- **Track B (transform path)**: EPIC-004b (shared transform utils) → EPIC-005b (NPPES transform)
- EPIC-006: PipelineStack CDK — Glue jobs
- TASK-026: Sample data download script
- EPIC-018: Treasure map productionization (potential — if data science delivers early)

### Weeks 2-3 (Mar 21 - Apr 5) — Nigel + Othman
- TASK-007 through TASK-011: remaining 5 source pipelines (follow NPPES pattern)
- EPIC-012, 013, 014: consolidated layer joins
- TASK-016: E2E cloud validation
- EPIC-018: Treasure map productionization (potential — as treasure maps arrive)

### Weeks 4-5 (Apr 6-17) — All 3 engineers
- EPIC-017: Aggregate — market comparison
- EPIC-018: Treasure map productionization (potential — continue as treasure maps arrive)
- EPIC-015: Consolidated — employer profile
- EPIC-019: Consolidated — practice-employer linkage
- EPIC-020: Aggregate — practice summary
- TASK-025: Data quality checks

### Weeks 6-7 (Apr 18-27) — All 3 engineers
- EPIC-024: Demo preparation + board papers
- EPIC-018: Treasure map productionization (potential — final push)
- EPIC-023: Slack bot (if time)
- EPIC-022: Step Functions orchestration (if time)
- Demo rehearsal
