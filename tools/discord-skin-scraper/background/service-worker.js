// background/service-worker.js

import { RateLimiter } from './rate-limiter.js';
import { DiscordAPI } from './discord-api.js';
import { AttachmentCollector, SKIN_EXTENSIONS } from './attachment-collector.js';

// --- Singletons ---
const rateLimiter = new RateLimiter();
const api = new DiscordAPI(rateLimiter);
const collector = new AttachmentCollector(api);

// --- State ---
let state = {
  token: null,
  status: 'idle', // idle | scraping | complete
  scrapeProgress: null,
  collectedAttachments: [],
  errors: [],
};

// --- Token capture via webRequest ---
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    const authHeader = details.requestHeaders?.find(
      h => h.name.toLowerCase() === 'authorization'
    );
    if (authHeader?.value && !authHeader.value.startsWith('Bot ')) {
      if (authHeader.value !== state.token) {
        state.token = authHeader.value;
        api.setToken(state.token);
        chrome.storage.session.set({ token: state.token });
        console.log('[ServiceWorker] Token captured via webRequest');
      }
    }
  },
  { urls: ['https://discord.com/api/*', 'https://*.discord.com/api/*'] },
  ['requestHeaders', 'extraHeaders']
);

// --- Keep-alive alarm during scraping ---
function startKeepAlive() {
  chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
}
function stopKeepAlive() {
  chrome.alarms.clear('keepalive');
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive' && state.status === 'scraping') {
    // Just staying alive — prevents MV3 service worker from going idle
  }
});

// --- Restore state on service worker restart ---
chrome.storage.session.get(['token'], (result) => {
  if (result.token) {
    state.token = result.token;
    api.setToken(state.token);
    console.log('[ServiceWorker] Token restored from session storage');
  }
});

// --- Message handling ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch(err => {
    sendResponse({ error: err.message });
  });
  return true; // Keep channel open for async
});

