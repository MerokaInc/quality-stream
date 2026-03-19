"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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

/** Compact per-code record from the ACOG export */
interface AcogCodeEntry {
  desc: string | null;
  payer: string;
  srvcs: number;
  claims: number;
  pymt: number;
  paid: number;
}

/** Per-provider record in the bulk ACOG data file */
interface AcogProviderData {
  provider_name: string | null;
  provider_type: string | null;
  provider_state: string | null;
  provider_city: string | null;
  codes: Record<string, AcogCodeEntry>;
}

/** Full NPI data (from individual static files or API) */
interface NpiData {
  provider: Provider;
  volumes: HcpcsVolume[];
}

/** Quality scores from the pre-computed export */
interface QualityScores {
  peer: {
    score: number;
    typical_pct: number;
    coverage: number;
    total_codes: number;
    typical_codes: number;
    top_atypical: string[];
  };
  volume: {
    score: number;
    flags: { cat: string; v: number; cv: number; r: number; s: string }[];
  };
  charge: {
    score: number | null;
    avg_ratio: number | null;
    median_peer_ratio: number;
  };
  payer_div: {
    score: number;
    both_pct: number;
    total_codes: number;
  };
}

// ─── Static data URLs ────────────────────────────────────────────────────────

const PROVIDERS_URL = "/data/obgyn-providers.json";
const ACOG_DATA_URL = "/data/obgyn-acog-data.json";
const QUALITY_DATA_URL = "/data/obgyn-quality-data.json";
const DEFAULT_NPI = "1790045821"; // Dr. Lingenfelter — PoC provider

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

interface AcogResult {
  score: number;
  categoriesPresent: number;
  results: CategoryResult[];
}

function computeAcogFromVolumes(volumes: HcpcsVolume[]): AcogResult {
  const volumeMap = new Map<string, number>();
  for (const v of volumes) {
    const existing = volumeMap.get(v.hcpcs_code) ?? 0;
    volumeMap.set(v.hcpcs_code, existing + v.total_volume);
  }
  return computeFromMap(volumeMap);
}

function computeAcogFromCodes(
  codes: Record<string, AcogCodeEntry>
): AcogResult {
  const volumeMap = new Map<string, number>();
  for (const [code, entry] of Object.entries(codes)) {
    volumeMap.set(code, entry.srvcs + entry.claims);
  }
  return computeFromMap(volumeMap);
}

function computeComposite(
  acog: number,
  q: QualityScores | null
): number | null {
  if (!q) return null;
  const dims: { score: number; weight: number }[] = [
    { score: acog, weight: 0.3 },
    { score: q.peer.score, weight: 0.2 },
    { score: q.volume.score, weight: 0.2 },
    ...(q.charge.score != null
      ? [{ score: q.charge.score, weight: 0.15 }]
      : []),
    { score: q.payer_div.score, weight: 0.15 },
  ];
  const totalWeight = dims.reduce((s, d) => s + d.weight, 0);
  return Math.round(
    dims.reduce((s, d) => s + d.score * (d.weight / totalWeight), 0)
  );
}

function scoreColor(score: number): string {
  if (score >= 80) return "#166534";
  if (score >= 60) return "#78350f";
  return "#991b1b";
}

function scoreBg(score: number): string {
  if (score >= 80) return "#f0fdf4";
  if (score >= 60) return "#fffbeb";
  return "#fef2f2";
}

function scoreBorder(score: number): string {
  if (score >= 80) return "#bbf7d0";
  if (score >= 60) return "#fde68a";
  return "#fecaca";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Moderate";
  return "Needs Improvement";
}

function computeFromMap(volumeMap: Map<string, number>): AcogResult {
  const results: CategoryResult[] = ACOG_CATEGORIES.map((cat) => {
    const matchedCodes: { code: string; volume: number }[] = [];
    for (const code of cat.codes) {
      const vol = volumeMap.get(code);
      if (vol && vol > 0) {
        matchedCodes.push({ code, volume: vol });
      }
    }
    return { category: cat, present: matchedCodes.length > 0, matchedCodes };
  });
  const categoriesPresent = results.filter((r) => r.present).length;
  return {
    score: Math.round((categoriesPresent / 5) * 100),
    categoriesPresent,
    results,
  };
}

// ─── Convert ACOG data to HcpcsVolume[] for the CPT table ────────────────────

