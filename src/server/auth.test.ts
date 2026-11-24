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

import { isCurrentUserAdmin, requireAdmin } from "./auth";

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

  it("redireciona para /dashboard?aviso=sem-permissao quando o usuário tem papel USER", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: USER_ID, email: "user@example.com" } }, error: null });
    findUniqueMock.mockResolvedValue({ role: "USER" });

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/dashboard?aviso=sem-permissao");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard?aviso=sem-permissao");
  });

  it("trata usuário sem linha em user_profiles como USER e redireciona com aviso", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: USER_ID, email: "new@example.com" } }, error: null });
    findUniqueMock.mockResolvedValue(null);

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/dashboard?aviso=sem-permissao");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard?aviso=sem-permissao");
  });

  it("redireciona para /login quando não há sessão autenticada", async () => {
    getClaimsMock.mockResolvedValue({ data: null, error: null });

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/login");
    expect(findUniqueMock).not.toHaveBeenCalled();
  });
});

describe("isCurrentUserAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue(new Headers());
  });

  it("devolve true para ADMIN e false para USER ou sem sessão", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: USER_ID, email: "admin@example.com" } }, error: null });
    findUniqueMock.mockResolvedValue({ role: "ADMIN" });
    expect(await isCurrentUserAdmin()).toBe(true);

    findUniqueMock.mockResolvedValue({ role: "USER" });
    expect(await isCurrentUserAdmin()).toBe(false);

    getClaimsMock.mockResolvedValue({ data: null, error: null });
    expect(await isCurrentUserAdmin()).toBe(false);
  });
});
