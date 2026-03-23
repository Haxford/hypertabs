import { describe, it, expect } from 'vitest';
import {
  validateHarpoonMarkPayload,
  validateHarpoonSlotPayload,
  validateSearchResultPayload,
  validateWorkspaceSwitchPayload,
  validateWorkspaceCreatePayload,
  validateWorkspaceDeletePayload,
} from '../validators';

// =============================================================================
// validateHarpoonMarkPayload
// =============================================================================

describe('validateHarpoonMarkPayload', () => {
  it('accepts a valid payload with slotId only', () => {
    const result = validateHarpoonMarkPayload({ slotId: 1 });
    expect(result).toEqual({ slotId: 1, tabId: undefined });
  });

  it('accepts a valid payload with slotId and tabId', () => {
    const result = validateHarpoonMarkPayload({ slotId: 2, tabId: 42 });
    expect(result).toEqual({ slotId: 2, tabId: 42 });
  });

  it('throws for null payload', () => {
    expect(() => validateHarpoonMarkPayload(null)).toThrow('expected a plain object, got null');
  });

  it('throws for non-object payload', () => {
    expect(() => validateHarpoonMarkPayload('bad')).toThrow('expected a plain object');
  });

  it('throws when slotId is missing', () => {
    expect(() => validateHarpoonMarkPayload({})).toThrow('"slotId" must be a number');
  });

  it('throws when slotId is wrong type', () => {
    expect(() => validateHarpoonMarkPayload({ slotId: 'one' })).toThrow('"slotId" must be a number');
  });

  it('throws when tabId is present but wrong type', () => {
    expect(() => validateHarpoonMarkPayload({ slotId: 1, tabId: 'x' })).toThrow('"tabId" must be a number');
  });
});

// =============================================================================
// validateHarpoonSlotPayload
// =============================================================================

describe('validateHarpoonSlotPayload', () => {
  it('accepts a valid payload', () => {
    const result = validateHarpoonSlotPayload({ slotId: 3 }, 'HARPOON_JUMP');
    expect(result).toEqual({ slotId: 3 });
  });

  it('throws when slotId is missing', () => {
    expect(() => validateHarpoonSlotPayload({}, 'HARPOON_JUMP')).toThrow('"slotId" must be a number');
  });

  it('throws for null payload', () => {
    expect(() => validateHarpoonSlotPayload(null, 'HARPOON_REMOVE')).toThrow('expected a plain object, got null');
  });

  it('uses the provided messageType in error text', () => {
    expect(() => validateHarpoonSlotPayload({}, 'HARPOON_REMOVE')).toThrow('HARPOON_REMOVE payload');
  });
});

// =============================================================================
// validateSearchResultPayload
// =============================================================================

describe('validateSearchResultPayload', () => {
  const validResult = {
    type: 'tab',
    id: '123',
    title: 'My Tab',
    url: 'https://example.com',
  };

  it('accepts a valid minimal search result', () => {
    const result = validateSearchResultPayload(validResult);
    expect(result).toEqual(validResult);
  });

  it('accepts optional fields', () => {
    const payload = {
      ...validResult,
      favicon: 'https://example.com/icon.png',
      windowId: 1,
      lastVisited: 1700000000,
      harpoonSlot: 2,
    };
    const result = validateSearchResultPayload(payload);
    expect(result).toEqual(payload);
  });

  it('throws for invalid type value', () => {
    expect(() =>
      validateSearchResultPayload({ ...validResult, type: 'invalid' }),
    ).toThrow('must be one of tab, history, bookmark');
  });

  it('throws when required field "title" is missing', () => {
    const { title: _, ...noTitle } = validResult;
    expect(() => validateSearchResultPayload(noTitle)).toThrow('"title" must be a string');
  });

  it('throws when "url" has wrong type', () => {
    expect(() =>
      validateSearchResultPayload({ ...validResult, url: 123 }),
    ).toThrow('"url" must be a string');
  });

  it('throws for null payload', () => {
    expect(() => validateSearchResultPayload(null)).toThrow('expected a plain object, got null');
  });

  it('throws for array payload', () => {
    expect(() => validateSearchResultPayload([])).toThrow('expected a plain object');
  });
});

// =============================================================================
// validateWorkspaceSwitchPayload
// =============================================================================

describe('validateWorkspaceSwitchPayload', () => {
  it('accepts a valid string workspaceId', () => {
    const result = validateWorkspaceSwitchPayload({ workspaceId: 'ws-1' });
    expect(result).toEqual({ workspaceId: 'ws-1' });
  });

  it('accepts null workspaceId', () => {
    const result = validateWorkspaceSwitchPayload({ workspaceId: null });
    expect(result).toEqual({ workspaceId: null });
  });

  it('throws when workspaceId is a number', () => {
    expect(() =>
      validateWorkspaceSwitchPayload({ workspaceId: 42 }),
    ).toThrow('"workspaceId" must be a string or null');
  });
});

// =============================================================================
// validateWorkspaceCreatePayload
// =============================================================================

describe('validateWorkspaceCreatePayload', () => {
  it('accepts a valid name', () => {
    const result = validateWorkspaceCreatePayload({ name: 'Work' });
    expect(result).toEqual({ name: 'Work' });
  });

  it('throws when name is missing', () => {
    expect(() => validateWorkspaceCreatePayload({})).toThrow('"name" must be a string');
  });
});

// =============================================================================
// validateWorkspaceDeletePayload
// =============================================================================

describe('validateWorkspaceDeletePayload', () => {
  it('accepts a valid workspaceId', () => {
    const result = validateWorkspaceDeletePayload({ workspaceId: 'ws-1' });
    expect(result).toEqual({ workspaceId: 'ws-1' });
  });

  it('throws when workspaceId is missing', () => {
    expect(() => validateWorkspaceDeletePayload({})).toThrow('"workspaceId" must be a string');
  });
});
