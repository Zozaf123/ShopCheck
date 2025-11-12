// autoTriggerShop.js
import { loadConfig } from "./misc/config.js";
import { transferUserDataFromOldUsersJson } from "./valorant/auth.js";
import { fetchData } from "./valorant/cache.js";
import SkinPeek from "./SkinPeek.js"; // assume SkinPeek exports a start function that returns a promise
import { Client, GatewayIntentBits, ActivityType, ApplicationCommandOptionType } from "discord.js";
import { WeaponType } from "./misc/util.js"; // must import before using
import config from "./misc/config.js";

async function startSkinPeek() {
    console.log("Launching SkinPeek...");
    await SkinPeek.start(); // wait for SkinPeek to finish loading skins
    console.log("SkinPeek finished loading!");
}

async function startBot() {
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    });

    // Define commands AFTER WeaponType is ready
    const commands = [
        {
            name: "collection",
            description: "Show off your skin collection!",
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: "weapon",
                    description: "Optional: see all your skins for a specific weapon",
                    required: false,
                    choices: Object.values(WeaponType).map((w) => ({ name: w, value: w })),
                },
            ],
        },
        // ... add other commands here
    ];

    client.once("ready", async () => {
        console.log(`Logged in as ${client.user.tag}!`);
        await client.user.setActivity("your store!", { type: ActivityType.Watching });

        if (config.autoDeployCommands) {
            console.log("Deploying commands...");
            await client.application.commands.set(commands);
            console.log("Commands deployed!");
        }
    });

    await client.login(process.env.DISCORD_TOKEN);
}

async function main() {
    const cfg = loadConfig();
    if (!cfg) throw new Error("Failed to load config!");

    transferUserDataFromOldUsersJson();

    // 1. Start SkinPeek and wait for skins to load
    await startSkinPeek();

    // 2. Start Discord bot
    await startBot();
}

main().catch((err) => {
    console.error("Fatal error in startup:", err);
    process.exit(1);
});
