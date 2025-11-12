import { Client, GatewayIntentBits } from "discord.js";
import config from "./config.json" assert { type: "json" };

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const token = process.env.DISCORD_TOKEN || config.token;

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    // Wait until guild cache is populated
    await client.guilds.fetch();
    const guild = client.guilds.cache.first();

    if (!guild) {
      throw new Error("Bot is not in any guilds.");
    }

    console.log(`✅ Connected to guild: ${guild.name} (${guild.id})`);

    const channel = guild.channels.cache.find(
      (ch) => ch.isTextBased() && ch.viewable
    );

    if (!channel) {
      throw new Error("No accessible text channels found.");
    }

    await channel.send("🛒 Auto /shop check triggered!");

    // TODO: trigger your fake interaction or /shop logic here
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
