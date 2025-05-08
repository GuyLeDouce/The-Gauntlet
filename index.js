require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

let gauntletEntrants = [];
let gauntletActive = false;
let joinTimeout = null;
let gauntletChannel = null;
let gauntletMessage = null;
let activeBoons = {};
let activeCurses = {};

const trialNames = [
  "Trial of the Screaming Mire", "The Eldritch Scramble", "Trial of the Shattered Bones",
  "The Maw's Hunger", "Dance of the Ugly Reflection", "Trial of the Crooked Path",
  "Storm of the Severed Sky", "Gauntlet of Broken Dreams", "The Echoing Crawl",
  "The Wretched Spiral"
];

const eliminationEvents = [
  "was dragged into the swamp by unseen claws.",
  "tried to pet a malformed dog. It bit back... with ten mouths.",
  "got yeeted off the platform by a sentient fart cloud.",
  "exploded after lighting a fart too close to a rune circle.",
  "was judged too handsome and instantly vaporized.",
  "spoke in rhymes one too many times.",
  "was too ugly. Even for the Malformed.",
  "turned into a rubber duck and floated away.",
  "got tangled in the Lore Scrolls and suffocated.",
  "joined the wrong Discord and disappeared forever."
];

const specialEliminations = [
  "was sacrificed to the ancient hairball under the couch.",
  "rolled a 1 and summoned their ex instead.",
  "flexed too hard and imploded with style.",
  "said ‘GM’ too late and was banished to Shadow Realm.",
  "was cursed by a malformed meme and vaporized in shame.",
  "drew a red card. From a black deck. Gone.",
  "used Comic Sans in a summoning circle.",
  "forgot to use dark mode and burned alive.",
  "glitched into another chain. Nobody followed.",
  "was outed as an undercover Handsome and disqualified."
];

const revivalEvents = [
  "was too ugly to stay dead and clawed their way back!",
  "emerged from the swamp, covered in mud and vengeance.",
  "refused to die and bribed fate with $CHARM.",
  "sacrificed a toe and was reborn in pixelated agony.",
  "got patched in a hotfix and returned.",
  "possessed their own corpse. Classic.",
  "used their Uno Reverse card at the perfect time.",
  "was pulled back by the chants of the community.",
  "glitched through the floor, then glitched back.",
  "got spit out by a mimic. Again."
];
const playerCommands = {}; // Tracks who has used a command
const tauntTargets = {};   // Stores taunt targets
const dodgeAttempts = {};  // Tracks dodge attempts
const hideAttempts = {};   // Tracks hide attempts

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'join_gauntlet' && gauntletActive) {
    if (!gauntletEntrants.find(e => e.id === interaction.user.id)) {
      gauntletEntrants.push({ id: interaction.user.id, username: interaction.user.username });
      await interaction.reply({ content: 'You have joined the Ugly Gauntlet! Prepare yourself…', flags: 64 });

      if (gauntletMessage && gauntletMessage.editable) {
        const embed = gauntletMessage.embeds[0];
        const updatedEmbed = {
          ...embed.data,
          description: embed.description.replace(/🧟 Entrants so far: \d+/, `🧟 Entrants so far: ${gauntletEntrants.length}`)
        };
        await gauntletMessage.edit({ embeds: [updatedEmbed] });
      }
    } else {
      await interaction.reply({ content: 'You have already joined this round!', flags: 64 });
    }
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const content = message.content.trim();

  if (content === '!gauntlet') startGauntlet(message.channel, 10);
  if (content.startsWith('!gauntlet ')) {
    const delay = parseInt(content.split(' ')[1], 10);
    startGauntlet(message.channel, isNaN(delay) ? 10 : delay);
  }
  if (content === '!startg') {
    if (gauntletActive) {
      clearTimeout(joinTimeout);
      runGauntlet(message.channel);
    } else {
      message.channel.send('No Gauntlet is currently running. Use !gauntlet to begin one.');
    }
  }
  if (content === '!gauntlettrial') {
    if (gauntletActive) return message.channel.send('A Gauntlet is already running.');
    gauntletEntrants = Array.from({ length: 20 }, (_, i) => ({ id: `MockUser${i + 1}`, username: `MockPlayer${i + 1}` }));
    gauntletActive = true;
    gauntletChannel = message.channel;
    await message.channel.send('🧪 **Trial Mode Activated:** 20 mock players have entered The Gauntlet! Running simulation now...');
    await new Promise(r => setTimeout(r, 1000));
    runGauntlet(message.channel);
  }
});
client.on('messageCreate', async (message) => {
  if (!gauntletActive || message.author.bot) return;
  const userId = message.author.id;

  // Ignore if already used a command
  if (playerCommands[userId]) {
    message.reply("🛑 You’ve already used your command for this Gauntlet.");
    return;
  }

  const command = message.content.toLowerCase();

  if (command === '!dodge') {
    playerCommands[userId] = true;
    if (Math.random() < 0.10) {
      dodgeAttempts[userId] = true;
      message.reply("🌀 You prepare to dodge fate...");
    } else {
      message.reply("😬 You braced... but nothing happened.");
    }
  }

  if (command === '!taunt') {
    playerCommands[userId] = true;
    const alive = gauntletEntrants.filter(p => p !== userId);
    if (alive.length > 0) {
      const target = alive[Math.floor(Math.random() * alive.length)];
      tauntTargets[target] = true;
      message.reply(`🔥 You mocked your enemies... and now **<@${target}>** is marked!`);
    }
  }

  if (command === '!hide') {
    playerCommands[userId] = true;
    if (Math.random() < 0.10) {
      hideAttempts[userId] = true;
      message.reply("👻 You vanish into the shadows...");
    } else {
      message.reply("😶 You tried to hide, but the shadows rejected you.");
    }
  }
});

