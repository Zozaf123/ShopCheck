// autoTriggerShop.js
import { Client, GatewayIntentBits } from "discord.js";
import { getShop, getUser } from "./discordShopModules.js"; // replace with your actual import paths

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// IDs
const GUILD_ID = "1264023343577694369";
const CHANNEL_ID = "1264023343577694372";
const TARGET_USER_ID = "1248529349443846154";

async function main() {
  await client.login(process.env.DISCORD_TOKEN);

  client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      const channel = await guild.channels.fetch(CHANNEL_ID);
      const user = await client.users.fetch(TARGET_USER_ID);

      // Fetch shop using your existing code
      const userData = getUser(user.id);
      const shopResp = await getShop(user.id, userData);

      if (!shopResp.success) {
        await channel.send(`<@${user.id}> — failed to fetch shop.`);
      } else {
        const offers = shopResp.shop.SkinsPanelLayout.SingleItemOffers || [];
        const bundles = shopResp.shop.FeaturedBundle.Bundles || [];
        const nightMarket = shopResp.shop.BonusStore?.BonusStoreOffers || [];

        let msg = `📦 <@${user.id}>'s shop:\n`;
        msg += `• ${offers.length} skin offers\n`;
        msg += `• ${bundles.length} bundles\n`;
        msg += `• ${nightMarket.length} Night Market offers`;

        await channel.send(msg);
      }

    } catch (err) {
      console.error("Error fetching or posting shop:", err);
      await channel.send(`<@${TARGET_USER_ID}> — error fetching shop!`);
    }

    console.log("Done. Exiting...");
    client.destroy();
    process.exit(0);
  });
}

main();
