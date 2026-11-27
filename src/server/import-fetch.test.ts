import { describe, expect, it } from "vitest";

import { isPrivateIp, validateTargetUrl } from "./import-fetch";

describe("isPrivateIp", () => {
  it("bloqueia faixas IPv4 e IPv6 privadas, loopback, link-local, multicast e NAT64", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("192.168.1.10")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true);
    expect(isPrivateIp("100.64.0.1")).toBe(true);
    expect(isPrivateIp("0.0.0.0")).toBe(true);
    expect(isPrivateIp("224.0.0.1")).toBe(true);

    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("[::1]")).toBe(true);
    expect(isPrivateIp("0:0:0:0:0:0:0:1")).toBe(true);
    expect(isPrivateIp("::")).toBe(true);
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fd12:3456::1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("ff02::1")).toBe(true);
    expect(isPrivateIp("64:ff9b::127.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
  });

  it("aceita endereços públicos IPv4 e IPv6", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("2001:4860:4860::8888")).toBe(false);
  });
});

describe("validateTargetUrl", () => {
  it("rejeita protocolos não HTTP(S), credenciais na URL e hosts internos/privados", async () => {
    expect(await validateTargetUrl("javascript:alert(1)")).toEqual({ ok: false, error: "invalid_url" });
    expect(await validateTargetUrl("file:///etc/passwd")).toEqual({ ok: false, error: "invalid_url" });
    expect(await validateTargetUrl("https://user:pass@example.com/lot/1")).toEqual({
      ok: false,
      error: "blocked_host",
    });
    expect(await validateTargetUrl("http://localhost:3000/lotes")).toEqual({ ok: false, error: "blocked_host" });
    expect(await validateTargetUrl("http://127.0.0.1/lotes")).toEqual({ ok: false, error: "blocked_host" });
    expect(await validateTargetUrl("http://[::1]/lotes")).toEqual({ ok: false, error: "blocked_host" });
    expect(await validateTargetUrl("http://169.254.169.254/latest/meta-data/")).toEqual({
      ok: false,
      error: "blocked_host",
    });
    expect(await validateTargetUrl("https://db.internal/lot")).toEqual({ ok: false, error: "blocked_host" });
  });
});
