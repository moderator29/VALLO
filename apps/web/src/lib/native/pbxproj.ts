/**
 * A reader for Xcode's `project.pbxproj` (an old-style OpenStep property
 * list), for the tests that hold the iOS project in shape. No Xcode runs in
 * this repository, so a hand-edited project is only as good as what reads it
 * back: this parses the whole file (dictionaries, arrays, quoted and bare
 * strings, comments) and fails on anything malformed, which is the first thing
 * Xcode itself would do.
 */
export type PbxValue = string | PbxValue[] | { [key: string]: PbxValue };
export type PbxObject = { [key: string]: PbxValue };

export function parsePbxproj(source: string): PbxObject {
  let i = 0;
  const text = source.replace(/^\/\/ !\$\*UTF8\*\$!\s*/, "");
  const fail = (why: string): never => {
    throw new Error(`pbxproj: ${why} at offset ${i}: ${JSON.stringify(text.slice(i, i + 40))}`);
  };
  const skip = () => {
    for (;;) {
      while (i < text.length && /\s/.test(text[i]!)) i++;
      if (text.startsWith("/*", i)) {
        const end = text.indexOf("*/", i + 2);
        if (end < 0) fail("unclosed comment");
        i = end + 2;
      } else if (text.startsWith("//", i)) {
        const end = text.indexOf("\n", i);
        i = end < 0 ? text.length : end + 1;
      } else return;
    }
  };
  const string = (): string => {
    skip();
    if (text[i] === '"') {
      let out = "";
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\") {
          out += text[i + 1];
          i += 2;
        } else out += text[i++];
      }
      if (text[i] !== '"') fail("unclosed string");
      i++;
      return out;
    }
    const match = /^[A-Za-z0-9_$./:+-]+/.exec(text.slice(i));
    if (!match) fail("expected a value");
    i += match![0].length;
    return match![0];
  };
  const value = (): PbxValue => {
    skip();
    if (text[i] === "{") {
      i++;
      const out: PbxObject = {};
      for (;;) {
        skip();
        if (text[i] === "}") {
          i++;
          return out;
        }
        const key = string();
        skip();
        if (text[i] !== "=") fail("expected =");
        i++;
        if (key in out) fail(`duplicate key ${key}`);
        out[key] = value();
        skip();
        if (text[i] !== ";") fail("expected ;");
        i++;
      }
    }
    if (text[i] === "(") {
      i++;
      const out: PbxValue[] = [];
      for (;;) {
        skip();
        if (text[i] === ")") {
          i++;
          return out;
        }
        out.push(value());
        skip();
        if (text[i] === ",") i++;
        else if (text[i] !== ")") fail("expected , or )");
      }
    }
    return string();
  };
  const root = value();
  skip();
  if (i !== text.length) fail("trailing content");
  if (typeof root !== "object" || Array.isArray(root)) fail("root is not a dictionary");
  return root as PbxObject;
}
