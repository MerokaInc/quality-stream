# M-Alpha Data Platform — Technical Design

## Document Information

- **Title**: M-Alpha Data Platform — Technical Design
- **Author**: Junjian Li
- **Date**: 2026-03-09
- **Version**: 1.0
- **Status**: Draft
- **Reviewers**: Nigel, Othman
- **Parent Document**: [M-Alpha Data Platform — MVP PRD](./2026-03-09-m-alpha-data-platform-prd.md)

---

## 1. Repository Structure

The data platform lives in a **new dedicated repo** (`m-alpha-data`), separate from the existing m-alpha serving layer (FastAPI + Next.js). This is a monorepo scoped to data platform concerns.

> **Note**: The team is open to consolidating into a single monorepo with the serving layer in the future. For MVP, separation keeps deployment cycles and ownership boundaries clean.

```
m-alpha-data/
├── infra/
│   └── cdk/                         # AWS CDK stacks (Python)
│       ├── app.py                   # CDK app entry point
│       ├── stacks/
│       │   ├── foundation.py        # FoundationStack: S3, Redshift, IAM
│       │   ├── pipeline.py          # PipelineStack: Glue jobs, Step Functions
│       │   └── app.py               # AppStack: Slack bot infra (Bedrock, Lambda)
│       └── config/
│           └── environments.py      # Per-env config (dev, prod, {engineer}-*)
├── pipeline/
│   ├── base/                        # Shared library (malpha_common)
│   │   ├── pyproject.toml
│   │   ├── malpha_common/
│   │   │   ├── s3.py               # S3 read/write helpers
│   │   │   ├── iceberg.py          # Iceberg table read/write
│   │   │   ├── redshift.py         # Redshift connection + load
│   │   │   ├── lineage.py          # source_version_id, run_id tagging
│   │   │   ├── validation.py       # Schema checks, null rates, row counts
│   │   │   ├── manifest.py         # Source manifest read/write
│   │   │   └── transforms.py       # Common: dedup, type casting, NPI normalization
│   │   └── ...
│   ├── sources/                     # Source-driven: one module per data source
│   │   ├── nppes/
│   │   │   ├── ingest.py           # Download → Raw (S3)
│   │   │   ├── transform.py        # Raw → Unified (Iceberg)
│   │   │   └── schema.py           # Iceberg schema definition
│   │   ├── pecos/
│   │   ├── medicare_util/
│   │   ├── mips/
│   │   ├── care_compare/
│   │   └── dol_5500/
│   ├── consolidated/                # Goal-driven: cross-source joins → Redshift
│   │   ├── practice_profile/        # NPPES + PECOS → PRACTICE + PROVIDER
│   │   ├── practice_quality/        # MIPS + Care Compare → QUALITY_METRICS
│   │   ├── practice_cost/           # Medicare Util → REVENUE_METRICS, SERVICE
│   │   ├── employer_profile/        # DOL 5500 → EMPLOYER
│   │   └── practice_employer/       # Geo-match practices ↔ employers
│   └── aggregate/                   # Goal-driven: pre-computed rollups → Redshift
│       ├── market_comparison/       # Cost delta, quality delta, opportunity score
│       ├── provider_summary/        # Practice-level dashboard metrics
│       └── employer_savings/        # Employer overpayment estimates
├── app/
│   └── slackbot/                    # Slack bot / query interface
├── tests/
│   ├── fixtures/                    # Sample data
│   │   ├── handcrafted/            # Small, controlled edge-case data (unit tests)
│   │   │   ├── nppes_sample.csv
│   │   │   └── ...
│   │   └── sampled/                # Subsets of real public data (integration tests)
│   │       ├── nppes_1000.csv
│   │       └── ...
│   ├── unit/                        # Transform logic in isolation
│   │   ├── test_nppes_transform.py
│   │   └── ...
│   ├── integration/                 # Full source pipeline against DuckDB
│   │   ├── test_nppes_pipeline.py
│   │   └── ...
│   └── conftest.py                  # DuckDB setup, temp tables, shared helpers
├── scripts/                         # Dev helpers
│   ├── setup_local.sh              # Install deps, DuckDB setup
│   └── download_sample_data.sh     # Fetch small subsets of real data for fixtures
├── docs/
│   └── ...
├── Makefile                         # Dev commands
├── pyproject.toml                   # Root project config
└── README.md
```

