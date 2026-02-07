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

// ?? Group mode command + handler
const {
  groupGauntletCommand,
  handleGroupInteractionCreate,
} = require("./groupGauntlet");

const { runSurvival } = require("./survival");
const { rewardCharmAmount, logCharmReward } = require("./drip");

// --------------------------------------------
// Small helpers
// --------------------------------------------
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

// --------------------------------------------
// Survival lobby state (single instance)
// --------------------------------------------
let survivalLobby = null;

function buildSurvivalLobbyEmbed(era, count) {
  const lines = [
    "Click **Join** to enter **Squig Survival**.",
    "Try out life as a Squig stumbling through Earth.",
    "",
    `Players joined: **${count}**`,
    "",
    "When staff run **/survivestart**, the portal snaps shut.",
  ];

  if (era) {
    lines.push("", `Era: **${era}**`);
  }

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
  survivalLobby = null;
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
        )}_\n\n? You have **30 seconds** to choose.`
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
    await sendEphemeral(interaction, { content: "? Time’s up — no choice, no change." });
    return;
  }

  const delta = rand([-2, -1, 1, 2]);
  player.points += delta;

  const flavorList = pointFlavors[delta > 0 ? `+${delta}` : `${delta}`] || [];
  const flavor = flavorList.length ? rand(flavorList) : "";

  await click.reply({
    content: `You chose **${click.component.label}** ? **${
      delta > 0 ? "+" : ""
    }${delta}**. ${flavor}\n**New total:** ${player.points}`,
    flags: 64,
  });
}

async function runRiddleEphemeral(interaction, player, usedRiddle) {
  const r = pickRiddle(usedRiddle);
  if (!r) {
    await sendEphemeral(interaction, { content: "?? No riddles left. Skipping." });
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
      .setTitle("?? RIDDLE TIME")
      .setDescription(
        `_${r.riddle}_\n\n?? Difficulty: **${difficultyLabel}** — Worth **+${r.difficulty}**.\n? You have **30 seconds**.`
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
      content: `? Time’s up! Correct answer: **${r.answers[0]}**.`,
    });
    setTimeout(async () => {
      try {
        await riddleMsg.delete();
      } catch {}
    }, 1_000);
    return;
  }

  const remaining = Math.max(1_000, endAt - Date.now());

  // ?? Modal with riddle shown as placeholder
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
        .setPlaceholder(displayRiddle) // ?? riddle reminder
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
      content: `? No answer submitted. Correct: **${r.answers[0]}**.`,
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
        content: `? Correct! **+${r.difficulty}**. **Current total:** ${player.points}`,
        flags: 64,
      });
    } else {
      await submit.reply({
        content: `? Not quite. Correct: **${r.answers[0]}**.\n**Current total:** ${player.points}`,
        flags: 64,
      });
    }
  } catch {
    await sendEphemeral(interaction, {
      content: correct
        ? `? Correct! **+${r.difficulty}**. **Current total:** ${player.points}`
        : `? Not quite. Correct: **${r.answers[0]}**.\n**Current total:** ${player.points}`,
    });
  }

  setTimeout(async () => {
    try {
      await riddleMsg.delete();
    } catch {}
  }, 1_000);
}

async function runLabyrinthEphemeral(interaction, player) {
  const title = "?? The Labyrinth of Wrong Turns";
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
            "Find the exact **4-step** path.\n? Each step **+1**, ?? escape **+2**.\n? **60s** total."
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
      await click.reply({ content: "? Correct step!", flags: 64 });
    } else {
      alive = false;
      await click.reply({ content: "?? Dead end!", flags: 64 });
    }
  }

  if (step === 4) {
    earned += 2;
    await sendEphemeral(interaction, { content: `?? You escaped! **+${earned}**` });
  } else if (earned > 0) {
    await sendEphemeral(interaction, {
      content: `?? You managed **${earned}** step${earned === 1 ? "" : "s"}.`,
    });
  } else {
    await sendEphemeral(interaction, {
      content: "?? Lost at the first turn. **0**.",
    });
  }

  player.points += earned;
}

async function runRouletteEphemeral(interaction, player) {
  const embed = withScore(
    new EmbedBuilder()
      .setTitle("?? Squig Roulette")
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
      content: "?? No pick. The die rolls away.",
    });
    return;
  }

  const pickNum = Number(click.component.label);
  const rolled = 1 + Math.floor(Math.random() * 6);

  if (pickNum === rolled) {
    player.points += 2;
    await click.reply({
      content: `?? You picked **${pickNum}**. Rolled **${rolled}**. **+2**.`,
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
      .setTitle("?? Risk It")
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
      content: "? No decision — charm moves on.",
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
    { mult: -1, label: "?? Lost it all" },
    { mult: 0, label: "?? Broke even" },
    { mult: 0.5, label: "? Won 1.5×" },
    { mult: 1, label: "?? Doubled" },
  ];

  const out = rand(outcomes);
  const delta = out.mult === -1 ? -stake : Math.round(stake * out.mult);
  player.points += delta;

  await click.reply({
    content: `${label} ? ${out.label}. **${
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
          .setTitle("?? The Gauntlet — Solo Mode")
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
      ? "?? The charm purrs. You wear the static like a crown."
      : final >= 6
      ? "?? The Squigs nod in approval. You’ll be remembered by at least three of them."
      : final >= 0
      ? "?? You survived the weird. The weird survived you."
      : "?? The void learned your name. It may return it later.";

  await sendEphemeral(interaction, {
    embeds: [
      new EmbedBuilder()
        .setTitle("?? Your Final Score")
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
      amount: 50,
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
    .setTitle(`?? Leaderboard — ${month}`)
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
      .setDescription("Open a Squig Survival lobby.")
      .addStringOption((o) =>
        o
          .setName("era")
          .setDescription("Optional label for this Survival era (e.g. 'Holiday Trials').")
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("survivestart")
      .setDescription("Start the active Squig Survival lobby."),
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
    .setTitle("?? The Gauntlet — Solo Mode")
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
            content: "? Only admins can post the Gauntlet panel.",
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
          .setTitle(`?? Recent Runs — ${month}`)
          .setDescription(lines)
          .setColor(0x00ccff);

        return interaction.editReply({ embeds: [embed] });
      }

      // /gauntletinfo
      if (interaction.commandName === "gauntletinfo") {
        await interaction.deferReply({ ephemeral: true });
        const embed = new EmbedBuilder()
          .setTitle("?? Welcome to The Gauntlet — Solo Edition")
          .setDescription(
            [
              "Play **any time** via ephemeral messages. One run per day (Toronto time).",
              "",
              "**Flow:**",
              "1) MiniGame ? Riddle",
              "2) Labyrinth",
              "3) MiniGame ? Riddle",
              "4) Squig Roulette",
              "5) MiniGame ? Riddle",
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
          .setTitle(`?? Your Gauntlet — ${month}`)
          .setDescription(
            `**Best:** ${mine.best}\n**Total:** ${mine.total}\n**Plays:** ${mine.plays}`
          )
          .setColor(0x00ccff);

        return interaction.editReply({ embeds: [embed] });
      }

      // /survive  (Squig Survival mini-game)
      if (interaction.commandName === "survive") {
        if (survivalLobby) {
          return interaction.reply({
            content:
              "A /survive lobby is already active. Use /survivestart to begin or end/cancel it.",
            flags: 64,
          });
        }

        const channel = interaction.channel;
        if (!channel) {
          return interaction.reply({
            content: "? Can't find channel for this command.",
            flags: 64,
          });
        }

        const era = interaction.options.getString("era") || null;

        const joinEmbed = buildSurvivalLobbyEmbed(era, 0);

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
            .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({
          embeds: [joinEmbed],
          components: [joinRow],
        });

        const joinMessage = await interaction.fetchReply();
        const joined = new Set();

        survivalLobby = {
          created_by: interaction.user.id,
          created_at: new Date().toISOString(),
          joined,
          game_status: "lobby",
          channel_id: channel.id,
          guild_id: channel.guildId,
          join_message_id: joinMessage.id,
          join_message: joinMessage,
          era,
          collector: null,
        };

        return;
      }

      // /survivestart
      if (interaction.commandName === "survivestart") {
        if (!survivalLobby || survivalLobby.game_status !== "lobby") {
          return interaction.reply({
            content: "No active /survive lobby. Run /survive first.",
            flags: 64,
          });
        }

        survivalLobby.game_status = "running";
        if (survivalLobby.collector) {
          try {
            survivalLobby.collector.stop("start");
          } catch {}
        }

        const players = Array.from(survivalLobby.joined || []);
        const era = survivalLobby.era || null;
        const channel =
          interaction.client.channels.cache.get(survivalLobby.channel_id) ||
          interaction.channel;

        if (!channel) {
          clearSurvivalLobby();
          return interaction.reply({
            content: "? Can't find the Survival lobby channel.",
            flags: 64,
          });
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
          return interaction.reply({
            content: "No players joined. Lobby cancelled.",
            flags: 64,
          });
        }

        await interaction.reply({
          content: "Squig Survival starting.",
          flags: 64,
        });
        await channel.send("Game starting now - time will be announced by staff.");

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
          await runSurvival(channel, players, era);
        } finally {
          clearSurvivalLobby();
        }

        return;
      }
    }

    // Survival lobby buttons
    if (interaction.isButton() && interaction.customId.startsWith("survive:")) {
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
          const updated = buildSurvivalLobbyEmbed(
            survivalLobby.era,
            survivalLobby.joined.size
          );
          await survivalLobby.join_message.edit({ embeds: [updated] });
        } catch {}
        return interaction.reply({
          content: "You joined the Squig Survival lobby.",
          flags: 64,
        });
      }

      if (interaction.customId === "survive:leave") {
        survivalLobby.joined.delete(userId);
        try {
          const updated = buildSurvivalLobbyEmbed(
            survivalLobby.era,
            survivalLobby.joined.size
          );
          await survivalLobby.join_message.edit({ embeds: [updated] });
        } catch {}
        return interaction.reply({
          content: "You left the Squig Survival lobby.",
          flags: 64,
        });
      }

      if (interaction.customId === "survive:list") {
        const ids = Array.from(survivalLobby.joined || []);
        const list = ids.length ? ids.map((id) => `<@${id}>`).join("\n") : "None";
        return interaction.reply({
          content: `Players joined (${ids.length}):\n${list}`,
          flags: 64,
        });
      }
    }

    // Start button
    if (interaction.isButton() && interaction.customId === "gauntlet:start") {
      await interaction.deferReply({ ephemeral: true });
      const today = torontoDateStr();
      const played = await Store.hasPlayed(interaction.user.id, today);

      if (played) {
        const when = nextTorontoMidnight();
        return interaction.editReply({
          content: `? You've already played today. Come back after **${when} (Toronto)**.`,
        });
      }

      await interaction.editReply({
        content: "?? Your Gauntlet run begins now (ephemeral). Good luck!",
      });

      const final = await runSoloGauntletEphemeral(interaction);

      try {
        await interaction.followUp({
          content: `? <@${interaction.user.id}> finished a run with **${final}** points.`,
          ephemeral: false,
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
            content: "? Something went wrong.",
            flags: 64,
          });
        } else {
          await interaction.reply({
            content: "? Something went wrong.",
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
};



