import { type NextRequest, NextResponse } from "next/server";

import { searchMunicipalities } from "@/features/preferences/queries";
import { municipalitySearchSchema } from "@/features/preferences/schemas";
import { getCurrentUser } from "@/server/auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sessão expirada." } }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q") ?? "";
  const parsed = municipalitySearchSchema.safeParse(query);
  if (!parsed.success) return NextResponse.json({ data: [] });

  const items = await searchMunicipalities(parsed.data);
  return NextResponse.json({ data: items });
}
