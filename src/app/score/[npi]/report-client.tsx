"use client";

import { useState } from "react";
import Link from "next/link";
import type { QualityReport, DomainScore, FormulaResult, ResultStatus } from "@/lib/scoring/types";

const TIER_STYLES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  Recommended: { bg: "#f0fdf4", border: "#86efac", text: "#166534", badge: "#16a34a" },
  Conditional: { bg: "#fffbeb", border: "#fde68a", text: "#78350f", badge: "#d97706" },
  "Not Recommended": { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", badge: "#dc2626" },
};

const STATUS_CONFIG: Record<ResultStatus, { label: string; color: string; bg: string }> = {
  pass: { label: "PASS", color: "#16a34a", bg: "#f0fdf4" },
  flag: { label: "FLAG", color: "#d97706", bg: "#fffbeb" },
  fail: { label: "FAIL", color: "#dc2626", bg: "#fef2f2" },
  insufficient_data: { label: "LOW N", color: "#64748b", bg: "#f1f5f9" },
  not_computable: { label: "NEEDS CLAIMS", color: "#6366f1", bg: "#eef2ff" },
};

export default function ReportClient({ report }: { report: QualityReport }) {
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [showHcpcs, setShowHcpcs] = useState(false);

  function toggleDomain(id: string) {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const { provider, overallScore, tier, domains, hcpcsVolumes, completeness, isObgyn } = report;
  const tierStyle = tier ? TIER_STYLES[tier] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "var(--font-geist-sans)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        {/* Nav */}
        <Link href="/score" style={{ fontSize: 13, color: "#64748b", textDecoration: "none", marginBottom: 24, display: "inline-block" }}>
          &larr; Back to search
        </Link>

        {/* Header */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 32, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                {provider.provider_name ?? "Unknown Provider"}
              </h1>
              <p style={{ fontSize: 14, color: "#64748b", marginBottom: 2 }}>
                NPI: <code style={{ fontFamily: "var(--font-geist-mono)" }}>{provider.npi}</code>
              </p>
              {provider.provider_type && (
                <p style={{ fontSize: 14, color: "#64748b", marginBottom: 2 }}>
                  {provider.provider_type}
                </p>
              )}
              {(provider.provider_city || provider.provider_state) && (
                <p style={{ fontSize: 14, color: "#64748b" }}>
                  {[provider.provider_city, provider.provider_state].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              {overallScore !== null && tierStyle ? (
                <>
                  <div style={{ fontSize: 48, fontWeight: 800, color: tierStyle.text, lineHeight: 1 }}>
                    {overallScore}
                  </div>
                  <div style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: 20,
                    background: tierStyle.badge,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    marginTop: 4,
                  }}>
                    {tier}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 14, color: "#94a3b8" }}>
                  Insufficient data for overall score
                </div>
              )}
            </div>
          </div>

          {/* Specialty warning */}
          {!isObgyn && (
            <div style={{
              marginTop: 16,
              padding: "12px 16px",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: 8,
              fontSize: 13,
              color: "#78350f",
            }}>
              Quality formulas are currently scoped to <strong>OB-GYN</strong> only.
              This provider&apos;s specialty ({provider.provider_type ?? "unknown"}) may not align with these formulas.
              Raw HCPCS data is shown below.
            </div>
          )}
        </div>

        {/* Data completeness banner */}
        <div style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "16px 24px",
          marginBottom: 24,
          display: "flex",
          gap: 32,
          flexWrap: "wrap",
          fontSize: 13,
        }}>
          <Stat label="Total Formulas" value={completeness.totalFormulas} />
          <Stat label="Computable from Aggregates" value={completeness.computableFormulas} />
          <Stat label="With Sufficient Data" value={completeness.formulasWithData} />
          <Stat label="HCPCS Codes" value={hcpcsVolumes.length} />
          <div style={{ flex: 1, textAlign: "right", color: "#64748b", alignSelf: "center" }}>
            {completeness.percentComputable}% of formulas computable &middot; {100 - completeness.percentComputable}% require patient-level claims
          </div>
        </div>

        {/* Domain score cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
          {domains.map((d) => (
            <DomainCard key={d.domainId} domain={d} expanded={expandedDomains.has(d.domainId)} onToggle={() => toggleDomain(d.domainId)} />
          ))}
        </div>

        {/* Domain detail sections */}
        {domains.filter((d) => expandedDomains.has(d.domainId)).map((d) => (
          <DomainDetail key={d.domainId} domain={d} />
        ))}

        {/* HCPCS table */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, marginBottom: 24, overflow: "hidden" }}>
          <button
            onClick={() => setShowHcpcs(!showHcpcs)}
            style={{
              width: "100%",
              padding: "16px 24px",
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 15,
              fontWeight: 600,
              color: "#0f172a",
            }}
          >
            <span>HCPCS Codes ({hcpcsVolumes.length})</span>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{showHcpcs ? "Hide" : "Show"}</span>
          </button>
          {showHcpcs && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
                    <th style={thStyle}>Code</th>
                    <th style={thStyle}>Description</th>
                    <th style={thStyle}>Payer</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Medicare Srvcs</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Medicaid Claims</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Total Vol.</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Total Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {hcpcsVolumes.map((v) => (
                    <tr key={v.hcpcs_code} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ ...tdStyle, fontFamily: "var(--font-geist-mono)", fontWeight: 600 }}>{v.hcpcs_code}</td>
                      <td style={{ ...tdStyle, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.hcpcs_desc ?? "—"}
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: 11,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: v.payer_source === "Both Payers" ? "#dbeafe" : v.payer_source === "Medicare Only" ? "#e0e7ff" : "#fce7f3",
                          color: v.payer_source === "Both Payers" ? "#1e40af" : v.payer_source === "Medicare Only" ? "#3730a3" : "#9d174d",
                        }}>
                          {v.payer_source}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-geist-mono)" }}>
                        {v.medicare_total_srvcs.toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-geist-mono)" }}>
                        {v.medicaid_total_claims.toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, fontFamily: "var(--font-geist-mono)" }}>
                        {v.total_volume.toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-geist-mono)" }}>
                        ${(v.medicare_total_pymt + v.medicaid_total_paid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#94a3b8" }}>{label}</div>
    </div>
  );
}

