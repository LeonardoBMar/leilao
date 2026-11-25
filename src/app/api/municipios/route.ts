import { type NextRequest, NextResponse } from "next/server";

import { searchMunicipalities } from "@/features/preferences/queries";
import { municipalitySearchSchema } from "@/features/preferences/schemas";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const parsed = municipalitySearchSchema.safeParse(query);
  if (!parsed.success) return NextResponse.json([]);

  const items = await searchMunicipalities(parsed.data);
  return NextResponse.json(items);
}
