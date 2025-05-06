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
  "Trial of the Screaming Mire",
  "The Eldritch Scramble",
  "Trial of the Shattered Bones",
  "The Maw's Hunger",
  "Dance of the Ugly Reflection",
  "Trial of the Crooked Path",
  "Storm of the Severed Sky",
  "Gauntlet of Broken Dreams",
  "The Echoing Crawl",
  "The Wretched Spiral"
];

const eliminationEvents = [
  "was dragged into the swamp by unseen claws.",
  "took one wrong step and fell into the Abyss of Nonsense.",
  "thought they could outdrink a bog spirit. They couldn't.",
  "burst into flames after trying to light a fart. The Malformed are cruel.",
  "stepped on a cursed LEGO brick and vanished into a scream.",
  "mocked the wrong shadow and paid the price.",
  "was eaten by a paper-mâché hydra. Cheap, but effective.",
  "got lost looking for loot and never returned.",
  "was judged too handsome and instantly vaporized.",
  "mispronounced the ritual chant and exploded in glitter.",
  "ran headfirst into a wall and kept going into the void.",
  "slipped on a banana peel and fell into the lava of despair.",
  "tried to pet a malformed dog. It bit back... with ten mouths.",
  "told a yo mama joke at the wrong time.",
  "thought it was a good idea to nap mid-Gauntlet.",
  "turned into a rubber duck and floated away.",
  "challenged a ghost to a dance battle. Lost. Badly.",
  "was yeeted off the platform by a sentient fart cloud.",
  "spoke in rhymes one too many times.",
  "mistook a mimic for a vending machine.",
  "was eliminated by a very aggressive pigeon.",
  "got bored and left. The Gauntlet didn’t take it well.",
  "was betrayed by their imaginary friend.",
  "fell victim to a cursed burrito.",
  "tried to summon help, but summoned debt collectors instead.",
  "was turned into abstract art.",
  "overthought everything and got stuck in a logic loop.",
  "was too ugly. Even for the Malformed.",
  "used Comic Sans in a ritual.",
  "was pulled into a mirror dimension by their own reflection.",
  "got tangled in the Lore Scrolls and suffocated.",
  "ignored the tutorial. Always read the tutorial.",
  "tapped out trying to spell 'Malformation'.",
  "tried to bluff the RNG. It called.",
  "turned on caps lock and got smote.",
  "disrespected the Eldritch Mods.",
  "became one with the loading screen.",
  "tripped on a cursed TikTok trend.",
  "got flashbanged by nostalgia.",
  "joined the wrong Discord.",
  "accidentally said Beetlejuice three times.",
  "tried to rage quit but forgot to leave.",
  "sniffed a suspicious potion.",
  "bragged about their RNG luck. Oops.",
  "drew a red card. From a black deck.",
  "challenged fate to a coin flip and lost the coin.",
  "glitched out of existence.",
  "was mistaken for a chicken nugget by a monster.",
  "got stuck in the lobby.",
  "failed a basic vibe check.",
  "took an arrow... to everything."
];

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

