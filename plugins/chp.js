import { Module } from "../lib/plugins.js";

Module({
  command: "cpost",
  aliases: ["cp"],
  fromMe: true,
  description: "Send text/image/audio to WhatsApp Channel",
})(async (message, match) => {
  try {
    if (!match) {
      return message.send(
        "❌ Usage:\n" +
        ".cpost link text\n" +
        ".cpost link |image_url| caption\n" +
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

    // 🔍 Extract channel ID → convert to JID
    const matchLink = link.match(/channel\/([\w\d]+)/);
    if (!matchLink) {
      await message.react("❌");
      return message.send("❌ Link format ভুল");
    }

    const channelId = matchLink[1];

    // 🔄 Convert to JID
    const jid = channelId + "@newsletter";

    // 🎯 Detect media type
    if (input.includes("|")) {
      const parts = input.split("|").map(x => x.trim());

      // 📸 IMAGE
      if (parts[1]?.match(/\.(jpg|jpeg|png|webp)/i)) {
        await message.client.sendMessage(jid, {
          image: { url: parts[1] },
          caption: parts[2] || ""
        });

        await message.react("✅");
        return message.send("📸 Image sent to channel!");
      }

      // 🎵 AUDIO
      if (parts[1]?.match(/\.(mp3|wav|m4a)/i)) {
        await message.client.sendMessage(jid, {
          audio: { url: parts[1] },
          mimetype: "audio/mpeg",
          fileName: "song.mp3"
        });

        await message.react("✅");
        return message.send("🎵 Audio sent to channel!");
      }

      return message.send("❌ Unsupported media format");
    }

    // 📝 TEXT MESSAGE
    await message.client.sendMessage(jid, {
      text: input
    });

    await message.react("✅");

    return message.send("📝 Text sent to channel!");

  } catch (err) {
    console.error("[CHANNEL POST ERROR]", err);
    await message.react("❌");

    message.send("⚠️ Failed! Permission বা link সমস্যা");
  }
});