async function startGauntlet(channel, delay) {
  if (gauntletActive) return;
  gauntletEntrants = [];
  gauntletActive = true;
  gauntletChannel = channel;

  const joinButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('join_gauntlet').setLabel('Join the Ugly Gauntlet').setStyle(ButtonStyle.Primary)
  );

  gauntletMessage = await channel.send({
    embeds: [{
      title: '🏁 The Ugly Gauntlet Has Begun!',
      description: `Click to enter. You have ${delay} minutes.\n🧟 Entrants so far: 0`,
      color: 0x6e40c9
    }],
    components: [joinButton]
  });

  const totalMs = delay * 60 * 1000;

joinTimeout = setTimeout(() => {
  if (gauntletEntrants.length < 1) {
    channel.send('Not enough entrants joined. Try again later.');
    gauntletActive = false;
  } else {
    runGauntlet(channel);
  }
}, totalMs);

// ⏳ Countdown warnings every 1/3 of the time
const intervalMs = totalMs / 3;

setTimeout(() => {
  channel.send(`⏳ One third of the time has passed. **${Math.round((delay * 2) / 3)} minutes left** to join the Gauntlet...`);
}, intervalMs);

setTimeout(() => {
  channel.send(`⚠️ Two thirds of the countdown are gone. Only **${Math.round(delay / 3)} minutes** remain to join!`);
}, intervalMs * 2);

