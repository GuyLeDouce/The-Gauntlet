// src/groupGauntlet.js
// Group-mode Gauntlet: classic multi-player chaos.
// - /groupgauntlet [minutes] posts a lobby in the channel
// - Players click Join
// - After the timer (or host starts early), a 6-round game runs in-channel
// - Scores live only for that session (no DB writes)

const {
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits,
} = require("discord.js");

const {
  TOKEN,
  CLIENT_ID,
  GUILD_IDS,
  AUTHORIZED_ADMINS,
} = require("./utils");

const {
  miniGameLorePool,
  miniGameFateDescriptions,
  pointFlavors,
  pickMiniGame,
  pickRiddle,
  riddles,
} = require("./gameData");

// --------------------------------------------------
// Helpers & state
// --------------------------------------------------
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

// channelId -> gameState
const activeGames = new Map();

/**
 * gameState = {
 *   id: string,
 *   channelId: string,
 *   hostId: string,
 *   status: 'lobby' | 'running' | 'finished' | 'cancelled',
 *   players: Map<userId, { id, username, points }>,
 *   createdAt: Date,
 *   lobbyMessageId?: string,
 *   startTimeout?: NodeJS.Timeout,
 *   usedMini: Set<number>,
 *   usedRiddles: Set<number>,
 * }
 */

