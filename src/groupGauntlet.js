// src/groupGauntlet.js
// Classic "big room" Gauntlet — group game with mini-games + riddles
// Triggered via /groupgauntlet [minutes] (lobby join period)
//
// - Lobby phase: players join, host can start early or cancel
// - 10 rounds: each = mini-game (buttons) + riddle (chat answers)
// - Countdown messages for both phases
// - Per-player riddle success messages
// - Risk It phase after round 8
// - In-memory only (no DB persistence)

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const {
  miniGameLorePool,
  miniGameFateDescriptions,
  pointFlavors,
  riddles,
  pickMiniGame,
  pickRiddle,
} = require("./gameData");

// In-memory game state: key by channelId (one game per channel)
const groupGames = new Map();

// Local wait helper
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// -------------- Slash Command Definition --------------------

// Exported SlashCommandBuilder so you can register it alongside others
const groupGauntletCommand = new SlashCommandBuilder()
  .setName("groupgauntlet")
  .setDescription("Run a classic group Gauntlet in this channel.")
  .addIntegerOption((opt) =>
    opt
      .setName("minutes")
      .setDescription("How long players have to join before the game starts")
      .setMinValue(1)
      .setMaxValue(30)
      .setRequired(true)
  );

// -------------- Helpers -------------------------------------

function formatPlayerList(game) {
  if (!game || game.players.size === 0) return "_No players yet. Use **Join** to enter._";
  const names = Array.from(game.players.values()).map((p) => p.username);
  return names.join(", ");
}

function getBasePointsForDifficulty(difficulty) {
  switch (difficulty) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 3;
    case 4:
      return 3; // Squig specials
    default:
      return 1;
  }
}

