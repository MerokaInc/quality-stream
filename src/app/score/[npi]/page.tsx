import { notFound } from "next/navigation";
import { fetchNpiData } from "@/lib/npi-data";
import { computeQualityReport } from "@/lib/scoring/engine";
import ReportClient from "./report-client";

export default async function NpiReportPage({
  params,
}: {
  params: Promise<{ npi: string }>;
}) {
  const { npi } = await params;

  if (!/^\d{10}$/.test(npi)) {
    notFound();
  }

  try {
    const data = await fetchNpiData(npi);
    if (!data) {
      notFound();
    }
    const report = computeQualityReport(data.provider, data.volumes);
    return <ReportClient report={report} />;
  } catch {
    notFound();
  }
}

export const dynamic = "force-dynamic";
