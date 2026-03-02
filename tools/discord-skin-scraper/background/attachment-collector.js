// background/attachment-collector.js

const SKIN_EXTENSIONS = new Set([
  '.zip', '.7z', '.rar',
  '.json', '.json5',
  '.png', '.jpg', '.jpeg', '.bmp',
  '.ttf', '.otf', '.woff',
]);

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

  async collectFromChannel(channelId, channelName, enabledExtensions, onProgress) {
    const attachments = [];
    const seen = new Set(); // for dedup: "filename|size"
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
        if (!message.attachments || message.attachments.length === 0) continue;

        for (const att of message.attachments) {
          if (!this._matchesFilter(att.filename, enabledExtensions)) continue;

          // Dedup by filename + size
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
