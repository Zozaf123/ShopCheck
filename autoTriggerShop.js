// shopPoster.js
import { client } from "../discord/bot.js"; // your Discord client
import { getUser } from "./auth.js"; // your User/auth system
import fetch from "node-fetch"; // if not already imported
import config from "../misc/config.js";

const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID; // set in env/Secrets
const USER_ID = process.env.TARGET_USER_ID; // the user who logged in with /cookies

async function fetchShop(user) {
    if (!user || !user.auth?.rso || !user.auth?.ent || !user.region) {
        throw new Error("User is missing auth tokens. Make sure /cookies was used!");
    }

    const shopUrl = `https://pd.${user.region}.a.pvp.net/store/v2/storefront/${user.puuid}`;
    const res = await fetch(shopUrl, {
        headers: {
            "Authorization": `Bearer ${user.auth.rso}`,
            "X-Riot-Entitlements-JWT": user.auth.ent,
            "User-Agent": "ShooterGame/13 Windows/10.0.19043.1.256.64bit"
        }
    });

    if (!res.ok) throw new Error(`Failed to fetch shop: ${res.status}`);
    const shopData = await res.json();
    return shopData;
}

function formatShop(shopData) {
    // Minimal formatting: list skins in the shop
    if (!shopData?.Skins || !Array.isArray(shopData.Skins)) return "Shop empty today!";
    return shopData.Skins.map(s => `• ${s.DisplayName}`).join("\n");
}

async function postToDiscord(message) {
    if (!client.isReady()) {
        await new Promise(resolve => client.once("ready", resolve));
    }

    const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) throw new Error("Target channel not found or not text-based!");

    await channel.send(`Today's Valorant shop:\n${message}`);
    console.log("Shop posted to Discord!");
}

async function main() {
    try {
        const user = getUser(USER_ID);
        if (!user) throw new Error("User not found. Make sure /cookies was used to log in!");

        const shopData = await fetchShop(user);
        const formatted = formatShop(shopData);
        await postToDiscord(formatted);
    } catch (e) {
        console.error("Error posting shop:", e);
    }
}

main();
