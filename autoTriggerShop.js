// autoTriggerShop.js
// Auto-run the /shop command for a target user and post the result, then exit.
// Safe: Put your bot token into DISCORD_TOKEN env (GitHub secret). Do not hardcode tokens.

import { Client, GatewayIntentBits } from "discord.js";

// NOTE: Use 'with { type: "json" }' to import JSON in ESM
let config = {};
try {
  // If your project uses "type": "module", Node supports this syntax
  // (older Node may need `assert { type: "json" }` or require()).
  config = (await import("./misc/config.json" /* with { type: "json" } */)).default ?? {};
} catch (e) {
  // ignore if config not present
  config = {};
}

// utility helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tryImport = async (p) => {
  try {
    return await import(p);
  } catch (e) {
    return null;
  }
};

(async () => {
  // --- Token selection (env preferred) ---
  const token = process.env.DISCORD_TOKEN || config.token;
  if (!token) {
    console.error("No Discord token found. Set DISCORD_TOKEN env (recommended) or add token to misc/config.json (not recommended).");
    process.exit(1);
  }

  // --- Candidate paths to find the shop handler or shop-fetching functions ---
  const fetchCandidates = [
    "./valorant/shop.js",
    "./getShop.js",
    "./src/commands/shop.js",
  ];

  let fetchShopFunc = null;
  let moduleWithClient = null;
  for (const p of fetchCandidates) {
    const mod = await tryImport(p);
    if (!mod) continue;
    // look for common names
    fetchShopFunc = fetchShopFunc || (mod.fetchShop ?? mod.handleShop ?? mod.default?.fetchShop ?? mod.default?.handleShop ?? null);
    // also capture module in case it exports client
    if (!moduleWithClient) moduleWithClient = mod;
  }

  // Also try to import a module that directly exports getShop/getOffers (shop logic you pasted earlier)
  const shopModCandidates = ["./shopModule.js", "./shop.js", "./getShop.js", "./misc/shop.js", "./modules/shop.js", "./src/shop.js"];
  let getShopFunc = null;
  for (const p of shopModCandidates) {
    const m = await tryImport(p);
    if (!m) continue;
    getShopFunc = getShopFunc || (m.getShop ?? m.default?.getShop ?? null);
    if (getShopFunc) break;
  }

  // Try to import auth.getUser so we can locate valorantUser object if needed
  const authMod = await tryImport("./auth.js");
  const getUser = authMod?.getUser ?? null;

  // --- Prepare or reuse a Discord client ---
  // If the imported main module exported a client, use it. Otherwise create our own client.
  let client = moduleWithClient?.client ?? moduleWithClient?.default?.client ?? null;
  let usedExternalClient = !!client;

  if (!client) {
    client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
    try {
      await client.login(token);
    } catch (e) {
      console.error("Failed to login with provided token:", e);
      process.exit(1);
    }
  } else {
    // If we are using an external client exported from SkinPeek.js, ensure it's logged in.
    if (!client.readyAt) {
      try {
        await new Promise((res) => client.once("ready", res));
      } catch (e) {
        console.error("External client failed to become ready:", e);
        process.exit(1);
      }
    }
  }

  if (!client.readyAt) {
    await new Promise((res) => client.once("ready", res));
  }
  console.log("✅ Logged in as", client.user.tag);

  // --- Ensure we have guild info: fetch guilds from API (works in CI) ---
  let guild;
  try {
    const guildsMap = await client.guilds.fetch();
    const firstGuildId = guildsMap.firstKey();
    if (!firstGuildId) throw new Error("Bot is not in any guilds.");
    guild = await client.guilds.fetch(firstGuildId);
    console.log(`Using guild: ${guild.name} (${guild.id})`);
  } catch (err) {
    console.error("Error fetching guilds (bot likely not in any guilds for this token):", err);
    await client.destroy().catch(() => {});
    process.exit(1);
  }

  // --- Choose channel to post in ---
  // Priority: env TARGET_CHANNEL_ID -> config.logToChannel -> first viewable text channel
  const chosenChannelId = process.env.TARGET_CHANNEL_ID || config.logToChannel || null;
  let channel = null;
  try {
    if (chosenChannelId) {
      try { channel = await guild.channels.fetch(chosenChannelId); } catch (e) { channel = null; }
    }
    if (!channel) {
      // ensure the guild channels are fetched
      try { await guild.channels.fetch(); } catch (e) { /* ignore */ }
      channel = guild.channels.cache.find((ch) => ch.isTextBased?.() && ch.viewable) ?? null;
    }
    if (!channel) throw new Error("No accessible text channel found in the guild.");
    console.log(`Using channel: ${channel.name ?? channel.id}`);
  } catch (err) {
    console.error("Error selecting channel:", err);
    await client.destroy().catch(() => {});
    process.exit(1);
  }

  // --- Determine target user (the user whose shop we fetch / mention) ---
  const targetUserId = process.env.TARGET_USER_ID || config.ownerId || null;
  let targetUser = null;
  try {
    if (targetUserId) {
      try { targetUser = await client.users.fetch(targetUserId); } catch (e) { targetUser = null; }
    }
    if (!targetUser) {
      // fallback: pick a member from the guild (first non-bot member if possible)
      try {
        const members = await guild.members.fetch({ limit: 10 });
        const firstHuman = members.find(m => !m.user.bot);
        targetUser = firstHuman?.user ?? members.first()?.user ?? (await client.users.fetch(client.user.id));
      } catch (e) {
        targetUser = await client.users.fetch(client.user.id);
      }
    }
  } catch (err) {
    console.warn("Could not determine a target user; defaulting to bot user:", err);
    targetUser = await client.users.fetch(client.user.id);
  }

  // --- Build a fake interaction object compatible with your /shop handler ---
  const fakeInteraction = {
    isCommand: () => true,
    isAutocomplete: () => false,
    commandName: "shop",
    user: targetUser,
    guild,
    channel,
    options: {
      // your handler calls `interaction.options.getUser("user")` — return null to simulate no @user argument
      getUser: (name) => null,
    },
    locale: "en-US",
    reply: async (payload) => {
      const content = typeof payload === "string" ? payload : payload.content ?? "";
      const embeds = payload.embeds ?? [];
      // If ephemeral, can't send to channel — just send to channel anyway because automation is visible
      await channel.send({ content, embeds }).catch((e) => console.error("Failed to send reply payload:", e));
      // return an object resembling a Message for followUp usage
      return {};
    },
    deferReply: async () => { return; },
    editReply: async (payload) => {
      const content = typeof payload === "string" ? payload : payload.content ?? "";
      const embeds = payload.embeds ?? [];
      await channel.send({ content, embeds }).catch((e) => console.error("Failed to send editReply payload:", e));
    },
    followUp: async (payload) => {
      const content = typeof payload === "string" ? payload : payload.content ?? "";
      const embeds = payload.embeds ?? [];
      await channel.send({ content, embeds }).catch((e) => console.error("Failed to send followUp payload:", e));
    },
    respond: async (choices) => { /* no-op for autocomplete */ },
  };

  // Helper to mention the user in the message
  const mention = (u) => `<@${u.id}>`;

  // --- Now the actual triggering logic (tries multiple strategies) ---

  let triggered = false;

  // Strategy A: call an imported fetchShop/handleShop directly if available
  if (fetchShopFunc) {
    try {
      console.log("Calling imported fetchShop/handleShop directly...");
      // Your handler (in interactionCreate) calls: fetchShop(interaction, valorantUser, targetUserId)
      // Try to obtain valorantUser via auth.getUser if available
      let valorantUser = null;
      if (getUser) {
        try { valorantUser = getUser(targetUser.id); } catch (e) { valorantUser = null; }
      }
      // call with three args (best match), fallback to single arg
      try {
        await fetchShopFunc(fakeInteraction, valorantUser, targetUser.id);
      } catch (e) {
        await fetchShopFunc(fakeInteraction);
      }
      triggered = true;
      console.log("fetchShop invoked.");
    } catch (err) {
      console.warn("Imported fetchShop invocation failed:", err);
    }
  }

  // Strategy B: if there's a getShop function available, call it and post a simple formatted message
  if (!triggered && getShopFunc) {
    try {
      console.log("Calling getShop() directly and posting summary...");
      const shopResp = await getShopFunc(targetUser.id);
      if (!shopResp || !shopResp.success) {
        await channel.send(`${mention(targetUser)} — Failed to fetch shop (getShop returned no success).`);
      } else {
        // Basic summary: list offers (first up to 8)
        const offers = shopResp.shop?.SkinsPanelLayout?.SingleItemOffers ?? [];
        const accessory = shopResp.shop?.AccessoryStore?.AccessoryStoreOffers ?? [];
        const bundleCount = (shopResp.shop?.FeaturedBundle?.Bundles ?? []).length ?? 0;
        let msg = `${mention(targetUser)} — Shop fetched: ${offers.length} offers, ${bundleCount} bundles.`;
        if (offers.length) {
          const shown = offers.slice(0, 8).map((o, i) => `\n${i+1}. ${o}`).join("");
          msg += `\nOffers (first ${Math.min(8, offers.length)}):${shown}`;
        }
        if (accessory.length) msg += `\nAccessories: ${accessory.length}`;
        await channel.send(msg);
      }
      triggered = true;
    } catch (err) {
      console.warn("getShop invocation failed:", err);
    }
  }

  // Strategy C: emit interactionCreate on the current client (works if your main bot's handler is registered on this client)
  if (!triggered) {
    try {
      console.log("Emitting 'interactionCreate' on the client (fallback)...");
      client.emit("interactionCreate", fakeInteraction);
      triggered = true;
    } catch (err) {
      console.warn("Emitting interactionCreate failed:", err);
    }
  }

  // If still not triggered, give a clear instruction for a one-line change to SkinPeek.js
  if (!triggered) {
    console.error("\n⚠️ Automation couldn't trigger your /shop handler automatically.");
    console.error("If SkinPeek.js creates a Discord client internally, please add this single line at the bottom of SkinPeek.js:");
    console.error("\n  // export the bot client so automation can reuse it\n  export { client };\n");
    console.error("Or, export your shop function (one of these):\n  export async function fetchShop(interaction, valorantUser, targetUserId) { ... }\n");
  }

  // Allow a short grace period for messages to go out and followups to run
  await sleep(8000);

  try { await client.destroy(); } catch (e) {}
  console.log("Done — exiting.");
  process.exit(0);
})();
