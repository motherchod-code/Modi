import axios from "axios";
import yts from "yt-search";
import { Module } from "../lib/plugins.js";

// 🧠 cooldown system (anti spam)
const cooldown = new Map();

Module({
  command: "chsong",
  package: "youtube",
  description: "Send song to WhatsApp Channel",
})(async (message, match) => {
  try {
    const user = message.sender;

    // ⛔ cooldown (5 sec)
    if (cooldown.has(user)) {
      return message.send("⏳ Wait 5 sec before next request");
    }
    cooldown.set(user, true);
    setTimeout(() => cooldown.delete(user), 5000);

    if (!match) {
      return message.send(
        "❌ Usage:\n.csong song name channelJid\n\nExample:\n.csong faded 120363404737630340@newsletter"
      );
    }

    // 🧠 parse input
    const args = match.trim().split(" ");
    const channelJid = args.pop(); // last word
    const query = args.join(" ");

    // ❌ validation
    if (!channelJid || !channelJid.endsWith("@newsletter")) {
      return message.send("❌ Invalid channel JID");
    }

    if (!query) {
      return message.send("❌ Enter song name");
    }

    await message.react("🔍");

    // 🔍 YouTube search
    const res = await yts(query);

    if (!res?.videos?.length) {
      return message.send("❌ Song not found");
    }

    const video = res.videos[0];

    // 📸 SEND PREVIEW → CHANNEL
    await message.client.newsletterSendMessage(channelJid, {
      image: { url: video.thumbnail },
      caption: `
🎵 *Now Playing*

📌 ${video.title}
👤 ${video.author.name}
⏱️ ${video.timestamp}

Pᴏᴡᴇʀᴇᴅ Bʏ Rᴀʙʙɪᴛ Xᴍᴅ
      `.trim(),
    });

    // 🌐 API call
    const apiUrl =
      "https://api-aswin-sparky.koyeb.app/api/downloader/song?search=" +
      encodeURIComponent(video.url);

    let data;
    try {
      const resApi = await axios.get(apiUrl, { timeout: 20000 });
      data = resApi.data;
    } catch (e) {
      return message.send("⚠️ API timeout, try again");
    }

    if (!data?.status || !data?.data?.url) {
      return message.send("❌ Audio download failed");
    }

    // 🎧 SEND AUDIO → CHANNEL
    await message.client.newsletterSendMessage(channelJid, {
      audio: { url: data.data.url },
      mimetype: "audio/mpeg",
      fileName: `${(data.data.title || video.title).slice(0, 60)}.mp3`,
    });

    await message.react("📡"); // confirm to user

  } catch (err) {
    console.error("[CSONG ERROR]", err);
    await message.send("⚠️ Failed to send song");
  }
});
