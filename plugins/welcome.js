import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";
import { WELCOME_TEXTS, GOODBYE_TEXTS, pickRandom } from "./bin/text.js";
import axios from "axios";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

const DEFAULT_GOODBYE = pickRandom(GOODBYE_TEXTS);
const DEFAULT_WELCOME = pickRandom(WELCOME_TEXTS);

/* ---------------- helpers ---------------- */
function toBool(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === "string")
    return ["true", "1", "yes", "on"].includes(v.toLowerCase());
  return Boolean(v);
}

function buildText(template = "", replacements = {}) {
  let text = template || "";
  const wantsPp = text.includes("&pp");
  text = text.replace(/&pp/g, "").trim();
  text = text.replace(/&mention/g, replacements.mentionText || "");
  text = text.replace(/&name/g, replacements.name || "");
  text = text.replace(/&size/g, String(replacements.size ?? ""));
  return { text, wantsPp };
}

async function fetchProfileBuffer(conn, jid) {
  try {
    const getUrl =
      typeof conn.profilePictureUrl === "function"
        ? () => conn.profilePictureUrl(jid, "image").catch(() => null)
        : () => Promise.resolve(null);
    const url = await getUrl();
    if (!url) return null;
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 20000,
    });
    return Buffer.from(res.data);
  } catch (e) {
    console.error(
      "[welcome-goodbye] fetchProfileBuffer error:",
      e?.message || e
    );
    return null;
  }
}

async function sendWelcomeMsg(
  conn,
  groupJid,
  text,
  mentions = [],
  imgBuffer = null
) {
  try {
    if (imgBuffer) {
      await conn.sendMessage(groupJid, {
        image: imgBuffer,
        caption: text,
        mentions,
      });
    } else {
      await conn.sendMessage(groupJid, { text, mentions });
    }
  } catch (err) {
    console.error(
      "[welcome-goodbye] sendWelcomeMsg primary error:",
      err?.message || err
    );
    // fallback without mentions
    try {
      if (imgBuffer)
        await conn.sendMessage(groupJid, { image: imgBuffer, caption: text });
      else await conn.sendMessage(groupJid, { text });
    } catch (e) {
      console.error(
        "[welcome-goodbye] sendWelcomeMsg fallback error:",
        e?.message || e
      );
    }
  }
}

/* ---------------- COMMANDS (group-level on/off only) ---------------- */
/*
  Usage (must be sent inside the group):
    .welcome on
    .welcome off
    .goodbye on
    .goodbye off
*/
Module({
  command: "welcome",
  package: "group",
  description:
    "Turn per-group welcome ON or OFF (must be used inside the group).",
})(async (message, match) => {
  // require group context
  const groupJid =
    message.from ||
    message.chat ||
    message.key?.remoteJid ||
    (message.isGroup ? message.isGroup : null);
  if (!groupJid || !groupJid.includes("@g.us")) {
    return await message.send?.(
      "❌ Use this command inside the group to toggle welcome messages."
    );
  }

  // only on/off supported. ignore custom message
  const raw = (match || "").trim().toLowerCase();
  if (!raw) {
    // read current
    const botNumber =
      (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) ||
      "bot";
    const key = `group:${groupJid}:welcome`;
    const cfg = await db.getAsync(botNumber, key, null);
    const status = cfg && typeof cfg === "object" ? toBool(cfg.status) : false;
    return await message.sendreply?.(
      `Welcome is ${status ? "✅ ON" : "❌ OFF"} for this group.`
    );
  }

  if (raw !== "on" && raw !== "off") {
    return await message.send?.("❌ Invalid option. Use `on` or `off`.");
  }

  const botNumber =
    (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) ||
    "bot";
  const key = `group:${groupJid}:welcome`;
  const cfg = { status: raw === "on" };
  await db.set(botNumber, key, cfg);
  await message.react?.("✅");
  return await message.send(
    cfg.status
      ? "✅ Welcome ENABLED for this group"
      : "❌ Welcome DISABLED for this group"
  );
});

Module({
  command: "goodbye",
  package: "group",
  description:
    "Turn per-group goodbye ON or OFF (must be used inside the group).",
})(async (message, match) => {
  const groupJid =
    message.from ||
    message.chat ||
    message.key?.remoteJid ||
    (message.isGroup ? message.isGroup : null);
  if (!groupJid || !groupJid.includes("@g.us")) {
    return await message.send?.(
      "❌ Use this command inside the group to toggle goodbye messages."
    );
  }

  const raw = (match || "").trim().toLowerCase();
  if (!raw) {
    const botNumber =
      (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) ||
      "bot";
    const key = `group:${groupJid}:goodbye`;
    const cfg = await db.getAsync(botNumber, key, null);
    const status = cfg && typeof cfg === "object" ? toBool(cfg.status) : false;
    return await message.sendreply?.(
      `Goodbye is ${status ? "✅ ON" : "❌ OFF"} for this group.`
    );
  }

  if (raw !== "on" && raw !== "off") {
    return await message.send?.("❌ Invalid option. Use `on` or `off`.");
  }

  const botNumber =
    (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) ||
    "bot";
  const key = `group:${groupJid}:goodbye`;
  const cfg = { status: raw === "on" };
  await db.set(botNumber, key, cfg);
  await message.react?.("✅");
  return await message.send(
    cfg.status
      ? "✅ Goodbye ENABLED for this group"
      : "❌ Goodbye DISABLED for this group"
  );
});
