// offscreen/offscreen.js
// Receives file data from service worker, assembles ZIP using JSZip

let zip = null;
let fileCount = 0;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ZIP_INIT') {
    // Start a new ZIP
    zip = new JSZip();
    fileCount = 0;
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'ZIP_ADD_FILE') {
    // Add a file to the ZIP
    // message.path: string (e.g., "gearmulator-skins/channel-name/file.zip")
    // message.data: base64 encoded file content
    if (!zip) {
      sendResponse({ ok: false, error: 'ZIP not initialized' });
      return true;
    }
    try {
      zip.file(message.path, message.data, { base64: true });
      fileCount++;
      sendResponse({ ok: true, fileCount });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
    return true;
  }

  if (message.type === 'ZIP_GENERATE') {
    // Generate the ZIP and return a blob URL
    if (!zip) {
      sendResponse({ ok: false, error: 'ZIP not initialized' });
      return true;
    }

    zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        sendResponse({ ok: true, url, fileCount, size: blob.size });
      })
      .catch(err => {
        sendResponse({ ok: false, error: err.message });
      });

    return true; // Keep message channel open for async response
  }

  if (message.type === 'ZIP_CLEANUP') {
    // Clean up
    zip = null;
    fileCount = 0;
    sendResponse({ ok: true });
    return true;
  }
});
