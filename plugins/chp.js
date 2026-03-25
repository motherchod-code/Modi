import { Module } from "../lib/plugins.js";

Module({
  command: "cpost",
  aliases: ["cp"],
  fromMe: true,
  description: "Smart Channel Post (Text/Image/Audio with fallback)",
})(async (message, match) => {
  try {
    if (!match) {
      return message.send(
        "❌ Usage:\n" +
        ".cpost link text\n" +
        ".cpost link |img_url| caption\n" +
        ".cpost link |audio_url|"
      );
    }

    await message.react("⌛");

    let [link, ...rest] = match.trim().split(" ");
    let input = rest.join(" ");

    // 🔗 Validate link
    if (!link.includes("whatsapp.com/channel/")) {
      await message.react("❌");
      return message.send("❌ Invalid channel link");
    }

    // 🔍 Extract ID
    const matchLink = link.match(/channel\/([\w\d]+)/);
    if (!matchLink) {
      await message.react("❌");
      return message.send("❌ Link format ভুল");
    }

    const channelId = matchLink[1];

    // 🔑 Get metadata (REAL JID)
    const meta = await message.client.newsletterMetadata("invite", channelId);

    if (!meta?.id) {
      await message.react("❌");
      return message.send("❌ Channel metadata পাওয়া যায়নি");
    }

    const jid = meta.id;

    console.log("CHANNEL JID:", jid);

    // 🎯 Prepare message
    let msg = {};

    if (input.includes("|")) {
      const parts = input.split("|").map(x => x.trim());

      // 📸 IMAGE
      if (parts[1]?.match(/\.(jpg|jpeg|png|webp)/i)) {
        msg = {
          image: { url: parts[1] },
          caption: parts[2] || ""
        };
      }

      // 🎵 AUDIO
      else if (parts[1]?.match(/\.(mp3|wav|m4a)/i)) {
        msg = {
          audio: { url: parts[1] },
          mimetype: "audio/mpeg"
        };
      } else {
        return message.send("❌ Unsupported media format");
      }
    } else {
      // 📝 TEXT
      msg = { text: input };
    }

    // 🚀 TRY 1: newsletterSendMessage
    try {
      await message.client.newsletterSendMessage(jid, msg);
      await message.react("✅");
      return message.send("✅ Sent via newsletterSendMessage");
    } catch (e) {
      console.log("Primary failed, trying fallback...");
    }

    // 🔁 TRY 2: sendMessage fallback
    try {
      await message.client.sendMessage(jid, msg);
      await message.react("✅");
      return message.send("✅ Sent via fallback sendMessage");
    } catch (err) {
      console.error("[FINAL ERROR]", err);
      await message.react("❌");
      return message.send("⚠️ Failed! Admin/permission/check version");
    }

  } catch (err) {
    console.error("[PLUGIN ERROR]", err);
    await message.react("❌");
    message.send("⚠️ Unexpected error");
  }
});
