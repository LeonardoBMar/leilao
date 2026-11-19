import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";

// As fronteiras entre camadas estão descritas em docs/ARCHITECTURE.md.
const dbImports = {
  group: ["@prisma/client", "@prisma/client/*", "@/generated/prisma", "@/generated/prisma/*", "@/server/db"],
  message: "Acesso ao banco só em src/server/** e em queries/mutations das features.",
};
const frameworkImports = {
  group: [
    "next",
    "next/*",
    "react",
    "react/*",
    "react-dom",
    "react-dom/*",
    "@/app/*",
    "@/components/*",
    "@/features/*",
    "@/server/*",
  ],
  message: "src/domain é TypeScript puro: sem framework, UI, I/O ou infraestrutura.",
};
const libLayerImports = {
  group: ["@/app/*", "@/features/*", "@/server/*", "@/components/*"],
  message: "src/lib não importa camadas acima nem src/server.",
};
const componentLayerImports = {
  group: ["@/app/*", "@/features/*", "@/server/*"],
  message: "src/components é compartilhado e não importa app, features ou server.",
};
const serverLayerImports = {
  group: ["@/app/*", "@/features/*", "@/components/*"],
  message: "src/server não importa app, features ou components.",
};
const noWatchesImports = {
  group: ["@/features/watches", "@/features/watches/*"],
  message: "listings não importa watches (composição em app/ para evitar ciclo).",
};
const noListingsImports = {
  group: ["@/features/listings", "@/features/listings/*"],
  message: "analyses não importa listings.",
};
const noAnalysesImports = {
  group: ["@/features/analyses", "@/features/analyses/*"],
  message: "research não importa analyses (composição em app/ para evitar ciclo).",
};

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  prettier,
  {
    files: ["**/*.{ts,tsx,mts}"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
      "@typescript-eslint/switch-exhaustiveness-check": ["error", { considerDefaultExhaustiveForUnions: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "import/no-default-export": "error",
      // Ordem: pacotes, depois "@/", depois relativos, com linha em branco entre os grupos.
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-restricted-imports": ["error", { patterns: [dbImports] }],
    },
  },
  {
    // Arquivos especiais do Next.js e configs exigem default export.
    files: [
      "src/app/**/{page,layout,loading,error,global-error,not-found,forbidden,unauthorized,template,default,route}.tsx",
      "src/app/**/{opengraph-image,icon,apple-icon,sitemap,robots,manifest}.{ts,tsx}",
      "src/proxy.ts",
      "src/instrumentation.ts",
      "*.config.{ts,mts,mjs}",
    ],
    rules: { "import/no-default-export": "off" },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "process", property: "env", message: "Leia variáveis por `@/server/env` ou `@/lib/public-env`." },
      ],
    },
  },
  {
    files: [
      "src/server/env.ts",
      "src/lib/public-env.ts",
      "src/server/auth.ts",
      "src/proxy.ts",
      "src/app/(private)/componentes/page.tsx",
      "src/**/*.test.{ts,tsx}",
    ],
    rules: { "no-restricted-properties": "off" },
  },
  {
    files: ["src/domain/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [dbImports, frameworkImports] }] },
  },
  {
    // Adaptadores de fonte (D-27): puros, recebem texto e devolvem dado validado. Rede e banco ficam no coletor.
    files: ["src/sources/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            dbImports,
            { ...frameworkImports, message: "src/sources é puro: sem framework, UI, I/O ou infraestrutura." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [dbImports, libLayerImports] }] },
  },
  {
    files: ["src/components/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [dbImports, componentLayerImports] }] },
  },
  {
    files: ["src/server/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [serverLayerImports] }] },
  },
  {
    files: [
      "src/features/*/queries.ts",
      "src/features/*/queries/**/*.ts",
      "src/features/*/mutations.ts",
      "src/features/*/mutations/**/*.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["src/features/listings/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [dbImports, noWatchesImports] }] },
  },
  {
    files: [
      "src/features/listings/queries.ts",
      "src/features/listings/queries/**/*.ts",
      "src/features/listings/mutations.ts",
      "src/features/listings/mutations/**/*.ts",
    ],
    rules: { "no-restricted-imports": ["error", { patterns: [noWatchesImports] }] },
  },
  {
    files: ["src/features/analyses/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [dbImports, noListingsImports] }] },
  },
  {
    files: [
      "src/features/analyses/queries.ts",
      "src/features/analyses/queries/**/*.ts",
      "src/features/analyses/mutations.ts",
      "src/features/analyses/mutations/**/*.ts",
    ],
    rules: { "no-restricted-imports": ["error", { patterns: [noListingsImports] }] },
  },
  {
    files: ["src/features/research/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [dbImports, noAnalysesImports] }] },
  },
  {
    files: [
      "src/features/research/queries.ts",
      "src/features/research/queries/**/*.ts",
      "src/features/research/mutations.ts",
      "src/features/research/mutations/**/*.ts",
    ],
    rules: { "no-restricted-imports": ["error", { patterns: [noAnalysesImports] }] },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "src/generated/**",
    "tests/e2e/.report/**",
    "tests/e2e/.results/**",
  ]),
]);
