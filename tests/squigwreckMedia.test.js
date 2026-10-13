"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_START_VIDEO_BYTES,
  START_VIDEO_FILENAME,
  validateSquigwreckVideoUrl,
  sendSquigwreckStartVideo,
} = require("../src/squigwreckMedia");
const { getSurvivalEraDefinition } = require("../src/survivalEras");

const VIDEO = "https://i.imgur.com/4YkyMKX.mp4";
const WINNER = "https://i.imgur.com/u3M5ZHR.png";
const smallMp4 = Buffer.from("0000ftypisom0000", "ascii");

test("Squigwreck media URLs are configured only on this era", () => {
  const squigwreck = getSurvivalEraDefinition("squigwreck");
  assert.equal(squigwreck.start.videoUrl, VIDEO);
  assert.equal(squigwreck.victory.imageUrl, WINNER);
  assert.equal(getSurvivalEraDefinition("ugly_city").start.videoUrl, undefined);
  assert.equal(validateSquigwreckVideoUrl(VIDEO), true);
  assert.equal(validateSquigwreckVideoUrl("https://example.org/video.mp4"), false);
  assert.equal(MAX_START_VIDEO_BYTES, 10 * 1024 * 1024);
});

test("start video is sent as an MP4 attachment for Discord's native player", async () => {
  const sent = [];
  const channel = { async send(payload) { sent.push(payload); } };
  const result = await sendSquigwreckStartVideo(channel, VIDEO, {
    get: async (url, options) => {
      assert.equal(url, VIDEO);
      assert.equal(options.responseType, "arraybuffer");
      assert.ok(options.timeout <= 10_000);
      return { data: smallMp4 };
    },
    Attachment: class {
      constructor(data, opts) { this.data = data; this.name = opts.name; }
    },
    logger: { warn() { throw new Error("Did not expect a fallback"); } },
  });
  assert.equal(result.delivery, "attachment");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].files[0].name, START_VIDEO_FILENAME);
  assert.deepEqual(sent[0].files[0].data, smallMp4);
});

test("start video falls back to URL if Imgur cannot be fetched", async () => {
  const sent = [];
  const result = await sendSquigwreckStartVideo(
    { async send(payload) { sent.push(payload); } },
    VIDEO,
    { get: async () => { throw new Error("Unavailable"); }, logger: { warn() {} } }
  );
  assert.equal(result.delivery, "link");
  assert.deepEqual(sent, [{ content: VIDEO }]);
});

test("invalid HTML and oversized uploads cannot be attached", async () => {
  for (const data of [Buffer.from("<html>Not a video</html>"), Buffer.alloc(MAX_START_VIDEO_BYTES + 1)]) {
    const sent = [];
    const result = await sendSquigwreckStartVideo(
      { async send(payload) { sent.push(payload); } },
      VIDEO,
      { get: async () => ({ data }), logger: { warn() {} } }
    );
    assert.equal(result.delivery, "link");
    assert.deepEqual(sent, [{ content: VIDEO }]);
  }
});

test("fallback failure doesn't abort the Survival game", async () => {
  const result = await sendSquigwreckStartVideo(
    { async send() { throw new Error("Discord unavailable"); } },
    VIDEO,
    { get: async () => ({ data: smallMp4 }), Attachment: class { constructor() {} },
      logger: { warn() {}, error() {} } }
  );
  assert.equal(result.delivery, "unavailable");
});
