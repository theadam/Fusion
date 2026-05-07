// Duplicated from packages/dashboard/app/utils/projectStorage.ts for plugin isolation.
// Keeps the same project-scoped key convention: kb:${projectId}:${baseKey}.

export function scopedKey(baseKey: string, projectId?: string | null): string {
  if (typeof projectId !== "string" || projectId.length === 0) {
    return baseKey;
  }

  return `kb:${projectId}:${baseKey}`;
}

export function getScopedItem(baseKey: string, projectId?: string | null): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const getItem = window.localStorage?.getItem;
  if (typeof getItem !== "function") {
    return null;
  }

  return getItem.call(window.localStorage, scopedKey(baseKey, projectId));
}

export function setScopedItem(baseKey: string, value: string, projectId?: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  const setItem = window.localStorage?.setItem;
  if (typeof setItem !== "function") {
    return;
  }

  setItem.call(window.localStorage, scopedKey(baseKey, projectId), value);
}

export function removeScopedItem(baseKey: string, projectId?: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  const removeItem = window.localStorage?.removeItem;
  if (typeof removeItem !== "function") {
    return;
  }

  removeItem.call(window.localStorage, scopedKey(baseKey, projectId));
}
