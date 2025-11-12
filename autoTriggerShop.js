// autoTriggerShop.js
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// wait for SkinPeek.js to initialize
async function runSkinPeekAndWait() {
  return new Promise((resolve, reject) => {
    const skinPeekPath = path.join(__dirname, "SkinPeek.js");
    const child = spawn("node", [skinPeekPath], { cwd: __dirname, env: { ...process.env } });

    let skinsLoaded = false;

    child.stdout.on("data", data => {
      const text = data.toString().trim();
      console.log(`[SkinPeek] ${text}`);

      if (text.includes("Skins loaded!")) {
        skinsLoaded = true;
        resolve();
      }
    });

    child.stderr.on("data", data => {
      console.error(`[SkinPeek ERR] ${data.toString()}`);
    });

    child.on("close", code => {
      if (!skinsLoaded) reject(new Error("SkinPeek exited before 'Skins loaded!'"));
    });
  });
}

(async () => {
  console.log("Launching SkinPeek.js...");
  await runSkinPeekAndWait();

  const client = global.client;
  if (!client) {
    console.error("SkinPeek did not export global.client!");
    process.exit(1);
  }

  await new Promise(res => client.once("ready", res));
  console.log(`✅ Logged in as ${client.user.tag}`);

  // --- Select channel ---
  const guild = client.guilds.cache.first();
  const channelId = process.env.TARGET_CHANNEL_ID || null;
  let channel;
  if (channelId) channel = await guild.channels.fetch(channelId);
  if (!channel) channel = guild.channels.cache.find(ch => ch.isTextBased?.() && ch.viewable);
  if (!channel) throw new Error("No accessible text channel found");

  // notify in channel
  await channel.send("📦 Posting shop...");

  // --- Select target user ---
  const targetUserId = process.env.TARGET_USER_ID || null;
  let targetUser = targetUserId ? await client.users.fetch(targetUserId) : client.user;

  // --- Create fake interaction ---
  const fakeInteraction = {
    isCommand: () => true,
    commandName: "shop",
    user: targetUser,
    guild,
    channel,
    options: { getUser: () => null },
    reply: async (payload) => {
      const content = typeof payload === "string" ? payload : payload.content ?? "";
      const embeds = payload.embeds ?? [];
      return channel.send({ content, embeds });
    },
    deferReply: async () => {},
    followUp: async (payload) => {
      const content = typeof payload === "string" ? payload : payload.content ?? "";
      const embeds = payload.embeds ?? [];
      return channel.send({ content, embeds });
    },
  };

  // --- Trigger shop ---
  client.emit("interactionCreate", fakeInteraction);

  // wait a few seconds for message to send
  await new Promise(res => setTimeout(res, 5000));

  await client.destroy();
  process.exit(0);
})();