function getMonthKeyFromDate(d = new Date()) {
  // "YYYY-MM"
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function summarizeLeaderboard(playersMap) {
  const players = Array.from(playersMap.values());
  players.sort((a, b) => b.points - a.points);
  return players;
}

function splitPodium(players) {
  const [first, second, third, ...rest] = players;
  return {
    first,
    second,
    third,
    others: rest,
  };
}

// -------------- Main Entry: Slash Command -------------------

async function handleGroupGauntletSlash(interaction) {
  const channelId = interaction.channelId;

  if (groupGames.has(channelId)) {
    return interaction.reply({
      content: "🚫 A Group Gauntlet is already running in this channel.",
      ephemeral: true,
    });
  }

  const minutes = interaction.options.getInteger("minutes", true);
  const hostId = interaction.user.id;

  const game = {
    channelId,
    guildId: interaction.guildId,
    hostId,
    lobbyEndsAt: Date.now() + minutes * 60_000,
    players: new Map(),
    round: 0,
    maxRounds: 10,
    usedMiniGames: new Set(),
    usedRiddles: new Set(),
    isRunning: false,
    createdAt: new Date(),
  };

  // Host joins automatically
  game.players.set(hostId, {
    id: hostId,
    username: interaction.user.username,
    points: 0,
  });

  groupGames.set(channelId, game);

  const lobbyEmbed = new EmbedBuilder()
    .setTitle("👁 The Gauntlet — Group Mode Lobby")
    .setDescription(
      [
        `Host: <@${hostId}>`,
        "",
        `Players can **Join** for the next **${minutes} minute(s)**.`,
        "",
        "**When the lobby closes, the game starts.**",
      ].join("\n")
    )
    .addFields(
      {
        name: "Players",
        value: formatPlayerList(game),
      },
      {
        name: "How it works",
        value:
          "- 10 rounds of chaos\n- Each round: a mini-game + a riddle\n- Points go up, down, and sideways\n- After Round 8, the Charm may offer a **Risk It**",
      }
    )
    .setTimestamp(new Date())
    .setColor(0xff00aa);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`gg_lobby_join_${channelId}`)
      .setLabel("Join")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`gg_lobby_leave_${channelId}`)
      .setLabel("Leave")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`gg_lobby_start_${channelId}`)
      .setLabel("Start Now (Host)")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`gg_lobby_cancel_${channelId}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger)
  );

  const message = await interaction.reply({
    embeds: [lobbyEmbed],
    components: [row],
    fetchReply: true,
  });

  runLobbyCollector(interaction.client, message, game);
}

// -------------- Lobby Collector -----------------------------

function runLobbyCollector(client, message, game) {
  const channelId = game.channelId;
  const lobbyDuration = game.lobbyEndsAt - Date.now();

  const collector = message.createMessageComponentCollector({
    time: lobbyDuration > 0 ? lobbyDuration : 10_000,
  });

  collector.on("collect", async (i) => {
    if (!i.customId.startsWith("gg_lobby_")) return;

    const [, , action, cid] = i.customId.split("_");
    if (cid !== channelId) return i.deferUpdate().catch(() => {});

    const userId = i.user.id;

    if (action === "join") {
      if (!game.players.has(userId)) {
        game.players.set(userId, {
          id: userId,
          username: i.user.username,
          points: 0,
        });
      }
      await i.deferUpdate().catch(() => {});
    } else if (action === "leave") {
      if (game.players.has(userId) && userId !== game.hostId) {
        game.players.delete(userId);
      }
      await i.deferUpdate().catch(() => {});
    } else if (action === "start") {
      // Only host can start early
      if (userId !== game.hostId) {
        return i.reply({
          content: "Only the host can start the game early.",
          ephemeral: true,
        });
      }
      collector.stop("host_start");
      await i.deferUpdate().catch(() => {});
    } else if (action === "cancel") {
      if (userId !== game.hostId) {
        return i.reply({
          content: "Only the host can cancel this game.",
          ephemeral: true,
        });
      }
      collector.stop("host_cancel");
      await i.deferUpdate().catch(() => {});
    }

    // Update lobby embed
    const updated = EmbedBuilder.from(message.embeds[0]);
    updated.spliceFields(0, 1, {
      name: "Players",
      value: formatPlayerList(game),
    });
    await message.edit({ embeds: [updated] }).catch(() => {});
  });

  collector.on("end", async (_, reason) => {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      groupGames.delete(channelId);
      return;
    }

    if (reason === "host_cancel") {
      await channel.send("🛑 The Group Gauntlet lobby was cancelled.");
      groupGames.delete(channelId);
      return;
    }

    if (game.players.size === 0) {
      await channel.send("No one joined the Group Gauntlet. The portal closes.");
      groupGames.delete(channelId);
      return;
    }

    await channel.send(
      `👁 The Gauntlet begins with **${game.players.size}** player(s)!`
    );

    game.isRunning = true;
    runGroupGame(channel, game).catch(async (err) => {
      console.error("Group Gauntlet error:", err);
      await channel.send("⚠️ The Gauntlet stumbled and fell. Ping an admin.");
      groupGames.delete(channelId);
    });
  });
}

// -------------- Game Loop -----------------------------------

async function runGroupGame(channel, game) {
  for (let r = 1; r <= game.maxRounds; r++) {
    game.round = r;

    // MINI-GAME
    await runMiniGamePhase(channel, game);

    // RIDDLE
    await runRiddlePhase(channel, game);

    // Risk It after round 8 (feel like the old logs)
    if (r === 8) {
      await runRiskItPhase(channel, game);
    }
  }

  // Final podium
  await showFinalPodium(channel, game);

  groupGames.delete(game.channelId);
}

// -------------- Mini-Game Phase -----------------------------

async function runMiniGamePhase(channel, game) {
  // Pick a mini-game, tracking used ones
  const picked = pickMiniGame(game.usedMiniGames); // { index, title, lore, buttons, image }
  const mg = picked;

  const fateLine =
    miniGameFateDescriptions[
      Math.floor(Math.random() * miniGameFateDescriptions.length)
    ];

  const embed = new EmbedBuilder()
    .setTitle(`🌪️ ROUND ${game.round} — ${mg.title}`)
    .setDescription(
      [
        mg.lore,
        "",
        fateLine,
        "",
        "⏳ You have **30 seconds** to choose your fate.",
      ].join("\n")
    )
    .setColor(0xffaa00);

  if (mg.image) {
    embed.setImage(mg.image);
  }

  const row = new ActionRowBuilder().addComponents(
    mg.buttons.map((label, idx) =>
      new ButtonBuilder()
        .setCustomId(`gg_mg_${game.channelId}_${idx}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Primary)
    )
  );

  const message = await channel.send({
    embeds: [embed],
    components: [row],
  });

  const choices = new Map(); // userId -> buttonIndex

  const collector = message.createMessageComponentCollector({
    time: 30_000,
  });

  // Countdown messages
  channel
    .send("⏳ 20 seconds left to choose...")
    .catch(() => {});
  setTimeout(() => {
    channel.send("⏳ 10 seconds left...").catch(() => {});
  }, 20_000);
  setTimeout(() => {
    channel.send("⏰ Time’s almost up!").catch(() => {});
  }, 27_000);

  collector.on("collect", async (i) => {
    if (!i.customId.startsWith("gg_mg_")) return;
    const [, , cid, idxStr] = i.customId.split("_");
    if (cid !== game.channelId) return i.deferUpdate().catch(() => {});

    const userId = i.user.id;
    if (!game.players.has(userId)) {
      return i.reply({
        content: "Only players in this Gauntlet can pick an option.",
        ephemeral: true,
      });
    }

    const idx = parseInt(idxStr, 10);
    choices.set(userId, idx);

    await i.reply({
      content: `You chose **${mg.buttons[idx]}**.`,
      ephemeral: true,
    });
  });

  collector.on("end", async () => {
    await channel.send("🎲 Time’s up. The charm decides.").catch(() => {});

    if (choices.size === 0) {
      await channel.send("No one chose anything. The Squigs are offended.").catch(() => {});
      // No point changes
      await message.edit({ components: [] }).catch(() => {});
      return;
    }

    // Assign point deltas per button index
    const deltas = [+2, +1, -1, -2];
    const baseRoll = Math.floor(Math.random() * deltas.length);

    const perPlayerDelta = new Map(); // userId -> delta
    for (const [userId, idx] of choices.entries()) {
      const delta = deltas[(baseRoll + idx) % deltas.length];
      perPlayerDelta.set(userId, delta);

      const player = game.players.get(userId);
      if (!player) continue;
      player.points += delta;
    }

    // Build summary + flavor
    const lines = [];
    const groupByDelta = {};

    for (const [userId, delta] of perPlayerDelta.entries()) {
      const key = delta > 0 ? `+${delta}` : `${delta}`;
      if (!groupByDelta[key]) groupByDelta[key] = [];
      groupByDelta[key].push(`<@${userId}>`);
    }

    for (const key of Object.keys(groupByDelta).sort()) {
      const list = groupByDelta[key].join(", ");
      const num = parseInt(key, 10);
      let flavor = "";
      const bucketKey = num > 0 ? `+${num}` : `${num}`;
      const bucket = pointFlavors[bucketKey];
      if (bucket && bucket.length) {
        flavor = bucket[Math.floor(Math.random() * bucket.length)];
      } else {
        flavor = num > 0 ? `Gained **${num}** point(s).` : `Lost **${Math.abs(num)}** point(s).`;
      }

      lines.push(`${list} → ${flavor}`);
    }

    const summaryEmbed = new EmbedBuilder()
      .setTitle("🧮 Mini-game complete — Points applied.")
      .setDescription(lines.join("\n"))
      .setColor(0x00ff99);

    await channel.send({ embeds: [summaryEmbed] }).catch(() => {});
    await message.edit({ components: [] }).catch(() => {});
  });
}

