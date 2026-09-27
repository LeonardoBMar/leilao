import { type ReactElement, type SyntheticEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

import { Button, type ButtonProps } from "./button";

type BlockedChildProps = {
  tabIndex: number;
  onClick: (event: SyntheticEvent) => void;
  onClickCapture: (event: SyntheticEvent) => void;
  onAuxClick: (event: SyntheticEvent) => void;
  onKeyDownCapture: (event: Partial<React.KeyboardEvent>) => void;
};

function fakeEvent() {
  const calls = { prevented: false, stopped: false };
  const event = {
    preventDefault: () => (calls.prevented = true),
    stopPropagation: () => (calls.stopped = true),
  } as unknown as SyntheticEvent;
  return { event, calls };
}

describe("Button asChild", () => {
  it.each<Partial<ButtonProps>>([
    {},
    { loading: false },
    { loading: true },
    { disabled: true },
    { loading: true, disabled: true },
  ])("renders one anchor without a nested button (%o)", (state) => {
    const html = renderToStaticMarkup(
      <Button asChild {...state}>
        <a href="/lotes">Ver lotes</a>
      </Button>,
    );

    expect(html.match(/<a\b/g)).toHaveLength(1);
    expect(html).not.toMatch(/<button\b/);
    expect(html).toMatch(/Ver lotes/);
    if (state.loading || state.disabled) {
      expect(html).toMatch(/aria-disabled="true"/);
      expect(html).not.toMatch(/href=/);
    } else {
      expect(html).toMatch(/href="\/lotes"/);
    }
  });

  it.each<Partial<ButtonProps>>([{ disabled: true }, { loading: true }])(
    "blocks activation handlers and leaves the Tab order (%o)",
    (state) => {
      let activations = 0;
      const element = Button({
        asChild: true,
        ...state,
        onClick: () => activations++,
        children: (
          <a href="/lotes" tabIndex={0} onClick={() => activations++}>
            Ver lotes
          </a>
        ),
      }) as ReactElement<{ onClick: BlockedChildProps["onClick"]; children: ReactElement<BlockedChildProps> }>;
      const child = element.props.children;

      expect(child.props.tabIndex).toBe(-1);
      for (const handler of [
        element.props.onClick,
        child.props.onClick,
        child.props.onClickCapture,
        child.props.onAuxClick,
      ]) {
        const { event, calls } = fakeEvent();
        handler(event);
        expect(calls).toEqual({ prevented: true, stopped: true });
      }
      for (const key of ["Enter", " "]) {
        const { event, calls } = fakeEvent();
        child.props.onKeyDownCapture({ ...event, key } as Partial<React.KeyboardEvent>);
        expect(calls.prevented).toBe(true);
      }
      expect(activations).toBe(0);
    },
  );
});

describe("Button loading", () => {
  it("blocks a native button without applying the disabled appearance", () => {
    const html = renderToStaticMarkup(
      <Button loading loadingLabel="Salvando…">
        Salvar
      </Button>,
    );

    expect(html).toMatch(/disabled=""/);
    expect(html).toMatch(/aria-busy="true"/);
    expect(html).not.toMatch(/data-disabled="true"/);
    expect(html).toMatch(/Salvando…/);
  });

  it.each([false, true])("reserves both labels before and during the operation (loading=%s)", (loading) => {
    const html = renderToStaticMarkup(
      <Button loading={loading} loadingLabel="Salvando…">
        Salvar
      </Button>,
    );

    expect(html).toMatch(/Salvar/);
    expect(html).toMatch(/Salvando…/);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2);
  });
});

describe("cn", () => {
  it("keeps semantic typography independent from colors", () => {
    expect(cn("text-heading-2 text-foreground")).toBe("text-heading-2 text-foreground");
    expect(cn("text-heading-3 text-muted", "text-body text-primary")).toBe("text-body text-primary");
    expect(cn("text-label", "text-caption")).toBe("text-caption");
  });
});