setTimeout(() => {
  channel.send(`🕰️ Final moment! The Gauntlet will begin **any second now...**`);
}, intervalMs * 3 - 5000); // 5 seconds before start

}
async function runGauntlet(channel) {
  gauntletActive = false;
  let remaining = [...gauntletEntrants];
  let roundCounter = 1;
  activeBoons = {};
  activeCurses = {};

  // 🦍 Choose the Ugly Boss
  const boss = remaining[Math.floor(Math.random() * remaining.length)];
  await channel.send(`👹 A foul stench rises... <@${boss.id}> has been chosen as the **UGLY BOSS**! If they make it to the podium, they earn **double $CHARM**...`);

  while (remaining.length > 3) {
    const eliminations = Math.min(2, remaining.length - 3);
    const eliminated = [];

    // 🔮 Random Boons & Curses — 20% chance per player
    for (const player of remaining) {
      const fate = Math.random();
      if (fate < 0.2) {
        activeCurses[player.id] = true;
        await channel.send(`👿 The Malformed whisper... <@${player.id}> has been **cursed** this round.`);
      } else if (fate < 0.4) {
        activeBoons[player.id] = true;
        await channel.send(`🕊️ A strange glow surrounds <@${player.id}> — they’ve been **blessed** by the Gauntlet!`);
      }
    }

    // 🗳️ AUDIENCE POLL (40% chance)
    let cursedPlayerId = null;
    if (remaining.length >= 3 && Math.random() < 0.4) {
      const pollPlayers = remaining.slice(0, 3);
      const pollMsg = await channel.send({
        embeds: [{
          title: "👁️ AUDIENCE POLL",
          description:
            `The malformed crowd stirs...\nWho deserves the next curse?\n\n✅ = <@${pollPlayers[0].id}>\n🔥 = <@${pollPlayers[1].id}>\n💀 = <@${pollPlayers[2].id}>`,
          color: 0x880808
        }]
      });

      await pollMsg.react('✅');
      await pollMsg.react('🔥');
      await pollMsg.react('💀');
      await new Promise(resolve => setTimeout(resolve, 15000));

      const reactions = pollMsg.reactions.cache;
      const voteCounts = {
        [pollPlayers[0].id]: reactions.get('✅')?.count - 1 || 0,
        [pollPlayers[1].id]: reactions.get('🔥')?.count - 1 || 0,
        [pollPlayers[2].id]: reactions.get('💀')?.count - 1 || 0,
      };

      const maxVotes = Math.max(...Object.values(voteCounts));
      const cursedIds = Object.entries(voteCounts)
        .filter(([_, count]) => count === maxVotes)
        .map(([id]) => id);

      cursedPlayerId = cursedIds[Math.floor(Math.random() * cursedIds.length)];
      await channel.send(`😨 The crowd has spoken... <@${cursedPlayerId}> is marked by the malformed gaze.`);
    }

    const trial = trialNames[Math.floor(Math.random() * trialNames.length)];
    let eliminationDescriptions = [];

    for (let i = 0; i < eliminations; i++) {
      let player;
      let isForced = false;

      if (i === 0 && cursedPlayerId) {
        const cursed = remaining.find(p => p.id === cursedPlayerId);
        if (cursed) {
          player = cursed;
          remaining = remaining.filter(p => p.id !== cursedPlayerId);
          isForced = true;
        }
      }

      if (!player) {
        player = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
      }

      // 🛡️ Boon Protection
      if (activeBoons[player.id]) {
        eliminationDescriptions.push(`✨ <@${player.id}> was protected by a boon and dodged elimination!`);
        delete activeBoons[player.id];
        remaining.push(player);
        continue;
      }

      // 💀 Curse Force Elimination
      if (activeCurses[player.id]) {
        eliminationDescriptions.push(`💀 <@${player.id}> succumbed to their curse! No escape this time.`);
        delete activeCurses[player.id];
        eliminated.push(player);
        continue;
      }

      // 👹 Boss Defense
      if (player.id === boss.id && Math.random() < 0.5) {
        eliminationDescriptions.push(`🛑 <@${player.id}> is the Boss — and shrugged off the attack with monstrous defiance!`);
        remaining.push(player);
        continue;
      }

      eliminated.push(player);

      const useSpecial = Math.random() < 0.15;
      const reason = useSpecial
        ? specialEliminations[Math.floor(Math.random() * specialEliminations.length)]
        : eliminationEvents[Math.floor(Math.random() * eliminationEvents.length)];

      if (useSpecial) {
        const style = Math.floor(Math.random() * 3);
        if (style === 0) {
          eliminationDescriptions.push(`━━━━━━━━━━ 👁‍🗨 THE MALFORMED STRIKE 👁‍🗨 ━━━━━━━━━━\n❌ <@${player.id}> ${reason}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        } else if (style === 1) {
          eliminationDescriptions.push(`⚠️💀⚠️ SPECIAL FATE ⚠️💀⚠️\n❌ <@${player.id}> ${reason}\n🩸🧟‍♂️😈👁🔥👣🪦🧠👃`);
        } else {
          eliminationDescriptions.push(`**💥 Cursed Spotlight: <@${player.id}> 💥**\n_${reason}_`);
        }
      } else {
        eliminationDescriptions.push(`❌ <@${player.id}> ${reason}`);
      }
    }

    // 🌱 Rare Revival
    if (eliminated.length && Math.random() < 0.15) {
      const revived = eliminated.splice(Math.floor(Math.random() * eliminated.length), 1)[0];
      remaining.push(revived);
      const reviveMsg = revivalEvents[Math.floor(Math.random() * revivalEvents.length)];
      eliminationDescriptions.push(`💫 <@${revived.id}> ${reviveMsg}`);
    }

    // Reset Boons/Curses each round
    activeBoons = {};
    activeCurses = {};

    if (remaining.length > 3) {
      eliminationDescriptions.push(`\n👣 **${remaining.length} players remain. The Gauntlet continues...**`);
    }

    const tokenId = Math.floor(Math.random() * 530) + 1;
    const nftImage = `https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/${tokenId}`;

    await channel.send({
      embeds: [{
        title: `⚔️ Round ${roundCounter} — ${trial}`,
        description: eliminationDescriptions.join('\n'),
        color: 0x8b0000,
        image: {
          url: nftImage
        }
      }]
    });

    roundCounter++;
    await new Promise(r => setTimeout(r, 10000));
  }

  const [first, second, third] = remaining;

  let resultMessage = `**1st Place:** <@${first.id}> — **50 $CHARM**\n**2nd Place:** <@${second.id}> — **25 $CHARM**\n**3rd Place:** <@${third.id}> — **10 $CHARM**`;

  if ([first.id, second.id, third.id].includes(boss.id)) {
    await channel.send(`👑 The **Ugly Boss** <@${boss.id}> survived to the end. Their reward is **doubled**!`);
    if (first.id === boss.id) resultMessage = resultMessage.replace("50 $CHARM", "100 $CHARM");
    if (second.id === boss.id) resultMessage = resultMessage.replace("25 $CHARM", "50 $CHARM");
    if (third.id === boss.id) resultMessage = resultMessage.replace("10 $CHARM", "20 $CHARM");
  }

  await channel.send({
    embeds: [{
      title: '🏆 Champions of the Ugly Gauntlet!',
      description: resultMessage + `\n\nThe Gauntlet has spoken. Well fought, Champions!`,
      color: 0xdaa520
    }]
  });
}


client.login(process.env.DISCORD_TOKEN);
