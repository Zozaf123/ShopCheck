// autoTriggerShop.js
// Safe: does NOT contain any tokens. Use DISCORD_TOKEN env or misc/config.json locally.

import { Client, GatewayIntentBits } from "discord.js";

async function tryImport(path) {
  try {
    return await import(path);
  } catch (e) {
    return null;
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  // 1) Token selection: prefer env var (recommended), fallback to misc/config.json if present
  let token = process.env.DISCORD_TOKEN;
  let configModule = await tryImport("./misc/config.json" /* with runtime; see note */).catch(() => null);
  if (!token && configModule && configModule.default && configModule.default.token) {
    token = configModule.default.token;
  }

  if (!token) {
    console.error("No token found. Set DISCORD_TOKEN as an environment variable or add token to misc/config.json.");
    process.exit(1);
  }

  // 2) Try to import your main bot file in case it exports client or handlers
  const skinPeekMod = await tryImport("./SkinPeek.js").catch(() => null);
  // Also try a few likely places for a fetchShop handler
  const candidateFetchPaths = [
    "./commands/shop.js",
    "./commands/shop/index.js",
    "./shop.js",
    "./misc/util.js",
    "./misc/fetchShop.js"
  ];

  let fetchShopFunc = null;
  for (const p of candidateFetchPaths) {
    const mod = await tryImport(p);
    if (mod) {
      // look for named exports fetchShop, handleShop, or default
      fetchShopFunc = mod.fetchShop ?? mod.handleShop ?? mod.default ?? fetchShopFunc;
      if (fetchShopFunc) break;
    }
  }

  // If skinPeekMod exports fetchShop, prefer that
  if (skinPeekMod) fetchShopFunc = skinPeekMod.fetchShop ?? fetchShopFunc;

  // Try to import getUser (auth) so we can call fetchShop exactly like your bot
  const authMod = await tryImport("./auth.js").catch(() => null);
  const getUser = authMod?.getUser ?? null;

  // 3) Decide on client:
  // If SkinPeek exported a client object (common pattern), use it.
  let client = skinPeekMod?.client ?? skinPeekMod?.default?.client ?? null;
  let usedExternalClient = false;

  if (client) {
    console.log("Using client exported by SkinPeek.js (no separate login).");
    usedExternalClient = true;
  } else {
    // create our own client and login
    client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
    try {
      await client.login(token);
    } catch (e) {
      console.error("Failed to login with provided token:", e);
      process.exit(1);
    }
  }

  // Wait until ready (if client is new we logged it in; if external, it may already be logged in)
  if (!client.readyAt) {
    await new Promise((res) => client.once("ready", res));
  }
  console.log(`Logged in as ${client.user.tag}`);

  // 4) Ensure we have guild info — fetch from API (works on cloud)
  try {
    const guilds = await client.guilds.fetch(); // gets map of guild partials
    const firstGuildId = guilds.firstKey();
    if (!firstGuildId) throw new Error("Bot is not in any guilds.");
    const guild = await client.guilds.fetch(firstGuildId);
    console.log(`Using guild: ${guild.name} (${guild.id})`);

    // pick a channel — prefer a channel ID in config or the first viewable text channel
    // If you want a specific channel ID, replace this with your own constant
    let channel = guild.channels.cache.find(ch => ch.isTextBased && ch.viewable);
    if (!channel) {
      // try fetching channel list from API
      const chans = await guild.channels.fetch();
      channel = chans.find(ch => ch.isTextBased && ch.viewable);
    }
    if (!channel) throw new Error("No accessible text channel found in the guild.");

    // 5) Prepare fake interaction to mirror your command handler expectations.
    //    We set options.getUser to return null (i.e. /shop with no @user),
    //    and user is a real user object from the client so .id and .tag exist.
    const targetUserId = process.env.TARGET_USER_ID || null; // optionally set via env
    let targetUser = null;
    if (targetUserId) {
      try { targetUser = await client.users.fetch(targetUserId); } catch (e) { console.warn("Could not fetch target user id:", e); }
    }
    // default to a user in the guild (first member) if none set
    if (!targetUser) {
      // attempt to find a guild member and fetch their user object
      try {
        const members = await guild.members.fetch({ limit: 5 });
        const firstMember = members.first();
        targetUser = firstMember?.user ?? (await client.users.fetch(client.user.id));
      } catch {
        targetUser = await client.users.fetch(client.user.id);
      }
    }

    const fakeInteraction = {
      isCommand: () => true,
      isAutocomplete: () => false,
      commandName: "shop",
      user: targetUser,
      guild,
      channel,
      // Options shape: options.getUser("user") used in your handler
      options: {
        getUser: (name) => { return null; } // no other user argument (simulate /shop)
      },
      locale: "en-US",
      reply: async (payload) => {
        const content = typeof payload === "string" ? payload : payload.content ?? "(no content)";
        const embeds = payload.embeds ?? [];
        await channel.send({ content, embeds });
      },
      followUp: async (payload) => {
        const content = typeof payload === "string" ? payload : payload.content ?? "(no content)";
        const embeds = payload.embeds ?? [];
        await channel.send({ content, embeds });
      },
      deferReply: async () => { /* no-op for automation */ },
      editReply: async (payload) => {
        const content = typeof payload === "string" ? payload : payload.content ?? "(no content)";
        await channel.send({ content, embeds: payload.embeds ?? [] });
      },
      respond: async (choices) => { /* used for autocomplete; no-op */ },
    };

    console.log("Prepared fake interaction for /shop (user:", targetUser.id, ")");

    // 6) TWO possible ways to trigger your existing code:
    //   A) If we found a fetchShop function (imported from likely locations), call it directly.
    //   B) Otherwise, emit 'interactionCreate' on the client (works if SkinPeek's handler was registered on this client).

    if (fetchShopFunc) {
      console.log("Calling fetched fetchShop() function directly (preferred).");
      // If fetchShop expects (interaction, valorantUser, targetUserId) we try to call with that signature.
      // Try to get valorantUser via your auth.getUser if available.
      let valorantUser = null;
      if (getUser) valorantUser = getUser(targetUser.id);
      try {
        // best-effort: call with either two or three args depending on function arity
        await fetchShopFunc(fakeInteraction, valorantUser, targetUser.id);
      } catch (e) {
        // second attempt: call with single arg (interaction) in case signature differs
        try {
          await fetchShopFunc(fakeInteraction);
        } catch (err) {
          console.error("fetchShop call failed:", err);
        }
      }
    } else {
      console.log("No fetchShop() found — emitting a fake 'interactionCreate' event on the client.");
      // This relies on the interactionCreate listener being registered on this client.
      // If you imported SkinPeek.js and it registered its own client (not exported here),
      // emitting on this client will not trigger it. See fallback message below.
      client.emit("interactionCreate", fakeInteraction);
    }

    // Give things a little time to post messages and run follow-ups
    await sleep(7000);

    console.log("Done — cleaning up.");
  } catch (err) {
    console.error("Error during auto trigger:", err);
    if (err?.message === "Bot is not in any guilds.") {
      console.error("Double-check that the bot token belongs to the bot that's invited to the guild.");
    }
  } finally {
    try { await client.destroy(); } catch {}
    process.exit(0);
  }
})();
