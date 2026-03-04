"use client";

import { useState } from "react";

// ─── DATA ────────────────────────────────────────────────────────────────────

const PROVIDER: Record<string, string> = {
  "Name": "Brandon M. Lingenfelter, DO, PhD",
  "NPI (Individual)": "1790045821",
  "NPI (Entity/PLLC)": "1619842465",
  "Specialty": "Obstetrics & Gynecology",
  "License Type": "Osteopathic Physician (DO)",
  "Licensing Board": "WV Board of Osteopathic Medicine",
  "Board Certification": "ABOG — Obstetrics & Gynecology",
  "Medical Education": "West Virginia School of Osteopathic Medicine, 2012",
  "PhD": "Reproductive Physiology, West Virginia University",
  "Residency": "Tower Health / Reading Hospital, Ob/Gyn, 2012–2016",
  "Hospital Affiliation": "WVU Medicine Princeton Community Hospital",
  "Practice Location": "411 12th St Ext, Princeton, WV + Wytheville, VA",
  "Years in Practice": "~14 years",
  "Professional Societies": "ACOG Member, AAGL Member",
  "Publications": "3 peer-reviewed (JMIG ×2, JGME ×1) — robotic mesh, sacrocolpopexy, CREOG outcomes",
  "Awards": "Women's Choice Award Best Doctor, 2023",
  "Patient Ratings": "5.0 stars Healthline; 1,396 Press Ganey reviews (US News)",
};

interface BundleSignal { label: string; type: "positive" | "negative" | "unknown"; }
interface BundleScore {
  id: string; label: string; score: number; tier: string;
  color: string; icon: string; signals: BundleSignal[];
  rationale: string; claimsUpside: string; claimsDownside: string;
}

const BUNDLE_SCORES: BundleScore[] = [
  {
    id: "maternity", label: "Maternity & Global OB", score: 71, tier: "Conditional",
    color: "#1e40af", icon: "🤰",
    signals: [
      { label: "Board certified OB/GYN with 14 yrs experience", type: "positive" },
      { label: "PhD in reproductive physiology — deep clinical knowledge", type: "positive" },
      { label: "Affiliated with WVU Medicine Princeton Community Hospital", type: "positive" },
      { label: "Treats depression-in-pregnancy at above-average rate (WebMD)", type: "positive" },
      { label: "2018 malpractice case — alleged failure to evaluate fetal heart issue, resulting in neonatal death", type: "negative" },
      { label: "Outcome of 2018 case unknown — records request pending", type: "unknown" },
      { label: "C-section rate vs. NTSV benchmark: unverified without claims data", type: "unknown" },
      { label: "HEDIS PPC (prenatal/postpartum timeliness): unverified without claims data", type: "unknown" },
    ],
    rationale: "Strong credentials and experience, but the 2018 fetal monitoring malpractice case is a material risk flag for a maternity bundle. Score will move significantly — up or down — once claims data validates C-section rate and prenatal completeness metrics.",
    claimsUpside: "Score upgrades to ~85 if C-section rate < 25% and postpartum visit rate > 90%.",
    claimsDownside: "Score drops to ~50 if C-section rate > 35% or early elective deliveries found.",
  },
  {
    id: "gyn_surgery", label: "GYN Surgery", score: 83, tier: "Recommended",
    color: "#be185d", icon: "🔬",
    signals: [
      { label: "2 published papers in JMIG on robotic procedures — above-average surgical expertise", type: "positive" },
      { label: "AAGL member — association focused on minimally invasive GYN surgery", type: "positive" },
      { label: "Known expertise in robotic mesh resection and sacrocolpopexy", type: "positive" },
      { label: "No documented surgical adverse events or board actions found", type: "positive" },
      { label: "MIS hysterectomy rate: unverified — expected high given robotic publications", type: "unknown" },
      { label: "Complication / return-to-OR rate: unverified without claims data", type: "unknown" },
    ],
    rationale: "Best-in-class credentials for GYN surgery within a small market. Robotic surgery expertise is rare in rural WV — meaningful differentiation. Score held back only by absence of claims-validated outcomes.",
    claimsUpside: "Score upgrades to ~92 if MIS rate > 85% and 30-day complication proxy < 5%.",
    claimsDownside: "Score drops to ~65 if open hysterectomy rate > 25% of benign cases.",
  },
  {
    id: "preventive", label: "Preventive GYN & Well-Woman", score: 76, tier: "Recommended",
    color: "#047857", icon: "🩺",
    signals: [
      { label: "ACOG member — adherence to preventive care guidelines expected", type: "positive" },
      { label: "5.0 stars / 1,396 Press Ganey reviews — strong patient continuity signal", type: "positive" },
      { label: "Women's Choice Award Best Doctor 2023", type: "positive" },
      { label: "Vitamin D testing rate flagged as above-average (WebMD) — potential over-ordering", type: "negative" },
      { label: "Thyroid testing rate flagged as above-average (WebMD) — not ACOG-guideline-concordant for routine screening", type: "negative" },
      { label: "Cervical cancer screening rate (HEDIS CCS): unverified without claims data", type: "unknown" },
      { label: "Chlamydia screening rate (HEDIS CHL) for ages 16–24: unverified", type: "unknown" },
    ],
    rationale: "Strong patient-facing quality signals. Lab over-ordering is a cost concern but not a patient safety issue per se. Preventive visit adherence likely strong given patient ratings and panel continuity.",
    claimsUpside: "Score upgrades to ~88 if CCS rate > 75% and no over-screening flags confirmed.",
    claimsDownside: "Score drops to ~60 if vitamin D / thyroid over-ordering confirmed at scale without documented indications.",
  },
  {
    id: "cervical", label: "Cervical Cancer Screening & Colposcopy", score: 74, tier: "Conditional",
    color: "#7c3aed", icon: "🔍",
    signals: [
      { label: "ACOG member — expected guideline adherence on screening intervals", type: "positive" },
      { label: "ASCCP colposcopy / LEEP competency expected given OB/GYN board certification", type: "positive" },
      { label: "No specific over-screening or colposcopy overuse flags in public data", type: "positive" },
      { label: "Screening interval compliance (q3yr / q5yr): unverified without claims data", type: "unknown" },
      { label: "LEEP rate per colposcopy: unverified — key signal for over/under-treatment", type: "unknown" },
      { label: "Post-LEEP test-of-cure compliance: unverified", type: "unknown" },
    ],
    rationale: "No red flags, but this bundle is the most claims-dependent of all. Cervical screening quality is almost entirely a data story — interval compliance, biopsy rates, and LEEP appropriateness can't be assessed from credentials alone.",
    claimsUpside: "Score upgrades to ~88 if screening rate > 75% and no over-screening < age 21 found.",
    claimsDownside: "Score drops to ~55 if LEEP-without-colposcopy cases found or CIN1 over-treatment confirmed.",
  },
  {
    id: "womens_health", label: "Women's Health (General)", score: 80, tier: "Recommended",
    color: "#0e7490", icon: "💊",
    signals: [
      { label: "Solo/PLLC practice — independent, not PE-owned or hospital-employed", type: "positive" },
      { label: "Accepts major commercial plans + Medicare + Medicaid", type: "positive" },
      { label: "Telehealth offered — access and continuity signal", type: "positive" },
      { label: "5.0 patient rating across 1,396 reviews — consistent patient experience", type: "positive" },
      { label: "No disciplinary actions found on public record", type: "positive" },
      { label: "One WebMD review flagging office staff medication miscommunication", type: "negative" },
      { label: "MIPS/QPP quality score: unverified", type: "unknown" },
    ],
    rationale: "The clearest case for marketplace inclusion. Independent practice, strong patient ratings, no disciplinary history, broad insurance acceptance. This is the Meroka thesis in action — independent practice with demonstrable quality signal.",
    claimsUpside: "Score upgrades to ~92 if MIPS quality score > 70 and E/M distribution is normal.",
    claimsDownside: "Score drops to ~65 if E/M upcoding pattern (>35% 99215) confirmed in claims.",
  },
];

