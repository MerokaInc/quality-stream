import { readFile } from "fs/promises";
import path from "path";
import type { HcpcsVolume, ProviderInfo } from "./scoring/types";

export interface NpiData {
  provider: ProviderInfo;
  volumes: HcpcsVolume[];
}

// ─── Static fallback ─────────────────────────────────────────────────────────

async function fetchFromStatic(npi: string): Promise<NpiData | null> {
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "data",
      `npi-${npi}.json`
    );
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as NpiData;
  } catch {
    return null;
  }
}

// ─── DuckDB live query ───────────────────────────────────────────────────────

interface JoinedRow {
  npi: string;
  provider_name: string | null;
  provider_type: string | null;
  provider_state: string | null;
  provider_city: string | null;
  hcpcs_code: string;
  hcpcs_desc: string | null;
  payer_source: string;
  medicare_total_benes: unknown;
  medicare_total_srvcs: unknown;
  medicare_total_pymt: unknown;
  medicare_total_chrg: unknown;
  medicare_total_alowd: unknown;
  medicaid_total_benes: unknown;
  medicaid_total_claims: unknown;
  medicaid_total_paid: unknown;
}

async function fetchFromDb(npi: string): Promise<NpiData | null> {
  const { query, toNum } = await import("./db");

  const rows = await query<JoinedRow>(
    `SELECT npi, provider_name, provider_type, provider_state, provider_city,
            hcpcs_code, hcpcs_desc, payer_source,
            medicare_total_benes, medicare_total_srvcs, medicare_total_pymt,
            medicare_total_chrg, medicare_total_alowd,
            medicaid_total_benes, medicaid_total_claims, medicaid_total_paid
     FROM joined WHERE npi = ? ORDER BY hcpcs_code`,
    npi
  );

  if (rows.length === 0) return null;

  const infoRow = rows.find(
    (r) => r.provider_name && String(r.provider_name).trim() !== ""
  );

  const provider: ProviderInfo = {
    npi,
    provider_name: infoRow?.provider_name
      ? String(infoRow.provider_name)
      : null,
    provider_type: infoRow?.provider_type
      ? String(infoRow.provider_type)
      : null,
    provider_state: infoRow?.provider_state
      ? String(infoRow.provider_state)
      : null,
    provider_city: infoRow?.provider_city
      ? String(infoRow.provider_city)
      : null,
  };

  const volumes: HcpcsVolume[] = rows.map((r) => {
    const medicareSrvcs = toNum(r.medicare_total_srvcs);
    const medicaidClaims = toNum(r.medicaid_total_claims);
    return {
      hcpcs_code: String(r.hcpcs_code),
      hcpcs_desc: r.hcpcs_desc ? String(r.hcpcs_desc) : null,
      payer_source: String(r.payer_source),
      medicare_total_benes: toNum(r.medicare_total_benes),
      medicare_total_srvcs: medicareSrvcs,
      medicare_total_pymt: toNum(r.medicare_total_pymt),
      medicaid_total_benes: toNum(r.medicaid_total_benes),
      medicaid_total_claims: medicaidClaims,
      medicaid_total_paid: toNum(r.medicaid_total_paid),
      total_volume: medicareSrvcs + medicaidClaims,
    };
  });

  return { provider, volumes };
}

// ─── Public API: try DB, fall back to static JSON ────────────────────────────

export async function fetchNpiData(npi: string): Promise<NpiData | null> {
  try {
    return await fetchFromDb(npi);
  } catch (err) {
    console.log(
      `[npi-data] DB unavailable (${err instanceof Error ? err.message : err}), trying static fallback`
    );
    return fetchFromStatic(npi);
  }
}
