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
    // auth, Next.js or icons. Drizzle schema types and pgEnums stay allowed.
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
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
                "@/app/*",
                "@/auth/*",
                "next",
                "next/*",
                "lucide-react",
              ],
              message:
                "ADR 0001: src/lib is pure business logic and never imports the seed, queries, mutations, actions, components, pages, auth, Next.js or icons. Move the shared piece down into src/lib, or pass it in.",
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
  ]),
]);

export default eslintConfig;
