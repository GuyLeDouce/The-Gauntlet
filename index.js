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

const specialEliminations = [
  "was sacrificed to the ancient hairball under the couch.",
  "tried to hug an Ugly Dog. It turned out to be a mop with teeth.",
  "was sucked into a vortex of cursed pomade and never looked fabulous again.",
  "tried to flex in front of the Mirror of Misfortune and imploded.",
  "rolled a natural 1 while trying to summon $CHARM and summoned their ex instead.",
  "was found guilty of being TOO Ugly and banished to the Backrooms of Beauty.",
  "attempted to bribe The Gauntlet with expired gas station sushi.",
  "was outed as an undercover Handsome and disqualified on sight.",
  "forgot to say GM and was hexed by the community.",
  "clicked the wrong 'Mint' and bought 500 Ugly Rugs instead.",
  "was devoured by an NFT with a 'Fire Skin' and eternal drip.",
  "tried to out-ugly the Malformed... and succeeded. Universe collapsed.",
  "said 'at least I'm not that Ugly' — fate heard. Fate delivered."
];

const specialEliminationGifs = [
  "https://media.giphy.com/media/3o6ZsY8F5u4WJf8zVu/giphy.gif",
  "https://media.giphy.com/media/3oEduSbSGpGaRX2Vri/giphy.gif",
  "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
  "https://media.giphy.com/media/xT9IgIc0lryrxvqVGM/giphy.gif",
  "https://media.giphy.com/media/ZyoU6jbPzHv5u/giphy.gif"
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

    for (let i = 0; i < eliminations; i++) {
      const index = Math.floor(Math.random() * remaining.length);
      eliminated.push(remaining.splice(index, 1)[0]);
    }

    let eliminationDescriptions = [];

    for (const player of eliminated) {
      const useSpecial = Math.random() < 0.15;
      const reason = useSpecial
        ? specialEliminations[Math.floor(Math.random() * specialEliminations.length)]
        : eliminationEvents[Math.floor(Math.random() * eliminationEvents.length)];

      eliminationDescriptions.push(`❌ <@${player.id}> ${reason}`);

      if (useSpecial) {
        const gif = specialEliminationGifs[Math.floor(Math.random() * specialEliminationGifs.length)];
        eliminationDescriptions.push(gif);
      }
    }

    if (remaining.length > 3) {
      eliminationDescriptions.push(`\n👣 **${remaining.length} players remain. The Gauntlet continues...**`);
    }

    await channel.send({
      embeds: [
        {
          title: `⚔️ Round ${roundCounter} — ${trial}`,
          description: eliminationDescriptions.join('\n'),
          color: 0x8b0000
        }
      ]
    });

    roundCounter++;
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  const [first, second, third] = remaining;

  await channel.send({
    embeds: [
      {
        title: "🏆 Champions of the Ugly Gauntlet!",
        description:
          `**1st Place:** <@${first.id}> — **50 $CHARM**\n*The Gauntlet bows before your unmatched ugliness!*\n\n` +
          `**2nd Place:** <@${second.id}> — **25 $CHARM**\n*The shadows nearly yielded to your might.*\n\n` +
          `**3rd Place:** <@${third.id}> — **10 $CHARM**\n*You clawed your way through calamity and horror.*\n\n` +
          `The Gauntlet has spoken. Well fought, Champions!`,
        color: 0xdaa520
      }
    ]
  });
}

client.login(process.env.DISCORD_TOKEN);