const TIER_CONFIG: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  "Recommended": { bg: "#f0fdf4", border: "#86efac", text: "#166534", badge: "#16a34a" },
  "Conditional":  { bg: "#fffbeb", border: "#fde68a", text: "#78350f", badge: "#d97706" },
  "Not Recommended": { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", badge: "#dc2626" },
};

interface CredentialFlag { category: string; status: string; flag: string; detail: string; }
const CREDENTIAL_FLAGS: CredentialFlag[] = [
  { category: "Licensure", status: "Active", flag: "green", detail: "WV Board of Osteopathic Medicine — license active, no publicly visible revocations. Regulated by WVBOM Osteo (not WVBOM MD board). Verify directly at wvbdosteo.org/verify." },
  { category: "Board Certification", status: "Verified", flag: "green", detail: "Board certified by ABOG. Active member ACOG + AAGL." },
  { category: "Malpractice — 2018 Civil Case", status: "⚠ Filed", flag: "yellow", detail: "Thompson/Triplett v. Lingenfelter et al., Mercer County Circuit Court, filed May 2018. Allegation: failure to properly evaluate fetal heart issue resulting in newborn death (Skylar Jade Triplett). Co-defendants: Princeton Community Hospital, RN Watson, RN Bradshaw. Case outcome not in public record — requires direct Mercer County court records request or PACER search." },
  { category: "Disciplinary History", status: "None Found", flag: "green", detail: "No public disciplinary actions found via FSMB DocInfo path or WV Osteo Board public records. Recommend direct verification at wvbdosteo.org/verify." },
  { category: "OIG LEIE Exclusion", status: "Verify Required", flag: "blue", detail: "No exclusion found in public search. Confirm against OIG LEIE at exclusions.oig.hhs.gov using NPI 1790045821 before contracting." },
  { category: "CMS MIPS / QPP", status: "Check Required", flag: "blue", detail: "Quality Payment Program performance score not retrieved. Check qpp.cms.gov/participantLookup — MIPS composite score and quality category performance are key independent quality signals." },
  { category: "Patient Reviews", status: "Positive", flag: "green", detail: "5.0 stars on Healthline. 1,396 Press Ganey reviews via US News. One WebMD review flagged medication error by office staff (not clinical). No systemic clinical quality complaints identified." },
  { category: "Utilization Outliers (WebMD)", status: "⚠ Flagged", flag: "yellow", detail: "WebMD procedure frequency data shows Dr. Lingenfelter performs thyroid hormone tests, Vitamin D tests, and urinalysis significantly more than most providers. Requires claims-level validation against ACOG guidelines." },
];

