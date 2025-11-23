// src/soloGauntlet.js
// Solo-mode Gauntlet controller: commands, buttons, and ephemeral game flow.

const {
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
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

// 👉 NEW: import group mode command + handler
const {
  groupGauntletCommand,
  handleGroupInteractionCreate,
} = require("./groupGauntlet");

// --------------------------------------------
// Small helpers
// --------------------------------------------
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function sendEphemeral(interaction, payload) {
  const { noExpire, ...rest } = payload;
  let msg;

  const base = { ...rest, flags: 64, fetchReply: true };

  if (interaction.deferred || interaction.replied) {
    msg = await interaction.followUp(base);
  } else {
    msg = await interaction.reply(base);
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
  const replyMsg = msg instanceof Promise ? await msg : msg;
  const picked = await replyMsg
    .awaitMessageComponent({ componentType: ComponentType.Button, time: timeMs })
    .catch(() => null);

  try {
    const rows = (components || []).map((row) =>
      new ActionRowBuilder().addComponents(
        row.components.map((b) => ButtonBuilder.from(b).setDisabled(true))
      )
    );
    await replyMsg.edit({ components: rows });
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
    await sendEphemeral(interaction, { content: "⏰ Time’s up — no choice, no change." });
    return;
  }

  const delta = rand([-2, -1, 1, 2]);
  player.points += delta;

  const flavorList = pointFlavors[delta > 0 ? `+${delta}` : `${delta}`] || [];
  const flavor = flavorList.length ? rand(flavorList) : "";

  await click.reply({
    content: `You chose **${click.component.label}** → **${
      delta > 0 ? "+" : ""
    }${delta}**. ${flavor}\n**New total:** ${player.points}`,
    ephemeral: true,
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
      .setTitle("🧠 RIDDLE TIME")
      .setDescription(
        `_${r.riddle}_\n\n🌀 Difficulty: **${difficultyLabel}** — Worth **+${r.difficulty}**.\n⏳ You have **30 seconds**.`
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
      content: `⏰ Time’s up! Correct answer: **${r.answers[0]}**.`,
    });
    setTimeout(async () => {
      try {
        await riddleMsg.delete();
      } catch {}
    }, 1_000);
    return;
  }

  const remaining = Math.max(1_000, endAt - Date.now());
  const modal = new ModalBuilder().setCustomId("riddle:modal").setTitle("Your Answer");
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("riddle:input")
        .setLabel("Type your answer")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
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
      content: `⏰ No answer submitted. Correct: **${r.answers[0]}**.`,
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
  const title = "🌀 The Labyrinth of Wrong Turns";
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
            "Find the exact **4-step** path.\n✅ Each step **+1**, 🏆 escape **+2**.\n⏳ **60s** total."
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

    const prompt = await sendEphemeral(interaction, {
      content: `Labyrinth step **${step + 1}** — choose:`,
      components: [row],
    });

    const msg = prompt instanceof Promise ? await prompt : prompt;
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
      await click.reply({ content: "✅ Correct step!", ephemeral: true });
    } else {
      alive = false;
      await click.reply({ content: "💀 Dead end!", ephemeral: true });
    }
  }

  if (step === 4) {
    earned += 2;
    await sendEphemeral(interaction, { content: `🏁 You escaped! **+${earned}**` });
  } else if (earned > 0) {
    await sendEphemeral(interaction, {
      content: `🪤 You managed **${earned}** step${earned === 1 ? "" : "s"}.`,
    });
  } else {
    await sendEphemeral(interaction, {
      content: "😵 Lost at the first turn. **0**.",
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

  const m = msg instanceof Promise ? await msg : msg;
  const click = await m
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
    await m.edit({ components: [disable(row1), disable(row2)] });
  } catch {}

  if (!click) {
    await sendEphemeral(interaction, {
      content: "😴 No pick. The die rolls away.",
    });
    return;
  }

  const pick = Number(click.component.label);
  const rolled = 1 + Math.floor(Math.random() * 6);

  if (pick === rolled) {
    player.points += 2;
    await click.reply({
      content: `🎉 You picked **${pick}**. Rolled **${rolled}**. **+2**.`,
      ephemeral: true,
    });
  } else {
    await click.reply({
      content: `You picked **${pick}**. Rolled **${rolled}**. No match.`,
      ephemeral: true,
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

  const m = msg instanceof Promise ? await msg : msg;
  const click = await m
    .awaitMessageComponent({
      componentType: ComponentType.Button,
      time: 20_000,
    })
    .catch(() => null);

  try {
    await m.edit({
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
      ephemeral: true,
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
    { mult: 0, label: "😮 Broke even" },
    { mult: 0.5, label: "✨ Won 1.5×" },
    { mult: 1, label: "👑 Doubled" },
  ];

  const out = rand(outcomes);
  const delta = out.mult === -1 ? -stake : Math.round(stake * out.mult);
  player.points += delta;

  await click.reply({
    content: `${label} → ${out.label}. **${
      delta > 0 ? "+" : ""
    }${delta}**. New total: **${player.points}**`,
    ephemeral: true,
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
      ? "👑 The charm purrs. You wear the static like a crown."
      : final >= 6
      ? "💫 The Squigs nod in approval. You’ll be remembered by at least three of them."
      : final >= 0
      ? "🪵 You survived the weird. The weird survived you."
      : "💀 The void learned your name. It may return it later.";

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
// COMMAND REGISTRATION
// --------------------------------------------
async function registerCommands() {
  const commands = [
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
  ].map((c) => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  // If GUILD_IDS is set, try per-guild; if not, register globally
  if (GUILD_IDS.length) {
    for (const gid of GUILD_IDS) {
      try {
        await rest.put(
          Routes.applicationGuildCommands(CLIENT_ID, gid),
          { body: commands }
        );
        console.log(`[GAUNTLET:CMD] Registered solo commands for guild ${gid}`);
      } catch (err) {
        console.error(
          `[GAUNTLET:CMD] Failed to register solo commands for guild ${gid}:`,
          err.rawError || err
        );
        // Don't crash the bot if one guild is bad
        continue;
      }
    }
  } else {
    try {
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
      console.log("[GAUNTLET:CMD] Registered solo commands globally");
    } catch (err) {
      console.error("[GAUNTLET:CMD] Failed to register solo commands globally:", err.rawError || err);
    }
  }
}


// --------------------------------------------
// PANEL & ADMIN CHECK
// --------------------------------------------
function startPanelEmbed() {
  return new EmbedBuilder()
    .setTitle("🎮 The Gauntlet — Solo Mode")
    .setDescription(
      [
        "Click **Start** to play privately via **ephemeral** messages in this channel.",
        "You can play **once per day** (Toronto time). Every run is **saved**. Monthly LB shows **best** per user (total points = tiebreaker).",
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
      .setStyle(ButtonStyle.Success)
  );
}

function isAdminUser(interaction) {
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
      // /groupgauntlet → group mode
      if (interaction.commandName === "groupgauntlet") {
        await handleGroupInteractionCreate(interaction);
        return;
      }

      // /gauntlet
      if (interaction.commandName === "gauntlet") {
        if (!isAdminUser(interaction)) {
          return interaction.reply({
            content: "⛔ Only admins can post the Gauntlet panel.",
            ephemeral: true,
          });
        }
        return interaction.reply({
          embeds: [startPanelEmbed()],
          components: [startPanelRow()],
        });
      }

      // /gauntletlb
      if (interaction.commandName === "gauntletlb") {
        const month = interaction.options.getString("month") || currentMonthStr();
        const embed = await renderLeaderboardEmbed(month);
        const sent = await interaction.reply({ embeds: [embed], fetchReply: true });
        try {
          await Store.upsertLbMessage(
            interaction.guildId,
            interaction.channelId,
            month,
            sent.id
          );
        } catch {}
        return;
      }

      // /gauntletrecent
      if (interaction.commandName === "gauntletrecent") {
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
          .setTitle(`🧾 Recent Runs — ${month}`)
          .setDescription(lines)
          .setColor(0x00ccff);

        return interaction.reply({ embeds: [embed] });
      }

      // /gauntletinfo
      if (interaction.commandName === "gauntletinfo") {
        const embed = new EmbedBuilder()
          .setTitle("📖 Welcome to The Gauntlet — Solo Edition")
          .setDescription(
            [
              "Play **any time** via ephemeral messages. One run per day (Toronto time).",
              "",
              "**Flow:**",
              "1) MiniGame → Riddle",
              "2) Labyrinth",
              "3) MiniGame → Riddle",
              "4) Squig Roulette",
              "5) MiniGame → Riddle",
              "6) Risk It",
              "",
              "Leaderboard ranks **highest single-game score**, with **total monthly points** as tiebreaker.",
            ].join("\n")
          )
          .setColor(0x00ccff);

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // /mygauntlet
      if (interaction.commandName === "mygauntlet") {
        const month = currentMonthStr();
        const mine = await Store.getMyMonth(interaction.user.id, month);

        const embed = new EmbedBuilder()
          .setTitle(`📊 Your Gauntlet — ${month}`)
          .setDescription(
            `**Best:** ${mine.best}\n**Total:** ${mine.total}\n**Plays:** ${mine.plays}`
          )
          .setColor(0x00ccff);

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    // Start button
    if (interaction.isButton() && interaction.customId === "gauntlet:start") {
      const today = torontoDateStr();
      const played = await Store.hasPlayed(interaction.user.id, today);

      if (played) {
        const when = nextTorontoMidnight();
        return interaction.reply({
          content: `⛔ You've already played today. Come back after **${when} (Toronto)**.`,
          ephemeral: true,
        });
      }

      await interaction.reply({
        content: "🎬 Your Gauntlet run begins now (ephemeral). Good luck!",
        ephemeral: true,
      });

      const final = await runSoloGauntletEphemeral(interaction);

      try {
        await interaction.followUp({
          content: `✅ <@${interaction.user.id}> finished a run with **${final}** points.`,
          ephemeral: false,
        });
      } catch {}

      return;
    }
  } catch (err) {
    console.error("interaction error:", err);
    if (interaction.isRepliable()) {
      try {
        await interaction.reply({
          content: "❌ Something went wrong.",
          ephemeral: true,
        });
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
};
