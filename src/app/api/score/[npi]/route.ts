import { NextRequest, NextResponse } from "next/server";
import { fetchNpiData } from "@/lib/npi-data";
import { computeQualityReport } from "@/lib/scoring/engine";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ npi: string }> }
) {
  const { npi } = await params;

  if (!/^\d{10}$/.test(npi)) {
    return NextResponse.json(
      { error: "Invalid NPI format. Must be 10 digits." },
      { status: 400 }
    );
  }

  try {
    const data = await fetchNpiData(npi);
    if (!data) {
      return NextResponse.json(
        { error: `No records found for NPI: ${npi}` },
        { status: 404 }
      );
    }

    const report = computeQualityReport(data.provider, data.volumes);
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Database error: ${message}` },
      { status: 500 }
    );
  }
}
