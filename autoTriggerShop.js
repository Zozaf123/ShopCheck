import { Client, GatewayIntentBits } from "discord.js";
import config from "./config.json" with { type: "json" };

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const token = process.env.DISCORD_TOKEN || config.token;

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    // Fetch all guilds the bot is in (force API request)
    const guilds = await client.guilds.fetch();

    const firstGuildId = guilds.firstKey();
    if (!firstGuildId) throw new Error("Bot is not in any guilds.");

    const guild = await client.guilds.fetch(firstGuildId);
    console.log(`✅ Connected to guild: ${guild.name} (${guild.id})`);

    // Pick first accessible text channel
    const channel = guild.channels.cache.find(
      (ch) => ch.isTextBased() && ch.viewable
    );

    if (!channel) throw new Error("No accessible text channels found.");

    await channel.send("🛒 Auto /shop check triggered!");

  } catch (err) {
    console.error("❌ Error during auto trigger:", err);
  } finally {
    setTimeout(() => {
      console.log("⏹️ Shutting down...");
      client.destroy();
      process.exit(0);
    }, 5000);
  }
});

client.login(token);
