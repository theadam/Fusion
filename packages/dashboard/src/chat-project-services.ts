import { AgentStore, ChatStore, type MessageStore, type TaskStore } from "@fusion/core";
import type { ProjectEngineManager } from "@fusion/engine";
import { ChatManager } from "./chat.js";
import { getOrCreateProjectStore } from "./project-store-resolver.js";

const scopedChatStoreCache = new Map<string, ChatStore>();

function cacheKeyForStore(store: TaskStore): string {
  return store.getFusionDir();
}

export function getOrCreateScopedChatStore(store: TaskStore, fallbackChatStore?: ChatStore): ChatStore {
  const key = cacheKeyForStore(store);
  const cached = scopedChatStoreCache.get(key);
  if (cached) return cached;

  const chatStore = fallbackChatStore ?? new ChatStore(store.getFusionDir(), store.getDatabase());
  scopedChatStoreCache.set(key, chatStore);
  return chatStore;
}

export async function resolveProjectChatContext(options: {
  projectId?: string | null;
  defaultStore: TaskStore;
  defaultChatStore?: ChatStore;
  engineManager?: ProjectEngineManager;
}): Promise<{ store: TaskStore; chatStore: ChatStore }> {
  const { projectId, defaultStore, defaultChatStore, engineManager } = options;
  if (!projectId) {
    return {
      store: defaultStore,
      chatStore: getOrCreateScopedChatStore(defaultStore, defaultChatStore),
    };
  }

  const engine = engineManager?.getEngine(projectId);
  try {
    const scopedStore = engine?.getTaskStore() ?? await getOrCreateProjectStore(projectId);
    return {
      store: scopedStore,
      chatStore: getOrCreateScopedChatStore(scopedStore),
    };
  } catch {
    return {
      store: defaultStore,
      chatStore: getOrCreateScopedChatStore(defaultStore, defaultChatStore),
    };
  }
}

export async function createProjectScopedChatManager(options: {
  store: TaskStore;
  chatStore: ChatStore;
  pluginRunner?: ConstructorParameters<typeof ChatManager>[3];
  messageStore?: MessageStore;
}): Promise<ChatManager> {
  const agentStore = new AgentStore({ rootDir: options.store.getFusionDir() });
  return new ChatManager(
    options.chatStore,
    options.store.getRootDir(),
    agentStore,
    options.pluginRunner,
    () => options.store.getSettings(),
    options.messageStore,
  );
}

/**
 * Cache of project-scoped ChatManager instances keyed by projectId.
 *
 * Generation state (activeGenerations, inFlightPersistTimers) lives on the
 * ChatManager instance, so cancel/send for the same session MUST go through
 * the same manager. Caching by projectId guarantees that.
 */
const scopedChatManagerCache = new Map<string, ChatManager>();

export async function getOrCreateScopedChatManager(options: {
  projectId: string;
  store: TaskStore;
  chatStore: ChatStore;
  pluginRunner?: ConstructorParameters<typeof ChatManager>[3];
  messageStore?: MessageStore;
}): Promise<ChatManager> {
  const cached = scopedChatManagerCache.get(options.projectId);
  if (cached) return cached;
  const manager = await createProjectScopedChatManager({
    store: options.store,
    chatStore: options.chatStore,
    pluginRunner: options.pluginRunner,
    messageStore: options.messageStore,
  });
  scopedChatManagerCache.set(options.projectId, manager);
  return manager;
}

export function __resetScopedChatStoreCache(): void {
  scopedChatStoreCache.clear();
  scopedChatManagerCache.clear();
}
