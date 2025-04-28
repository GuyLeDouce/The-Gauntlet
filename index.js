require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, Events, REST, Routes } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const GAUNTLET_EMOJI = '👺';
let currentGame = null; // Only 1 at a time for simplicity

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'gauntlet') {
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply({ content: 'Only admins can start the Gauntlet!', ephemeral: true });
        }
        if (currentGame) {
            return interaction.reply({ content: 'A Gauntlet is already running!', ephemeral: true });
        }

        const duration = interaction.options.getString('duration') || '2m';
        const ms = parseDuration(duration);

        // Start game registration
        currentGame = {
            channel: interaction.channel,
            message: null,
            entrants: new Set(),
            timeout: null,
            phase: 'registration'
        };

        const announceMsg = await interaction.reply({
            content: `**THE MALFORMED GAUNTLET BEGINS!**\nReact with ${GAUNTLET_EMOJI} to join. Registration ends in ${duration}.`,
            fetchReply: true,
        });

        currentGame.message = announceMsg;

        await announceMsg.react(GAUNTLET_EMOJI);

        // Collect entrants
        const filter = (reaction, user) =>
            reaction.emoji.name === GAUNTLET_EMOJI && !user.bot;
        const collector = announceMsg.createReactionCollector({ filter, time: ms });

        collector.on('collect', (reaction, user) => {
            currentGame.entrants.add(user.id);
        });

        collector.on('end', async () => {
            if (currentGame.entrants.size < 2) {
                await interaction.followUp('Not enough entrants for the Gauntlet!');
                currentGame = null;
                return;
            }
            runGauntlet(currentGame, interaction);
        });
    }
});

async function runGauntlet(game, interaction) {
    game.phase = 'running';
    const channel = game.channel;
    let players = Array.from(game.entrants);

    // Lore event eliminations!
    let eliminated = [];
    let events = [
        (name) => `${name} tripped over an Ugly Monster and fell into the Malformed Pit!`,
        (name) => `${name} was caught in the Cursed Fog of the Gauntlet!`,
        (name) => `${name} couldn't resist the call of the Warped Waypoint... gone!`,
        (name) => `${name} was devoured by the Echoing Echoes of Ugly Lore.`,
        (name) => `${name} slipped on a pile of $CHARM tokens and vanished.`,
        (name) => `${name} was charmed away by a Spectral Ugly Dog.`
        // Add as many as you want!
    ];

    await channel.send(`The Gauntlet begins! **${players.length}** Uglys enter... only one can win.`);

    while (players.length > 1) {
        await delay(2500); // 2.5 seconds between eliminations
        const unluckyIndex = Math.floor(Math.random() * players.length);
        const unluckyId = players[unluckyIndex];
        const unluckyMember = await channel.guild.members.fetch(unluckyId);
        const unluckyName = unluckyMember.displayName;

        // Random event message
        const event = events[Math.floor(Math.random() * events.length)];
        await channel.send(event(unluckyName));

        eliminated.push(unluckyId);
        players.splice(unluckyIndex, 1);
    }

    // Winner & leaderboard
    await delay(2000);
    const winnerId = players[0];
    const winnerMember = await channel.guild.members.fetch(winnerId);

    // Get top 3 (last 3 standing)
    const top3 = [winnerId]
        .concat(eliminated.slice(-2).reverse())
        .map(id => channel.guild.members.cache.get(id));

    let leaderboard = top3.map((m, i) =>
        m ? `**${i + 1}.** ${m.displayName}` : `**${i + 1}.** [Unknown]`
    ).join('\n');

    await channel.send(`🏆 **THE GAUNTLET IS OVER!** 🏆\n\n**Champion of the Malformed:** ${winnerMember.displayName}\n\n**Top 3 Champions:**\n${leaderboard}`);

    currentGame = null;
}

// Helper Functions
function parseDuration(duration) {
    const match = duration.match(/(\d+)([smhd])/i);
    if (!match) return 120000; // Default 2m
    const num = parseInt(match[1]);
    switch (match[2]) {
        case 's': return num * 1000;
        case 'm': return num * 60 * 1000;
        case 'h': return num * 60 * 60 * 1000;
        case 'd': return num * 24 * 60 * 60 * 1000;
        default: return 120000;
    }
}
function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}

// Register command on start
client.on('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(
        Routes.applicationCommands(client.user.id),
        {
            body: [{
                name: 'gauntlet',
                description: 'Start the Malformed Gauntlet!',
                options: [{
                    name: 'duration',
                    description: 'Registration duration (2m, 5m, 1h, 8h, 12h, 24h)',
                    type: 3
                }]
            }]
        }
    );
    console.log('Slash commands registered.');
});

client.login(process.env.DISCORD_TOKEN);
