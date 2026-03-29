import axios from "axios";
import { Module } from "../lib/plugins.js";

Module({
  command: "boobs",
  desc: "Get random anime image (direct API)",
  type: "fun"
}, async (message, match) => {

  try {
    // 🌐 Replace with your direct image API
    const apiUrl = "https://api.dorratz.com/nsfw/tetas";

    // 📥 Fetch image as buffer (no JSON, no URL)
    const { data } = await axios({
      url: apiUrl,
      method: "GET",
      responseType: "arraybuffer"
    });

    const buffer = Buffer.from(data);

    // 📸 Send image directly
    await message.send({
      image: buffer,
      caption: "✨ Random Anime Image"
    });

  } catch (error) {
    console.error(error);
    await message.reply("❌ Failed to fetch image!");
  }

});
