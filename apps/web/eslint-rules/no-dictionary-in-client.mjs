/**
 * `nf/no-dictionary-in-client`: a `"use client"` module may not import
 * `@vallo/i18n` itself (Session 3, W13).
 *
 * WHY. `@vallo/i18n`'s index holds every word of every locale, and
 * `getDictionary` needs all of it. A client module that imports it carries the
 * whole thing into its route's first load: 1,351,758 bytes raw, 398,654
 * gzipped, measured on the production build (`.next/diagnostics/
 * route-bundle-stats.json`), on 34 routes on 6 October, including every money
 * route and `/messages/[id]`, which went from 343 to 750KB gzipped in one
 * commit. No other single import costs a phone that much.
 *
 * WHAT TO DO INSTEAD.
 *   - Formatters and types: `@vallo/i18n/core` (formatMoney, formatDate,
 *     plural, countOf, the `Dictionary` and `Locale` types). It holds no words.
 *   - Words: the server page picks the slices it needs and hands them down,
 *     as props, through `<CopyScope>` (`lib/i18n/copy-scope.tsx`), or through
 *     the root layout's client copy (`useClientCopy`).
 *
 * A type-only import (`import type ... from "@vallo/i18n"`) is erased and is
 * allowed. A dynamic `import("@vallo/i18n")` is allowed: the bundler splits it
 * into a chunk no first load carries, which is how the preview-harness
 * fallbacks work.
 *
 * Files that still break the rule are named in the config's `ignores`, so lint
 * stays green while each is fixed; the list only shrinks.
 *
 * THIS RULE SEES ONE FILE. A client module that imports a plain module that
 * imports `@vallo/i18n` passes it, and ships the dictionary all the same (the
 * docs chapter rail did, 17 October 2026). `src/app/client-import-graph.test.ts`
 * follows every static import from every client module and fails on that,
 * and on zod, livekit-client, leaflet and Paystack reached the same way.
 */

const SOURCE = "@vallo/i18n";

function isClientDirective(node) {
  return node?.type === "ExpressionStatement" && node.expression?.type === "Literal" && node.expression.value === "use client";
}

/** True when the module's directive prologue says `"use client"`. */
function isClientModule(program) {
  for (const statement of program.body) {
    if (isClientDirective(statement)) return true;
    if (statement.type !== "ExpressionStatement" || statement.expression?.type !== "Literal") return false;
  }
  return false;
}

const plugin = {
  rules: {
    "no-dictionary-in-client": {
      meta: {
        type: "problem",
        docs: {
          description:
            'A "use client" module may not import @vallo/i18n: it ships the whole dictionary (398KB gzipped) in the route\'s first load.',
        },
        schema: [],
        messages: {
          dictionary:
            'This "use client" module imports @vallo/i18n, which puts the whole dictionary (398KB gzipped, measured) in this route\'s first load. Import formatters and types from "@vallo/i18n/core", and take the words from the server page: as a prop, through <CopyScope> (lib/i18n/copy-scope.tsx), or through useClientCopy().',
        },
      },
      create(context) {
        let client = false;
        return {
          Program(program) {
            client = isClientModule(program);
          },
          ImportDeclaration(node) {
            if (!client || node.source.value !== SOURCE) return;
            if (node.importKind === "type") return;
            const values = node.specifiers.filter((s) => s.importKind !== "type");
            if (node.specifiers.length > 0 && values.length === 0) return;
            context.report({ node, messageId: "dictionary" });
          },
          ExportNamedDeclaration(node) {
            if (client && node.source?.value === SOURCE && node.exportKind !== "type") {
              context.report({ node, messageId: "dictionary" });
            }
          },
          ExportAllDeclaration(node) {
            if (client && node.source?.value === SOURCE) context.report({ node, messageId: "dictionary" });
          },
        };
      },
    },
  },
};

export default plugin;