function isAdminUser(interaction) {
  if (AUTHORIZED_ADMINS.includes(interaction.user.id)) return true;
  const member = interaction.member;
  if (!member || !interaction.inGuild()) return false;
  return (
    member.permissions?.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

function formatScoreboard(game) {
  const arr = Array.from(game.players.values()).sort(
    (a, b) => (b.points || 0) - (a.points || 0)
  );
  if (!arr.length) return "No players joined.";
  return arr
    .map(
      (p, i) =>
        `**#${i + 1}** ${p.username} — **${p.points || 0}** point${
          (p.points || 0) === 1 ? "" : "s"
        }`
    )
    .join("\n");
}

// Disable all buttons on a given message
async function disableButtons(message) {
  try {
    const rows = message.components.map((row) =>
      new ActionRowBuilder().addComponents(
        row.components.map((b) => ButtonBuilder.from(b).setDisabled(true))
      )
    );
    await message.edit({ components: rows });
  } catch {
    // ignore
  }
}

// --------------------------------------------------
// LOBBY
// --------------------------------------------------
async function createLobby(interaction, durationMinutes) {
  const channelId = interaction.channelId;

  if (activeGames.has(channelId)) {
    return interaction.reply({
      content: "⛔ There’s already a Gauntlet running (or waiting) in this channel.",
      ephemeral: true,
    });
  }

  const game = {
    id: `group_${Date.now()}`,
    channelId,
    hostId: interaction.user.id,
    status: "lobby",
    players: new Map(),
    createdAt: new Date(),
    usedMini: new Set(),
    usedRiddles: new Set(),
  };

  // Host auto-joined
  game.players.set(interaction.user.id, {
    id: interaction.user.id,
    username: interaction.user.username || interaction.user.globalName || "Player",
    points: 0,
  });

  activeGames.set(channelId, game);

  const embed = new EmbedBuilder()
    .setTitle("⚔️ The Gauntlet — Group Mode Lobby")
    .setDescription(
      [
        `Host: <@${interaction.user.id}>`,
        "",
        `Game starts in **${durationMinutes} minute${
          durationMinutes === 1 ? "" : "s"
        }**.`,
        "Click **Join** to enter. Host/Admin can **Start Now** or **Cancel**.",
        "",
        `Current players (1): <@${interaction.user.id}>`,
      ].join("\n")
    )
    .setColor(0xaa00ff);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("gg:lobby:join")
      .setLabel("Join")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("gg:lobby:leave")
      .setLabel("Leave")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("gg:lobby:start")
      .setLabel("Start Now")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("gg:lobby:cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger)
  );

  const msg = await interaction.reply({
    embeds: [embed],
    components: [row],
    fetchReply: true,
  });

  game.lobbyMessageId = msg.id;

  // Auto-start timer
  const ms = durationMinutes * 60_000;
  game.startTimeout = setTimeout(async () => {
    if (!activeGames.has(channelId)) return;
    const current = activeGames.get(channelId);
    if (!current || current.status !== "lobby") return;
    const ch = await interaction.client.channels.fetch(channelId).catch(() => null);
    if (!ch) return;
    await startGameInChannel(ch, current, "⏰ Lobby timer ended — starting now!");
  }, ms);
}

// --------------------------------------------------
// ROUND HELPERS
// --------------------------------------------------
async function broadcast(channel, contentOrEmbed) {
  if (contentOrEmbed instanceof EmbedBuilder) {
    return channel.send({ embeds: [contentOrEmbed] });
  }
  return channel.send({ content: contentOrEmbed });
}

function ensurePlayer(game, user) {
  if (!game.players.has(user.id)) return null;
  return game.players.get(user.id);
}

// ---------------- Mini-game (4 buttons, group) -----------
async function runGroupMiniGame(channel, game, roundLabel) {
  const selected = pickMiniGame(game.usedMini);

  const embed = new EmbedBuilder()
    .setTitle(`🌪 ${roundLabel} — ${selected.title}`)
    .setDescription(
      `${selected.lore}\n\n_${rand(miniGameFateDescriptions)}_\n\n⏳ You have **30 seconds** to choose.`
    )
    .setColor(0xff33cc);

  if (selected.image) embed.setImage(selected.image);

  const row = new ActionRowBuilder().addComponents(
    selected.buttons.map((label, i) =>
      new ButtonBuilder()
        .setCustomId(`gg:mg:${selected.index}:${i}`)
        .setLabel(label)
        .setStyle(
          [ButtonStyle.Primary, ButtonStyle.Danger, ButtonStyle.Secondary, ButtonStyle.Success][
            i % 4
          ]
        )
    )
  );

  const msg = await broadcast(channel, { embeds: [embed], components: [row] });

  const choices = new Map(); // userId -> button index

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30_000,
  });

  collector.on("collect", async (i) => {
    const player = ensurePlayer(game, i.user);
    if (!player) {
      return i.reply({ content: "You’re not in this Gauntlet.", ephemeral: true });
    }
    if (choices.has(i.user.id)) {
      return i.reply({ content: "You already picked this round.", ephemeral: true });
    }
    const [, , , idxStr] = i.customId.split(":");
    const idx = Number(idxStr) || 0;
    choices.set(i.user.id, idx);
    await i.reply({
      content: `You chose **${i.component.label}**. The charm takes note...`,
      ephemeral: true,
    });
  });

  return new Promise((resolve) => {
    collector.on("end", async () => {
      await disableButtons(msg);

      // Apply points
      const lines = [];
      for (const [userId, player] of game.players.entries()) {
        if (!choices.has(userId)) {
          lines.push(`• ${player.username} — did not choose (0).`);
          continue;
        }
        const delta = rand([-2, -1, 1, 2]);
        player.points = (player.points || 0) + delta;

        const flavorList = pointFlavors[delta > 0 ? `+${delta}` : `${delta}`] || [];
        const flavor = flavorList.length ? rand(flavorList) : "";
        lines.push(
          `• ${player.username} — **${delta > 0 ? "+" : ""}${delta}** points. ${flavor}`
        );
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("🧮 Mini-game complete. Points applied.")
        .setDescription(lines.join("\n") || "Nobody clicked anything. The charm yawns.")
        .setColor(0x00ff88);

      await broadcast(channel, resultEmbed);
      resolve();
    });
  });
}

// ---------------- Riddle (typed answers in channel) ------
async function runGroupRiddle(channel, game, label = "MID-ROUND RIDDLE") {
  const r = pickRiddle(riddles, game.usedRiddles);
  if (!r) {
    await broadcast(channel, "⚠️ No riddles left. Skipping.");
    return;
  }

  const difficultyLabel =
    r.difficulty === 1
      ? "EASY — Worth +1 point."
      : r.difficulty === 2
      ? "MEDIUM — Worth +2 points."
      : r.difficulty === 3
      ? "HARD — Worth +3 points."
      : "SQUIG SPECIAL — Worth +3 points.";

  const embed = new EmbedBuilder()
    .setTitle(`🧠 ${label}`)
    .setDescription(
      [
        r.riddle,
        "",
        `🌀 Difficulty: **${difficultyLabel}**`,
        "Type your answer in chat (one attempt per player).",
        "⏳ You have **30 seconds**...",
      ].join("\n")
    )
    .setColor(0xff66cc);

  await broadcast(channel, embed);

  const answered = new Set();
  const correctPlayers = [];

  const collector = channel.createMessageCollector({
    time: 30_000,
    filter: (m) => {
      if (!game.players.has(m.author.id)) return false;
      if (m.author.bot) return false;
      if (answered.has(m.author.id)) return false;
      return true;
    },
  });

  collector.on("collect", async (m) => {
    const player = game.players.get(m.author.id);
    if (!player) return;

    answered.add(m.author.id);

    const ans = m.content.trim().toLowerCase();
    const isCorrect = r.answers.some((a) => a.toLowerCase() === ans);

    if (isCorrect) {
      const delta = r.difficulty === 1 ? 1 : r.difficulty === 2 ? 2 : 3;
      player.points = (player.points || 0) + delta;
      correctPlayers.push(player.username);
      await m.react("✅").catch(() => null);
    } else {
      await m.react("❌").catch(() => null);
    }
  });

  return new Promise((resolve) => {
    collector.on("end", async () => {
      const correctCount = correctPlayers.length;
      const summaryEmbed = new EmbedBuilder()
        .setTitle("✅ Riddle completed.")
        .setDescription(
          [
            `${correctCount} player(s) answered correctly and gained **+${r.difficulty}**.`,
            "",
            `🧩 The correct answer was: **${r.answers[0]}**.`,
          ].join("\n")
        )
        .setColor(0x00ff88);

      await broadcast(channel, summaryEmbed);
      resolve();
    });
  });
}

// ---------------- Trust or Doubt -------------------------
async function runTrustOrDoubt(channel, game, roundNumber) {
  const embed = new EmbedBuilder()
    .setTitle(`🤝 ROUND ${roundNumber} — Trust or Doubt`)
    .setDescription(
      [
        "Players click **Trust** or **Doubt**.",
        "If the **majority Trusts**, they gain **+1** — unless the Squig lies, then they get **-1** instead.",
        "Same for Doubt if they’re the majority.",
        "Everyone else: 0.",
        "",
        "⏳ You have **30 seconds**.",
      ].join("\n")
    )
    .setColor(0x00ccff);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("gg:trust")
      .setLabel("Trust")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("gg:doubt")
      .setLabel("Doubt")
      .setStyle(ButtonStyle.Danger)
  );

  const msg = await broadcast(channel, { embeds: [embed], components: [row] });

  const trusters = new Set();
  const doubters = new Set();

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30_000,
  });

  collector.on("collect", async (i) => {
    const player = ensurePlayer(game, i.user);
    if (!player) {
      return i.reply({ content: "You’re not in this Gauntlet.", ephemeral: true });
    }
    // Only last choice counts
    if (i.customId === "gg:trust") {
      trusters.add(i.user.id);
      doubters.delete(i.user.id);
    } else {
      doubters.add(i.user.id);
      trusters.delete(i.user.id);
    }
    await i.reply({
      content: `You chose **${i.customId === "gg:trust" ? "Trust" : "Doubt"}**.`,
      ephemeral: true,
    });
  });

  return new Promise((resolve) => {
    collector.on("end", async () => {
      await disableButtons(msg);

      const tCount = trusters.size;
      const dCount = doubters.size;

      // Decide majority
      let majority = null;
      if (tCount > dCount) majority = "trust";
      else if (dCount > tCount) majority = "doubt";

      const squigLies = Math.random() < 0.5;

      const lines = [];
      lines.push(
        `Trusters (${tCount}): ${
          tCount ? Array.from(trusters).map((id) => game.players.get(id).username).join(", ") : "none"
        }`
      );
      lines.push(
        `Doubters (${dCount}): ${
          dCount ? Array.from(doubters).map((id) => game.players.get(id).username).join(", ") : "none"
        }`
      );
      lines.push("");

      if (!majority) {
        lines.push("Outcome: No clear majority. The Squig shrugs. Nobody gains or loses.");
      } else {
        const affectedSet = majority === "trust" ? trusters : doubters;
        if (!affectedSet.size) {
          lines.push("Outcome: Majority side had no players. The charm is confused.");
        } else {
          const sign = squigLies ? -1 : 1;
          for (const userId of affectedSet) {
            const p = game.players.get(userId);
            p.points = (p.points || 0) + sign;
          }
          if (majority === "trust") {
            lines.push(
              `Outcome: Majority chose **Trust**. Squig ${
                squigLies ? "lied. Trusters -1." : "told the truth. Trusters +1."
              }`
            );
          } else {
            lines.push(
              `Outcome: Majority chose **Doubt**. Squig ${
                squigLies ? "lied. Doubters -1." : "told the truth. Doubters +1."
              }`
            );
          }
        }
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("🤝 Trust or Doubt — Results")
        .setDescription(lines.join("\n"))
        .setColor(0x00ff88);

      await broadcast(channel, resultEmbed);
      resolve();
    });
  });
}

