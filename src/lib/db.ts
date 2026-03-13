import { DuckDBInstance, DuckDBConnection } from "@duckdb/node-api";
import path from "path";

const DB_PATH = path.join(process.cwd(), "quality_stream.duckdb");
const MEDICARE_FILE = path.join(process.cwd(), "datasets", "MUP_PHY_R25_P05_V20_D23_Prov_Svc.csv");
const MEDICAID_FILE = path.join(process.cwd(), "datasets", "medicaid-provider-spending.parquet");

let connection: DuckDBConnection | null = null;
let initPromise: Promise<DuckDBConnection> | null = null;
let usingFallback = false;

function getConnection(): Promise<DuckDBConnection> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    // Try persistent DB first (fast path)
    try {
      const instance = await DuckDBInstance.create(DB_PATH, {
        access_mode: "READ_ONLY",
      });
      connection = await instance.connect();
      console.log("[db] Connected to quality_stream.duckdb (read-only)");
      return connection;
    } catch {
      console.log("[db] DuckDB file locked, falling back to raw file queries");
    }

    // Fallback: in-memory DuckDB querying raw CSV/parquet files
    try {
      const instance = await DuckDBInstance.create(":memory:");
      connection = await instance.connect();
      usingFallback = true;

      // Create the joined view matching the notebook's schema
      await connection.run(`
        CREATE VIEW medicare_agg AS
        SELECT
          CAST(Rndrng_NPI AS VARCHAR) AS npi,
          UPPER(TRIM(HCPCS_Cd)) AS hcpcs_code,
          FIRST(TRIM(COALESCE(Rndrng_Prvdr_First_Name, '') || ' ' || Rndrng_Prvdr_Last_Org_Name)) AS provider_name,
          FIRST(Rndrng_Prvdr_Type) AS provider_type,
          FIRST(Rndrng_Prvdr_State_Abrvtn) AS provider_state,
          FIRST(Rndrng_Prvdr_City) AS provider_city,
          FIRST(HCPCS_Desc) AS hcpcs_desc,
          SUM(Tot_Benes)::BIGINT AS medicare_total_benes,
          SUM(Tot_Srvcs)::BIGINT AS medicare_total_srvcs,
          SUM(Tot_Bene_Day_Srvcs)::BIGINT AS medicare_total_bene_day_srvcs,
          ROUND(SUM(Avg_Mdcr_Pymt_Amt * Tot_Srvcs), 2) AS medicare_total_pymt,
          ROUND(SUM(Avg_Sbmtd_Chrg * Tot_Srvcs), 2) AS medicare_total_chrg,
          ROUND(SUM(Avg_Mdcr_Alowd_Amt * Tot_Srvcs), 2) AS medicare_total_alowd
        FROM read_csv('${MEDICARE_FILE}', auto_detect=true)
        GROUP BY 1, 2
      `);

      await connection.run(`
        CREATE VIEW medicaid_agg AS
        SELECT
          TRIM(SERVICING_PROVIDER_NPI_NUM) AS npi,
          UPPER(TRIM(HCPCS_CODE)) AS hcpcs_code,
          SUM(TOTAL_UNIQUE_BENEFICIARIES)::BIGINT AS medicaid_total_benes,
          SUM(TOTAL_CLAIMS)::BIGINT AS medicaid_total_claims,
          ROUND(SUM(TOTAL_PAID), 2) AS medicaid_total_paid
        FROM read_parquet('${MEDICAID_FILE}')
        WHERE CLAIM_FROM_MONTH LIKE '2023-%'
        GROUP BY 1, 2
      `);

      await connection.run(`
        CREATE VIEW joined AS
        SELECT
          COALESCE(mc.npi, md.npi) AS npi,
          mc.provider_name,
          mc.provider_type,
          mc.provider_state,
          mc.provider_city,
          COALESCE(mc.hcpcs_code, md.hcpcs_code) AS hcpcs_code,
          mc.hcpcs_desc,
          CASE
            WHEN mc.npi IS NOT NULL AND md.npi IS NOT NULL THEN 'Both Payers'
            WHEN mc.npi IS NOT NULL THEN 'Medicare Only'
            ELSE 'Medicaid Only'
          END AS payer_source,
          COALESCE(mc.medicare_total_benes, 0) AS medicare_total_benes,
          COALESCE(mc.medicare_total_srvcs, 0) AS medicare_total_srvcs,
          COALESCE(mc.medicare_total_pymt, 0) AS medicare_total_pymt,
          COALESCE(mc.medicare_total_chrg, 0) AS medicare_total_chrg,
          COALESCE(mc.medicare_total_alowd, 0) AS medicare_total_alowd,
          COALESCE(md.medicaid_total_benes, 0) AS medicaid_total_benes,
          COALESCE(md.medicaid_total_claims, 0) AS medicaid_total_claims,
          COALESCE(md.medicaid_total_paid, 0) AS medicaid_total_paid
        FROM medicare_agg mc
        FULL OUTER JOIN medicaid_agg md
          ON mc.npi = md.npi AND mc.hcpcs_code = md.hcpcs_code
      `);

      console.log("[db] Fallback mode: in-memory DuckDB with raw file views ready");
      return connection;
    } catch (err) {
      initPromise = null;
      throw new Error(
        `DuckDB fallback failed: ${err instanceof Error ? err.message : err}`
      );
    }
  })();
  return initPromise;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  ...params: (string | number)[]
): Promise<T[]> {
  const conn = await getConnection();

  if (params.length > 0) {
    const stmt = await conn.prepare(sql);
    for (let i = 0; i < params.length; i++) {
      stmt.bindVarchar(i + 1, String(params[i]));
    }
    const reader = await stmt.runAndReadAll();
    return reader.getRowObjectsJson() as T[];
  }

  const reader = await conn.runAndReadAll(sql);
  return reader.getRowObjectsJson() as T[];
}

/** Safely coerce a DuckDB JSON value (may be string for BIGINT) to number */
export function toNum(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return Number(val) || 0;
  return 0;
}

export function isUsingFallback(): boolean {
  return usingFallback;
}
