// autoTriggerShop.js
// Automatically fetch /valorant shop for a target user and post in Discord (plain text).

import { Client, GatewayIntentBits } from "discord.js";
import { getUser } from "./valorant/auth.js";
import { getShop } from "./valorant/shop.js";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Safe message chunker (Discord limit ~2000 chars; use slightly lower limit to allow padding)
function splitMessage(text, maxLen = 1900) {
  if (!text) return [];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + maxLen);
    // try to break on newline or space for readability
    if (end < text.length) {
      const nl = text.lastIndexOf("\n", end);
      const sp = text.lastIndexOf(" ", end);
      const cut = Math.max(nl, sp);
      if (cut > start) end = cut;
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(Boolean);
}

// Format shop response into readable plain text
function formatShopText(shopResp, targetUser) {
  if (!shopResp) return `${targetUser.username} — No shop response.`;

  // Some getShop variants return { success, shop } or return the shop directly
  const payload = shopResp.success ? shopResp.shop ?? {} : (shopResp.shop ?? shopResp) ?? shopResp;
  const offers = payload?.SkinsPanelLayout?.SingleItemOffers ?? payload?.SingleItemOffers ?? [];
  const accessories = payload?.AccessoryStore?.AccessoryStoreOffers ?? [];
  const bundles = payload?.FeaturedBundle?.Bundles ?? [];

  let lines = [];
  lines.push(`🛒 **${targetUser.username}'s Valorant Shop**`);
  lines.push(`- Skins: ${offers.length}`);
  lines.push(`- Accessories: ${accessories.length}`);
  lines.push(`- Bundles: ${bundles.length}`);

  if (offers.length) {
    lines.push("");
    lines.push("Top Skins:");
    offers.slice(0, 12).forEach((o, i) => {
      // offer might be string or object; handle both
      const label = typeof o === "string" ? o : (o?.displayName ?? o?.name ?? JSON.stringify(o));
      lines.push(`${i + 1}. ${label}`);
    });
    if (offers.length > 12) lines.push(`...and ${offers.length - 12} more`);
  }

  if (accessories.length) {
    lines.push("");
    lines.push("Accessories:");
    accessories.slice(0, 12).forEach((a, i) => {
      const label = typeof a === "string" ? a : (a?.displayName ?? a?.name ?? JSON.stringify(a));
      lines.push(`${i + 1}. ${label}`);
    });
    if (accessories.length > 12) lines.push(`...and ${accessories.length - 12} more`);
  }

  if (bundles.length) {
    lines.push("");
    lines.push(`Bundles: ${bundles.length}`);
    bundles.slice(0, 8).forEach((b, i) => {
      const label = b?.Bundle?.DataAssetID ?? b?.BundleID ?? b?.Bundle?.name ?? JSON.stringify(b);
      lines.push(`${i + 1}. ${label}`);
    });
    if (bundles.length > 8) lines.push(`...and ${bundles.length - 8} more`);
  }

  return lines.join("\n");
}