// ---------------- Risk It (group) ------------------------
async function runRiskItGroup(channel, game) {
  const embed = new EmbedBuilder()
    .setTitle("🪙 RISK IT — The Charm Tempts You")
    .setDescription(
      [
        "Between rounds, the static parts... and a Squig grins.",
        "Risk your points for a shot at more — or lose them to the void.",
        "",
        "• **Risk All** — stake everything",
        "• **Risk Half** — stake half",
        "• **Risk Quarter** — stake a quarter (min 1)",
        "• **No Risk** — sit out and watch the chaos",
        "",
        "⏳ You have **20 seconds** to decide.",
      ].join("\n")
    )
    .setColor(0xffaa00);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("gg:risk:all")
      .setLabel("Risk All")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("gg:risk:half")
      .setLabel("Risk Half")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("gg:risk:quarter")
      .setLabel("Risk Quarter")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("gg:risk:none")
      .setLabel("No Risk")
      .setStyle(ButtonStyle.Success)
  );

  const msg = await broadcast(channel, { embeds: [embed], components: [row] });

  const picks = new Map(); // userId -> choice

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 20_000,
  });

  collector.on("collect", async (i) => {
    const player = ensurePlayer(game, i.user);
    if (!player) {
      return i.reply({ content: "You’re not in this Gauntlet.", ephemeral: true });
    }
    picks.set(i.user.id, i.customId.split(":")[2]); // all/half/quarter/none
    await i.reply({
      content: `You chose **${i.component.label}**.`,
      ephemeral: true,
    });
  });

  return new Promise((resolve) => {
    collector.on("end", async () => {
      await disableButtons(msg);

      const lines = [];
      for (const [userId, player] of game.players) {
        const choice = picks.get(userId) || "none";
        const pts = Math.floor(player.points || 0);
        if (choice === "none" || pts <= 0) {
          lines.push(
            `• ${player.username} • ${
              pts <= 0 ? "No points to risk." : "Did not risk."
            } • total: ${player.points || 0}`
          );
          continue;
        }

        let stake = 0;
        let label = "";
        if (choice === "all") {
          stake = pts;
          label = "Risk All";
        } else if (choice === "half") {
          stake = Math.max(1, Math.floor(pts / 2));
          label = "Risk Half";
        } else if (choice === "quarter") {
          stake = Math.max(1, Math.floor(pts / 4));
          label = "Risk Quarter";
        }

        const outcomes = [
          { mult: -1, label: "💀 Lost it all" },
          { mult: 0, label: "😮 Broke even" },
          { mult: 0.5, label: "✨ Won 1.5×" },
          { mult: 1, label: "👑 Doubled" },
        ];

        const out = rand(outcomes);
        const delta = out.mult === -1 ? -stake : Math.round(stake * out.mult);
        player.points = (player.points || 0) + delta;

        lines.push(
          `@${player.username} • ${label} (staked ${stake}) → ${out.label} • ${
            delta > 0 ? "+" : ""
          }${delta} • new total: ${player.points}`
        );
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle("🎲 Risk It — Results")
        .setDescription(lines.join("\n") || "Nobody risked anything. Cowards, the lot.")
        .setColor(0x00ff88);

      await broadcast(channel, resultEmbed);
      resolve();
    });
  });
}