### Consolidated & Aggregate: Goal-Driven, Not Source-Driven

The `sources/` directory is organized by data source — each source follows the same pattern (`ingest.py`, `transform.py`, `schema.py`). This makes onboarding a new source predictable: copy a folder, implement 3 files.

The `consolidated/` and `aggregate/` directories are organized by **business goal** — each module answers a specific question or produces a specific entity. These modules pull from multiple unified sources and will evolve as the data science team validates new treasure maps. New modules get added per validated business question.

---

## 2. CDK Stack Structure

Stacks are split by **change frequency**, not by individual resource type.

### FoundationStack (rarely changes)

Resources that are provisioned once and rarely modified:

- **S3 Buckets**: `malpha-raw-{env}`, `malpha-unified-{env}`
- **Redshift Serverless**: namespace, workgroup, `consolidated` and `aggregate` schemas
- **IAM Roles**: Glue execution role, Redshift access role, Lambda execution role
- **Secrets Manager**: Redshift credentials
- **VPC** (if needed for Redshift private access)

### PipelineStack (changes often)

Resources that change as we add/modify data sources:

- **Glue Jobs**: one per source ingestion + transform, plus consolidated/aggregate jobs
- **Glue Catalog**: Iceberg table definitions
- **Step Functions** (post-MVP): orchestration state machines
- **S3 upload of shared library wheel** (`malpha_common`)
- **EventBridge rules** (post-MVP): scheduled triggers

### AppStack (last priority)

- **Lambda**: Slack bot webhook handler
- **Bedrock**: model access for LLM query generation (stretch)
- **API Gateway**: Slack webhook endpoint

### Per-Engineer Environments

CDK config supports environment prefixes:

```python
# infra/cdk/config/environments.py
ENVIRONMENTS = {
    "dev":    {"prefix": "malpha-dev"},
    "prod":   {"prefix": "malpha-prod"},
    # Per-engineer environments
    "ng":     {"prefix": "ng-malpha"},      # Nigel
    "ot":     {"prefix": "ot-malpha"},      # Othman
    "jj":     {"prefix": "jj-malpha"},      # Junjian
}
```

Deploy to personal environment: `cdk deploy --context env=ng`

All stacks use the prefix, so Nigel gets `ng-malpha-raw`, `ng-malpha-unified`, etc. Tear down with `cdk destroy --context env=ng`.

### Why Redshift Serverless

For MVP, we use **Redshift Serverless** rather than provisioned because:
- Pay-per-query — no cost when idle during development
- Auto-scales — no capacity planning needed
- No cluster management overhead for a 2-person engineering team
- Easy to switch to provisioned later if query volume becomes predictable and cost-optimizable

---

## 3. S3 Bucket Layout & Data Partitioning

### Buckets

One bucket per data layer for clean security boundaries, lifecycle management, and cost visibility:

```
s3://malpha-raw-{env}/          # Immutable original files
s3://malpha-unified-{env}/      # Iceberg tables (cleaned, per-source)
```

Consolidated and Aggregate layers live in **Redshift**, not S3.

### Raw Layer Partitioning

**Key structure**: `{source}/{source_version}/{ingestion_date}/`

```
s3://malpha-raw-dev/
├── nppes/
│   ├── v202603/
│   │   └── 2026-03-12/
│   │       └── nppes_full.csv
│   └── v202604/
│       └── 2026-04-10/
│           └── nppes_full.csv
├── dol_5500/
│   ├── fy2024/
│   │   └── 2026-03-15/
│   │       └── f_5500_2024.csv
│   └── ...
└── practice_websites/              # Unversioned / web scraping
    └── snap-2026-03-12/
        └── 2026-03-12/
            └── results.json
```