async function startGauntlet(channel, customDelay = 10) {
  if (gauntletActive) return;
  gauntletEntrants = [];
  gauntletActive = true;
  gauntletChannel = channel;

  const joinButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('join_gauntlet')
      .setLabel('Join the Ugly Gauntlet')
      .setStyle(ButtonStyle.Primary)
  );

  gauntletMessage = await channel.send({
    embeds: [
      {
        title: '🏁 The Ugly Gauntlet Has Begun!',
        description: `Click the button below to enter and test your fate…\nYou have ${customDelay} minutes to join.\n\n🧟 Entrants so far: 0`,
        color: 0x6e40c9
      }
    ],
    components: [joinButton]
  });

  const countdownMessages = [
    `⏳ Only ${Math.ceil(customDelay * 2 / 3)} minutes left to join the Gauntlet!`,
    `⚠️ Just ${Math.ceil(customDelay / 3)} minutes remaining... The Malformed begin to stir...`,
    `🩸 Final minute to enter... blood will spill soon.`
  ];

  const thirds = [
    customDelay * 60 * 1000 * 1 / 3,
    customDelay * 60 * 1000 * 2 / 3,
    customDelay * 60 * 1000 * 5 / 6,
  ];

  thirds.forEach((time, i) => {
    setTimeout(() => {
      if (gauntletActive) channel.send(countdownMessages[i]);
    }, time);
  });

  joinTimeout = setTimeout(() => {
    if (gauntletEntrants.length < 1) {
      channel.send("Not enough entrants joined the Gauntlet. Next round will begin when summoned again.");
      gauntletActive = false;
      return;
    }
    runGauntlet(channel);
  }, customDelay * 60 * 1000);
}

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

  if (content.startsWith('!gauntlet ')) {
    const args = content.split(' ');
    const delay = parseInt(args[1], 10);
    await startGauntlet(message.channel, !isNaN(delay) ? delay : 10);
  }

  if (content === '!gauntlet') {
    await startGauntlet(message.channel, 10);
  }

  if (content === '!startg') {
    if (!gauntletActive) {
      return message.channel.send('No Gauntlet is currently running. Use !gauntlet to begin one.');
    }
    clearTimeout(joinTimeout);
    runGauntlet(gauntletChannel || message.channel);
  }

  if (content === '!gauntlettrial') {
    if (gauntletActive) return message.channel.send('A Gauntlet is already running.');
    gauntletEntrants = [];
    for (let i = 1; i <= 20; i++) {
      gauntletEntrants.push({ id: `MockUser${i}`, username: `MockPlayer${i}` });
    }
    gauntletActive = true;
    gauntletChannel = message.channel;
    await message.channel.send('🧪 **Trial Mode Activated:** 20 mock players have entered The Gauntlet! Running simulation now...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    runGauntlet(message.channel);
  }
});

async function runGauntlet(channel) {
  gauntletActive = false;
  if (gauntletEntrants.length < 1) return;

  let remaining = [...gauntletEntrants];
  let roundCounter = 1;

  while (remaining.length > 3) {
    const eliminations = Math.min(2, remaining.length - 3);
    const eliminated = [];

    const trial = trialNames[Math.floor(Math.random() * trialNames.length)];

    await channel.send({
      embeds: [
        {
          title: `⚔️ Round ${roundCounter} — ${trial}`,
          description: "The Malformed stir as the Gauntlet grinds forward...",
          color: 0x8b0000
        }
      ]
    });

    for (let i = 0; i < eliminations; i++) {
      const index = Math.floor(Math.random() * remaining.length);
      eliminated.push(remaining.splice(index, 1)[0]);
    }

    for (const player of eliminated) {
      const reason = eliminationEvents[Math.floor(Math.random() * eliminationEvents.length)];
      await channel.send(`❌ <@${player.id}> ${reason}`);
    }

    if (remaining.length > 3) {
      await channel.send(`👣 **${remaining.length} players remain. The Gauntlet continues...**`);
    }

    roundCounter++;
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  const [first, second, third] = remaining;

  await channel.send(
    `🏆 **Champions of the Ugly Gauntlet!** 🏆\n\n**1st Place:** <@${first.id}> — **50 $CHARM**\n*The Gauntlet bows before your unmatched ugliness! Legends will be whispered of your monstrous cunning and luck. You wear your scars with pride—a true master of The Malformed.*\n\n**2nd Place:** <@${second.id}> — **25 $CHARM**\n*The shadows nearly yielded to your might. Though not the last one standing, your twisted journey left a trail of chaos and envy. The Malformed will remember your valiant deeds!*\n\n**3rd Place:** <@${third.id}> — **10 $CHARM**\n*You clawed your way through calamity and horror, stumbling but never crumbling. The echo of your fight lingers in every corner of The Malformed—Ugly, proud, and almost victorious.*\n\nThe Gauntlet has spoken. Your triumph (and scars) will echo through the halls of The Malformed until the next round. Well fought, Champions!`
  );
}

client.login(process.env.DISCORD_TOKEN);
