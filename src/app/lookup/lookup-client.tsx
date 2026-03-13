"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Provider {
  npi: string;
  provider_name: string | null;
  provider_type: string | null;
  provider_state: string | null;
  provider_city: string | null;
}

interface HcpcsVolume {
  hcpcs_code: string;
  hcpcs_desc: string | null;
  payer_source: string;
  medicare_total_benes: number;
  medicare_total_srvcs: number;
  medicare_total_pymt: number;
  medicaid_total_benes: number;
  medicaid_total_claims: number;
  medicaid_total_paid: number;
  total_volume: number;
}

interface NpiData {
  provider: Provider;
  volumes: HcpcsVolume[];
}

// ─── Static data files served from public/data/ ─────────────────────────────

const PROVIDERS_URL = "/data/obgyn-providers.json";
const DEFAULT_NPI = "1790045821"; // Dr. Lingenfelter — PoC provider

/** Static NPI data path pattern — files in public/data/npi-{npi}.json */
function staticNpiUrl(npi: string): string {
  return `/data/npi-${npi}.json`;
}

// ─── ACOG Categories ─────────────────────────────────────────────────────────

interface AcogCategory {
  id: number;
  name: string;
  codes: string[];
  source: string;
  gapNote?: string;
}

const ACOG_CATEGORIES: AcogCategory[] = [
  {
    id: 1,
    name: "Cervical Cancer Screening",
    codes: ["G0101", "Q0091", "88141", "88142", "88175"],
    source: "HEDIS CCS / ACOG Practice Bulletin No. 168",
  },
  {
    id: 2,
    name: "STI Screening Panel",
    codes: ["87491", "87591", "87661"],
    source: "HEDIS CHL / ACOG Committee Opinion",
  },
  {
    id: 3,
    name: "Prenatal Monitoring",
    codes: ["59025", "76816", "76830"],
    source: "ACOG Guidelines for Perinatal Care",
  },
  {
    id: 4,
    name: "Depression Screening",
    codes: ["96127"],
    source: "HEDIS PND-E & PDS-E / ACOG CPG No. 4",
    gapNote:
      "Screen at first prenatal visit, once more during pregnancy, and at postpartum visit",
  },
  {
    id: 5,
    name: "Prenatal Lab Panel",
    codes: ["81000", "81001", "81002", "81003", "85025", "80048"],
    source: "ACOG Prenatal Lab Schedule",
  },
];

// ─── Score computation ───────────────────────────────────────────────────────

interface CategoryResult {
  category: AcogCategory;
  present: boolean;
  matchedCodes: { code: string; volume: number }[];
}

