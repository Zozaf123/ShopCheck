// autoTriggerShop.js
import fetch from "node-fetch";
import { Client, GatewayIntentBits } from "discord.js";

// ====== CONFIG ======
const VALORANT_COOKIE = `osano_consentmanager_uuid=ebe17757-5a0d-4d64-b1cb-327ae5a1507d; osano_consentmanager=t5e_8v4OumSWIPLrZ4C41VM5pbZtizjk9iq9tINRnyNKTilP8TdS6VVw4LRuPqu7bFZzr58O7_e5GBbGnbTXLx7I2txKIn9KehvWeuCt32shms_X7_pOi5Fv3PTIQmsNC_i6bm3eOsEJv2yXVlQGkakDCwnVDTRgfPfmuUjp6sWVPgndAIR-6GEAuEUukDgErQpWG5Hf3IopthcuFbG9HpB5iEv9q15kCAH4K80JDjIl8TX-uW3y15B98gUYL4YEb7hA6NwoqgzTQTDNNtWk0bCa75pn9mpI_zWP0gdeuiYUTVIdsUyJ5iubMwc2EBkVFN_emUjk9Pw=; __Secure-session_state=tZlnrGvNiLu-Q3hHpTFQM0FLXpFUTGx8oExOWA0L3Cc.P8JBId0UKl_5nlKgZIcKZQ; __Secure-refresh_token_presence=1; sub=658afbd2-d078-5ba5-90aa-83fd293513da; csid=i_gfNJ9zhbkvrJPeYVxsdw.KbXiHPgSEguRS5rxh6_pFQ; clid=uw1; PVPNET_LANG=en_US; tdid=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjkyYWY5MGE3LWUxN2EtNDQyMi05YzU0LTFmNWQ3ZTNmNTJhOSIsIm5vbmNlIjoiNEZiVkc3Umsza2c9IiwiaWF0IjoxNzYyOTA4NTQyfQ.NtujXO0ONMNkJQqimbkDgAEK8eyve_oyoGa1li4KmJQ; id_token=eyJraWQiOiJyc28tcHJvZC0yMDI0LTExIiwidHlwIjoiaWRfdG9rZW4rand0IiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiI2NThhZmJkMi1kMDc4LTViYTUtOTBhYS04M2ZkMjkzNTEzZGEiLCJjb3VudHJ5IjoidXNhIiwiY291bnRyeV9hdCI6MTY1NDQ2NDQ0NzAwMCwiYW1yIjpbInBhc3N3b3JkIiwibWZhIl0sImlzcyI6Imh0dHBzOi8vYXV0aC5yaW90Z2FtZXMuY29tIiwicGhvbmVfbnVtYmVyX3ZlcmlmaWVkIjp0cnVlLCJsb2NhbGUiOiJlbl9VUyIsImFjY291bnRfdmVyaWZpZWQiOnRydWUsImF1ZCI6InJzby13ZWItY2xpZW50LXByb2QiLCJhY3IiOiJ1cm46cmlvdDpnb2xkIiwicGxheWVyX2xvY2FsZSI6ImVuIiwiZXhwIjoxNzYyOTk0OTQyLCJpYXQiOjE3NjI5MDg1NDIsImFjY3QiOnsiZ2FtZV9uYW1lIjoiWm96YWYiLCJ0YWdfbGluZSI6IjY5NjkifSwiYWdlIjoyMCwianRpIjoiMWMxSmI1TU1fZFEiLCJsb2dpbl9jb3VudHJ5IjoidXNhIn0.U1rq7czs3N-xb8V7DDV0-urUgX0zKmpW4N0CffU5bQ7B88CT0xwW_5ExzzvaekNe1j2ElcmycC34uIZmuKOsZcVffKfH8m8ADLCd8V_DZ8cQ9S_Yb4Vc1F2QCXLiC5FIXqPPhgZJMhYkYgap9NqzIo1O4MWnXyREWgYOQTWGPkV6l60fQSIxZJbwBPiK_EiFCSOOz7-LgQlEn6YnWLNrJxaOSrItHu_k5h5_LYiKSS5wEmlF5t-AOMRu77EyYYbVD8IKYNhdN-Yp6FG_ecVd2sVSAZ0Z8Qh91mrUxAnKJpNs3M2yGo6R683fvv5y3RpHnGpWXufsQy9pMeF5PBwfJw; id_hint=sub%3D658afbd2-d078-5ba5-90aa-83fd293513da%26lang%3Den%26game_name%3DZozaf%26tag_line%3D6969; ssid=eyJhbGciOiJIUzI1NiJ9.eyJsb2dpblRva2VuIjoiOGJjODUwZGQtNmUzNy00ZWQzLWFlNmMtYzg3YmQ4MGU4ZTM3Iiwic3ViIjoiNjU4YWZiZDItZDA3OC01YmE1LTkwYWEtODNmZDI5MzUxM2RhIiwic2VyaWVzVG9rZW4iOiI1ZTAyOGM0Yi0yYjM3LTRiMjUtOTc4ZC0yODBkNzQzZDlhOTMiLCJzc2lkIjoiaV9nZk5KOXpoYmt2ckpQZVlWeHNkdy5LYlhpSFBnU0VndVJTNXJ4aDZfcEZRIiwiaWF0IjoxNzYyOTA4NTk1fQ.buJmM8uaEx1O4yz6CWS9kp45MV7w_vPWNuVo3uWMIhk`.trim();
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TARGET_CHANNEL_ID = "1264023343577694372";