#### Design Decision: Why `{source_version}/{ingestion_date}` and not `{ingestion_date}/{source_version}`?

We chose **source version first** because:

1. **Reprocessing is version-driven**: When we need to re-run a pipeline for a specific data release (e.g., "reprocess NPPES March 2026"), the path is a direct prefix scan — no need to search across ingestion dates.
2. **Manifest points to versions**: The source manifest tracks which version is latest. Version-first makes the lookup a direct path.
3. **Multiple ingestion dates per version**: If the same version is re-downloaded (retry, re-import), both attempts live under the same version folder. The latest ingestion date is the one that gets processed.

#### Versioned vs. Snapshot Sources

Not all sources have formal release versions. Web scraping, Google Business data, and similar sources are **point-in-time snapshots** where the ingestion date is the only versioning mechanism.

The manifest distinguishes these:

```json
{
  "source": "nppes",
  "versioning": "release",
  "latest_version": "v202603",
  "latest_ingestion": "2026-03-12",
  "history": [
    {"version": "v202603", "ingested": "2026-03-12", "status": "active"},
    {"version": "v202602", "ingested": "2026-02-10", "status": "superseded"}
  ]
}
```

```json
{
  "source": "practice_websites",
  "versioning": "snapshot",
  "latest_version": "snap-2026-03-12",
  "latest_ingestion": "2026-03-12",
  "history": [
    {"version": "snap-2026-03-12", "ingested": "2026-03-12", "status": "active"},
    {"version": "snap-2026-02-15", "ingested": "2026-02-15", "status": "superseded"}
  ]
}
```

Pipeline logic is identical for both — it reads the manifest, picks `latest_version`, and processes that path. The `versioning` field is metadata for humans and future automation.

### Manifest: Generation, Storage, and Update

The manifest is a JSON file stored alongside the source data in the Raw bucket:

```
s3://malpha-raw-{env}/{source}/_manifest.json
```

**Who writes it**: The `ingest.py` script for each source. The manifest is updated as the last step of every ingestion run.

**How `source_version` is determined**: Each source's `ingest.py` is responsible for extracting the version from the source. This is source-specific logic:

| Source | How version is determined |
|---|---|
| NPPES | Filename contains release date (e.g., `npidata_pfile_20260301-20260331.csv` → `v202603`) |
| PECOS | File header or download page metadata contains quarter (e.g., `2026Q1`) |
| Medicare Utilization | Dataset is annual, year is in the filename or URL (e.g., `cy2024`) |
| MIPS | Performance year in the filename (e.g., `py2024`) |
| Care Compare | Download page shows last refresh date (e.g., `refresh-2026-02`) |
| DOL Form 5500 | Filing year in the dataset (e.g., `fy2024`) |
| Web scraping (future) | No formal version — uses `snap-{ingestion_date}` |

**Update flow**:

```
ingest.py runs:
  1. Download source data
  2. Determine source_version (source-specific logic)
  3. Write data to s3://malpha-raw-{env}/{source}/{source_version}/{ingestion_date}/
  4. Read current _manifest.json (or create if first run)
  5. Check: is this source_version already in history?
     - If new version: add to history, set as latest, mark previous as "superseded"
     - If same version re-downloaded: add new ingestion_date under existing version entry
  6. Write updated _manifest.json back to S3
```

**Concurrency safety**: For MVP, ingestion runs are manual/sequential — no concurrent writes to the same manifest. Post-MVP, if we add parallel ingestion, we can use S3 conditional writes or a DynamoDB lock.

**The `malpha_common.manifest` module** provides shared helpers:

```python
# pipeline/base/malpha_common/manifest.py
def read_manifest(source: str, env: str) -> dict
def update_manifest(source: str, env: str, version: str, ingestion_date: str) -> dict
def get_latest_version(source: str, env: str) -> tuple[str, str]  # (version, ingestion_date)
```

