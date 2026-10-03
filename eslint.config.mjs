import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  {
    // Native pickers ignore the Appearance Theme and differ per browser, so
    // forms use the shadcn controls and the wrappers built on them. Covers
    // <input> and shadcn <Input> with type="…" or type={"…"}; a type passed
    // through a {...props} spread can't be seen here.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='select']",
          message:
            "Use Select from @/components/ui/select (or OptionSelect / EntityCombobox) instead of a native <select>.",
        },
        {
          selector:
            "JSXOpeningElement[name.name=/^[iI]nput$/]:has(JSXAttribute[name.name='type'] Literal[value='date'])",
          message:
            'Use DatePicker or DateRangePicker instead of <input type="date">.',
        },
        {
          selector:
            "JSXOpeningElement[name.name=/^[iI]nput$/]:has(JSXAttribute[name.name='type'] Literal[value='time'])",
          message: 'Use TimeCombobox instead of <input type="time">.',
        },
        {
          selector:
            "JSXOpeningElement[name.name=/^[iI]nput$/]:has(JSXAttribute[name.name='type'] Literal[value='color'])",
          message: 'Use ColorField instead of <input type="color">.',
        },
        {
          selector:
            "JSXOpeningElement[name.name=/^[iI]nput$/]:has(JSXAttribute[name.name='type'] Literal[value='checkbox'])",
          message:
            'Use Switch from @/components/ui/switch instead of <input type="checkbox">.',
        },
      ],
    },
  },
  {
    // ADR 0001: lib is pure business logic at the bottom of the layers. It
    // never imports the seed, queries, mutations, actions, components, pages,
    // auth, the MCP server, Next.js, icons, or the database client and
    // driver. From `@/db/schema` it takes types only: a value import would
    // pull Drizzle into every client bundle that uses lib. Enum value lists
    // live in `src/lib/enums.ts`.
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/db/schema",
              allowTypeImports: true,
              message:
                "ADR 0001: src/lib imports only types from @/db/schema, so Drizzle stays out of client bundles. Use the value lists in @/lib/enums.",
            },
            // The live database client, by exact name: a "@/db" pattern
            // would also refuse the type imports from "@/db/schema".
            ...["@/db", "@/db/index"].map((name) => ({
              name,
              message:
                "ADR 0001: src/lib never touches the database; reads belong in queries and writes in mutations.",
            })),
          ],
          patterns: [
            {
              group: [
                "@/seed",
                "@/seed/*",
                "@/queries",
                "@/queries/*",
                "@/mutations",
                "@/mutations/*",
                "@/actions",
                "@/actions/*",
                "@/components",
                "@/components/*",
                "@/app",
                "@/app/*",
                "@/auth",
                "@/auth/*",
                "@/mcp",
                "@/mcp/*",
                "@/db/local-url",
                "@/db/test-transaction",
                "pg",
                "@neondatabase/*",
                "drizzle-orm",
                "drizzle-orm/*",
                "next",
                "next/*",
                "lucide-react",
              ],
              message:
                "ADR 0001: src/lib is pure business logic and never imports the seed, queries, mutations, actions, components, pages, auth, the MCP server, the database client or driver, Next.js or icons. Move the shared piece down into src/lib, or pass it in.",
            },
            {
              // A relative import that climbs out of src/lib into another
              // layer (e.g. "../db/schema" or "../../mutations/setup").
              regex:
                "^(\\.\\./)+(seed|queries|mutations|actions|components|app|auth|mcp|db)(/|$)",
              message:
                "ADR 0001: import other layers by their @/ alias, and only those src/lib may use.",
            },
          ],
        },
      ],
    },
  },
  {
    // ADR 0001: pages and routes sit at the top, so nothing below them
    // imports from src/app. A shared piece of a route moves down a layer
    // (as getNavAccount moved to src/auth). src/lib has its own,
    // wider ban.
    files: [
      "src/{components,hooks,queries,mutations,actions,auth,mcp,seed,db}/**/*.{ts,tsx}",
    ],
    // A test may import the page it exercises.
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app", "@/app/*"],
              message:
                "ADR 0001: only src/app imports from src/app. Move the shared piece down a layer (src/auth, src/queries, src/lib) and import it from there.",
            },
            {
              regex: "^(\\.\\./)+app(/|$)",
              message:
                "ADR 0001: only src/app imports from src/app. Move the shared piece down a layer and import it by its @/ alias.",
            },
          ],
        },
      ],
    },
  },
  {
    // The shadcn primitives are where native controls may still live.
    files: ["src/components/ui/**"],
    rules: { "no-restricted-syntax": "off" },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Drizzle migrations
    "drizzle/**",
    // Agent worktrees: separate checkouts with their own .next output.
    ".claude/**",
  ]),
]);

export default eslintConfig;