// ---------------- Final Podium ---------------------------
async function showFinalPodium(channel, game) {
  const players = Array.from(game.players.values()).sort(
    (a, b) => (b.points || 0) - (a.points || 0)
  );

  const count = players.length;
  if (!count) {
    await broadcast(channel, "Nobody played. The void wins by default.");
    return;
  }

  const [first, second, third] = players;

  const lines = [];
  lines.push("👁‍🗨️ **THE FINAL PODIUM** 👁‍🗨️");
  lines.push("The charm acknowledges those who rose above...\n");
  lines.push(`👥 **${count} players** participated in this Gauntlet.\n`);

  if (first) {
    lines.push("👑 **Champion of the Charm**");
    lines.push(`• ${first.username} — **${first.points || 0}** points\n`);
  }
  if (second) {
    lines.push("🌑 **Scarred But Standing**");
    lines.push(`• ${second.username} — **${second.points || 0}** points\n`);
  }
  if (third) {
    lines.push("🕳 **Last One Dragged from the Void**");
    lines.push(`• ${third.username} — **${third.points || 0}** points\n`);
  }

  const embed = new EmbedBuilder()
    .setTitle("🏁 The Gauntlet Concludes")
    .setDescription(lines.join("\n"))
    .setColor(0x00ff88);

  await broadcast(channel, embed);
}