interface DataSource { source: string; data: string; status: string; url: string; }
const DATA_SOURCES: DataSource[] = [
  { source: "NPPES", data: "NPI, taxonomy, practice address, entity NPI", status: "Confirmed", url: "npiregistry.cms.hhs.gov" },
  { source: "CMS Medicare Utilization", data: "Procedure volumes, charge/payment amounts, patient counts by CPT", status: "Available", url: "data.cms.gov/provider-summary-by-type-of-service" },
  { source: "WV Board of Osteopathic Medicine", data: "License status, discipline history 1991+, public docs 2010+", status: "Verify Directly", url: "wvbdosteo.org/verify" },
  { source: "FSMB DocInfo", data: "Multi-state disciplinary history across all licensed states", status: "Verify Directly", url: "docinfo.org" },
  { source: "OIG LEIE", data: "Federal exclusion status — required before contracting", status: "Verify Directly", url: "exclusions.oig.hhs.gov" },
  { source: "Mercer County Circuit Court (WV)", data: "2018 malpractice filing — outcome unknown", status: "⚠ Records Request Needed", url: "courtswv.gov" },
  { source: "CMS MIPS / QPP Portal", data: "Quality Payment Program composite + quality category scores", status: "Check Required", url: "qpp.cms.gov/participantLookup" },
  { source: "Doximity / US News", data: "Board cert, hospital affiliation, patient ratings (Press Ganey), publications", status: "Confirmed", url: "health.usnews.com/doctors/brandon-lingenfelter-3212897" },
  { source: "ACOG Clinical Guidance", data: "Practice Bulletins, CPGs, Committee Opinions — CPT-mapped standards", status: "Integrated", url: "acog.org/clinical" },
  { source: "HEDIS MY 2025 (NCQA)", data: "PPC, CCS, CHL, PND-E, PDS-E measure specifications + CPT value sets", status: "Integrated", url: "ncqa.org" },
  { source: "ASCCP 2019 Guidelines", data: "Cervical cancer screening & colposcopy management algorithms", status: "Integrated", url: "asccp.org/guidelines" },
  { source: "Joint Commission Perinatal Care", data: "PC-01 (elective delivery <39w), PC-02 (NTSV C-section rate)", status: "Integrated", url: "jointcommission.org" },
];

interface Formula { label: string; flag: "red" | "yellow" | "green" | "blue"; formula: string; note: string; }
interface CptCode { cpt: string; desc: string; standard: string; formulas: Formula[]; }
interface Domain { id: string; label: string; color: string; bg: string; codes: CptCode[]; }

