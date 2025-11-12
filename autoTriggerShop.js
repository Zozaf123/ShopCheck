import './SkinPeek.js';  // start SkinPeek
import { client } from './discord/bot.js';
import { getShop } from './valorant/shop.js';

const waitForSkinPeek = () => new Promise(resolve => {
    const check = setInterval(() => {
        if (client.readyAt) {
            console.log("SkinPeek finished loading!");
            clearInterval(check);
            resolve();
        }
    }, 1000);
});

(async () => {
    await waitForSkinPeek();

    // now run your shop logic
    const shop = await getShop(process.env.TARGET_USER_ID);
    console.log(shop);
})();