function DomainCard({ domain, expanded, onToggle }: { domain: DomainScore; expanded: boolean; onToggle: () => void }) {
  const hasScore = domain.score !== null;
  return (
    <button
      onClick={onToggle}
      style={{
        background: "#fff",
        border: `1px solid ${expanded ? domain.color : "#e2e8f0"}`,
        borderRadius: 12,
        padding: 20,
        textAlign: "left",
        cursor: "pointer",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: domain.color }}>
          {domain.label}
        </div>
        {hasScore ? (
          <div style={{
            fontSize: 24,
            fontWeight: 800,
            color: domain.score! >= 80 ? "#16a34a" : domain.score! >= 65 ? "#d97706" : "#dc2626",
          }}>
            {domain.score}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#94a3b8" }}>N/A</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {domain.passCount > 0 && <MiniStat label="Pass" count={domain.passCount} color="#16a34a" />}
        {domain.flagCount > 0 && <MiniStat label="Flag" count={domain.flagCount} color="#d97706" />}
        {domain.failCount > 0 && <MiniStat label="Fail" count={domain.failCount} color="#dc2626" />}
        {domain.insufficientCount > 0 && <MiniStat label="Low N" count={domain.insufficientCount} color="#64748b" />}
        {domain.notComputableCount > 0 && <MiniStat label="Needs Claims" count={domain.notComputableCount} color="#6366f1" />}
      </div>
    </button>
  );
}

function MiniStat({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span style={{ fontSize: 11, color, fontWeight: 600 }}>
      {count} {label}
    </span>
  );
}

function DomainDetail({ domain }: { domain: DomainScore }) {
  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${domain.color}20`,
      borderRadius: 12,
      marginBottom: 24,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "16px 24px",
        background: domain.bg,
        borderBottom: `1px solid ${domain.color}20`,
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: domain.color, margin: 0 }}>
          {domain.label}
        </h3>
        <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
          {domain.computableFormulas} of {domain.totalFormulas} formulas computable from aggregate data
        </p>
      </div>
      <div>
        {domain.results.map((r) => (
          <FormulaRow key={r.formulaId} result={r} domainColor={domain.color} />
        ))}
      </div>
    </div>
  );
}

function FormulaRow({ result, domainColor }: { result: FormulaResult; domainColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[result.status];

  return (
    <div style={{ borderBottom: "1px solid #f1f5f9" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          padding: "12px 24px",
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          textAlign: "left",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{result.label}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {result.ratio !== undefined && (
            <span style={{ fontSize: 13, fontFamily: "var(--font-geist-mono)", fontWeight: 600, color: cfg.color }}>
              {(result.ratio * 100).toFixed(1)}%
            </span>
          )}
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 4,
            background: cfg.bg,
            color: cfg.color,
          }}>
            {cfg.label}
          </span>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </button>
      {expanded && (
        <div style={{ padding: "0 24px 16px", fontSize: 12, color: "#475569", lineHeight: 1.8 }}>
          <div style={{ marginBottom: 4 }}>
            <strong>Formula:</strong> <code style={{ fontSize: 11, background: "#f8fafc", padding: "1px 4px", borderRadius: 3 }}>{result.description}</code>
          </div>
          <div style={{ marginBottom: 4 }}>
            <strong>Note:</strong> {result.note}
          </div>
          {result.numerator !== undefined && result.denominator !== undefined && (
            <div style={{ marginBottom: 4 }}>
              <strong>Computed:</strong>{" "}
              <span style={{ fontFamily: "var(--font-geist-mono)" }}>
                {result.numerator.toLocaleString()} / {result.denominator.toLocaleString()}
                {result.ratio !== undefined && ` = ${(result.ratio * 100).toFixed(2)}%`}
              </span>
            </div>
          )}
          {result.benchmark !== undefined && (
            <div style={{ marginBottom: 4 }}>
              <strong>Benchmark:</strong>{" "}
              <span style={{ fontFamily: "var(--font-geist-mono)" }}>
                {result.benchmarkOp === "lt" ? "<" : result.benchmarkOp === "lte" ? "≤" : result.benchmarkOp === "gt" ? ">" : "≥"}{" "}
                {(result.benchmark * 100).toFixed(1)}%
              </span>
            </div>
          )}
          {result.benchmarkRange && (
            <div style={{ marginBottom: 4 }}>
              <strong>Benchmark range:</strong>{" "}
              <span style={{ fontFamily: "var(--font-geist-mono)" }}>
                {(result.benchmarkRange[0] * 100).toFixed(0)}% – {(result.benchmarkRange[1] * 100).toFixed(0)}%
              </span>
            </div>
          )}
          {result.explanation && (
            <div style={{ marginTop: 4, padding: "8px 12px", background: "#f8fafc", borderRadius: 6, color: "#64748b", fontStyle: "italic" }}>
              {result.explanation}
            </div>
          )}
        </div>
      )}
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
