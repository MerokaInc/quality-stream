# Quality Stream: All HCPCS per NPI across Medicare & Medicaid

## Right Problem

Join Medicare + Medicaid on NPI to get a unified view of all procedure codes (HCPCS/CPT), volumes, and spending per provider across both payers.

## Output

A single joined dataset where each row = one NPI + HCPCS code pair, with:
- Medicare metrics: total beneficiaries, services, payments, charges, allowed amounts
- Medicaid metrics: total beneficiaries, claims, total paid
- Payer source label: "Medicare Only", "Medicaid Only", or "Both Payers"
- Provider info: name, type, state (from Medicare)

## Datasets

### Medicare Physician & Other Practitioners (2023)

- **File**: `datasets/MUP_PHY_R25_P05_V20_D23_Prov_Svc.csv` (~2.9 GB)
- **Source**: CMS Medicare Provider Utilization and Payment Data — Physician and Other Practitioners (Provider-Service level)
- **Source URL**: https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider-and-service
- **Download**: [Google Drive](https://drive.google.com/drive/folders/1DNaP97a3qge2NK9KbN5DD48pPxNHB-JZ?usp=drive_link)

### Medicaid Provider Spending

- **File**: `datasets/medicaid-provider-spending.parquet` (~2.7 GB, 227M rows)
- **Source**: Medicaid.gov T-MSIS claims-level provider spending data
- **Source URL**: https://data.medicaid.gov
- **Download**: [Google Drive](https://drive.google.com/file/d/1l7VKbWlYpFaRAlDCP3CBCalvWe67Tyqa/view?usp=sharing)

## How to Run

1. Clone the repo
2. Download datasets into `datasets/` folder
3. Install dependencies: `pip install duckdb pandas numpy plotly`
4. Open `notebook.ipynb` and run all cells

**Note**: Files are ~6GB total. DuckDB queries CSV/parquet directly without loading into memory — no chunked loops needed.

## Tech Stack

- Python (Jupyter Notebook)
- DuckDB (in-process OLAP engine — queries files directly via SQL)
- pandas, numpy, plotly (for charts and display)
