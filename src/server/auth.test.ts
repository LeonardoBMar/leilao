import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock, headersMock, getClaimsMock, findUniqueMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  }),
  headersMock: vi.fn(async () => new Headers()),
  getClaimsMock: vi.fn(),
  findUniqueMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("react", () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));
vi.mock("./supabase", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getClaims: getClaimsMock } })),
}));
vi.mock("./db", () => ({
  db: { userProfile: { findUnique: findUniqueMock } },
}));

import { requireAdmin } from "./auth";

const USER_ID = "01950000-0000-7000-8000-000000000001";

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue(new Headers());
  });

  it("permite acesso quando o usuário tem papel ADMIN em user_profiles", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: USER_ID, email: "admin@example.com" } }, error: null });
    findUniqueMock.mockResolvedValue({ role: "ADMIN" });

    const user = await requireAdmin();

    expect(user).toEqual({ id: USER_ID, email: "admin@example.com" });
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { userId: USER_ID }, select: { role: true } });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redireciona para /dashboard quando o usuário tem papel USER", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: USER_ID, email: "user@example.com" } }, error: null });
    findUniqueMock.mockResolvedValue({ role: "USER" });

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("trata usuário sem linha em user_profiles como USER e redireciona para /dashboard", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: USER_ID, email: "new@example.com" } }, error: null });
    findUniqueMock.mockResolvedValue(null);

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("redireciona para /login quando não há sessão autenticada", async () => {
    getClaimsMock.mockResolvedValue({ data: null, error: null });

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/login");
    expect(findUniqueMock).not.toHaveBeenCalled();
  });
});
