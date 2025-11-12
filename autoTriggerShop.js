// autoTriggerShop.js
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Wait for SkinPeek.js to fully initialize
async function runSkinPeekAndWait() {
  return new Promise((resolve, reject) => {
    console.log("Launching SkinPeek.js...");

    // Use absolute path to ensure correct resolution
    const skinPeekPath = path.join(__dirname, "SkinPeek.js");

    // Spawn the child process
    const child = spawn("node", [skinPeekPath], {
      cwd: __dirname,      // ensures relative imports in SkinPeek.js work
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env } // inherit environment
    });

    let skinsLoaded = false;

    child.stdout.on("data", data => {
      const text = data.toString().trim();
      console.log(`[SkinPeek] ${text}`);

      if (text.includes("Skins loaded!")) {
        skinsLoaded = true;
        console.log("✅ Detected 'Skins loaded!' — continuing...");
        resolve();
      }
    });

    child.stderr.on("data", data => {
      console.error(`[SkinPeek ERR] ${data.toString()}`);
    });

    child.on("error", err => {
      console.error("❌ Failed to spawn SkinPeek:", err);
      reject(err);
    });

    child.on("close", code => {
      console.log(`[SkinPeek] exited with code ${code}`);
      if (!skinsLoaded) {
        reject(new Error("SkinPeek exited before 'Skins loaded!'"));
      }
    });
  });
}

// Main trigger function
async function triggerShop() {
  try {
    await runSkinPeekAndWait();
    const { getUser } = await import("./valorant/auth.js");
    const { getShop } = await import("./valorant/shop.js");

    // SkinPeek should have set global.client
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

    const channelId = "1264023343577694372"; // channel to post shop
    const userId = "1248529349443846154";    // user to ping

    const channel = await guild.channels.fetch(channelId);
    const user = await client.users.fetch(userId);

    const valorantUser = getUser(userId);

    // Fetch the shop message
    const message = await getShop(null, valorantUser, userId);

    // Post in the channel and ping the user
    await channel.send({
      content: `<@${user.id}>`,
      embeds: message.embeds,
    });

    console.log("✅ Shop posted. Exiting.");

    client.destroy();
    process.exit(0);

  } catch (err) {
    console.error("Error in triggerShop:", err);
    process.exit(1);
  }
}

// Run the shop trigger
triggerShop();