// --------------------------------------------------
// GAME ORCHESTRATION
// --------------------------------------------------
async function startGameInChannel(channel, game, introLine) {
  if (game.status !== "lobby") return;
  if (game.startTimeout) clearTimeout(game.startTimeout);
  game.status = "running";

  if (!game.players.size) {
    await broadcast(channel, "No one joined the Gauntlet. The charm goes back to sleep.");
    activeGames.delete(channel.id);
    return;
  }

  // Try to edit lobby message to disable buttons
  if (game.lobbyMessageId) {
    try {
      const lobbyMsg = await channel.messages.fetch(game.lobbyMessageId);
      await disableButtons(lobbyMsg);
    } catch {
      // ignore
    }
  }

  await broadcast(
    channel,
    introLine ||
      "🎬 **The Gauntlet begins!** Buckle up — points will fly, friendships will wobble."
  );

  // Quick list of players
  await broadcast(
    channel,
    `Players (${game.players.size}): ${Array.from(game.players.values())
      .map((p) => p.username)
      .join(", ")}`
  );

  // Round sequence — 6 rounds, echoing the classic vibe:
  // 1) MiniGame + Riddle
  await runGroupMiniGame(channel, game, "ROUND 1");
  await runGroupRiddle(channel, game);

  // 2) Trust or Doubt
  await runTrustOrDoubt(channel, game, 2);

  // 3) MiniGame + Riddle
  await runGroupMiniGame(channel, game, "ROUND 3");
  await runGroupRiddle(channel, game);

  // 4) Risk It
  await runRiskItGroup(channel, game);

  // 5) MiniGame + Riddle
  await runGroupMiniGame(channel, game, "ROUND 5");
  await runGroupRiddle(channel, game);

  // Final podium
  await showFinalPodium(channel, game);

  game.status = "finished";
  activeGames.delete(channel.id);
}

// --------------------------------------------------
// COMMAND REGISTRATION / HANDLER
// --------------------------------------------------
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("groupgauntlet")
      .setDescription("Start a classic group Gauntlet lobby in this channel (admins only).")
      .addIntegerOption((o) =>
        o
          .setName("duration")
          .setDescription("Lobby duration in minutes (default 2, max 30)")
          .setRequired(false)
      ),
  ].map((c) => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  if (GUILD_IDS.length) {
    for (const gid of GUILD_IDS) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, gid), {
        body: commands,
      });
    }
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: commands,
    });
  }
}

