import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import { fetch, stringifyCookies, parseSetCookie, extractTokensFromUri, decodeToken, userRegion, riotClientHeaders } from "./misc/util.js";
import { getSkin } from "./valorant/cache.js";
import { loadConfig } from "./misc/config.js";

// ============================================
// CONFIGURATION - EDIT THESE VALUES
// ============================================

// Your Riot Games cookie string (from auth.riotgames.com)
const RIOT_COOKIE = process.env.RIOT_ID;

// Discord channel ID where the shop will be sent
const DISCORD_CHANNEL_ID = process.env.CHANNEL_ID;

// Discord bot token (from config.json)
let DISCORD_BOT_TOKEN = process.env.DISCORD_TOKEN;

// ============================================
// MAIN SCRIPT
// ============================================

const VAL_COLOR_1 = 0xFD4553;

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Authenticate with Riot using cookies
async function authenticateWithCookies(cookies) {
    console.log("Authenticating with cookies...");
    
    const req = await fetch("https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&client_id=play-valorant-web-prod&response_type=token%20id_token&scope=account%20openid&nonce=1", {
        headers: {
            cookie: cookies
        }
    });

    if (req.statusCode !== 303) {
        console.error("Cookie authentication failed");
        return null;
    }

    if (req.headers.location.startsWith("/login")) {
        console.error("Invalid cookies - redirected to login");
        return null;
    }

    const cookieData = {
        ...parseSetCookie(cookies),
        ...parseSetCookie(req.headers['set-cookie'])
    };

    const [rso, idt] = extractTokensFromUri(req.headers.location);
    
    if (!rso) {
        console.error("Failed to extract RSO token");
        return null;
    }

    const puuid = decodeToken(rso).sub;

    // Get entitlements token
    const entReq = await fetch("https://entitlements.auth.riotgames.com/api/token/v1", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': "Bearer " + rso
        }
    });

    const entJson = JSON.parse(entReq.body);
    const ent = entJson.entitlements_token;

    // Get region
    const regionReq = await fetch("https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant", {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': "Bearer " + rso
        },
        body: JSON.stringify({
            'id_token': idt,
        })
    });
    
    const regionJson = JSON.parse(regionReq.body);
    const region = regionJson.affinities.live;

    // Get username
    const userInfoReq = await fetch("https://auth.riotgames.com/userinfo", {
        headers: {
            'Authorization': "Bearer " + rso
        }
    });
    
    const userInfoJson = JSON.parse(userInfoReq.body);
    const username = userInfoJson.acct.game_name + "#" + userInfoJson.acct.tag_line;

    console.log(`✅ Authenticated as: ${username}`);

    return {
        rso,
        idt,
        ent,
        puuid,
        region,
        username
    };
}

// Fetch shop data
async function fetchShop(auth) {
    console.log("Fetching shop data...");
    
    const req = await fetch(`https://pd.${auth.region}.a.pvp.net/store/v3/storefront/${auth.puuid}`, {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + auth.rso,
            "X-Riot-Entitlements-JWT": auth.ent,
            ...riotClientHeaders(),
        },
        body: JSON.stringify({})
    });

    if (req.statusCode !== 200) {
        console.error("Failed to fetch shop");
        return null;
    }

    const json = JSON.parse(req.body);
    
    console.log("✅ Shop data fetched successfully!");
    
    return {
        offers: json.SkinsPanelLayout.SingleItemOffers,
        expires: Math.floor(Date.now() / 1000) + json.SkinsPanelLayout.SingleItemOffersRemainingDurationInSeconds
    };
}

// Create embeds for shop
async function createShopEmbeds(shop, username) {
    console.log("Creating shop embeds...");
    
    const embeds = [];
    
    // Header embed
    embeds.push({
        description: `**${username}'s Shop**\nExpires <t:${shop.expires}:R>`,
        color: 0x202225,
    });

    // Skin embeds
    for (const uuid of shop.offers) {
        const skin = await getSkin(uuid);
        
        if (skin) {
            const colorMap = {
                '0cebb8be-46d7-c12a-d306-e9907bfc5a25': 0x009984,
                'e046854e-406c-37f4-6607-19a9ba8426fc': 0xf99358,
                '60bca009-4182-7998-dee7-b8a2558dc369': 0xd1538c,
                '12683d76-48d7-84a3-4e09-6985794f0445': 0x5a9fe1,
                '411e4a55-4e59-7757-41f0-86a53f101bb5': 0xf9d563
            };

            const color = colorMap[skin.rarity] || VAL_COLOR_1;
            
            embeds.push({
                title: skin.names["en-US"],
                description: skin.price ? `VP ${skin.price}` : "Price unknown",
                color: color,
                thumbnail: {
                    url: skin.icon
                }
            });
        }
    }

    console.log("✅ Created embeds for shop!");
    
    return embeds;
}

async function main() {
    try {
        console.log("=".repeat(50));
        console.log("Starting Valorant Shop Fetch Script");
        console.log("=".repeat(50));

        // Load config
        loadConfig();
        const config = await import("./misc/config.js");
        DISCORD_BOT_TOKEN = config.default.token;

        if (!DISCORD_BOT_TOKEN) {
            console.error("❌ No Discord bot token found in config.json!");
            process.exit(1);
        }

        // Validate configuration
        if (RIOT_COOKIE === "paste_your_cookie_here") {
            console.error("❌ Please configure RIOT_COOKIE in the script!");
            process.exit(1);
        }

        if (DISCORD_CHANNEL_ID === "paste_your_channel_id_here") {
            console.error("❌ Please configure DISCORD_CHANNEL_ID in the script!");
            process.exit(1);
        }

        // Authenticate with Riot
        const auth = await authenticateWithCookies(RIOT_COOKIE);
        if (!auth) {
            console.error("❌ Authentication failed!");
            process.exit(1);
        }

        // Fetch shop
        const shop = await fetchShop(auth);
        if (!shop) {
            console.error("❌ Failed to fetch shop!");
            process.exit(1);
        }

        // Create embeds
        const embeds = await createShopEmbeds(shop, auth.username);

        // Wait for Discord bot to be ready
        await new Promise((resolve) => {
            client.once("ready", resolve);
        });

        console.log(`✅ Bot logged in as ${client.user.tag}`);

        // Fetch channel
        console.log(`Fetching Discord channel ${DISCORD_CHANNEL_ID}...`);
        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
        
        if (!channel) {
            console.error("❌ Could not find Discord channel!");
            process.exit(1);
        }

        console.log(`✅ Channel found: #${channel.name}`);

        // Send to Discord
        console.log("Sending shop to Discord...");
        await channel.send({ embeds });
        
        console.log("=".repeat(50));
        console.log("✅ Shop successfully sent to Discord!");
        console.log("=".repeat(50));
        
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    } finally {
        // Disconnect
        console.log("Disconnecting bot...");
        client.destroy();
    }
}

// Login to Discord and start
console.log("Logging into Discord...");
client.login(DISCORD_BOT_TOKEN).then(() => {
    main().catch(error => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
}).catch(error => {
    console.error("Failed to login to Discord:", error);
    process.exit(1);
});