function acogCodesToVolumes(
  codes: Record<string, AcogCodeEntry>
): HcpcsVolume[] {
  return Object.entries(codes)
    .map(([code, e]) => ({
      hcpcs_code: code,
      hcpcs_desc: e.desc,
      payer_source: e.payer,
      medicare_total_benes: 0,
      medicare_total_srvcs: e.srvcs,
      medicare_total_pymt: e.pymt,
      medicaid_total_benes: 0,
      medicaid_total_claims: e.claims,
      medicaid_total_paid: e.paid,
      total_volume: e.srvcs + e.claims,
    }))
    .sort((a, b) => a.hcpcs_code.localeCompare(b.hcpcs_code));
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LookupClient() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [acogData, setAcogData] = useState<Record<
    string,
    AcogProviderData
  > | null>(null);
  const [qualityData, setQualityData] = useState<Record<
    string,
    QualityScores
  > | null>(null);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedNpi, setSelectedNpi] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(
    null
  );
  const [acogResult, setAcogResult] = useState<AcogResult | null>(null);
  const [qualityScores, setQualityScores] = useState<QualityScores | null>(
    null
  );
  const [volumes, setVolumes] = useState<HcpcsVolume[]>([]);
  const [loading, setLoading] = useState(false);

  // Load provider list + ACOG data in parallel
  useEffect(() => {
    Promise.all([
      fetch(PROVIDERS_URL).then((r) => r.json()),
      fetch(ACOG_DATA_URL).then((r) => r.json()),
      fetch(QUALITY_DATA_URL)
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([provs, acog, quality]) => {
        setProviders(provs);
        setAcogData(acog);
        if (quality) setQualityData(quality);
        setProvidersLoading(false);
        // Auto-load the PoC provider
        loadProvider(DEFAULT_NPI, provs, acog, quality);
      })
      .catch(() => setProvidersLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProvider = useCallback(
    (
      npi: string,
      provs: Provider[],
      acog: Record<string, AcogProviderData>,
      quality?: Record<string, QualityScores> | null
    ) => {
      setSelectedNpi(npi);
      setDropdownOpen(false);
      setSearch("");
      setLoading(true);
      setAcogResult(null);
      setQualityScores(null);
      setVolumes([]);
      setSelectedProvider(null);

      // Load quality scores for this NPI
      const qScores = quality?.[npi] ?? qualityData?.[npi] ?? null;
      setQualityScores(qScores);

      // Find provider info from the provider list
      const prov = provs.find((p) => p.npi === npi) ?? null;

      // Check bulk ACOG data (covers 14,648 providers)
      const acogEntry = acog[npi];

      if (acogEntry) {
        const info: Provider = {
          npi,
          provider_name:
            prov?.provider_name ?? acogEntry.provider_name ?? null,
          provider_type:
            prov?.provider_type ?? acogEntry.provider_type ?? null,
          provider_state:
            prov?.provider_state ?? acogEntry.provider_state ?? null,
          provider_city:
            prov?.provider_city ?? acogEntry.provider_city ?? null,
        };
        setSelectedProvider(info);
        setAcogResult(computeAcogFromCodes(acogEntry.codes));
        setVolumes(acogCodesToVolumes(acogEntry.codes));
        setLoading(false);

        // Also try to load full volumes for a richer CPT table (best effort)
        fetch(`/data/npi-${npi}.json`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data: NpiData | null) => {
            if (data) {
              setVolumes(data.volumes);
              setAcogResult(computeAcogFromVolumes(data.volumes));
            }
          })
          .catch(() => {
            /* keep ACOG data */
          });
        return;
      }

      // No ACOG data — try individual static file or API
      (async () => {
        try {
          let data: NpiData | null = null;
          try {
            const res = await fetch(`/data/npi-${npi}.json`);
            if (res.ok) data = await res.json();
          } catch {
            /* continue */
          }
          if (!data) {
            try {
              const res = await fetch(`/api/npi/${npi}`);
              if (res.ok) data = await res.json();
            } catch {
              /* continue */
            }
          }
          if (data) {
            setSelectedProvider(data.provider);
            setAcogResult(computeAcogFromVolumes(data.volumes));
            setVolumes(data.volumes);
          } else if (prov) {
            // Provider exists but has no ACOG-relevant codes
            setSelectedProvider(prov);
            setAcogResult(computeFromMap(new Map()));
            setVolumes([]);
          }
        } finally {
          setLoading(false);
        }
      })();
    },
    []
  );

  function selectProvider(npi: string) {
    if (acogData && providers.length > 0) {
      loadProvider(npi, providers, acogData, qualityData);
    }
  }

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
            Clinical Quality Scoring &middot; Medicare &amp; Medicaid 2023
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
              style={{ position: "fixed", inset: 0, zIndex: 5 }}
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

        {/* Results */}
        {!loading && selectedProvider && acogResult && (
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
                {selectedProvider.provider_name ?? "Unknown Provider"}
              </h2>
              <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
                {selectedProvider.provider_type ?? "OB/GYN"} &middot;{" "}
                {[
                  selectedProvider.provider_city,
                  selectedProvider.provider_state,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <p
                style={{ fontSize: 14, color: "#64748b", margin: "4px 0 0" }}
              >
                NPI:{" "}
                <code style={{ fontFamily: "var(--font-geist-mono)" }}>
                  {selectedProvider.npi}
                </code>{" "}
                &middot; Data: Medicare + Medicaid 2023
              </p>
            </div>

            {/* ── Composite Quality Score ── */}
            {acogResult && (() => {
              const composite = computeComposite(acogResult.score, qualityScores);
              if (composite == null) return null;
              return (
                <div
                  style={{
                    background: "#fff",
                    border: `2px solid ${scoreBorder(composite)}`,
                    borderRadius: 12,
                    padding: "28px 32px",
                    marginBottom: 24,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                    Composite Clinical Quality Score
                  </div>
                  <div style={{ fontSize: 56, fontWeight: 800, color: scoreColor(composite), lineHeight: 1.1 }}>
                    {composite}
                    <span style={{ fontSize: 22, fontWeight: 400, color: "#94a3b8" }}> / 100</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: scoreColor(composite), marginTop: 4 }}>
                    {scoreLabel(composite)}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
                    Weighted: ACOG 30% &middot; Peer 20% &middot; Volume 20% &middot; Billing 15% &middot; Payer 15%
                  </div>
                </div>
              );
            })()}

            {/* ── Dimension Score Grid ── */}
            {qualityScores && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                {/* ACOG Concordance */}
                <DimCard
                  title="ACOG Concordance"
                  score={acogResult?.score ?? 0}
                  detail={`${acogResult?.categoriesPresent ?? 0}/5 preventive categories present`}
                  sub="Guideline-recommended services billed"
                />
                {/* Peer Comparison */}
                <DimCard
                  title="Peer Comparison"
                  score={qualityScores.peer.score}
                  detail={`${qualityScores.peer.typical_codes}/${qualityScores.peer.total_codes > 25 ? 25 : qualityScores.peer.total_codes} typical OB-GYN codes covered`}
                  sub={`${qualityScores.peer.total_codes} total codes billed`}
                />
                {/* Volume Adequacy */}
                <DimCard
                  title="Volume Adequacy"
                  score={qualityScores.volume.score}
                  detail={`${qualityScores.volume.flags.filter(f => f.s === "ok").length}/${qualityScores.volume.flags.length} categories at adequate volume`}
                  sub="Screening volume vs. visit volume"
                />
                {/* Billing Quality */}
                <DimCard
                  title="Billing Quality"
                  score={qualityScores.charge.score ?? -1}
                  detail={qualityScores.charge.avg_ratio != null
                    ? `Charge/Allowed ratio: ${qualityScores.charge.avg_ratio}x (peer median: ${qualityScores.charge.median_peer_ratio}x)`
                    : "No Medicare charge data"}
                  sub="Charge-to-allowed ratio vs. OB-GYN peers"
                />
                {/* Payer Diversity */}
                <DimCard
                  title="Payer Diversity"
                  score={qualityScores.payer_div.score}
                  detail={`${Math.round(qualityScores.payer_div.both_pct * 100)}% of codes in both Medicare & Medicaid`}
                  sub="Cross-payer service breadth"
                />
              </div>
            )}

            {/* ── ACOG Detail Card ── */}
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
                  style={{ fontSize: 20, fontWeight: 400, color: "#94a3b8" }}
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
            {volumes.length > 0 && (
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
                  CPT Codes ({volumes.length})
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
                      {volumes.map((v) => (
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
            )}
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

// ─── Dimension Score Card ────────────────────────────────────────────────────

function DimCard({
  title,
  score,
  detail,
  sub,
}: {
  title: string;
  score: number;
  detail: string;
  sub: string;
}) {
  const na = score < 0;
  const displayScore = na ? "N/A" : score;
  const color = na ? "#94a3b8" : scoreColor(score);
  const bg = na ? "#f8fafc" : scoreBg(score);
  const border = na ? "#e2e8f0" : scoreBorder(score);

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
          {title}
        </span>
        <span style={{ fontSize: 24, fontWeight: 800, color }}>
          {displayScore}
        </span>
      </div>
      <div style={{ fontSize: 13, color: "#334155" }}>{detail}</div>
      <div style={{ fontSize: 11, color: "#94a3b8" }}>{sub}</div>
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
