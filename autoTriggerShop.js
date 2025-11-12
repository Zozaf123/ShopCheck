// autoTriggerShop.js
import { spawn } from "child_process";
import { getUser } from './valorant/auth.js'; // import getUser from auth.js
import { getShop } from './valorant/shop.js'; // replace with actual path

async function runSkinPeekAndWait() {
  return new Promise((resolve, reject) => {
    console.log("Launching SkinPeek.js...");

    // Spawn the process so we can watch its stdout
    const process = spawn("node", ["SkinPeek.js"]);

    process.stdout.on("data", data => {
      const text = data.toString().trim();
      console.log(text);

      // When "Skins loaded!" appears, resolve
      if (text.includes("Skins loaded!")) {
        console.log("Detected 'Skins loaded!' — continuing...");
        resolve();
      }
    });

    process.stderr.on("data", data => {
      console.error("SkinPeek error:", data.toString());
    });

    process.on("close", code => {
      console.log(`SkinPeek.js exited with code ${code}`);
      reject(new Error("SkinPeek exited before skins loaded"));
    });
  });
}

async function triggerShop() {
  // wait 10 seconds for SkinPeek to finish initializing
  await runSkinPeekAndWait();

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
