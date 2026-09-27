import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Compile only the source modules under test, using the installed TypeScript runtime.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const cache = new Map();
function loadSource(relativePath) {
  const filename = path.resolve(root, relativePath);
  if (cache.has(filename)) return cache.get(filename);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier.startsWith("@/")) return loadSource(`src/${specifier.slice(2)}.ts`);
    if (specifier.startsWith(".")) return loadSource(path.resolve(path.dirname(filename), `${specifier}.ts`));
    return require(specifier);
  };
  new Function("require", "module", "exports", outputText)(localRequire, module, module.exports);
  cache.set(filename, module.exports);
  return module.exports;
}

const { Button } = loadSource("src/components/ui/button.tsx");
const { cn } = loadSource("src/lib/utils.ts");

test("asChild renders one anchor without a nested button in every state", () => {
  for (const state of [
    {},
    { loading: false },
    { loading: true },
    { disabled: true },
    { loading: true, disabled: true },
  ]) {
    const html = renderToStaticMarkup(
      createElement(Button, { asChild: true, ...state }, createElement("a", { href: "/lotes" }, "Ver lotes")),
    );
    assert.equal((html.match(/<a\b/g) ?? []).length, 1);
    assert.doesNotMatch(html, /<button\b/);
    assert.match(html, /Ver lotes/);
    if (state.loading || state.disabled) {
      assert.match(html, /aria-disabled="true"/);
      assert.doesNotMatch(html, /href=/);
    } else {
      assert.match(html, /href="\/lotes"/);
    }
  }
});

test("blocked links replace child activation handlers and leave the Tab order", () => {
  for (const state of [{ disabled: true }, { loading: true }]) {
    let activations = 0;
    const element = Button({
      asChild: true,
      ...state,
      onClick: () => activations++,
      children: createElement("a", { href: "/lotes", tabIndex: 0, onClick: () => activations++ }, "Ver lotes"),
    });
    const child = element.props.children;
    assert.equal(child.props.tabIndex, -1);
    for (const handler of [
      element.props.onClick,
      child.props.onClick,
      child.props.onClickCapture,
      child.props.onAuxClick,
    ]) {
      let prevented = false;
      let stopped = false;
      handler({ preventDefault: () => (prevented = true), stopPropagation: () => (stopped = true) });
      assert.equal(prevented && stopped, true);
    }
    for (const key of ["Enter", " "]) {
      let prevented = false;
      child.props.onKeyDownCapture({ key, preventDefault: () => (prevented = true), stopPropagation() {} });
      assert.equal(prevented, true);
    }
    assert.equal(activations, 0);
  }
});

test("loading blocks a native button without applying the disabled appearance", () => {
  const html = renderToStaticMarkup(createElement(Button, { loading: true, loadingLabel: "Salvando…" }, "Salvar"));
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-busy="true"/);
  assert.doesNotMatch(html, /data-disabled="true"/);
  assert.match(html, /Salvando…/);
});

test("controlled loading reserves both labels before and during the operation", () => {
  for (const loading of [false, true]) {
    const html = renderToStaticMarkup(createElement(Button, { loading, loadingLabel: "Salvando…" }, "Salvar"));
    assert.match(html, /Salvar/);
    assert.match(html, /Salvando…/);
    assert.equal((html.match(/aria-hidden="true"/g) ?? []).length, 2);
  }
});

test("semantic typography can coexist with colors and be overridden independently", () => {
  assert.equal(cn("text-heading-2 text-foreground"), "text-heading-2 text-foreground");
  assert.equal(cn("text-heading-3 text-muted", "text-body text-primary"), "text-body text-primary");
  assert.equal(cn("text-label", "text-caption"), "text-caption");
});
