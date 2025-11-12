// autoTriggerShop.js
import fetch from "node-fetch";
import { Client, GatewayIntentBits } from "discord.js";

// ====== CONFIG ======
const VALORANT_COOKIE = `osano_consentmanager_uuid=ebe17757-5a0d-4d64-b1cb-327ae5a1507d; osano_consentmanager=t5e_8v4OumSWIPLrZ4C41VM5pbZtizjk9iq9tINRnyNKTilP8TdS6VVw4LRuPqu7bFZzr58O7_e5GBbGnbTXLx7I2txKIn9KehvWeuCt32shms_X7_pOi5Fv3PTIQmsNC_i6bm3eOsEJv2yXVlQGkakDCwnVDTRgfPfmuUjp6sWVPgndAIR-6GEAuEUukDgErQpWG5Hf3IopthcuFbG9HpB5iEv9q15kCAH4K80JDjIl8TX-uW3y15B98gUYL4YEb7hA6NwoqgzTQTDNNtWk0bCa75pn9mpI_zWP0gdeuiYUTVIdsUyJ5iubMwc2EBkVFN_emUjk9Pw=; __Secure-session_state=tZlnrGvNiLu-Q3hHpTFQM0FLXpFUTGx8oExOWA0L3Cc.P8JBId0UKl_5nlKgZIcKZQ; __Secure-refresh_token_presence=1; sub=658afbd2-d078-5ba5-90aa-83fd293513da; csid=i_gfNJ9zhbkvrJPeYVxsdw.KbXiHPgSEguRS5rxh6_pFQ; clid=uw1; PVPNET_LANG=en_US; tdid=***; id_token=***; id_hint=sub%3D658afbd2-d078-5ba5-90aa-83fd293513da%26lang%3Den%26game_name%3DZozaf%26tag_line%3D6969; ssid=***`.trim();
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TARGET_CHANNEL_ID = "1264023343577694372";

// ====== DISCORD CLIENT ======
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// ====== HELPERS ======
function parseTokensFromRedirect(location) {
    try {
        const hash = location.split("#")[1];
        const params = new URLSearchParams(hash);
        const rso = params.get("access_token");
        const idt = params.get("id_token");
        return { rso, idt };
    } catch {
        return { rso: null, idt: null };
    }
}

async function getEntitlements(rso) {
    const res = await fetch("https://entitlements.auth.riotgames.com/api/token/v1", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${rso}`,
            "Content-Type": "application/json"
        }
    });
    const data = await res.json();
    if (!data.entitlements_token) throw new Error("Failed to get entitlements token.");
    return data.entitlements_token;
}

async function getRegion(rso, idt) {
    const res = await fetch("https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant", {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${rso}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ id_token: idt })
    });
    const data = await res.json();
    if (!data.affinities?.live) throw new Error("Failed to get region.");
    return data.affinities.live;
}

async function fetchShop(puuid, rso, ent, region) {
    const res = await fetch(`https://pd.${region}.a.pvp.net/store/v2/storefront/${puuid}`, {
        headers: {
            "Authorization": `Bearer ${rso}`,
            "X-Riot-Entitlements-JWT": ent
        }
    });
    if (!res.ok) throw new Error(`Shop fetch failed: ${res.status}`);
    return res.json();
}

async function postShopToDiscord(shop) {
    const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
    if (!channel) throw new Error("Channel not found.");

    const offers = shop.SkinsPanelLayout?.SingleItemOffers || [];
    const msg = offers.length ? `🛍️ **Current Shop Skins:**\n${offers.join("\n")}` : "⚠️ No shop items found.";
    await channel.send(msg);
}

// ====== MAIN ======
async function main() {
    try {
        // 1️⃣ Get RSO + ID tokens (same as /auth /cookies)
        const authRes = await fetch(
            "https://auth.riotgames.com/authorize?client_id=play-valorant-web-prod&nonce=1&redirect_uri=https://playvalorant.com/opt_in&response_type=token%20id_token&scope=account%20openid",
            {
                headers: {
                    "User-Agent": "ShooterGame/13 Windows/10.0.19043.1.256.64bit",
                    "Cookie": VALORANT_COOKIE
                },
                redirect: "manual"
            }
        );

        const location = authRes.headers.get("location");
        if (!location) throw new Error("Authorization failed — missing redirect. Cookie may be invalid.");

        const { rso, idt } = parseTokensFromRedirect(location);
        if (!rso || !idt) throw new Error("Failed to extract RSO or ID token from redirect.");

        // 2️⃣ Get Entitlements + Region
        const ent = await getEntitlements(rso);
        const region = await getRegion(rso, idt);

        // 3️⃣ Decode PUUID from ID token
        const payload = JSON.parse(Buffer.from(idt.split(".")[1], "base64").toString());
        const puuid = payload.sub;
        if (!puuid) throw new Error("PUUID not found in ID token.");

        // 4️⃣ Fetch Shop + Post to Discord
        const shop = await fetchShop(puuid, rso, ent, region);
        await postShopToDiscord(shop);

        console.log("✅ Shop posted successfully!");
    } catch (err) {
        console.error("❌ Error posting shop:", err.message);
    } finally {
        client.destroy();
    }
}

// ====== DISCORD BOOT ======
client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`);
    main();
});

client.login(DISCORD_TOKEN);
