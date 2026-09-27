import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";

// As fronteiras entre camadas estão descritas em docs/ARCHITECTURE.md.
const dbImports = {
  group: ["@prisma/client", "@prisma/client/*", "@/generated/prisma", "@/generated/prisma/*", "@/server/db"],
  message: "Acesso ao banco só em src/server/** e em queries.ts/mutations.ts das features.",
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
    files: ["src/server/**", "src/features/*/queries.ts", "src/features/*/mutations.ts"],
    rules: { "no-restricted-imports": "off" },
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
