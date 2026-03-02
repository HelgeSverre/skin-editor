// popup.js — Vanilla JS UI for Discord Skin Scraper popup

// ===== Helpers =====

async function send(message) {
  return chrome.runtime.sendMessage(message);
}

function $(id) {
  return document.getElementById(id);
}

function show(el) {
  el.classList.remove('hidden');
}

function hide(el) {
  el.classList.add('hidden');
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// ===== State =====

let selectedGuildId = null;
let selectedGuildName = '';
let selectedChannels = []; // [{ id, name, includeThreads }]
let tokenPollInterval = null;

// ===== Step Navigation =====

const steps = [
  'step-token',
  'step-guilds',
  'step-channels',
  'step-filters',
  'step-progress',
  'step-results',
];

function goToStep(stepId) {
  for (const id of steps) {
    const el = $(id);
    if (el) {
      if (id === stepId) {
        show(el);
      } else {
        hide(el);
      }
    }
  }
}

// ===== Step 1: Token Status =====

async function checkTokenStatus() {
  try {
    const status = await send({ type: 'GET_STATUS' });

    // If scraping is in progress, jump to progress step
    if (status.status === 'scraping') {
      stopTokenPoll();
      goToStep('step-progress');
      if (status.progress) {
        updateProgressUI(status.progress, status.attachmentCount);
      }
      return;
    }

    // If scraping is complete, jump to results
    if (status.status === 'complete') {
      stopTokenPoll();
      goToStep('step-results');
      loadResults();
      return;
    }

    // If status is idle but popup is showing the progress step (e.g. service worker restarted),
    // redirect back to server selection
    if (status.status === 'idle' && status.hasToken) {
      const progressStep = $('step-progress');
      if (progressStep && !progressStep.classList.contains('hidden')) {
        stopTokenPoll();
        goToStep('step-guilds');
        loadGuilds();
        return;
      }
    }

    const badge = $('token-status');
    const label = $('token-label');
    const hint = $('token-hint');

    if (status.hasToken) {
      badge.className = 'token-badge connected';
      label.textContent = 'Connected';
      hint.textContent = 'Token captured successfully.';
      stopTokenPoll();
      // Auto-advance to guild selection after a brief pause
      setTimeout(() => {
        goToStep('step-guilds');
        loadGuilds();
      }, 600);
    } else {
      badge.className = 'token-badge disconnected';
      label.textContent = 'Not connected';
      hint.textContent = 'Open Discord in a browser tab to connect.';
    }
  } catch (err) {
    console.error('Error checking status:', err);
  }
}

function startTokenPoll() {
  checkTokenStatus();
  tokenPollInterval = setInterval(checkTokenStatus, 2000);
}

function stopTokenPoll() {
  if (tokenPollInterval) {
    clearInterval(tokenPollInterval);
    tokenPollInterval = null;
  }
}

// ===== Step 2: Guild Selection =====

async function loadGuilds() {
  const container = $('guild-list');
  container.innerHTML = '<div class="loading-spinner">Loading servers...</div>';

  try {
    const result = await send({ type: 'GET_GUILDS' });

    if (result.error) {
      container.innerHTML = `<div class="empty-state">Error: ${result.error}</div>`;
      return;
    }

    const guilds = result.guilds || [];
    if (guilds.length === 0) {
      container.innerHTML = '<div class="empty-state">No servers found.</div>';
      return;
    }

    // Sort by name
    guilds.sort((a, b) => a.name.localeCompare(b.name));

    container.innerHTML = '';
    for (const guild of guilds) {
      const row = document.createElement('div');
      row.className = 'guild-row';
      row.dataset.guildId = guild.id;

      const iconEl = document.createElement('div');
      iconEl.className = 'guild-icon';
      if (guild.icon) {
        const img = document.createElement('img');
        img.src = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`;
        img.alt = '';
        img.onerror = () => {
          iconEl.removeChild(img);
          iconEl.textContent = guild.name.charAt(0).toUpperCase();
        };
        iconEl.appendChild(img);
      } else {
        iconEl.textContent = guild.name.charAt(0).toUpperCase();
      }

      const info = document.createElement('div');
      info.className = 'guild-info';

      const name = document.createElement('div');
      name.className = 'guild-name';
      name.textContent = guild.name;

      const members = document.createElement('div');
      members.className = 'guild-members';
      const count = guild.approximate_member_count || guild.member_count;
      members.textContent = count ? `${count.toLocaleString()} members` : '';

      info.appendChild(name);
      info.appendChild(members);

      const arrow = document.createElement('span');
      arrow.className = 'guild-arrow';
      arrow.innerHTML = '&#8250;';

      row.appendChild(iconEl);
      row.appendChild(info);
      row.appendChild(arrow);

      row.addEventListener('click', () => {
        selectedGuildId = guild.id;
        selectedGuildName = guild.name;
        goToStep('step-channels');
        loadChannels(guild.id, guild.name);
      });

      container.appendChild(row);
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Failed to load servers: ${err.message}</div>`;
  }
}

// ===== Step 3: Channel Selection =====

async function loadChannels(guildId, guildName) {
  const container = $('channel-list');
  const title = $('channels-title');
  title.textContent = guildName || 'Select Channels';
  container.innerHTML = '<div class="loading-spinner">Loading channels...</div>';
  $('btn-channels-next').disabled = true;

  try {
    const result = await send({ type: 'GET_CHANNELS', guildId });

    if (result.error) {
      container.innerHTML = `<div class="empty-state">Error: ${result.error}</div>`;
      return;
    }

    const channels = result.channels || [];
    if (channels.length === 0) {
      container.innerHTML = '<div class="empty-state">No channels found.</div>';
      return;
    }

    // Separate categories and text channels
    const categories = channels.filter(c => c.type === 4);
    const textChannels = channels.filter(c => c.type === 0);

    // Sort categories by position
    categories.sort((a, b) => a.position - b.position);

    // Group text channels by parent_id
    const grouped = new Map();
    const uncategorized = [];

    for (const ch of textChannels) {
      if (ch.parent_id) {
        if (!grouped.has(ch.parent_id)) grouped.set(ch.parent_id, []);
        grouped.get(ch.parent_id).push(ch);
      } else {
        uncategorized.push(ch);
      }
    }

    // Sort channels within each group by position
    for (const [, arr] of grouped) {
      arr.sort((a, b) => a.position - b.position);
    }
    uncategorized.sort((a, b) => a.position - b.position);

    container.innerHTML = '';

    // Render uncategorized channels first
    if (uncategorized.length > 0) {
      renderChannelGroup(container, null, uncategorized);
    }

    // Render categorized channels
    for (const cat of categories) {
      const chans = grouped.get(cat.id);
      if (chans && chans.length > 0) {
        renderChannelGroup(container, cat.name, chans);
      }
    }

    updateChannelNextButton();
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Failed to load channels: ${err.message}</div>`;
  }
}

function renderChannelGroup(container, categoryName, channels) {
  if (categoryName) {
    const header = document.createElement('div');
    header.className = 'category-header';
    header.textContent = categoryName;
    container.appendChild(header);
  }

  for (const ch of channels) {
    const row = document.createElement('div');
    row.className = 'channel-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.channelId = ch.id;
    checkbox.dataset.channelName = ch.name;
    checkbox.addEventListener('change', updateChannelNextButton);

    const hash = document.createElement('span');
    hash.className = 'channel-hash';
    hash.textContent = '#';

    const name = document.createElement('span');
    name.className = 'channel-name';
    name.textContent = ch.name;

    const threadToggle = document.createElement('label');
    threadToggle.className = 'thread-toggle';
    const threadCheckbox = document.createElement('input');
    threadCheckbox.type = 'checkbox';
    threadCheckbox.dataset.threadToggle = ch.id;
    const threadLabel = document.createTextNode('Threads');
    threadToggle.appendChild(threadCheckbox);
    threadToggle.appendChild(threadLabel);

    row.appendChild(checkbox);
    row.appendChild(hash);
    row.appendChild(name);
    row.appendChild(threadToggle);
    container.appendChild(row);
  }
}

function updateChannelNextButton() {
  const checkboxes = document.querySelectorAll('#channel-list input[data-channel-id]:checked');
  $('btn-channels-next').disabled = checkboxes.length === 0;
}

function getSelectedChannels() {
  const checkboxes = document.querySelectorAll('#channel-list input[data-channel-id]:checked');
  const channels = [];
  for (const cb of checkboxes) {
    const threadToggle = document.querySelector(
      `#channel-list input[data-thread-toggle="${cb.dataset.channelId}"]`
    );
    channels.push({
      id: cb.dataset.channelId,
      name: cb.dataset.channelName,
      includeThreads: threadToggle ? threadToggle.checked : false,
    });
  }
  return channels;
}

function selectAllChannels() {
  const checkboxes = document.querySelectorAll('#channel-list input[data-channel-id]');
  for (const cb of checkboxes) cb.checked = true;
  updateChannelNextButton();
}

function deselectAllChannels() {
  const checkboxes = document.querySelectorAll('#channel-list input[data-channel-id]');
  for (const cb of checkboxes) cb.checked = false;
  updateChannelNextButton();
}

// ===== Step 4: File Filters =====

function getSelectedExtensions() {
  const checkboxes = document.querySelectorAll('.filter-item input[type="checkbox"]:checked');
  const extensions = [];
  for (const cb of checkboxes) {
    const exts = cb.dataset.extensions.split(',');
    extensions.push(...exts);
  }
  return extensions;
}

async function startScrape() {
  selectedChannels = getSelectedChannels();
  const extensions = getSelectedExtensions();

  if (selectedChannels.length === 0) return;
  if (extensions.length === 0) return;

  goToStep('step-progress');

  // Reset progress UI
  $('progress-channel-name').textContent = '--';
  $('progress-messages').textContent = '0';
  $('progress-attachments').textContent = '0';
  $('progress-bar').style.width = '0%';
  $('progress-label').textContent = `Channel 0 of ${selectedChannels.length}`;

  try {
    await send({
      type: 'START_SCRAPE',
      config: {
        guildId: selectedGuildId,
        channels: selectedChannels,
        extensions,
      },
    });
  } catch (err) {
    console.error('Failed to start scrape:', err);
  }
}

// ===== Step 5: Progress =====

function updateProgressUI(progress, attachmentCount) {
  if (!progress) return;

  $('progress-channel-name').textContent = progress.channelName || '--';
  $('progress-messages').textContent = (progress.messageCount || 0).toLocaleString();
  $('progress-attachments').textContent = (
    attachmentCount ?? progress.attachmentCount ?? 0
  ).toLocaleString();

  const channelIndex = (progress.channelIndex ?? 0) + 1;
  const channelCount = progress.channelCount || 0;
  const pct = channelCount > 0 ? Math.round((channelIndex / channelCount) * 100) : 0;
  $('progress-bar').style.width = pct + '%';
  $('progress-label').textContent = `Channel ${channelIndex} of ${channelCount}`;
}

async function stopScrape() {
  try {
    await send({ type: 'STOP_SCRAPE' });
  } catch (err) {
    console.error('Failed to stop scrape:', err);
  }
  // The PROGRESS_UPDATE with status=complete will trigger showing results
  goToStep('step-results');
  loadResults();
}

// ===== Step 6: Results =====

async function loadResults() {
  try {
    const result = await send({ type: 'GET_RESULTS' });

    const attachments = result.attachments || [];
    const errors = result.errors || [];

    // Summary stats
    const totalSize = attachments.reduce((sum, a) => sum + (a.size || 0), 0);
    $('result-total').textContent = attachments.length.toLocaleString();
    $('result-size').textContent = formatSize(totalSize);
    $('result-errors').textContent = errors.length.toString();

    // Channel breakdown table
    const channelCounts = new Map();
    for (const att of attachments) {
      const key = att.channelName || 'unknown';
      channelCounts.set(key, (channelCounts.get(key) || 0) + 1);
    }

    const tableContainer = $('results-table-container');
    if (channelCounts.size > 0) {
      let html = '<table class="results-table"><thead><tr>';
      html += '<th>Channel</th><th>Files</th>';
      html += '</tr></thead><tbody>';

      const sorted = [...channelCounts.entries()].sort((a, b) => b[1] - a[1]);
      for (const [channel, count] of sorted) {
        html += `<tr><td>${escapeHtml(channel)}</td><td>${count}</td></tr>`;
      }

      html += '</tbody></table>';
      tableContainer.innerHTML = html;
    } else {
      tableContainer.innerHTML = '<div class="empty-state">No attachments found.</div>';
    }

    // Error section
    const errorSection = $('error-section');
    if (errors.length > 0) {
      show(errorSection);
      const errorList = $('error-list');
      errorList.innerHTML = '';
      for (const err of errors) {
        const item = document.createElement('div');
        item.className = 'error-item';
        item.textContent = err;
        errorList.appendChild(item);
      }
    } else {
      hide(errorSection);
    }

    // Enable/disable download buttons based on attachment count
    $('btn-download-zip').disabled = attachments.length === 0;
    $('btn-download-individual').disabled = attachments.length === 0;
  } catch (err) {
    console.error('Failed to load results:', err);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function downloadZip() {
  const btn = $('btn-download-zip');
  const originalText = btn.textContent;
  btn.textContent = 'Preparing ZIP...';
  btn.disabled = true;

  try {
    const result = await send({ type: 'DOWNLOAD_ZIP' });
    if (result.error) {
      btn.textContent = 'Error: ' + result.error;
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 3000);
    } else {
      btn.textContent = 'Download started!';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);
    }
  } catch (err) {
    btn.textContent = 'Failed';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 3000);
  }
}

async function downloadIndividual() {
  const btn = $('btn-download-individual');
  const originalText = btn.textContent;
  btn.textContent = 'Starting downloads...';
  btn.disabled = true;

  try {
    const result = await send({ type: 'DOWNLOAD_INDIVIDUAL' });
    if (result.error) {
      btn.textContent = 'Error: ' + result.error;
    } else {
      btn.textContent = `Downloaded ${result.downloaded} files`;
    }
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 3000);
  } catch (err) {
    btn.textContent = 'Failed';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 3000);
  }
}

