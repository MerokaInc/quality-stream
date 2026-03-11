"use client";

import { useState } from "react";

// ─── TYPES & DATA ────────────────────────────────────────────────────────────

interface Signal {
  label: string;
  examples: string[];
}

interface QualityDimension {
  step: number;
  label: string;
  subtitle: string;
  color: string;
  bg: string;
  icon: string;
  reality: Signal[];
  standard: Signal[];
  context: Signal[];
  deltaExample: string;
}

const DIMENSIONS: QualityDimension[] = [
  {
    step: 1,
    label: "Clinical Quality",
    subtitle: "Does the provider deliver safe, guideline-concordant care?",
    color: "#1e40af",
    bg: "#eff6ff",
    icon: "🏥",
    reality: [
      { label: "Medicare Utilization", examples: ["CPT volumes", "procedure mix", "C-section rate", "lab ordering patterns"] },
      { label: "MIPS / QPP Scores", examples: ["Quality category", "cost category", "improvement activities"] },
      { label: "CMS Care Compare", examples: ["Hospital quality stars", "HAC penalty flags", "readmission rates"] },
      { label: "Malpractice & Board Actions", examples: ["Civil filings", "disciplinary history", "OIG exclusion status"] },
      { label: "Transparency in Coverage", examples: ["Negotiated rates by CPT", "payer-specific pricing"] },
    ],
    standard: [
      { label: "ACOG Practice Bulletins & CPGs", examples: ["Prenatal visit cadence", "GDM screening at 24–28w", "depression screening"] },
      { label: "HEDIS Measure Specs (NCQA)", examples: ["PPC", "CCS", "CHL", "PND-E", "PDS-E — with CPT value sets"] },
      { label: "Joint Commission Perinatal", examples: ["PC-01 (no elective delivery <39w)", "PC-02 (NTSV C-section <23.6%)"] },
      { label: "ASCCP Guidelines", examples: ["Cervical screening intervals", "colposcopy timeliness", "LEEP appropriateness"] },
      { label: "CMS E/M Benchmarks", examples: ["99215 <25% of office E/M", "modifier -25 compliance"] },
    ],
    context: [
      { label: "Regional Baseline", examples: ["State/county median C-section rate", "regional MIPS distribution"] },
      { label: "Market Structure", examples: ["Rural vs. urban", "provider density", "nearest competitor distance"] },
      { label: "Patient Population", examples: ["Dual-eligible %", "maternal age distribution", "comorbidity burden"] },
      { label: "Specialty Norms", examples: ["OB/GYN vs. family medicine benchmarks", "surgical vs. primary care E/M patterns"] },
    ],
    deltaExample: "A provider with a 28% C-section rate scores differently in rural WV (regional median 32%) vs. Boston (regional median 22%). The raw delta against the 23.6% standard is the same — but the contextual score diverges.",
  },
  {
    step: 2,
    label: "Bedside Manner",
    subtitle: "How do patients experience the provider interpersonally?",
    color: "#7c3aed",
    bg: "#f5f3ff",
    icon: "🤝",
    reality: [
      { label: "Google Business Reviews", examples: ["Star rating", "review volume", "sentiment themes (wait time, listening, empathy)"] },
      { label: "Press Ganey / CAHPS", examples: ["Communication composite", "provider rating", "likelihood to recommend"] },
      { label: "Healthgrades / Vitals", examples: ["Patient satisfaction scores", "bedside manner sub-scores"] },
      { label: "Practice Website Signals", examples: ["Provider bios emphasizing patient approach", "telehealth availability"] },
    ],
    standard: [
      { label: "CAHPS Benchmarks (CMS)", examples: ["Communication with doctors composite ≥ 80th percentile"] },
      { label: "Press Ganey National Norms", examples: ["Provider communication", "care coordination", "overall rating"] },
      { label: "Meroka Internal Thresholds", examples: ["≥ 4.2 Google stars", "≥ 50 reviews for statistical validity", "no systemic complaint patterns"] },
    ],
    context: [
      { label: "Review Volume Weighting", examples: ["5.0 stars with 8 reviews ≠ 4.7 stars with 1,400 reviews"] },
      { label: "Regional Review Norms", examples: ["Rural providers tend to have fewer reviews but higher ratings"] },
      { label: "Specialty Expectations", examples: ["Surgical specialties benchmarked differently than primary care"] },
    ],
    deltaExample: "A 4.3-star rating with 200+ reviews in a market where the median OB/GYN has 3.8 stars is a strong positive signal. The same 4.3 in a market averaging 4.5 is below-average.",
  },
  {
    step: 3,
    label: "Comfort & Accessibility",
    subtitle: "Is the physical and digital experience modern and welcoming?",
    color: "#047857",
    bg: "#f0fdf4",
    icon: "🏢",
    reality: [
      { label: "Practice Website Scraping", examples: ["Online scheduling", "patient portal", "EHR system (Epic MyChart, etc.)"] },
      { label: "Google Business Profile", examples: ["Photos", "hours of operation", "wheelchair accessibility", "parking"] },
      { label: "Telehealth Availability", examples: ["Video visit option", "async messaging", "remote monitoring"] },
      { label: "Insurance Acceptance", examples: ["Payer panel breadth", "Medicare/Medicaid acceptance"] },
    ],
    standard: [
      { label: "ADA Compliance", examples: ["Physical accessibility", "website accessibility (WCAG)"] },
      { label: "NCQA Patient-Centered Medical Home", examples: ["Care coordination", "access standards", "after-hours availability"] },
      { label: "Meroka Internal Thresholds", examples: ["Online scheduling required", "≤ 48hr new patient wait", "telehealth preferred"] },
    ],
    context: [
      { label: "Market Digital Maturity", examples: ["Rural practices have lower digital adoption baseline"] },
      { label: "Patient Demographics", examples: ["Elderly populations may need physical accessibility weighting"] },
      { label: "Competitive Landscape", examples: ["If all competitors lack online scheduling, absence is less penalizing"] },
    ],
    deltaExample: "A practice without online scheduling in downtown Boston is a red flag (competitors all have it). The same gap in rural WV, where no competitor offers it either, is noted but not penalized as heavily.",
  },
  {
    step: 4,
    label: "Service Accessibility",
    subtitle: "Can patients actually get seen — timely, affordable, and without friction?",
    color: "#b45309",
    bg: "#fffbeb",
    icon: "📍",
    reality: [
      { label: "NPPES + PECOS", examples: ["Practice locations", "accepting new patients flag", "group size"] },
      { label: "HRSA Shortage Designations", examples: ["HPSA score", "MUA flag", "provider-to-population ratio"] },
      { label: "Transparency in Coverage", examples: ["Commercial rates vs. Medicare rates", "rate variance across payers"] },
      { label: "DOL Form 5500", examples: ["Nearby self-insured employers", "plan costs", "potential savings"] },
    ],
    standard: [
      { label: "HRSA Access Benchmarks", examples: ["Provider-to-population ratios by specialty", "drive time thresholds"] },
      { label: "CMS Network Adequacy", examples: ["Time/distance standards by specialty and plan type"] },
      { label: "Meroka Internal Thresholds", examples: ["Cost ≤ 150% of Medicare", "accepting new patients", "≤ 30 min drive for 80% of target population"] },
    ],
    context: [
      { label: "Geographic Isolation", examples: ["30-min drive time means different things in rural vs. urban"] },
      { label: "Specialty Scarcity", examples: ["Only OB/GYN within 60 miles gets weighted differently than one of 40"] },
      { label: "Employer Proximity", examples: ["Relevance to specific self-insured employer populations"] },
      { label: "Cost Benchmarks", examples: ["200% of Medicare is normal in Boston, an outlier in WV"] },
    ],
    deltaExample: "A practice charging 180% of Medicare is expensive in a rural market (regional median 130%) but a bargain in a metro market (regional median 250%). Context flips the score entirely.",
  },
];

