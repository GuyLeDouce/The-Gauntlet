// src/soloGauntlet.js
// Solo-mode Gauntlet controller: commands, buttons, and ephemeral game flow.

const {
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require("discord.js");

const {
  TOKEN,
  CLIENT_ID,
  GUILD_IDS,
  AUTHORIZED_ADMINS,
  GAUNTLET_PLAY_REWARD,
  torontoDateStr,
  currentMonthStr,
  nextTorontoMidnight,
  withScore,
} = require("./utils");

const { Store } = require("./db");
const {
  miniGameLorePool,
  miniGameFateDescriptions,
  pointFlavors,
  pickMiniGame,
  pickRiddle,
} = require("./gameData");

// ?? Group mode command + handler
const {
  groupGauntletCommand,
  handleGroupInteractionCreate,
} = require("./groupGauntlet");

const { runSurvival, buildPodiumImage } = require("./survival");
const { SURVIVAL_ERAS, getSurvivalEraDefinition } = require("./survivalEras");
const { rewardCharmAmount, logCharmReward } = require("./drip");
const { imageStore } = require("./imageStore");
const { survivalStore } = require("./survivalStore");

// --------------------------------------------
// Small helpers
// --------------------------------------------
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function buildDisplayNameMap(client, guildId, userIds) {
  const map = new Map();
  const unique = Array.from(new Set(userIds || [])).filter(Boolean);
  if (!unique.length) return map;

  let guild = null;
  if (guildId) {
    try {
      guild = await client.guilds.fetch(guildId);
    } catch {
      guild = null;
    }
  }

  if (guild) {
    try {
      const members = await guild.members.fetch({ user: unique });
      for (const [id, member] of members) {
        const name =
          member.nickname ||
          member.user.displayName ||
          member.user.globalName ||
          member.user.username ||
          `User-${id}`;
        map.set(id, name);
      }
    } catch {
      for (const id of unique) {
        if (map.has(id)) continue;
        try {
          const member = await guild.members.fetch(id);
          const name =
            member.nickname ||
            member.user.displayName ||
            member.user.globalName ||
            member.user.username ||
            `User-${id}`;
          map.set(id, name);
        } catch {}
      }
    }
  }

  for (const id of unique) {
    if (map.has(id)) continue;
    try {
      const user = await client.users.fetch(id);
      const name =
        user.displayName || user.globalName || user.username || `User-${id}`;
      map.set(id, name);
    } catch {
      map.set(id, `User-${id}`);
    }
  }

  return map;
}

// --------------------------------------------
// Survival lobby state (single instance)
// --------------------------------------------
let survivalLobby = null;
let survivalStandardSettings = null;
const survivalConfigSessions = new Map();
const SURVIVAL_BASE_POOL_INCREMENT = 50;
const SURVIVAL_REPLAY_DELAY_MS = 10_000;
const SURVIVAL_ROLE_PING = "<@&1389076094245671002>";

const SURVIVAL_TYPE_LABELS = {
  team_start: "Team Start",
  timed: "Timed",
};

const SURVIVAL_ERA_LABELS = Object.fromEntries(
  Object.entries(SURVIVAL_ERAS).map(([key, era]) => [key, era.label])
);

function formatSurvivalMultiplier(value) {
  const n = Number(value || 1);
  if (!Number.isFinite(n)) return "1x";
  return `${parseFloat(n.toFixed(2))}x`;
}

function normalizeSurvivalSettings(raw = {}) {
  const type = raw?.type === "timed" ? "timed" : "team_start";
  const requestedEraKey =
    typeof raw?.era_key === "string" && raw.era_key.trim()
      ? raw.era_key.trim()
      : null;
  const requestedEraLabel =
    typeof raw?.era === "string" && raw.era.trim() ? raw.era.trim() : null;
  const matchedEraByLabel = requestedEraLabel
    ? Object.entries(SURVIVAL_ERA_LABELS).find(
        ([, label]) => label.toLowerCase() === requestedEraLabel.toLowerCase()
      )?.[0]
    : null;
  const eraKey = SURVIVAL_ERAS[requestedEraKey]
    ? requestedEraKey
    : matchedEraByLabel || "day_one";
  const eraDefinition = getSurvivalEraDefinition(eraKey);
  const timeMinutes = Math.max(1, Number(raw?.time_minutes || raw?.minutes || 5) || 5);
  const bonusRequiredPlayers = Math.max(
    1,
    Number(raw?.bonus_required_players || raw?.bonus_required || 10) || 10
  );
  const rawBonusMultiplier =
    raw?.bonus_multiplier === null || raw?.bonus_multiplier === undefined
      ? 1.5
      : Number(raw.bonus_multiplier);
  const bonusMultiplier =
    Number.isFinite(rawBonusMultiplier) && rawBonusMultiplier >= 1
      ? Number(rawBonusMultiplier.toFixed(2))
      : 1.5;

  return {
    type,
    era_key: eraKey,
    era: eraDefinition.label,
    time_minutes: timeMinutes,
    bonus_active: Boolean(raw?.bonus_active),
    bonus_required_players: bonusRequiredPlayers,
    bonus_multiplier: bonusMultiplier,
    replay: Boolean(raw?.replay),
    pool_increment:
      Math.max(1, Number(raw?.pool_increment || SURVIVAL_BASE_POOL_INCREMENT) || 1) ||
      SURVIVAL_BASE_POOL_INCREMENT,
  };
}

function cloneSurvivalSettings(settings) {
  return normalizeSurvivalSettings(settings);
}

async function getSurvivalStandardSettings(forceRefresh = false) {
  if (!forceRefresh && survivalStandardSettings) {
    return cloneSurvivalSettings(survivalStandardSettings);
  }

  try {
    const saved = await Store.getSurvivalSettings();
    survivalStandardSettings = normalizeSurvivalSettings(saved || {});
  } catch {
    survivalStandardSettings = normalizeSurvivalSettings();
  }

  return cloneSurvivalSettings(survivalStandardSettings);
}

async function saveSurvivalStandardSettings(settings) {
  const normalized = normalizeSurvivalSettings(settings);
  survivalStandardSettings = normalized;
  await Store.upsertSurvivalSettings(normalized);
  return cloneSurvivalSettings(normalized);
}

function buildSurvivalMenuEmbed(standardSettings, note = null) {
  const settings = normalizeSurvivalSettings(standardSettings);
  const lines = [
    "Use this hidden panel to start a Survival lobby or change the saved standard setup.",
    "",
    `Active lobby: **${survivalLobby ? "Yes" : "No"}**`,
    `Standard Type: **${SURVIVAL_TYPE_LABELS[settings.type]}**`,
    `Standard Era: **${settings.era}**`,
    `Standard Bonus: **${
      settings.bonus_active
        ? `${formatSurvivalMultiplier(settings.bonus_multiplier)} at ${settings.bonus_required_players}+ players`
        : "Off"
    }**`,
    `Standard Replay: **${settings.replay ? "Yes" : "No"}**`,
  ];

  if (note) {
    lines.push("", note);
  }

  return new EmbedBuilder()
    .setTitle("Squig Survival - Hidden Menu")
    .setDescription(lines.join("\n"))
    .setColor(0x9b59b6);
}

function buildSurvivalMenuComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("survive:menu:play-standard")
        .setLabel("Play Standard")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("survive:menu:play-custom")
        .setLabel("Play Custom")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("survive:menu:set-standard")
        .setLabel("Set Standard")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function buildSurvivalSettingsEmbed(mode, settings, note = null) {
  const cfg = normalizeSurvivalSettings(settings);
  const lines = [
    `Mode: **${mode === "standard" ? "Set Standard" : "Play Custom"}**`,
    "",
    `Type: **${SURVIVAL_TYPE_LABELS[cfg.type]}**`,
    `Era: **${cfg.era}**`,
    `Time: **${cfg.type === "timed" ? `${cfg.time_minutes} minute(s)` : "N/A (Team Start)" }**`,
    `Bonus Active: **${cfg.bonus_active ? "Y" : "N"}**`,
    `Bonus Rq'd: **${cfg.bonus_active ? cfg.bonus_required_players : "N/A"}**`,
    `Bonus Multiplier: **${
      cfg.bonus_active ? formatSurvivalMultiplier(cfg.bonus_multiplier) : "N/A"
    }**`,
    `Replay: **${cfg.replay ? "Y" : "N"}**`,
  ];

  if (note) {
    lines.push("", note);
  }

  return new EmbedBuilder()
    .setTitle("Squig Survival - Game Settings")
    .setDescription(lines.join("\n"))
    .setColor(0x3498db);
}

function buildSurvivalSettingsComponents(mode, settings) {
  const cfg = normalizeSurvivalSettings(settings);
  const presetMultipliers = [1.5, 2, 2.5];

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("survive:config:type")
        .setLabel("Type")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("survive:config:era")
        .setLabel("Era")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("survive:config:time")
        .setLabel("Time")
        .setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("survive:config:bonus-active")
        .setLabel("Bonus Active")
        .setStyle(cfg.bonus_active ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("survive:config:bonus-req")
        .setLabel("Bonus Rq'd")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!cfg.bonus_active),
      new ButtonBuilder()
        .setCustomId("survive:config:replay")
        .setLabel("Replay")
        .setStyle(cfg.replay ? ButtonStyle.Success : ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      ...presetMultipliers.map((value) =>
        new ButtonBuilder()
          .setCustomId(`survive:config:bonus-mult:${value}`)
          .setLabel(`${value}x`)
          .setStyle(
            cfg.bonus_active && cfg.bonus_multiplier === value
              ? ButtonStyle.Success
              : ButtonStyle.Secondary
          )
          .setDisabled(!cfg.bonus_active)
      ),
      new ButtonBuilder()
        .setCustomId("survive:config:bonus-mult:custom")
        .setLabel("Custom")
        .setStyle(
          cfg.bonus_active && !presetMultipliers.includes(cfg.bonus_multiplier)
            ? ButtonStyle.Success
            : ButtonStyle.Secondary
        )
        .setDisabled(!cfg.bonus_active)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("survive:config:save")
        .setLabel(mode === "standard" ? "Save Standard" : "Start Custom")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("survive:config:cancel")
        .setLabel("Back")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function buildSurvivalLobbyAnnouncement(settings, isReplay = false) {
  const cfg = normalizeSurvivalSettings(settings);
  const parts = [
    `${SURVIVAL_ROLE_PING} ${isReplay ? "Squig Survival replay lobby is open!" : "Squig Survival is open!"}`,
    "Click **Join** on the panel above to hop in.",
  ];

  if (cfg.bonus_active) {
    parts.push(
      `Bonus is live at **${cfg.bonus_required_players}+** players for **${formatSurvivalMultiplier(
        cfg.bonus_multiplier
      )}** total prize pool.`
    );
  }

  return parts.join(" ");
}

async function persistSurvivalLobby(lobby) {
  try {
    await Store.upsertSurvivalLobby(lobby);
  } catch {}
}

function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function buildSurvivalLobbyEmbed(settings, count, countdownMs) {
  const cfg = normalizeSurvivalSettings(settings);
  const lines = [
    "Click **Join** to enter **Squig Survival**.",
    "Try out life as a Squig stumbling through Earth.",
    "",
    `Prize pool: **+${cfg.pool_increment} $CHARM** per Squig`,
    `Type: **${SURVIVAL_TYPE_LABELS[cfg.type]}**`,
    `Era: **${cfg.era}**`,
    ...(cfg.type === "timed"
      ? [`Time: **${cfg.time_minutes} minute(s)**`]
      : []),
    ...(cfg.bonus_active
      ? [
          `Bonus: **${formatSurvivalMultiplier(
            cfg.bonus_multiplier
          )}** total prize pool at **${cfg.bonus_required_players}+** players`,
        ]
      : []),
    ...(typeof countdownMs === "number"
      ? [`Auto-start in: **${formatCountdown(countdownMs)}**`]
      : []),
    "",
    `Players joined: **${count}**`,
    "",
    "When staff run **/survivestart**, the portal snaps shut.",
  ];

  return new EmbedBuilder()
    .setTitle("Squig Survival - Lobby Open")
    .setImage("https://i.imgur.com/DGLFFyh.jpeg")
    .setDescription(lines.join("\n"))
    .setColor(0x9b59b6);
}

function clearSurvivalLobby() {
  if (survivalLobby?.collector) {
    try {
      survivalLobby.collector.stop("cleared");
    } catch {}
  }
  if (survivalLobby?.countdownInterval) {
    clearInterval(survivalLobby.countdownInterval);
  }
  if (survivalLobby?.countdownTimers?.length) {
    survivalLobby.countdownTimers.forEach((t) => clearTimeout(t));
  }
  survivalLobby = null;
  try {
    Store.clearSurvivalLobby().catch(() => {});
  } catch {}
}

function buildLobbyJumpButton(guildId, channelId, messageId) {
  if (!guildId || !channelId || !messageId) return null;
  const url = `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Back to Lobby")
      .setURL(url)
  );
}

async function openSurvivalLobby(channel, createdBy, settings, options = {}) {
  if (survivalLobby) {
    return {
      ok: false,
      reason:
        "A /survive lobby is already active. Use /survivestart to begin or end/cancel it.",
    };
  }

  if (!channel) {
    return { ok: false, reason: "Can't find channel for this command." };
  }

  const cfg = normalizeSurvivalSettings(settings);
  const countdownEnd =
    cfg.type === "timed" ? Date.now() + cfg.time_minutes * 60_000 : null;
  const joinEmbed = buildSurvivalLobbyEmbed(
    cfg,
    0,
    countdownEnd ? countdownEnd - Date.now() : undefined
  );

  const joinRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("survive:join")
      .setLabel("Join")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("survive:leave")
      .setLabel("Leave")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("survive:list")
      .setLabel("Players Joined")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("survive:stats")
      .setLabel("My Stats")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("survive:info")
      .setLabel("Info")
      .setStyle(ButtonStyle.Secondary)
  );

  const joinMessage = await channel.send({
    embeds: [joinEmbed],
    components: [joinRow],
  });

  try {
    await channel.send(
      buildSurvivalLobbyAnnouncement(cfg, Boolean(options?.isReplay))
    );
  } catch {}

  survivalLobby = {
    created_by: createdBy || null,
    created_at: new Date().toISOString(),
    joined: new Set(),
    game_status: "lobby",
    channel_id: channel.id,
    guild_id: channel.guildId,
    join_message_id: joinMessage.id,
    join_message: joinMessage,
    era: cfg.era,
    pool_increment: cfg.pool_increment,
    countdown_end: countdownEnd,
    countdownInterval: null,
    countdownTimers: [],
    collector: null,
    settings: cfg,
  };

  await persistSurvivalLobby(survivalLobby);
  setupSurvivalCountdown(survivalLobby, channel);

  return { ok: true, lobby: survivalLobby };
}

function setupSurvivalCountdown(lobby, channel) {
  if (!lobby?.countdown_end) return;
  const totalMs = lobby.countdown_end - Date.now();
  if (totalMs <= 0) {
    setTimeout(() => {
      if (!survivalLobby || survivalLobby.game_status !== "lobby") return;
      startSurvivalFromLobby(null, survivalLobby);
    }, 250);
    return;
  }

  const totalSec = Math.max(1, Math.floor(totalMs / 1000));
  const finalPingSec = totalSec / 3 < 30 ? 10 : 30;
  const pingTimes = [
    Math.floor((totalSec * 2) / 3),
    Math.floor(totalSec / 3),
    finalPingSec,
  ];
  const uniquePingTimes = Array.from(new Set(pingTimes))
    .filter((s) => s > 0 && s < totalSec)
    .sort((a, b) => b - a);

  const jumpRow = buildLobbyJumpButton(
    lobby.guild_id,
    lobby.channel_id,
    lobby.join_message_id
  );

  uniquePingTimes.forEach((remainingSec) => {
    const delayMs = Math.max(0, (totalSec - remainingSec) * 1000);
    const t = setTimeout(async () => {
      if (!survivalLobby || survivalLobby.game_status !== "lobby") return;
      const msg = `⏳ Squig Survival starts in **${formatCountdown(
        remainingSec * 1000
      )}**.`;
      try {
        await channel.send(
          jumpRow ? { content: msg, components: [jumpRow] } : { content: msg }
        );
      } catch {}
    }, delayMs);
    lobby.countdownTimers.push(t);
  });

  const autoStartTimer = setTimeout(async () => {
    if (!survivalLobby || survivalLobby.game_status !== "lobby") return;
    await startSurvivalFromLobby(null, survivalLobby);
  }, totalMs);
  lobby.countdownTimers.push(autoStartTimer);

  lobby.countdownInterval = setInterval(async () => {
    if (!survivalLobby || survivalLobby.game_status !== "lobby") return;
    const remaining = lobby.countdown_end - Date.now();
    if (remaining <= 0) return;
    try {
      const updated = buildSurvivalLobbyEmbed(
        lobby.settings || { era: lobby.era, pool_increment: lobby.pool_increment },
        lobby.joined.size,
        remaining
      );
      await lobby.join_message.edit({ embeds: [updated] });
    } catch {}
  }, 15_000);
}

async function initSurvivalLobby(client) {
  try {
    const saved = await Store.getSurvivalLobby();
    if (!saved || saved.game_status !== "lobby") {
      if (saved) {
        await Store.clearSurvivalLobby();
      }
      return;
    }

    const channel = await client.channels.fetch(saved.channel_id).catch(() => null);
    if (!channel) {
      await Store.clearSurvivalLobby();
      return;
    }

    const joinMessage = await channel.messages
      .fetch(saved.join_message_id)
      .catch(() => null);
    if (!joinMessage) {
      await Store.clearSurvivalLobby();
      return;
    }

    let joinedIds = saved.joined_ids || [];
    if (typeof joinedIds === "string") {
      try {
        joinedIds = JSON.parse(joinedIds);
      } catch {
        joinedIds = [];
      }
    }

    const countdownEnd = saved.countdown_end
      ? new Date(saved.countdown_end).getTime()
      : null;

    survivalLobby = {
      created_by: saved.created_by,
      created_at: saved.created_at,
      joined: new Set(Array.isArray(joinedIds) ? joinedIds : []),
      game_status: "lobby",
      channel_id: saved.channel_id,
      guild_id: saved.guild_id,
      join_message_id: saved.join_message_id,
      join_message: joinMessage,
      era: saved.era,
      pool_increment: saved.pool_increment || SURVIVAL_BASE_POOL_INCREMENT,
      countdown_end: countdownEnd,
      countdownInterval: null,
      countdownTimers: [],
      collector: null,
      settings: normalizeSurvivalSettings(
        saved.settings || {
          era: saved.era,
          pool_increment: saved.pool_increment || SURVIVAL_BASE_POOL_INCREMENT,
          type: countdownEnd ? "timed" : "team_start",
        }
      ),
    };

    const remaining = countdownEnd ? countdownEnd - Date.now() : undefined;
    const updated = buildSurvivalLobbyEmbed(
      survivalLobby.settings,
      survivalLobby.joined.size,
      remaining
    );
    await joinMessage.edit({ embeds: [updated] });

    setupSurvivalCountdown(survivalLobby, channel);
  } catch {}
}

async function startSurvivalFromLobby(interaction, lobby) {
  if (!lobby || lobby.game_status !== "lobby") return;
  lobby.game_status = "running";
  try {
    Store.clearSurvivalLobby().catch(() => {});
  } catch {}
  if (lobby.collector) {
    try {
      lobby.collector.stop("start");
    } catch {}
  }
  if (lobby.countdownInterval) {
    clearInterval(lobby.countdownInterval);
    lobby.countdownInterval = null;
  }
  if (lobby.countdownTimers?.length) {
    lobby.countdownTimers.forEach((t) => clearTimeout(t));
    lobby.countdownTimers = [];
  }

  const players = Array.from(lobby.joined || []);
  const settings = normalizeSurvivalSettings(
    lobby.settings || {
      era: lobby.era,
      pool_increment: lobby.pool_increment || SURVIVAL_BASE_POOL_INCREMENT,
      type: lobby.countdown_end ? "timed" : "team_start",
    }
  );
  const shouldReplay = Boolean(settings.replay);
  const replaySettings = cloneSurvivalSettings({
    ...settings,
    replay: false,
  });
  const replayCreatedBy = lobby.created_by;
  const channel =
    interaction?.client?.channels?.cache?.get(lobby.channel_id) ||
    lobby?.join_message?.channel ||
    interaction?.channel;

  if (!channel) {
    clearSurvivalLobby();
    if (interaction) {
      return interaction.reply({
        content: "❌ Can't find the Survival lobby channel.",
        flags: 64,
      });
    }
    return;
  }

  if (players.length === 0) {
    clearSurvivalLobby();
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("Squig Survival - Cancelled")
          .setDescription(
            "No Squigs stepped through the portal. The universe shrugs and goes back to scrolling X."
          )
          .setColor(0xe74c3c),
      ],
    });
    if (interaction) {
      return interaction.reply({
        content: "No players joined. Lobby cancelled.",
        flags: 64,
      });
    }
    return;
  }

  if (interaction) {
    await interaction.reply({
      content: "Squig Survival starting.",
      flags: 64,
    });
  }
  await channel.send("Game starting now.");

  const startEmbed = new EmbedBuilder()
    .setTitle("Squig Survival - Game Starting!")
    .setDescription(
      [
        `The portal snaps shut. **${players.length} Squigs** are now loose on Earth.`,
        "Sit back and watch who survives the chaos...",
      ].join("\n")
    )
    .setImage("http://gifs.squigs.io/gifs/v-bullish-fly.gif")
    .setColor(0x2ecc71);

  await channel.send({ embeds: [startEmbed] });

  try {
    await runSurvival(channel, players, settings);
  } finally {
    clearSurvivalLobby();
  }

  if (shouldReplay) {
    const replayTimer = setTimeout(async () => {
      const result = await openSurvivalLobby(
        channel,
        replayCreatedBy,
        replaySettings,
        { isReplay: true }
      );
      if (!result.ok) {
        try {
          await channel.send(
            "Replay lobby did not reopen because another Squig Survival lobby is already active."
          );
        } catch {}
      }
    }, SURVIVAL_REPLAY_DELAY_MS);
    if (replayTimer?.unref) replayTimer.unref();
  }
}


async function sendEphemeral(interaction, payload) {
  const { noExpire, ...rest } = payload;
  let msg;

  const base = { ...rest, flags: 64 }; // 64 = EPHEMERAL

  if (interaction.deferred || interaction.replied) {
    // followUp *does* return a Message
    msg = await interaction.followUp(base);
  } else {
    // reply returns void ? fetchReply to get the Message
    await interaction.reply(base);
    msg = await interaction.fetchReply();
  }

  if (!noExpire) {
    setTimeout(async () => {
      try {
        await msg.delete();
      } catch {}
    }, 60_000);
  }
  return msg;
}

async function ephemeralPrompt(interaction, embed, components, timeMs) {
  const msg = await sendEphemeral(interaction, { embeds: [embed], components });
  const picked = await msg
    .awaitMessageComponent({ componentType: ComponentType.Button, time: timeMs })
    .catch(() => null);

  try {
    const rows = (components || []).map((row) =>
      new ActionRowBuilder().addComponents(
        row.components.map((b) => ButtonBuilder.from(b).setDisabled(true))
      )
    );
    await msg.edit({ components: rows });
  } catch {}

  return picked;
}

// --------------------------------------------
// MINI-GAME / RIDDLE RUNNERS (ephemeral, solo)
// --------------------------------------------
async function runMiniGameEphemeral(interaction, player, usedMini) {
  const selected = pickMiniGame(usedMini);

  const embed = withScore(
    new EmbedBuilder()
      .setTitle(selected.title)
      .setDescription(
        `${selected.lore}\n\n_${rand(
          miniGameFateDescriptions
        )}_\n\n⏳ You have **30 seconds** to choose.`
      )
      .setColor(0xff33cc),
    player
  );
  if (selected.image) embed.setImage(selected.image);

  const row = new ActionRowBuilder().addComponents(
    selected.buttons.map((label, i) =>
      new ButtonBuilder()
        .setCustomId(`mg:${Date.now()}:${i}`)
        .setLabel(label)
        .setStyle(
          [ButtonStyle.Primary, ButtonStyle.Danger, ButtonStyle.Secondary, ButtonStyle.Success][
            i % 4
          ]
        )
    )
  );

  const click = await ephemeralPrompt(interaction, embed, [row], 30_000);
  if (!click) {
    await sendEphemeral(interaction, { content: "⏳ Time’s up — no choice, no change." });
    return;
  }

  const delta = rand([-2, -1, 1, 2]);
  player.points += delta;

  const flavorList = pointFlavors[delta > 0 ? `+${delta}` : `${delta}`] || [];
  const flavor = flavorList.length ? rand(flavorList) : "";

  await click.reply({
    content: `You chose **${click.component.label}** — **${
      delta > 0 ? "+" : ""
    }${delta}**. ${flavor}\n**New total:** ${player.points}`,
    flags: 64,
  });
}

async function runRiddleEphemeral(interaction, player, usedRiddle) {
  const r = pickRiddle(usedRiddle);
  if (!r) {
    await sendEphemeral(interaction, { content: "⚠️ No riddles left. Skipping." });
    return;
  }

  const difficultyLabel =
    r.difficulty === 1
      ? "EASY"
      : r.difficulty === 2
      ? "MEDIUM"
      : r.difficulty === 3
      ? "HARD"
      : "SQUIG SPECIAL";

  const embed = withScore(
    new EmbedBuilder()
      .setTitle("🧩 RIDDLE TIME")
      .setDescription(
        `_${r.riddle}_\n\n🧠 Difficulty: **${difficultyLabel}** — Worth **+${r.difficulty}**.\n⏳ You have **30 seconds**.`
      )
      .setColor(0xff66cc),
    player
  );

  const answerRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("riddle:answer").setLabel("Answer").setStyle(ButtonStyle.Primary)
  );

  const riddleMsg = await sendEphemeral(interaction, {
    embeds: [embed],
    components: [answerRow],
    noExpire: true,
  });

  const totalWindowMs = 30_000;
  const endAt = Date.now() + totalWindowMs;

  let buttonClick = null;
  try {
    buttonClick = await riddleMsg.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: totalWindowMs,
      filter: (i) =>
        i.customId === "riddle:answer" && i.user.id === interaction.user.id,
    });
  } catch {
    /* timeout */
  }

  try {
    const disabled = new ActionRowBuilder().addComponents(
      answerRow.components.map((b) => ButtonBuilder.from(b).setDisabled(true))
    );
    await riddleMsg.edit({ components: [disabled] });
  } catch {}

  if (!buttonClick) {
    await sendEphemeral(interaction, {
      content: `⏳ Time’s up! Correct answer: **${r.answers[0]}**.`,
    });
    setTimeout(async () => {
      try {
        await riddleMsg.delete();
      } catch {}
    }, 1_000);
    return;
  }

  const remaining = Math.max(1_000, endAt - Date.now());

  // Modal with riddle shown as placeholder
  const modal = new ModalBuilder().setCustomId("riddle:modal").setTitle("Riddle Answer");

  // Discord placeholder max ~100 chars – truncate if needed
  const displayRiddle = r.riddle.length > 100 ? r.riddle.slice(0, 97) + "..." : r.riddle;

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("riddle:input")
        .setLabel("Your answer")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder(displayRiddle) // riddle reminder
    )
  );

  try {
    await buttonClick.showModal(modal);
  } catch {
    /* ignore */
  }

  let submit = null;
  try {
    submit = await buttonClick.awaitModalSubmit({
      time: remaining,
      filter: (i) =>
        i.customId === "riddle:modal" && i.user.id === interaction.user.id,
    });
  } catch {
    /* timeout */
  }

  if (!submit) {
    await sendEphemeral(interaction, {
      content: `⏳ No answer submitted. Correct: **${r.answers[0]}**.`,
    });
    setTimeout(async () => {
      try {
        await riddleMsg.delete();
      } catch {}
    }, 1_000);
    return;
  }

  const ans = submit.fields.getTextInputValue("riddle:input").trim().toLowerCase();
  const correct = r.answers.map((a) => a.toLowerCase()).includes(ans);

  try {
    if (correct) {
      player.points += r.difficulty;
      await submit.reply({
        content: `✅ Correct! **+${r.difficulty}**. **Current total:** ${player.points}`,
        flags: 64,
      });
    } else {
      await submit.reply({
        content: `❌ Not quite. Correct: **${r.answers[0]}**.\n**Current total:** ${player.points}`,
        flags: 64,
      });
    }
  } catch {
    await sendEphemeral(interaction, {
      content: correct
        ? `✅ Correct! **+${r.difficulty}**. **Current total:** ${player.points}`
        : `❌ Not quite. Correct: **${r.answers[0]}**.\n**Current total:** ${player.points}`,
    });
  }

  setTimeout(async () => {
    try {
      await riddleMsg.delete();
    } catch {}
  }, 1_000);
}

async function runLabyrinthEphemeral(interaction, player) {
  const title = "🧭 The Labyrinth of Wrong Turns";
  const dirPairs = [
    ["Left", "Right"],
    ["Up", "Down"],
    ["Left", "Down"],
    ["Right", "Up"],
  ];
  const correctPath = Array.from({ length: 4 }, (_, i) =>
    rand(dirPairs[i % dirPairs.length])
  );

  await sendEphemeral(interaction, {
    embeds: [
      withScore(
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(
            "Find the exact **4-step** path.\n➕ Each step **+1**, 🗝️ escape **+2**.\n⏳ **60s** total."
          )
          .setColor(0x7f00ff)
          .setImage("https://i.imgur.com/MA1CdEC.jpeg"),
        player
      ),
    ],
  });

  let step = 0,
    earned = 0,
    alive = true;
  const deadline = Date.now() + 60_000;

  while (alive && step < 4) {
    const pair = dirPairs[step % dirPairs.length];
    const row = new ActionRowBuilder().addComponents(
      pair.map((d, i) =>
        new ButtonBuilder()
          .setCustomId(`lab:${step}:${i}`)
          .setLabel(d)
          .setStyle(ButtonStyle.Primary)
      )
    );

    const msg = await sendEphemeral(interaction, {
      content: `Labyrinth step **${step + 1}** — choose:`,
      components: [row],
    });

    const timeLeft = Math.max(0, deadline - Date.now());

    const click = await msg
      .awaitMessageComponent({
        componentType: ComponentType.Button,
        time: timeLeft,
      })
      .catch(() => null);

    try {
      await msg.edit({
        components: [
          new ActionRowBuilder().addComponents(
            row.components.map((b) => ButtonBuilder.from(b).setDisabled(true))
          ),
        ],
      });
    } catch {}

    if (!click) {
      alive = false;
      break;
    }

    const label = click.component.label;
    if (label === correctPath[step]) {
      earned += 1;
      step += 1;
      await click.reply({ content: "✅ Correct step!", flags: 64 });
    } else {
      alive = false;
      await click.reply({ content: "❌ Dead end!", flags: 64 });
    }
  }

  if (step === 4) {
    earned += 2;
    await sendEphemeral(interaction, { content: `🗝️ You escaped! **+${earned}**` });
  } else if (earned > 0) {
    await sendEphemeral(interaction, {
      content: `✅ You managed **${earned}** step${earned === 1 ? "" : "s"}.`,
    });
  } else {
    await sendEphemeral(interaction, {
      content: "☠️ Lost at the first turn. **0**.",
    });
  }

  player.points += earned;
}

async function runRouletteEphemeral(interaction, player) {
  const embed = withScore(
    new EmbedBuilder()
      .setTitle("🎲 Squig Roulette")
      .setDescription(
        "Pick **1–6**. Roll at end. Match = **+2**, else **0**. **30s**."
      )
      .setColor(0x7f00ff)
      .setImage("https://i.imgur.com/BolGW1m.png"),
    player
  );

  const row1 = new ActionRowBuilder().addComponents(
    [1, 2, 3].map((n) =>
      new ButtonBuilder()
        .setCustomId(`rou:${n}`)
        .setLabel(String(n))
        .setStyle(ButtonStyle.Secondary)
    )
  );
  const row2 = new ActionRowBuilder().addComponents(
    [4, 5, 6].map((n) =>
      new ButtonBuilder()
        .setCustomId(`rou:${n}`)
        .setLabel(String(n))
        .setStyle(ButtonStyle.Secondary)
    )
  );

  const msg = await sendEphemeral(interaction, {
    embeds: [embed],
    components: [row1, row2],
  });

  const click = await msg
    .awaitMessageComponent({
      componentType: ComponentType.Button,
      time: 30_000,
    })
    .catch(() => null);

  try {
    const disable = (row) =>
      new ActionRowBuilder().addComponents(
        row.components.map((b) => ButtonBuilder.from(b).setDisabled(true))
      );
    await msg.edit({ components: [disable(row1), disable(row2)] });
  } catch {}

  if (!click) {
    await sendEphemeral(interaction, {
      content: "⏳ No pick. The die rolls away.",
    });
    return;
  }

  const pickNum = Number(click.component.label);
  const rolled = 1 + Math.floor(Math.random() * 6);

  if (pickNum === rolled) {
    player.points += 2;
    await click.reply({
      content: `🎲 You picked **${pickNum}**. Rolled **${rolled}**. **+2**.`,
      flags: 64,
    });
  } else {
    await click.reply({
      content: `You picked **${pickNum}**. Rolled **${rolled}**. No match.`,
      flags: 64,
    });
  }
}

async function runRiskItEphemeral(interaction, player) {
  const embed = withScore(
    new EmbedBuilder()
      .setTitle("🪙 Risk It")
      .setDescription("Risk **All**, **Half**, **Quarter**, or **None**. **20s**.")
      .setColor(0xffaa00)
      .setImage("https://i.imgur.com/GHztzMk.png"),
    player
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("risk:all")
      .setLabel("Risk All")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("risk:half")
      .setLabel("Risk Half")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("risk:quarter")
      .setLabel("Risk Quarter")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("risk:none")
      .setLabel("No Risk")
      .setStyle(ButtonStyle.Success)
  );

  const msg = await sendEphemeral(interaction, {
    embeds: [embed],
    components: [row],
  });

  const click = await msg
    .awaitMessageComponent({
      componentType: ComponentType.Button,
      time: 20_000,
    })
    .catch(() => null);

  try {
    await msg.edit({
      components: [
        new ActionRowBuilder().addComponents(
          row.components.map((b) => ButtonBuilder.from(b).setDisabled(true))
        ),
      ],
    });
  } catch {}

  if (!click) {
    await sendEphemeral(interaction, {
      content: "⏳ No decision — charm moves on.",
    });
    return;
  }

  const pts = Math.floor(player.points || 0);
  if (click.customId === "risk:none" || pts <= 0) {
    await click.reply({
      content: pts <= 0 ? "You have no points to risk." : "Sitting out.",
      flags: 64,
    });
    return;
  }

  let stake = 0;
  let label = "";

  if (click.customId === "risk:all") {
    stake = pts;
    label = "Risk All";
  }
  if (click.customId === "risk:half") {
    stake = Math.max(1, Math.floor(pts / 2));
    label = "Risk Half";
  }
  if (click.customId === "risk:quarter") {
    stake = Math.max(1, Math.floor(pts / 4));
    label = "Risk Quarter";
  }

  const outcomes = [
    { mult: -1, label: "💀 Lost it all" },
    { mult: 0, label: "😐 Broke even" },
    { mult: 0.5, label: "✨ Won 1.5×" },
    { mult: 1, label: "💰 Doubled" },
  ];

  const out = rand(outcomes);
  const delta = out.mult === -1 ? -stake : Math.round(stake * out.mult);
  player.points += delta;

  await click.reply({
    content: `${label} — ${out.label}. **${
      delta > 0 ? "+" : ""
    }${delta}**. New total: **${player.points}**`,
    flags: 64,
  });
}

// --------------------------------------------
// SOLO ORCHESTRATOR (6 rounds + store)
// --------------------------------------------
async function runSoloGauntletEphemeral(interaction) {
  const player = {
    id: interaction.user.id,
    username:
      interaction.user.username ||
      interaction.user.globalName ||
      "Player",
    points: 0,
  };

  const usedRiddle = new Set();
  const usedMini = new Set();

  await sendEphemeral(interaction, {
    embeds: [
      withScore(
        new EmbedBuilder()
        .setTitle("⚔️ The Gauntlet — Solo Mode")
        .setDescription("6 rounds. Brain, luck, chaos. Good luck!")
        .setColor(0x00ccff),
        player
      ),
    ],
  });

  // 1) Mini + Riddle
  await runMiniGameEphemeral(interaction, player, usedMini);
  await runRiddleEphemeral(interaction, player, usedRiddle);

  // 2) Labyrinth
  await runLabyrinthEphemeral(interaction, player);

  // 3) Mini + Riddle
  await runMiniGameEphemeral(interaction, player, usedMini);
  await runRiddleEphemeral(interaction, player, usedRiddle);

  // 4) Squig Roulette
  await runRouletteEphemeral(interaction, player);

  // 5) Mini + Riddle
  await runMiniGameEphemeral(interaction, player, usedMini);
  await runRiddleEphemeral(interaction, player, usedRiddle);

  // 6) Risk It
  await runRiskItEphemeral(interaction, player);

  const final = player.points;
  const flavor =
    final >= 12
      ? "✨ The charm purrs. You wear the static like a crown."
      : final >= 6
      ? "✨ The Squigs nod in approval. You’ll be remembered by at least three of them."
      : final >= 0
      ? "🫡 You survived the weird. The weird survived you."
      : "🕳️ The void learned your name. It may return it later.";

  await sendEphemeral(interaction, {
    embeds: [
      new EmbedBuilder()
        .setTitle("🏁 Your Final Score")
        .setDescription(`**${final}** point${final === 1 ? "" : "s"}`)
        .setFooter({ text: flavor })
        .setColor(0x00ff88),
    ],
    noExpire: true,
  });

  const month = currentMonthStr();
  await Store.insertRun(interaction.user.id, player.username, month, final);
  await Store.recordPlay(interaction.user.id, torontoDateStr());

  try {
    const reward = await rewardCharmAmount({
      userId: interaction.user.id,
      username: player.username,
      amount: GAUNTLET_PLAY_REWARD,
      source: "gauntlet-solo",
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      metadata: { score: final },
      logClient: interaction.client,
      logReason: "Solo Gauntlet completion",
    });
    if (reward?.ok) {
      await logCharmReward(interaction.client, {
        userId: interaction.user.id,
        amount: reward.amount,
        score: final,
        source: "gauntlet-solo",
        channelId: interaction.channelId,
        reason: "Solo Gauntlet completion",
      });
    }
  } catch {}

  try {
    await updateAllLeaderboards(interaction.client, month);
  } catch {}

  return final;
}

// --------------------------------------------
// LEADERBOARD
// --------------------------------------------
async function renderLeaderboardEmbed(month) {
  const rows = await Store.getMonthlyTop(month, 10);
  const lines = rows.length
    ? rows
        .map(
          (r, i) =>
            `**#${i + 1}** ${r.username || `<@${r.user_id}>`} — **${r.best}**`
        )
        .join("\n")
    : "No runs yet.";

  return new EmbedBuilder()
    .setTitle(`🏆 Leaderboard — ${month}`)
    .setDescription(lines)
    .setFooter({
      text: "Ranked by highest single-game score; ties broken by total monthly points.",
    })
    .setColor(0x00ccff);
}

async function renderTotalLeaderboardEmbed(month) {
  const rows = await Store.getMonthlyTopByTotal(month, 10);
  const lines = rows.length
    ? rows
        .map(
          (r, i) =>
            `**#${i + 1}** ${r.username || `<@${r.user_id}>`} — **${r.total}**`
        )
        .join("\n")
    : "No runs yet.";

  return new EmbedBuilder()
    .setTitle(`🏆 Total Points — ${month}`)
    .setDescription(lines)
    .setFooter({
      text: "Ranked by total monthly points; ties broken by best single-game score.",
    })
    .setColor(0x00ccff);
}

async function updateAllLeaderboards(client, month) {
  const entries = await Store.getLbMessages(month);
  if (!entries.length) return;

  const embed = await renderLeaderboardEmbed(month);

  for (const e of entries) {
    try {
      const ch = await client.channels.fetch(e.channel_id);
      const msg = await ch.messages.fetch(e.message_id);
      await msg.edit({ embeds: [embed] });
    } catch {}
  }
}

// --------------------------------------------
// COMMAND REGISTRATION (solo + group combined)
// --------------------------------------------
async function registerCommands() {
  const baseCommands = [
    new SlashCommandBuilder()
      .setName("gauntlet")
      .setDescription("Post the Gauntlet Start Panel in this channel (admins only)."),
    new SlashCommandBuilder()
      .setName("gauntletlb")
      .setDescription("Show the monthly leaderboard (best score per user, totals tie-break).")
      .addStringOption((o) =>
        o
          .setName("month")
          .setDescription("YYYY-MM (default: current)")
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("gauntletrecent")
      .setDescription("Show recent runs this month")
      .addIntegerOption((o) =>
        o
          .setName("limit")
          .setDescription("How many (default 10)")
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("gauntletinfo")
      .setDescription("How Solo Gauntlet works (rounds & rules)."),
    new SlashCommandBuilder()
      .setName("mygauntlet")
      .setDescription("Your current-month stats (best, total, plays)."),

    // Squig Survival command
    new SlashCommandBuilder()
      .setName("survive")
      .setDescription("Open the hidden Squig Survival admin menu."),
    new SlashCommandBuilder()
      .setName("survivestart")
      .setDescription("Start the active Squig Survival lobby."),
    new SlashCommandBuilder()
      .setName("podiumtest")
      .setDescription("Test the Squig Survival podium art (uses your avatar)."),
    new SlashCommandBuilder()
      .setName("adduser")
      .setDescription("Manually map Discord ID to DRIP user ID (admins only).")
      .addStringOption((o) =>
        o
          .setName("discord_id")
          .setDescription("Discord user ID to override")
          .setRequired(true)
      )
      .addStringOption((o) =>
        o
          .setName("drip_user_id")
          .setDescription("DRIP user/member ID from admin panel for direct fallback payout")
          .setRequired(true)
      )
      .addStringOption((o) =>
        o
          .setName("type")
          .setDescription("Which DRIP credential type this value represents")
          .addChoices(
            { name: "drip-id", value: "drip-id" },
            { name: "discord-id", value: "discord-id" },
            { name: "username", value: "username" },
            { name: "id", value: "id" },
            { name: "member-id", value: "member-id" },
            { name: "user-id", value: "user-id" }
          )
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("paytest")
      .setDescription("Run a DRIP payout connectivity test (admins only).")
      .addUserOption((o) =>
        o
          .setName("user")
          .setDescription("Optional user to test payout against (default: you)")
          .setRequired(false)
      )
      .addIntegerOption((o) =>
        o
          .setName("amount")
          .setDescription("Test payout amount (default: 1)")
          .setMinValue(1)
          .setMaxValue(1000)
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("addimage")
      .setDescription("Add a Squig Survival stage image (admins only).")
      .addStringOption((o) =>
        o
          .setName("url")
          .setDescription("Image URL (https)")
          .setRequired(true)
      )
      .addUserOption((o) =>
        o
          .setName("user")
          .setDescription("Optional artist to reward when this image is used.")
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("survivorboard")
      .setDescription("Top Squig Survival winners for the current month."),
    new SlashCommandBuilder()
      .setName("lives")
      .setDescription("Your Squig Survival stats (all-time).")
      .addUserOption((o) =>
        o
          .setName("user")
          .setDescription("Check another Squig's stats")
          .setRequired(false)
      ),
  ];

  // Include the group command definition from groupGauntlet.js
  if (groupGauntletCommand) {
    baseCommands.push(groupGauntletCommand);
  }

  const commands = baseCommands.map((c) => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  if (GUILD_IDS && GUILD_IDS.length) {
    for (const gid of GUILD_IDS) {
      try {
        await rest.put(
          Routes.applicationGuildCommands(CLIENT_ID, gid),
          { body: commands }
        );
        console.log(`[GAUNTLET:CMD] Registered all commands (solo + group) for guild ${gid}`);
      } catch (err) {
        console.error(
          `[GAUNTLET:CMD] Failed to register commands for guild ${gid}:`,
          err.rawError || err
        );
        continue;
      }
    }
  } else {
    try {
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
      console.log("[GAUNTLET:CMD] Registered all commands globally");
    } catch (err) {
      console.error(
        "[GAUNTLET:CMD] Failed to register commands globally:",
        err.rawError || err
      );
    }
  }
}

// --------------------------------------------
// PANEL & ADMIN CHECK
// --------------------------------------------
function startPanelEmbed() {
  return new EmbedBuilder()
    .setTitle("⚔️ The Gauntlet — Solo Mode")
    .setDescription(
      [
        "Click **Start** to play privately via **ephemeral** messages in this channel.",
        "Use **My Stats** for your monthly totals (private) or **Leaderboard** for this month's standings.",
        "You can play **once per day** (Toronto time). Every run is **saved**. Monthly LB shows **best** per user (total points = tiebreaker); **Leaderboard** shows monthly total points.",
        "",
        "**Rounds (6):**",
        "1) MiniGame + Riddle",
        "2) The Labyrinth",
        "3) MiniGame + Riddle",
        "4) Squig Roulette",
        "5) MiniGame + Riddle",
        "6) Risk It",
      ].join("\n")
    )
    .setColor(0xaa00ff)
    .setImage("https://i.imgur.com/MKHosuC.png");
}

function startPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("gauntlet:start")
      .setLabel("Start")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("gauntlet:mystats")
      .setLabel("My Stats")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("gauntlet:leaderboard")
      .setLabel("Leaderboard")
      .setStyle(ButtonStyle.Primary)
  );
}

function isAdminUserLocal(interaction) {
  if (AUTHORIZED_ADMINS.includes(interaction.user.id)) return true;
  const member = interaction.member;
  if (!member || !interaction.inGuild()) return false;
  return (
    member.permissions?.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

// --------------------------------------------
// INTERACTION ROUTER
// --------------------------------------------
async function handleInteractionCreate(interaction) {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      // /groupgauntlet ? group mode
      if (interaction.commandName === "groupgauntlet") {
        await handleGroupInteractionCreate(interaction);
        return;
      }

      // /gauntlet
      if (interaction.commandName === "gauntlet") {
        if (!isAdminUserLocal(interaction)) {
          return interaction.reply({
            content: "⛔ Only admins can post the Gauntlet panel.",
            flags: 64,
          });
        }
        return interaction.reply({
          embeds: [startPanelEmbed()],
          components: [startPanelRow()],
        });
      }

      // /gauntletlb
      if (interaction.commandName === "gauntletlb") {
        await interaction.deferReply();
        const month = interaction.options.getString("month") || currentMonthStr();
        const embed = await renderLeaderboardEmbed(month);
        await interaction.editReply({ embeds: [embed] });
        let sent;
        try {
          sent = await interaction.fetchReply();
        } catch {}
        if (sent) {
          try {
            await Store.upsertLbMessage(
              interaction.guildId,
              interaction.channelId,
              month,
              sent.id
            );
          } catch {}
        }
        return;
      }

      // /gauntletrecent
      if (interaction.commandName === "gauntletrecent") {
        await interaction.deferReply();
        const month = currentMonthStr();
        const limit = interaction.options.getInteger("limit") || 10;
        const rows = await Store.getRecentRuns(month, limit);

        const lines = rows.length
          ? rows
              .map(
                (r) =>
                  `• <@${r.user_id}> — **${r.score}**  _(at ${new Intl.DateTimeFormat(
                    "en-CA",
                    {
                      timeZone: "America/Toronto",
                      month: "short",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  ).format(new Date(r.finished_at))})_`
              )
              .join("\n")
          : "No recent runs.";

        const embed = new EmbedBuilder()
          .setTitle(`🕒 Recent Runs — ${month}`)
          .setDescription(lines)
          .setColor(0x00ccff);

        return interaction.editReply({ embeds: [embed] });
      }

      // /gauntletinfo
      if (interaction.commandName === "gauntletinfo") {
        await interaction.deferReply({ ephemeral: true });
        const embed = new EmbedBuilder()
          .setTitle("📜 Welcome to The Gauntlet — Solo Edition")
          .setDescription(
            [
              "Play **any time** via ephemeral messages. One run per day (Toronto time).",
              "",
              "**Flow:**",
              "1) MiniGame — Riddle",
              "2) Labyrinth",
              "3) MiniGame — Riddle",
              "4) Squig Roulette",
              "5) MiniGame — Riddle",
              "6) Risk It",
              "",
              "Leaderboard ranks **highest single-game score**, with **total monthly points** as tiebreaker.",
            ].join("\n")
          )
          .setColor(0x00ccff);

        return interaction.editReply({ embeds: [embed] });
      }

      // /mygauntlet
      if (interaction.commandName === "mygauntlet") {
        await interaction.deferReply({ ephemeral: true });
        const month = currentMonthStr();
        const mine = await Store.getMyMonth(interaction.user.id, month);

        const embed = new EmbedBuilder()
          .setTitle(`🧾 Your Gauntlet — ${month}`)
          .setDescription(
            `**Best:** ${mine.best}\n**Total:** ${mine.total}\n**Plays:** ${mine.plays}`
          )
          .setColor(0x00ccff);

        return interaction.editReply({ embeds: [embed] });
      }

      // /survive  (Squig Survival mini-game)
      if (interaction.commandName === "survive") {
        if (!isAdminUserLocal(interaction)) {
          return interaction.reply({
            content: "⛔ Only admins can use the Squig Survival menu.",
            flags: 64,
          });
        }

        const standardSettings = await getSurvivalStandardSettings();
        return interaction.reply({
          embeds: [buildSurvivalMenuEmbed(standardSettings)],
          components: buildSurvivalMenuComponents(),
          flags: 64,
        });
      }

      // /survivestart
      if (interaction.commandName === "survivestart") {
        if (!survivalLobby || survivalLobby.game_status !== "lobby") {
          return interaction.reply({
            content: "No active /survive lobby. Run /survive first.",
            flags: 64,
          });
        }
        await startSurvivalFromLobby(interaction, survivalLobby);
        return;
      }

      // /podiumtest
      if (interaction.commandName === "podiumtest") {
        if (!isAdminUserLocal(interaction)) {
          return interaction.reply({
            content: "⛔ Only admins can use /podiumtest.",
            flags: 64,
          });
        }

        await interaction.deferReply();

        const id = interaction.user.id;
        const placements = [id, id, id];
        const podiumBuffer = await buildPodiumImage(
          interaction.client,
          placements,
          interaction.guildId
        );

        if (!podiumBuffer) {
          return interaction.editReply({
            content: "❌ Podium render failed.",
          });
        }

        const attachment = new AttachmentBuilder(podiumBuffer, { name: "podium.png" });
        const embed = new EmbedBuilder()
          .setTitle("Squig Survival - Podium Test")
          .setImage("attachment://podium.png")
          .setColor(0xf1c40f);

        return interaction.editReply({
          embeds: [embed],
          files: [attachment],
        });
      }

      // /adduser
      if (interaction.commandName === "adduser") {
        if (!isAdminUserLocal(interaction)) {
          return interaction.reply({
            content: "⛔ Only admins can use /adduser.",
            flags: 64,
          });
        }

        const discordIdRaw = interaction.options.getString("discord_id");
        const dripUserIdRaw = interaction.options.getString("drip_user_id");
        const dripTypeRaw = interaction.options.getString("type");
        const discordId = String(discordIdRaw || "").trim();
        const dripUserId = String(dripUserIdRaw || "").trim();
        const dripCredentialType = String(dripTypeRaw || "drip-id").trim();

        if (!/^\d{5,30}$/.test(discordId)) {
          return interaction.reply({
            content: "❌ `discord_id` must be a valid Discord user ID (digits only).",
            flags: 64,
          });
        }

        if (!dripUserId) {
          return interaction.reply({
            content: "❌ `drip_user_id` is required.",
            flags: 64,
          });
        }

        try {
          await Store.upsertDripUserOverride(
            discordId,
            dripUserId,
            interaction.user.id,
            dripCredentialType
          );
          return interaction.reply({
            content:
              `✅ DRIP override saved.\nDiscord ID: \`${discordId}\`\n` +
              `DRIP credential type: \`${dripCredentialType}\`\n` +
              `DRIP credential value: \`${dripUserId}\`\n` +
              "Future payouts will try normal Discord-linked payout first, then this override.",
            flags: 64,
          });
        } catch (err) {
          return interaction.reply({
            content: `❌ Failed to save override: ${err?.message || err}`,
            flags: 64,
          });
        }
      }

      // /paytest
      if (interaction.commandName === "paytest") {
        if (!isAdminUserLocal(interaction)) {
          return interaction.reply({
            content: "⛔ Only admins can use /paytest.",
            flags: 64,
          });
        }

        await interaction.deferReply({ flags: 64 });

        const target = interaction.options.getUser("user") || interaction.user;
        const amount = interaction.options.getInteger("amount") || 1;
        const displayName =
          target.username || target.globalName || `User-${target.id}`;

        try {
          const reward = await rewardCharmAmount({
            userId: target.id,
            username: displayName,
            amount,
            source: "paytest",
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            metadata: {
              runBy: interaction.user.id,
              type: "manual-paytest",
            },
            logClient: interaction.client,
            logReason: `Manual DRIP paytest by ${interaction.user.id}`,
          });

          if (reward?.ok) {
            await logCharmReward(interaction.client, {
              userId: target.id,
              amount: reward.amount,
              score: 0,
              source: "paytest",
              channelId: interaction.channelId,
              reason: `Manual DRIP paytest by <@${interaction.user.id}>`,
            });
            return interaction.editReply({
              content:
                `✅ DRIP paytest succeeded.\nTarget: <@${target.id}>\n` +
                `Amount: **${reward.amount} $CHARM**`,
            });
          }

          const status = reward?.error?.response?.status;
          const reason = reward?.reason || reward?.error?.message || "unknown";
          const hint =
            reason === "no_usable_credential"
              ? "\nTip: use /adduser with `type` + `drip_user_id` matching a real DRIP credential."
              : "";
          return interaction.editReply({
            content:
              `⚠️ DRIP paytest did not complete.\nTarget: <@${target.id}>\n` +
              `Amount attempted: **${amount} $CHARM**\n` +
              `Status: ${status || "n/a"}\nReason: ${reason}${hint}`,
          });
        } catch (err) {
          const status = err?.response?.status;
          const reason = err?.response?.data
            ? JSON.stringify(err.response.data)
            : err?.message || String(err);
          return interaction.editReply({
            content:
              `❌ DRIP paytest failed.\nTarget: <@${target.id}>\n` +
              `Amount attempted: **${amount} $CHARM**\n` +
              `Status: ${status || "n/a"}\nReason: ${reason}`,
          });
        }
      }

      // /addimage
      if (interaction.commandName === "addimage") {
        if (!isAdminUserLocal(interaction)) {
          return interaction.reply({
            content: "⛔ Only admins can use /addimage.",
            flags: 64,
          });
        }

        const imageUrl = interaction.options.getString("url");
        const artist = interaction.options.getUser("user");
        const userId = artist?.id || null;

        if (!/^https?:\/\//i.test(imageUrl || "")) {
          return interaction.reply({
            content: "❌ Image URL must start with http:// or https://",
            flags: 64,
          });
        }

        try {
          const result = await imageStore.addSurvivalImage({
            imageUrl,
            userId,
            addedBy: interaction.user.id,
          });

          if (!result.ok) {
            return interaction.reply({
              content: `❌ Image DB unavailable: ${result.reason || "unknown error"}`,
              flags: 64,
            });
          }

          return interaction.reply({
            content: `✅ Added survival image.\nURL: ${imageUrl}${
              userId ? `\nArtist: <@${userId}>` : ""
            }`,
          });
        } catch (err) {
          return interaction.reply({
            content: `❌ Failed to add image: ${err?.message || err}`,
            flags: 64,
          });
        }
      }

      // /survivorboard
      if (interaction.commandName === "survivorboard") {
        await interaction.deferReply();
        const rows = await survivalStore.getMonthlyWinnersTop10();
        const lines = rows.length
          ? rows
              .map((r, i) => {
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
                return `${medal} <@${r.user_id}> — **${r.firsts}** wins (2nd: ${r.seconds}, 3rd: ${r.thirds}, games: ${r.games})`;
              })
              .join("\n")
          : "No Squig Survival wins yet this month.";

        const embed = new EmbedBuilder()
          .setTitle("🏆 Squig Survival — Monthly Winners")
          .setDescription(lines)
          .setColor(0xf1c40f);

        return interaction.editReply({ embeds: [embed] });
      }

      // /lives
      if (interaction.commandName === "lives") {
        await interaction.deferReply({ ephemeral: false });
        const targetUser = interaction.options.getUser("user") || interaction.user;
        const stats = await survivalStore.getUserStats(targetUser.id, "all");
        const rank = await survivalStore.getOverallRank(targetUser.id);
        const title = "All Time";
        const lines = [
          `🏅 **Overall Rank:** ${rank ? `#${rank}` : "Unranked"}`,
          `🥇 **1st:** ${stats.firsts}`,
          `🥈 **2nd:** ${stats.seconds}`,
          `🥉 **3rd:** ${stats.thirds}`,
          `🎮 **Games Played:** ${stats.games}`,
          `🔪 **Eliminations:** ${stats.eliminations}`,
          `💀 **Deaths:** ${stats.deaths}`,
          `🖼️ **Images Used:** ${stats.images_used}`,
        ];

        const quips = [
          "The portal knows your name. It just pretends not to.",
          "Your life count is a work of art. Or at least a sketch.",
          "Survival stats powered by snacks and questionable decisions.",
          "Keep going. The Squigs are taking notes.",
          "Numbers don't lie. Squigs do.",
          "You are technically alive on paper.",
        ];

        const header =
          targetUser.id === interaction.user.id ? "" : `<@${targetUser.id}>\n`;
        const embed = new EmbedBuilder()
          .setTitle(`🧬 Squig Lives — ${title}`)
          .setDescription(`${header}${lines.join("\n")}`)
          .setFooter({ text: rand(quips) })
          .setColor(0x9b59b6);

        return interaction.editReply({ embeds: [embed] });
      }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("survive:modal:")) {
      if (!isAdminUserLocal(interaction)) {
        return interaction.reply({
          content: "⛔ Only admins can use the Squig Survival menu.",
          flags: 64,
        });
      }

      const session = survivalConfigSessions.get(interaction.user.id);
      if (!session) {
        const standardSettings = await getSurvivalStandardSettings();
        return interaction.reply({
          embeds: [
            buildSurvivalMenuEmbed(
              standardSettings,
              "That settings panel expired. Open /survive again or pick a new menu option."
            ),
          ],
          components: buildSurvivalMenuComponents(),
          flags: 64,
        });
      }

      const value = interaction.fields.getTextInputValue("value").trim();
      let note = null;

      if (interaction.customId === "survive:modal:time") {
        const minutes = Number(value);
        if (!Number.isFinite(minutes) || minutes < 1) {
          note = "Time must be a whole number of at least 1 minute.";
        } else {
          session.settings.time_minutes = Math.floor(minutes);
        }
      }

      if (interaction.customId === "survive:modal:bonus-req") {
        const players = Number(value);
        if (!Number.isFinite(players) || players < 1) {
          note = "Bonus required players must be a whole number of at least 1.";
        } else {
          session.settings.bonus_required_players = Math.floor(players);
        }
      }

      if (interaction.customId === "survive:modal:bonus-mult") {
        const multiplier = Number(value);
        if (!Number.isFinite(multiplier) || multiplier < 1) {
          note = "Bonus multiplier must be a number that is at least 1.";
        } else {
          session.settings.bonus_multiplier = Number(multiplier.toFixed(2));
        }
      }

      session.settings = normalizeSurvivalSettings(session.settings);
      survivalConfigSessions.set(interaction.user.id, session);

      return interaction.reply({
        embeds: [buildSurvivalSettingsEmbed(session.mode, session.settings, note)],
        components: buildSurvivalSettingsComponents(session.mode, session.settings),
        flags: 64,
      });
    }

    if (interaction.isButton() && interaction.customId.startsWith("survive:menu:")) {
      if (!isAdminUserLocal(interaction)) {
        return interaction.reply({
          content: "⛔ Only admins can use the Squig Survival menu.",
          flags: 64,
        });
      }

      const standardSettings = await getSurvivalStandardSettings();

      if (interaction.customId === "survive:menu:play-standard") {
        const result = await openSurvivalLobby(
          interaction.channel,
          interaction.user.id,
          standardSettings
        );
        return interaction.update({
          embeds: [
            buildSurvivalMenuEmbed(
              standardSettings,
              result.ok ? "Standard lobby opened in this channel." : result.reason
            ),
          ],
          components: buildSurvivalMenuComponents(),
        });
      }

      if (interaction.customId === "survive:menu:play-custom") {
        survivalConfigSessions.set(interaction.user.id, {
          mode: "custom",
          settings: cloneSurvivalSettings(standardSettings),
        });
        const session = survivalConfigSessions.get(interaction.user.id);
        return interaction.update({
          embeds: [buildSurvivalSettingsEmbed(session.mode, session.settings)],
          components: buildSurvivalSettingsComponents(session.mode, session.settings),
        });
      }

      if (interaction.customId === "survive:menu:set-standard") {
        survivalConfigSessions.set(interaction.user.id, {
          mode: "standard",
          settings: cloneSurvivalSettings(standardSettings),
        });
        const session = survivalConfigSessions.get(interaction.user.id);
        return interaction.update({
          embeds: [buildSurvivalSettingsEmbed(session.mode, session.settings)],
          components: buildSurvivalSettingsComponents(session.mode, session.settings),
        });
      }
    }

    if (interaction.isButton() && interaction.customId.startsWith("survive:config:")) {
      if (!isAdminUserLocal(interaction)) {
        return interaction.reply({
          content: "⛔ Only admins can use the Squig Survival menu.",
          flags: 64,
        });
      }

      const session = survivalConfigSessions.get(interaction.user.id);
      if (!session) {
        const standardSettings = await getSurvivalStandardSettings();
        return interaction.update({
          embeds: [
            buildSurvivalMenuEmbed(
              standardSettings,
              "That settings panel expired. Open /survive again or pick a new menu option."
            ),
          ],
          components: buildSurvivalMenuComponents(),
        });
      }

      if (interaction.customId === "survive:config:time") {
        const modal = new ModalBuilder()
          .setCustomId("survive:modal:time")
          .setTitle("Set Timed Minutes");
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("value")
              .setLabel("Minutes")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setValue(String(session.settings.time_minutes || 5))
          )
        );
        await interaction.showModal(modal);
        return;
      }

      if (interaction.customId === "survive:config:bonus-req") {
        const modal = new ModalBuilder()
          .setCustomId("survive:modal:bonus-req")
          .setTitle("Set Bonus Player Count");
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("value")
              .setLabel("Players Required")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setValue(String(session.settings.bonus_required_players || 10))
          )
        );
        await interaction.showModal(modal);
        return;
      }

      if (interaction.customId === "survive:config:bonus-mult:custom") {
        const modal = new ModalBuilder()
          .setCustomId("survive:modal:bonus-mult")
          .setTitle("Set Custom Bonus Multiplier");
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("value")
              .setLabel("Multiplier")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setValue(String(session.settings.bonus_multiplier || 1.5))
          )
        );
        await interaction.showModal(modal);
        return;
      }

      if (interaction.customId === "survive:config:save") {
        if (session.mode === "standard") {
          const saved = await saveSurvivalStandardSettings(session.settings);
          survivalConfigSessions.delete(interaction.user.id);
          return interaction.update({
            embeds: [buildSurvivalMenuEmbed(saved, "Standard settings saved.")],
            components: buildSurvivalMenuComponents(),
          });
        }

        const result = await openSurvivalLobby(
          interaction.channel,
          interaction.user.id,
          session.settings
        );

        if (result.ok) {
          survivalConfigSessions.delete(interaction.user.id);
          const standardSettings = await getSurvivalStandardSettings();
          return interaction.update({
            embeds: [buildSurvivalMenuEmbed(standardSettings, "Custom lobby opened in this channel.")],
            components: buildSurvivalMenuComponents(),
          });
        }

        return interaction.update({
          embeds: [buildSurvivalSettingsEmbed(session.mode, session.settings, result.reason)],
          components: buildSurvivalSettingsComponents(session.mode, session.settings),
        });
      }

      if (interaction.customId === "survive:config:cancel") {
        survivalConfigSessions.delete(interaction.user.id);
        const standardSettings = await getSurvivalStandardSettings();
        return interaction.update({
          embeds: [buildSurvivalMenuEmbed(standardSettings)],
          components: buildSurvivalMenuComponents(),
        });
      }

      if (interaction.customId === "survive:config:type") {
        session.settings.type =
          session.settings.type === "timed" ? "team_start" : "timed";
      }

      if (interaction.customId === "survive:config:era") {
        const eraKeys = Object.keys(SURVIVAL_ERAS);
        const currentIndex = Math.max(
          0,
          eraKeys.indexOf(session.settings.era_key)
        );
        session.settings.era_key =
          eraKeys[(currentIndex + 1) % Math.max(1, eraKeys.length)];
      }

      if (interaction.customId === "survive:config:bonus-active") {
        session.settings.bonus_active = !session.settings.bonus_active;
      }

      if (interaction.customId === "survive:config:replay") {
        session.settings.replay = !session.settings.replay;
      }

      if (interaction.customId.startsWith("survive:config:bonus-mult:")) {
        const value = interaction.customId.split(":").pop();
        const multiplier = Number(value);
        if (Number.isFinite(multiplier) && multiplier >= 1) {
          session.settings.bonus_multiplier = Number(multiplier.toFixed(2));
        }
      }

      session.settings = normalizeSurvivalSettings(session.settings);
      survivalConfigSessions.set(interaction.user.id, session);

      return interaction.update({
        embeds: [buildSurvivalSettingsEmbed(session.mode, session.settings)],
        components: buildSurvivalSettingsComponents(session.mode, session.settings),
      });
    }

    // Survival lobby buttons
    if (
      interaction.isButton() &&
      ["survive:join", "survive:leave", "survive:list", "survive:stats", "survive:info"].includes(
        interaction.customId
      )
    ) {
      if (!survivalLobby || survivalLobby.game_status !== "lobby") {
        return interaction.reply({
          content: "No active /survive lobby. Run /survive first.",
          flags: 64,
        });
      }

      const userId = interaction.user.id;
      if (interaction.customId === "survive:join") {
        survivalLobby.joined.add(userId);
        try {
          const remaining = survivalLobby.countdown_end
            ? survivalLobby.countdown_end - Date.now()
            : undefined;
          const updated = buildSurvivalLobbyEmbed(
            survivalLobby.settings,
            survivalLobby.joined.size,
            remaining
          );
          await survivalLobby.join_message.edit({ embeds: [updated] });
        } catch {}
        persistSurvivalLobby(survivalLobby);
        return interaction.reply({
          content: "You joined the Squig Survival lobby.",
          flags: 64,
        });
      }

      if (interaction.customId === "survive:leave") {
        survivalLobby.joined.delete(userId);
        try {
          const remaining = survivalLobby.countdown_end
            ? survivalLobby.countdown_end - Date.now()
            : undefined;
          const updated = buildSurvivalLobbyEmbed(
            survivalLobby.settings,
            survivalLobby.joined.size,
            remaining
          );
          await survivalLobby.join_message.edit({ embeds: [updated] });
        } catch {}
        persistSurvivalLobby(survivalLobby);
        return interaction.reply({
          content: "You left the Squig Survival lobby.",
          flags: 64,
        });
      }

      if (interaction.customId === "survive:list") {
        const ids = Array.from(survivalLobby.joined || []);
        let list = "None";
        if (ids.length) {
          const nameMap = await buildDisplayNameMap(
            interaction.client,
            interaction.guildId,
            ids
          );
          list = ids.map((id) => nameMap.get(id) || `User-${id}`).join("\n");
        }
        return interaction.reply({
          content: `Players joined (${ids.length}):\n${list}`,
          flags: 64,
        });
      }

      if (interaction.customId === "survive:stats") {
        const stats = await survivalStore.getUserStats(interaction.user.id, "all");
        const rank = await survivalStore.getOverallRank(interaction.user.id);
        const lines = [
          `🏅 **Overall Rank:** ${rank ? `#${rank}` : "Unranked"}`,
          `🥇 **1st:** ${stats.firsts}`,
          `🥈 **2nd:** ${stats.seconds}`,
          `🥉 **3rd:** ${stats.thirds}`,
          `🎮 **Games Played:** ${stats.games}`,
          `🔪 **Eliminations:** ${stats.eliminations}`,
          `💀 **Deaths:** ${stats.deaths}`,
          `🖼️ **Images Used:** ${stats.images_used}`,
        ];

        const quips = [
          "The portal knows your name. It just pretends not to.",
          "Your life count is a work of art. Or at least a sketch.",
          "Survival stats powered by snacks and questionable decisions.",
          "Keep going. The Squigs are taking notes.",
          "Numbers don't lie. Squigs do.",
          "You are technically alive on paper.",
        ];

        const embed = new EmbedBuilder()
          .setTitle("🧬 Squig Lives — All Time")
          .setDescription(lines.join("\n"))
          .setFooter({ text: rand(quips) })
          .setColor(0x9b59b6);

        return interaction.reply({ embeds: [embed], flags: 64 });
      }

      if (interaction.customId === "survive:info") {
        const lines = [
          "**What is this?**",
          "A chaotic, story-driven Squig Survival run where players get eliminated round by round until one wins — and a rotating gallery of community art is featured. If your image is used in the game, you earn **$CHARM** each time.",
          "",
          "**How to join:**",
          "Hit **Join** in the lobby. Staff starts the game with **/survivestart**.",
          "",
          "**Stats & bragging:**",
          "Press **My Stats** in the lobby for your all-time stats (private).",
          "Use **/lives** to show stats publicly.",
          "",
          "**How to add images:**",
          "Post your art in <#1334884237727240267>. Staff will get it added. If it's taking too long, ping them.",
          "",
          "**Pro tips:**",
          "- More players = bigger prize pool.",
          "- Revivals happen. Rare, but loud.",
        ];

        const embed = new EmbedBuilder()
          .setTitle("ℹ️ Squig Survival — Info")
          .setDescription(lines.join("\n"))
          .setColor(0x9b59b6);

        return interaction.reply({ embeds: [embed], flags: 64 });
      }
    }

    if (interaction.isButton() && interaction.customId === "gauntlet:mystats") {
      const month = currentMonthStr();
      const mine = await Store.getMyMonth(interaction.user.id, month);
      const hasPlays = Number(mine.plays) > 0;
      const bestText = hasPlays ? mine.best : "—";
      const leastText = hasPlays ? mine.least : "—";

      const embed = new EmbedBuilder()
        .setTitle(`🧾 Your Gauntlet — ${month}`)
        .setDescription(
          [
            `🎮 **Games Played:** ${mine.plays}`,
            `🏆 **Most Points:** ${bestText}`,
            `🔻 **Least Points:** ${leastText}`,
            `🧮 **Total Points:** ${mine.total}`,
          ].join("\n")
        )
        .setColor(0x00ccff);

      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (interaction.isButton() && interaction.customId === "gauntlet:leaderboard") {
      await interaction.deferReply({ ephemeral: true });
      const month = currentMonthStr();
      const embed = await renderTotalLeaderboardEmbed(month);
      return interaction.editReply({ embeds: [embed] });
    }

    // Start button
    if (interaction.isButton() && interaction.customId === "gauntlet:start") {
      await interaction.deferReply({ ephemeral: true });
      const today = torontoDateStr();
      const played = await Store.hasPlayed(interaction.user.id, today);

      if (played) {
        const when = nextTorontoMidnight();
        return interaction.editReply({
          content: `⏳ You've already played today. Come back after **${when} (Toronto)**.`,
        });
      }

      // Lock the daily play immediately to prevent multiple starts in one day.
      await Store.recordPlay(interaction.user.id, today);

      await interaction.editReply({
        content: "⚔️ Your Gauntlet run begins now (ephemeral). Good luck!",
      });

      const final = await runSoloGauntletEphemeral(interaction);

      try {
        await interaction.followUp({
          content: [
            "Gauntlet Complete.",
            `Final score: ${final} points`,
            `Reward earned: ${GAUNTLET_PLAY_REWARD} $CHARM`,
            "Think you can do better? Prove it tomorrow and push your way up the leaderboard.",
          ].join("\n"),
          ephemeral: true,
        });
      } catch {}

      return;
    }
  } catch (err) {
    console.error("interaction error:", err);
    if (interaction.isRepliable()) {
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({
            content: "❌ Something went wrong.",
            flags: 64,
          });
        } else {
          await interaction.reply({
            content: "❌ Something went wrong.",
            flags: 64,
          });
        }
      } catch {}
    }
  }
}

// --------------------------------------------
// EXPORTS
// --------------------------------------------
module.exports = {
  registerCommands,
  handleInteractionCreate,
  initSurvivalLobby,
};
