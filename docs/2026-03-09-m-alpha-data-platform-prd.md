# M-Alpha Data Platform — MVP PRD

## Document Information

- **Title**: M-Alpha Data Platform — MVP PRD
- **Author**: Junjian Li
- **Date**: 2026-03-09
- **Version**: 1.0
- **Status**: Draft
- **Reviewers**: Nigel, Othman
- **Stakeholders**: Engineering, Data Science Team, Leadership

## Executive Summary

M-Alpha is Meroka's data platform that ingests public healthcare and employer data, transforms it through progressively refined layers, and serves it from a queryable warehouse. It is the data foundation that powers Meroka's modular care marketplace — enabling cost/quality models for independent practices and employers. This PRD scopes the MVP: a production-grade data pipeline with six P0 data sources, a four-layer architecture (Raw → Unified → Consolidated → Aggregate), and a query interface for the May 5 board demo.

---

## Assumptions

This PRD and the MVP scope are built on the following assumptions. These are being validated in parallel by the data science team and are **not in scope** for this document to prove.

1. **Public data sufficiency**: Publicly available datasets (CMS, DOL, HRSA, etc.) provide enough signal to build meaningful quality, cost, and provider classification models — without requiring private claims or financial data from customers.
2. **Independent practice value hypothesis**: Independent practices deliver comparable or better care at lower cost than hospital-affiliated or PE-backed practices. This is the core business thesis Meroka is testing.
3. **Employer willingness**: Employers (particularly self-funded) are motivated to explore direct contracting with independent practices as an alternative to traditional insurance networks.
4. **Data science will validate business logic**: A separate team is actively working on "treasure maps" — defining which data points matter, how to combine them, and what outputs are meaningful. This PRD assumes at least one treasure map will be validated and ready to productionize by mid-April.
5. **NPI as universal key**: The National Provider Identifier (NPI) is a reliable primary key for linking provider/practice data across sources.
6. **Modular care packages are viable**: Healthcare services can be bundled into discrete, priceable packages — starting with conditions that are easiest to bundle (well-person, dental, joint pain, hernia, etc.)

---

## Problem Statement

### What is the problem?

Meroka aims to create a marketplace connecting independent practices with employers for direct healthcare contracting. To power this marketplace, we need a **data foundation** that can ingest diverse public data sources, transform them into a unified queryable warehouse, and output cost/quality models — but no such platform exists today. The current state is a working POC (Medicaid procedure markup analysis) that was an intentional first step to validate the end-to-end serving pattern. To evolve into the full data platform, multi-source ingestion, scalable ETL, and a production warehouse need to be built.

### Why is this problem important?

Without a production-grade data platform, every business question requires manual, one-off analysis. The data science team cannot validate assumptions at scale, and validated insights cannot be operationalized into a product. The May 5 board meeting requires a credible working prototype — not mockups.

### Who is affected?

- **Data science team**: Needs a platform to operationalize their validated business logic
- **Engineering team**: Needs clear architecture to build against
- **Leadership/Board**: Needs a demonstrable prototype by May 5

---

## Context and Background

### Current State

The m-alpha repository contains a **working POC**: a FastAPI backend + Next.js frontend serving Medicaid procedure markup charts. This was an intentional first step to validate the end-to-end serving pattern (Bronze → Silver → Gold → API → UI) and successfully demonstrates the concept. To evolve into the full data platform, the following capabilities need to be added:

- **Real data ingestion pipeline** — currently only a manually seeded CSV
- **ETL automation** — Glue jobs replacing seed scripts
- **Multi-source support** — expanding beyond a single dataset
- **CDK infrastructure** — migrating from Terraform for reproducible per-engineer environments
- **Production warehouse** — Redshift replacing the local Postgres stand-in

### Supporting Artifacts

| Artifact | What it tells us | Confidence |
|---|---|---|
| Meroka Wireframe | 30+ public data sources identified, 70+ fields mapped, data flow sketched | Medium — high-level, not validated |
| ER Diagram (er-deploy) | 16-entity hub-and-spoke schema around PRACTICE (NPI), medallion layers | Medium — good starting point, will evolve |
| Modular Care Package doc | Conditions ranked by bundling ease, competitive landscape, market sizing | High — solid research |
| Offsite Meeting Notes | 60-day sprint plan, team roles, operating model, treasure map approach | High — team-aligned |
| Existing m-alpha code | Serving layer skeleton (API + UI), Docker local dev, Cognito auth | High — working code |

