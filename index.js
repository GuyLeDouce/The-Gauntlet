// index.js (FULL FINAL GAUNTLET BOT WITH ALL FEATURES EXCEPT DRIP)
require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder,
  ComponentType
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const DEFAULT_IMAGE_BASE_URL = 'https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/';

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateNFTImageURL(baseURL) {
  const tokenId = Math.floor(Math.random() * 613) + 1;
  return `${baseURL}${tokenId}.jpg`;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let entrants = [];
let eliminated = [];
let gameInProgress = false;
let bossPlayer = null;

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.content.startsWith('!gauntlettrial')) {
    if (gameInProgress) return message.channel.send('🛑 A game is already in progress.');

    const mockNames = [
      'UglyMike', 'Charmzilla', 'Token420', 'SleepySlug', 'UglyDancer', 'EyePatchPat',
      'Glorp', 'CrookedKev', 'SnoozySue', 'CharmBoi', 'MalformedMitch', 'WarpedWanda',
      'TiredTina', 'UggoJimbo', 'Squigs420', 'BossBobby', 'UglyLaura', 'MonsterMax', 'Funkface', 'PillowFighter'
    ];

    entrants = mockNames.map((name, index) => ({
      id: `mock-${index}`,
      username: name,
      lives: 1
    }));
    eliminated = [];
    gameInProgress = true;
    message.channel.send('🎲 Starting **Gauntlet Trial** with 20 mock players!');
    await delay(1000);
    await runGauntlet(message.channel);
  }
});
client.on('messageCreate', async message => {
  if (message.content.startsWith('!gauntlet')) {
    if (gameInProgress) return message.channel.send('🛑 A game is already in progress.');

    entrants = [];
    eliminated = [];

    const args = message.content.split(' ');
    const minutes = args[1] ? parseInt(args[1]) : 3;
    const ms = minutes * 60 * 1000;
    const joinTime = Math.floor(Date.now() / 1000) + (minutes * 60);

    const joinEmbed = new EmbedBuilder()
      .setTitle('⚔️ The Gauntlet Begins!')
      .setDescription(`Click to enter the Ugly Gauntlet.\nThe fight starts <t:${joinTime}:R>.\n\nWill you survive the horrors ahead?\n\n🧠 75% of players must click rematch to run it back.`)
      .setColor('Red');

    const joinButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('join_gauntlet')
        .setLabel('Join the Gauntlet')
        .setStyle(ButtonStyle.Danger)
    );

    const joinMessage = await message.channel.send({ content: '@everyone', embeds: [joinEmbed], components: [joinButton] });

    const collector = joinMessage.createMessageComponentCollector({ componentType: ComponentType.Button, time: ms });

    collector.on('collect', async i => {
      if (i.customId === 'join_gauntlet') {
        await i.deferUpdate();
        if (entrants.some(p => p.id === i.user.id)) return;

        entrants.push({ id: i.user.id, username: i.user.username, lives: 1 });
        const ratio = `${entrants.length} joined`;
        await joinMessage.edit({
          embeds: [joinEmbed.setFooter({ text: ratio })],
          components: [joinButton]
        });
      }
    });

    let thirds = [Math.floor(ms / 3), Math.floor((ms * 2) / 3)];
    setTimeout(() => message.channel.send('@everyone ⚠️ 2/3 of join time left!'), thirds[0]);
    setTimeout(() => message.channel.send('@everyone ⚠️ Final third to join! Don’t miss it!'), thirds[1]);

    collector.on('end', async () => {
      if (entrants.length < 3) {
        await message.channel.send('⚠️ Not enough entrants to begin The Gauntlet.');
        gameInProgress = false;
        return;
      }
      gameInProgress = true;
      await runGauntlet(message.channel);
    });
  }
});
async function runGauntlet(channel) {
  if (entrants.length < 3) {
    gameInProgress = false;
    return channel.send('❌ Not enough players to start.');
  }

  // Boss Vote
  const bossCandidates = getRandomItem(entrants, 5);
  const bossRow = new ActionRowBuilder();
  bossCandidates.forEach((player, i) => {
    bossRow.addComponents(new ButtonBuilder()
      .setCustomId(`boss_vote_${i}`)
      .setLabel(player.username)
      .setStyle(ButtonStyle.Primary));
  });

  const bossEmbed = new EmbedBuilder()
    .setTitle('👑 Boss Level Ugly Vote')
    .setDescription('Choose who should begin with 2 lives!\nYou have 15 seconds.')
    .setColor('Gold');

  const bossMsg = await channel.send({ embeds: [bossEmbed], components: [bossRow] });

  const bossCollector = bossMsg.createMessageComponentCollector({ time: 15000 });

  const voteCounts = {};
  bossCollector.on('collect', async i => {
    await i.deferUpdate();
    const index = parseInt(i.customId.split('_')[2]);
    const voted = bossCandidates[index];
    if (voted) {
      voteCounts[voted.id] = (voteCounts[voted.id] || 0) + 1;
    }
  });

  bossCollector.on('end', async () => {
    let top = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0];
    if (!top) top = [bossCandidates[0].id];
    const boss = entrants.find(p => p.id === top[0]);
    if (boss) {
      boss.lives = 2;
      bossPlayer = boss;
    }
    await channel.send(`👑 **${boss?.username || 'Someone'}** has been crowned Boss Level Ugly!`);
    await delay(2000);
    await gauntletRounds(channel);
  });
}
async function gauntletRounds(channel) {
  while (entrants.length > 1) {
    const imageURL = generateNFTImageURL(DEFAULT_IMAGE_BASE_URL);

    // Mutation round chance (25%)
    if (Math.random() < 0.25) {
      await runMutationEvent(channel);
      await delay(5000);
    }

    // Eliminate 2-4 players per round
    const numToEliminate = Math.min(entrants.length - 1, Math.floor(Math.random() * 3) + 2);
    const eliminatedPlayers = [];

    for (let i = 0; i < numToEliminate; i++) {
      const unlucky = getRandomItem(entrants);
      if (!unlucky) continue;

      unlucky.lives--;
      if (unlucky.lives <= 0) {
        entrants = entrants.filter(p => p.id !== unlucky.id);
        eliminated.push(unlucky);
        eliminatedPlayers.push(`☠️ **${unlucky.username}**`);
      } else {
        eliminatedPlayers.push(`💔 ${unlucky.username} (lost a life!)`);
      }
    }

    const ratio = `Players Remaining: ${entrants.length}/${entrants.length + eliminated.length}`;
    const roundEmbed = new EmbedBuilder()
      .setTitle('🩸 A New Round Begins!')
      .setDescription(eliminatedPlayers.join('\n'))
      .setImage(imageURL)
      .setFooter({ text: ratio })
      .setColor('DarkRed');

    await channel.send({ embeds: [roundEmbed] });
    await delay(6000);

    // Totem of Lost Souls (1/3 or fewer remain)
    if (entrants.length <= Math.ceil((entrants.length + eliminated.length) * 0.5)) {
      await triggerTotemEvent(channel);
      await delay(12000);
    }
  }

  const winner = entrants[0];
  const top3 = [winner.username].concat(eliminated.slice(-2).reverse().map(p => p.username));
  await channel.send(`🏆 **The Gauntlet Ends!**\n\n🥇 ${top3[0]}\n🥈 ${top3[1] || '—'}\n🥉 ${top3[2] || '—'}`);

  gameInProgress = false;
  entrants = [];
  eliminated = [];
}
async function runMutationEvent(channel) {
  const types = ['reaction-survival', 'first-safe', 'last-death'];
  const type = getRandomItem(types);
  const imageURL = generateNFTImageURL(DEFAULT_IMAGE_BASE_URL);

  if (type === 'reaction-survival') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mutation_react')
        .setLabel('Click to survive!')
        .setStyle(ButtonStyle.Success)
    );

    const embed = new EmbedBuilder()
      .setTitle('🧬 Mutation Event!')
      .setDescription(`A strange glow fills the arena...\nClick FAST to survive!`)
      .setImage(imageURL)
      .setColor('Purple');

    const msg = await channel.send({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 8000 });
    let clicked = new Set();

    collector.on('collect', async i => {
      await i.deferUpdate();
      clicked.add(i.user.id);
    });

    collector.on('end', async () => {
      const dead = entrants.filter(p => !clicked.has(p.id));
      const survivors = entrants.filter(p => clicked.has(p.id));
      dead.forEach(p => {
        p.lives = 0;
        eliminated.push(p);
      });
      entrants = survivors;

      await channel.send(`💥 Mutation complete! ${dead.length} failed to react in time and were purged.`);
    });

  } else if (type === 'first-safe') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mutation_first')
        .setLabel('Click to gain protection!')
        .setStyle(ButtonStyle.Primary)
    );

    const embed = new EmbedBuilder()
      .setTitle('🧬 Speed Mutation!')
      .setDescription('First to click the button gains immunity next round!')
      .setImage(imageURL)
      .setColor('Purple');

    const msg = await channel.send({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, max: 1, time: 7000 });
    collector.on('collect', async i => {
      await i.deferUpdate();
      const found = entrants.find(p => p.id === i.user.id);
      if (found) found.lives += 1;
      await channel.send(`✨ ${i.user.username} gained an extra life from the anomaly!`);
    });

    collector.on('end', collected => {
      if (collected.size === 0) channel.send('⏱️ No one clicked fast enough. The anomaly faded.');
    });

  } else if (type === 'last-death') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('mutation_last')
        .setLabel('DO NOT CLICK until told!')
        .setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setTitle('🧬 Delayed Trap!')
      .setDescription('Wait 10 seconds. Last person to click the button will be eliminated.')
      .setImage(imageURL)
      .setColor('DarkPurple');

    const msg = await channel.send({ embeds: [embed], components: [row] });

    await delay(10000);
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 3000 });
    const clicks = [];

    collector.on('collect', async i => {
      await i.deferUpdate();
      clicks.push({ id: i.user.id, name: i.user.username });
    });

    collector.on('end', async () => {
      if (clicks.length === 0) return channel.send('🌀 No one triggered the trap.');
      const last = clicks[clicks.length - 1];
      const doomed = entrants.find(p => p.id === last.id);
      if (doomed) {
        doomed.lives = 0;
        eliminated.push(doomed);
        entrants = entrants.filter(p => p.id !== last.id);
        await channel.send(`☠️ ${last.name} was the last to click. The trap claimed their life.`);
      }
    });
  }
}
async function triggerTotemEvent(channel) {
  const allEligible = [...eliminated];

  const totemRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('totem_try')
      .setLabel('Touch the Totem')
      .setStyle(ButtonStyle.Secondary)
  );

  const totemEmbed = new EmbedBuilder()
    .setTitle('☠️ Totem of Lost Souls')
    .setDescription('The Totem pulses with dark energy... Will you attempt to return?\n\nClick the button to try. Your fate will be decided.')
    .setColor('Grey');

  const msg = await channel.send({ embeds: [totemEmbed], components: [totemRow] });

  const attempted = [];

  const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 6000 });

  collector.on('collect', async i => {
    await i.deferUpdate();
    if (!attempted.find(p => p.id === i.user.id)) {
      attempted.push({ id: i.user.id, name: i.user.username });
    }
  });

  collector.on('end', async () => {
    await channel.send(`⏳ Judgment in 12 seconds. Will the Totem show mercy?`);
    await delay(12000);

    if (Math.random() < 0.5) {
      let revivedCount = 0;
      attempted.forEach(p => {
        if (!entrants.find(e => e.id === p.id)) {
          entrants.push({ id: p.id, username: p.name, lives: 1 });
          revivedCount++;
        }
      });
      await channel.send(`🧟 Totem has granted mercy!\n**${revivedCount}** players have returned from the void.`);
    } else {
      await channel.send('💀 The Totem rejects all souls. No one returns.');
    }
  });
}
// ======= Global Game State =======
let entrants = [];
let eliminated = [];
let bossPlayer = null;
let gameInProgress = false;

// ======= NFT Image Generator =======
const DEFAULT_IMAGE_BASE_URL = 'https://ipfs.io/ipfs/bafybeie5o7afc4yxyv3xx4jhfjzqugjwl25wuauwn3554jrp26mlcmprhe/';

function generateNFTImageURL(baseURL = DEFAULT_IMAGE_BASE_URL) {
  const tokenId = Math.floor(Math.random() * 613) + 1;
  return `${baseURL}${tokenId}`;
}

// ======= Delay Helper =======
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ======= Get Random Item or Multiple =======
function getRandomItem(arr, count = 1) {
  if (count === 1) return arr[Math.floor(Math.random() * arr.length)];
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.BOT_TOKEN);
