import { type NextRequest, NextResponse } from "next/server";

import { searchMunicipalities } from "@/features/preferences/queries";
import { municipalitySearchSchema } from "@/features/preferences/schemas";
import { getCurrentUser } from "@/server/auth";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Sessão expirada." } },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const query = request.nextUrl.searchParams.get("q") ?? "";
  const parsed = municipalitySearchSchema.safeParse(query);
  if (!parsed.success) return NextResponse.json({ data: [] }, { headers: NO_STORE_HEADERS });

  try {
    const items = await searchMunicipalities(parsed.data);
    return NextResponse.json({ data: items }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("Erro ao buscar municípios:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Não foi possível buscar municípios agora." } },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
