const { imageStore } = require("./imageStore");

const SURVIVAL_IMAGE_APPROVAL_CHANNEL_ID =
  process.env.SURVIVAL_IMAGE_APPROVAL_CHANNEL_ID || "1334884237727240267";

function log(...args) {
  console.log("[GAUNTLET:APPROVALS]", ...args);
}

function buildApprovalMessage(notification) {
  return [
    "✅ **Squig Survival image approved**",
    `Creator: <@${notification.discord_user_id}> (${notification.discord_username})`,
    `Era: \`${notification.era_key}\``,
    `Reward: **${notification.reward_points} $CHARM**`,
    `Approved by: ${notification.approved_by || "Staff"}`,
    `Image: ${notification.image_url}`,
  ].join("\n");
}

async function processApprovalNotifications(client) {
  if (!client || !SURVIVAL_IMAGE_APPROVAL_CHANNEL_ID) return;

  while (true) {
    const notification = await imageStore.claimNextApprovalNotification();
    if (!notification) return;

    try {
      const channel = await client.channels.fetch(
        SURVIVAL_IMAGE_APPROVAL_CHANNEL_ID
      );
      if (!channel || !channel.send) {
        throw new Error("Approval channel is not accessible.");
      }

      const sent = await channel.send(buildApprovalMessage(notification));
      await imageStore.markApprovalNotificationPosted(
        notification.id,
        sent?.id || null
      );
    } catch (err) {
      await imageStore.markApprovalNotificationFailed(
        notification.id,
        err?.message || err
      );
      log(
        `Approval notification ${notification.id} failed:`,
        err?.message || err
      );
      return;
    }
  }
}

function startApprovalNotificationLoop(client) {
  if (!client || !SURVIVAL_IMAGE_APPROVAL_CHANNEL_ID) return null;

  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await processApprovalNotifications(client);
    } catch (err) {
      log("Approval notification loop failed:", err?.message || err);
    } finally {
      running = false;
    }
  };

  run().catch(() => {});
  const intervalMs = Math.max(
    5_000,
    Number(process.env.SURVIVAL_IMAGE_APPROVAL_POLL_MS || "15000")
  );
  const timer = setInterval(run, intervalMs);
  if (timer.unref) timer.unref();
  log(
    `Approval notification loop active for channel ${SURVIVAL_IMAGE_APPROVAL_CHANNEL_ID} every ${intervalMs}ms.`
  );
  return timer;
}

module.exports = {
  SURVIVAL_IMAGE_APPROVAL_CHANNEL_ID,
  processApprovalNotifications,
  startApprovalNotificationLoop,
};
