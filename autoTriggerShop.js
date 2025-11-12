import { Client, GatewayIntentBits } from "discord.js";
import { spawn } from "child_process";
import { getShop } from "./valorant/shop.js";
import config from "./misc/config.js";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TARGET_USER_ID = process.env.TARGET_USER_ID;
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;

if (!DISCORD_TOKEN || !TARGET_USER_ID || !TARGET_CHANNEL_ID) {
    console.error("Missing environment variables. Make sure DISCORD_TOKEN, TARGET_USER_ID, and TARGET_CHANNEL_ID are set.");
    process.exit(1);
}

// Launch SkinPeek first
console.log("Launching SkinPeek.js...");
await new Promise((resolve, reject) => {
    const skinPeek = spawn("node", ["SkinPeek.js"], { stdio: "inherit" });

    skinPeek.on("close", (code) => {
        if (code === 0) {
            console.log("SkinPeek finished loading!");
            resolve();
        } else {
            reject(new Error(`SkinPeek exited with code ${code}`));
        }
    });
});

// Start Discord bot
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once("ready", async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    try {
        const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
        if (!channel) throw new Error("Invalid channel ID!");
        if (!channel.permissionsFor(client.user).has("SendMessages")) throw new Error("Bot cannot send messages in this channel!");

        console.log("Fetching shop for user:", TARGET_USER_ID);
        const shopResult = await getShop(TARGET_USER_ID);

        if (!shopResult.success) {
            console.error("Failed to fetch shop:", shopResult);
            await channel.send("Failed to fetch shop. Make sure the user ID is correct and logged in.");
        } else {
            console.log("Shop fetched successfully!");
            // Format a simple message
            const skinNames = shopResult.shop.SkinsPanelLayout.SingleItemOffers.map(offer => offer.Offer.OfferID);
            const message = `Daily shop for <@${TARGET_USER_ID}>:\n${skinNames.join("\n")}`;

            await channel.send(message);
            console.log("Shop posted to channel!");
        }
    } catch (err) {
        console.error("Error posting shop:", err);
    } finally {
        client.destroy();
        process.exit(0);
    }
});

client.login(DISCORD_TOKEN);
