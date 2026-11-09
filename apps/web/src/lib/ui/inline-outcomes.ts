import ts from "typescript";

/**
 * WHERE AN OUTCOME IS STILL WRITTEN BESIDE A CONTROL (founder, 7 November
 * 2026, "THE BANNER EVERYWHERE"). Every outcome, failure, warning and field
 * problem is said by the one top banner (`lib/ui/toast.ts`); a field keeps
 * only its red edge and a visually hidden note (`components/ui/FieldProblem`).
 *
 * This finds the two shapes an inline outcome takes in JSX, reading the
 * syntax tree so a comment that quotes one is not a hit:
 *
 *   alert       an element with `role="alert"`: words announced as a refusal,
 *               drawn where they happened rather than at the top.
 *   errorText   a `p`, `span` or `div` painted in the error ink
 *               (`--nf-state-error` in its class or its style): a red line
 *               of words under a form or beside a button.
 *
 * `no-inline-outcome.test.ts` holds the tree to an allow-list of the places
 * that are not outcomes (a page that could not be read, a live call screen,
 * the page's own record) with the reason for each.
 */
export type InlineOutcomeCounts = { alert: number; errorText: number };

const TEXT_TAGS = new Set(["p", "span", "div"]);

function attr(node: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined {
  return node.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === name,
  );
}

function paintsErrorInk(node: ts.JsxOpeningLikeElement, source: ts.SourceFile): boolean {
  for (const name of ["className", "style"]) {
    const found = attr(node, name);
    if (found?.initializer && found.initializer.getText(source).includes("--nf-state-error")) return true;
  }
  return false;
}

export function inlineOutcomes(file: string, text: string): InlineOutcomeCounts {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const counts: InlineOutcomeCounts = { alert: 0, errorText: 0 };
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const role = attr(node, "role");
      if (role?.initializer && ts.isStringLiteral(role.initializer) && role.initializer.text === "alert") counts.alert += 1;
      if (TEXT_TAGS.has(node.tagName.getText(source)) && paintsErrorInk(node, source)) counts.errorText += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return counts;
}
