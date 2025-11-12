// autoTriggerShop.js
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Utility sleep
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Spawn SkinPeek.js and wait until bot is ready
async function runSkinPeekAndWait() {
  return new Promise((resolve, reject) => {
    console.log("Launching SkinPeek.js...");

    const skinPeekPath = path.join(__dirname, "SkinPeek.js");
    const child = spawn("node", [skinPeekPath], {
      cwd: __dirname,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    let ready = false;

    child.stdout.on("data", (data) => {
      const text = data.toString().trim();
      console.log(`[SkinPeek] ${text}`);

      if (text.includes("Bot ready!") || text.includes("Skins loaded!")) {
        ready = true;
        console.log("✅ SkinPeek ready!");
        resolve();
      }
    });

    child.stderr.on("data", (data) => {
      console.error(`[SkinPeek ERR] ${data.toString()}`);
    });

    child.on("close", (code) => {
      console.log(`[SkinPeek] exited with code ${code}`);
      if (!ready) reject(new Error("SkinPeek exited before ready"));
    });
  });
}

async function triggerShop() {
  try {
    await runSkinPeekAndWait();

    // Import modules after SkinPeek is ready
    const { getUser } = await import("./valorant/auth.js");
    const { getShop } = await import("./valorant/shop.js");

    const client = global.client;
    if (!client) throw new Error("global.client not found from SkinPeek!");

    const guild = client.guilds.cache.first();
    if (!guild) throw new Error("Bot is not in any guilds");

    // Choose channel
    const channelId = process.env.TARGET_CHANNEL_ID || "1264023343577694372";
    const channel = await guild.channels.fetch(channelId);

    // Choose target user
    const userId = process.env.TARGET_USER_ID || "1248529349443846154";
    const targetUser = await client.users.fetch(userId);

    // Notify channel
    await channel.send(`Posting shop for <@${targetUser.id}>...`);

    // Fetch Valorant user
    const valorantUser = getUser(userId);
    if (!valorantUser) throw new Error("Valorant user not found");

    // Fetch shop
    const shopResp = await getShop(userId, valorantUser);
    if (!shopResp.success) {
      await channel.send(`<@${targetUser.id}> — Failed to fetch shop`);
    } else {
      const offers = shopResp.shop.SkinsPanelLayout.SingleItemOffers;
      const bundles = shopResp.shop.FeaturedBundle.Bundles.map((b) => b.DataAssetID);

      let msg = `Shop for <@${targetUser.id}>:\nOffers:\n`;
      offers.forEach((o, i) => { msg += `${i + 1}. ${o}\n`; });
      if (bundles.length) msg += `Bundles: ${bundles.join(", ")}`;

      await channel.send(msg);
    }

    // Close bot
    await client.destroy();
    process.exit(0);

  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

triggerShop();