function startOver() {
  selectedGuildId = null;
  selectedGuildName = '';
  selectedChannels = [];
  goToStep('step-guilds');
  loadGuilds();
}

// ===== Progress Listener =====

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PROGRESS_UPDATE') {
    if (message.status === 'complete') {
      goToStep('step-results');
      loadResults();
    } else if (message.progress) {
      updateProgressUI(message.progress, message.attachmentCount);
    }
  }
  // Ignore ZIP_INIT, ZIP_ADD_FILE, ZIP_GENERATE, ZIP_CLEANUP - they're for the offscreen doc
});

// ===== Event Bindings =====

document.addEventListener('DOMContentLoaded', () => {
  // Step 2 back is not needed (token step auto-advances)

  // Step 3: Channel selection
  $('btn-back-guilds').addEventListener('click', () => {
    goToStep('step-guilds');
    loadGuilds();
  });
  $('btn-select-all').addEventListener('click', selectAllChannels);
  $('btn-deselect-all').addEventListener('click', deselectAllChannels);
  $('btn-channels-next').addEventListener('click', () => {
    selectedChannels = getSelectedChannels();
    if (selectedChannels.length > 0) {
      goToStep('step-filters');
    }
  });

  // Step 4: Filters
  $('btn-back-channels').addEventListener('click', () => {
    goToStep('step-channels');
  });
  $('btn-start-scrape').addEventListener('click', startScrape);

  // Step 5: Progress
  $('btn-stop').addEventListener('click', stopScrape);

  // Step 6: Results
  $('btn-download-zip').addEventListener('click', downloadZip);
  $('btn-download-individual').addEventListener('click', downloadIndividual);
  $('btn-start-over').addEventListener('click', startOver);

  // Error toggle
  $('btn-toggle-errors').addEventListener('click', () => {
    const errorList = $('error-list');
    const btn = $('btn-toggle-errors');
    if (errorList.classList.contains('hidden')) {
      show(errorList);
      btn.textContent = 'Hide Errors';
    } else {
      hide(errorList);
      btn.textContent = 'Show Errors';
    }
  });

  // Start with token check
  goToStep('step-token');
  startTokenPoll();
});
