"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLE_NPIS = [
  { npi: "1790045821", name: "Brandon Lingenfelter, DO, PhD", specialty: "OB/GYN, Princeton, WV" },
];

export default function ScorePage() {
  const [npi, setNpi] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = npi.replace(/\D/g, "");
    if (cleaned.length !== 10) {
      setError("NPI must be exactly 10 digits");
      return;
    }
    setError("");
    router.push(`/score/${cleaned}`);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "var(--font-geist-sans)" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
            Provider Quality Score
          </h1>
          <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.6 }}>
            Enter an NPI to compute clinical quality scores from Medicare &amp; Medicaid claims data.
            <br />
            Scoped to <strong>OB-GYN</strong> &middot; <strong>Clinical Quality</strong> dimension.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={npi}
              onChange={(e) => { setNpi(e.target.value); setError(""); }}
              placeholder="Enter 10-digit NPI..."
              maxLength={10}
              style={{
                flex: 1,
                padding: "12px 16px",
                fontSize: 16,
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                outline: "none",
                fontFamily: "var(--font-geist-mono)",
                letterSpacing: "0.05em",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "12px 24px",
                fontSize: 15,
                fontWeight: 600,
                color: "#fff",
                background: "#0f172a",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Look up
            </button>
          </div>
          {error && (
            <p style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>{error}</p>
          )}
        </form>

        {/* Example NPIs */}
        <div>
          <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
            Example providers
          </p>
          {EXAMPLE_NPIS.map((ex) => (
            <button
              key={ex.npi}
              onClick={() => router.push(`/score/${ex.npi}`)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "16px 20px",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                cursor: "pointer",
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{ex.name}</span>
                  <span style={{ fontSize: 13, color: "#64748b", marginLeft: 12 }}>{ex.specialty}</span>
                </div>
                <code style={{ fontSize: 13, color: "#94a3b8", fontFamily: "var(--font-geist-mono)" }}>{ex.npi}</code>
              </div>
            </button>
          ))}
        </div>

        {/* Footer info */}
        <div style={{ marginTop: 48, padding: 20, background: "#f1f5f9", borderRadius: 8, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
          <strong style={{ color: "#475569" }}>Data sources:</strong> CMS Medicare Physician Utilization (2023) + Medicaid T-MSIS Provider Spending (2023).
          13.6M NPI-HCPCS pairs across 1.6M providers.
          <br /><br />
          <strong style={{ color: "#475569" }}>Scoring:</strong> 50+ quality formulas mapped to CPT codes across 6 clinical domains.
          ~10 formulas computable from aggregate volumes; remaining require patient-level claims.
        </div>
      </div>
    </div>
  );
}
