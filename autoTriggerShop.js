// autoTriggerShop.js
import { Client, GatewayIntentBits } from "discord.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const token = process.env.DISCORD_TOKEN; // never hard-code it

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    const guild = client.guilds.cache.first();
    if (!guild) throw new Error("Bot is not in any guilds.");

    const channelId = "1264023343577694372"; // your channel
    const userId = "1248529349443846154";   // target user

    const channel = await guild.channels.fetch(channelId);
    const user = await client.users.fetch(userId);

    // Fake /shop interaction
    const fakeInteraction = {
      isCommand: () => true,
      isAutocomplete: () => false,
      commandName: "shop",
      user,
      guild,
      channel,
      options: { getUser: () => null },
      reply: async payload => {
        const msg = typeof payload === "string" ? payload : payload.content ?? "(no content)";
        await channel.send({ content: msg, embeds: payload.embeds ?? [] });
      },
      followUp: async payload => { await channel.send(payload); },
      deferReply: async () => {},
      editReply: async payload => { await channel.send(payload); },
      respond: async choices => { console.log("Autocomplete:", choices); },
    };

    console.log("📤 Emitting fake /shop interaction…");
    client.emit("interactionCreate", fakeInteraction);

    // Exit after a short delay
    setTimeout(() => {
      console.log("🏁 Finished. Exiting.");
      client.destroy();
      process.exit(0);
    }, 10_000);
  } catch (err) {
    console.error("❌ Error during auto trigger:", err);
    client.destroy();
    process.exit(1);
  }
});

client.login(token);
