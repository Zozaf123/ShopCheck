import { spawn } from "child_process";
import { getUser, getShop } from "./valorant/shop.js"; // your existing shop functions
import fetch from "node-fetch";

const DISCORD_TOKEN = "MTI2NDAyMzg3NjUwNjIyMjYwMg.GGH6Yt.DdfADpo7pmHbVjVjMJBv3WO8RZMzMhLk-b3ftY"; // token for the bot running SkinPeek
const CHANNEL_ID = "1264023343577694372"; // where to post the shop
const USER_ID = "1248529349443846154"; // user whose shop to fetch

// Spawn SkinPeek.js
const skinpeekProcess = spawn("node", ["SkinPeek.js"]);

skinpeekProcess.stdout.on("data", async (data) => {
    const msg = data.toString();
    console.log("[SkinPeek]", msg);

    // Wait for the skins to finish loading
    if (msg.includes("Skins loaded!")) {
        console.log("SkinPeek is ready, fetching shop...");

        try {
            // Get user info & shop
            const user = getUser(USER_ID);
            const shopResp = await getShop(USER_ID);

            if (!shopResp.success) {
                console.error("Failed to fetch shop:", shopResp);
                return;
            }

            // Build a simple message
            const items = shopResp.shop.SkinsPanelLayout.SingleItemOffers
                .map(id => id) // could map to skin names if you want
                .join(", ");

            const messagePayload = {
                content: `Posting shop for <@${USER_ID}>:\n${items}`
            };

            // Send to Discord via REST API
            const res = await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`, {
                method: "POST",
                headers: {
                    Authorization: `Bot ${DISCORD_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(messagePayload),
            });

            if (!res.ok) {
                console.error("Failed to send message:", await res.text());
            } else {
                console.log("Shop posted successfully!");
            }

        } catch (err) {
            console.error("Error fetching or posting shop:", err);
        } finally {
            // Stop SkinPeek process
            skinpeekProcess.kill();
        }
    }
});

skinpeekProcess.stderr.on("data", (data) => {
    console.error("[SkinPeek ERR]", data.toString());
});

skinpeekProcess.on("close", (code) => {
    console.log(`SkinPeek process exited with code ${code}`);
});