Transform scripts (`transform.py`) call `get_latest_version()` to know which raw data to process.

### Raw Layer Lifecycle

- **No deletion** — Raw is the permanent, immutable archive and source of truth.
- **S3 Intelligent-Tiering** on the raw bucket: automatically moves infrequently accessed data to cheaper storage tiers.
- Old versions naturally become cold storage without manual intervention.

---

## 4. Unified Layer (Iceberg)

### Design

One Iceberg table per source in `s3://malpha-unified-{env}/`. Tables are registered in the **Glue Catalog** for Athena access.

Each table contains the **latest version only** of the source data, cleaned and standardized.

#### Design Decision: Why latest-only instead of keeping all versions?

1. **Raw is the permanent archive** — all historical versions are preserved in the raw bucket and can be reprocessed at any time.
2. **Keeps tables small and queries fast** — NPPES is ~9GB per release. Keeping 12 months of versions would be ~108GB for one source, with no query benefit for downstream layers.
3. **Simpler downstream logic** — Consolidated and Aggregate layers don't need `WHERE source_version = latest` on every query.
4. **Iceberg time-travel covers rollback** — if a bad version is ingested, we can revert to a previous Iceberg snapshot within the retention window.
5. **Reprocessing from Raw is the intended recovery path** — for anything beyond the retention window, re-run the pipeline from the raw file. This also ensures the latest pipeline code is applied.

#### Snapshot Expiration

- **90-day retention** for Iceberg snapshots.
- Within 90 days: time-travel to any previous snapshot (e.g., rollback a bad ingestion).
- Beyond 90 days: reprocess from Raw.
- This is configured per-table in the Iceberg table properties.

### Schema Convention

Every Unified table includes standard lineage columns alongside source-specific columns:

```
| Column              | Type      | Description                                    |
|---------------------|-----------|------------------------------------------------|
| ...source columns   | varies    | Cleaned, typed columns from the raw data       |
| _source_version_id  | string    | Source release version (e.g., "v202603")        |
| _run_id             | string    | Pipeline run identifier (UUID)                 |
| _ingested_at        | timestamp | When this row was written to Unified           |
```

### Athena Access

Unified tables are queryable via **Athena** for ad-hoc exploration. This is primarily for:
- Data science team exploring cleaned data before writing business logic
- Engineers debugging pipeline issues
- Ad-hoc analysis that doesn't need Redshift performance

---

## 5. Redshift Schema Design

### Schemas

Two schemas in the same Redshift Serverless database:

- **`consolidated`** — detailed granularity, joined across sources, hub-and-spoke around PRACTICE (NPI)
- **`aggregate`** — pre-computed metrics, optimized for querying and serving

### Consolidated Schema (Starting Point)

Based on the ER diagram's 16-entity model. This will evolve as the data science team validates treasure maps.

**Hub Entity:**

```sql
-- consolidated.practice
CREATE TABLE consolidated.practice (
    npi                 VARCHAR(10) PRIMARY KEY,
    practice_name       VARCHAR(255),
    address             VARCHAR(500),
    phone               VARCHAR(20),
    specialty           VARCHAR(255),
    taxonomy_code       VARCHAR(20),
    website_url         VARCHAR(500),
    legal_entity_name   VARCHAR(255),
    -- lineage
    _run_id             VARCHAR(36),
    _updated_at         TIMESTAMP DEFAULT GETDATE()
);
```

**Spoke Entities (examples):**