async function handleInteractionCreate(interaction) {
  try {
    // Slash command
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "groupgauntlet") {
        if (!isAdminUser(interaction)) {
          return interaction.reply({
            content: "⛔ Only admins can start a Group Gauntlet.",
            ephemeral: true,
          });
        }
        const duration =
          interaction.options.getInteger("duration") ?? 2;
        const safe = Math.max(1, Math.min(30, duration));
        await createLobby(interaction, safe);
        return;
      }
      // Not ours
      return;
    }

    // Lobby buttons & in-game buttons
    if (interaction.isButton()) {
      const [prefix, section, action] = interaction.customId.split(":");
      if (prefix !== "gg") return; // not our button

      const channelId = interaction.channelId;
      const game = activeGames.get(channelId);
      if (!game) {
        return interaction.reply({
          content: "This Gauntlet is no longer active.",
          ephemeral: true,
        });
      }

      // LOBBY BUTTONS
      if (section === "lobby") {
        if (game.status !== "lobby") {
          return interaction.reply({
            content: "The lobby is closed.",
            ephemeral: true,
          });
        }

        if (action === "join") {
          if (game.players.has(interaction.user.id)) {
            return interaction.reply({
              content: "You’re already in.",
              ephemeral: true,
            });
          }
          game.players.set(interaction.user.id, {
            id: interaction.user.id,
            username:
              interaction.user.username ||
              interaction.user.globalName ||
              "Player",
            points: 0,
          });

          // Update lobby embed with player count
          try {
            const ch = await interaction.client.channels.fetch(channelId);
            const msg = await ch.messages.fetch(game.lobbyMessageId);
            const embed = EmbedBuilder.from(msg.embeds[0]);
            embed.setDescription(
              embed.data.description.replace(
                /Current players .*$/s,
                `Current players (${game.players.size}): ${Array.from(
                  game.players.values()
                )
                  .map((p) => `<@${p.id}>`)
                  .join(", ")}`
              )
            );
            await msg.edit({ embeds: [embed] });
          } catch {
            // ignore
          }

          return interaction.reply({
            content: "You joined the Gauntlet.",
            ephemeral: true,
          });
        }

        if (action === "leave") {
          if (!game.players.has(interaction.user.id)) {
            return interaction.reply({
              content: "You’re not in this Gauntlet.",
              ephemeral: true,
            });
          }
          // Don't allow host to leave (they can cancel instead)
          if (interaction.user.id === game.hostId) {
            return interaction.reply({
              content: "The host can’t leave, but can cancel the lobby.",
              ephemeral: true,
            });
          }
          game.players.delete(interaction.user.id);
          return interaction.reply({
            content: "You left the Gauntlet.",
            ephemeral: true,
          });
        }

        if (action === "start") {
          if (
            interaction.user.id !== game.hostId &&
            !isAdminUser(interaction)
          ) {
            return interaction.reply({
              content: "Only the host or an admin can start early.",
              ephemeral: true,
            });
          }
          const ch = await interaction.client.channels.fetch(channelId);
          await interaction.reply({
            content: "Starting the Gauntlet now!",
            ephemeral: true,
          });
          await startGameInChannel(ch, game);
          return;
        }

        if (action === "cancel") {
          if (
            interaction.user.id !== game.hostId &&
            !isAdminUser(interaction)
          ) {
            return interaction.reply({
              content: "Only the host or an admin can cancel.",
              ephemeral: true,
            });
          }
          if (game.startTimeout) clearTimeout(game.startTimeout);
          game.status = "cancelled";
          activeGames.delete(channelId);

          try {
            const ch = await interaction.client.channels.fetch(channelId);
            const msg = await ch.messages.fetch(game.lobbyMessageId);
            await disableButtons(msg);
            const embed = EmbedBuilder.from(msg.embeds[0]);
            embed.setDescription(
              (embed.data.description || "") +
                "\n\n❌ Lobby cancelled by host."
            );
            await msg.edit({ embeds: [embed] });
          } catch {
            // ignore
          }

          return interaction.reply({
            content: "Lobby cancelled.",
            ephemeral: true,
          });
        }
      }

      // Any other gg:* buttons are handled inside collectors in this file,
      // so just ignore here.
    }
  } catch (err) {
    console.error("GroupGauntlet interaction error:", err);
    if (interaction.isRepliable()) {
      try {
        await interaction.reply({
          content: "❌ Something went wrong in Group Gauntlet.",
          ephemeral: true,
        });
      } catch {
        // ignore
      }
    }
  }
}

// --------------------------------------------------
// EXPORTS
// --------------------------------------------------
module.exports = {
  registerCommands,
  handleInteractionCreate,
};
