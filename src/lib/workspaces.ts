/**
 * Workspaces - Tab Grouping Module
 * 
 * Provides Hyprland-style workspace functionality for organizing tabs.
 * Workspaces allow you to group related tabs and switch between contexts.
 * 
 * Key features:
 * - Create named workspaces for different contexts (work, personal, project)
 * - Assign tabs to workspaces
 * - Switch workspaces to show/hide groups of tabs
 * - Save and restore workspace layouts
 */

import type { Workspace, WorkspaceState } from './types';
import { get, update } from './storage';
import { getAllTabs, groupTabs, setGroupCollapsed, ungroupTabs } from './tabs';
import { createLogger } from './logger';

const log = createLogger('Workspaces');

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/**
 * Gets the current workspace state from storage
 */
export async function getWorkspaceState(): Promise<WorkspaceState> {
  return await get('workspaces');
}

/**
 * Generates a unique workspace ID
 */
function generateId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// =============================================================================
// WORKSPACE CRUD OPERATIONS
// =============================================================================

/**
 * Creates a new workspace
 * 
 * @param name - Name for the workspace
 * @param color - Optional color for visual distinction
 * @returns The created workspace
 */
export async function createWorkspace(
  name: string,
  color?: string
): Promise<Workspace> {
  const workspace: Workspace = {
    id: generateId(),
    name,
    tabUrls: [],
    tabIds: [],
    color,
    isDefault: false,
  };

  await update('workspaces', (state) => ({
    ...state,
    workspaces: [...state.workspaces, workspace],
  }));

  log.info(`Created workspace "${name}"`);
  return workspace;
}

/**
 * Renames a workspace
 * 
 * @param workspaceId - ID of workspace to rename
 * @param newName - New name for the workspace
 */
export async function renameWorkspace(
  workspaceId: string,
  newName: string
): Promise<void> {
  await update('workspaces', (state) => ({
    ...state,
    workspaces: state.workspaces.map((ws) =>
      ws.id === workspaceId ? { ...ws, name: newName } : ws
    ),
  }));

  log.info(`Renamed workspace to "${newName}"`);
}

/**
 * Deletes a workspace
 * Tabs in the workspace are moved to the default workspace
 * 
 * @param workspaceId - ID of workspace to delete
 */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await update('workspaces', (state) => {
    // Find default workspace
    const defaultWorkspace = state.workspaces.find((ws) => ws.isDefault);
    const workspaceToDelete = state.workspaces.find((ws) => ws.id === workspaceId);

    if (!workspaceToDelete) {
      return state;
    }

    // Don't allow deleting the default workspace
    if (workspaceToDelete.isDefault) {
      log.warn('Cannot delete the default workspace');
      return state;
    }

    // Move tabs to default workspace
    const updatedTabToWorkspace = { ...state.tabToWorkspace };
    for (const [tabId, wsId] of Object.entries(updatedTabToWorkspace)) {
      if (wsId === workspaceId && defaultWorkspace) {
        updatedTabToWorkspace[Number(tabId)] = defaultWorkspace.id;
      }
    }

    return {
      ...state,
      workspaces: state.workspaces.filter((ws) => ws.id !== workspaceId),
      tabToWorkspace: updatedTabToWorkspace,
      // If active workspace was deleted, switch to default
      activeWorkspaceId:
        state.activeWorkspaceId === workspaceId
          ? defaultWorkspace?.id ?? null
          : state.activeWorkspaceId,
    };
  });

  log.info(`Deleted workspace ${workspaceId}`);
}

/**
 * Gets a workspace by ID
 * 
 * @param workspaceId - ID of workspace to get
 * @returns The workspace, or undefined if not found
 */
export async function getWorkspace(
  workspaceId: string
): Promise<Workspace | undefined> {
  const state = await getWorkspaceState();
  return state.workspaces.find((ws) => ws.id === workspaceId);
}

// =============================================================================
// TAB ASSIGNMENT
// =============================================================================

/**
 * Assigns a tab to a workspace
 * 
 * @param tabId - Tab ID to assign
 * @param workspaceId - Workspace ID to assign to
 */
