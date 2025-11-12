import { client } from "./discord/bot.js";
import { getUser } from "./valorant/auth.js";
import { getShop } from "./valorant/shop.js";
import { basicEmbed } from "./discord/embed.js";
import config from "./misc/config.js";

const CHANNEL_ID = "1264023343577694372"; // put the channel where you want the shop posted
const TARGET_USER_ID = "1248529349443846154"; // your Discord ID

async function postShop() {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
        console.error("Cannot find text channel or channel is not text-based.");
        return;
    }

    const valorantUser = getUser(TARGET_USER_ID);
    if (!valorantUser) {
        await channel.send({
            embeds: [basicEmbed("You are not registered! Run `/login` first.")]
        });
        return;
    }

    // send "posting shop" message first
    await channel.send("Posting shop...");

    // fetch shop
    const shopResp = await getShop(TARGET_USER_ID);
    if (!shopResp.success) {
        await channel.send({
            embeds: [basicEmbed("Failed to fetch shop. Maybe maintenance?")]
        });
        return;
    }

    // format shop embed
    const embed = {
        title: `${valorantUser.username}'s Daily Shop`,
        description: shopResp.shop.SkinsPanelLayout.SingleItemOffers.map(
            (id, i) => `• Skin ID: ${id}`
        ).join("\n"),
        color: 0x00ff00
    };

    await channel.send({ embeds: [embed] });
    console.log("Shop posted!");
}

// wait until client is ready
client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}, posting shop...`);
    postShop().catch(console.error);
});
