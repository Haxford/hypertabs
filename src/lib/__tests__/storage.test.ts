import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Chrome storage mock – must be set up before importing the module under test
// ---------------------------------------------------------------------------

const mockStorage: Record<string, unknown> = {};

globalThis.chrome = {
  storage: {
    local: {
      get: vi.fn((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
        return Promise.resolve();
      }),
      remove: vi.fn((key: string) => {
        delete mockStorage[key];
        return Promise.resolve();
      }),
      clear: vi.fn(() => {
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
        return Promise.resolve();
      }),
    },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
} as any;

// Import after the mock is in place
import {
  get,
  set,
  update,
  remove,
  clear,
  DEFAULT_HARPOON_STATE,
  DEFAULT_SETTINGS,
} from '../storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Clear mock storage and call counts between tests
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  vi.clearAllMocks();
});

// =============================================================================
// get()
// =============================================================================

describe('get()', () => {
  it('returns the default harpoon state when nothing is stored', async () => {
    const result = await get('harpoon');
    expect(result).toEqual(DEFAULT_HARPOON_STATE);
  });

  it('returns the default settings when nothing is stored', async () => {
    const result = await get('settings');
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('returns the stored value when one exists', async () => {
    const custom = { ...DEFAULT_HARPOON_STATE, maxSlots: 10 };
    mockStorage['harpoon'] = custom;

    const result = await get('harpoon');
    expect(result).toEqual(custom);
  });
});

// =============================================================================
// set()
// =============================================================================

describe('set()', () => {
  it('stores a value in mock storage', async () => {
    await set('settings', DEFAULT_SETTINGS);
    expect(mockStorage['settings']).toEqual(DEFAULT_SETTINGS);
  });

  it('calls chrome.storage.local.set with the correct arguments', async () => {
    await set('harpoon', DEFAULT_HARPOON_STATE);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      harpoon: DEFAULT_HARPOON_STATE,
    });
  });
});

// =============================================================================
// update()
// =============================================================================

describe('update()', () => {
  it('reads, transforms, and writes the value', async () => {
    mockStorage['harpoon'] = { ...DEFAULT_HARPOON_STATE, maxSlots: 5 };

    const result = await update('harpoon', (current) => ({
      ...current,
      maxSlots: 8,
    }));

    expect(result.maxSlots).toBe(8);
    expect((mockStorage['harpoon'] as any).maxSlots).toBe(8);
  });

  it('serializes concurrent calls so both changes are applied', async () => {
    mockStorage['harpoon'] = {
      ...DEFAULT_HARPOON_STATE,
      maxSlots: 5,
    };

    // Launch two updates concurrently – the second must see the result of the first
    const p1 = update('harpoon', (current) => ({
      ...current,
      maxSlots: current.maxSlots + 1, // 5 -> 6
    }));

    const p2 = update('harpoon', (current) => ({
      ...current,
      maxSlots: current.maxSlots + 1, // 6 -> 7
    }));

    await Promise.all([p1, p2]);

    // Both increments must be visible
    expect((mockStorage['harpoon'] as any).maxSlots).toBe(7);
  });
});

// =============================================================================
// remove() / clear()
// =============================================================================

describe('remove()', () => {
  it('removes a key from storage', async () => {
    mockStorage['harpoon'] = DEFAULT_HARPOON_STATE;
    await remove('harpoon');
    expect(mockStorage['harpoon']).toBeUndefined();
  });
});

describe('clear()', () => {
  it('removes all keys from storage', async () => {
    mockStorage['harpoon'] = DEFAULT_HARPOON_STATE;
    mockStorage['settings'] = DEFAULT_SETTINGS;
    await clear();
    expect(Object.keys(mockStorage)).toHaveLength(0);
  });
});
