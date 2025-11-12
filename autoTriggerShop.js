import { spawn } from "child_process";
import { Client, GatewayIntentBits } from "discord.js";
import { getShop } from "./valorant/shop.js"; // your shop functions
import { getUser } from "./valorant/auth.js";

// Environment variables from GitHub Actions or local
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;
const TARGET_USER_ID = process.env.TARGET_USER_ID; // optional

if (!DISCORD_TOKEN) {
    console.error("DISCORD_TOKEN not set!");
    process.exit(1);
}

// Initialize Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Function to post shop info to Discord
async function postShopToDiscord(shopData) {
    if (!TARGET_CHANNEL_ID) {
        console.error("TARGET_CHANNEL_ID not set, cannot post!");
        return;
    }

    const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
    if (!channel) {
        console.error("Could not fetch channel!");
        return;
    }

    let message = "**Daily Shop:**\n";
    if (shopData.offers) {
        for (const offer of shopData.offers) {
            message += `• ${offer}\n`; // Adjust formatting to your shop data
        }
    }

    if (TARGET_USER_ID) {
        message = `<@${TARGET_USER_ID}> ${message}`;
    }

    await channel.send(message);
}

// Function to fetch shop for all users (or a specific one)
async function triggerShop() {
    try {
        // Replace this with your logic for which user to fetch
        const userList = [/* list of user IDs */];
        for (const id of userList) {
            const shopResp = await getShop(id);
            if (shopResp.success) {
                console.log(`Fetched shop for ${id}`);
                await postShopToDiscord(shopResp.shop.SkinsPanelLayout.SingleItemOffers || []);
            } else {
                console.error(`Failed to fetch shop for ${id}`);
            }
        }
    } catch (err) {
        console.error("Error fetching shop:", err);
    } finally {
        client.destroy();
        process.exit(0);
    }
}

// Spawn SkinPeek.js
console.log("Launching SkinPeek...");
const skinpeek = spawn("node", ["SkinPeek.js"]);

skinpeek.stdout.on("data", (data) => {
    process.stdout.write(data);
    const msg = data.toString();

    // Wait until SkinPeek is ready
    if (msg.includes("Skins loaded!")) {
        console.log("SkinPeek ready, starting shop fetch...");
        triggerShop();
    }
});

skinpeek.stderr.on("data", (data) => process.stderr.write(data));

skinpeek.on("close", (code) => {
    console.log(`SkinPeek exited with code ${code}`);
});

// Log in Discord client
client.login(DISCORD_TOKEN);