### Business Context

Meroka is building a marketplace where employers pay less for better care and independent practices earn more. This data platform is the **engine underneath** — it doesn't build the marketplace or define modular care packages, but nothing works without it. The data science team is validating the business logic (treasure maps); this platform operationalizes whatever they prove.

### Hard Deadline

**May 5 board meeting** — real working prototype, not mockups. Board papers go out ~April 27, so the demo-ready state needs to be achieved by then. With team constraints, this is effectively ~45 working days from the March offsite, meaning ~30 days remain from now (March 9).

---

## Requirements

### Functional Requirements

**Data Ingestion**
- [ ] Ingest P0 data sources: NPPES, PECOS, Medicare Utilization, MIPS, Care Compare, DOL Form 5500
- [ ] Support structured formats (CSV, JSON, tab-delimited) with a clear path to add new sources
- [ ] Store raw data immutably in Raw layer (S3) in original format
- [ ] Each ingestion run is idempotent — re-running produces the same result without duplicates

**ETL / Transformation**
- [ ] Convert raw data to Iceberg format at the Unified layer (detailed granularity)
- [ ] Join and enrich across sources at the Consolidated layer (business-level entities)
- [ ] Pre-compute serving metrics at the Aggregate layer (Redshift)
- [ ] Every record maintains lineage: `source_version_id`, `run_id`, traceable back to raw
- [ ] Pipeline logic is structured, testable Python — not notebooks

**Data Warehouse**
- [ ] Hub-and-spoke schema centered on PRACTICE (NPI) as starting point
- [ ] Support employer-side entities (DOL Form 5500 data)
- [ ] Queryable via SQL (Redshift) for direct analysis and demo purposes
- [ ] Schema can evolve as data science team validates new entities/relationships

**Data Science Handoff**
- [ ] Clear process to receive notebooks/scripts from data science team
- [ ] Engineering can productionize rough prototype scripts (e.g., hardcoded paths, local-only dependencies) into pipeline-grade code
- [ ] Sample/test data available locally so scripts can be validated before productionization

**Query Interface (Slack Bot — last priority within MVP)**
- [ ] Slack bot receives messages and returns query results from the warehouse
- [ ] Pre-built parameterized SQL queries triggered by keywords — the bot matches user input to a registry of known queries (e.g., "top practices in MA" maps to a specific SQL query), fills in parameters, runs against Redshift, and returns formatted results. No AI/LLM involved — this is straightforward keyword-to-SQL lookup.
- [ ] Deployed in Slack for internal team use

> **Out of scope**: An LLM-powered agent (e.g., natural language → SQL generation via Bedrock) is a significant product effort on its own and is **not part of this MVP**. It will be scoped separately once the data platform and warehouse are stable. The Slack bot in this MVP is a simple, non-LLM query interface.

### Non-Functional Requirements

- **Reproducibility**: Any pipeline run can be re-executed from Raw and produce identical results
- **Traceability**: Every output row traces back to its raw source and transformation run
- **Testability**: ETL logic runs locally against DuckDB with unit tests before cloud deployment
- **Scalability**: Architecture supports adding new data sources without redesigning the pipeline
- **Cost-awareness**: MVP should minimize AWS spend — use serverless where possible (Glue, Athena for ad-hoc), avoid always-on resources except Redshift
- **Security**: No private/customer data in MVP — all public sources. IAM least-privilege for all AWS resources.

### Constraints

- **Technical**: AWS only. CDK for IaC. Python for pipeline code. Iceberg for unified layer.
- **Business**: Must have demo-ready output by April 27 (board papers). May 5 board meeting is hard deadline.
- **Operational**: 2 full-time engineers for ~8 weeks. One engineer available for architecture/design but out 3-4 weeks for hands-on work. Engineers also support the data science team with coding and technical guidance as needed. Data science team operates independently on business logic validation, hands off outputs to engineering for productionization.