export async function assignTabToWorkspace(
  tabId: number,
  workspaceId: string
): Promise<void> {
  // Get the tab's URL for persistence
  let tabUrl = '';
  try {
    const tab = await chrome.tabs.get(tabId);
    tabUrl = tab.url || '';
  } catch {
    log.warn(`Tab ${tabId} no longer exists`);
    return;
  }

  await update('workspaces', (state) => {
    // Update the mapping
    const updatedTabToWorkspace = {
      ...state.tabToWorkspace,
      [tabId]: workspaceId,
    };

    // Update the workspace's tab lists
    const updatedWorkspaces = state.workspaces.map((ws) => {
      if (ws.id === workspaceId) {
        // Add to target workspace
        const newTabIds = ws.tabIds.includes(tabId)
          ? ws.tabIds
          : [...ws.tabIds, tabId];
        const newTabUrls = ws.tabUrls.includes(tabUrl)
          ? ws.tabUrls
          : [...ws.tabUrls, tabUrl];
        return { ...ws, tabIds: newTabIds, tabUrls: newTabUrls };
      }
      // Remove from other workspaces
      return {
        ...ws,
        tabIds: ws.tabIds.filter((id) => id !== tabId),
        tabUrls: ws.tabUrls.filter((url) => url !== tabUrl),
      };
    });

    return {
      ...state,
      workspaces: updatedWorkspaces,
      tabToWorkspace: updatedTabToWorkspace,
    };
  });

  log.info(`Assigned tab ${tabId} to workspace ${workspaceId}`);
}

/**
 * Removes a tab from its workspace
 * 
 * @param tabId - Tab ID to remove
 */
export async function removeTabFromWorkspace(tabId: number): Promise<void> {
  await update('workspaces', (state) => {
    const currentWorkspaceId = state.tabToWorkspace[tabId];
    if (!currentWorkspaceId) return state;

    const { [tabId]: _, ...remainingMappings } = state.tabToWorkspace;

    const updatedWorkspaces = state.workspaces.map((ws) => {
      if (ws.id === currentWorkspaceId) {
        return {
          ...ws,
          tabIds: ws.tabIds.filter((id) => id !== tabId),
        };
      }
      return ws;
    });

    return {
      ...state,
      workspaces: updatedWorkspaces,
      tabToWorkspace: remainingMappings,
    };
  });

  log.info(`Removed tab ${tabId} from workspace`);
}

// =============================================================================
// WORKSPACE SWITCHING
// =============================================================================

/**
 * Switches to a workspace, hiding tabs from other workspaces
 * 
 * @param workspaceId - Workspace ID to switch to (null for "all tabs" view)
 */
export async function switchWorkspace(workspaceId: string | null): Promise<void> {
  const state = await getWorkspaceState();
  const allTabs = await getAllTabs();

  if (workspaceId === null) {
    // "All tabs" view - show everything
    // Ungroup all tabs that we might have grouped
    const tabIdsToUngroup = allTabs
      .filter((tab) => tab.groupId !== undefined && tab.groupId !== -1 && tab.id !== undefined)
      .map((tab) => tab.id!);

    if (tabIdsToUngroup.length > 0) {
      try {
        await ungroupTabs(tabIdsToUngroup);
      } catch (error) {
        log.warn('Error ungrouping tabs:', error);
      }
    }

    await update('workspaces', (s) => ({ ...s, activeWorkspaceId: null }));
    log.info('Switched to all tabs view');
    return;
  }

  const targetWorkspace = state.workspaces.find((ws) => ws.id === workspaceId);
  if (!targetWorkspace) {
    log.warn(`Workspace ${workspaceId} not found`);
    return;
  }

  // Group tabs by workspace and collapse non-active ones
  for (const workspace of state.workspaces) {
    const workspaceTabs = allTabs.filter(
      (tab) => tab.id !== undefined && state.tabToWorkspace[tab.id] === workspace.id
    );

    if (workspaceTabs.length === 0) continue;

    const tabIds = workspaceTabs.map((t) => t.id!);

    try {
      // Check if tabs are already grouped
      const firstTab = workspaceTabs[0];
      if (firstTab?.groupId && firstTab.groupId !== -1) {
        // Already grouped, just update collapse state
        await setGroupCollapsed(
          firstTab.groupId,
          workspace.id !== workspaceId
        );
      } else {
        // Create new group
        type TabGroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange';
        const color = (workspace.color || 'blue') as TabGroupColor;
        const groupId = await groupTabs(tabIds, {
          title: workspace.name,
          color,
        });
        // Collapse if not the active workspace
        if (workspace.id !== workspaceId) {
          await setGroupCollapsed(groupId, true);
        }
      }
    } catch (error) {
      log.warn(`Error managing group for ${workspace.name}:`, error);
    }
  }

  // Update active workspace
  await update('workspaces', (s) => ({ ...s, activeWorkspaceId: workspaceId }));
  log.info(`Switched to workspace "${targetWorkspace.name}"`);
}

