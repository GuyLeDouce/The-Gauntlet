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

const revivalEvents = [
  "was too ugly to stay dead and clawed their way back!",
  "emerged from the swamp, covered in mud and vengeance.",
  "was coughed back up by The Malformed. Gross.",
  "respawned after glitching through the floor.",
  "refused to die and bribed fate with $CHARM.",
  "sacrificed a toe and was reborn in pixelated agony.",
  "rolled a nat 20 on a resurrection check!",
  "got spit out by a mimic. Again.",
  "was reassembled by cursed IKEA instructions.",
  "screamed so loud they reversed their own death.",
  "used a backup soul they had in storage.",
  "got patched in a hotfix and returned.",
  "woke up and realized it was just a bad dream.",
  "got a revive from an ancient Ugly Dog bark.",
  "respawned thanks to a bug in the Gauntlet matrix.",
  "found a secret cheat code in the Malformed manual.",
  "used their Uno Reverse card at the perfect time.",
  "was pulled back by the chants of the audience.",
  "possessed their own corpse. Classic.",
  "returned... but something’s definitely wrong now."
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
          description: embed.description.replace(/🧟 Entrants so far: \\d+/, `🧟 Entrants so far: ${gauntletEntrants.length}`)
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

