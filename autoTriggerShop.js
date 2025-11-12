// autoTriggerShop.js
// Automatically fetch /shop for a target user and post in Discord
import { Client, GatewayIntentBits } from "discord.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load config if exists
let config = {};
try {
  config = (await import("./misc/config.json")).default ?? {};
} catch {}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const tryImport = async (p) => { try { return await import(p); } catch { return null; } };

(async () => {
  const token = process.env.DISCORD_TOKEN || config.token;
  if (!token) { console.error("No Discord token found."); process.exit(1); }

  // Import SkinPeek.js (or wherever fetchShop is exported)
  const skinPeekMod = await tryImport("./SkinPeek.js") || {};
  const fetchShop = skinPeekMod.fetchShop ?? skinPeekMod.default?.fetchShop;
  const getUser = skinPeekMod.getUser ?? skinPeekMod.default?.getUser ?? null;
  let client = skinPeekMod.client ?? skinPeekMod.default?.client ?? null;

  // Create client if not exported
  if (!client) {
    client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
    await client.login(token).catch(e => { console.error("Login failed:", e); process.exit(1); });
  } else if (!client.readyAt) {
    await new Promise(res => client.once("ready", res));
  }

  if (!client.readyAt) await new Promise(res => client.once("ready", res));
  console.log("✅ Logged in as", client.user.tag);

  // --- Fetch guild ---
  const guildsMap = await client.guilds.fetch();
  const guild = await client.guilds.fetch(guildsMap.firstKey());

  // --- Determine channel ---
  let channel = null;
  const chosenChannelId = process.env.TARGET_CHANNEL_ID || config.logToChannel;
  if (chosenChannelId) channel = await guild.channels.fetch(chosenChannelId).catch(() => null);
  if (!channel) channel = guild.channels.cache.find(ch => ch.isTextBased?.() && ch.viewable);
  if (!channel) { console.error("No accessible channel."); await client.destroy().catch(() => {}); process.exit(1); }

  // --- Determine target user ---
  const targetUserId = process.env.TARGET_USER_ID || config.ownerId;
  let targetUser = targetUserId ? await client.users.fetch(targetUserId).catch(() => null) : null;
  if (!targetUser) {
    const members = await guild.members.fetch({ limit: 10 });
    targetUser = [...members.values()].find(m => !m.user.bot)?.user ?? client.user;
  }

  // --- Notify Discord before fetching ---
  await channel.send(`Posting shop for ${targetUser.username}...`).catch(console.error);

  // --- Fake interaction object ---
  const fakeInteraction = {
    isCommand: () => true,
    isAutocomplete: () => false,
    commandName: "shop",
    user: targetUser,
    guild,
    channel,
    options: { getUser: () => null }, // always fetch own shop
    locale: "en-US",
    reply: async (payload) => { await channel.send({ content: payload.content ?? payload, embeds: payload.embeds ?? [] }).catch(console.error); return {}; },
    deferReply: async () => {},
    editReply: async (payload) => { await channel.send({ content: payload.content ?? "", embeds: payload.embeds ?? [] }).catch(console.error); },
    followUp: async (payload) => { await channel.send({ content: payload.content ?? "", embeds: payload.embeds ?? [] }).catch(console.error); },
    respond: async () => {}
  };

  // --- Fetch Valorant user ---
  const valorantUser = getUser ? getUser(targetUser.id) : null;

  // --- Trigger /shop ---
  if (!fetchShop) {
    console.error("fetchShop function not found. Make sure SkinPeek.js exports it.");
  } else {
    try {
      const result = await fetchShop(fakeInteraction, valorantUser, targetUser.id);
      console.log(`✅ Shop fetched for ${targetUser.username}`);
    } catch (err) {
      console.error("Failed to fetch shop:", err);
    }
  }

  // --- Wait a few seconds to ensure messages are sent ---
  await sleep(5000);
  await client.destroy().catch(() => {});
  console.log("Done — exiting.");
  process.exit(0);
})();
