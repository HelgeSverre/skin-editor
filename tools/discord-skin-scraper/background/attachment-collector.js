// background/attachment-collector.js

const SKIN_EXTENSIONS = new Set([
  '.zip', '.7z', '.rar', '.tar', '.gz', '.tgz',
  '.json', '.json5', '.xml', '.rml', '.rcss',
  '.png', '.jpg', '.jpeg', '.bmp', '.svg', '.gif', '.webp',
  '.ttf', '.otf', '.woff', '.woff2',
  '.mid', '.midi', '.syx',
  '.wav', '.mp3', '.ogg', '.flac', '.aif', '.aiff',
  '.fxp', '.fxb', '.vstpreset', '.nmsv', '.h2p',
  '.pdf', '.txt', '.md', '.doc', '.docx',
]);

// Pattern to extract URLs from message content that point to downloadable files
const URL_PATTERN = /https?:\/\/[^\s<>"]+/gi;

// Known file hosting domains where URLs likely contain downloadable skin files
const FILE_HOSTING_DOMAINS = [
  'cdn.discordapp.com',
  'media.discordapp.net',
  'drive.google.com',
  'mega.nz', 'mega.co.nz',
  'dropbox.com', 'dl.dropboxusercontent.com',
  'mediafire.com',
  'github.com', 'raw.githubusercontent.com',
];

export class AttachmentCollector {
  constructor(api) {
    this.api = api;
    this.aborted = false;
  }

  _matchesFilter(filename, enabledExtensions) {
    const dot = filename.lastIndexOf('.');
    if (dot < 0) return false;
    const ext = filename.slice(dot).toLowerCase();
    return enabledExtensions.has(ext);
  }

  _sanitizeName(name) {
    return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'unnamed';
  }

  _filenameFromUrl(url) {
    try {
      const pathname = new URL(url).pathname;
      const segments = pathname.split('/');
      const last = segments[segments.length - 1];
      return last ? decodeURIComponent(last) : null;
    } catch {
      return null;
    }
  }

  _extractLinkedFiles(content, enabledExtensions) {
    if (!content) return [];
    const matches = content.match(URL_PATTERN);
    if (!matches) return [];

    const files = [];
    for (const rawUrl of matches) {
      // Clean trailing punctuation that might be part of the sentence
      const url = rawUrl.replace(/[).,;:!?]+$/, '');

      // Check if the URL points to a file with a matching extension
      const filename = this._filenameFromUrl(url);
      if (filename && this._matchesFilter(filename, enabledExtensions)) {
        files.push({ url, filename });
        continue;
      }

      // Check if it's a known file hosting service (capture as a link even without extension)
      try {
        const hostname = new URL(url).hostname;
        const isFileHost = FILE_HOSTING_DOMAINS.some(
          d => hostname === d || hostname.endsWith('.' + d)
        );
        if (isFileHost && filename && filename !== '') {
          // Only include CDN links with matching extensions (already handled above)
          // For hosting services like Google Drive/Mega, include as-is
          if (!hostname.includes('cdn.discordapp') && !hostname.includes('media.discordapp')) {
            files.push({ url, filename: `link_${hostname.replace(/\./g, '_')}`, isLink: true });
          }
        }
      } catch {
        // Invalid URL — skip
      }
    }
    return files;
  }

  async collectFromChannel(channelId, channelName, enabledExtensions, onProgress) {
    const attachments = [];
    const seen = new Set(); // for dedup: "filename|size" or "url"
    let messageCount = 0;

    if (this.aborted) return attachments;

    for await (const batch of this.api.getMessagesIterator(channelId, (count) => {
      messageCount = count;
      if (onProgress) {
        onProgress({
          phase: 'scanning',
          channelName,
          messageCount,
          attachmentCount: attachments.length,
        });
      }
    })) {
      if (this.aborted) break;

      for (const message of batch) {
        // Collect direct Discord attachments
        if (message.attachments?.length > 0) {
          for (const att of message.attachments) {
            if (!this._matchesFilter(att.filename, enabledExtensions)) continue;

            const key = `${att.filename}|${att.size}`;
            if (seen.has(key)) continue;
            seen.add(key);

            attachments.push({
              id: att.id,
              filename: att.filename,
              url: att.url,
              size: att.size,
              contentType: att.content_type || '',
              messageId: message.id,
              channelId,
              channelName: this._sanitizeName(channelName),
              authorName: message.author?.username || 'unknown',
              timestamp: message.timestamp,
            });
          }
        }

        // Collect file URLs from message content
        const linkedFiles = this._extractLinkedFiles(message.content, enabledExtensions);
        for (const file of linkedFiles) {
          if (file.isLink) continue; // Skip generic hosting links — they need manual download

          const key = file.url;
          if (seen.has(key)) continue;
          seen.add(key);

          attachments.push({
            id: `link_${message.id}_${attachments.length}`,
            filename: file.filename,
            url: file.url,
            size: 0, // Unknown for linked files
            contentType: '',
            messageId: message.id,
            channelId,
            channelName: this._sanitizeName(channelName),
            authorName: message.author?.username || 'unknown',
            timestamp: message.timestamp,
            source: 'content_link',
          });
        }
      }
    }

    return attachments;
  }

  async collectFromChannelWithThreads(channelId, channelName, guildId, enabledExtensions, onProgress) {
    const allAttachments = [];

    // Collect from main channel
    const channelAttachments = await this.collectFromChannel(
      channelId, channelName, enabledExtensions, onProgress
    );
    allAttachments.push(...channelAttachments);

    if (this.aborted) return allAttachments;

    // Collect from threads
    const threads = await this.api.getAllThreads(channelId, guildId);

    for (const thread of threads) {
      if (this.aborted) break;

      const threadName = `${this._sanitizeName(channelName)}/${this._sanitizeName(thread.name)}`;
      const threadAttachments = await this.collectFromChannel(
        thread.id, threadName, enabledExtensions, onProgress
      );
      allAttachments.push(...threadAttachments);
    }

    return allAttachments;
  }

  abort() {
    this.aborted = true;
  }

  reset() {
    this.aborted = false;
  }
}

export { SKIN_EXTENSIONS };
