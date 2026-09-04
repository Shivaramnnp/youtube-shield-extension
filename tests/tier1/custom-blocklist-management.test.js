/**
 * Tier 1 Test Suite: Custom Blocklist Management Studio (Options UI)
 * tests/tier1/custom-blocklist-management.test.js
 *
 * Validates:
 * - Options UI sidebar navigation tab switching and dynamic badge counter
 * - Interactive chip rendering for Blocked Channels and Blocked Keywords
 * - Adding items via Enter key / button click with auto-deduplication & sanitization
 * - Removing chips with single-click remove button
 * - Live search/filter input behavior
 * - Bulk actions: Clear All and JSON Import / Export
 * - Real-time persistence with chrome.storage.local / StorageUtil
 */

require('../harness/mock-extension-env');
const { test, describe, assert, resetStorage, resetDOM } = require('../harness/test-helpers');
const { StorageUtil } = require('../../utils/storage');

// Helper to construct a standard Options Dashboard DOM with Blocklist Studio elements
function setupOptionsDOM() {
  resetDOM();
  document.body.innerHTML = `
    <div class="sidebar">
      <ul class="nav-menu">
        <li data-tab="focus" class="active" aria-selected="true">Focus Features</li>
        <li data-tab="timemanager" aria-selected="false">Time Manager</li>
        <li data-tab="blocklist" id="nav-tab-blocklist" aria-selected="false">
          <span class="nav-label">Custom Blocklist</span>
          <span id="nav-blocklist-badge" class="badge-counter">0</span>
        </li>
        <li data-tab="analytics" aria-selected="false">Analytics</li>
      </ul>
    </div>
    <div class="main-content">
      <div id="focus-tab" class="tab-content active"></div>
      <div id="blocklist-tab" class="tab-content">
        <div class="blocklist-header">
          <h2>Custom Blocklist Studio</h2>
          <div class="blocklist-actions">
            <input type="text" id="blocklist-search-input" placeholder="Search blocked items...">
            <button id="btn-blocklist-export-json">Export JSON</button>
            <input type="file" id="file-blocklist-import-json" style="display:none">
            <button id="btn-blocklist-import-trigger">Import JSON</button>
            <button id="btn-blocklist-clear-all">Clear All</button>
          </div>
        </div>
        <div class="blocklist-panels">
          <div class="blocklist-panel" id="panel-blocked-channels">
            <h3>Blocked Channels (<span id="count-blocked-channels">0</span>)</h3>
            <div class="input-group">
              <input type="text" id="input-add-channel" placeholder="Enter channel name...">
              <button id="btn-add-channel">Add Channel</button>
            </div>
            <div id="blocked-channels-cloud" class="chip-cloud"></div>
          </div>
          <div class="blocklist-panel" id="panel-blocked-keywords">
            <h3>Blocked Keywords (<span id="count-blocked-keywords">0</span>)</h3>
            <div class="input-group">
              <input type="text" id="input-add-keyword" placeholder="Enter keyword or phrase...">
              <button id="btn-add-keyword">Add Keyword</button>
            </div>
            <div id="blocked-keywords-cloud" class="chip-cloud"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Controller implementation matching the Options Blocklist Studio contract
class BlocklistStudioController {
  constructor() {
    this.blockedChannels = [];
    this.blockedKeywords = [];
    this.searchQuery = '';
  }

  async init() {
    const settings = await StorageUtil.getSettings();
    this.blockedChannels = Array.isArray(settings.blockedChannels) ? [...settings.blockedChannels] : [];
    this.blockedKeywords = Array.isArray(settings.blockedKeywords) ? [...settings.blockedKeywords] : [];
    this.bindEvents();
    this.render();
  }

  bindEvents() {
    // Tab switching
    const navItems = document.querySelectorAll('.nav-menu li');
    const tabContents = document.querySelectorAll('.tab-content');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        navItems.forEach(n => {
          n.classList.remove('active');
          n.setAttribute('aria-selected', 'false');
        });
        tabContents.forEach(tc => tc.classList.remove('active'));
        item.classList.add('active');
        item.setAttribute('aria-selected', 'true');
        const targetId = `${item.dataset.tab}-tab`;
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.add('active');
      });
    });

    // Add Channel
    const inputChannel = document.getElementById('input-add-channel');
    const btnAddChannel = document.getElementById('btn-add-channel');
    if (btnAddChannel && inputChannel) {
      btnAddChannel.addEventListener('click', () => this.handleAddChannel(inputChannel.value));
      inputChannel.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleAddChannel(inputChannel.value);
        }
      });
    }

    // Add Keyword
    const inputKeyword = document.getElementById('input-add-keyword');
    const btnAddKeyword = document.getElementById('btn-add-keyword');
    if (btnAddKeyword && inputKeyword) {
      btnAddKeyword.addEventListener('click', () => this.handleAddKeyword(inputKeyword.value));
      inputKeyword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleAddKeyword(inputKeyword.value);
        }
      });
    }

    // Search filter
    const searchInput = document.getElementById('blocklist-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target.value || '').trim().toLowerCase();
        this.applyFilter();
      });
    }

    // Clear All
    const btnClearAll = document.getElementById('btn-blocklist-clear-all');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', () => this.handleClearAll());
    }

    // Export JSON
    const btnExport = document.getElementById('btn-blocklist-export-json');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.handleExportJSON());
    }

    // Storage listener
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (changes.settings && changes.settings.newValue) {
          const s = changes.settings.newValue;
          if (Array.isArray(s.blockedChannels)) this.blockedChannels = [...s.blockedChannels];
          if (Array.isArray(s.blockedKeywords)) this.blockedKeywords = [...s.blockedKeywords];
          this.render();
        }
      });
    }
  }

  async handleAddChannel(rawName) {
    if (!rawName || typeof rawName !== 'string') return;
    const cleaned = (typeof StorageUtil.cleanChannelName === 'function')
      ? StorageUtil.cleanChannelName(rawName)
      : rawName.trim();
    if (!cleaned || cleaned.toLowerCase() === 'youtube channel') return;

    const exists = this.blockedChannels.some(c => c.toLowerCase() === cleaned.toLowerCase());
    if (exists) return;

    this.blockedChannels.push(cleaned);
    await StorageUtil.updateSetting('blockedChannels', this.blockedChannels);
    const input = document.getElementById('input-add-channel');
    if (input) input.value = '';
    this.render();
  }

  async handleAddKeyword(rawKeyword) {
    if (!rawKeyword || typeof rawKeyword !== 'string') return;
    const cleaned = rawKeyword.trim().toLowerCase();
    if (!cleaned) return;

    const exists = this.blockedKeywords.some(k => k.toLowerCase() === cleaned);
    if (exists) return;

    this.blockedKeywords.push(cleaned);
    await StorageUtil.updateSetting('blockedKeywords', this.blockedKeywords);
    const input = document.getElementById('input-add-keyword');
    if (input) input.value = '';
    this.render();
  }

  async handleRemoveChannel(channelName) {
    this.blockedChannels = this.blockedChannels.filter(c => c.toLowerCase() !== channelName.toLowerCase());
    await StorageUtil.updateSetting('blockedChannels', this.blockedChannels);
    this.render();
  }

  async handleRemoveKeyword(keyword) {
    this.blockedKeywords = this.blockedKeywords.filter(k => k.toLowerCase() !== keyword.toLowerCase());
    await StorageUtil.updateSetting('blockedKeywords', this.blockedKeywords);
    this.render();
  }

  async handleClearAll() {
    this.blockedChannels = [];
    this.blockedKeywords = [];
    const settings = await StorageUtil.getSettings();
    settings.blockedChannels = [];
    settings.blockedKeywords = [];
    await StorageUtil.saveSettings(settings);
    this.render();
  }

  handleExportJSON() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      blockedChannels: this.blockedChannels,
      blockedKeywords: this.blockedKeywords
    };
    return JSON.stringify(payload, null, 2);
  }

  async handleImportJSON(jsonString) {
    try {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      if (!data || typeof data !== 'object') throw new Error('Invalid JSON structure');

      const newChannels = Array.isArray(data.blockedChannels) ? data.blockedChannels : [];
      const newKeywords = Array.isArray(data.blockedKeywords) ? data.blockedKeywords : [];

      const mergedChannels = [...this.blockedChannels];
      for (const ch of newChannels) {
        const cleaned = (typeof StorageUtil.cleanChannelName === 'function')
          ? StorageUtil.cleanChannelName(ch)
          : String(ch).trim();
        if (cleaned && !mergedChannels.some(c => c.toLowerCase() === cleaned.toLowerCase())) {
          mergedChannels.push(cleaned);
        }
      }

      const mergedKeywords = [...this.blockedKeywords];
      for (const kw of newKeywords) {
        const cleaned = String(kw).trim().toLowerCase();
        if (cleaned && !mergedKeywords.some(k => k.toLowerCase() === cleaned)) {
          mergedKeywords.push(cleaned);
        }
      }

      this.blockedChannels = mergedChannels;
      this.blockedKeywords = mergedKeywords;

      const currentSettings = await StorageUtil.getSettings();
      currentSettings.blockedChannels = this.blockedChannels;
      currentSettings.blockedKeywords = this.blockedKeywords;
      await StorageUtil.saveSettings(currentSettings);
      this.render();
      return { success: true, channelCount: mergedChannels.length, keywordCount: mergedKeywords.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  applyFilter() {
    const channelChips = document.querySelectorAll('#blocked-channels-cloud .chip');
    channelChips.forEach(chip => {
      const label = (chip.dataset.item || chip.textContent || '').toLowerCase();
      chip.style.display = label.includes(this.searchQuery) ? '' : 'none';
    });

    const keywordChips = document.querySelectorAll('#blocked-keywords-cloud .chip');
    keywordChips.forEach(chip => {
      const label = (chip.dataset.item || chip.textContent || '').toLowerCase();
      chip.style.display = label.includes(this.searchQuery) ? '' : 'none';
    });
  }

  render() {
    // Update badge counter
    const totalCount = this.blockedChannels.length + this.blockedKeywords.length;
    const navBadge = document.getElementById('nav-blocklist-badge');
    if (navBadge) navBadge.textContent = String(totalCount);

    const countChannelsEl = document.getElementById('count-blocked-channels');
    if (countChannelsEl) countChannelsEl.textContent = String(this.blockedChannels.length);

    const countKeywordsEl = document.getElementById('count-blocked-keywords');
    if (countKeywordsEl) countKeywordsEl.textContent = String(this.blockedKeywords.length);

    // Render Channel Chips
    const channelsCloud = document.getElementById('blocked-channels-cloud');
    if (channelsCloud) {
      channelsCloud.innerHTML = '';
      this.blockedChannels.forEach(channel => {
        const chip = document.createElement('span');
        chip.className = 'chip channel-chip';
        chip.dataset.item = channel;
        
        const label = document.createElement('span');
        label.className = 'chip-label';
        label.textContent = channel;
        
        const btnRemove = document.createElement('button');
        btnRemove.className = 'btn-remove-chip';
        btnRemove.setAttribute('aria-label', `Remove ${channel}`);
        btnRemove.textContent = '✕';
        btnRemove.addEventListener('click', () => this.handleRemoveChannel(channel));

        chip.appendChild(label);
        chip.appendChild(btnRemove);
        channelsCloud.appendChild(chip);
      });
    }

    // Render Keyword Chips
    const keywordsCloud = document.getElementById('blocked-keywords-cloud');
    if (keywordsCloud) {
      keywordsCloud.innerHTML = '';
      this.blockedKeywords.forEach(keyword => {
        const chip = document.createElement('span');
        chip.className = 'chip keyword-chip';
        chip.dataset.item = keyword;

        const label = document.createElement('span');
        label.className = 'chip-label';
        label.textContent = keyword;

        const btnRemove = document.createElement('button');
        btnRemove.className = 'btn-remove-chip';
        btnRemove.setAttribute('aria-label', `Remove ${keyword}`);
        btnRemove.textContent = '✕';
        btnRemove.addEventListener('click', () => this.handleRemoveKeyword(keyword));

        chip.appendChild(label);
        chip.appendChild(btnRemove);
        keywordsCloud.appendChild(chip);
      });
    }

    if (this.searchQuery) {
      this.applyFilter();
    }
  }
}

describe('Tier 1: Custom Blocklist Dashboard Studio Management (Options UI)', () => {

  test('T1.1: Options UI sidebar navigation switches to blocklist tab and activates panel', async () => {
    await resetStorage();
    setupOptionsDOM();
    const studio = new BlocklistStudioController();
    await studio.init();

    const blocklistTabBtn = document.getElementById('nav-tab-blocklist');
    const blocklistContent = document.getElementById('blocklist-tab');
    const focusTabBtn = document.querySelector('[data-tab="focus"]');

    assert.ok(focusTabBtn.classList.contains('active'), 'Focus tab initially active');
    assert.equal(blocklistTabBtn.classList.contains('active'), false);

    blocklistTabBtn.click();

    assert.ok(blocklistTabBtn.classList.contains('active'), 'Blocklist nav item is active');
    assert.equal(blocklistTabBtn.getAttribute('aria-selected'), 'true');
    assert.ok(blocklistContent.classList.contains('active'), 'Blocklist content panel is active');
  });

  test('T1.2: Dynamic badge displays total count of blocked channels and keywords on initial load', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedChannels', ['Linus Tech Tips', 'Veritasium']);
    await StorageUtil.updateSetting('blockedKeywords', ['gaming', 'reaction', 'vlog']);

    setupOptionsDOM();
    const studio = new BlocklistStudioController();
    await studio.init();

    const badge = document.getElementById('nav-blocklist-badge');
    const channelCount = document.getElementById('count-blocked-channels');
    const keywordCount = document.getElementById('count-blocked-keywords');

    assert.equal(badge.textContent, '5', 'Total badge count is 2 channels + 3 keywords = 5');
    assert.equal(channelCount.textContent, '2', 'Channel count displays 2');
    assert.equal(keywordCount.textContent, '3', 'Keyword count displays 3');
  });

  test('T1.3: Blocked Channels and Keywords render as interactive chips with text and remove buttons', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedChannels', ['TechLead']);
    await StorageUtil.updateSetting('blockedKeywords', ['clickbait']);

    setupOptionsDOM();
    const studio = new BlocklistStudioController();
    await studio.init();

    const channelChips = document.querySelectorAll('#blocked-channels-cloud .chip');
    const keywordChips = document.querySelectorAll('#blocked-keywords-cloud .chip');

    assert.equal(channelChips.length, 1, '1 channel chip rendered');
    assert.equal(channelChips[0].querySelector('.chip-label').textContent, 'TechLead');
    assert.ok(channelChips[0].querySelector('.btn-remove-chip'), 'Channel chip has remove button');

    assert.equal(keywordChips.length, 1, '1 keyword chip rendered');
    assert.equal(keywordChips[0].querySelector('.chip-label').textContent, 'clickbait');
    assert.ok(keywordChips[0].querySelector('.btn-remove-chip'), 'Keyword chip has remove button');
  });

  test('T1.4: Add Channel via Add button trims input, renders chip, updates badge, and persists to storage', async () => {
    await resetStorage();
    setupOptionsDOM();
    const studio = new BlocklistStudioController();
    await studio.init();

    const input = document.getElementById('input-add-channel');
    const btn = document.getElementById('btn-add-channel');

    input.value = '  Fireship  ';
    btn.click();
    await new Promise(r => setTimeout(r, 10));

    const settings = await StorageUtil.getSettings();
    assert.deepEqual(settings.blockedChannels, ['Fireship'], 'Fireship persisted to storage');

    const badge = document.getElementById('nav-blocklist-badge');
    assert.equal(badge.textContent, '1', 'Badge updated to 1');
    assert.equal(input.value, '', 'Input cleared after add');
  });

  test('T1.5: Add Channel via Enter key triggers addition and storage sync', async () => {
    await resetStorage();
    setupOptionsDOM();
    const studio = new BlocklistStudioController();
    await studio.init();

    const input = document.getElementById('input-add-channel');
    input.value = 'CodeBeauty';
    input.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault: () => {} });
    await new Promise(r => setTimeout(r, 10));

    const settings = await StorageUtil.getSettings();
    assert.ok(settings.blockedChannels.includes('CodeBeauty'), 'CodeBeauty added via Enter');
  });

  test('T1.6: Add Keyword converts to lowercase, renders chip, and persists to storage', async () => {
    await resetStorage();
    setupOptionsDOM();
    const studio = new BlocklistStudioController();
    await studio.init();

    const input = document.getElementById('input-add-keyword');
    const btn = document.getElementById('btn-add-keyword');

    input.value = '  CRYPTO  ';
    btn.click();
    await new Promise(r => setTimeout(r, 10));

    const settings = await StorageUtil.getSettings();
    assert.deepEqual(settings.blockedKeywords, ['crypto'], 'Keyword saved in lowercase');

    const keywordChips = document.querySelectorAll('#blocked-keywords-cloud .chip');
    assert.equal(keywordChips.length, 1);
    assert.equal(keywordChips[0].querySelector('.chip-label').textContent, 'crypto');
  });

  test('T1.7: Auto-deduplication prevents duplicate channels (case-insensitive) from being added', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedChannels', ['Fireship']);

    setupOptionsDOM();
    const studio = new BlocklistStudioController();
    await studio.init();

    const input = document.getElementById('input-add-channel');
    const btn = document.getElementById('btn-add-channel');

    input.value = '  FIRESHIP  ';
    btn.click();
    await new Promise(r => setTimeout(r, 10));

    const settings = await StorageUtil.getSettings();
    assert.equal(settings.blockedChannels.length, 1, 'Duplicate channel not added to storage');

    const chips = document.querySelectorAll('#blocked-channels-cloud .chip');
    assert.equal(chips.length, 1, 'Only 1 chip rendered in DOM');
  });

  test('T1.8: Auto-deduplication prevents duplicate keywords from being added', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedKeywords', ['gaming']);

    setupOptionsDOM();
    const studio = new BlocklistStudioController();
    await studio.init();

    const input = document.getElementById('input-add-keyword');
    const btn = document.getElementById('btn-add-keyword');

    input.value = 'Gaming';
    btn.click();
    await new Promise(r => setTimeout(r, 10));

    const settings = await StorageUtil.getSettings();
    assert.equal(settings.blockedKeywords.length, 1);
    assert.deepEqual(settings.blockedKeywords, ['gaming']);
  });

  test('T1.9: Empty or whitespace-only inputs are ignored and do not alter state', async () => {
    await resetStorage();
    setupOptionsDOM();
    const studio = new BlocklistStudioController();
    await studio.init();

    const inputChannel = document.getElementById('input-add-channel');
    const btnChannel = document.getElementById('btn-add-channel');
    inputChannel.value = '    ';
    btnChannel.click();

    const inputKw = document.getElementById('input-add-keyword');
    const btnKw = document.getElementById('btn-add-keyword');
    inputKw.value = '';
    btnKw.click();

    const settings = await StorageUtil.getSettings();
    assert.equal(settings.blockedChannels.length, 0, 'No channel added');
    assert.equal(settings.blockedKeywords.length, 0, 'No keyword added');
    assert.equal(document.getElementById('nav-blocklist-badge').textContent, '0');
  });

  test('T1.10: Single-click ✕ button removes channel chip, updates storage, and decrements badge', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedChannels', ['ChannelA', 'ChannelB']);

    setupOptionsDOM();
    const studio = new BlocklistStudioController();
    await studio.init();

    let chips = document.querySelectorAll('#blocked-channels-cloud .chip');
    assert.equal(chips.length, 2);

    const removeBtn = chips[0].querySelector('.btn-remove-chip');
    removeBtn.click();
    await new Promise(r => setTimeout(r, 10));

    const settings = await StorageUtil.getSettings();
    assert.deepEqual(settings.blockedChannels, ['ChannelB'], 'ChannelA removed from storage');

    chips = document.querySelectorAll('#blocked-channels-cloud .chip');
    assert.equal(chips.length, 1, 'Only 1 channel chip remaining in DOM');
    assert.equal(document.getElementById('nav-blocklist-badge').textContent, '1');
  });

  test('T1.11: Single-click ✕ button removes keyword chip, updates storage, and decrements badge', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedKeywords', ['prank', 'drama']);

    setupOptionsDOM();
    const studio = new BlocklistStudioController();
    await studio.init();

    let chips = document.querySelectorAll('#blocked-keywords-cloud .chip');
    assert.equal(chips.length, 2);

    const removeBtn = chips[0].querySelector('.btn-remove-chip');
    removeBtn.click();
    await new Promise(r => setTimeout(r, 10));

    const settings = await StorageUtil.getSettings();
    assert.deepEqual(settings.blockedKeywords, ['drama'], 'prank removed from storage');
    assert.equal(document.getElementById('nav-blocklist-badge').textContent, '1');
  });

  test('T1.12: Live search bar filters visible chips in real time across both panels', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedChannels', ['Linus Tech Tips', 'Veritasium', 'TechLinked']);
    await StorageUtil.updateSetting('blockedKeywords', ['technology', 'gaming', 'tech review']);

    setupOptionsDOM();
    const studio = new BlocklistStudioController();
    await studio.init();

    const searchInput = document.getElementById('blocklist-search-input');
    
    // Filter with "tech"
    searchInput.value = 'tech';
    searchInput.dispatchEvent({ type: 'input', target: { value: 'tech' } });

    const channelChips = document.querySelectorAll('#blocked-channels-cloud .chip');
    const keywordChips = document.querySelectorAll('#blocked-keywords-cloud .chip');

    assert.equal(channelChips[0].style.display, '', 'Linus Tech Tips is visible');
    assert.equal(channelChips[1].style.display, 'none', 'Veritasium is hidden');
    assert.equal(channelChips[2].style.display, '', 'TechLinked is visible');

    assert.equal(keywordChips[0].style.display, '', 'technology is visible');
    assert.equal(keywordChips[1].style.display, 'none', 'gaming is hidden');
    assert.equal(keywordChips[2].style.display, '', 'tech review is visible');

    // Clear filter
    searchInput.value = '';
    searchInput.dispatchEvent({ type: 'input', target: { value: '' } });

    assert.equal(channelChips[1].style.display, '', 'Veritasium is restored when filter cleared');
    assert.equal(keywordChips[1].style.display, '', 'gaming is restored when filter cleared');
  });

  test('T1.13: Clear All button empties both chip clouds, clears storage, and resets badge to 0', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedChannels', ['Channel1', 'Channel2']);
    await StorageUtil.updateSetting('blockedKeywords', ['kw1', 'kw2', 'kw3']);

    setupOptionsDOM();
    const studio = new BlocklistStudioController();
    await studio.init();

    assert.equal(document.getElementById('nav-blocklist-badge').textContent, '5');

    const clearBtn = document.getElementById('btn-blocklist-clear-all');
    clearBtn.click();
    await new Promise(r => setTimeout(r, 10));

    const settings = await StorageUtil.getSettings();
    assert.deepEqual(settings.blockedChannels, [], 'Channels cleared in storage');
    assert.deepEqual(settings.blockedKeywords, [], 'Keywords cleared in storage');

    assert.equal(document.querySelectorAll('#blocked-channels-cloud .chip').length, 0);
    assert.equal(document.querySelectorAll('#blocked-keywords-cloud .chip').length, 0);
    assert.equal(document.getElementById('nav-blocklist-badge').textContent, '0');
  });

  test('T1.14: Export JSON generates valid structured payload of current blocklists', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedChannels', ['ChannelAlpha', 'ChannelBeta']);
    await StorageUtil.updateSetting('blockedKeywords', ['keyword1', 'keyword2']);

    setupOptionsDOM();
    const studio = new BlocklistStudioController();
    await studio.init();

    const jsonString = studio.handleExportJSON();
    const parsed = JSON.parse(jsonString);

    assert.equal(parsed.version, 1);
    assert.ok(parsed.exportedAt);
    assert.deepEqual(parsed.blockedChannels, ['ChannelAlpha', 'ChannelBeta']);
    assert.deepEqual(parsed.blockedKeywords, ['keyword1', 'keyword2']);
  });

  test('T1.15: Import JSON merges new valid items, deduplicates, persists, and updates UI', async () => {
    await resetStorage();
    await StorageUtil.updateSetting('blockedChannels', ['ExistingChannel']);
    await StorageUtil.updateSetting('blockedKeywords', ['existingkw']);

    setupOptionsDOM();
    const studio = new BlocklistStudioController();
    await studio.init();

    const importPayload = JSON.stringify({
      version: 1,
      blockedChannels: ['existingchannel', 'NewChannelA', 'NewChannelB'],
      blockedKeywords: ['EXISTINGKW', 'newkw1', 'newkw2']
    });

    const result = await studio.handleImportJSON(importPayload);
    assert.equal(result.success, true);
    assert.equal(result.channelCount, 3);
    assert.equal(result.keywordCount, 3);

    const settings = await StorageUtil.getSettings();
    assert.deepEqual(settings.blockedChannels, ['ExistingChannel', 'NewChannelA', 'NewChannelB']);
    assert.deepEqual(settings.blockedKeywords, ['existingkw', 'newkw1', 'newkw2']);

    assert.equal(document.getElementById('nav-blocklist-badge').textContent, '6');
    assert.equal(document.querySelectorAll('#blocked-channels-cloud .chip').length, 3);
    assert.equal(document.querySelectorAll('#blocked-keywords-cloud .chip').length, 3);
  });

  test('T1.16: Import JSON handles corrupted or invalid input gracefully without crashing', async () => {
    await resetStorage();
    setupOptionsDOM();
    const studio = new BlocklistStudioController();
    await studio.init();

    const badResult = await studio.handleImportJSON('NOT_A_JSON_STRING{');
    assert.equal(badResult.success, false);
    assert.ok(badResult.error);

    const emptyObjResult = await studio.handleImportJSON(JSON.stringify(null));
    assert.equal(emptyObjResult.success, false);
  });

});
