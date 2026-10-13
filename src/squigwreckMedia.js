"use strict";

// Discord EmbedBuilder images cannot contain MP4 video. Upload the actual MP4
// as an attachment so Discord can display its native video player. If the
// upstream video or Discord upload is unavailable, post the original URL.
const axios = require("axios");
const { AttachmentBuilder } = require("discord.js");

const MAX_START_VIDEO_BYTES = 10 * 1024 * 1024;
const START_VIDEO_FILENAME = "squigwreck-start.mp4";
const START_VIDEO_TIMEOUT_MS = 10_000;

function validateSquigwreckVideoUrl(value) {
  return /^https:\/\/i\.imgur\.com\/[A-Za-z0-9]+\.mp4$/.test(value);
}

async function sendSquigwreckStartVideo(channel, videoUrl, options = {}) {
  if (!validateSquigwreckVideoUrl(videoUrl)) {
    throw new TypeError("Squigwreck start video must be a direct HTTPS Imgur MP4 URL.");
  }

  const get = options.get || axios.get;
  const Attachment = options.Attachment || AttachmentBuilder;
  const logger = options.logger || console;

  try {
    const response = await get(videoUrl, {
      responseType: "arraybuffer",
      timeout: START_VIDEO_TIMEOUT_MS,
      maxContentLength: MAX_START_VIDEO_BYTES,
      maxBodyLength: MAX_START_VIDEO_BYTES,
      headers: { Accept: "video/mp4" },
    });
    const buffer = Buffer.isBuffer(response.data)
      ? response.data
      : Buffer.from(response.data);

    // Detect expired redirects, HTML errors, and unexpectedly oversized files.
    if (!buffer.length || buffer.length > MAX_START_VIDEO_BYTES ||
        buffer.toString("ascii", 4, 8) !== "ftyp") {
      throw new Error("The Squigwreck video response is not a valid MP4 under the upload size limit.");
    }

    await channel.send({
      files: [new Attachment(buffer, { name: START_VIDEO_FILENAME })],
    });
    return { delivery: "attachment" };
  } catch (error) {
    logger.warn(
      "[SQUIGWRECK:START_VIDEO] MP4 upload unavailable; posting direct video link:",
      error?.message || error
    );
    try {
      // A direct URL can still display a Discord video preview even when
      // reuploading is blocked; either way, the link remains accessible.
      await channel.send({ content: videoUrl });
      return { delivery: "link" };
    } catch (fallbackError) {
      logger.error(
        "[SQUIGWRECK:START_VIDEO] Failed to deliver fallback video link:",
        fallbackError?.message || fallbackError
      );
      // Missing media must never prevent the Survival game from starting.
      return { delivery: "unavailable" };
    }
  }
}

module.exports = {
  MAX_START_VIDEO_BYTES,
  START_VIDEO_FILENAME,
  START_VIDEO_TIMEOUT_MS,
  validateSquigwreckVideoUrl,
  sendSquigwreckStartVideo,
};
