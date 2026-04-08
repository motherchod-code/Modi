// plugins/play.js
import axios from "axios";
import yts from "yt-search";
import { Module } from "../lib/plugins.js";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import os from "os";

Module({
  command: "vplay",
  package: "youtube",
  description: "Play song as WhatsApp voice note",
})(async (message, match) => {
  try {
    if (!match) {
      return message.send("❌ Enter song name\n\n.play love nwantiti");
    }

    await message.react("🔍");

    // 🔎 YouTube search
    const res = await yts(match);
    if (!res.videos || res.videos.length === 0) {
      return message.send("❌ Song not found");
    }

    const video = res.videos[0];

    // 🖼️ Now Playing message (NO convert word)
    const caption = `
🎵 *Now Playing*

Pᴏᴡᴇʀᴇᴅ Bʏ Rᴀʙʙɪᴛ Xᴍᴅ Mɪɴɪ

📌 *Title:* ${video.title}
👤 *Channel:* ${video.author.name}
⏱️ *Duration:* ${video.timestamp}

🎧 *Preparing your audio...*
`.trim();

    await message.send({
      image: { url: video.thumbnail },
      caption,
      mimetype: "image/jpeg",
    });

    // 🌐 API call
    const apiUrl =
      "https://api-aswin-sparky.koyeb.app/api/downloader/song?search=" +
      encodeURIComponent(video.url);

    const { data } = await axios.get(apiUrl, { timeout: 30000 });

    if (!data || !data.status || !data.data?.url) {
      return message.send("❌ Audio download failed");
    }

    // 📥 Download audio buffer
    const audioRes = await axios.get(data.data.url, {
      responseType: "arraybuffer",
    });

    const buffer = Buffer.from(audioRes.data);

    // 📁 temp file
    const tmp = (ext) =>
      path.join(os.tmpdir(), `play-${Date.now()}.${ext}`);

    const input = tmp("mp3");
    const output = tmp("ogg");

    fs.writeFileSync(input, buffer);

    // 🎙️ Convert → voice note (internal, no message shown)
    await new Promise((resolve, reject) => {
      ffmpeg(input)
        .audioCodec("libopus")
        .audioBitrate("48k")
        .noVideo()
        .format("ogg")
        .on("error", reject)
        .on("end", resolve)
        .save(output);
    });

    const voice = fs.readFileSync(output);

    // 🧹 cleanup
    fs.unlinkSync(input);
    fs.unlinkSync(output);

    // 📤 Send voice note
    await message.send({
      audio: voice,
      mimetype: "audio/ogg; codecs=opus",
      ptt: true,
      contextInfo: {
        externalAdReply: {
          title: video.title,
          body: "Powered By Rabbit Xmd Mini",
          mediaType: 2,
          thumbnailUrl: video.thumbnail,
          sourceUrl: video.url,
        },
      },
    });

    await message.react("🎧");

  } catch (err) {
    console.error("[PLAY ERROR]", err);
    await message.send("⚠️ Play failed");
  }
});
