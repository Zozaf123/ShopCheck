// autoTriggerShop.js
import './SkinPeek.js'; // run your main bot file like normal
import { getUser } from './valorant/auth.js'; // import getUser from auth.js
import { fetchShop } from './discordShopModules.js'; // replace with actual path

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function triggerShop() {
  // wait 10 seconds for SkinPeek to finish initializing
  console.log("Waiting 10 seconds for SkinPeek to finish loading...");
  await wait(10000);

  const client = global.client; // SkinPeek should set global.client
  if (!client) {
    console.error("Client not found from SkinPeek.js!");
    process.exit(1);
  }

  const guild = client.guilds.cache.first();
  if (!guild) {
    console.error("Bot is not in any guilds.");
    process.exit(1);
  }

  const channelId = "1264023343577694372"; // channel to post shop
  const userId = "1248529349443846154";   // user to ping

  const channel = await guild.channels.fetch(channelId);
  const user = await client.users.fetch(userId);

  const valorantUser = getUser(userId); // should work after SkinPeek initialized

  // run the shop command logic
  const message = await fetchShop(null, valorantUser, userId);

  // post in the channel and ping the user
  await channel.send({
    content: `<@${user.id}>`,
    embeds: message.embeds,
  });

  console.log("Shop posted. Exiting.");

  client.destroy();
  process.exit(0);
}

triggerShop();
