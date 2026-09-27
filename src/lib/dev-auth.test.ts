import { describe, expect, it } from "vitest";

import { devAuthUserId } from "./dev-auth";

const USER_ID = "3f0c9a52-6d1e-4b7a-9c2e-8a4d5b6c7e8f";
const enabled = {
  NODE_ENV: "development",
  DEV_AUTH_BYPASS: "true",
  DEV_AUTH_USER_ID: USER_ID,
  DEV_AUTH_LOOPBACK: "1",
};

describe("devAuthUserId (D-31)", () => {
  it.each(["localhost:3100", "127.0.0.1:3100", "[::1]:3100", "LOCALHOST"])(
    "vale no próprio computador (%s)",
    (host) => {
      expect(devAuthUserId(enabled, host)).toBe(USER_ID);
    },
  );

  it("nunca vale fora do desenvolvimento", () => {
    expect(devAuthUserId({ ...enabled, NODE_ENV: "production" }, "localhost:3000")).toBeNull();
    expect(devAuthUserId({ ...enabled, NODE_ENV: "test" }, "localhost:3000")).toBeNull();
  });

  it("exige a variável ligada e o servidor de `npm run dev:local`", () => {
    expect(devAuthUserId({ ...enabled, DEV_AUTH_BYPASS: "1" }, "localhost")).toBeNull();
    expect(devAuthUserId({ ...enabled, DEV_AUTH_BYPASS: undefined }, "localhost")).toBeNull();
    expect(devAuthUserId({ ...enabled, DEV_AUTH_LOOPBACK: undefined }, "localhost")).toBeNull();
  });

  it("recusa acesso por outro endereço", () => {
    expect(devAuthUserId(enabled, "192.168.0.10:3100")).toBeNull();
    expect(devAuthUserId(enabled, "leilao.vercel.app")).toBeNull();
    expect(devAuthUserId(enabled, "localhost.evil.com")).toBeNull();
    expect(devAuthUserId(enabled, null)).toBeNull();
  });

  it("recusa id que não é UUID", () => {
    expect(devAuthUserId({ ...enabled, DEV_AUTH_USER_ID: "" }, "localhost")).toBeNull();
    expect(devAuthUserId({ ...enabled, DEV_AUTH_USER_ID: "admin" }, "localhost")).toBeNull();
  });
});