// ====== DISCORD CLIENT ======
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// ====== HELPERS ======
async function redeemCookie(cookie) {
    // Redeem cookie using Riot Auth API
    const res = await fetch("https://auth.riotgames.com/api/v1/authorization", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Cookie": cookie,
            "User-Agent": "ShooterGame/13 Windows/10.0.19043.1.256.64bit",
        },
        body: JSON.stringify({ type: "auth", username: "", password: "", remember: true })
    });

    const data = await res.json();

    if (data.type !== "response" || !data.response?.parameters?.uri) {
        throw new Error("Failed to redeem cookie. Make sure it's complete and valid.");
    }

    // Extract RSO and ID token from response URI
    const uri = new URL(data.response.parameters.uri);
    const hash = uri.hash.substring(1); // remove #
    const params = new URLSearchParams(hash);

    return {
        rso: params.get("access_token"),
        idt: params.get("id_token")
    };
}

async function getEntitlements(rso) {
    const res = await fetch("https://entitlements.auth.riotgames.com/api/token/v1", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${rso}`,
            "Content-Type": "application/json"
        }
    });
    const json = await res.json();
    return json.entitlements_token;
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
    const json = await res.json();
    return json.affinities.live;
}

async function fetchShop(rso, ent, region) {
    const url = `https://pd.${region}.a.pvp.net/store/v2/storefront/${rso}`;
    const res = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${rso}`,
            "X-Riot-Entitlements-JWT": ent
        }
    });
    if (!res.ok) throw new Error(`Failed to fetch shop: ${res.status}`);
    return await res.json();
}

async function postShopToDiscord(shop) {
    const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
    if (!channel) throw new Error("Channel not found");

    const items = shop.SkinsPanelLayout?.SingleItemOffers || [];
    const message = items.length
        ? "Current shop:\n" + items.map(i => i).join("\n")
        : "Could not find shop items.";

    await channel.send(message);
}

// ====== MAIN ======
async function main() {
    try {
        // 1. Redeem cookie to get RSO + ID token
        const { rso, idt } = await redeemCookie(VALORANT_COOKIE);
        console.log("Successfully redeemed cookie.");

        // 2. Get entitlements and region
        const ent = await getEntitlements(rso);
        const region = await getRegion(rso, idt);

        // 3. Fetch shop
        const shop = await fetchShop(rso, ent, region);

        // 4. Post to Discord
        await postShopToDiscord(shop);

        console.log("Shop posted successfully!");
    } catch (err) {
        console.error("Error posting shop:", err);
    } finally {
        client.destroy();
    }
}

// ====== RUN DISCORD CLIENT ======
client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`);
    main();
});

client.login(DISCORD_TOKEN);
