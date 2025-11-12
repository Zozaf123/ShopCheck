// autoTriggerShop.js
// Auto-run the /shop command as if a user triggered it, then exit.
//
// SECURITY: Do NOT hardcode your bot token here. Put it in DISCORD_TOKEN (env / GitHub Secret).

import fs from "fs";
import path from "path";
import { Client, GatewayIntentBits } from "discord.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tryImport = async (p) => {
  try {
    return await import(p);
  } catch (e) {
    return null;
  }
};

(async () => {
  // -------------------------
  // 1) Load config (optional)
  // -------------------------
  let config = {};
  try {
    const cfgPath = path.resolve("./misc/config.json");
    if (fs.existsSync(cfgPath)) config = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  } catch (e) {
    console.warn("Could not read misc/config.json:", e?.message ?? e);
  }

  // -------------------------
  // 2) Acquire token
  // -------------------------
  const token = process.env.DISCORD_TOKEN || config.token;
  if (!token) {
    console.error("No Discord token found. Set DISCORD_TOKEN (env / secret) or place token in misc/config.json for local testing.");
    process.exit(1);
  }

  // Optional env overrides
  const TARGET_USER_ID = process.env.TARGET_USER_ID || config.ownerId || null;
  const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID || config.logToChannel || null;

  // -------------------------
  // 3) Try to import existing bot modules
  // -------------------------
  // Prefer importing SkinPeek.js so we use the same handlers/client if it exports them.
  let skinPeekMod = await tryImport("./SkinPeek.js");
  // Also try to find fetchShop / getShop in common locations
  const candidateFetchPaths = [
    "./SkinPeek.js",
    "./commands/shop.js",
    "./commands/shop/index.js",
    "./misc/util.js",
    "./shop.js",
    "./getShop.js",
    "./misc/shop.js"
  ];

  let fetchShopFunc = null;
  let getShopFunc = null;
  for (const p of candidateFetchPaths) {
    const m = await tryImport(p);
    if (!m) continue;
    // then look for common export names
    fetchShopFunc = fetchShopFunc || (m.fetchShop ?? m.handleShop ?? m.default?.fetchShop ?? null);
    getShopFunc = getShopFunc || (m.getShop ?? m.default?.getShop ?? null);
    if (fetchShopFunc && getShopFunc) break;
  }

  // try import auth.getUser
  const authMod = await tryImport("./auth.js");
  const getUser = authMod?.getUser ?? null;

  // -------------------------
  // 4) Decide which Discord client to use
  // -------------------------
  // If SkinPeek.js exported a client, use it. Otherwise, create our own.
  let client = skinPeekMod?.client ?? skinPeekMod?.default?.client ?? null;
  let usingExternalClient = !!client;

  if (!client) {
    client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    });

    try {
      await client.login(token);
    } catch (e) {
      console.error("Failed to login with provided token:", e);
      process.exit(1);
    }
  } else {
    // If client exists exported by SkinPeek, ensure it's ready
    if (!client.readyAt) {
      await new Promise((res) => client.once("ready", res));
    }
  }

  // Wait until ready
  if (!client.readyAt) {
    await new Promise((res) => client.once("ready", res));
  }
  console.log("✅ Logged in as", client.user.tag);

  // -------------------------
  // 5) Find a guild (first one)
  // -------------------------
  let guild;
  try {
    // fetch() returns a Collection of partial guilds; firstKey yields an ID
    const guilds = await client.guilds.fetch();
    const firstGuildId = guilds.firstKey();
    if (!firstGuildId) throw new Error("Bot is not in any guilds (guilds.fetch() returned no guilds).");
    guild = await client.guilds.fetch(firstGuildId);
    console.log(`Using guild: ${guild.name} (${guild.id})`);
  } catch (err) {
    console.error("Error fetching guilds (bot likely not in any guilds for this token):", err?.message ?? err);
    // If the client is an exported SkinPeek client that registers handlers, it's possible the bot expects shared state.
    // We can't proceed without a guild; clean up and exit.
    try { await client.destroy(); } catch {}
    process.exit(1);
  }

  // -------------------------
  // 6) Choose a channel
  // -------------------------
  let channel = null;
  try {
    if (TARGET_CHANNEL_ID) {
      try { channel = await guild.channels.fetch(TARGET_CHANNEL_ID); } catch (e) { channel = null; }
    }
    if (!channel) {
      // ensure channels cached/fetched
      try { await guild.channels.fetch(); } catch (e) {}
      channel = guild.channels.cache.find((c) => c.isTextBased?.() && c.viewable) ?? null;
    }
    if (!channel) throw new Error("No accessible text channel found in the guild.");
    console.log(`Using channel: ${channel.name ?? channel.id}`);
  } catch (err) {
    console.error("Error selecting channel:", err?.message ?? err);
    try { await client.destroy(); } catch {}
    process.exit(1);
  }

  // -------------------------
  // 7) Choose a target user (who we will "shop" for / ping)
  // -------------------------
  let targetUser = null;
  try {
    if (TARGET_USER_ID) {
      try { targetUser = await client.users.fetch(TARGET_USER_ID); } catch (e) { targetUser = null; }
    }
    if (!targetUser) {
      // pick a non-bot guild member if possible
      try {
        const members = await guild.members.fetch({ limit: 20 });
        const human = members.find(m => !m.user.bot);
        targetUser = human?.user ?? members.first()?.user ?? (await client.users.fetch(client.user.id));
      } catch (e) {
        targetUser = await client.users.fetch(client.user.id);
      }
    }
    console.log(`Target user: ${targetUser.tag} (${targetUser.id})`);
  } catch (err) {
    console.warn("Could not determine target user; defaulting to bot user:", err?.message ?? err);
    targetUser = await client.users.fetch(client.user.id);
  }

  // -------------------------
  // 8) Build a fake Interaction object
  // -------------------------
  // This object attempts to match the methods/shape your code uses:
  // - interaction.isCommand(), .commandName
  // - interaction.options.getUser("user")
  // - interaction.deferReply(), interaction.reply(), interaction.followUp(), interaction.editReply()
  let replied = false;
  const fakeInteraction = {
    isCommand: () => true,
    isAutocomplete: () => false,
    commandName: "shop",
    user: targetUser,
    guild,
    channel,
    options: {
      getUser: (name) => null, // simulate /shop with no @user argument
    },
    locale: "en-US",
    deferReply: async (opts) => {
      // Some code may await deferReply(); we just note and return.
      // Return a placeholder similar to Discord's behavior (no followUp function here)
      return;
    },
    reply: async (payload) => {
      // Accept string or object with content / embeds
      const content = typeof payload === "string" ? payload : payload?.content ?? "";
      const embeds = payload?.embeds ?? [];
      // Send to the selected channel so the message is visible in-server
      try {
        await channel.send({ content: content || undefined, embeds: embeds.length ? embeds : undefined });
      } catch (e) {
        console.error("Failed to send reply to channel:", e);
      }
      replied = true;
      // Return a mock message-like object
      return {};
    },
    followUp: async (payload) => {
      const content = typeof payload === "string" ? payload : payload?.content ?? "";
      const embeds = payload?.embeds ?? [];
      try {
        await channel.send({ content: content || undefined, embeds: embeds.length ? embeds : undefined });
      } catch (e) {
        console.error("Failed to send followUp to channel:", e);
      }
      return {};
    },
    editReply: async (payload) => {
      // For automation we treat editReply like sending a new message
      const content = typeof payload === "string" ? payload : payload?.content ?? "";
      const embeds = payload?.embeds ?? [];
      try {
        await channel.send({ content: content || undefined, embeds: embeds.length ? embeds : undefined });
      } catch (e) {
        console.error("Failed to send editReply to channel:", e);
      }
      return {};
    },
    respond: async () => { /* noop for autocomplete */ },
  };

  // For convenience: mention helper
  const mention = (u) => `<@${u.id}>`;

  // -------------------------
  // 9) Trigger the shop logic
  //    Strategy order:
  //      1) call fetchShopFunc(fakeInteraction, valorantUser, targetUser.id) if found
  //      2) call getShopFunc and post summary
  //      3) emit 'interactionCreate' on client (works if SkinPeek exported same client and registered handlers)
  // -------------------------
  let triggered = false;

  // A: direct fetchShop function (preferred)
  if (fetchShopFunc) {
    try {
      console.log("Calling detected fetchShop/handleShop directly...");
      let valorantUser = null;
      try {
        if (getUser) valorantUser = getUser(targetUser.id);
      } catch (e) { valorantUser = null; }
      try {
        // try 3-arg call then fallback to single-arg call
        await fetchShopFunc(fakeInteraction, valorantUser, targetUser.id);
      } catch (e) {
        await fetchShopFunc(fakeInteraction);
      }
      triggered = true;
      console.log("fetchShop/handleShop called.");
    } catch (err) {
      console.warn("Direct fetchShop call failed:", err?.message ?? err);
    }
  }

  // B: direct getShop (lower-level) -> format & send a simple summary
  if (!triggered && getShopFunc) {
    try {
      console.log("Calling detected getShop() and summarizing result...");
      const resp = await getShopFunc(targetUser.id);
      if (!resp || !resp.success) {
        await channel.send(`${mention(targetUser)} — failed to fetch shop.`);
      } else {
        // try to extract offers/bundles to make a short summary
        const offers = resp.shop?.SkinsPanelLayout?.SingleItemOffers ?? resp.offers ?? [];
        const bundleCount = (resp.shop?.FeaturedBundle?.Bundles ?? []).length ?? 0;
        let message = `${mention(targetUser)} — Shop fetched: ${offers.length} offers, ${bundleCount} bundles.`;
        // if offers appear to be uuids, don't spam them; just say counts
        await channel.send(message);
      }
      triggered = true;
    } catch (err) {
      console.warn("getShop invocation failed:", err?.message ?? err);
    }
  }

  // C: emit an interactionCreate on the client (fallback)
  if (!triggered) {
    try {
      console.log("Emitting 'interactionCreate' on the client (fallback)...");
      client.emit("interactionCreate", fakeInteraction);
      triggered = true;
    } catch (err) {
      console.warn("Emitting interactionCreate failed:", err?.message ?? err);
    }
  }

  // If still not triggered, instruct user to export client or fetchShop from SkinPeek.js
  if (!triggered) {
    console.error("\n⚠️ Could not trigger your /shop handler automatically.");
    console.error("If your SkinPeek.js creates a client internally, add at its bottom:");
    console.error("  export { client };");
    console.error("Or export your shop handler:");
    console.error("  export async function fetchShop(interaction, valorantUser, targetUserId) { ... }\n");
  }

  // Give a reasonable grace period for async operations (fetching shop, followUps, images)
  await sleep(12000);

  // Clean shutdown
  try { await client.destroy(); } catch (e) {}
  console.log("Done — exiting.");
  process.exit(0);
})();
