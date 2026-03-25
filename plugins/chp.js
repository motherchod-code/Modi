import { Module } from "../lib/plugins.js";
import axios from "axios";

Module({
  command: "cpost",
  aliases: ["cp"],
  fromMe: true,
  description: "Channel post (text + url + reply media support)",
})(async (message, match) => {
  try {
    if (!match) {
      return message.send("Usage: .cpost <channel_link> <text/url/reply>");
    }

    await message.react("⌛");

    const args = match.trim().split(" ");
    const link = args.shift();
    const input = args.join(" ");

    // Validate link
    if (!link.includes("whatsapp.com/channel/")) {
      await message.react("❌");
      return message.send("Invalid channel link");
    }

    // Extract channel ID
    const matchLink = link.match(/channel\/([\w\d]+)/);
    if (!matchLink) {
      await message.react("❌");
      return message.send("Invalid link format");
    }

    const channelId = matchLink[1];

    // Get real JID
    const meta = await message.client.newsletterMetadata("invite", channelId);
    const jid = meta.id;

    let msg = null;

    // =========================
    // REPLY MODE
    // =========================
    if (message.reply_message) {
      const m = message.reply_message;

      let buffer = null;

      // Try download method 1
      try {
        if (m.message) {
          buffer = await message.client.downloadMediaMessage(m.message);
        }
      } catch {}

      // Fallback 2
      if (!buffer) {
        try {
          buffer = await m.download();
        } catch {}
      }

      // Fallback 3 (URL)
      if (!buffer && m.url) {
        buffer = (await axios.get(m.url, {
          responseType: "arraybuffer"
        })).data;
      }

      // Image
      if (m.image || m.mimetype?.startsWith("image")) {
        if (!buffer) return message.send("Image download failed");

        msg = {
          image: buffer,
          caption: input || ""
        };
      }

      // Audio
      else if (m.audio || m.mimetype?.startsWith("audio")) {
        if (!buffer) return message.send("Audio download failed");

        msg = {
          audio: buffer,
          mimetype: m.mimetype || "audio/mpeg",
          ptt: false
        };
      }

      // Text reply
      else if (m.text) {
        msg = {
          text: input || m.text
        };
      }
    }

    // =========================
    // URL MODE (auto detect)
    // =========================
    if (!msg) {
      const urlMatch = input.match(/https?:\/\/\S+/);

      if (urlMatch) {
        const url = urlMatch[0];
        const caption = input.replace(url, "").trim();

        // Image URL
        if (url.match(/\.(jpg|jpeg|png|webp)/i)) {
          const img = (await axios.get(url, {
            responseType: "arraybuffer"
          })).data;

          msg = {
            image: img,
            caption: caption || ""
          };
        }

        // Audio URL
        else if (url.match(/\.(mp3|wav|m4a)/i)) {
          const audio = (await axios.get(url, {
            responseType: "arraybuffer"
          })).data;

          msg = {
            audio: audio,
            mimetype: "audio/mpeg"
          };
        }
      }
    }

    // =========================
    // TEXT FALLBACK
    // =========================
    if (!msg) {
      msg = { text: input };
    }

    // =========================
    // SEND MESSAGE
    // =========================
    try {
      await message.client.newsletterSendMessage(jid, msg);
    } catch {
      await message.client.sendMessage(jid, msg);
    }

    await message.react("✅");
    return message.send("Channel post sent successfully");

  } catch (err) {
    console.error("[CPOST ERROR]", err);
    await message.react("❌");
    message.send("Failed to send message");
  }
});
