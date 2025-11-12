// autoTriggerShop.js
import fetch from "node-fetch";

// ---------------- CONFIG ----------------
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // your bot token
const TARGET_CHANNEL_ID = "1264023343577694372"; // channel to post shop

// Hardcode your Valorant cookie here:
const VALORANT_COOKIE = `osano_consentmanager_uuid=ebe17757-5a0d-4d64-b1cb-327ae5a1507d; osano_consentmanager=t5e_8v4OumSWIPLrZ4C41VM5pbZtizjk9iq9tINRnyNKTilP8TdS6VVw4LRuPqu7bFZzr58O7_e5GBbGnbTXLx7I2txKIn9KehvWeuCt32shms_X7_pOi5Fv3PTIQmsNC_i6bm3eOsEJv2yXVlQGkakDCwnVDTRgfPfmuUjp6sWVPgndAIR-6GEAuEUukDgErQpWG5Hf3IopthcuFbG9HpB5iEv9q15kCAH4K80JDjIl8TX-uW3y15B98gUYL4YEb7hA6NwoqgzTQTDNNtWk0bCa75pn9mpI_zWP0gdeuiYUTVIdsUyJ5iubMwc2EBkVFN_emUjk9Pw=; __Secure-session_state=tZlnrGvNiLu-Q3hHpTFQM0FLXpFUTGx8oExOWA0L3Cc.P8JBId0UKl_5nlKgZIcKZQ; __Secure-refresh_token_presence=1; sub=658afbd2-d078-5ba5-90aa-83fd293513da; csid=i_gfNJ9zhbkvrJPeYVxsdw.KbXiHPgSEguRS5rxh6_pFQ; clid=uw1; PVPNET_LANG=en_US; tdid=***; id_token=***; id_hint=sub%3D658afbd2-d078-5ba5-90aa-83fd293513da%26lang%3Den%26game_name%3DZozaf%26tag_line%3D6969; ssid=***`.trim();
// example: "ssid=abc; other_cookie=xyz;"

// ----------------------------------------

import { Client, GatewayIntentBits } from "discord.js";
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// Minimal function to fetch Valorant shop
async function fetchShop() {
    const res = await fetch("https://pd.na.a.pvp.net/store/v2/storefront/", {
        headers: {
            "Cookie": VALORANT_COOKIE,
            "User-Agent": "ShooterGame/13 Windows/10.0.19043.1.256.64bit"
        }
    });

    if (!res.ok) throw new Error("Failed to fetch shop. Check your cookie.");

    const data = await res.json();
    return data;
}

// Post shop message to Discord
async function postShop() {
    try {
        const shop = await fetchShop();
        const items = shop.SkinsPanelLayout.SingleItemOffers.map(id => id).join(", "); // basic listing
        const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
        await channel.send(`Today's shop: ${items}`);
        console.log("Shop posted successfully!");
    } catch (err) {
        console.error("Error posting shop:", err);
    }
}

client.once("ready", async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    await postShop();
    process.exit(0); // exit after posting
});

client.login(DISCORD_TOKEN);
