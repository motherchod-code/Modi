import { Module } from "../lib/plugins.js";
import axios from "axios";

Module({
  command: "cpost",
  aliases: ["cp"],
  fromMe: true,
  description: "Channel post (reply + url + text সব support)",
})(async (message, match) => {
  try {
    if (!match) {
      return message.send("❌ Usage: .cpost link [text/reply/url]");
    }

    await message.react("⌛");

    let [link, ...rest] = match.trim().split(" ");
    let input = rest.join(" ");

    // 🔗 Validate link
    if (!link.includes("whatsapp.com/channel/")) {
      await message.react("❌");
      return message.send("❌ Invalid channel link");
    }

    // 🔍 Extract channel ID
    const matchLink = link.match(/channel\/([\w\d]+)/);
    if (!matchLink) {
      await message.react("❌");
      return message.send("❌ Link format ভুল");
    }

    const channelId = matchLink[1];

    // 🔑 Get real JID
    const meta = await message.client.newsletterMetadata("invite", channelId);
    const jid = meta.id;

    let msg = null;

    // =========================
    // 🔥 REPLY MODE (FIXED)
    // =========================
    if (message.reply_message) {
      const m = message.reply_message;

      // 📸 IMAGE
      if (m.image || m.mimetype?.startsWith("image")) {
        const buffer = await m.download();

        msg = {
          image: buffer,
          caption: input || ""
        };
      }

      // 🎵 AUDIO
      else if (m.audio || m.mimetype?.startsWith("audio")) {
        const buffer = await m.download();

        msg = {
          audio: buffer,
          mimetype: m.mimetype || "audio/mpeg"
        };
      }

      // 📝 TEXT REPLY
      else if (m.text) {
        msg = {
          text: input || m.text
        };
      }
    }

    // =========================
    // 🌐 URL MODE
    // =========================
    else if (input.includes("|")) {
      const parts = input.split("|").map(x => x.trim());

      // 📸 IMAGE URL
      if (parts[1]?.match(/\.(jpg|jpeg|png|webp)/i)) {
        const img = (await axios.get(parts[1], {
          responseType: "arraybuffer"
        })).data;

        msg = {
          image: img,
          caption: parts[2] || ""
        };
      }

      // 🎵 AUDIO URL
      else if (parts[1]?.match(/\.(mp3|wav|m4a)/i)) {
        const audio = (await axios.get(parts[1], {
          responseType: "arraybuffer"
        })).data;

        msg = {
          audio: audio,
          mimetype: "audio/mpeg"
        };
      }
    }

    // =========================
    // 📝 TEXT MODE
    // =========================
    if (!msg) {
      msg = { text: input };
    }

    // =========================
    // 🚀 SEND (DOUBLE SAFE)
    // =========================
    try {
      await message.client.newsletterSendMessage(jid, msg);
    } catch (e) {
      // fallback
      await message.client.sendMessage(jid, msg);
    }

    await message.react("✅");
    return message.send("✅ Channel post done!");

  } catch (err) {
    console.error("[FINAL ERROR]", err);
    await message.react("❌");
    message.send("⚠️ Failed! Check admin / version");
  }
});