// -------------- Riddle Phase --------------------------------

async function runRiddlePhase(channel, game) {
  // Pick riddle, tracking used set
  const picked = pickRiddle(riddles, game.usedRiddles);
  if (!picked) {
    await channel.send("⚠️ No riddles available. The portal hiccups.").catch(() => {});
    return;
  }

  const difficulty = picked.difficulty;
  const basePoints = getBasePointsForDifficulty(difficulty);

  const difficultyLabel =
    difficulty === 1
      ? "EASY"
      : difficulty === 2
      ? "MEDIUM"
      : difficulty === 3
      ? "HARD"
      : "SQUIG SPECIAL";

  const embed = new EmbedBuilder()
    .setTitle("🧠 MID-ROUND RIDDLE")
    .setDescription(picked.riddle)
    .addFields({
      name: "Difficulty",
      value: `${difficultyLabel} — Worth **+${basePoints}** point(s).`,
    })
    .setColor(0x7b3fff);

  await channel.send({ embeds: [embed] });

  await channel
    .send("⏳ You have **30 seconds** to decide your fate...")
    .catch(() => {});
  setTimeout(() => {
    channel.send("⏳ 10 seconds left...").catch(() => {});
  }, 20_000);
  setTimeout(() => {
    channel.send("⏰ Time’s almost up!").catch(() => {});
  }, 27_000);

  const correctSet = new Set();
  const normalizedAnswers = picked.answers.map((a) =>
    a.trim().toLowerCase()
  );

  const filter = (m) =>
    !m.author.bot && game.players.has(m.author.id) && m.channelId === game.channelId;

  const collector = channel.createMessageCollector({
    filter,
    time: 30_000,
  });

  collector.on("collect", async (m) => {
    const userId = m.author.id;
    if (correctSet.has(userId)) return;

    const guess = m.content.trim().toLowerCase();
    const isCorrect = normalizedAnswers.some((a) => {
      // allow small variations like "letter m" vs "m"
      return guess === a || guess === `the ${a}`;
    });

    if (!isCorrect) return;

    correctSet.add(userId);

    const player = game.players.get(userId);
    if (player) {
      player.points += basePoints;
    }

    await channel
      .send(
        `🧠 <@${userId}> answered correctly and gained **+${basePoints}** point(s)!`
      )
      .catch(() => {});
  });

  collector.on("end", async () => {
    await channel
      .send(
        `✅ Riddle completed. **${correctSet.size}** player(s) answered correctly and gained **+${basePoints}** point(s).`
      )
      .catch(() => {});

    const correctAnswerText = picked.answers[0];
    await channel
      .send(`🧩 The correct answer was: **${correctAnswerText}**.`)
      .catch(() => {});
  });
}

