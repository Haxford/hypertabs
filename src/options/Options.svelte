<!--
  Options/Settings Page
  
  Allows users to configure HyperTabs settings including:
  - Vim mode toggle
  - Harpoon slot count
  - UI preferences
  - Import/export settings
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Settings } from '../lib/types';
  import { get, set, getAll, importData, DEFAULT_SETTINGS } from '../lib/storage';

  // ==========================================================================
  // STATE
  // ==========================================================================
  
  /** Current settings */
  let settings: Settings = { ...DEFAULT_SETTINGS };
  
  /** Whether settings have been modified */
  let isDirty = false;
  
  /** Status message to display */
  let statusMessage = '';
  
  /** Whether we're currently saving */
  let isSaving = false;

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  onMount(async () => {
    // Load current settings
    settings = await get('settings');
  });

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  /**
   * Marks settings as modified
   */
  function markDirty() {
    isDirty = true;
    statusMessage = '';
  }

  /**
   * Saves current settings
   */
  async function saveSettings() {
    isSaving = true;
    try {
      await set('settings', settings);
      isDirty = false;
      statusMessage = 'Settings saved!';
      setTimeout(() => statusMessage = '', 3000);
    } catch (error) {
      statusMessage = 'Error saving settings';
      console.error('Failed to save settings:', error);
    } finally {
      isSaving = false;
    }
  }

  /**
   * Resets settings to defaults
   */
  async function resetToDefaults() {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      settings = { ...DEFAULT_SETTINGS };
      await saveSettings();
    }
  }

  /**
   * Exports all extension data as JSON
   */
  async function exportData() {
    try {
      const data = await getAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `hypertabs-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      statusMessage = 'Data exported!';
      setTimeout(() => statusMessage = '', 3000);
    } catch (error) {
      statusMessage = 'Export failed';
      console.error('Export error:', error);
    }
  }

  /**
   * Imports data from a JSON file
   */
  async function handleImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (confirm('Import this data? Current settings will be overwritten.')) {
        await importData(data);
        settings = await get('settings');
        statusMessage = 'Data imported!';
        setTimeout(() => statusMessage = '', 3000);
      }
    } catch (error) {
      statusMessage = 'Import failed - invalid file';
      console.error('Import error:', error);
    }
    
    // Reset the input
    input.value = '';
  }
</script>

<div class="options-page">
  <header>
    <h1>HyperTabs Settings</h1>
    <p class="subtitle">Configure your tab management experience</p>
  </header>

  <main>
    <!-- Keybinds Section -->
    <section class="settings-section">
      <h2>Keybinds</h2>
      
      <label class="setting-row toggle">
        <span class="setting-label">
          <span class="label-text">Vim Mode</span>
          <span class="label-hint">Use j/k for navigation in search results</span>
        </span>
        <input
          type="checkbox"
          bind:checked={settings.vimModeEnabled}
          on:change={markDirty}
        />
      </label>
      
      <div class="keybind-info">
        <p class="info-text">
          Shortcuts are set in Chrome's extension settings. Click below to configure:
        </p>
        <button class="btn primary open-shortcuts-btn" on:click={() => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}>
          Open Chrome Shortcuts Settings
        </button>
        
        <div class="shortcut-config">
          <h3>Recommended Shortcuts</h3>
          <p class="info-text">Copy these values into Chrome's shortcut settings:</p>
          
          <div class="shortcut-grid">
            <div class="shortcut-item">
              <label for="shortcut-open">Open HyperTabs</label>
              <input id="shortcut-open" type="text" readonly value="Ctrl+Shift+K" placeholder="Ctrl+Shift+K" class="shortcut-input has-default" />
              <span class="shortcut-status default">default</span>
            </div>
            
            <div class="shortcut-item">
              <label for="shortcut-harpoon1">Harpoon slot 1</label>
              <input id="shortcut-harpoon1" type="text" readonly value="Alt+1" placeholder="Alt+1" class="shortcut-input has-default" />
              <span class="shortcut-status default">default</span>
            </div>
            
            <div class="shortcut-item">
              <label for="shortcut-harpoon2">Harpoon slot 2</label>
              <input id="shortcut-harpoon2" type="text" readonly value="Alt+2" placeholder="Alt+2" class="shortcut-input has-default" />
              <span class="shortcut-status default">default</span>
            </div>
            
            <div class="shortcut-item">
              <label for="shortcut-harpoon3">Harpoon slot 3</label>
              <input id="shortcut-harpoon3" type="text" readonly placeholder="Alt+3" class="shortcut-input" />
              <span class="shortcut-status">not set</span>
            </div>
            
            <div class="shortcut-item">
              <label for="shortcut-harpoon4">Harpoon slot 4</label>
              <input id="shortcut-harpoon4" type="text" readonly placeholder="Alt+4" class="shortcut-input" />
              <span class="shortcut-status">not set</span>
            </div>
            
            <div class="shortcut-item">
              <label for="shortcut-mark">Mark to Harpoon</label>
              <input id="shortcut-mark" type="text" readonly placeholder="Ctrl+Shift+M" class="shortcut-input" />
              <span class="shortcut-status">not set</span>
            </div>
            
            <div class="shortcut-item">
              <label for="shortcut-ws-next">Next workspace</label>
              <input id="shortcut-ws-next" type="text" readonly placeholder="Ctrl+Shift+]" class="shortcut-input" />
              <span class="shortcut-status">not set</span>
            </div>
            
            <div class="shortcut-item">
              <label for="shortcut-ws-prev">Prev workspace</label>
              <input id="shortcut-ws-prev" type="text" readonly placeholder="Ctrl+Shift+[" class="shortcut-input" />
              <span class="shortcut-status">not set</span>
            </div>
          </div>
          
          <p class="info-text shortcut-note">
            Chrome limits extensions to 4 default shortcuts. The placeholders show our recommended keys - 
            copy them into Chrome's settings to enable.
          </p>
        </div>
        
        <div class="suggested-keybinds" style="margin-top: 20px;">
          <h3>In-Popup Navigation</h3>
          <table class="keybind-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Key</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Move down</td>
                <td><kbd>↓</kbd> {settings.vimModeEnabled ? 'or' : ''} {settings.vimModeEnabled ? '<kbd>j</kbd>' : ''}</td>
              </tr>
              <tr>
                <td>Move up</td>
                <td><kbd>↑</kbd> {settings.vimModeEnabled ? 'or' : ''} {settings.vimModeEnabled ? '<kbd>k</kbd>' : ''}</td>
              </tr>
              <tr>
                <td>Select/switch</td>
                <td><kbd>Enter</kbd></td>
              </tr>
              <tr>
                <td>Close popup</td>
                <td><kbd>Esc</kbd></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Harpoon Section -->
    <section class="settings-section">
      <h2>Harpoon (Quick Access)</h2>
      
      <label class="setting-row">
        <span class="setting-label">
          <span class="label-text">Number of Slots</span>
          <span class="label-hint">How many quick-access slots to show (1-10)</span>
        </span>
        <input
          type="number"
          min="1"
          max="10"
          bind:value={settings.harpoonMaxSlots}
          on:change={markDirty}
        />
      </label>
      
      <label class="setting-row toggle">
        <span class="setting-label">
          <span class="label-text">Reopen Closed Tabs</span>
          <span class="label-hint">Automatically reopen tabs that were closed</span>
        </span>
        <input
          type="checkbox"
          bind:checked={settings.harpoonReopenClosed}
          on:change={markDirty}
        />
      </label>
    </section>

    <!-- Telescope Section -->
    <section class="settings-section">
      <h2>Telescope (Search)</h2>
      
      <label class="setting-row toggle">
        <span class="setting-label">
          <span class="label-text">Show URLs</span>
          <span class="label-hint">Display URLs below tab titles in search results</span>
        </span>
        <input
          type="checkbox"
          bind:checked={settings.telescopeShowUrls}
          on:change={markDirty}
        />
      </label>
      
      <label class="setting-row">
        <span class="setting-label">
          <span class="label-text">Max Results</span>
          <span class="label-hint">Maximum number of search results to show</span>
        </span>
        <input
          type="number"
          min="10"
          max="100"
          bind:value={settings.telescopeMaxResults}
          on:change={markDirty}
        />
      </label>
    </section>

    <!-- Appearance Section -->
    <section class="settings-section">
      <h2>Appearance</h2>
      
      <label class="setting-row">
        <span class="setting-label">
          <span class="label-text">Theme</span>
          <span class="label-hint">Color scheme preference</span>
        </span>
        <select bind:value={settings.theme} on:change={markDirty}>
          <option value="system">System</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </label>
    </section>

    <!-- Data Section -->
    <section class="settings-section">
      <h2>Data Management</h2>
      
      <div class="button-row">
        <button class="btn secondary" on:click={exportData}>
          Export Data
        </button>
        
        <label class="btn secondary file-input">
          Import Data
          <input type="file" accept=".json" on:change={handleImport} hidden />
        </label>
        
        <button class="btn danger" on:click={resetToDefaults}>
          Reset to Defaults
        </button>
      </div>
    </section>
  </main>

  <!-- Footer with save button -->
  <footer>
    {#if statusMessage}
      <span class="status-message">{statusMessage}</span>
    {/if}
    
    <button
      class="btn primary"
      disabled={!isDirty || isSaving}
      on:click={saveSettings}
    >
      {isSaving ? 'Saving...' : 'Save Settings'}
    </button>
  </footer>
</div>

<style>
  .options-page {
    display: flex;
    flex-direction: column;
    gap: 30px;
  }

  header {
    text-align: center;
    margin-bottom: 10px;
  }

  header h1 {
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .subtitle {
    color: #888;
    font-size: 14px;
  }

  /* Sections */
  .settings-section {
    background-color: #1e1e3f;
    border-radius: 8px;
    padding: 20px;
  }

  .settings-section h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid #2a2a4a;
  }

  /* Setting rows */
  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #2a2a4a;
  }

  .setting-row:last-child {
    border-bottom: none;
  }

  .setting-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .label-text {
    font-weight: 500;
  }

  .label-hint {
    font-size: 12px;
    color: #888;
  }

  /* Inputs */
  input[type="number"],
  select {
    background-color: #16162a;
    border: 1px solid #3a3a5a;
    border-radius: 4px;
    padding: 8px 12px;
    color: #eee;
    font-size: 14px;
    min-width: 80px;
  }

  input[type="number"]:focus,
  select:focus {
    outline: none;
    border-color: #6366f1;
  }

  input[type="checkbox"] {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }

  /* Info text */
  .info-text {
    margin-top: 12px;
    font-size: 12px;
    color: #888;
  }

  /* Keybind info section */
  .keybind-info {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #2a2a4a;
  }

  .suggested-keybinds {
    margin-top: 16px;
  }

  .suggested-keybinds h3 {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 8px;
    color: #ccc;
  }

  .keybind-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 12px;
    font-size: 13px;
  }

  .keybind-table th,
  .keybind-table td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid #2a2a4a;
  }

  .keybind-table th {
    color: #888;
    font-weight: 500;
    font-size: 11px;
    text-transform: uppercase;
  }

  .keybind-table td:last-child {
    text-align: right;
  }

  kbd {
    background-color: #16162a;
    border: 1px solid #3a3a5a;
    border-radius: 4px;
    padding: 2px 8px;
    font-family: monospace;
    font-size: 12px;
    color: #eee;
  }

  /* Shortcut config section */
  .open-shortcuts-btn {
    margin-top: 12px;
    margin-bottom: 20px;
  }

  .shortcut-config {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #2a2a4a;
  }

  .shortcut-config h3 {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 8px;
    color: #ccc;
  }

  .shortcut-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 16px;
  }

  .shortcut-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .shortcut-item label {
    font-size: 12px;
    color: #888;
  }

  .shortcut-input {
    background-color: #16162a;
    border: 1px solid #3a3a5a;
    border-radius: 4px;
    padding: 8px 12px;
    color: #888;
    font-size: 13px;
    font-family: monospace;
    width: 100%;
  }

  .shortcut-input::placeholder {
    color: #555;
    font-style: italic;
  }

  .shortcut-input.has-default {
    color: #eee;
    border-color: #4a4a6a;
  }

  .shortcut-status {
    font-size: 10px;
    color: #666;
  }

  .shortcut-status.default {
    color: #22c55e;
  }

  .shortcut-note {
    margin-top: 16px;
    padding: 12px;
    background-color: #16162a;
    border-radius: 6px;
    border-left: 3px solid #6366f1;
  }

  /* Buttons */
  .button-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .btn {
    padding: 10px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.15s ease;
  }

  .btn.primary {
    background-color: #6366f1;
    color: white;
  }

  .btn.primary:hover:not(:disabled) {
    background-color: #5558e3;
  }

  .btn.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn.secondary {
    background-color: #2a2a4a;
    color: #eee;
  }

  .btn.secondary:hover {
    background-color: #3a3a5a;
  }

  .btn.danger {
    background-color: #dc2626;
    color: white;
  }

  .btn.danger:hover {
    background-color: #b91c1c;
  }

  .file-input {
    display: inline-block;
  }

  /* Footer */
  footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 16px;
    padding-top: 20px;
    border-top: 1px solid #2a2a4a;
  }

  .status-message {
    font-size: 14px;
    color: #4ade80;
  }
</style>
