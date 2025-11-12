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
function parseTokensFromRedirect(uri) {
  const url = new URL(uri);
  const hash = url.hash.substring(1); // remove #
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
  if (!res.ok) throw new Error(`Failed to get entitlements: ${res.status}`);
  const data = await res.json();
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
  if (!res.ok) throw new Error(`Failed to get region: ${res.status}`);
  const data = await res.json();
  return data.affinities.live;
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
  if (!channel) throw new Error("Discord channel not found");

  const items = shop?.SkinsPanelLayout?.SingleItemOffers?.map(s => s) || [];
  const message = items.length
    ? "Current shop:\n" + items.join("\n")
    : "Could not find shop items.";

  await channel.send(message);
}

// ====== MAIN ======
async function main() {
  try {
    // 1. Authorize with Riot cookie
    const authRes = await fetch(
      "https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&client_id=play-valorant-web-prod&response_type=token%20id_token&scope=account%20openid&nonce=1",
      { headers: { "User-Agent": "ShooterGame/13 Windows/10.0.19043.1.256.64bit", "Cookie": VALORANT_COOKIE }, redirect: "manual" }
    );

    if (!authRes.headers.has("location")) throw new Error("Authorization failed. Check your cookie.");
    const { rso, idt } = parseTokensFromRedirect(authRes.headers.get("location"));
    if (!rso) throw new Error("RSO token not found. Check your cookie.");

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
