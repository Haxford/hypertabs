/**
 * Chrome Tabs API Wrapper
 * 
 * Provides a clean, typed interface for interacting with Chrome's tabs API.
 * Abstracts away some of the complexity and handles common edge cases.
 */

import type { SearchResult } from './types';

// =============================================================================
// TAB QUERIES
// =============================================================================

/**
 * Gets the currently active tab in the current window
 * 
 * @returns The active tab, or undefined if none found
 */
export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * Gets all tabs across all windows
 * 
 * @returns Array of all open tabs
 */
export async function getAllTabs(): Promise<chrome.tabs.Tab[]> {
  return await chrome.tabs.query({});
}

/**
 * Gets all tabs in a specific window
 * 
 * @param windowId - The window ID to query
 * @returns Array of tabs in the specified window
 */
export async function getTabsInWindow(windowId: number): Promise<chrome.tabs.Tab[]> {
  return await chrome.tabs.query({ windowId });
}

/**
 * Gets a specific tab by ID
 * 
 * @param tabId - The tab ID to retrieve
 * @returns The tab, or undefined if not found (tab was closed)
 */
export async function getTabById(tabId: number): Promise<chrome.tabs.Tab | undefined> {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    // Tab no longer exists
    return undefined;
  }
}

/**
 * Finds a tab by URL across all windows
 * 
 * @param url - The URL to search for
 * @returns The first matching tab, or undefined
 */
export async function findTabByUrl(url: string): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ url });
  return tabs[0];
}

// =============================================================================
// TAB ACTIONS
// =============================================================================

/**
 * Switches to (focuses) a specific tab
 * Also focuses the window containing the tab
 * 
 * @param tabId - The tab ID to switch to
 * @param windowId - Optional window ID (will be fetched if not provided)
 */
export async function switchToTab(tabId: number, windowId?: number): Promise<void> {
  // Activate the tab
  await chrome.tabs.update(tabId, { active: true });

  // Focus the window containing the tab
  if (windowId) {
    await chrome.windows.update(windowId, { focused: true });
  } else {
    // Get the tab to find its window
    const tab = await getTabById(tabId);
    if (tab?.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
  }
}

/**
 * Creates a new tab with the specified URL
 * 
 * @param url - The URL to open
 * @param options - Additional tab creation options
 * @returns The newly created tab
 */
export async function createTab(
  url: string,
  options: { active?: boolean; windowId?: number } = {}
): Promise<chrome.tabs.Tab> {
  return await chrome.tabs.create({
    url,
    active: options.active ?? true,
    windowId: options.windowId,
  });
}

/**
 * Closes a tab by ID
 * 
 * @param tabId - The tab ID to close
 */
export async function closeTab(tabId: number): Promise<void> {
  try {
    await chrome.tabs.remove(tabId);
  } catch {
    // Tab may already be closed, ignore error
  }
}

/**
 * Moves a tab to a different position or window
 * 
 * @param tabId - The tab ID to move
 * @param options - Move options (index and/or windowId)
 */
export async function moveTab(
  tabId: number,
  options: { index?: number; windowId?: number }
): Promise<void> {
  await chrome.tabs.move(tabId, {
    index: options.index ?? -1, // -1 means end of window
    windowId: options.windowId,
  });
}

// =============================================================================
// TAB GROUPS (for workspace functionality)
// =============================================================================

/**
 * Tab group color options
 */
type TabGroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange';

/**
 * Groups tabs together
 * 
 * @param tabIds - Array of tab IDs to group
 * @param options - Group options (title, color, windowId)
 * @returns The created group ID
 */
export async function groupTabs(
  tabIds: number[],
  options: { title?: string; color?: TabGroupColor; windowId?: number } = {}
): Promise<number> {
  // Ensure we have at least one tab to group
  if (tabIds.length === 0) {
    throw new Error('Cannot create group with no tabs');
  }

  const groupId = await chrome.tabs.group({
    tabIds: tabIds as [number, ...number[]],
    createProperties: options.windowId ? { windowId: options.windowId } : undefined,
  });

  // Update group properties if provided
  if (options.title || options.color) {
    await chrome.tabGroups.update(groupId, {
      title: options.title,
      color: options.color,
    });
  }

  return groupId;
}

/**
 * Collapses or expands a tab group
 * 
 * @param groupId - The group ID
 * @param collapsed - Whether to collapse (true) or expand (false)
 */
export async function setGroupCollapsed(groupId: number, collapsed: boolean): Promise<void> {
  await chrome.tabGroups.update(groupId, { collapsed });
}

/**
 * Ungroups tabs (removes them from their group)
 * 
 * @param tabIds - Array of tab IDs to ungroup
 */
export async function ungroupTabs(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) return;
  await chrome.tabs.ungroup(tabIds as [number, ...number[]]);
}

// =============================================================================
// CONVERSION UTILITIES
// =============================================================================

/**
 * Converts a Chrome tab to a SearchResult for display
 * 
 * @param tab - The Chrome tab object
 * @param harpoonSlot - Optional harpoon slot number if harpooned
 * @returns SearchResult object
 */
export function tabToSearchResult(
  tab: chrome.tabs.Tab,
  harpoonSlot?: number
): SearchResult {
  return {
    type: 'tab',
    id: String(tab.id),
    title: tab.title || 'Untitled',
    url: tab.url || '',
    favicon: tab.favIconUrl,
    windowId: tab.windowId,
    harpoonSlot,
  };
}

/**
 * Gets the favicon URL for a given page URL
 * Uses Chrome's favicon service
 * 
 * @param url - The page URL
 * @returns Favicon URL
 */
export function getFaviconUrl(url: string): string {
  try {
    // Validate that the URL is parseable before using it
    new URL(url);
    // Use Chrome's built-in favicon service
    return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=16`;
  } catch {
    // Invalid URL, return empty
    return '';
  }
}
