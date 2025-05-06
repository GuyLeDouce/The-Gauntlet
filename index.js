# Set up Ugly Gauntlet Bot (from scratch)

# Create project folder and move into it
mkdir The-Gauntlet
cd The-Gauntlet

# Initialize a new Node.js project
npm init -y

# Install required dependencies
npm install discord.js dotenv node-cron

# Create .env file to store sensitive info (do NOT share this file)
echo "DISCORD_TOKEN=your-discord-bot-token-here" > .env
echo "GAUNTLET_CHANNEL_ID=your-channel-id-here" >> .env

# Create .gitignore to exclude node_modules and .env from commits
echo "node_modules/" > .gitignore
echo ".env" >> .gitignore

# Create the main bot file
echo "// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const cron = require('node-cron');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

let gauntletEntrants = [];
let gauntletActive = false;

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  scheduleGauntlet();
});

function scheduleGauntlet() {
  cron.schedule('0 19 * * *', async () => {
    await startGauntlet();
  });
  startGauntlet();
}

async function startGauntlet() {
  gauntletEntrants = [];
  gauntletActive = true;

  const channel = await client.channels.fetch(process.env.GAUNTLET_CHANNEL_ID);
  if (!channel) return console.log('Gauntlet channel not found!');

  const joinButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('join_gauntlet')
      .setLabel('Join the Ugly Gauntlet')
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({
    content: '🏁 **The Ugly Gauntlet has begun!** 🏁\nClick below to enter and test your fate…',
    components: [joinButton]
  });

  setTimeout(() => {
    if (gauntletEntrants.length < 1) {
      channel.send("Not enough entrants joined the Gauntlet. Next round will start in 24 hours.");
      gauntletActive = false;
      return;
    }
    runGauntlet(channel);
  }, 10 * 60 * 1000);
}

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'join_gauntlet' && gauntletActive) {
    if (!gauntletEntrants.find(e => e.id === interaction.user.id)) {
      gauntletEntrants.push({ id: interaction.user.id, username: interaction.user.username });
      await interaction.reply({ content: 'You have joined the Ugly Gauntlet! Prepare yourself…', ephemeral: true });
    } else {
      await interaction.reply({ content: 'You have already joined this round!', ephemeral: true });
    }
  }
});

async function runGauntlet(channel) {
  gauntletActive = false;
  if (gauntletEntrants.length < 1) return;

  let roundEntrants = [...gauntletEntrants];
  let eliminated = [];

  while (roundEntrants.length > 3) {
    const elimIndex = Math.floor(Math.random() * roundEntrants.length);
    const elim = roundEntrants.splice(elimIndex, 1)[0];
    eliminated.push(elim);
  }

  shuffle(roundEntrants);
  const [first, second, third] = roundEntrants;

  await channel.send(
    `🏆 **Champions of the Ugly Gauntlet!** 🏆\n\n**1st Place:** <@${first.id}> — **50 $CHARM**\n*The Gauntlet bows before your unmatched ugliness! Legends will be whispered of your monstrous cunning and luck. You wear your scars with pride—a true master of The Malformed.*\n\n**2nd Place:** <@${second.id}> — **25 $CHARM**\n*The shadows nearly yielded to your might. Though not the last one standing, your twisted journey left a trail of chaos and envy. The Malformed will remember your valiant deeds!*\n\n**3rd Place:** <@${third.id}> — **10 $CHARM**\n*You clawed your way through calamity and horror, stumbling but never crumbling. The echo of your fight lingers in every corner of The Malformed—Ugly, proud, and almost victorious.*\n\nThe Gauntlet has spoken. Your triumph (and scars) will echo through the halls of The Malformed until the next round. Well fought, Champions!`
  );

  setTimeout(() => startGauntlet(), 5 * 60 * 1000);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

client.login(process.env.DISCORD_TOKEN);" > index.js
