import { describe, expect, it } from "vitest";

import { checkUserRateLimit } from "./rate-limit";

describe("checkUserRateLimit", () => {
  it("permite até o limite na janela e bloqueia excesso com Retry-After", () => {
    const userId = `user-${crypto.randomUUID()}`;
    const route = "test:route";
    const t0 = 1_000_000;

    expect(checkUserRateLimit(userId, route, 2, 10_000, t0)).toEqual({ allowed: true, remaining: 1 });
    expect(checkUserRateLimit(userId, route, 2, 10_000, t0 + 1_000)).toEqual({ allowed: true, remaining: 0 });
    expect(checkUserRateLimit(userId, route, 2, 10_000, t0 + 2_000)).toEqual({
      allowed: false,
      retryAfterSeconds: 8,
    });

    // Após expirar a primeira requisição da janela deslizante, libera novamente.
    expect(checkUserRateLimit(userId, route, 2, 10_000, t0 + 10_001)).toEqual({ allowed: true, remaining: 0 });
  });
});
