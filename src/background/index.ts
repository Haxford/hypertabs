/**
 * Background Service Worker
 * 
 * This is the main background script for the HyperTabs extension.
 * It handles:
 * - Keyboard command listeners
 * - Context menu creation and handling
 * - Message passing between popup and background
 * - Tab event listeners for state synchronization
 */

import {
  markToSlot,
  markToNextAvailable,
  jumpToSlot,
  removeFromSlot,
  getHarpoonState,
  syncWithTabs as syncHarpoonWithTabs,
} from '../lib/harpoon';
import {
  createWorkspace,
  deleteWorkspace,
  switchWorkspace,
  switchToNextWorkspace,
  switchToPrevWorkspace,
  syncWithTabs as syncWorkspacesWithTabs,
} from '../lib/workspaces';
import { switchToTab, createTab } from '../lib/tabs';
import type { SearchResult } from '../lib/types';
import { createLogger } from '../lib/logger';

const log = createLogger('Background');

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the extension when installed or updated
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  log.info('Extension installed/updated', details.reason);
  
  // Create context menus
  await createContextMenus();
  
  // Sync state with current tabs
  await syncHarpoonWithTabs();
  await syncWorkspacesWithTabs();
});

/**
 * Initialize on browser startup
 */
chrome.runtime.onStartup.addListener(async () => {
  log.info('Browser started');
  
  // Sync state with current tabs
  await syncHarpoonWithTabs();
  await syncWorkspacesWithTabs();
});

// =============================================================================
// CONTEXT MENUS
// =============================================================================

/**
 * Creates the context menu items for the extension
 */
async function createContextMenus(): Promise<void> {
  // Remove any existing menus first
  await chrome.contextMenus.removeAll();
  
  // Parent menu item
  chrome.contextMenus.create({
    id: 'hypertabs-parent',
    title: 'HyperTabs',
    contexts: ['page', 'action'] as const,
  });
  
  // Add to Harpoon submenu
  chrome.contextMenus.create({
    id: 'harpoon-add',
    parentId: 'hypertabs-parent',
    title: 'Add to Harpoon',
    contexts: ['page', 'action'] as const,
  });
  
  // Create slot options (1-5 by default)
  const state = await getHarpoonState();
  for (let i = 1; i <= state.maxSlots; i++) {
    const slot = state.slots[i - 1];
    const title = slot 
      ? `Slot ${i}: ${slot.title.substring(0, 20)}${slot.title.length > 20 ? '...' : ''}`
      : `Slot ${i}: (empty)`;
    
    chrome.contextMenus.create({
      id: `harpoon-slot-${i}`,
      parentId: 'harpoon-add',
      title,
      contexts: ['page', 'action'] as const,
    });
  }
  
  // Separator
  chrome.contextMenus.create({
    id: 'separator-1',
    parentId: 'hypertabs-parent',
    type: 'separator',
    contexts: ['page', 'action'] as const,
  });
  
  // Remove from Harpoon option
  chrome.contextMenus.create({
    id: 'harpoon-remove',
    parentId: 'hypertabs-parent',
    title: 'Remove from Harpoon',
    contexts: ['page', 'action'] as const,
  });
}

/**
 * Updates context menu items to reflect current harpoon state
 */
async function updateContextMenus(): Promise<void> {
  const state = await getHarpoonState();
  
  for (let i = 1; i <= state.maxSlots; i++) {
    const slot = state.slots[i - 1];
    const title = slot 
      ? `Slot ${i}: ${slot.title.substring(0, 20)}${slot.title.length > 20 ? '...' : ''}`
      : `Slot ${i}: (empty)`;
    
    try {
      await chrome.contextMenus.update(`harpoon-slot-${i}`, { title });
    } catch {
      // Menu item might not exist yet
    }
  }
}

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuId = info.menuItemId as string;
  
  // Handle slot selection
  if (menuId.startsWith('harpoon-slot-')) {
    const slotId = parseInt(menuId.replace('harpoon-slot-', ''), 10);
    if (tab?.id) {
      await markToSlot(slotId, tab.id);
      await updateContextMenus();
    }
    return;
  }
  
  // Handle remove from harpoon
  if (menuId === 'harpoon-remove') {
    if (tab?.url) {
      const state = await getHarpoonState();
      // Find and remove the slot with this URL
      for (let i = 0; i < state.slots.length; i++) {
        if (state.slots[i]?.url === tab.url) {
          await removeFromSlot(i + 1);
          await updateContextMenus();
          break;
        }
      }
    }
  }
});