---

## Proposed Solution

### Overview

A four-layer data platform on AWS that ingests public healthcare and employer data, transforms it through progressively refined layers, and serves it from a queryable warehouse. The platform is source-agnostic — designed to onboard new data sources without architectural changes.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Data Sources                           │
│  NPPES │ PECOS │ Medicare │ MIPS │ Care Compare │ DOL 5500  │
└────────────┬────────────────────────────────────────────────┘
             │  (CSV, JSON, tab-delimited)
             ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Raw (S3)                                          │
│  Original files, immutable, partitioned by source/date      │
│  s3://malpha-{env}/raw/{source}/{yyyy-mm-dd}/               │
└────────────┬────────────────────────────────────────────────┘
             │  Glue Jobs / Lambda
             ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Unified (S3 + Iceberg)                            │
│  Standardized schema, detailed granularity                  │
│  Cleaned, typed, deduped — one Iceberg table per source     │
│  Queryable via Athena for ad-hoc exploration                │
└────────────┬────────────────────────────────────────────────┘
             │  Glue Jobs
             ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Consolidated (Redshift)                           │
│  Joined across sources, business-level entities             │
│  Hub-and-spoke around PRACTICE (NPI)                        │
│  Employer entities linked via PRACTICE_EMPLOYER junction     │
│  Detailed granularity — queryable for deep analysis         │
└────────────┬────────────────────────────────────────────────┘
             │  Redshift transforms (views / materialized views)
             ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Aggregate (Redshift)                              │