const DOMAINS: Domain[] = [
  {
    id: "prenatal", label: "Prenatal & Global OB", color: "#1e40af", bg: "#eff6ff",
    codes: [
      { cpt: "59400", desc: "Global OB — Vaginal Delivery", standard: "Includes ≥7 antepartum visits, delivery, and 1 postpartum visit.", formulas: [
        { label: "Postpartum Visit Rate", flag: "yellow", formula: "COUNT(59430 or 99211–99215 with Z39.2 within 7–84d of delivery) / COUNT(59400) → Benchmark ≥ 0.90", note: "Rate < 0.75 = HEDIS PPC fail" },
        { label: "First Trimester Entry Rate", flag: "yellow", formula: "COUNT(first prenatal visit with EGA ≤ 13w6d) / COUNT(59400) → Benchmark ≥ 0.77", note: "Rate < 0.60 = potential late-entry pattern" },
        { label: "Antepartum Visit Adequacy", flag: "red", formula: "COUNT(59426 billed) / COUNT(59400) → Expected ≈ 1.00", note: "Ratio < 0.80: under-billing or skipped visits" },
        { label: "Global OB Unbundling Flag", flag: "red", formula: "COUNT(59409 or 59410 same patient same date as 59400) > 0 → Flag ALL", note: "59409/59410 must not appear when 59400 billed same episode" },
      ]},
      { cpt: "59514 / 59515", desc: "C-Section — Primary / with Postpartum Care", standard: "NTSV C-section target < 23.6% (Joint Commission PC-02). Elective delivery < 39w is a never-event (PC-01).", formulas: [
        { label: "NTSV C-Section Rate", flag: "red", formula: "COUNT(59514+59515 with O82 + nulliparous flag) / COUNT(all singleton term vertex deliveries) → Benchmark < 0.236", note: "Rate > 0.30 = significant outlier" },
        { label: "C-Section to Vaginal Ratio", flag: "yellow", formula: "COUNT(59514+59515+59618+59620) / COUNT(59400+59409+59610+59612) → Benchmark < 0.40", note: "Ratio > 0.50 warrants chart review" },
        { label: "Early Elective Delivery Flag (PC-01)", flag: "red", formula: "COUNT(delivery at 37w0d–38w6d AND no documented indication) → Target = 0", note: "Joint Commission reportable event" },
        { label: "TOLAC Rate", flag: "yellow", formula: "COUNT(59618+59620) / COUNT(patients with prior 59514) → Expected ≥ 0.20 TOLAC attempts", note: "Rate < 0.10 may signal inadequate ACOG TOLAC counseling" },
      ]},
      { cpt: "59430", desc: "Postpartum Care Only", standard: "Required within 7–84 days of delivery. HEDIS PPC anchor.", formulas: [
        { label: "Postpartum Timing Compliance", flag: "yellow", formula: "COUNT(59430 or E/M Z39.2 in [delivery+7d, delivery+84d]) / COUNT(deliveries) → Benchmark ≥ 0.90", note: "< 0.75 = HEDIS PPC fail" },
        { label: "Depression Screen at Postpartum", flag: "yellow", formula: "COUNT(96127 within 30d of 59430) / COUNT(59430) → Benchmark ≥ 0.85", note: "Absence = missed HEDIS PDS-E opportunity" },
      ]},
      { cpt: "82950 / 82951", desc: "Gestational Diabetes Screen", standard: "Universal GDM screening at 24–28 weeks.", formulas: [
        { label: "GDM Screening Rate", flag: "yellow", formula: "COUNT(82950+82951 at 24–28w) / COUNT(prenatal patients) → Benchmark ≥ 0.95", note: "Rate < 0.85 = workflow failure" },
        { label: "GDM Post-Delivery Re-Screen", flag: "red", formula: "COUNT(82951 or 83036 at 4–12w postpartum) / COUNT(O24.4x patients) → Benchmark ≥ 0.90", note: "Well-known care gap and ACOG quality indicator" },
      ]},
    ]
  },
  {
    id: "cervical", label: "Cervical Screening & Colposcopy", color: "#7c3aed", bg: "#f5f3ff",
    codes: [
      { cpt: "88141 / 88142 / 88175", desc: "Cervical Cytology — Pap Smear", standard: "q3yr cytology alone age 21–29; q5yr co-test age 30–65. No screening < 21.", formulas: [
        { label: "CCS Screening Rate", flag: "yellow", formula: "COUNT(patients 21–64 with Pap in 3yr window) / COUNT(eligible females 21–64) → Benchmark ≥ 0.75", note: "Rate < 0.65 = HEDIS underperformance" },
        { label: "Over-Screening < 21 Flag", flag: "red", formula: "COUNT(Pap where patient_age < 21) → Target = 0", note: "ACOG contraindicates screening < 21" },
        { label: "Annual Pap Flag (Over-Screening)", flag: "red", formula: "COUNT(patients with Pap 2 consecutive years, avg-risk, age 21–29) → Target = 0", note: "Violates ACOG q3yr guidance" },
        { label: "Pap Without HPV Co-Test Age 30–65", flag: "yellow", formula: "COUNT(88141/88142 with NO 87624 same DOS, age 30–65) / COUNT(Paps age 30–65) → Benchmark < 0.20", note: "Co-testing preferred at 30–65" },
      ]},
      { cpt: "87624 / 87625", desc: "hrHPV Testing", standard: "Co-testing at 30–65 q5yr. Not indicated < 25. 87625 only after positive 87624.", formulas: [
        { label: "HPV Testing < 25 Flag", flag: "red", formula: "COUNT(87624+87625 where age < 25 AND no abnormal cytology) → Target = 0", note: "Not recommended < 25" },
        { label: "87625 Without Prior 87624", flag: "red", formula: "COUNT(87625 with NO 87624 within 90d) → Target = 0", note: "Genotyping only after confirmed hrHPV positive" },
      ]},
      { cpt: "57420 / 57421", desc: "Colposcopy", standard: "ASCCP: Colposcopy within 90 days for ASC-H, HSIL, AGC, or HPV16/18 positive.", formulas: [
        { label: "Colposcopy Timeliness", flag: "yellow", formula: "AVG(57420/57421 DOS − abnormal Pap DOS) → Benchmark ≤ 90 days", note: "Avg > 180 days for HSIL = serious quality failure" },
        { label: "Biopsy Rate at Colposcopy", flag: "yellow", formula: "COUNT(57421) / COUNT(57420+57421) → Benchmark ≥ 0.85", note: "Low rate may indicate incomplete evaluation" },
        { label: "Colposcopy Without Antecedent Abnormal", flag: "red", formula: "COUNT(57420+57421 with NO R87.6xx in prior 12m) → Flag all", note: "Potential overutilization" },
      ]},
      { cpt: "57461 / 57460", desc: "LEEP/LLETZ", standard: "ACOG: LEEP for CIN2+ or persistent CIN1 > 24m. Not for first-detection CIN1.", formulas: [
        { label: "LEEP Rate per Colposcopy", flag: "yellow", formula: "COUNT(57461+57460) / COUNT(57420+57421) → Benchmark 0.20–0.40", note: "Rate > 0.50 = potential over-treatment" },
        { label: "LEEP Without Prior Colposcopy", flag: "red", formula: "COUNT(57461+57460 with NO 57420+57421 in prior 6m) → Target = 0", note: "Skipping required diagnostic step" },
        { label: "LEEP for CIN1 Flag", flag: "red", formula: "COUNT(57461+57460 where N87.0 AND no CIN2+ history) → Target = 0", note: "Immediate LEEP for CIN1 = overtreatment" },
        { label: "Post-LEEP Follow-Up Compliance", flag: "yellow", formula: "COUNT(87624 or 88142 at 4–6m post-57461) / COUNT(57461) → Benchmark ≥ 0.90", note: "Test-of-cure required per ASCCP" },
      ]},
    ]
  },
  {
    id: "surgery", label: "Surgical — Hysterectomy & MIS", color: "#be185d", bg: "#fdf2f8",
    codes: [
      { cpt: "58150", desc: "Total Abdominal Hysterectomy — Open", standard: "Open should be < 15% of benign hysterectomies. ACOG/AAGL prefer MIS.", formulas: [
        { label: "Open Hysterectomy Rate (Benign)", flag: "red", formula: "COUNT(58150 where ICD-10 NOT C53–C57) / COUNT(all hysterectomy codes) → Benchmark < 0.15", note: "Rate > 0.25 = significant outlier" },
        { label: "30-Day Complication Proxy", flag: "yellow", formula: "COUNT(99231–99233 or ED visit within 30d of 58150) / COUNT(58150) → Benchmark < 0.08", note: "Post-op inpatient or ED within 30d = complication proxy" },
        { label: "Unplanned Return to OR", flag: "red", formula: "COUNT(second OR procedure within 14d of 58150, same patient) / COUNT(58150) → Benchmark < 0.02", note: "Leapfrog/CMS patient safety indicator" },
      ]},
      { cpt: "58570 / 58571 / 58572 / 58573", desc: "Laparoscopic/Robotic Hysterectomy", standard: "Target ≥ 85% of benign hysterectomies via MIS route.", formulas: [
        { label: "MIS Hysterectomy Rate", flag: "yellow", formula: "COUNT(58550+58552+58570+58571+58572+58573) / COUNT(all hysterectomy codes) → Benchmark ≥ 0.85", note: "Rate < 0.70 = red flag given robotic expertise" },
        { label: "Robotic vs. Laparoscopic Mix", flag: "yellow", formula: "COUNT(58572+58573 with robotic facility code) / COUNT(all MIS hysterectomy) → Context-dependent", note: "High robotic rate (> 0.60) adds ~$3–5K/case — flag for cost analysis" },
        { label: "Concurrent Repair Without Indication", flag: "red", formula: "COUNT(57240+51840 with 58570+ where NO N81.x or N39.3) → Flag all", note: "Prolapse repair without diagnosis = potential overutilization" },
        { label: "Opportunistic Salpingectomy Rate", flag: "yellow", formula: "COUNT(58661 or 58571 same DOS as hysterectomy) / COUNT(premenopausal hysterectomies) → Benchmark ≥ 0.70", note: "< 0.40 = missed cancer-prevention opportunity" },
      ]},
    ]
  },
  {
    id: "preventive", label: "Preventive & Well-Woman", color: "#047857", bg: "#f0fdf4",
    codes: [
      { cpt: "99395 / 99396 / 99397", desc: "Preventive Well-Woman Exam", standard: "Annual well-woman exam is ACOG cornerstone.", formulas: [
        { label: "Annual Preventive Visit Rate", flag: "yellow", formula: "COUNT(unique patients with 99395+99396+99397) / COUNT(active female patients) → Benchmark ≥ 0.65", note: "Low rate may indicate scheduling gap or undercoding" },
        { label: "Preventive + Problem E/M Without -25", flag: "red", formula: "COUNT(99395–99397 same DOS as 99213–99215 without -25 modifier) → Target = 0", note: "Missing modifier = billing error" },
        { label: "Age Code Mismatch", flag: "red", formula: "COUNT(99395 where age > 39, 99396 where age < 40 or > 64, 99397 where age < 65) → Target = 0", note: "Auditable upcoding or clerical error" },
        { label: "Chlamydia Screen at Preventive (HEDIS CHL)", flag: "yellow", formula: "COUNT(87491 within 30d of 99395, age 16–24) / COUNT(99395 age 16–24) → Benchmark ≥ 0.60", note: "HEDIS CHL care gap if low" },
      ]},
      { cpt: "96127", desc: "Brief Emotional / Behavioral Assessment (PHQ-2, EPDS)", standard: "ACOG CPG No. 4 & 5: Screen at first prenatal visit, once more during pregnancy, and postpartum.", formulas: [
        { label: "Prenatal Depression Screen Rate", flag: "yellow", formula: "COUNT(patients with 96127 in first two prenatal visits) / COUNT(prenatal patients) → Benchmark ≥ 0.85", note: "< 0.70 = HEDIS PND-E underperformance" },
        { label: "Postpartum Depression Screen Rate", flag: "yellow", formula: "COUNT(96127 within 30d of postpartum visit) / COUNT(postpartum visits 7–84d) → Benchmark ≥ 0.85", note: "Highest-yield HEDIS gap for OB/GYN" },
        { label: "Positive Screen Follow-Up Rate", flag: "red", formula: "COUNT(positive 96127 + 99484 or MH referral within 30d) / COUNT(positive screens) → Benchmark ≥ 0.80", note: "Positive screen without follow-up = ACOG CPG violation" },
      ]},
    ]
  },
  {
    id: "labs", label: "Lab Utilization Patterns", color: "#b45309", bg: "#fffbeb",
    codes: [
      { cpt: "84436 / 84439 / 84443", desc: "Thyroid Tests", standard: "ACOG: TSH only for symptomatic or high-risk patients. Universal screening NOT recommended.", formulas: [
        { label: "Thyroid Test Rate vs. Prenatal Population", flag: "red", formula: "COUNT(84436+84439+84443) / COUNT(prenatal patients) → Flag if > 1.5 tests per prenatal patient", note: "WebMD flags this as significant outlier for Dr. Lingenfelter" },
        { label: "TSH Repeat Without Thyroid Diagnosis", flag: "red", formula: "COUNT(84443 > 2x per patient per year with NO E00–E07) → Flag if > 15% of patients", note: "Potential overutilization; payer audit risk" },
      ]},
      { cpt: "82306 / 82652", desc: "Vitamin D", standard: "ACOG/USPSTF: Routine Vitamin D screening NOT recommended in low-risk women.", formulas: [
        { label: "Vitamin D Test Rate", flag: "red", formula: "COUNT(82306+82652) / COUNT(unique OB/GYN patients per year) → Flag if > 0.40", note: "WebMD flags above-average; routine screening not recommended" },
        { label: "Annual Repeat Without Deficiency Dx", flag: "yellow", formula: "COUNT(82306 in 2 consecutive years, same patient, no E55.x) → Benchmark < 0.20 of tested patients", note: "Reflexive ordering; CMS audit target" },
      ]},
      { cpt: "81000 / 81003", desc: "Urinalysis", standard: "Urine dipstick at each prenatal visit is standard. Non-prenatal urinalysis needs documented indication.", formulas: [
        { label: "Prenatal Urinalysis Frequency", flag: "green", formula: "COUNT(81000+81003) / COUNT(antepartum visits) → Benchmark 0.85–1.00", note: "Expected near 1:1 ratio" },
        { label: "Non-Prenatal Urinalysis Rate", flag: "yellow", formula: "COUNT(81000+81003 for non-pregnant patients) / COUNT(non-pregnant visits) → Benchmark < 0.25", note: "High rate in non-prenatal patients warrants indication review" },
      ]},
    ]
  },
  {
    id: "em", label: "E/M & Billing Integrity", color: "#0e7490", bg: "#ecfeff",
    codes: [
      { cpt: "99213 / 99214 / 99215", desc: "Office E/M — Low / Moderate / High Complexity", standard: "Bell curve: 99213 ~25%, 99214 ~55%, 99215 ~20% for OB/GYN.", formulas: [
        { label: "E/M Level Distribution", flag: "yellow", formula: "COUNT(99215) / COUNT(99213+99214+99215) → CMS benchmark: 99215 < 0.25 for OB/GYN", note: "Rate > 0.35 = CMS audit trigger" },
        { label: "99215 Without High-Complexity Indicators", flag: "red", formula: "COUNT(99215 where NO complex ICD-10 AND < 40 min documented) → Flag if > 20% of 99215", note: "Post-2021 E/M: 99215 requires high MDM or ≥40 min total time" },
        { label: "E/M + Procedure Same Day Without -25", flag: "red", formula: "COUNT(99213–99215 same DOS as procedure CPT without modifier -25) → Target = 0", note: "Missing modifier = overpayment" },
      ]},
    ]
  },
];