```sql
-- consolidated.provider
CREATE TABLE consolidated.provider (
    provider_id         INT IDENTITY PRIMARY KEY,
    npi                 VARCHAR(10) REFERENCES consolidated.practice(npi),
    name                VARCHAR(255),
    credentials         VARCHAR(100),
    reassignment_org    VARCHAR(255),
    _run_id             VARCHAR(36),
    _updated_at         TIMESTAMP DEFAULT GETDATE()
);

-- consolidated.quality_metrics
CREATE TABLE consolidated.quality_metrics (
    id                  INT IDENTITY PRIMARY KEY,
    npi                 VARCHAR(10) REFERENCES consolidated.practice(npi),
    mips_quality_score  DECIMAL(5,2),
    mips_cost_score     DECIMAL(5,2),
    facility_quality    VARCHAR(50),
    composite_quality_tier VARCHAR(10),  -- Gold/Silver/Bronze (derived)
    _run_id             VARCHAR(36),
    _updated_at         TIMESTAMP DEFAULT GETDATE()
);

-- consolidated.employer
CREATE TABLE consolidated.employer (
    employer_id         INT IDENTITY PRIMARY KEY,
    name                VARCHAR(255),
    employer_benefit_cost DECIMAL(15,2),
    market_concentration  DECIMAL(5,4),
    est_overpayment     DECIMAL(15,2),  -- derived
    _run_id             VARCHAR(36),
    _updated_at         TIMESTAMP DEFAULT GETDATE()
);
```

Full schema will be detailed per entity as pipeline code is written. The ER diagram (16 entities) serves as the reference starting point.

### Aggregate Schema (Examples)

```sql
-- aggregate.market_comparison
CREATE TABLE aggregate.market_comparison (
    npi                     VARCHAR(10),
    practice_name           VARCHAR(255),
    specialty               VARCHAR(255),
    region                  VARCHAR(100),
    cost_delta_vs_hospital  DECIMAL(15,2),
    quality_delta           DECIMAL(5,2),
    regional_markup_pct     DECIMAL(5,2),
    opportunity_score       DECIMAL(5,2),  -- derived composite
    _run_id                 VARCHAR(36),
    _updated_at             TIMESTAMP DEFAULT GETDATE()
);

-- aggregate.provider_summary
-- aggregate.employer_savings
-- (defined as treasure maps are validated)
```

### Why Both Layers in Redshift

Having both Consolidated (detailed) and Aggregate (rollups) in Redshift means:
- The Slack bot / query interface hits **one system** for any question — detailed or summarized
- No need to route queries between Athena (for detail) and Redshift (for aggregates)
- Consolidated enables ad-hoc deep dives; Aggregate enables fast dashboard-style queries
- Same cluster, different schemas — no additional cost

---

## 6. Shared Library (`malpha_common`)

### Why a Shared Library?

Multiple pipeline jobs (ingestion, transform, consolidated, aggregate) need the same utilities — S3 path construction, Iceberg read/write, lineage tagging, manifest management, validation, etc. Without a shared library, this logic gets copy-pasted across Glue jobs and diverges over time.

**The AWS Glue constraint**: Glue jobs run in a managed Spark/Python environment on AWS — not on our machines. They don't have access to our repo's local modules. The only way to share custom Python code across Glue jobs is to:

1. Package it as a `.whl` (wheel) file
2. Upload the wheel to S3
3. Reference it in each Glue job's `--extra-py-files` parameter

This is an AWS Glue requirement, not a preference. CDK automates steps 1-2 on every deploy so engineers don't have to think about it.

### Package Structure

`pipeline/base/` is a Python package called `malpha_common` with its own `pyproject.toml`.

**What goes in it** (keep it thin):
- S3 read/write helpers (path construction, multipart upload)
- Iceberg table read/write (via PyIceberg or Glue Iceberg connector)
- Redshift connection + COPY/LOAD helpers
- Lineage tagging (`run_id` generation, `source_version_id` propagation)
- Schema validation (column checks, null rate assertions, row count assertions)
- Manifest read/write (source version tracking)
- Common transforms (dedup, type casting, NPI normalization, date parsing)

**What stays out** (in source/consolidated/aggregate modules):
- Source-specific download logic
- Source-specific schema definitions
- Business logic (joins, scoring, derived fields)

### Local Development

```bash
pip install -e ./pipeline/base    # editable install for local dev
```

Transform functions work against DuckDB locally — no AWS dependency.

### Glue Deployment

CDK automates the build + upload:

1. `cdk deploy` triggers a build step
2. Builds `malpha_common` wheel (`malpha_common-x.x.x-py3-none-any.whl`)
3. Uploads to `s3://malpha-unified-{env}/_libs/malpha_common-x.x.x.whl`
4. Glue jobs reference via `--extra-py-files` parameter

The shared package is kept thin to minimize rebuild frequency. Most changes happen in source-specific or consolidated modules, which are deployed as part of the Glue job script itself — not the shared library.

---

## 7. Pipeline Patterns

### Per-Source Pipeline (Sources → Unified)

Each source follows the same 3-step pattern:

```
ingest.py     →   Download from public source → write to Raw (S3)
transform.py  →   Read from Raw → clean, type, dedup → write to Unified (Iceberg)
schema.py     →   Iceberg schema definition + validation rules
```

**Ingest** (`sources/{name}/ingest.py`):
- Downloads data from public API or URL
- Determines `source_version` (from file metadata, content, or naming convention)
- Writes to `s3://malpha-raw-{env}/{source}/{source_version}/{ingestion_date}/`
- Updates source manifest
- Idempotent: if the same version+date already exists, skip or overwrite

**Transform** (`sources/{name}/transform.py`):
- Reads manifest to find latest version
- Reads raw file from S3
- Applies cleaning: type casting, null handling, dedup, NPI normalization
- Adds lineage columns (`_source_version_id`, `_run_id`, `_ingested_at`)
- Writes to Unified Iceberg table (overwrite/replace — latest version only)
- Runs validation checks (row count, null rates, schema match)

**Schema** (`sources/{name}/schema.py`):
- Defines the Iceberg schema (column names, types)
- Defines validation rules (required columns, allowed null rates, expected row count ranges)

### Consolidated Pipeline (Unified → Redshift)

Each consolidated module reads from one or more Unified Iceberg tables and writes to `consolidated.*` in Redshift.

```python
# consolidated/practice_profile/build.py
# Reads: unified.nppes + unified.pecos
# Writes: consolidated.practice + consolidated.provider
```

These are goal-driven — the module knows which sources it needs and how to join them. The join logic is the business logic that comes from validated treasure maps.

### Aggregate Pipeline (Consolidated → Aggregate)

Aggregate modules read from `consolidated.*` and write to `aggregate.*` in Redshift. These can be:
- Redshift SQL views or materialized views (simplest)
- Python scripts for complex derivations (opportunity scores, composite tiers)

### Orchestration

**MVP**: Each pipeline step is triggered manually or via simple schedule (EventBridge cron → Glue job). No cross-source dependencies enforced.

**Post-MVP**: AWS Step Functions orchestrate the full flow:

```
Step Function: "full_refresh"
├── Parallel: Ingest all P0 sources
├── Parallel: Transform all P0 sources (after ingest)
├── Sequential: Build consolidated entities (after all transforms)
└── Sequential: Build aggregate views (after consolidated)
```

Step Functions provide visibility (execution history, error tracking) and handle retries.

---

## 8. Environment Strategy

### Four Tiers

| Tier | Purpose | Infra | Data |
|---|---|---|---|
| **Local** | Unit + fast integration tests | DuckDB (in-memory) | Hand-crafted fixtures + sampled real data |
| **Personal cloud** | E2E pipeline testing | `{engineer}-malpha-*` (own S3, Redshift, Glue) | Real data, small subset or full |
| **Dev** | Shared integration environment | `malpha-dev-*` | Real data, full |
| **Prod** | Production | `malpha-prod-*` | Real data, full |

### Local Development

```bash
make setup          # Install deps, pip install -e ./pipeline/base
make test           # Run unit + integration tests against DuckDB
make test-unit      # Unit tests only
make test-integ     # Integration tests only (DuckDB)
```

- **DuckDB** replaces all AWS dependencies locally
- `conftest.py` creates in-memory DuckDB, loads fixtures, provides test helpers
- Unit tests: individual transform functions against hand-crafted data (10-20 rows, explicit edge cases)
- Integration tests: full source pipeline against sampled real data (~1000 rows from actual public datasets)
- All test data is from public government sources — no PII concerns

