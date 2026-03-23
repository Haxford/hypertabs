/**
 * Message Payload Validators
 *
 * Runtime validation functions for message payloads received
 * by the background service worker. Each validator checks that
 * required fields exist and have the correct type, returning
 * a properly typed object or throwing a descriptive error.
 */

import type { SearchResult, SearchResultType } from './types';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Asserts that a value is a non-null object (not an array).
 *
 * @param value - The value to check
 * @param label - Human-readable context for error messages
 * @returns The value narrowed to `Record<string, unknown>`
 * @throws If the value is not a plain object
 */
function assertObject(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (value === null) {
    throw new Error(`${label}: expected a plain object, got null`);
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}: expected a plain object, got ${typeof value}`);
  }
  return value as Record<string, unknown>;
}

/**
 * Asserts that a field on an object is a `number`.
 *
 * @param obj   - The parent object
 * @param field - Property name to check
 * @param label - Human-readable context for error messages
 * @returns The numeric value
 * @throws If the field is missing or not a number
 */
function assertNumber(
  obj: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = obj[field];
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${label}: "${field}" must be a number, got ${typeof value}`);
  }
  return value;
}

/**
 * Asserts that a field on an object is a `string`.
 *
 * @param obj   - The parent object
 * @param field - Property name to check
 * @param label - Human-readable context for error messages
 * @returns The string value
 * @throws If the field is missing or not a string
 */
function assertString(
  obj: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = obj[field];
  if (typeof value !== 'string') {
    throw new Error(`${label}: "${field}" must be a string, got ${typeof value}`);
  }
  return value;
}

// =============================================================================
// HARPOON PAYLOAD VALIDATORS
// =============================================================================

/** Validated payload for a HARPOON_MARK message */
export interface HarpoonMarkPayload {
  slotId: number;
  tabId?: number;
}

/**
 * Validates the payload for a `HARPOON_MARK` message.
 *
 * @param payload - Raw message payload
 * @returns The validated payload with `slotId` and optional `tabId`
 * @throws If `slotId` is missing / wrong type or `tabId` is present but not a number
 */
export function validateHarpoonMarkPayload(payload: unknown): HarpoonMarkPayload {
  const label = 'HARPOON_MARK payload';
  const obj = assertObject(payload, label);
  const slotId = assertNumber(obj, 'slotId', label);

  let tabId: number | undefined;
  if (obj['tabId'] !== undefined) {
    tabId = assertNumber(obj, 'tabId', label);
  }

  return { slotId, tabId };
}

/** Validated payload for a HARPOON_JUMP message */
export interface HarpoonSlotPayload {
  slotId: number;
}

/**
 * Validates the payload for `HARPOON_JUMP` and `HARPOON_REMOVE` messages.
 *
 * @param payload     - Raw message payload
 * @param messageType - The message type string, used in error messages
 * @returns The validated payload with `slotId`
 * @throws If `slotId` is missing or not a number
 */
export function validateHarpoonSlotPayload(
  payload: unknown,
  messageType: string,
): HarpoonSlotPayload {
  const label = `${messageType} payload`;
  const obj = assertObject(payload, label);
  const slotId = assertNumber(obj, 'slotId', label);
  return { slotId };
}

// =============================================================================
// SEARCH RESULT VALIDATOR
// =============================================================================

/** The set of valid SearchResultType values */
const VALID_RESULT_TYPES = new Set<string>(['tab', 'history', 'bookmark']);

/**
 * Validates the payload for a `SELECT_RESULT` message.
 *
 * @param payload - Raw message payload
 * @returns A validated `SearchResult` object
 * @throws If required fields are missing or have incorrect types
 */
export function validateSearchResultPayload(payload: unknown): SearchResult {
  const label = 'SELECT_RESULT payload';
  const obj = assertObject(payload, label);

  const type = assertString(obj, 'type', label);
  if (!VALID_RESULT_TYPES.has(type)) {
    throw new Error(`${label}: "type" must be one of tab, history, bookmark — got "${type}"`);
  }

  const id = assertString(obj, 'id', label);
  const title = assertString(obj, 'title', label);
  const url = assertString(obj, 'url', label);

  const result: SearchResult = {
    type: type as SearchResultType,
    id,
    title,
    url,
  };

  // Optional fields
  if (obj['favicon'] !== undefined) {
    result.favicon = assertString(obj, 'favicon', label);
  }
  if (obj['windowId'] !== undefined) {
    result.windowId = assertNumber(obj, 'windowId', label);
  }
  if (obj['lastVisited'] !== undefined) {
    result.lastVisited = assertNumber(obj, 'lastVisited', label);
  }
  if (obj['harpoonSlot'] !== undefined) {
    result.harpoonSlot = assertNumber(obj, 'harpoonSlot', label);
  }

  return result;
}

// =============================================================================
// WORKSPACE PAYLOAD VALIDATORS
// =============================================================================

/** Validated payload for a WORKSPACE_SWITCH message */
export interface WorkspaceSwitchPayload {
  workspaceId: string | null;
}

/**
 * Validates the payload for a `WORKSPACE_SWITCH` message.
 *
 * @param payload - Raw message payload
 * @returns The validated payload with `workspaceId` (string or null)
 * @throws If `workspaceId` is missing or has an invalid type
 */
export function validateWorkspaceSwitchPayload(payload: unknown): WorkspaceSwitchPayload {
  const label = 'WORKSPACE_SWITCH payload';
  const obj = assertObject(payload, label);
  const workspaceId = obj['workspaceId'];

  if (workspaceId !== null && typeof workspaceId !== 'string') {
    throw new Error(`${label}: "workspaceId" must be a string or null, got ${typeof workspaceId}`);
  }

  return { workspaceId: workspaceId as string | null };
}

/** Validated payload for a WORKSPACE_CREATE message */
export interface WorkspaceCreatePayload {
  name: string;
}

/**
 * Validates the payload for a `WORKSPACE_CREATE` message.
 *
 * @param payload - Raw message payload
 * @returns The validated payload with `name`
 * @throws If `name` is missing or not a string
 */
export function validateWorkspaceCreatePayload(payload: unknown): WorkspaceCreatePayload {
  const label = 'WORKSPACE_CREATE payload';
  const obj = assertObject(payload, label);
  const name = assertString(obj, 'name', label);
  return { name };
}

/** Validated payload for a WORKSPACE_DELETE message */
export interface WorkspaceDeletePayload {
  workspaceId: string;
}

/**
 * Validates the payload for a `WORKSPACE_DELETE` message.
 *
 * @param payload - Raw message payload
 * @returns The validated payload with `workspaceId`
 * @throws If `workspaceId` is missing or not a string
 */
export function validateWorkspaceDeletePayload(payload: unknown): WorkspaceDeletePayload {
  const label = 'WORKSPACE_DELETE payload';
  const obj = assertObject(payload, label);
  const workspaceId = assertString(obj, 'workspaceId', label);
  return { workspaceId };
}