(async () => {
  // Load config if present
  let config = {};
  try {
    config = (await import(path.join(__dirname, "misc", "config.json"))).default ?? {};
  } catch (e) {
    config = {};
  }

  const token = process.env.DISCORD_TOKEN || config.token;
  if (!token) {
    console.error("No Discord token found. Set DISCORD_TOKEN env or add token to misc/config.json");
    process.exit(1);
  }

  // Create Discord client
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  try {
    await client.login(token);
  } catch (e) {
    console.error("Failed to login:", e);
    process.exit(1);
  }

  // wait ready
  if (!client.readyAt) await new Promise((res) => client.once("ready", res));
  console.log("✅ Logged in as", client.user?.tag);

  // Choose guild
  let guild;
  try {
    const guilds = await client.guilds.fetch();
    const firstKey = guilds.firstKey();
    if (!firstKey) throw new Error("Bot is not in any guilds for this token.");
    guild = await client.guilds.fetch(firstKey);
  } catch (e) {
    console.error("Failed to fetch guilds:", e);
    try { await client.destroy(); } catch {}
    process.exit(1);
  }

  // Choose channel (env TARGET_CHANNEL_ID or config.logToChannel), fallback to first viewable text channel
  const chosenChannelId = process.env.TARGET_CHANNEL_ID || config.logToChannel || null;
  let channel = null;
  if (chosenChannelId) {
    try {
      channel = await guild.channels.fetch(chosenChannelId);
    } catch (e) {
      channel = null;
    }
  }
  if (!channel) {
    // ensure channels are cached
    try { await guild.channels.fetch(); } catch (_) {}
    channel = guild.channels.cache.find((ch) => ch.isTextBased?.() && ch.viewable) ?? null;
  }

  if (!channel) {
    console.error("No accessible text channel found in the selected guild.");
    try { await client.destroy(); } catch {}
    process.exit(1);
  }

  // Resolve target user
  const targetUserId = process.env.TARGET_USER_ID || config.ownerId || null;
  let targetUser = null;
  if (targetUserId) {
    try { targetUser = await client.users.fetch(targetUserId); } catch (e) { targetUser = null; }
  }
  if (!targetUser) {
    try {
      const members = await guild.members.fetch({ limit: 10 });
      const human = [...members.values()].find((m) => !m.user.bot);
      targetUser = human?.user ?? client.user;
    } catch (e) {
      targetUser = client.user;
    }
  }

  // Inform channel that we're starting
  try {
    await channel.send(`Posting shop for ${targetUser.username}...`);
  } catch (e) {
    console.error("Failed to send initial notice to channel:", e);
    // continue anyway
  }

  // Fetch valorant user record via getUser()
  let valorantUser = null;
  try {
    valorantUser = getUser ? getUser(targetUser.id) : null;
  } catch (e) {
    console.warn("getUser() threw:", e);
    valorantUser = null;
  }

  if (!valorantUser) {
    try {
      await channel.send(`${targetUser.username} is not registered in the Valorant system (getUser returned nothing).`);
    } catch (e) {
      console.error("Failed to notify about missing valorant user:", e);
    }
    try { await client.destroy(); } catch {}
    process.exit(1);
  }

  // Attempt to fetch shop. Try a couple of likely signatures to maximize compatibility.
  let shopResp = null;
  try {
    // prefer getShop(valorantUser) if that matches your code
    try {
      shopResp = await getShop(valorantUser);
    } catch (e1) {
      // some implementations expect getShop(userId) or getShop(null, valorantUser, userId)
      try {
        shopResp = await getShop(targetUser.id);
      } catch (e2) {
        // try fallback signature: getShop(null, valorantUser, userId)
        try {
          shopResp = await getShop(null, valorantUser, targetUser.id);
        } catch (e3) {
          throw new Error("getShop failed for all tried call signatures");
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch shop via getShop:", err);
    try { await channel.send(`Failed to fetch shop for ${targetUser.username}.`); } catch (e) { console.error("Failed to send failure message:", e); }
    try { await client.destroy(); } catch {}
    process.exit(1);
  }

  // Format response to plain text and send (chunk if necessary)
  try {
    const text = formatShopText(shopResp, targetUser);
    const chunks = splitMessage(text);
    for (const c of chunks) {
      await channel.send(c).catch((e) => console.error("Failed to send chunk:", e));
      // small spacing delay to be polite to rate limits
      await sleep(200);
    }
  } catch (e) {
    console.error("Failed to format/send shop:", e);
    try { await channel.send(`Shop fetched but failed to format/post for ${targetUser.username}.`); } catch (ee) { console.error("Also failed to send fallback message:", ee); }
  }

  // cleanup
  await sleep(500);
  try {
    await client?.destroy?.();
  } catch (e) {
    // ignore
  }
  console.log("Done — exiting.");
  process.exit(0);
})();
