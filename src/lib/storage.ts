/**
 * Storage Abstraction Layer
 * 
 * Provides a clean API for interacting with chrome.storage.local.
 * All extension data is stored locally for privacy.
 * 
 * In the future, this could be extended to support chrome.storage.sync
 * for optional cloud synchronization.
 */

import type {
  StorageKey,
  StorageSchema,
  HarpoonState,
  WorkspaceState,
  Settings,
} from './types';

// =============================================================================
// DEFAULT VALUES
// =============================================================================

/**
 * Default harpoon state for new installations
 */
export const DEFAULT_HARPOON_STATE: HarpoonState = {
  slots: [null, null, null, null, null], // 5 empty slots by default
  maxSlots: 5,
};

/**
 * Default workspace state for new installations
 */
export const DEFAULT_WORKSPACE_STATE: WorkspaceState = {
  workspaces: [
    {
      id: 'default',
      name: 'Default',
      tabUrls: [],
      tabIds: [],
      isDefault: true,
    },
  ],
  activeWorkspaceId: 'default',
  tabToWorkspace: {},
};

/**
 * Default settings for new installations
 */
export const DEFAULT_SETTINGS: Settings = {
  // Keybinds
  vimModeEnabled: false,
  keybinds: {},

  // Harpoon
  harpoonMaxSlots: 5,
  harpoonReopenClosed: true,

  // Telescope
  telescopeShowUrls: true,
  telescopeMaxResults: 50,

  // Workspaces
  defaultWorkspaceName: 'Default',

  // UI
  theme: 'system',
};

// =============================================================================
// CONCURRENCY CONTROL
// =============================================================================

/**
 * Per-key lock map for serializing update() calls.
 * Each entry holds a Promise that resolves when the current update for that key
 * completes, so subsequent updates on the same key queue behind it.
 */
const updateLocks = new Map<StorageKey, Promise<void>>();

// =============================================================================
// STORAGE OPERATIONS
// =============================================================================

/**
 * Retrieves a value from chrome.storage.local
 * Returns the default value if the key doesn't exist
 * 
 * @param key - The storage key to retrieve
 * @returns Promise resolving to the stored value or default
 */
export async function get<K extends StorageKey>(
  key: K
): Promise<StorageSchema[K]> {
  const result = await chrome.storage.local.get(key);
  
  // Return stored value or appropriate default
  if (result[key] !== undefined) {
    return result[key] as StorageSchema[K];
  }

  // Return defaults based on key
  switch (key) {
    case 'harpoon':
      return DEFAULT_HARPOON_STATE as StorageSchema[K];
    case 'workspaces':
      return DEFAULT_WORKSPACE_STATE as StorageSchema[K];
    case 'settings':
      return DEFAULT_SETTINGS as StorageSchema[K];
    default:
      throw new Error(`Unknown storage key: ${key}`);
  }
}

/**
 * Stores a value in chrome.storage.local
 * 
 * @param key - The storage key to set
 * @param value - The value to store
 */
export async function set<K extends StorageKey>(
  key: K,
  value: StorageSchema[K]
): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

/**
 * Updates a stored value using a callback function.
 * Concurrent calls on the same key are serialized using a per-key Promise lock,
 * so each updater sees the result of the previous update rather than a stale value.
 * 
 * @param key - The storage key to update
 * @param updater - Function that receives current value and returns updated value
 */
export async function update<K extends StorageKey>(
  key: K,
  updater: (current: StorageSchema[K]) => StorageSchema[K]
): Promise<StorageSchema[K]> {
  // Wait for any in-flight update on this key to finish before proceeding
  const pending = updateLocks.get(key);

  // Promise executor runs synchronously, so releaseLock is assigned before use
  let releaseLock = () => {};
  const lock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  updateLocks.set(key, lock);

  try {
    if (pending) {
      await pending;
    }
    const current = await get(key);
    const updated = updater(current);
    await set(key, updated);
    return updated;
  } finally {
    releaseLock();
    // Clean up the map entry only if it still points to our lock
    if (updateLocks.get(key) === lock) {
      updateLocks.delete(key);
    }
  }
}

/**
 * Removes a key from storage (resets to default)
 * 
 * @param key - The storage key to remove
 */
export async function remove(key: StorageKey): Promise<void> {
  await chrome.storage.local.remove(key);
}

/**
 * Clears all extension storage (use with caution!)
 */
export async function clear(): Promise<void> {
  await chrome.storage.local.clear();
}

/**
 * Gets all storage data at once
 * Useful for export functionality
 */
export async function getAll(): Promise<Partial<StorageSchema>> {
  return await chrome.storage.local.get(null);
}

/**
 * Imports storage data (for import functionality)
 * Validates and merges with defaults to ensure data integrity
 * 
 * @param data - Partial storage data to import
 */
export async function importData(data: Partial<StorageSchema>): Promise<void> {
  // Merge with defaults to ensure all required fields exist
  if (data.harpoon) {
    await set('harpoon', { ...DEFAULT_HARPOON_STATE, ...data.harpoon });
  }
  if (data.workspaces) {
    await set('workspaces', { ...DEFAULT_WORKSPACE_STATE, ...data.workspaces });
  }
  if (data.settings) {
    await set('settings', { ...DEFAULT_SETTINGS, ...data.settings });
  }
}

// =============================================================================
// STORAGE CHANGE LISTENER
// =============================================================================

/**
 * Storage change callback type
 */
interface StorageChanges {
  harpoon?: { oldValue?: HarpoonState; newValue?: HarpoonState };
  workspaces?: { oldValue?: WorkspaceState; newValue?: WorkspaceState };
  settings?: { oldValue?: Settings; newValue?: Settings };
}

/**
 * Subscribes to storage changes
 * 
 * @param callback - Function called when storage changes
 * @returns Unsubscribe function
 */
export function subscribe(callback: (changes: StorageChanges) => void): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    // Only listen to local storage changes
    if (areaName !== 'local') return;

    // Filter to only our known keys
    const relevantChanges: StorageChanges = {};

    if (changes.harpoon) {
      relevantChanges.harpoon = changes.harpoon as StorageChanges['harpoon'];
    }
    if (changes.workspaces) {
      relevantChanges.workspaces = changes.workspaces as StorageChanges['workspaces'];
    }
    if (changes.settings) {
      relevantChanges.settings = changes.settings as StorageChanges['settings'];
    }

    // Only call callback if there are relevant changes
    if (Object.keys(relevantChanges).length > 0) {
      callback(relevantChanges);
    }
  };

  chrome.storage.onChanged.addListener(listener);

  // Return unsubscribe function
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}
