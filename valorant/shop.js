// autoTriggerShop.js
// Automatically fetch /valorant shop for a target user and post in Discord

import { Client, GatewayIntentBits } from "discord.js";
import { getUser } from "./valorant/auth.js";
import { getShop } from "./valorant/shop.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  // --- Discord token ---
  let config = {};
  try { config = (await import("./misc/config.json")).default ?? {}; } catch {}
  const token = process.env.DISCORD_TOKEN || config.token;
  if (!token) { console.error("No Discord token found."); process.exit(1); }

  // --- Initialize Discord client ---
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  await client.login(token).catch(e => { console.error("Login failed:", e); process.exit(1); });
  await new Promise(res => client.once("ready", res));
  console.log("✅ Logged in as", client.user.tag);

  // --- Select guild ---
  const guildsMap = await client.guilds.fetch();
  const guild = await client.guilds.fetch(guildsMap.firstKey());
  if (!guild) { console.error("No guild found."); process.exit(1); }

  // --- Select channel ---
  const chosenChannelId = process.env.TARGET_CHANNEL_ID || config.logToChannel;
  let channel = null;
  if (chosenChannelId) channel = await guild.channels.fetch(chosenChannelId).catch(() => null);
  if (!channel) channel = guild.channels.cache.find(ch => ch.isTextBased?.() && ch.viewable);
  if (!channel) { console.error("No accessible channel."); await client.destroy().catch(() => {}); process.exit(1); }

  // --- Select target user ---
  const targetUserId = process.env.TARGET_USER_ID || config.ownerId;
  let targetUser = targetUserId ? await client.users.fetch(targetUserId).catch(() => null) : null;
  if (!targetUser) {
    const members = await guild.members.fetch({ limit: 10 });
    targetUser = [...members.values()].find(m => !m.user.bot)?.user ?? client.user;
  }

  // --- Notify Discord ---
  await channel.send(`Posting shop for ${targetUser.username}...`).catch(console.error);

  // --- Fetch Valorant user and shop ---
  const valorantUser = getUser(targetUser.id);
  if (!valorantUser) {
    await channel.send(`${targetUser.username} is not registered in Valorant system.`).catch(console.error);
    await client.destroy();
    process.exit(1);
  }

  let shopResp = null;
  try {
    shopResp = await getShop(valorantUser);
  } catch (err) {
    console.error("Failed to fetch shop:", err);
    await channel.send(`Failed to fetch shop for ${targetUser.username}.`).catch(console.error);
    await client.destroy();
    process.exit(1);
  }

  // --- Format shop text ---
  const offers = shopResp?.shop?.SkinsPanelLayout?.SingleItemOffers ?? [];
  const bundles = shopResp?.shop?.FeaturedBundle?.Bundles ?? [];
  const accessories = shopResp?.shop?.AccessoryStore?.AccessoryStoreOffers ?? [];

  let msg = `**${targetUser.username}'s Valorant Shop:**\n`;
  if (offers.length) {
    msg += `\n**Skins (${offers.length}):**\n${offers.map((o,i) => `${i+1}. ${o}`).join("\n")}`;
  }
  if (bundles.length) msg += `\n**Bundles:** ${bundles.length}`;
  if (accessories.length) msg += `\n**Accessories:** ${accessories.length}`;
  if (!offers.length && !bundles.length && !accessories.length) msg += "\nNo offers found.";

  // --- Post shop in Discord ---
  await channel.send(msg).catch(console.error);

  // --- Cleanup ---
  await sleep(2000);
  await client.destroy().catch(() => {});
  console.log("✅ Shop posted and client destroyed. Exiting.");
  process.exit(0);

})();