/**
 * Switches to the next workspace
 */
export async function switchToNextWorkspace(): Promise<void> {
  const state = await getWorkspaceState();
  const currentIndex = state.workspaces.findIndex(
    (ws) => ws.id === state.activeWorkspaceId
  );

  const nextIndex = (currentIndex + 1) % state.workspaces.length;
  const nextWorkspace = state.workspaces[nextIndex];

  if (nextWorkspace) {
    await switchWorkspace(nextWorkspace.id);
  }
}

/**
 * Switches to the previous workspace
 */
export async function switchToPrevWorkspace(): Promise<void> {
  const state = await getWorkspaceState();
  const currentIndex = state.workspaces.findIndex(
    (ws) => ws.id === state.activeWorkspaceId
  );

  const prevIndex =
    currentIndex <= 0 ? state.workspaces.length - 1 : currentIndex - 1;
  const prevWorkspace = state.workspaces[prevIndex];

  if (prevWorkspace) {
    await switchWorkspace(prevWorkspace.id);
  }
}

// =============================================================================
// WINDOW OPERATIONS
// =============================================================================

/**
 * Saves all tabs in the current window as a new workspace
 * 
 * @param name - Name for the new workspace
 * @returns The created workspace
 */
export async function saveWindowAsWorkspace(name: string): Promise<Workspace> {
  // Get current window's tabs
  const [currentWindow] = await chrome.windows.getAll({ populate: true });
  const tabs = currentWindow?.tabs || [];

  // Create workspace
  const workspace = await createWorkspace(name);

  // Assign all tabs to the workspace
  for (const tab of tabs) {
    if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
      await assignTabToWorkspace(tab.id, workspace.id);
    }
  }

  log.info(`Saved window as workspace "${name}" with ${tabs.length} tabs`);
  return workspace;
}

/**
 * Restores a workspace by opening all its saved URLs
 * 
 * @param workspaceId - Workspace ID to restore
 * @param inNewWindow - Whether to open in a new window
 */
export async function restoreWorkspace(
  workspaceId: string,
  inNewWindow = false
): Promise<void> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) {
    log.warn(`Workspace ${workspaceId} not found`);
    return;
  }

  if (workspace.tabUrls.length === 0) {
    log.info(`Workspace "${workspace.name}" has no saved URLs`);
    return;
  }

  if (inNewWindow) {
    // Create new window with all URLs
    await chrome.windows.create({
      url: workspace.tabUrls,
      focused: true,
    });
  } else {
    // Open URLs in current window
    for (const url of workspace.tabUrls) {
      await chrome.tabs.create({ url, active: false });
    }
  }

  log.info(`Restored workspace "${workspace.name}" with ${workspace.tabUrls.length} tabs`);
}

// =============================================================================
// CLEANUP & SYNC
// =============================================================================

/**
 * Syncs workspace state with current tabs
 * Removes references to closed tabs
 */
export async function syncWithTabs(): Promise<void> {
  const allTabs = await getAllTabs();
  const validTabIds = new Set(allTabs.map((t) => t.id).filter((id) => id !== undefined));

  await update('workspaces', (state) => {
    // Clean up tabToWorkspace mapping
    const cleanedMapping: Record<number, string> = {};
    for (const [tabIdStr, wsId] of Object.entries(state.tabToWorkspace)) {
      const tabId = Number(tabIdStr);
      if (validTabIds.has(tabId)) {
        cleanedMapping[tabId] = wsId;
      }
    }

    // Clean up workspace tabIds
    const cleanedWorkspaces = state.workspaces.map((ws) => ({
      ...ws,
      tabIds: ws.tabIds.filter((id) => validTabIds.has(id)),
    }));

    return {
      ...state,
      workspaces: cleanedWorkspaces,
      tabToWorkspace: cleanedMapping,
    };
  });

  log.info('Synced with current tabs');
}
