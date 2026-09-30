import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Server actions keep parameters the pages still bind but no longer
      // trust (e.g. an eventId the guard re-derives); prefix them with _.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // @/db connects as the database owner, which RLS policies do not apply to.
    // App reads and writes go through supabase-js with the signed-in person's
    // token so the database decides them; only BetterAuth (src/lib/auth) owns
    // tables it must reach directly.
    files: ["src/app/**", "src/components/**", "src/lib/actions/**"],
    ignores: ["src/lib/auth/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/db", "@/db/*"],
              message:
                "@/db is the owner connection and bypasses RLS. Use the Supabase client (@/lib/db/server) so policies decide; only src/lib/auth may import @/db.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/lib/db/supabase.types.ts",
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