### Personal Cloud

Each engineer gets their own isolated AWS environment:

```bash
cdk deploy --context env=ng     # Deploy Nigel's environment
cdk destroy --context env=ng    # Tear down when done
```

Creates: `ng-malpha-raw`, `ng-malpha-unified`, Redshift namespace `ng_malpha`, Glue jobs prefixed `ng-malpha-*`.

Used for:
- Testing Glue jobs against real AWS services
- E2E pipeline validation before merging to dev
- Debugging issues that only reproduce in cloud

**Cost control**: personal environments use minimal Redshift RPU, tear down after use.

### Dev → Prod Promotion

- Merge to `main` → manual `cdk deploy --context env=dev`
- Validate in dev → manual `cdk deploy --context env=prod`
- Post-MVP: automate dev deployment on merge, keep prod manual

---

## 9. CI/CD Pipeline

### GitHub Actions (MVP)

```yaml
# .github/workflows/ci.yml
on:
  pull_request:
    branches: [main]

jobs:
  lint:
    # ruff check + ruff format --check

  test:
    # pip install -e ./pipeline/base
    # pytest tests/unit tests/integration
    # (DuckDB, no AWS credentials needed)

  cdk-synth:
    # cd infra/cdk && cdk synth
    # Validates CDK code produces valid CloudFormation
    # No AWS credentials needed
```

**What runs on every PR:**
1. **Lint** (ruff) — code formatting and style
2. **Unit + integration tests** (pytest + DuckDB) — pipeline logic correctness
3. **CDK synth** — infrastructure code validity

**Deployment**: manual for MVP (`cdk deploy` by engineer after merge).

### Why Manual Deploy for MVP

- 2 engineers — coordination overhead is low
- Deployment errors are easier to debug interactively
- Avoids setting up AWS credentials in CI for deployment
- CDK synth in CI catches infra issues early; actual deploy is the last step

---

## 10. Data Science Handoff Workflow

### The Problem

The data science team (business-side, not engineering background) produces notebooks and scripts to validate business questions. These scripts work but are rough: hardcoded paths, local-only dependencies, no error handling. Engineering needs to productionize these into the pipeline.

### The Process

```
1. Data science team                2. Engineering review
   ├── Jupyter notebook or          ├── Identify sources used
   │   Python script                ├── Identify transforms needed
   ├── Works on their machine       ├── Map to existing pipeline
   ├── Answers a business question  │   modules or create new ones
   └── Documents the logic          └── Estimate effort

3. Productionize                    4. Validate
   ├── Write structured Python      ├── Unit test against fixtures
   │   in pipeline/ modules         ├── Integration test (DuckDB)
   ├── Add to source/consolidated/  ├── E2E in personal cloud
   │   aggregate as appropriate     └── Deploy to dev
   ├── Add lineage + validation
   └── Add tests                    5. Ship
                                       └── Deploy to prod
```

### What Engineering Needs from Data Science

- The notebook/script itself
- A description of the business question being answered
- Which data sources were used (and where they got them)
- The expected output (what does the answer look like?)
- Any assumptions or caveats

### What Engineering Does NOT Expect

- Clean code
- Environment management
- Error handling
- Performance optimization
- Tests

Engineering handles all of that during productionization.

---

## 11. Slack Bot Design (Last Priority in MVP)

### Architecture

```
Slack Event → API Gateway → Lambda → Redshift → formatted results → Slack
```

No AI/LLM involved. This is a simple keyword-to-SQL lookup.

### How It Works

The bot maintains a **query registry** — a mapping of keywords to parameterized SQL queries. When a user sends a message, the bot matches it to a known query, fills in parameters, runs it against Redshift, and returns formatted results.

```
User: "top practices in MA by quality"
Bot:  → matches keyword "top practices"
      → extracts parameter: region = "MA"
      → runs: SELECT * FROM aggregate.provider_summary
               WHERE region = 'MA' ORDER BY composite_quality_tier LIMIT 20
      → formats and returns results as a Slack message
```

