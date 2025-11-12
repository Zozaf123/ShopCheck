// autoTriggerShop.js
import fetch from "node-fetch";

// ---------------- CONFIG ----------------
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // your bot token
const TARGET_CHANNEL_ID = "1264023343577694372"; // channel to post shop

// Hardcode your Valorant cookie here:
const VALORANT_COOKIE = `osano_consentmanager_uuid=ebe17757-5a0d-4d64-b1cb-327ae5a1507d; osano_consentmanager=t5e_8v4OumSWIPLrZ4C41VM5pbZtizjk9iq9tINRnyNKTilP8TdS6VVw4LRuPqu7bFZzr58O7_e5GBbGnbTXLx7I2txKIn9KehvWeuCt32shms_X7_pOi5Fv3PTIQmsNC_i6bm3eOsEJv2yXVlQGkakDCwnVDTRgfPfmuUjp6sWVPgndAIR-6GEAuEUukDgErQpWG5Hf3IopthcuFbG9HpB5iEv9q15kCAH4K80JDjIl8TX-uW3y15B98gUYL4YEb7hA6NwoqgzTQTDNNtWk0bCa75pn9mpI_zWP0gdeuiYUTVIdsUyJ5iubMwc2EBkVFN_emUjk9Pw=; __Secure-session_state=tZlnrGvNiLu-Q3hHpTFQM0FLXpFUTGx8oExOWA0L3Cc.P8JBId0UKl_5nlKgZIcKZQ; __Secure-refresh_token_presence=1; sub=658afbd2-d078-5ba5-90aa-83fd293513da; csid=i_gfNJ9zhbkvrJPeYVxsdw.KbXiHPgSEguRS5rxh6_pFQ; clid=uw1; PVPNET_LANG=en_US; tdid=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjkyYWY5MGE3LWUxN2EtNDQyMi05YzU0LTFmNWQ3ZTNmNTJhOSIsIm5vbmNlIjoiNEZiVkc3Umsza2c9IiwiaWF0IjoxNzYyOTA4NTQyfQ.NtujXO0ONMNkJQqimbkDgAEK8eyve_oyoGa1li4KmJQ; id_token=eyJraWQiOiJyc28tcHJvZC0yMDI0LTExIiwidHlwIjoiaWRfdG9rZW4rand0IiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiI2NThhZmJkMi1kMDc4LTViYTUtOTBhYS04M2ZkMjkzNTEzZGEiLCJjb3VudHJ5IjoidXNhIiwiY291bnRyeV9hdCI6MTY1NDQ2NDQ0NzAwMCwiYW1yIjpbInBhc3N3b3JkIiwibWZhIl0sImlzcyI6Imh0dHBzOi8vYXV0aC5yaW90Z2FtZXMuY29tIiwicGhvbmVfbnVtYmVyX3ZlcmlmaWVkIjp0cnVlLCJsb2NhbGUiOiJlbl9VUyIsImFjY291bnRfdmVyaWZpZWQiOnRydWUsImF1ZCI6InJzby13ZWItY2xpZW50LXByb2QiLCJhY3IiOiJ1cm46cmlvdDpnb2xkIiwicGxheWVyX2xvY2FsZSI6ImVuIiwiZXhwIjoxNzYyOTk0OTQyLCJpYXQiOjE3NjI5MDg1NDIsImFjY3QiOnsiZ2FtZV9uYW1lIjoiWm96YWYiLCJ0YWdfbGluZSI6IjY5NjkifSwiYWdlIjoyMCwianRpIjoiMWMxSmI1TU1fZFEiLCJsb2dpbl9jb3VudHJ5IjoidXNhIn0.U1rq7czs3N-xb8V7DDV0-urUgX0zKmpW4N0CffU5bQ7B88CT0xwW_5ExzzvaekNe1j2ElcmycC34uIZmuKOsZcVffKfH8m8ADLCd8V_DZ8cQ9S_Yb4Vc1F2QCXLiC5FIXqPPhgZJMhYkYgap9NqzIo1O4MWnXyREWgYOQTWGPkV6l60fQSIxZJbwBPiK_EiFCSOOz7-LgQlEn6YnWLNrJxaOSrItHu_k5h5_LYiKSS5wEmlF5t-AOMRu77EyYYbVD8IKYNhdN-Yp6FG_ecVd2sVSAZ0Z8Qh91mrUxAnKJpNs3M2yGo6R683fvv5y3RpHnGpWXufsQy9pMeF5PBwfJw; id_hint=sub%3D658afbd2-d078-5ba5-90aa-83fd293513da%26lang%3Den%26game_name%3DZozaf%26tag_line%3D6969; ssid=eyJhbGciOiJIUzI1NiJ9.eyJsb2dpblRva2VuIjoiOGJjODUwZGQtNmUzNy00ZWQzLWFlNmMtYzg3YmQ4MGU4ZTM3Iiwic3ViIjoiNjU4YWZiZDItZDA3OC01YmE1LTkwYWEtODNmZDI5MzUxM2RhIiwic2VyaWVzVG9rZW4iOiI1ZTAyOGM0Yi0yYjM3LTRiMjUtOTc4ZC0yODBkNzQzZDlhOTMiLCJzc2lkIjoiaV9nZk5KOXpoYmt2ckpQZVlWeHNkdy5LYlhpSFBnU0VndVJTNXJ4aDZfcEZRIiwiaWF0IjoxNzYyOTA4NTk1fQ.buJmM8uaEx1O4yz6CWS9kp45MV7w_vPWNuVo3uWMIhk
`; 
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