// -------------- Risk It Phase -------------------------------

async function runRiskItPhase(channel, game) {
  const embed = new EmbedBuilder()
    .setTitle("🎲 RISK IT — The Charm Tempts You")
    .setDescription(
      [
        "Between rounds, the static parts... and a Squig grins.",
        "Risk your points for a shot at more — or lose them to the void.",
        "",
        "• **Risk All** — stake everything",
        "• **Risk Half** — stake half your current points",
        "• **Risk Quarter** — stake a quarter (min 1)",
        "• **No Risk** — sit out and watch the chaos",
        "",
        "⏳ You have **20 seconds** to decide.",
      ].join("\n")
    )
    .setColor(0xffcc00);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`gg_risk_all_${game.channelId}`)
      .setLabel("Risk All")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`gg_risk_half_${game.channelId}`)
      .setLabel("Risk Half")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`gg_risk_quarter_${game.channelId}`)
      .setLabel("Risk Quarter")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`gg_risk_none_${game.channelId}`)
      .setLabel("No Risk")
      .setStyle(ButtonStyle.Success)
  );

  const message = await channel.send({
    embeds: [embed],
    components: [row],
  });

  const choices = new Map(); // userId -> "all" | "half" | "quarter" | "none"

  const collector = message.createMessageComponentCollector({
    time: 20_000,
  });

  setTimeout(() => {
    channel.send("⏳ 10 seconds left to Risk It...").catch(() => {});
  }, 10_000);

  collector.on("collect", async (i) => {
    const [_, __, type, cid] = i.customId.split("_");
    if (cid !== game.channelId) return i.deferUpdate().catch(() => {});

    const userId = i.user.id;
    if (!game.players.has(userId)) {
      return i.reply({
        content: "Only players in this Gauntlet can Risk It.",
        ephemeral: true,
      });
    }

    let riskType = "none";
    if (type === "all") riskType = "all";
    else if (type === "half") riskType = "half";
    else if (type === "quarter") riskType = "quarter";
    else riskType = "none";

    choices.set(userId, riskType);
    await i.reply({
      content:
        riskType === "none"
          ? "You chose to sit this one out."
          : `You chose to **Risk ${riskType.toUpperCase()}**.`,
      ephemeral: true,
    });
  });

  collector.on("end", async () => {
    await channel.send("🧮 Risk It — Results").catch(() => {});
    const lines = [];

    for (const [userId, riskType] of choices.entries()) {
      const player = game.players.get(userId);
      if (!player) continue;

      const before = player.points;
      if (before <= 0 || riskType === "none") {
        lines.push(
          `<@${userId}> • No Risk (or nothing to risk) → stayed at **${before}**`
        );
        continue;
      }

      let stake = 0;
      if (riskType === "all") stake = before;
      else if (riskType === "half") stake = Math.max(1, Math.floor(before / 2));
      else if (riskType === "quarter")
        stake = Math.max(1, Math.floor(before / 4));

      // Decide outcome: double, lose, break even
      const roll = Math.random(); // 0–1
      let outcome; // "double" | "lose" | "even"
      if (roll < 0.4) outcome = "double";
      else if (roll < 0.8) outcome = "lose";
      else outcome = "even";

      let delta = 0;
      let emoji = "";
      let flavor = "";

      if (outcome === "double") {
        delta = stake;
        player.points += delta;
        emoji = "👑";
        flavor = "Doubled";
      } else if (outcome === "lose") {
        delta = -stake;
        player.points += delta;
        emoji = "💀";
        flavor = "Lost";
      } else {
        delta = 0;
        emoji = "😶";
        flavor = "Broke even";
      }

      const after = player.points;
      const sign =
        delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "0";

      lines.push(
        `<@${userId}> • Risk ${
          riskType === "all"
            ? "All"
            : riskType === "half"
            ? "Half"
            : riskType === "quarter"
            ? "Quarter"
            : "None"
        } (staked ${stake}) → ${emoji} **${flavor}** • ${sign} • new total: **${after}**`
      );
    }

    if (lines.length === 0) {
      await channel
        .send("No one dared to Risk It. The charm yawns.")
        .catch(() => {});
    } else {
      await channel.send(lines.join("\n")).catch(() => {});
    }

    await message.edit({ components: [] }).catch(() => {});
  });
}

