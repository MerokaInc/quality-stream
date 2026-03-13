import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "obgyn-providers.json");
    const raw = await readFile(filePath, "utf-8");
    const providers = JSON.parse(raw);
    return NextResponse.json(providers);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to load provider data: ${message}` },
      { status: 500 }
    );
  }
}
