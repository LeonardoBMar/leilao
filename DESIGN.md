---
name: Leilão Tracker
description: Análise e acompanhamento de leilões (v3.0).
colors:
  primary: "#111318"
  accent: "#1d4ed8"
  background: "#fafafb"
  surface: "#ffffff"
  surface-subtle: "#f3f4f6"
  foreground: "#111318"
  muted: "#626773"
  border: "#eaecef"
  success: "#047857"
  warning: "#92400e"
  error: "#be123c"
typography:
  display:
    fontFamily: "Inter, sans-serif"
    fontSize: "2.625rem"
    fontWeight: 600
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
rounded:
  md: "6px"
  lg: "10px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
---

<!-- impeccable:design-map -->

# Leilão Tracker — Design System

Name: Leilão Tracker
Colors: primary #111318; accent #1d4ed8; success #047857; warning #92400e; error #be123c; background #fafafb; surface #ffffff
Fonts: Inter (display, body); JetBrains Mono (mono)
Don't:

- Criar novas cores, fontes, sombras, raios ou espaçamentos localmente.
- Usar gradientes, glassmorphism, glow ou estética automotiva decorativa.

Do:

- Usar tinta (`primary`) na ação principal e o azul `accent` só em link, foco e seleção.
- Manter números financeiros com rótulo, unidade e numerais tabulares (`tabular-nums`).

Map: SPEC.md
Map: src/components/ui
Map: src/app/globals.css
Map: src/app/layout.tsx
Full: .impeccable/design-full.md