│  Pre-computed metrics, optimized for query                  │
│  Same cluster as Consolidated, different schema             │
└─────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  Query Interface                                            │
│  Direct SQL (must-have) → Slack Bot (MVP last priority)     │
│  Athena available for ad-hoc against Unified layer          │
└─────────────────────────────────────────────────────────────┘
```

### Orchestration

- **MVP start**: Simple triggers — manual or scheduled Glue job triggers per source
- **Evolution**: AWS Step Functions to orchestrate multi-source dependencies (dedup, cross-source joins, cascading transforms)
- **Execution mix**: Glue (heavy ETL), Lambda (lightweight transforms), ECS (custom tasks like future web scraping or LLM analysis)

### Infrastructure as Code

- **AWS CDK (Python)** — all infrastructure defined in code, migrating from existing Terraform
- **Per-engineer environments**: `{engineer}-malpha-*` (own S3, Glue jobs) for isolated E2E testing
- **Shared environments**: `dev` and `prod`, same CDK stacks with environment-specific config

### Local Development

- **DuckDB** for local testing — ETL logic runs against sample data on laptop
- **Unit tests** validate transformation logic independent of AWS
- **Integration tests** run against personal cloud environment
- Supports the handoff workflow: data science team's rough scripts → local validation → productionized pipeline code → personal cloud E2E → dev → prod

### Serving Layer (Out of Scope — Future)

The existing m-alpha POC includes a FastAPI backend and Next.js frontend for chart serving. The serving layer design (API, UI, dashboards) will be addressed in a separate document once the data foundation is stable. For this MVP, the query interface is:

1. **Direct SQL** against Redshift (must-have for demo)
2. **Slack bot** with pre-built queries (last priority within MVP) — a simple keyword-to-SQL lookup, no LLM involved (see Requirements section for details)

An **LLM-powered query agent** (natural language → SQL generation) is a dedicated product effort and will be scoped in its own PRD once the data platform is stable. It is not part of this MVP.

The team is open to other interface options beyond Slack; this will be discussed and finalized during implementation.

### Data Science Handoff Workflow

The data science team (business-side, not engineering background) produces notebooks and scripts to validate business questions. These scripts work but are rough: hardcoded paths, local-only dependencies, no error handling. This is expected — their job is to validate business logic, not write production code. Engineering productionizes their validated outputs into the pipeline.

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

**What engineering needs from data science:**
- The notebook/script itself
- A description of the business question being answered
- Which data sources were used (and where they got them)
- The expected output (what does the answer look like?)
- Any assumptions or caveats

**What engineering does NOT expect:**
- Clean code, environment management, error handling, performance optimization, or tests

Every validated treasure map follows this path from prototype to production.

---

## Implementation Plan

### Phase 0: Setup (Week 0 — Mar 9-11)

**Goal**: PRD finalized, project scaffolded

**Deliverables**:
- [ ] PRD reviewed and approved by team
- [ ] CDK project initialized in repo
- [ ] Local dev harness scaffolded (DuckDB test setup, sample data fixtures)

### Phase 1: Foundation (Week 1 — Mar 12-20)

**Goal**: Infrastructure + first data source flowing end-to-end

**Deliverables**:
- [ ] CDK stacks deployed: S3 buckets (raw, unified), Redshift Serverless, Glue job definitions, IAM roles
- [ ] Per-engineer environment support (`{engineer}-malpha-*`)
- [ ] First P0 source (NPPES) ingested end-to-end: Raw → Unified → Consolidated → Aggregate
- [ ] Lineage fields (`source_version_id`, `run_id`) proven across all layers
- [ ] CI pipeline: lint, unit tests, CDK synth validation

**Dependencies**: AWS account access, Redshift provisioning decisions (serverless vs. provisioned)

### Phase 2: P0 Data Sources (Weeks 2-3 — Mar 21 - Apr 3)

**Goal**: All P0 sources flowing through the pipeline

**Deliverables**:
- [ ] Remaining P0 sources ingested: PECOS, Medicare Utilization, MIPS, Care Compare, DOL Form 5500
- [ ] Unified layer: one Iceberg table per source, queryable via Athena
- [ ] Consolidated layer: hub-and-spoke entities populated in Redshift (PRACTICE, PROVIDER, SERVICE, REVENUE_METRICS, QUALITY_METRICS, EMPLOYER)
- [ ] Aggregate layer: at least one pre-computed view ready for querying
- [ ] Data quality checks: row counts, null rates, basic assertions per source

**Dependencies**: Phase 1 complete

### Phase 3: Treasure Map Productionization (Weeks 4-5 — Apr 4 - Apr 17)

**Goal**: Data science output operationalized in the pipeline

**Deliverables**:
- [ ] At least one validated treasure map fully productionized (data science logic → production pipeline → queryable output)
- [ ] Consolidated/Aggregate layers refined based on treasure map requirements
- [ ] Direct SQL queries producing meaningful demo output (e.g., "practice comparison by cost/quality in region X")
- [ ] Step Functions orchestration for multi-source pipeline dependencies (if needed)

**Dependencies**: Phase 2 complete, at least one treasure map validated by data science team

### Phase 4: Query Interface + Demo Prep (Weeks 6-7 — Apr 18 - Apr 27)

**Goal**: Slack bot working, demo rehearsed, board papers ready

**Deliverables**:
- [ ] Slack bot deployed: pre-built parameterized queries against Redshift
- [ ] Stretch: Bedrock LLM → SQL generation for natural language queries
- [ ] Board demo rehearsal: end-to-end walkthrough of pipeline + query + output
- [ ] Board papers finalized (Apr 27)

**Dependencies**: Phase 3 complete

### Board Meeting: May 5

### Milestones

| Date | Milestone |
|---|---|
| Mar 11 | PRD finalized |
| Mar 20 | First source (NPPES) end-to-end, CDK infra deployed |
| Apr 3 | All P0 sources in warehouse, consolidated entities queryable |
| Apr 17 | Treasure map productionized, demo queries working |
| Apr 27 | Board papers out, Slack bot working, demo rehearsed |
| May 5 | Board meeting |

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| P0 data source format/schema changes unexpectedly | Medium | Medium | Iceberg schema evolution handles additive changes; raw layer is immutable so we can re-process |
| Redshift query performance insufficient for demo | Low | High | Start with Redshift Serverless to avoid provisioning decisions; optimize aggregate tables for known demo queries |
| Data quality issues in public sources (missing NPIs, inconsistent codes) | High | Medium | Data quality checks at each layer; don't block pipeline on imperfect data, flag and proceed |
| Slack bot LLM generates bad SQL or hallucinates | Medium | Medium | Start with pre-built queries (no LLM risk); Medium version uses constrained schema context and query validation |
| CDK migration takes longer than expected | Medium | Medium | Prioritize pipeline-critical infra first (S3, Glue, Redshift); auth/frontend infra can stay on Terraform temporarily |

### Operational Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| No treasure map validated by data science team in time for Phase 3 | Medium | High | Engineering prepares a "default" demo query using P0 data (e.g., practice cost comparison from Medicare Utilization + MIPS quality scores) as fallback |
| Engineer availability — unexpected absences beyond planned | Low | High | Pipeline designed as independent per-source jobs; one engineer can continue without blocking on the other |
| Data science handoff scripts require significant rework | High | Medium | Budget extra time in Phase 3; local DuckDB test harness helps validate logic quickly before productionizing |
| AWS cost surprises | Low | Medium | Use serverless (Glue, Athena, Redshift Serverless) where possible; set billing alerts; per-engineer envs use minimal resources and tear down after use |

---

## Success Metrics

### MVP Success (May 5 Board Meeting)

| Metric | Target |
|---|---|
| P0 data sources ingested end-to-end | 6/6 (NPPES, PECOS, Medicare Util, MIPS, Care Compare, DOL 5500) |
| Data layers operational | All 4 layers (Raw → Unified → Consolidated → Aggregate) with data flowing |
| Lineage traceability | Any row in Aggregate can be traced back to its raw source file |
| Pipeline re-runnability | Any source pipeline can be re-triggered and produces identical results |
| Demo-ready output | At least one meaningful query with real data answerable via SQL or Slack bot |
| Treasure map productionized | At least one data science output operationalized in the pipeline |
| Environments working | Local (DuckDB), personal cloud, dev, prod all functional |

### Platform Health (Ongoing Post-MVP)

| Metric | Target |
|---|---|
| Time to onboard a new data source | < 1 week from "data available" to "in warehouse" |
| Time to productionize a data science handoff | < 2 weeks from notebook to production pipeline |
| Pipeline failure recovery | Re-run from Raw without manual intervention |
| Data freshness | Consolidated/Aggregate data no older than latest available source release |

---

## Glossary

| Term | Definition |
|---|---|
| **NPI** | National Provider Identifier — unique 10-digit ID assigned to every healthcare provider in the US |
| **Treasure map** | Team term for a defined path from business question → required data sources → logic → usable output |
| **Raw layer** | Immutable storage of original source files exactly as downloaded |
| **Unified layer** | Cleaned, standardized Iceberg tables — one per source, detailed granularity |
| **Consolidated layer** | Business entities joined across multiple sources (e.g., PRACTICE with quality + cost data) in Redshift |
| **Aggregate layer** | Pre-computed metrics optimized for querying and serving in Redshift |
| **Iceberg** | Open table format for large datasets — supports schema evolution, time travel, and replayability |
| **Idempotent** | A pipeline that produces the same result whether run once or multiple times |
| **Hub-and-spoke** | Schema pattern where one central entity (PRACTICE) links to many dimensional tables |
| **P0 / P1 / P2** | Priority tiers for data sources — P0 is must-have for MVP |
| **DuckDB** | Lightweight local SQL database used for testing pipeline logic without cloud dependencies |
| **CDK** | AWS Cloud Development Kit — define cloud infrastructure in Python code |
| **Modular care package** | A bundled set of healthcare services with transparent pricing, sold directly to employers |

---

## References

1. [Meroka Modular Care Marketplace Plan — Offsite March 2026](https://docs.google.com/document/d/1_I52QXFnYKwqvcU7mQwiKqlP0bUFLpfxabP4HoQWDsI/edit?tab=t.0)
2. [Modular Care Package](https://docs.google.com/document/d/1BekCsCn40l9__tEBhbFT_4Fz90YkvJnr1EKyOMC10vE/edit?tab=t.0)
3. [Meroka Wireframe (data source mapping)](https://playground-six-pi.vercel.app/meroka-wireframe-v2.html)
4. [M-Alpha ER Diagram](https://github.com/MerokaInc/m-alpha/blob/main/er-deploy/index.html)
5. [Existing m-alpha data architecture doc](https://github.com/MerokaInc/m-alpha/blob/main/docs/data-architecture.md)
