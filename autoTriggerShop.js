// autoTriggerShop.js
import { Client, GatewayIntentBits } from "discord.js";
import config from ".config.json" assert { type: "json" };

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    // Replace with your own IDs
    const guildId = "1264023343577694369";
    const channelId = "1264023343577694372";
    const userId = "1248529349443846154";

    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);
    const user = await client.users.fetch(userId);

    // Create a minimal fake interaction that looks like a real /shop command
    const fakeInteraction = {
      isCommand: () => true,
      isAutocomplete: () => false,
      commandName: "shop",
      user,
      guild,
      channel,
      options: {
        getUser: () => null, // simulate running /shop with no extra args
      },
      reply: async (payload) => {
        const message =
          typeof payload === "string"
            ? payload
            : payload.content ?? "(no content)";
        await channel.send({
          content: message,
          embeds: payload.embeds ?? [],
        });
      },
      followUp: async (payload) => {
        await channel.send(payload);
      },
      deferReply: async () => {},
      editReply: async (payload) => {
        await channel.send(payload);
      },
      respond: async (choices) => {
        console.log("Autocomplete response:", choices);
      },
    };

    console.log("Emitting fake /shop interaction...");
    client.emit("interactionCreate", fakeInteraction);

    // Exit after a short delay
    setTimeout(() => {
      console.log("Finished. Exiting.");
      client.destroy();
      process.exit(0);
    }, 10000);
  } catch (err) {
    console.error("Error during auto trigger:", err);
    client.destroy();
    process.exit(1);
  }
});

client.login(config.token);
