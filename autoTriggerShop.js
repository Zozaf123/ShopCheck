// autoTriggerShop.js
// Auto-run the /shop command for a target user and post the result, then exit.

import { Client, GatewayIntentBits } from "discord.js";
import { fileURLToPath } from "url";
import path from "path";

// Load config.json if it exists
let config = {};
try {
  config = (await import("./misc/config.json")).default ?? {};
} catch {}

// Utility helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tryImport = async (p) => { try { return await import(p); } catch { return null; } };

// --- Helper: format shop data into readable text ---
function formatShopText(shopResp, targetUser) {
  if (!shopResp || !shopResp.success) {
    return `${targetUser.username} — Failed to fetch shop (no success).`;
  }

  const offers = shopResp.shop?.SkinsPanelLayout?.SingleItemOffers ?? [];
  const accessories = shopResp.shop?.AccessoryStore?.AccessoryStoreOffers ?? [];
  const bundles = shopResp.shop?.FeaturedBundle?.Bundles ?? [];

  let msg = `🛒 Shop for ${targetUser.username}:\n`;
  msg += `- Skins: ${offers.length}\n`;
  msg += `- Accessories: ${accessories.length}\n`;
  msg += `- Bundles: ${bundles.length}\n`;

  if (offers.length) {
    const offerList = offers.slice(0, 8).map((o, i) => `${i + 1}. ${o}`).join("\n");
    msg += `\nTop Skins:\n${offerList}`;
  }

  if (accessories.length) msg += `\nAccessories: ${accessories.map(a => a).join(", ")}`;
  if (bundles.length) msg += `\nBundles: ${bundles.map(b => b.Bundle?.DataAssetID ?? b.BundleID ?? "Unknown").join(", ")}`;

  return msg;
}

// Main async IIFE
(async () => {
  // --- Token selection ---
  const token = process.env.DISCORD_TOKEN || config.token;
  if (!token) {
    console.error("No Discord token found. Set DISCORD_TOKEN env or config.json.");
    process.exit(1);
  }

  // --- Attempt dynamic imports ---
  const fetchCandidates = [
    "./SkinPeek.js",
    "./commands/shop.js",
    "./commands/shop/index.js",
    "./misc/util.js",
    "./shop.js",
    "./getShop.js",
    "./src/commands/shop.js"
  ];

  let fetchShopFunc = null;
  let moduleWithClient = null;
  for (const p of fetchCandidates) {
    const mod = await tryImport(p);
    if (!mod) continue;
    fetchShopFunc = fetchShopFunc || (mod.fetchShop ?? mod.handleShop ?? mod.default?.fetchShop ?? mod.default?.handleShop ?? null);
    if (!moduleWithClient) moduleWithClient = mod;
  }

  const shopModCandidates = ["./shopModule.js","./shop.js","./getShop.js","./misc/shop.js","./modules/shop.js","./src/shop.js"];
  let getShopFunc = null;
  for (const p of shopModCandidates) {
    const m = await tryImport(p);
    if (!m) continue;
    getShopFunc = getShopFunc || (m.getShop ?? m.default?.getShop ?? null);
    if (getShopFunc) break;
  }

  const authMod = await tryImport("./auth.js");
  const getUser = authMod?.getUser ?? null;

  // --- Prepare or reuse client ---
  let client = moduleWithClient?.client ?? moduleWithClient?.default?.client ?? null;
  if (!client) {
    client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
    try { await client.login(token); } catch (e) { console.error("Login failed:", e); process.exit(1); }
  } else {
    if (!client.readyAt) await new Promise(res => client.once("ready", res));
  }
  if (!client.readyAt) await new Promise(res => client.once("ready", res));
  console.log("✅ Logged in as", client.user.tag);

  // --- Fetch guild ---
  let guild;
  try {
    const guildsMap = await client.guilds.fetch();
    const firstGuildId = guildsMap.firstKey();
    if (!firstGuildId) throw new Error("Bot is not in any guilds.");
    guild = await client.guilds.fetch(firstGuildId);
    console.log(`Using guild: ${guild.name} (${guild.id})`);
  } catch (err) {
    console.error("Error fetching guilds:", err);
    await client.destroy().catch(() => {});
    process.exit(1);
  }

  // --- Choose channel ---
  const chosenChannelId = process.env.TARGET_CHANNEL_ID || config.logToChannel || null;
  let channel = null;
  if (chosenChannelId) channel = await guild.channels.fetch(chosenChannelId).catch(() => null);
  if (!channel) channel = guild.channels.cache.find(ch => ch.isTextBased?.() && ch.viewable) ?? null;
  if (!channel) { console.error("No accessible text channel."); await client.destroy(); process.exit(1); }
  console.log(`Using channel: ${channel.name ?? channel.id}`);

  // --- Determine target user ---
  const targetUserId = process.env.TARGET_USER_ID || config.ownerId || null;
  let targetUser = null;
  if (targetUserId) targetUser = await client.users.fetch(targetUserId).catch(() => null);
  if (!targetUser) {
    const members = await guild.members.fetch({ limit: 10 }).catch(() => new Map());
    const firstHuman = [...members.values()].find(m => !m.user.bot);
    targetUser = firstHuman?.user ?? client.user;
  }

  // --- Build fake interaction ---
  const fakeInteraction = {
    isCommand: () => true,
    isAutocomplete: () => false,
    commandName: "shop",
    user: targetUser,
    guild,
    channel,
    options: { getUser: () => null },
    locale: "en-US",
    reply: async (payload) => {
      const content = typeof payload === "string" ? payload : payload.content ?? "";
      const embeds = payload.embeds ?? [];
      await channel.send({ content, embeds }).catch(console.error);
      return {};
    },
    deferReply: async () => {},
    editReply: async (payload) => { await channel.send({ content: payload.content ?? "", embeds: payload.embeds ?? [] }).catch(console.error); },
    followUp: async (payload) => { await channel.send({ content: payload.content ?? "", embeds: payload.embeds ?? [] }).catch(console.error); },
    respond: async () => {},
  };

  // --- Helper mention ---
  const mention = u => `<@${u.id}>`;

  // --- Trigger shop logic ---
  let triggered = false;

  // Strategy A: fetchShopFunc
  if (fetchShopFunc) {
    try {
      let valorantUser = getUser ? getUser(targetUser.id) : null;
      const result = await fetchShopFunc(fakeInteraction, valorantUser, targetUser.id);
      if (result?.shop) {
        const textMessage = formatShopText(result, targetUser);
        await channel.send(textMessage);
      }
      triggered = true;
    } catch (e) { console.warn("fetchShopFunc failed:", e); }
  }

  // Strategy B: getShopFunc
  if (!triggered && getShopFunc) {
    try {
      const shopResp = await getShopFunc(targetUser.id);
      const textMessage = formatShopText(shopResp, targetUser);
      await channel.send(textMessage);
      triggered = true;
    } catch (e) { console.warn("getShopFunc failed:", e); }
  }

  // Strategy C: fallback to interactionCreate
  if (!triggered) {
    try {
      client.emit("interactionCreate", fakeInteraction);
      triggered = true;
    } catch (e) { console.warn("Fallback interactionCreate failed:", e); }
  }

  if (!triggered) {
    console.error("\n⚠️ Could not trigger shop automatically. Consider exporting client or fetchShop from SkinPeek.js.");
  }

  await sleep(8000);
  await client.destroy().catch(() => {});
  console.log("Done — exiting.");
  process.exit(0);
})();
