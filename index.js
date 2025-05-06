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

async function startGauntlet(channel, delay) {
  if (gauntletActive) return;
  gauntletEntrants = [];
  gauntletActive = true;
  gauntletChannel = channel;

  const joinButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('join_gauntlet').setLabel('Join the Ugly Gauntlet').setStyle(ButtonStyle.Primary)
  );

  gauntletMessage = await channel.send({
    embeds: [{ title: '🏁 The Ugly Gauntlet Has Begun!', description: `Click to enter. You have ${delay} minutes.\n🧟 Entrants so far: 0`, color: 0x6e40c9 }],
    components: [joinButton]
  });

  joinTimeout = setTimeout(() => {
    if (gauntletEntrants.length < 1) {
      channel.send('Not enough entrants joined. Try again later.');
      gauntletActive = false;
    } else {
      runGauntlet(channel);
    }
  }, delay * 60 * 1000);
}

async function runGauntlet(channel) {
  gauntletActive = false;
  let remaining = [...gauntletEntrants];
  let roundCounter = 1;

  while (remaining.length > 3) {
    const eliminations = Math.min(2, remaining.length - 3);
    const eliminated = [];

    const trial = trialNames[Math.floor(Math.random() * trialNames.length)];
    let eliminationDescriptions = [];

    for (let i = 0; i < eliminations; i++) {
      const index = Math.floor(Math.random() * remaining.length);
      const player = remaining.splice(index, 1)[0];
      eliminated.push(player);

      const useSpecial = Math.random() < 0.15;
      const reason = useSpecial
        ? specialEliminations[Math.floor(Math.random() * specialEliminations.length)]
        : eliminationEvents[Math.floor(Math.random() * eliminationEvents.length)];

      eliminationDescriptions.push(`❌ <@${player.id}> ${reason}`);
      if (useSpecial) {
        const gif = specialEliminationGifs[Math.floor(Math.random() * specialEliminationGifs.length)];
        await channel.send(gif);
      }
    }

    if (eliminated.length && Math.random() < 0.15) {
      const revived = eliminated.splice(Math.floor(Math.random() * eliminated.length), 1)[0];
      remaining.push(revived);
      const reviveMsg = revivalEvents[Math.floor(Math.random() * revivalEvents.length)];
      eliminationDescriptions.push(`💫 <@${revived.id}> ${reviveMsg}`);
    }

    if (remaining.length > 3) {
      eliminationDescriptions.push(`\n👣 **${remaining.length} players remain. The Gauntlet continues...**`);
    }

    await channel.send({
      embeds: [{
        title: `⚔️ Round ${roundCounter} — ${trial}`,
        description: eliminationDescriptions.join('\n'),
        color: 0x8b0000
      }]
    });

    roundCounter++;
    await new Promise(r => setTimeout(r, 5000));
  }

  const [first, second, third] = remaining;

  await channel.send({
    embeds: [{
      title: '🏆 Champions of the Ugly Gauntlet!',
      description: `**1st Place:** <@${first.id}> — **50 $CHARM**\n**2nd Place:** <@${second.id}> — **25 $CHARM**\n**3rd Place:** <@${third.id}> — **10 $CHARM**\n\nThe Gauntlet has spoken. Well fought, Champions!`,
      color: 0xdaa520
    }]
  });
}

client.login(process.env.DISCORD_TOKEN);

