import { beforeEach, describe, expect, it, vi } from "vitest";
import { getScopedItem, removeScopedItem, scopedKey, setScopedItem } from "../utils/scopedStorage";

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

describe("scopedStorage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("window", { localStorage: createStorage() });
  });

  it("scopedKey uses kb project prefix when project id is provided", () => {
    expect(scopedKey("baseKey", "project-1")).toBe("kb:project-1:baseKey");
  });

  it("scopedKey falls back to unscoped key for undefined/null/empty project id", () => {
    expect(scopedKey("baseKey", undefined)).toBe("baseKey");
    expect(scopedKey("baseKey", null)).toBe("baseKey");
    expect(scopedKey("baseKey", "")).toBe("baseKey");
  });

  it("getScopedItem reads from localStorage using scoped key", () => {
    window.localStorage.setItem("kb:project-1:baseKey", "value");
    expect(getScopedItem("baseKey", "project-1")).toBe("value");
  });

  it("getScopedItem returns null when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(getScopedItem("baseKey", "project-1")).toBeNull();
  });

  it("setScopedItem writes to localStorage using scoped key", () => {
    setScopedItem("baseKey", "value", "project-1");
    expect(window.localStorage.getItem("kb:project-1:baseKey")).toBe("value");
  });

  it("setScopedItem is a no-op when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(() => setScopedItem("baseKey", "value", "project-1")).not.toThrow();
  });

  it("removeScopedItem removes from localStorage using scoped key", () => {
    window.localStorage.setItem("kb:project-1:baseKey", "value");
    removeScopedItem("baseKey", "project-1");
    expect(window.localStorage.getItem("kb:project-1:baseKey")).toBeNull();
  });
});
