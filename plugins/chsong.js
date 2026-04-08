// plugins/chsong.js

import axios from "axios";
import yts from "yt-search";
import { Module } from "../lib/plugins.js";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import os from "os";

Module({
  command: "chsong",
  fromMe: true,
  description: "Download song and send to WhatsApp channel as voice note",
})(async (message, match) => {
  try {
    if (!match) {
      return message.send("❌ Usage:\n.chsong <song name> <channel_link>");
    }

    await message.react("🔍");

    // 🔹 split args
    const args = match.trim().split(" ");
    const link = args.pop(); // last part = channel link
    const query = args.join(" ");

    if (!query || !link) {
      return message.send("❌ Invalid format");
    }

    // 🔹 Extract channel ID
    const id = link.match(/channel\/([\w\d]+)/)?.[1];
    if (!id) return message.send("❌ Invalid channel link");

    const meta = await message.client.newsletterMetadata("invite", id);
    const jid = meta.id;

    // 🔎 YouTube search
    const res = await yts(query);
    if (!res.videos || res.videos.length === 0) {
      return message.send("❌ Song not found");
    }

    const video = res.videos[0];

    await message.react("⬇️");

    // 🌐 API call
    const api =
      "https://api-aswin-sparky.koyeb.app/api/downloader/song?search=" +
      encodeURIComponent(video.url);

    const { data } = await axios.get(api, { timeout: 30000 });

    if (!data || !data.data?.url) {
      return message.send("❌ Download failed");
    }

    // 📥 Download audio
    const audioRes = await axios.get(data.data.url, {
      responseType: "arraybuffer",
    });

    const buffer = Buffer.from(audioRes.data);

    // 📁 temp path
    const tmp = (ext) =>
      path.join(os.tmpdir(), `chsong-${Date.now()}.${ext}`);

    const input = tmp("mp3");
    const output = tmp("ogg");

    fs.writeFileSync(input, buffer);

    await message.react("🎙️");

    // 🎙️ Convert → OGG (voice)
    await new Promise((resolve, reject) => {
      ffmpeg(input)
        .audioCodec("libopus")
        .audioBitrate("48k")
        .format("ogg")
        .on("end", resolve)
        .on("error", reject)
        .save(output);
    });

    const voice = fs.readFileSync(output);

    // 🧹 cleanup
    fs.unlinkSync(input);
    fs.unlinkSync(output);

    await message.react("📤");

    // 🚀 SEND TO CHANNEL
    await message.client.newsletterSendMessage(jid, {
      audio: voice,
      mimetype: "audio/ogg; codecs=opus",
      ptt: true,
      contextInfo: {
        externalAdReply: {
          title: video.title,
          body: "Rabbit Xmd Mini",
          mediaType: 2,
          thumbnailUrl: video.thumbnail,
          sourceUrl: video.url,
        },
      },
    });

    // ✅ ONLY ONE SUCCESS MESSAGE
    await message.react("✅");

    return message.send({
      text: `
╭━━━〔 ✅ Upload Done 〕━━━⬣
┃ 🎵 ${video.title}
┃ ⏱️ ${video.timestamp}
┃ 📡 ${meta.name || "Channel"}
╰━━━━━━━━━━━━━━━━━━⬣
`.trim(),
    });

  } catch (err) {
    console.error("[CHSONG ERROR]", err);
    await message.react("❌");
    return message.send("⚠️ Failed to send song");
  }
});