### Query Registry

```python
QUERIES = {
    "top practices": {
        "sql": "SELECT ... FROM aggregate.provider_summary WHERE region = %(region)s ...",
        "params": ["region"],
        "description": "Top practices by quality score in a region"
    },
    "employer savings": {
        "sql": "SELECT ... FROM aggregate.employer_savings WHERE ...",
        "params": ["employer_name"],
        "description": "Estimated savings for an employer"
    },
    # ... add as treasure maps are validated
}
```

New queries are added to the registry as treasure maps get productionized. The bot also supports a `help` command that lists all available queries.

### Out of Scope: LLM-Powered Query Agent

An LLM agent that generates SQL from natural language (e.g., via AWS Bedrock) is a **dedicated product effort** with its own design considerations (prompt engineering, guardrails, hallucination handling, schema context management). It will be scoped in a separate PRD once the data platform and warehouse are stable.

---

## 12. Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Repo structure | New repo (`m-alpha-data`) | Separate deployment cycles from serving layer; open to merging later |
| IaC | AWS CDK (Python) | Same language as pipeline code; better per-engineer env support than Terraform |
| CDK stack split | By change frequency (Foundation / Pipeline / App) | Foundation rarely changes; pipeline changes with every new source |
| S3 buckets | One per layer | Clean security boundaries, lifecycle management, cost visibility |
| Raw partitioning | `{source}/{source_version}/{ingestion_date}/` | Version-first enables direct reprocessing; manifest tracks latest |
| Versioned vs. snapshot | `release` for structured sources, `snapshot` for scraping | Unified model with manifest distinguishing the two |
| Unified layer | Iceberg, latest version only, 90-day snapshot expiration | Raw is permanent archive; Unified is current clean truth; avoids unbounded table growth |
| Warehouse | Redshift Serverless | Pay-per-query for MVP; no idle cost; easy to switch to provisioned later |
| Redshift schemas | `consolidated` + `aggregate` in same database | One system for all query types; no routing complexity |
| Pipeline structure | Source-driven for ingestion, goal-driven for consolidated/aggregate | Sources are predictable patterns; business logic is organized by question, not by source |
| Shared library | Thin `malpha_common` wheel, CDK uploads to S3 for Glue | Minimizes rebuild frequency; local dev via `pip install -e` |
| Orchestration | Manual/scheduled triggers for MVP; Step Functions post-MVP | Start simple; add orchestration as dependencies grow |
| Local dev | DuckDB in-memory | Fast, no AWS dependency, supports Iceberg reads |
| Test fixtures | Hand-crafted (unit) + sampled real data (integration) | All P0 sources are public government data — no PII concern |
| CI | GitHub Actions: lint, pytest, CDK synth | Safety checks automated; deployment manual for MVP |
| Slack bot | Pre-built keyword-to-SQL queries (no LLM) | Simple, reliable for demo; LLM agent is a separate product effort |

---

## References

1. [M-Alpha Data Platform — MVP PRD](./2026-03-09-m-alpha-data-platform-prd.md)
2. [Meroka Modular Care Marketplace Plan — Offsite March 2026](https://docs.google.com/document/d/1_I52QXFnYKwqvcU7mQwiKqlP0bUFLpfxabP4HoQWDsI/edit?tab=t.0)
3. [Modular Care Package](https://docs.google.com/document/d/1BekCsCn40l9__tEBhbFT_4Fz90YkvJnr1EKyOMC10vE/edit?tab=t.0)
4. [Meroka Wireframe (data source mapping)](https://playground-six-pi.vercel.app/meroka-wireframe-v2.html)
5. [M-Alpha ER Diagram](https://github.com/MerokaInc/m-alpha/blob/main/er-deploy/index.html)
6. [Existing m-alpha data architecture doc](https://github.com/MerokaInc/m-alpha/blob/main/docs/data-architecture.md)
