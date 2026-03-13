import {
  FormulaDefinition,
  FormulaResult,
  DomainScore,
  HcpcsVolume,
  ProviderInfo,
  QualityReport,
  ResultStatus,
} from "./types";
import { FORMULA_DEFINITIONS, DOMAIN_DEFINITIONS } from "./formulas";

const CMS_SUPPRESSION_THRESHOLD = 11;

function buildVolumeMap(volumes: HcpcsVolume[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const v of volumes) {
    const existing = map.get(v.hcpcs_code) ?? 0;
    map.set(v.hcpcs_code, existing + v.total_volume);
  }
  return map;
}

function sumCodes(codes: string[], volumeMap: Map<string, number>): number {
  let total = 0;
  for (const code of codes) {
    total += volumeMap.get(code) ?? 0;
  }
  return total;
}

function evaluateFormula(
  formula: FormulaDefinition,
  volumeMap: Map<string, number>
): FormulaResult {
  const base: Omit<FormulaResult, "status"> = {
    formulaId: formula.id,
    label: formula.label,
    domainId: formula.domainId,
    flag: formula.flag,
    description: formula.description,
    note: formula.note,
  };

  if (!formula.computable) {
    return {
      ...base,
      status: "not_computable",
      explanation: formula.requiresPatientLevel ?? "Requires patient-level claims data",
    };
  }

  const numeratorCodes = formula.numeratorCodes ?? [];
  const denominatorCodes = formula.denominatorCodes ?? [];

  const numerator = sumCodes(numeratorCodes, volumeMap);
  const denominator = sumCodes(denominatorCodes, volumeMap);

  if (denominator < CMS_SUPPRESSION_THRESHOLD) {
    return {
      ...base,
      status: "insufficient_data",
      numerator,
      denominator,
      explanation: `Denominator volume (${denominator}) below CMS suppression threshold (${CMS_SUPPRESSION_THRESHOLD})`,
    };
  }

  const ratio = numerator / denominator;

  let status: ResultStatus;
  if (formula.benchmarkOp === "range" && formula.benchmarkRange) {
    const [low, high] = formula.benchmarkRange;
    if (ratio >= low && ratio <= high) {
      status = "pass";
    } else if (ratio < low * 0.75 || ratio > high * 1.25) {
      status = "fail";
    } else {
      status = "flag";
    }
  } else if (formula.benchmark !== undefined && formula.benchmarkOp) {
    const b = formula.benchmark;
    switch (formula.benchmarkOp) {
      case "lt":
        status = ratio < b ? "pass" : ratio < b * 1.25 ? "flag" : "fail";
        break;
      case "lte":
        status = ratio <= b ? "pass" : ratio <= b * 1.25 ? "flag" : "fail";
        break;
      case "gt":
        status = ratio > b ? "pass" : ratio > b * 0.75 ? "flag" : "fail";
        break;
      case "gte":
        status = ratio >= b ? "pass" : ratio >= b * 0.75 ? "flag" : "fail";
        break;
      default:
        status = "flag";
    }
  } else {
    status = "flag";
  }

  return {
    ...base,
    status,
    ratio,
    numerator,
    denominator,
    benchmark: formula.benchmark,
    benchmarkOp: formula.benchmarkOp,
    benchmarkRange: formula.benchmarkRange,
  };
}

function scoreDomain(
  domainDef: (typeof DOMAIN_DEFINITIONS)[number],
  results: FormulaResult[]
): DomainScore {
  const domainResults = results.filter((r) => r.domainId === domainDef.id);
  const computable = domainResults.filter(
    (r) => r.status !== "not_computable"
  );
  const withData = computable.filter(
    (r) => r.status !== "insufficient_data"
  );

  const passCount = withData.filter((r) => r.status === "pass").length;
  const flagCount = withData.filter((r) => r.status === "flag").length;
  const failCount = withData.filter((r) => r.status === "fail").length;

  let score: number | null = null;
  if (withData.length > 0) {
    const totalPoints = passCount * 100 + flagCount * 50 + failCount * 0;
    score = Math.round(totalPoints / withData.length);
  }

  return {
    domainId: domainDef.id,
    label: domainDef.label,
    color: domainDef.color,
    bg: domainDef.bg,
    score,
    totalFormulas: domainResults.length,
    computableFormulas: computable.length,
    passCount,
    flagCount,
    failCount,
    insufficientCount: computable.filter(
      (r) => r.status === "insufficient_data"
    ).length,
    notComputableCount: domainResults.filter(
      (r) => r.status === "not_computable"
    ).length,
    results: domainResults,
  };
}

export function computeQualityReport(
  provider: ProviderInfo,
  volumes: HcpcsVolume[]
): QualityReport {
  const isObgyn =
    provider.provider_type?.toLowerCase().includes("obstetrics") ||
    provider.provider_type?.toLowerCase().includes("gynecology") ||
    false;

  const volumeMap = buildVolumeMap(volumes);
  const results = FORMULA_DEFINITIONS.map((f) => evaluateFormula(f, volumeMap));
  const domains = DOMAIN_DEFINITIONS.map((d) => scoreDomain(d, results));

  // Overall score: weighted average of domains with scores
  const scoredDomains = domains.filter((d) => d.score !== null);
  let overallScore: number | null = null;
  if (scoredDomains.length > 0) {
    overallScore = Math.round(
      scoredDomains.reduce((sum, d) => sum + d.score!, 0) /
        scoredDomains.length
    );
  }

  let tier: QualityReport["tier"] = null;
  if (overallScore !== null) {
    if (overallScore >= 80) tier = "Recommended";
    else if (overallScore >= 65) tier = "Conditional";
    else tier = "Not Recommended";
  }

  const totalFormulas = FORMULA_DEFINITIONS.length;
  const computableFormulas = FORMULA_DEFINITIONS.filter(
    (f) => f.computable
  ).length;
  const formulasWithData = results.filter(
    (r) => r.status === "pass" || r.status === "flag" || r.status === "fail"
  ).length;

  return {
    provider,
    overallScore,
    tier,
    domains,
    hcpcsVolumes: volumes,
    completeness: {
      totalFormulas,
      computableFormulas,
      formulasWithData,
      percentComputable: Math.round(
        (computableFormulas / totalFormulas) * 100
      ),
    },
    isObgyn,
  };
}
