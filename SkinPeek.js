import {loadConfig} from "./misc/config.js";
import {startBot} from "./discord/bot.js";
import {loadLogger} from "./misc/logger.js";
import {transferUserDataFromOldUsersJson} from "./valorant/auth.js";

/* TODO list:
 * (done) Balance
 * (done) Auto fetch skins on startup
 * (done) Skin notifier/reminder
 * (done) Auto check for new valorant version every 15 minutes
 * (done) See current bundles
 * Password encryptor
 * Inspect weapon skin (all 4 levels + videos + radianite upgrade price)
 * Option to send shop automatically every day
 * More options in config.json
 * Simple analytics to see how many servers the bot is in
 * Admin commands (delete user, see/edit everyone's alerts, etc.)
 */

// Check for command line arguments
const args = process.argv.slice(2);

if (args.length >= 3 && args[0] === '--send-shop') {
    // Handle shop sending mode
    const shopFile = args[1];
    const channelId = args[2];

    console.log('Shop sending mode activated');
    console.log(`Shop file: ${shopFile}`);
    console.log(`Channel ID: ${channelId}`);

    // Import required modules
    import('fs').then(async (fs) => {
        import('./discord/bot.js').then(async (botModule) => {
            try {
                // Read shop data from file
                const shopData = JSON.parse(fs.readFileSync(shopFile, 'utf8'));
                console.log('Shop data loaded from file');

                // Start bot and wait for it to be ready
                const config = loadConfig();
                if (!config) {
                    console.error('Failed to load config');
                    process.exit(1);
                }

                loadLogger();
                transferUserDataFromOldUsersJson();

                // Start bot
                startBot();

                // Wait for bot to be ready
                const { client } = botModule;

                // Wait for ready event
                await new Promise((resolve) => {
                    if (client.isReady()) {
                        resolve();
                    } else {
                        client.once('ready', resolve);
                    }
                });

                console.log(`Bot ready as ${client.user.tag}`);

                // Get channel and send shop
                const channel = await client.channels.fetch(channelId);
                if (!channel) {
                    console.error('Channel not found');
                    process.exit(1);
                }

                await channel.send({ embeds: shopData });
                console.log('Shop sent successfully');

                // Clean up and exit
                setTimeout(() => {
                    client.destroy();
                    process.exit(0);
                }, 2000);

            } catch (error) {
                console.error('Error in shop sending mode:', error);
                process.exit(1);
            }
        });
    });

} else {
    // Normal bot startup
    const config = loadConfig();
    if(config) {
        loadLogger();
        transferUserDataFromOldUsersJson();
        startBot();
    }
}
