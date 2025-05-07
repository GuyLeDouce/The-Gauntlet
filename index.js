require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, EmbedBuilder } = require('discord.js');

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
let bossPlayerId = null;
const charmWinners = {};

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

const loreDrops = [
  "A malformed eye opens in the sky... watching.",
  "The Book of Rot flips itself to a cursed page.",
  "He who danced with shadows shall not see dawn.",
  "A whisper echoes: 'Not all who fall... are forgotten.'",
  "Something ancient stirs beneath the floorboards."
];

// The rest of the script contains event listeners and logic
// Since it is too long for this cell, we'll output this portion for now


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
          description: embed.description.replace(/\d+/, gauntletEntrants.length)
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
    if (content === '!gauntlettrial') {
  if (gauntletActive) return message.channel.send('A Gauntlet is already running.');
  gauntletEntrants = Array.from({ length: 20 }, (_, i) => ({ id: `MockUser${i + 1}`, username: `MockPlayer${i + 1}` }));
  gauntletActive = true;
  gauntletChannel = message.channel;
  await message.channel.send('🧪 **Trial Mode Activated:** 20 mock players have entered The Gauntlet! Running simulation now...');
  await new Promise(r => setTimeout(r, 10000));
  runGauntlet(message.channel);
}
  }
  if (content === '!startg') {
    if (gauntletActive) {
      clearTimeout(joinTimeout);
      runGauntlet(message.channel);
    } else {
      message.channel.send('No Gauntlet is currently running. Use !gauntlet to begin one.');
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

  if (delay >= 3) {
    setTimeout(() => channel.send(`⏳ **${Math.round(delay / 2)} minutes** left to join The Gauntlet...`), (delay / 3) * 60000);
    setTimeout(() => channel.send(`⚠️ **Final minute** to enter The Gauntlet...`), (2 * delay / 3) * 60000);
  }

  joinTimeout = setTimeout(() => {
    if (gauntletEntrants.length < 1) {
      channel.send('Not enough entrants joined. Try again later.');
      gauntletActive = false;
    } else {
      runGauntlet(channel);
    }
  }, delay * 60000);
}

async function runGauntlet(channel) {
  let remaining = [...gauntletEntrants];
  let roundCounter = 1;
  gauntletActive = false;
  bossPlayerId = null;
  Object.keys(charmWinners).forEach(key => delete charmWinners[key]);

  while (remaining.length > 3) {
    const trial = trialNames[Math.floor(Math.random() * trialNames.length)];
    const tokenId = Math.floor(Math.random() * 530) + 1;
    const nftImage = `https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/${tokenId}`;

    const embed = new EmbedBuilder().setTitle(`⚔️ Round ${roundCounter} — ${trial}`).setImage(nftImage).setColor(0x8b0000);
    let desc = [];

    if (Math.random() < 0.2) desc.push(`📜 *${loreDrops[Math.floor(Math.random() * loreDrops.length)]}*`);

    if (!bossPlayerId && Math.random() < 0.2 && remaining.length > 4) {
      const boss = remaining[Math.floor(Math.random() * remaining.length)];
      bossPlayerId = boss.id;
      charmWinners[boss.id] = (charmWinners[boss.id] || 0);
      desc.push(`👑 <@${boss.id}> has been chosen as the **Malformed Champion**! If they survive this round: **+10 $CHARM**.`);
    }

    let mutation = null;
    if (Math.random() < 0.1) {
      mutation = Math.random() < 0.5 ? 'DOUBLE_ELIM' : 'EVERYONE_CURSED';
      desc.push(`⚠️ **Mutation Detected: ${mutation === 'DOUBLE_ELIM' ? 'Double Elimination' : 'Cursed Chaos'}**`);
    }

    const eliminations = mutation === 'DOUBLE_ELIM' ? Math.min(2, remaining.length - 3) : 1;
    const eliminated = [];
    for (let i = 0; i < eliminations; i++) {
      const index = Math.floor(Math.random() * remaining.length);
      const player = remaining.splice(index, 1)[0];
      eliminated.push(player);
      const reason = (Math.random() < 0.15 ? specialEliminations : eliminationEvents)[Math.floor(Math.random() * 10)];
      desc.push(`❌ <@${player.id}> ${reason}`);
    }

    if (bossPlayerId && !eliminated.find(e => e.id === bossPlayerId)) {
      desc.push(`🎉 <@${bossPlayerId}> survived as Boss! +10 $CHARM`);
      charmWinners[bossPlayerId] += 10;
      bossPlayerId = null;
    }

    if (eliminated.length && Math.random() < 0.15) {
      const revived = eliminated.splice(Math.floor(Math.random() * eliminated.length), 1)[0];
      remaining.push(revived);
      const reviveMsg = revivalEvents[Math.floor(Math.random() * revivalEvents.length)];
      desc.push(`💫 <@${revived.id}> ${reviveMsg}`);
    }

    if (Math.random() < 0.15 && remaining.length > 3) {
      const target = remaining[Math.floor(Math.random() * remaining.length)];
      const isBless = Math.random() < 0.5;
      desc.push(`${isBless ? '🌟' : '💀'} <@${target.id}> has been ${isBless ? '**Blessed**' : '**Cursed**'} for the next round.`);
    }

    if (Math.random() < 0.1) desc.push('🗳 React with 💀 to curse, 💫 to bless, or 👁 to watch.');

    desc.push(`\n👣 **${remaining.length} players remain. The Gauntlet continues...**`);
    embed.setDescription(desc.join('\n'));
    await channel.send({ embeds: [embed] });

    if (Math.random() < 0.15) {
      const bonusToken = Math.floor(Math.random() * 400) + 1;
      const bonusUrl = `https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/${bonusToken}`;
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('👁 A malformed vision flickers into view...')
            .setImage(bonusUrl)
            .setDescription('🧿 **If you own this Ugly, speak up now and you’ll earn 10 $CHARM from the team!**')
            .setColor(0x6e40c9)
        ]
      });
    }

    roundCounter++;
    await new Promise(r => setTimeout(r, 10000));
  }

  const [first, second, third] = remaining;
  charmWinners[first.id] = (charmWinners[first.id] || 0) + 50;
  charmWinners[second.id] = (charmWinners[second.id] || 0) + 25;
  charmWinners[third.id] = (charmWinners[third.id] || 0) + 10;

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle('🏆 Champions of the Ugly Gauntlet!')
        .setDescription(`**1st Place:** <@${first.id}> — **50 $CHARM**\n**2nd Place:** <@${second.id}> — **25 $CHARM**\n**3rd Place:** <@${third.id}> — **10 $CHARM**\n\nThe Gauntlet has spoken. Well fought, Champions!`)
        .setColor(0xdaa520)
    ]
  });

  const summaryLines = Object.entries(charmWinners)
    .map(([id, amount]) => `• <@${id}> — ${amount} $CHARM`);

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle('📊 $CHARM Earnings Summary')
        .setDescription(summaryLines.join('\n'))
        .setColor(0x00cc99)
    ]
  });
}

client.login(process.env.DISCORD_TOKEN);