function computeAcogScore(volumes: HcpcsVolume[]): {
  score: number;
  categoriesPresent: number;
  results: CategoryResult[];
} {
  const volumeMap = new Map<string, number>();
  for (const v of volumes) {
    const existing = volumeMap.get(v.hcpcs_code) ?? 0;
    volumeMap.set(v.hcpcs_code, existing + v.total_volume);
  }

  const results: CategoryResult[] = ACOG_CATEGORIES.map((cat) => {
    const matchedCodes: { code: string; volume: number }[] = [];
    for (const code of cat.codes) {
      const vol = volumeMap.get(code);
      if (vol && vol > 0) {
        matchedCodes.push({ code, volume: vol });
      }
    }
    return {
      category: cat,
      present: matchedCodes.length > 0,
      matchedCodes,
    };
  });

  const categoriesPresent = results.filter((r) => r.present).length;
  const score = Math.round((categoriesPresent / 5) * 100);

  return { score, categoriesPresent, results };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LookupClient() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedNpi, setSelectedNpi] = useState<string | null>(null);
  const [npiData, setNpiData] = useState<NpiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load provider list from static JSON, then auto-load default provider
  useEffect(() => {
    fetch(PROVIDERS_URL)
      .then((res) => res.json())
      .then((data) => {
        setProviders(data);
        // Auto-load the PoC provider on first visit
        selectProvider(DEFAULT_NPI);
      })
      .catch(() => setProviders([]))
      .finally(() => setProvidersLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return providers;
    const q = search.toLowerCase();
    return providers.filter(
      (p) =>
        p.npi.includes(q) ||
        (p.provider_name && p.provider_name.toLowerCase().includes(q)) ||
        (p.provider_city && p.provider_city.toLowerCase().includes(q)) ||
        (p.provider_state && p.provider_state.toLowerCase().includes(q))
    );
  }, [search, providers]);

  async function selectProvider(npi: string) {
    setSelectedNpi(npi);
    setDropdownOpen(false);
    setSearch("");
    setLoading(true);
    setError(null);
    setNpiData(null);

    try {
      let data: NpiData | null = null;

      // 1. Try static JSON file (works everywhere, including Vercel)
      try {
        const res = await fetch(staticNpiUrl(npi));
        if (res.ok) {
          data = await res.json();
        }
      } catch {
        // static file not available, continue
      }

      // 2. Fall back to API (works locally with DuckDB)
      if (!data) {
        try {
          const res = await fetch(`/api/npi/${npi}`);
          if (res.ok) {
            data = await res.json();
          }
        } catch {
          // API not available, continue
        }
      }

      if (!data) {
        throw new Error(
          "Data for this provider is only available in the local environment. " +
          "Try searching for \"Lingenfelter\" to see the PoC demo."
        );
      }
      setNpiData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }

  const acogResult = npiData ? computeAcogScore(npiData.volumes) : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "var(--font-geist-sans)",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        {/* Nav */}
        <Link
          href="/score"
          style={{
            fontSize: 13,
            color: "#64748b",
            textDecoration: "none",
            marginBottom: 24,
            display: "inline-block",
          }}
        >
          &larr; Back to search
        </Link>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: 8,
            }}
          >
            OB-GYN Provider Quality Lookup
          </h1>
          <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.6 }}>
            ACOG Preventive Care Concordance &middot; Medicare &amp; Medicaid
            2023
          </p>
        </div>

        {/* Dropdown */}
        <div style={{ position: "relative", marginBottom: 32 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => setDropdownOpen(true)}
            placeholder={
              providersLoading
                ? "Loading providers..."
                : `Search by name or NPI... (${providers.length} OB-GYN providers)`
            }
            disabled={providersLoading}
            style={{
              width: "100%",
              padding: "14px 16px",
              fontSize: 15,
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              outline: "none",
              background: "#fff",
              boxSizing: "border-box",
            }}
          />
          {dropdownOpen && filtered.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                maxHeight: 320,
                overflowY: "auto",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderTop: "none",
                borderRadius: "0 0 8px 8px",
                zIndex: 10,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
            >
              {filtered.slice(0, 50).map((p) => (
                <button
                  key={p.npi}
                  onClick={() => selectProvider(p.npi)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 16px",
                    background:
                      p.npi === selectedNpi ? "#f1f5f9" : "transparent",
                    border: "none",
                    borderBottom: "1px solid #f1f5f9",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>
                    {p.provider_name ?? "Unknown"}
                  </span>
                  <span style={{ color: "#64748b", marginLeft: 8 }}>
                    {[p.provider_city, p.provider_state]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                  <code
                    style={{
                      float: "right",
                      fontSize: 12,
                      color: "#94a3b8",
                      fontFamily: "var(--font-geist-mono)",
                    }}
                  >
                    {p.npi}
                  </code>
                </button>
              ))}
              {filtered.length > 50 && (
                <div
                  style={{
                    padding: "8px 16px",
                    fontSize: 12,
                    color: "#94a3b8",
                    textAlign: "center",
                  }}
                >
                  {filtered.length - 50} more — refine your search
                </div>
              )}
            </div>
          )}
          {dropdownOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 5,
              }}
              onClick={() => setDropdownOpen(false)}
            />
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: 48,
              color: "#64748b",
              fontSize: 15,
            }}
          >
            Loading provider data...
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              padding: 16,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              color: "#991b1b",
              fontSize: 14,
              marginBottom: 24,
            }}
          >
            {error}
          </div>
        )}

        {/* Results */}
        {npiData && acogResult && (
          <>
            {/* Provider card */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "24px 32px",
                marginBottom: 24,
              }}
            >
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#0f172a",
                  marginBottom: 4,
                }}
              >
                {npiData.provider.provider_name ?? "Unknown Provider"}
              </h2>
              <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
                {npiData.provider.provider_type ?? "OB/GYN"} &middot;{" "}
                {[
                  npiData.provider.provider_city,
                  npiData.provider.provider_state,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <p
                style={{
                  fontSize: 14,
                  color: "#64748b",
                  margin: "4px 0 0",
                }}
              >
                NPI:{" "}
                <code style={{ fontFamily: "var(--font-geist-mono)" }}>
                  {npiData.provider.npi}
                </code>{" "}
                &middot; Data: Medicare + Medicaid 2023
              </p>
            </div>

            {/* Score card */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 32,
                marginBottom: 24,
              }}
            >
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#0f172a",
                  textAlign: "center",
                  marginBottom: 4,
                }}
              >
                ACOG Preventive Care Concordance
              </h3>
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 800,
                  textAlign: "center",
                  color:
                    acogResult.score >= 80
                      ? "#166534"
                      : acogResult.score >= 60
                        ? "#78350f"
                        : "#991b1b",
                  marginBottom: 24,
                }}
              >
                {acogResult.score}{" "}
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 400,
                    color: "#94a3b8",
                  }}
                >
                  / 100
                </span>
              </div>

              {/* Category rows */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {acogResult.results.map((r) => (
                  <div
                    key={r.category.id}
                    style={{
                      padding: "16px 20px",
                      background: r.present ? "#f0fdf4" : "#fef2f2",
                      border: `1px solid ${r.present ? "#bbf7d0" : "#fecaca"}`,
                      borderRadius: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 18,
                          lineHeight: 1,
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      >
                        {r.present ? "\u2713" : "\u2717"}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: r.present ? "#166534" : "#991b1b",
                            }}
                          >
                            {r.category.name}
                          </span>
                          {!r.present && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: "#dc2626",
                                color: "#fff",
                              }}
                            >
                              QUALITY GAP
                            </span>
                          )}
                        </div>
                        {r.present ? (
                          <div
                            style={{
                              fontSize: 13,
                              color: "#166534",
                              fontFamily: "var(--font-geist-mono)",
                            }}
                          >
                            {r.matchedCodes
                              .map(
                                (m) =>
                                  `${m.code} (${m.volume.toLocaleString()} services)`
                              )
                              .join(", ")}{" "}
                            present
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, color: "#991b1b" }}>
                            {r.category.codes.join(", ")} not found in claims
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: 12,
                            color: "#64748b",
                            marginTop: 4,
                          }}
                        >
                          Source: {r.category.source}
                        </div>
                        {!r.present && r.category.gapNote && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#64748b",
                              fontStyle: "italic",
                              marginTop: 4,
                              padding: "6px 10px",
                              background: "#fff5f5",
                              borderRadius: 4,
                            }}
                          >
                            &ldquo;{r.category.gapNote}&rdquo;
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Formula explanation */}
              <div
                style={{
                  marginTop: 20,
                  padding: "12px 16px",
                  background: "#f8fafc",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#64748b",
                  fontFamily: "var(--font-geist-mono)",
                  textAlign: "center",
                }}
              >
                Formula: (categories present) / 5 &times; 100 ={" "}
                {acogResult.categoriesPresent}/5 &times; 100 ={" "}
                {acogResult.score}
              </div>
            </div>

            {/* CPT Codes table */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "16px 24px",
                  borderBottom: "1px solid #e2e8f0",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#0f172a",
                }}
              >
                CPT Codes ({npiData.volumes.length})
              </div>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={thStyle}>Code</th>
                      <th style={thStyle}>Description</th>
                      <th style={thStyle}>Payer</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>
                        Medicare Srvcs
                      </th>
                      <th style={{ ...thStyle, textAlign: "right" }}>
                        Medicaid Claims
                      </th>
                      <th style={{ ...thStyle, textAlign: "right" }}>
                        Total Vol.
                      </th>
                      <th style={{ ...thStyle, textAlign: "right" }}>
                        Total Paid
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {npiData.volumes.map((v) => (
                      <tr
                        key={v.hcpcs_code}
                        style={{ borderTop: "1px solid #f1f5f9" }}
                      >
                        <td
                          style={{
                            ...tdStyle,
                            fontFamily: "var(--font-geist-mono)",
                            fontWeight: 600,
                          }}
                        >
                          {v.hcpcs_code}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            maxWidth: 300,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {v.hcpcs_desc ?? "\u2014"}
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background:
                                v.payer_source === "Both Payers"
                                  ? "#dbeafe"
                                  : v.payer_source === "Medicare Only"
                                    ? "#e0e7ff"
                                    : "#fce7f3",
                              color:
                                v.payer_source === "Both Payers"
                                  ? "#1e40af"
                                  : v.payer_source === "Medicare Only"
                                    ? "#3730a3"
                                    : "#9d174d",
                            }}
                          >
                            {v.payer_source}
                          </span>
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            fontFamily: "var(--font-geist-mono)",
                          }}
                        >
                          {v.medicare_total_srvcs.toLocaleString()}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            fontFamily: "var(--font-geist-mono)",
                          }}
                        >
                          {v.medicaid_total_claims.toLocaleString()}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            fontWeight: 600,
                            fontFamily: "var(--font-geist-mono)",
                          }}
                        >
                          {v.total_volume.toLocaleString()}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            fontFamily: "var(--font-geist-mono)",
                          }}
                        >
                          $
                          {(
                            v.medicare_total_pymt + v.medicaid_total_paid
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {!selectedNpi && !loading && (
          <div
            style={{
              textAlign: "center",
              padding: "64px 24px",
              color: "#94a3b8",
              fontSize: 15,
            }}
          >
            Select a provider above to view their ACOG clinical quality score
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  color: "#334155",
};
