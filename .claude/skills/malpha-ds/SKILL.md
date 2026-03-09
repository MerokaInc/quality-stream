# Skill: `/malpha-ds` — Data Science Proof-of-Concept Pipeline

Use this skill to scaffold and execute a structured data science pipeline for a given workstream (a.k.a. "treasure map"). Invoke by appending `/malpha-ds` to your prompt in a Claude Code session.

---

## Tech Stack

| Dimension | Spec |
|---|---|
| Language | Python |
| File format | Jupyter Notebook (`.ipynb`) |
| Core libraries | `pandas`, `numpy`, `plotly` |
| Accepted input formats | `.csv`, `.parquet` |
| Large file strategy (≥ ~10 GB) | Stream in 50,000-row chunks |
| Fallback for oversized files | Use `DuckDB` |

---

## Prerequisites (User)

Before invoking this skill, complete the following:

1. **Define the right problem.** Write a clear, scoped problem statement to include in your prompt.
  - *Example:* `"Do a join with NPIs to get all CPT codes per NPI on public claims datasets from Medicaid and Medicare."`
  - This typically comes out of a whiteboard or pen-and-paper brainstorm within a workstream (e.g. cost, quality, independence status), and should capture:
    - **Data sources** — what files/datasets are being used (e.g. Medicaid claims data)
    - **Business logic** — how the data should be processed (e.g. join claims with NPI to get all procedures per provider for a given time range)
    - **Output variables** — what the final dataset should contain (e.g. all CPT codes per NPI per time range)

2. **Download the dataset files.**

3. **Create a project folder** (if not already done).

4. **Open a Claude Code session** inside the project folder.

5. **Place dataset files in the project root.**
  ```
  my-project/
  ├── dataset_file_example.csv
  └── .claude/
      └── skills/
          └── malpha-ds/
              └── SKILL.md
  ```

6. **Load this skill** by appending `/malpha-ds` at the end of your prompt.

---

## Pipeline (AI-Executed)

Once invoked, execute the following steps in a single `.ipynb` notebook:

### Step 1 — Load Data
- Detect whether the input file is `.csv` or `.parquet` and load accordingly from the project root.
- If the file size exceeds ~10 GB, switch to chunk-based streaming (50K rows/chunk) or DuckDB.

### Step 2 — Exploratory Data Analysis (EDA)
Produce a dedicated EDA section in the notebook covering:
- **Schema** — list all column names
- **Shape** — number of rows and columns per file
- **Null rates** — proportion of null values per column
- **Data types** — inferred dtype for each column
- **Charts** — a small set of Plotly visualizations to build intuition about the data (distributions, top-N counts, etc.)

### Step 3 — Data Preprocessing & Cleaning
- Harmonize data types for all fields relevant to the right problem.
- Document any casting, coercion, or dropping decisions inline.

### Step 4 — Core Transformation
- Perform the join, aggregation, or transformation required by the right problem.
- Keep logic modular (one cell per logical step) and commented.

### Step 5 — Proof of Correctness
- In the **final cell**, query one or a few concrete elements that directly validate the right problem statement.
- This cell serves as the smoke test — it should be self-explanatory to a reviewer.

### Step 6 — README.md
Create a `README.md` at the project root containing:
- Brief description of the right problem and workstream context
- Google Drive downloadable links for all input datasets
- Source URLs for the raw data (e.g. CMS, state portals)
- Instructions to reproduce the notebook

### Step 7 — Push to GitHub
- Commit the notebook and `README.md` to a GitHub repo.
- Use a branch name that reflects the workstream (e.g. `ds/cost-npi-cpt-poc`).

---

## Handoff (User)

Once the notebook is on GitHub:

1. Post the repo link in the **#engineering** Slack channel.
2. Tag it for ingestion into the data lake and warehouse by the data engineering team.
