// autoTriggerShop.js
// Automatically fetch /shop for a target user and post as text

import { Client, GatewayIntentBits } from "discord.js";
import { fileURLToPath } from "url";
import path from "path";

let config = {};
try { config = (await import("./misc/config.json")).default ?? {}; } catch {}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const tryImport = async (p) => { try { return await import(p); } catch { return null; } };

// --- Format shop response as plain text
function formatShopText(shopResp, targetUser) {
  if (!shopResp || !shopResp.success) return `${targetUser.username} — Failed to fetch shop.`;

  const offers = shopResp.shop?.SkinsPanelLayout?.SingleItemOffers ?? [];
  const accessories = shopResp.shop?.AccessoryStore?.AccessoryStoreOffers ?? [];
  const bundles = shopResp.shop?.FeaturedBundle?.Bundles ?? [];

  let msg = `🛒 Shop for ${targetUser.username}:\n`;
  msg += `- Skins: ${offers.length}\n`;
  msg += `- Accessories: ${accessories.length}\n`;
  msg += `- Bundles: ${bundles.length}\n`;

  if (offers.length) msg += "\nTop Skins:\n" + offers.slice(0, 8).map((o,i) => `${i+1}. ${o}`).join("\n");
  if (accessories.length) msg += `\nAccessories: ${accessories.map(a => a).join(", ")}`;
  if (bundles.length) msg += `\nBundles: ${bundles.map(b => b.Bundle?.DataAssetID ?? b.BundleID ?? "Unknown").join(", ")}`;

  return msg;
}

(async () => {
  const token = process.env.DISCORD_TOKEN || config.token;
  if (!token) { console.error("No Discord token found."); process.exit(1); }

  // Try to import shop fetch handlers
  const fetchCandidates = ["./SkinPeek.js","./commands/shop.js","./commands/shop/index.js","./shop.js"];
  let fetchShopFunc = null;
  let moduleWithClient = null;
  for (const p of fetchCandidates) {
    const mod = await tryImport(p);
    if (!mod) continue;
    fetchShopFunc ||= mod.fetchShop ?? mod.handleShop ?? mod.default?.fetchShop ?? mod.default?.handleShop ?? null;
    if (!moduleWithClient) moduleWithClient = mod;
  }

  const shopModCandidates = ["./shop.js","./getShop.js","./misc/shop.js"];
  let getShopFunc = null;
  for (const p of shopModCandidates) {
    const m = await tryImport(p);
    if (!m) continue;
    getShopFunc ||= m.getShop ?? m.default?.getShop ?? null;
    if (getShopFunc) break;
  }

  const authMod = await tryImport("./auth.js");
  const getUser = authMod?.getUser ?? null;

  // --- Prepare Discord client ---
  let client = moduleWithClient?.client ?? moduleWithClient?.default?.client ?? null;
  if (!client) {
    client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
    await client.login(token).catch(e => { console.error("Login failed:", e); process.exit(1); });
  } else if (!client.readyAt) {
    await new Promise(res => client.once("ready", res));
  }
  if (!client.readyAt) await new Promise(res => client.once("ready", res));
  console.log("✅ Logged in as", client.user.tag);

  // --- Fetch guild and channel ---
  const guildsMap = await client.guilds.fetch();
  const guild = await client.guilds.fetch(guildsMap.firstKey());
  let channel = null;
  const chosenChannelId = process.env.TARGET_CHANNEL_ID || config.logToChannel;
  if (chosenChannelId) channel = await guild.channels.fetch(chosenChannelId).catch(() => null);
  if (!channel) channel = guild.channels.cache.find(ch => ch.isTextBased?.() && ch.viewable);
  if (!channel) { console.error("No accessible channel."); await client.destroy(); process.exit(1); }

  // --- Determine target user ---
  const targetUserId = process.env.TARGET_USER_ID || config.ownerId;
  let targetUser = targetUserId ? await client.users.fetch(targetUserId).catch(() => null) : null;
  if (!targetUser) {
    const members = await guild.members.fetch({ limit: 10 });
    targetUser = [...members.values()].find(m => !m.user.bot)?.user ?? client.user;
  }

  // --- Notify Discord before fetching ---
  await channel.send(`Posting shop for ${targetUser.username}...`);

  // --- Fake interaction object for /shop handler ---
  const fakeInteraction = {
    isCommand: () => true,
    isAutocomplete: () => false,
    commandName: "shop",
    user: targetUser,
    guild,
    channel,
    options: { getUser: () => null },
    locale: "en-US",
    reply: async (payload) => { await channel.send({ content: payload.content ?? payload, embeds: payload.embeds ?? [] }).catch(console.error); return {}; },
    deferReply: async () => {},
    editReply: async (payload) => { await channel.send({ content: payload.content ?? "", embeds: payload.embeds ?? [] }).catch(console.error); },
    followUp: async (payload) => { await channel.send({ content: payload.content ?? "", embeds: payload.embeds ?? [] }).catch(console.error); },
    respond: async () => {},
  };

  // --- Trigger shop fetch ---
  let triggered = false;

  if (fetchShopFunc) {
    try {
      const valorantUser = getUser ? getUser(targetUser.id) : null;
      const result = await fetchShopFunc(fakeInteraction, valorantUser, targetUser.id);
      if (result?.shop) {
        await channel.send(formatShopText(result, targetUser));
      }
      triggered = true;
    } catch { }
  }

  if (!triggered && getShopFunc) {
    try {
      const shopResp = await getShopFunc(targetUser.id);
      await channel.send(formatShopText(shopResp, targetUser));
      triggered = true;
    } catch { }
  }

  if (!triggered) {
    try { client.emit("interactionCreate", fakeInteraction); triggered = true; } catch { }
  }

  if (!triggered) console.error("⚠️ Could not fetch shop automatically.");

  await sleep(5000);
  await client.destroy().catch(() => {});
  process.exit(0);

})();
