import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import { redeemCookies, getUser } from "./valorant/auth.js";
import { getOffers } from "./valorant/shop.js";
import { renderOffers } from "./discord/embed.js";
import { VPEmoji } from "./discord/emoji.js";
import config from "./misc/config.js";

// ============================================
// CONFIGURATION - EDIT THESE VALUES
// ============================================

// Your Riot Games cookie string (from auth.riotgames.com)
const RIOT_COOKIE = process.env.RIOT_ID;

// Discord channel ID where the shop will be sent
const DISCORD_CHANNEL_ID = process.env.CHANNEL_ID;

// Your Discord user ID (the bot will authenticate under this ID)
const DISCORD_USER_ID = process.env.USER_ID;

// ============================================
// MAIN SCRIPT
// ============================================

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

async function fetchAndSendShop() {
    try {
        console.log("Starting shop fetch process...");

        // Step 1: Authenticate with cookies
        console.log("Authenticating with cookies...");
        const authResponse = await redeemCookies(DISCORD_USER_ID, RIOT_COOKIE);
        
        if (!authResponse.success) {
            console.error("Authentication failed:", authResponse);
            if (authResponse.rateLimit) {
                console.error("Rate limited! Please try again later.");
            } else if (authResponse.mfa) {
                console.error("2FA required. This script doesn't support 2FA.");
            } else {
                console.error("Invalid cookies or authentication error.");
            }
            return;
        }

        console.log("Authentication successful!");

        // Step 2: Get the authenticated user
        const valorantUser = getUser(DISCORD_USER_ID);
        if (!valorantUser) {
            console.error("Failed to get user data after authentication.");
            return;
        }

        console.log(`Authenticated as: ${valorantUser.username}`);

        // Step 3: Fetch shop offers
        console.log("Fetching shop offers...");
        const shopResponse = await getOffers(DISCORD_USER_ID);
        
        if (!shopResponse.success) {
            console.error("Failed to fetch shop:", shopResponse);
            if (shopResponse.maintenance) {
                console.error("Valorant servers are under maintenance.");
            } else {
                console.error("Error fetching shop data.");
            }
            return;
        }

        console.log("Shop data fetched successfully!");

        // Step 4: Fetch the Discord channel
        console.log(`Fetching Discord channel ${DISCORD_CHANNEL_ID}...`);
        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
        
        if (!channel) {
            console.error("Could not find Discord channel!");
            return;
        }

        console.log(`Channel found: #${channel.name}`);

        // Step 5: Get VP emoji
        const vpEmoji = await VPEmoji({ channel }, channel);

        // Step 6: Render the shop message
        console.log("Rendering shop message...");
        
        // Create a mock interaction object for the render function
        const mockInteraction = {
            user: { id: DISCORD_USER_ID },
            channelId: DISCORD_CHANNEL_ID,
            locale: "en-US",
            channel: channel
        };

        const shopMessage = await renderOffers(shopResponse, mockInteraction, valorantUser, vpEmoji);

        // Step 7: Send to Discord channel
        console.log("Sending shop to Discord...");
        await channel.send(shopMessage);
        
        console.log("✅ Shop successfully sent to Discord!");
        
    } catch (error) {
        console.error("Error in fetchAndSendShop:", error);
    } finally {
        // Disconnect the bot after sending the message
        console.log("Disconnecting bot...");
        client.destroy();
    }
}

// Bot ready event
client.once("ready", async () => {
    console.log(`Bot logged in as ${client.user.tag}`);
    await fetchAndSendShop();
});

// Login to Discord
console.log("Logging into Discord...");
client.login(config.token).catch(error => {
    console.error("Failed to login to Discord:", error);
    process.exit(1);
});