async function handleMessage(message) {
  switch (message.type) {
    case 'TOKEN_CAPTURED': {
      // From content script
      if (message.token && message.token !== state.token) {
        state.token = message.token;
        api.setToken(state.token);
        chrome.storage.session.set({ token: state.token });
        console.log('[ServiceWorker] Token captured via content script');
      }
      return { ok: true };
    }

    case 'GET_STATUS': {
      return {
        hasToken: !!state.token,
        status: state.status,
        progress: state.scrapeProgress,
        attachmentCount: state.collectedAttachments.length,
        errors: state.errors,
      };
    }

    case 'GET_GUILDS': {
      if (!state.token) return { error: 'No token' };
      const guilds = await api.getGuilds();
      return { guilds };
    }

    case 'GET_CHANNELS': {
      if (!state.token) return { error: 'No token' };
      const channels = await api.getGuildChannels(message.guildId);
      return { channels };
    }

    case 'GET_THREADS': {
      if (!state.token) return { error: 'No token' };
      const threads = await api.getAllThreads(message.channelId, message.guildId);
      return { threads };
    }

    case 'START_SCRAPE': {
      // message.config: { guildId, channels: [{ id, name, includeThreads }], extensions: array }
      if (!state.token) return { error: 'No token' };
      if (state.status === 'scraping') return { error: 'Already scraping' };

      state.status = 'scraping';
      state.collectedAttachments = [];
      state.errors = [];
      state.scrapeProgress = null;
      collector.reset();
      startKeepAlive();

      // Run scrape async (don't await -- respond immediately)
      runScrape(message.config).catch(err => {
        console.error('[ServiceWorker] Scrape failed:', err);
        state.errors.push(err.message);
        state.status = 'complete';
        stopKeepAlive();
      });

      return { ok: true, status: 'scraping' };
    }

    case 'STOP_SCRAPE': {
      collector.abort();
      state.status = 'complete';
      stopKeepAlive();
      return { ok: true };
    }

    case 'GET_RESULTS': {
      return {
        status: state.status,
        attachments: state.collectedAttachments,
        errors: state.errors,
        progress: state.scrapeProgress,
      };
    }

    case 'DOWNLOAD_ZIP': {
      if (state.collectedAttachments.length === 0) return { error: 'No attachments' };
      return await downloadAsZip(state.collectedAttachments);
    }

    case 'DOWNLOAD_INDIVIDUAL': {
      if (state.collectedAttachments.length === 0) return { error: 'No attachments' };
      return await downloadIndividually(state.collectedAttachments);
    }

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}

// --- Scraping logic ---
async function runScrape(config) {
  const { guildId, channels, extensions } = config;
  const enabledExtensions = new Set(extensions || [...SKIN_EXTENSIONS]);

  for (let i = 0; i < channels.length; i++) {
    if (collector.aborted) break;

    const ch = channels[i];
    state.scrapeProgress = {
      channelIndex: i,
      channelCount: channels.length,
      channelName: ch.name,
      messageCount: 0,
      attachmentCount: state.collectedAttachments.length,
    };

    // Broadcast progress to popup
    broadcastProgress();

    try {
      let attachments;
      if (ch.includeThreads) {
        attachments = await collector.collectFromChannelWithThreads(
          ch.id, ch.name, guildId, enabledExtensions, (progress) => {
            state.scrapeProgress = {
              ...state.scrapeProgress,
              ...progress,
              attachmentCount: state.collectedAttachments.length + (progress.attachmentCount || 0),
            };
            broadcastProgress();
          }
        );
      } else {
        attachments = await collector.collectFromChannel(
          ch.id, ch.name, enabledExtensions, (progress) => {
            state.scrapeProgress = {
              ...state.scrapeProgress,
              ...progress,
              attachmentCount: state.collectedAttachments.length + (progress.attachmentCount || 0),
            };
            broadcastProgress();
          }
        );
      }
      state.collectedAttachments.push(...attachments);
    } catch (err) {
      console.error(`[ServiceWorker] Error scraping ${ch.name}:`, err);
      state.errors.push(`${ch.name}: ${err.message}`);
    }
  }

  state.status = 'complete';
  state.scrapeProgress = null;
  stopKeepAlive();
  broadcastProgress();
}

function broadcastProgress() {
  chrome.runtime.sendMessage({
    type: 'PROGRESS_UPDATE',
    status: state.status,
    progress: state.scrapeProgress,
    attachmentCount: state.collectedAttachments.length,
    errors: state.errors,
  }).catch(() => {
    // Popup might not be open — that's fine
  });
}

// --- ZIP download via offscreen document ---
async function downloadAsZip(attachments) {
  // Create offscreen document for JSZip access
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['BLOBS'],
      justification: 'ZIP file assembly for skin downloads',
    });
  } catch (e) {
    // Document might already exist
    if (!e.message?.includes('Only a single offscreen')) {
      throw e;
    }
  }

  // Initialize a new ZIP in the offscreen document
  await chrome.runtime.sendMessage({ type: 'ZIP_INIT' });

  let downloaded = 0;
  const errors = [];

  for (const att of attachments) {
    try {
      // Fetch the attachment file
      const response = await fetch(att.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = await response.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);

      const path = `gearmulator-skins/${att.channelName}/${att.filename}`;

      await chrome.runtime.sendMessage({
        type: 'ZIP_ADD_FILE',
        path,
        data: base64,
      });

      downloaded++;
    } catch (err) {
      errors.push(`${att.filename}: ${err.message}`);
    }
  }

  // Generate the final ZIP blob
  const result = await chrome.runtime.sendMessage({ type: 'ZIP_GENERATE' });

  if (result?.ok && result.url) {
    // Trigger browser download
    await chrome.downloads.download({
      url: result.url,
      filename: 'gearmulator-skins.zip',
      conflictAction: 'uniquify',
    });
  }

  // Cleanup
  await chrome.runtime.sendMessage({ type: 'ZIP_CLEANUP' });
  try {
    await chrome.offscreen.closeDocument();
  } catch (e) {
    // Ignore close errors
  }

  return { ok: true, downloaded, errors };
}

// --- Individual downloads ---
async function downloadIndividually(attachments) {
  let downloaded = 0;
  const errors = [];

  for (const att of attachments) {
    try {
      await chrome.downloads.download({
        url: att.url,
        filename: `gearmulator-skins/${att.channelName}/${att.filename}`,
        conflictAction: 'uniquify',
      });
      downloaded++;
    } catch (err) {
      errors.push(`${att.filename}: ${err.message}`);
    }
  }

  return { ok: true, downloaded, errors };
}

// --- Utility ---
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

console.log('[ServiceWorker] Gearmulator Skin Scraper loaded');