const FLAG_COLORS: Record<string, { bg: string; border: string; text: string; badge: string; label: string }> = {
  red:    { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", badge: "#dc2626", label: "🔴 HIGH" },
  yellow: { bg: "#fffbeb", border: "#fde68a", text: "#78350f", badge: "#d97706", label: "🟡 MODERATE" },
  green:  { bg: "#f0fdf4", border: "#bbf7d0", text: "#14532d", badge: "#16a34a", label: "🟢 EXPECTED" },
  blue:   { bg: "#eff6ff", border: "#bfdbfe", text: "#1e3a8a", badge: "#2563eb", label: "🔵 VERIFY" },
};

const TABS = ["Provider Profile", "Credential Flags", "Data Sources", "CPT Quality Intelligence", "Claims Mapping Guide"];

const CLAIMS_STEPS = [
  { title: "Step 1 — Data Integrity Checks", color: "#7c3aed", steps: ["Confirm NPI 1790045821 returns records; also check entity NPI 1619842465 for PLLC-billed claims", "Validate procedure code universe matches expected OB/GYN taxonomy — flag any CPTs outside specialty range", "Check urinalysis (81003) rate in prenatal patients — should be ~1:1 with antepartum visits; if < 0.70, data may be incomplete", "Confirm global OB code (59400) presence — if absent and only component codes appear, the data extract may be truncated"] },
  { title: "Step 2 — Prenatal Care Completeness (HEDIS PPC)", color: "#1e40af", steps: ["Pull all global OB patients via 59400/59410/59514/59515 with DOS in measurement year", "For each patient: (a) date of first prenatal visit vs. LMP-derived EGA, (b) whether 59426 was billed, (c) postpartum visit within 7–84d", "Compute: first-trimester entry rate, antepartum adequacy ratio, postpartum visit rate — compare each to HEDIS PPC benchmarks", "Flag: any patient with 59400 but NO 59426 — either under-billing or skipped antepartum visits", "Cross-reference: GDM screen (82950) in 24–28w window; depression screen (96127) at first visit and postpartum"] },
  { title: "Step 3 — C-Section & Delivery Quality (PC-01, PC-02)", color: "#be185d", steps: ["Compute overall C-section ratio: (59514+59515+59618+59620) / all delivery codes", "Isolate NTSV cohort using ICD-10 O82 + nulliparous/singleton/vertex/term diagnosis refinement — compute NTSV rate vs. 23.6% benchmark", "Flag any delivery < 39 weeks gestational age without documented medical indication (PC-01 never-event)", "Context: given the 2018 fetal monitoring malpractice case, pay particular attention to intrapartum fetal monitoring documentation proxies in claims"] },
  { title: "Step 4 — Surgical Quality (Hysterectomy Mix)", color: "#be185d", steps: ["Pull all hysterectomy codes — compute MIS rate: (58550+58552+58570+58571+58572+58573) / all hysterectomy codes → benchmark ≥ 0.85", "Given JMIG robotic publications, if open rate > 15% of benign hysterectomies, that is a stronger red flag than for most OB/GYNs", "Proxy for complications: 99231–99233 or ED CPTs within 30d of any surgical procedure for same patient"] },
  { title: "Step 5 — Lab Utilization Outliers", color: "#b45309", steps: ["Compute: thyroid tests (84443) per prenatal patient — flag if > 1.5x per patient; WebMD already flags this as above-average", "Compute: Vitamin D tests (82306) / total OB/GYN patients — flag if > 40% of patients tested", "For each flagged lab: check whether corresponding diagnosis (E00–E07 for thyroid, E55.x for Vitamin D) is present on same or proximate claim", "Run urinalysis rate for non-pregnant patients separately — should be < 0.25 of non-prenatal visits"] },
  { title: "Step 6 — E/M Billing Integrity", color: "#0e7490", steps: ["Compute E/M level distribution: 99215 as % of all office E/M — CMS benchmark < 0.25 for OB/GYN", "Check: any 99213–99215 billed same day as procedure code — look for modifier -25; flag all instances without it", "Compute new vs. established patient ratio — should be 0.15–0.30 for an established solo/small practice"] },
  { title: "Step 7 — Update Bundle Scores", color: "#047857", steps: ["Re-score Maternity bundle: if NTSV C-section < 23.6% AND postpartum visit rate > 90% → upgrade to ~85. If C-section > 35% → downgrade to ~50.", "Re-score GYN Surgery: if MIS rate > 85% AND complication proxy < 5% → upgrade to ~92.", "Re-score Preventive: if CCS rate > 75% AND no over-screening flags → upgrade to ~88.", "Re-score Lab / Billing: if thyroid/Vitamin D over-ordering confirmed at scale without diagnosis → flag for cost exclusion from employer bundle.", "Flag any zero-tolerance violations (LEEP without colposcopy, elective delivery < 39w, E/M without -25) for immediate network review regardless of overall score."] },
];

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function ScoreDial({ score }: { score: number }) {
  const r = 28, cx = 36, cy = 36, stroke = 6;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const tierColor = score >= 80 ? "#16a34a" : score >= 65 ? "#d97706" : "#dc2626";
  return (
    <svg width={72} height={72} viewBox="0 0 72 72">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={tierColor} strokeWidth={stroke}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="700" fill={tierColor}>{score}</text>
    </svg>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function Page() {
  const [tab, setTab] = useState(0);
  const [activeDomain, setActiveDomain] = useState(0);
  const [expandedCpt, setExpandedCpt] = useState<string | null>(null);
  const [expandedFormula, setExpandedFormula] = useState<string | null>(null);
  const [expandedBundle, setExpandedBundle] = useState<string | null>(null);

  const overallScore = Math.round(BUNDLE_SCORES.reduce((a, b) => a + b.score, 0) / BUNDLE_SCORES.length);
  const overallTier = overallScore >= 80 ? "Recommended" : overallScore >= 65 ? "Conditional" : "Not Recommended";

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#f1f5f9", minHeight: "100vh", padding: "20px 16px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ background: "#0f172a", borderRadius: 12, padding: "18px 24px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>Dr. Brandon M. Lingenfelter, DO, PhD</div>
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 3 }}>NPI 1790045821 · Obstetrics & Gynecology · Princeton, WV</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {["Board Certified ABOG", "ACOG Member", "AAGL Member", "JMIG Published"].map(t => (
                <span key={t} style={{ background: "#1e3a8a", color: "#bfdbfe", fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 500 }}>{t}</span>
              ))}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ background: "#92400e", color: "#fde68a", fontSize: 11, padding: "3px 10px", borderRadius: 8, fontWeight: 700 }}>⚠ 2018 Malpractice — Fetal Monitoring</span>
            <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>Outcome unknown — records request required</div>
          </div>
        </div>

        {/* Bundle Score Cards */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Marketplace Bundle Quality Scores</span>
              <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 10 }}>Pre-claims estimate · Will update with utilization data</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 10, padding: "8px 16px", border: "1px solid #e2e8f0" }}>
              <ScoreDial score={overallScore} />
              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>OVERALL</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: TIER_CONFIG[overallTier].badge }}>{overallTier}</div>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {BUNDLE_SCORES.map((b) => {
              const tc = TIER_CONFIG[b.tier];
              const isOpen = expandedBundle === b.id;
              return (
                <div key={b.id} style={{ background: "#fff", borderRadius: 10, border: `1.5px solid ${isOpen ? b.color : "#e2e8f0"}`, boxShadow: isOpen ? `0 4px 16px ${b.color}22` : "0 1px 3px rgba(0,0,0,0.05)", transition: "all 0.2s", overflow: "hidden" }}>
                  <div onClick={() => setExpandedBundle(isOpen ? null : b.id)} style={{ padding: "14px 16px", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 18 }}>{b.icon}</span>
                          <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>{b.label}</span>
                        </div>
                        <span style={{ background: tc.bg, border: `1px solid ${tc.border}`, color: tc.badge, fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>{b.tier}</span>
                      </div>
                      <ScoreDial score={b.score} />
                    </div>
                    {!isOpen && <div style={{ color: "#64748b", fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>{b.rationale.slice(0, 90)}…</div>}
                  </div>
                  {isOpen && (
                    <div style={{ borderTop: `1.5px solid ${b.color}33`, padding: "14px 16px" }}>
                      <p style={{ margin: "0 0 12px", color: "#374151", fontSize: 12, lineHeight: 1.6 }}>{b.rationale}</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
                        {b.signals.map((s, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>{s.type === "positive" ? "✅" : s.type === "negative" ? "⚠️" : "❓"}</span>
                            <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>{s.label}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 140, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 7, padding: "8px 10px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", marginBottom: 3 }}>↑ CLAIMS UPSIDE</div>
                          <div style={{ fontSize: 11, color: "#166534" }}>{b.claimsUpside}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 140, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "8px 10px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", marginBottom: 3 }}>↓ CLAIMS DOWNSIDE</div>
                          <div style={{ fontSize: 11, color: "#991b1b" }}>{b.claimsDownside}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{
              padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: tab === i ? "#1e40af" : "#fff", color: tab === i ? "#fff" : "#475569",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)", transition: "all 0.15s",
            }}>{t}</button>
          ))}
        </div>

        {/* TAB 0: Provider Profile */}
        {tab === 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>Provider Profile</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {Object.entries(PROVIDER).map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 8px", color: "#64748b", fontSize: 12, fontWeight: 600, width: "32%" }}>{k}</td>
                    <td style={{ padding: "10px 8px", color: "#0f172a", fontSize: 13 }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 1: Credential Flags */}
        {tab === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Credential & Risk Flags</div>
            {CREDENTIAL_FLAGS.map((f, i) => {
              const fc = FLAG_COLORS[f.flag];
              return (
                <div key={i} style={{ background: fc.bg, border: `1px solid ${fc.border}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                    <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>{f.category}</span>
                    <span style={{ background: fc.badge, color: "#fff", fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 600 }}>{f.status}</span>
                  </div>
                  <p style={{ margin: 0, color: fc.text, fontSize: 13, lineHeight: 1.6 }}>{f.detail}</p>
                </div>
              );
            })}
            <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 10, padding: 14, fontSize: 12, color: "#713f12" }}>
              <strong>Action items:</strong> (1) Verify license at wvbdosteo.org/verify, (2) Run FSMB DocInfo search, (3) Check OIG LEIE before contracting, (4) Request Mercer County court records for 2018 case outcome, (5) Pull MIPS/QPP score at qpp.cms.gov.
            </div>
          </div>
        )}

        {/* TAB 2: Data Sources */}
        {tab === 2 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>Data Sources</div>
            {DATA_SOURCES.map((s, i) => {
              const isConfirmed = s.status.includes("Confirmed") || s.status.includes("Integrated");
              const isRisk = s.status.includes("⚠");
              const badge = isRisk ? "#d97706" : isConfirmed ? "#16a34a" : "#2563eb";
              const bg = isRisk ? "#fffbeb" : isConfirmed ? "#f0fdf4" : "#eff6ff";
              return (
                <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid #f1f5f9", alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ width: 190, flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>{s.source}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{s.url}</div>
                  </div>
                  <div style={{ flex: 1, color: "#374151", fontSize: 13, minWidth: 160 }}>{s.data}</div>
                  <span style={{ background: bg, border: `1px solid ${badge}33`, color: badge, fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 600, flexShrink: 0 }}>{s.status}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: CPT Quality Intelligence */}
        {tab === 3 && (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {DOMAINS.map((d, i) => (
                <button key={d.id} onClick={() => { setActiveDomain(i); setExpandedCpt(null); setExpandedFormula(null); }}
                  style={{ padding: "7px 12px", borderRadius: 8, border: `2px solid ${i === activeDomain ? d.color : "transparent"}`,
                    background: i === activeDomain ? d.color : "#fff", color: i === activeDomain ? "#fff" : "#475569",
                    fontWeight: 600, fontSize: 11, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                  {d.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {DOMAINS[activeDomain].codes.map((code, ci) => {
                const key = `${activeDomain}-${ci}`;
                const isOpen = expandedCpt === key;
                const dc = DOMAINS[activeDomain].color;
                return (
                  <div key={key} style={{ background: "#fff", borderRadius: 10, border: `1.5px solid ${isOpen ? dc : "#e2e8f0"}`, boxShadow: isOpen ? `0 4px 16px ${dc}22` : "0 1px 3px rgba(0,0,0,0.06)", transition: "all 0.2s" }}>
                    <div onClick={() => { setExpandedCpt(isOpen ? null : key); setExpandedFormula(null); }}
                      style={{ padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ background: dc, color: "#fff", fontFamily: "monospace", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 6 }}>{code.cpt}</span>
                          <span style={{ color: "#0f172a", fontWeight: 600, fontSize: 13 }}>{code.desc.split("—")[0].trim()}</span>
                        </div>
                        <div style={{ color: "#64748b", fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>{code.standard}</div>
                        <div style={{ display: "flex", gap: 5, marginTop: 7, alignItems: "center" }}>
                          {code.formulas.map(f => (
                            <span key={f.label} style={{ width: 9, height: 9, borderRadius: "50%", background: FLAG_COLORS[f.flag].badge, display: "inline-block" }} title={f.label} />
                          ))}
                          <span style={{ color: "#94a3b8", fontSize: 11 }}>{code.formulas.length} quality checks</span>
                        </div>
                      </div>
                      <span style={{ color: dc, fontSize: 18, marginLeft: 12 }}>{isOpen ? "▲" : "▼"}</span>
                    </div>
                    {isOpen && (
                      <div style={{ borderTop: `1.5px solid ${dc}33`, padding: "0 18px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                          {code.formulas.map((f, fi) => {
                            const fkey = `${key}-${fi}`;
                            const fOpen = expandedFormula === fkey;
                            const fc = FLAG_COLORS[f.flag];
                            return (
                              <div key={fkey} style={{ border: `1px solid ${fc.border}`, borderRadius: 8, overflow: "hidden" }}>
                                <div onClick={() => setExpandedFormula(fOpen ? null : fkey)}
                                  style={{ background: fc.bg, padding: "9px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ background: fc.badge, color: "#fff", fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 700, flexShrink: 0 }}>{fc.label}</span>
                                    <span style={{ color: fc.text, fontWeight: 600, fontSize: 12 }}>{f.label}</span>
                                  </div>
                                  <span style={{ color: fc.badge, fontSize: 13 }}>{fOpen ? "▲" : "▼"}</span>
                                </div>
                                {fOpen && (
                                  <div style={{ padding: "12px 14px", background: "#fff" }}>
                                    <div style={{ background: "#0f172a", borderRadius: 7, padding: "10px 14px", marginBottom: 10 }}>
                                      <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Formula / Check</div>
                                      <code style={{ color: "#86efac", fontSize: 12, lineHeight: 1.7, display: "block", whiteSpace: "pre-wrap" }}>{f.formula}</code>
                                    </div>
                                    <div style={{ background: fc.bg, border: `1px solid ${fc.border}`, borderRadius: 6, padding: "8px 12px" }}>
                                      <span style={{ color: fc.badge, fontSize: 11, fontWeight: 700 }}>INTERPRETATION: </span>
                                      <span style={{ color: fc.text, fontSize: 12 }}>{f.note}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ background: "#fff", borderRadius: 10, padding: "12px 16px", marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>SEVERITY:</span>
              {Object.entries(FLAG_COLORS).map(([k, v]) => (
                <span key={k} style={{ fontSize: 11, color: v.text }}>
                  <span style={{ background: v.badge, color: "#fff", padding: "1px 6px", borderRadius: 8, fontWeight: 700, marginRight: 4 }}>{v.label}</span>
                  {k === "red" ? "Audit trigger / Patient safety" : k === "yellow" ? "Benchmark deviation" : k === "green" ? "Expected / Calibration" : "Verify required"}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: Claims Mapping Guide */}
        {tab === 4 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Claims → Quality Mapping Guide</div>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>Run in order — earlier steps validate data integrity before clinical interpretation.</p>
            {CLAIMS_STEPS.map((s, i) => (
              <div key={i} style={{ marginBottom: 18, border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ background: s.color, padding: "10px 16px", fontWeight: 700, color: "#fff", fontSize: 13 }}>{s.title}</div>
                <div style={{ padding: "12px 16px" }}>
                  <ol style={{ margin: 0, paddingLeft: 20 }}>
                    {s.steps.map((st, j) => (
                      <li key={j} style={{ color: "#374151", fontSize: 13, marginBottom: 6, lineHeight: 1.5 }}>{st}</li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
