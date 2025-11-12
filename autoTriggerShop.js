// autoTriggerShop.js
import './SkinPeek.js'; // <-- run your main bot file exactly as normal
import { Client } from 'discord.js';

async function triggerShop() {
  // Wait for the bot to be ready
  const client = global.client; // assuming skinpeek.js exposes the client globally
  if (!client) {
    console.error("Client not found from SkinPeek.js!");
    process.exit(1);
  }

  await new Promise(resolve => client.once('ready', resolve));

  const guild = client.guilds.cache.first();
  if (!guild) return console.error("Bot is not in any guilds.");

  const channelId = "1264023343577694372"; // channel to post shop
  const userId = "1248529349443846154";   // user to ping

  const channel = await guild.channels.fetch(channelId);
  const user = await client.users.fetch(userId);

  // Use the shop command logic directly
  const { fetchShop } = await import('./discordShopModules.js'); // replace with actual path
  const valorantUser = getUser(userId); // this should now work because SkinPeek initialized everything

  const message = await fetchShop(null, valorantUser, userId); // null because we don’t have a real interaction
  await channel.send({ content: `<@${user.id}>`, embeds: message.embeds });

  console.log("Shop posted. Exiting.");
  client.destroy();
  process.exit(0);
}

triggerShop();