// ─── COMPONENT ───────────────────────────────────────────────────────────────

function Arrow({ direction, color }: { direction: "down" | "right" | "left"; color: string }) {
  if (direction === "down") {
    return (
      <svg width="24" height="32" viewBox="0 0 24 32" fill="none" style={{ display: "block", margin: "0 auto" }}>
        <line x1="12" y1="0" x2="12" y2="24" stroke={color} strokeWidth="2.5" strokeDasharray="4 3" />
        <polygon points="5,22 12,31 19,22" fill={color} />
      </svg>
    );
  }
  if (direction === "right") {
    return (
      <svg width="40" height="24" viewBox="0 0 40 24" fill="none" style={{ display: "block" }}>
        <line x1="0" y1="12" x2="30" y2="12" stroke={color} strokeWidth="2.5" strokeDasharray="4 3" />
        <polygon points="28,5 38,12 28,19" fill={color} />
      </svg>
    );
  }
  return (
    <svg width="40" height="24" viewBox="0 0 40 24" fill="none" style={{ display: "block" }}>
      <line x1="40" y1="12" x2="10" y2="12" stroke={color} strokeWidth="2.5" strokeDasharray="4 3" />
      <polygon points="12,5 2,12 12,19" fill={color} />
    </svg>
  );
}

function DimensionDiagram({ dim }: { dim: QualityDimension }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Step header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
          background: dim.color, borderRadius: expanded ? "12px 12px 0 0" : 12,
          padding: "14px 20px", transition: "border-radius 0.2s",
        }}
      >
        <span style={{ fontSize: 26 }}>{dim.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
            Step {dim.step} — {dim.label}
          </div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 2 }}>
            {dim.subtitle}
          </div>
        </div>
        <span style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>{expanded ? "−" : "+"}</span>
      </div>

      {expanded && (
        <div style={{
          border: `2px solid ${dim.color}`, borderTop: "none",
          borderRadius: "0 0 12px 12px", background: "#fff", padding: "24px 20px",
        }}>
          {/* ── CONTEXT BAR (top) ── */}
          <div style={{
            background: "#0f172a", borderRadius: 10, padding: "16px 20px", marginBottom: 6,
            border: "2px solid #334155",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ background: "#f59e0b", color: "#0f172a", fontSize: 11, fontWeight: 800, padding: "2px 10px", borderRadius: 20 }}>CONTEXT LAYER</span>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>Adjusts the delta — same raw score can mean different things</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {dim.context.map((c, i) => (
                <div key={i} style={{ background: "#1e293b", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{c.label}</div>
                  <div style={{ color: "#cbd5e1", fontSize: 11, lineHeight: 1.5 }}>{c.examples.join(" · ")}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Arrows down from context ── */}
          <div style={{ display: "flex", justifyContent: "center", gap: 120, padding: "0 40px" }}>
            <Arrow direction="down" color="#f59e0b" />
            <Arrow direction="down" color="#f59e0b" />
          </div>

          {/* ── REALITY vs STANDARD boxes ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0, alignItems: "center" }}>
            {/* Reality (left) */}
            <div style={{
              background: dim.bg, border: `2px solid ${dim.color}`, borderRadius: 10, padding: "16px 18px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ background: dim.color, color: "#fff", fontSize: 11, fontWeight: 800, padding: "3px 12px", borderRadius: 20 }}>REALITY</span>
                <span style={{ color: "#64748b", fontSize: 11 }}>What the provider actually does</span>
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 1 }}>Public data sources (NPI-linked)</div>
              {dim.reality.map((r, i) => (
                <div key={i} style={{ marginBottom: 8, padding: "8px 10px", background: "#fff", borderRadius: 7, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 12, marginBottom: 2 }}>{r.label}</div>
                  <div style={{ color: "#64748b", fontSize: 11, lineHeight: 1.4 }}>{r.examples.join(" · ")}</div>
                </div>
              ))}
            </div>

            {/* Center comparison arrows */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "0 8px" }}>
              <Arrow direction="right" color={dim.color} />
              <div style={{
                background: dim.color, color: "#fff", fontWeight: 800, fontSize: 11,
                padding: "6px 14px", borderRadius: 20, whiteSpace: "nowrap",
                boxShadow: `0 2px 12px ${dim.color}44`,
              }}>
                DELTA
              </div>
              <Arrow direction="left" color={dim.color} />
            </div>

            {/* Standard (right) */}
            <div style={{
              background: "#f8fafc", border: "2px solid #94a3b8", borderRadius: 10, padding: "16px 18px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ background: "#475569", color: "#fff", fontSize: 11, fontWeight: 800, padding: "3px 12px", borderRadius: 20 }}>STANDARD</span>
                <span style={{ color: "#64748b", fontSize: 11 }}>What the provider should do</span>
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 1 }}>Colleges, guidelines, benchmarks</div>
              {dim.standard.map((s, i) => (
                <div key={i} style={{ marginBottom: 8, padding: "8px 10px", background: "#fff", borderRadius: 7, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 12, marginBottom: 2 }}>{s.label}</div>
                  <div style={{ color: "#64748b", fontSize: 11, lineHeight: 1.4 }}>{s.examples.join(" · ")}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Delta example callout ── */}
          <div style={{
            marginTop: 16, background: "#fffbeb", border: "1px solid #fde68a",
            borderRadius: 8, padding: "12px 16px",
          }}>
            <span style={{ fontWeight: 700, color: "#92400e", fontSize: 12 }}>Example: </span>
            <span style={{ color: "#78350f", fontSize: 12, lineHeight: 1.6 }}>{dim.deltaExample}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

export default function ScoringStrategyPage() {
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#f1f5f9", minHeight: "100vh", padding: "20px 16px" }}>
      <div style={{ maxWidth: 1060, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ background: "#0f172a", borderRadius: 12, padding: "24px 28px", marginBottom: 24 }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 20 }}>
            Meroka Quality Scoring Framework
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 6, lineHeight: 1.6, maxWidth: 720 }}>
            Every provider is scored across four dimensions. Each dimension compares <strong style={{ color: "#60a5fa" }}>reality</strong> (what the provider actually does, from public data) against a <strong style={{ color: "#cbd5e1" }}>standard</strong> (what they should do, from clinical guidelines). The gap is the <strong style={{ color: "#f59e0b" }}>delta</strong> — contextualized by regional, demographic, and market factors before becoming a score.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {DIMENSIONS.map((d) => (
              <span key={d.step} style={{
                background: d.color, color: "#fff", fontSize: 11, fontWeight: 700,
                padding: "4px 12px", borderRadius: 20,
              }}>
                {d.step}. {d.label}
              </span>
            ))}
          </div>
        </div>

        {/* How it works — small legend */}
        <div style={{
          background: "#fff", borderRadius: 10, padding: "14px 20px", marginBottom: 20,
          border: "1px solid #e2e8f0", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center",
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>How to read each diagram:</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ background: "#1e40af", width: 14, height: 14, borderRadius: 4, display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "#475569" }}>Reality = observed provider behavior from public data</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ background: "#475569", width: 14, height: 14, borderRadius: 4, display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "#475569" }}>Standard = clinical guidelines & benchmarks we encode</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ background: "#f59e0b", width: 14, height: 14, borderRadius: 4, display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "#475569" }}>Context = regional/demographic factors that adjust the delta</span>
          </div>
        </div>

        {/* Dimensions */}
        {DIMENSIONS.map((d) => (
          <DimensionDiagram key={d.step} dim={d} />
        ))}

        {/* Composite score footer */}
        <div style={{
          background: "#0f172a", borderRadius: 12, padding: "20px 24px", marginTop: 8,
        }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
            Composite Provider Score
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7 }}>
            Each dimension produces a 0–100 score. The composite is a weighted blend — Clinical Quality carries the highest weight (it&apos;s the only dimension with hard safety flags that can force &quot;Not Recommended&quot; regardless of other scores). Final output is a tier: <span style={{ color: "#16a34a", fontWeight: 700 }}>Recommended</span>, <span style={{ color: "#d97706", fontWeight: 700 }}>Conditional</span>, or <span style={{ color: "#dc2626", fontWeight: 700 }}>Not Recommended</span>.
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14,
          }}>
            {DIMENSIONS.map((d) => (
              <div key={d.step} style={{
                background: d.color, borderRadius: 8, padding: "10px 14px", textAlign: "center",
              }}>
                <div style={{ fontSize: 22 }}>{d.icon}</div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 12, marginTop: 4 }}>{d.label}</div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 }}>
                  {d.step === 1 ? "Weight: 40%" : d.step === 2 ? "Weight: 20%" : d.step === 3 ? "Weight: 15%" : "Weight: 25%"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
