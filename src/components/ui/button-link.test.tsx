import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ButtonLink } from "./button-link";

describe("ButtonLink", () => {
  it("renderiza um único link com a aparência do botão, sem botão aninhado", () => {
    const html = renderToStaticMarkup(
      <ButtonLink href="/leiloes/novo" variant="secondary">
        <svg aria-hidden="true" />
        Novo leilão
      </ButtonLink>,
    );

    expect(html.match(/<a\b/g)).toHaveLength(1);
    expect(html).not.toMatch(/<button\b/);
    expect(html).toMatch(/href="\/leiloes\/novo"/);
    expect(html).toMatch(/Novo leilão/);
    expect(html).toMatch(/rounded-md/);
  });
});
