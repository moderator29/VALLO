import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parsePbxproj, type PbxObject, type PbxValue } from "./pbxproj";

/**
 * THE NOTIFICATION SERVICE EXTENSION, HAND-WIRED INTO THE XCODE PROJECT
 * (FEATURE_BACKLOG A1; the founder builds through GitHub Actions and has no
 * Xcode). The whole project file is parsed, and every object the extension
 * needs is checked, as is the App target, which must build exactly as before
 * plus the one embed phase and the one dependency.
 */
const root = fileURLToPath(new URL("../../../", import.meta.url));
const project = parsePbxproj(readFileSync(`${root}ios/App/App.xcodeproj/project.pbxproj`, "utf8"));
const objects = project.objects as Record<string, PbxObject>;
const NAME = "VALLONotificationService";

const all = (isa: string) => Object.entries(objects).filter(([, o]) => o.isa === isa);
const one = (isa: string, pick: (o: PbxObject) => boolean): [string, PbxObject] => {
  const found = all(isa).filter(([, o]) => pick(o));
  expect(found, isa).toHaveLength(1);
  return found[0]!;
};
const list = (v: PbxValue | undefined) => (Array.isArray(v) ? (v as string[]) : []);
const settingsOf = (configListId: string) =>
  list((objects[configListId] as PbxObject).buildConfigurations).map((id) => objects[id] as PbxObject);

describe("the project file", () => {
  it("parses as a whole, and every reference it holds points at an object it defines", () => {
    const ids = new Set(Object.keys(objects));
    const text = readFileSync(`${root}ios/App/App.xcodeproj/project.pbxproj`, "utf8");
    for (const ref of new Set(text.match(/\b[0-9A-F]{24}\b/g) ?? [])) expect(ids.has(ref), ref).toBe(true);
  });
});

describe("the extension target", () => {
  const [targetId, target] = one("PBXNativeTarget", (o) => o.name === NAME);

  it("is an app extension whose product is the appex", () => {
    expect(target.productType).toBe("com.apple.product-type.app-extension");
    const product = objects[target.productReference as string] as PbxObject;
    expect(product.isa).toBe("PBXFileReference");
    expect(product.path).toBe(`${NAME}.appex`);
    expect(product.explicitFileType).toBe("wrapper.app-extension");
    expect(product.sourceTree).toBe("BUILT_PRODUCTS_DIR");
  });

  it("compiles NotificationService.swift and nothing else", () => {
    const phases = list(target.buildPhases).map((id) => objects[id] as PbxObject);
    expect(phases.map((p) => p.isa)).toEqual(["PBXSourcesBuildPhase", "PBXFrameworksBuildPhase", "PBXResourcesBuildPhase"]);
    const files = list(phases[0]!.files).map((id) => objects[(objects[id] as PbxObject).fileRef as string] as PbxObject);
    expect(files.map((f) => f.path)).toEqual(["NotificationService.swift"]);
    expect(list(phases[1]!.files)).toEqual([]);
    expect(list(phases[2]!.files)).toEqual([]);
  });

  it("carries its own bundle id under the app's, the app's deployment target and versions, iPhone only", () => {
    const appTarget = one("PBXNativeTarget", (o) => o.name === "App")[1];
    const app = settingsOf(appTarget.buildConfigurationList as string);
    const ext = settingsOf(target.buildConfigurationList as string);
    expect(ext.map((c) => c.name).sort()).toEqual(["Debug", "Release"]);
    for (const config of ext) {
      const s = config.buildSettings as PbxObject;
      const twin = app.find((c) => c.name === config.name)!.buildSettings as PbxObject;
      expect(s.PRODUCT_BUNDLE_IDENTIFIER).toBe("com.vallospaces.app.NotificationService");
      expect(s.INFOPLIST_FILE).toBe(`${NAME}/Info.plist`);
      expect(s.IPHONEOS_DEPLOYMENT_TARGET).toBe(twin.IPHONEOS_DEPLOYMENT_TARGET);
      expect(s.MARKETING_VERSION).toBe(twin.MARKETING_VERSION);
      expect(s.CURRENT_PROJECT_VERSION).toBe(twin.CURRENT_PROJECT_VERSION);
      expect(s.TARGETED_DEVICE_FAMILY).toBe("1");
      expect(s.CODE_SIGN_STYLE).toBe("Automatic");
      expect(s.DEVELOPMENT_TEAM).toBe("X74KD52994");
      expect(s.SKIP_INSTALL).toBe("YES");
      expect(s.SWIFT_VERSION).toBe(twin.SWIFT_VERSION);
    }
  });

  it("is in the project's targets and its own group, with both source files present", () => {
    const [, proj] = one("PBXProject", () => true);
    expect(list(proj.targets)).toContain(targetId);
    const [, group] = one("PBXGroup", (o) => o.path === NAME);
    const children = list(group.children).map((id) => (objects[id] as PbxObject).path);
    expect(children.sort()).toEqual(["Info.plist", "NotificationService.swift"]);
    const main = objects[proj.mainGroup as string] as PbxObject;
    expect(list(main.children)).toContain(one("PBXGroup", (o) => o.path === NAME)[0]);
    for (const f of ["NotificationService.swift", "Info.plist"]) {
      expect(readFileSync(`${root}ios/App/${NAME}/${f}`, "utf8").length).toBeGreaterThan(100);
    }
  });
});