// -------------- Final Podium -------------------------------

async function showFinalPodium(channel, game) {
  const players = summarizeLeaderboard(game.players);

  if (!players.length) {
    await channel.send("No one survived long enough to reach a podium.").catch(() => {});
    return;
  }

  const { first, second, third } = splitPodium(players);

  const lines = [];
  lines.push(
    `👥 **${players.length}** players participated in this Gauntlet.`
  );
  lines.push("");

  if (first) {
    lines.push(
      "👑 **Champion of the Charm**",
      `<@${first.id}> — Total Points: **${first.points}**`,
      ""
    );
  }
  if (second) {
    lines.push(
      "🌑 **Scarred But Standing**",
      `<@${second.id}> — Total Points: **${second.points}**`,
      ""
    );
  }
  if (third) {
    lines.push(
      "🕳 **Last One Dragged from the Void**",
      `<@${third.id}> — Total Points: **${third.points}**`,
      ""
    );
  }

  const embed = new EmbedBuilder()
    .setTitle("👁‍🗨️ THE FINAL PODIUM 👁‍🗨️")
    .setDescription(lines.join("\n"))
    .setColor(0xffffff);

  await channel.send({ embeds: [embed] }).catch(() => {});

  await channel
    .send("📯 Maybe enough reactions will encourage another game...")
    .catch(() => {});
}

// -------------- Routing Helpers for index/solo -------------
//
// Use these from your main interaction handler:
//
//   if (interaction.isChatInputCommand() && interaction.commandName === 'groupgauntlet') {
//       return handleGroupGauntletSlash(interaction);
//   }
//
// No buttons here need extra routing; they’re scoped by customId and channel.

function isGroupGauntletCommand(interaction) {
  return (
    interaction.isChatInputCommand() &&
    interaction.commandName === "groupgauntlet"
  );
}

// -------------- Exports ------------------------------------

module.exports = {
  groupGauntletCommand,
  handleGroupGauntletSlash,
  isGroupGauntletCommand,

  // For debugging or future extensions:
  _groupGames: groupGames,
};