// =============================================================================
// KEYBOARD COMMANDS
// =============================================================================

/**
 * Handle keyboard commands defined in manifest.json
 */
chrome.commands.onCommand.addListener(async (command) => {
  log.debug('Command received:', command);
  
  switch (command) {
    case 'harpoon-mark':
      // Mark current tab to next available slot
      // For now, we'll show a simple prompt by opening popup
      // In the future, this could show an overlay to select slot
      const slot = await markToSlot(1); // Default to slot 1
      if (slot) {
        await updateContextMenus();
      }
      break;
      
    case 'harpoon-1':
      await jumpToSlot(1);
      break;
      
    case 'harpoon-2':
      await jumpToSlot(2);
      break;
      
    case 'harpoon-3':
      await jumpToSlot(3);
      break;
      
    case 'harpoon-4':
      await jumpToSlot(4);
      break;
      
    case 'workspace-next':
      await switchToNextWorkspace();
      break;
      
    case 'workspace-prev':
      await switchToPrevWorkspace();
      break;
  }
});

// =============================================================================
// MESSAGE HANDLING
// =============================================================================

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle async operations
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      log.error('Message handling error:', error);
      sendResponse({ error: error.message });
    });
  
  // Return true to indicate we'll send a response asynchronously
  return true;
});

/**
 * Process incoming messages
 */
async function handleMessage(
  message: { type: string; payload?: unknown },
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  log.debug('Received message:', message.type);
  
  switch (message.type) {
    // =========================================================================
    // HARPOON MESSAGES
    // =========================================================================
    
    case 'HARPOON_GET_STATE':
      return await getHarpoonState();
    
    case 'HARPOON_MARK': {
      const { slotId, tabId } = message.payload as { slotId: number; tabId?: number };
      const slot = await markToSlot(slotId, tabId);
      await updateContextMenus();
      return slot;
    }
    
    case 'HARPOON_JUMP': {
      const { slotId } = message.payload as { slotId: number };
      return await jumpToSlot(slotId);
    }
    
    case 'HARPOON_REMOVE': {
      const { slotId } = message.payload as { slotId: number };
      await removeFromSlot(slotId);
      await updateContextMenus();
      return true;
    }
    
    // =========================================================================
    // SEARCH RESULT SELECTION
    // =========================================================================
    
    case 'SELECT_RESULT': {
      const result = message.payload as SearchResult;
      
      switch (result.type) {
        case 'tab':
          // Switch to existing tab
          await switchToTab(parseInt(result.id, 10), result.windowId);
          break;
          
        case 'history':
        case 'bookmark':
          // Open in new tab
          await createTab(result.url);
          break;
      }
      
      return true;
    }
    
    // =========================================================================
    // WORKSPACE MESSAGES
    // =========================================================================
    
    case 'WORKSPACE_SWITCH': {
      const { workspaceId } = message.payload as { workspaceId: string | null };
      await switchWorkspace(workspaceId);
      return true;
    }
    
    case 'WORKSPACE_CREATE': {
      const { name } = message.payload as { name: string };
      return await createWorkspace(name);
    }
    
    case 'WORKSPACE_DELETE': {
      const { workspaceId } = message.payload as { workspaceId: string };
      await deleteWorkspace(workspaceId);
      return true;
    }
    
    // =========================================================================
    // DEFAULT
    // =========================================================================
    
    default:
      log.warn('Unknown message type:', message.type);
      return null;
  }
}

// =============================================================================
// TAB EVENT LISTENERS
// =============================================================================

/**
 * Listen for tab updates to keep harpoon state in sync
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only care about URL changes (navigation)
  if (changeInfo.url) {
    // Sync might be needed if URLs changed
    // For now, we don't auto-update harpoon URLs
    // Users explicitly mark tabs
  }
});

/**
 * Listen for tab removal
 * Note: We don't automatically remove from harpoon when tab is closed
 * because the URL is saved for reopening
 */
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  // Tab removed - harpoon keeps the URL for reopening
});

// =============================================================================
// STORAGE CHANGE LISTENER
// =============================================================================

/**
 * Listen for storage changes to update context menus
 */
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.harpoon) {
    await updateContextMenus();
  }
});

// Log that the service worker is running
log.info('Background service worker started');