describe("the App target", () => {
  const [, app] = one("PBXNativeTarget", (o) => o.name === "App");
  const [extId] = one("PBXNativeTarget", (o) => o.name === NAME);

  it("still builds what it built, plus one embed phase for the extension", () => {
    const phases = list(app.buildPhases).map((id) => objects[id] as PbxObject);
    expect(phases.map((p) => p.isa)).toEqual(["PBXSourcesBuildPhase", "PBXFrameworksBuildPhase", "PBXResourcesBuildPhase", "PBXCopyFilesBuildPhase"]);
    const sources = list(phases[0]!.files).map((id) => (objects[(objects[id] as PbxObject).fileRef as string] as PbxObject).path).sort();
    expect(sources).toEqual(["AppDelegate.swift", "SceneDelegate.swift", "ValloShell.swift"]);
    const embed = phases[3]!;
    expect(embed.name).toBe("Embed Foundation Extensions");
    expect(embed.dstSubfolderSpec).toBe("13");
    const embedded = list(embed.files).map((id) => objects[id] as PbxObject);
    expect(embedded).toHaveLength(1);
    expect((objects[embedded[0]!.fileRef as string] as PbxObject).path).toBe(`${NAME}.appex`);
    expect(list((embedded[0]!.settings as PbxObject).ATTRIBUTES)).toEqual(["RemoveHeadersOnCopy"]);
  });

  it("depends on the extension through a container proxy, so the extension builds first", () => {
    const deps = list(app.dependencies).map((id) => objects[id] as PbxObject);
    expect(deps).toHaveLength(1);
    expect(deps[0]!.isa).toBe("PBXTargetDependency");
    expect(deps[0]!.target).toBe(extId);
    const proxy = objects[deps[0]!.targetProxy as string] as PbxObject;
    expect(proxy.isa).toBe("PBXContainerItemProxy");
    expect(proxy.remoteGlobalIDString).toBe(extId);
    expect(proxy.proxyType).toBe("1");
    expect(proxy.remoteInfo).toBe(NAME);
  });

  it("keeps its own bundle id, entitlements and settings", () => {
    for (const config of settingsOf(app.buildConfigurationList as string)) {
      const s = config.buildSettings as PbxObject;
      expect(s.PRODUCT_BUNDLE_IDENTIFIER).toBe("com.vallospaces.app");
      expect(s.CODE_SIGN_ENTITLEMENTS).toBe("App/App.entitlements");
      expect(s.INFOPLIST_FILE).toBe("App/Info.plist");
    }
    expect(list(app.packageProductDependencies)).toHaveLength(1);
  });
});
