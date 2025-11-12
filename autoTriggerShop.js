import { spawn } from "child_process";
//import { getUser } from "./valorant/auth.js";
//import { getShop } from "./valorant/shop.js";

async function runSkinPeekAndWait() {
  return new Promise((resolve, reject) => {
    console.log("Launching SkinPeek.js...");

    const process = spawn("node", ["SkinPeek.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env }, // inherit env
    });

    let skinsLoaded = false;

    process.stdout.on("data", data => {
      const text = data.toString().trim();
      console.log(`[SkinPeek] ${text}`);

      if (text.includes("Skins loaded!")) {
        skinsLoaded = true;
        console.log("✅ Detected 'Skins loaded!' — continuing...");
        resolve(); // Allow continuation
      }
    });

    process.stderr.on("data", data => {
      console.error(`[SkinPeek ERR] ${data.toString()}`);
    });

    process.on("error", err => {
      console.error("❌ Failed to spawn SkinPeek:", err);
      reject(err);
    });

    process.on("close", code => {
      console.log(`SkinPeek.js exited with code ${code}`);
      if (!skinsLoaded) {
        reject(new Error("SkinPeek exited before skins loaded"));
      }
    });
  });
}

async function triggerShop() {
  await runSkinPeekAndWait();
  return
  // Now SkinPeek has logged "Skins loaded!"
  console.log("Proceeding to shop fetch...");

  const client = global.client;
  if (!client) {
    console.error("Client not found from SkinPeek.js!");
    process.exit(1);
  }

  const guild = client.guilds.cache.first();
  if (!guild) {
    console.error("Bot is not in any guilds.");
    process.exit(1);
  }

  const channelId = "1264023343577694372";
  const userId = "1248529349443846154";

  const channel = await guild.channels.fetch(channelId);
  const user = await client.users.fetch(userId);

  const valorantUser = getUser(userId);
  const message = await getShop(null, valorantUser, userId);

  await channel.send({
    content: `<@${user.id}>`,
    embeds: message.embeds,
  });

  console.log("✅ Shop posted. Exiting.");
  client.destroy();
  process.exit(0);
}

triggerShop().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
