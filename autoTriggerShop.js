import { spawn } from "child_process";

// ============================================
// CONFIGURATION - EDIT THESE VALUES
// ============================================

// Your Riot Games cookie string (from auth.riotgames.com)
const RIOT_COOKIE = process.env.RIOT_ID || "paste_your_cookie_here";

// Discord channel ID where the shop will be sent
const DISCORD_CHANNEL_ID = process.env.CHANNEL_ID || "paste_your_channel_id_here";

// ============================================
// UTILITY FUNCTIONS
// ============================================

async function fetch(url, options = {}) {
    const https = await import('https');
    const http = await import('http');
    const urlModule = await import('url');

    return new Promise((resolve, reject) => {
        const parsedUrl = urlModule.parse(url);
        const isHttps = parsedUrl.protocol === 'https:';

        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.path,
            method: options.method || 'GET',
            headers: options.headers || {},
            ...options
        };

        const req = (isHttps ? https : http).request(reqOptions, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: body
                });
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

function parseSetCookie(cookieHeader) {
    if (!cookieHeader) return {};

    const cookies = {};
    const cookieStrings = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];

    for (const cookieStr of cookieStrings) {
        const parts = cookieStr.split(';')[0].split('=');
        if (parts.length === 2) {
            cookies[parts[0].trim()] = parts[1].trim();
        }
    }

    return cookies;
}

function extractTokensFromUri(uri) {
    const urlParams = new URLSearchParams(uri.split('#')[1] || '');
    const accessToken = urlParams.get('access_token');
    const idToken = urlParams.get('id_token');
    return [accessToken, idToken];
}

function decodeToken(token) {
    const payload = token.split('.')[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
}

function riotClientHeaders() {
    return {
        'User-Agent': 'ShooterGame/13 Windows/10.0.19043.1.256.64bit',
        'X-Riot-ClientVersion': 'release-08.07-shipping-22-806071',
        'X-Riot-ClientPlatform': 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQzLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9'
    };
}

// ============================================
// SKIN CACHE (simplified)
// ============================================

let skinsCache = null;

async function loadSkinData() {
    if (skinsCache) return skinsCache;

    console.log("Loading skin data from Valorant API...");

    try {
        const req = await fetch("https://valorant-api.com/v1/weapons?language=all");
        if (req.statusCode !== 200) {
            console.error("Failed to fetch skin data");
            return null;
        }

        const json = JSON.parse(req.body);
        if (json.status !== 200) {
            console.error("Invalid skin data response");
            return null;
        }

        skinsCache = {};
        for (const weapon of json.data) {
            for (const skin of weapon.skins) {
                const levelOne = skin.levels[0];

                let icon;
                if (skin.themeUuid === "5a629df4-4765-0214-bd40-fbb96542941f") { // default skins
                    icon = skin.chromas[0] && skin.chromas[0].fullRender;
                } else {
                    for (let i = 0; i < skin.levels.length; i++) {
                        if (skin.levels[i] && skin.levels[i].displayIcon) {
                            icon = skin.levels[i].displayIcon;
                            break;
                        }
                    }
                }
                if (!icon) icon = null;

                skinsCache[levelOne.uuid] = {
                    uuid: levelOne.uuid,
                    names: skin.displayName,
                    icon: icon,
                    rarity: skin.contentTierUuid,
                    price: null // We'll set this later if available
                };
            }
        }

        console.log(`✅ Loaded ${Object.keys(skinsCache).length} skins`);
        return skinsCache;
    } catch (error) {
        console.error("Error loading skin data:", error);
        return null;
    }
}

async function getSkin(uuid) {
    if (!skinsCache) await loadSkinData();
    return skinsCache ? skinsCache[uuid] : null;
}

// ============================================
// MAIN SCRIPT
// ============================================

const VAL_COLOR_1 = 0xFD4553;

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

// Send shop via Discord webhook (simpler approach)
async function sendShopViaWebhook(shopEmbeds) {
    console.log("Sending shop via Discord webhook...");

    // Load config to get webhook URL
    const config = await import("./misc/config.js");
    const webhookUrl = config.default.webhookUrl;

    if (!webhookUrl) {
        throw new Error("No webhook URL found in config.json. Please set webhookUrl in your config.");
    }

    const webhookData = {
        embeds: shopEmbeds
    };

    const req = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookData)
    });

    if (req.statusCode >= 200 && req.statusCode < 300) {
        console.log('✅ Shop sent successfully via webhook!');
    } else {
        throw new Error(`Webhook failed with status ${req.statusCode}: ${req.body}`);
    }
}

// Alternative: Send shop by starting bot and using IPC
async function sendShopViaBot(shopEmbeds) {
    return new Promise(async (resolve, reject) => {
        console.log("Starting SkinPeek bot to send shop...");

        // Create a temporary file with the shop data
        const tempFile = `temp_shop_${Date.now()}.json`;
        const fs = await import('fs');

        try {
            fs.writeFileSync(tempFile, JSON.stringify(shopEmbeds, null, 2));
        } catch (error) {
            reject(new Error(`Failed to create temp file: ${error.message}`));
            return;
        }

        // Spawn the main SkinPeek bot with special arguments
        const botProcess = spawn('node', ['SkinPeek.js', '--send-shop', tempFile, DISCORD_CHANNEL_ID], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: process.cwd()
        });

        let shopSent = false;

        // Listen for completion message
        botProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('Bot:', output.trim());

            if (output.includes('Shop sent successfully')) {
                shopSent = true;
                console.log('✅ Shop sent successfully via bot!');
                botProcess.kill('SIGINT');
                resolve();
            }
        });

        botProcess.stderr.on('data', (data) => {
            console.error('Bot Error:', data.toString().trim());
        });

        botProcess.on('close', (code) => {
            console.log(`Bot process exited with code ${code}`);

            // Clean up temp file
            try {
                fs.unlinkSync(tempFile);
            } catch (error) {
                console.warn('Failed to clean up temp file:', error.message);
            }

            if (!shopSent) {
                reject(new Error('Bot exited before shop was sent'));
            }
        });

        botProcess.on('error', (error) => {
            console.error('Failed to start bot:', error);
            reject(error);
        });

        // Timeout after 30 seconds
        setTimeout(() => {
            if (!shopSent) {
                console.error('❌ Timeout: Bot took too long to send shop');
                botProcess.kill('SIGINT');
                reject(new Error('Timeout'));
            }
        }, 30000);
    });
}

async function main() {
    try {
        console.log("=".repeat(50));
        console.log("Starting Valorant Shop Fetch Script");
        console.log("=".repeat(50));

        // Validate configuration
        if (RIOT_COOKIE === "paste_your_cookie_here") {
            console.error("❌ Please configure RIOT_COOKIE environment variable or edit the script!");
            process.exit(1);
        }

        if (DISCORD_CHANNEL_ID === "paste_your_channel_id_here") {
            console.error("❌ Please configure DISCORD_CHANNEL_ID environment variable or edit the script!");
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

        // Try to send via webhook first, fallback to bot
        try {
            await sendShopViaWebhook(embeds);
        } catch (webhookError) {
            console.log("Webhook failed, trying bot method:", webhookError.message);
            await sendShopViaBot(embeds);
        }

        console.log("=".repeat(50));
        console.log("✅ Shop successfully sent to Discord!");
        console.log("=".repeat(50));

    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

// Run the main function
main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});
