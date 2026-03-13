export type FlagLevel = "red" | "yellow" | "green" | "blue";
export type BenchmarkOp = "lt" | "lte" | "gt" | "gte" | "range";
export type ResultStatus =
  | "pass"
  | "flag"
  | "fail"
  | "insufficient_data"
  | "not_computable";

export interface FormulaDefinition {
  id: string;
  label: string;
  domainId: string;
  cptGroup: string;
  flag: FlagLevel;
  description: string;
  note: string;
  computable: boolean;
  /** HCPCS codes whose volumes form the numerator */
  numeratorCodes?: string[];
  /** HCPCS codes whose volumes form the denominator */
  denominatorCodes?: string[];
  /** Target benchmark value */
  benchmark?: number;
  benchmarkOp?: BenchmarkOp;
  /** For range benchmarks: [low, high] */
  benchmarkRange?: [number, number];
  /** Why this formula can't be computed from aggregate data */
  requiresPatientLevel?: string;
}

export interface DomainDefinition {
  id: string;
  label: string;
  color: string;
  bg: string;
}

export interface HcpcsVolume {
  hcpcs_code: string;
  hcpcs_desc: string | null;
  payer_source: string;
  medicare_total_benes: number;
  medicare_total_srvcs: number;
  medicare_total_pymt: number;
  medicaid_total_benes: number;
  medicaid_total_claims: number;
  medicaid_total_paid: number;
  /** Combined volume: medicare_total_srvcs + medicaid_total_claims */
  total_volume: number;
}

export interface ProviderInfo {
  npi: string;
  provider_name: string | null;
  provider_type: string | null;
  provider_state: string | null;
  provider_city: string | null;
}

export interface FormulaResult {
  formulaId: string;
  label: string;
  domainId: string;
  flag: FlagLevel;
  status: ResultStatus;
  /** Computed ratio (if computable and sufficient data) */
  ratio?: number;
  /** Numerator volume */
  numerator?: number;
  /** Denominator volume */
  denominator?: number;
  benchmark?: number;
  benchmarkOp?: BenchmarkOp;
  benchmarkRange?: [number, number];
  description: string;
  note: string;
  /** Explanation for non-computable or insufficient data */
  explanation?: string;
}

export interface DomainScore {
  domainId: string;
  label: string;
  color: string;
  bg: string;
  /** 0-100, or null if no computable formulas have data */
  score: number | null;
  totalFormulas: number;
  computableFormulas: number;
  passCount: number;
  flagCount: number;
  failCount: number;
  insufficientCount: number;
  notComputableCount: number;
  results: FormulaResult[];
}

export interface QualityReport {
  provider: ProviderInfo;
  overallScore: number | null;
  tier: "Recommended" | "Conditional" | "Not Recommended" | null;
  domains: DomainScore[];
  hcpcsVolumes: HcpcsVolume[];
  completeness: {
    totalFormulas: number;
    computableFormulas: number;
    formulasWithData: number;
    percentComputable: number;
  };
  isObgyn: boolean;
}
