// plugins/welcome-goodbye.js
import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";
import { WELCOME_TEXTS, GOODBYE_TEXTS, pickRandom } from "./bin/text.js";
import axios from "axios";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

const DEFAULT_GOODBYE = pickRandom(GOODBYE_TEXTS);
const DEFAULT_WELCOME = pickRandom(WELCOME_TEXTS);

/* ---------------- HELPERS ---------------- */

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
    const url = await conn.profilePictureUrl(jid, "image").catch(() => null);
    if (!url) return null;

    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 10000,
    });

    return Buffer.from(res.data);
  } catch {
    return null;
  }
}

async function sendMsg(conn, jid, text, mentions = [], img = null) {
  try {
    if (img) {
      await conn.sendMessage(jid, { image: img, caption: text, mentions });
    } else {
      await conn.sendMessage(jid, { text, mentions });
    }
  } catch {
    try {
      if (img) await conn.sendMessage(jid, { image: img, caption: text });
      else await conn.sendMessage(jid, { text });
    } catch {}
  }
}

/* ---------------- OWNER + SUPERADMIN CHECK ---------------- */

async function isOwnerOrSuperAdmin(conn, groupJid, userJid) {
  try {
    const meta = await conn.groupMetadata(groupJid);

    if (meta.owner && meta.owner === userJid) return true;

    const p = meta.participants.find(x => x.id === userJid);
    if (p?.admin === "superadmin") return true;

    return false;
  } catch {
    return false;
  }
}

/* ---------------- COMMANDS ---------------- */

// WELCOME
Module({ command: "welcome", package: "group" })(async (m, match) => {
  const jid = m.chat;
  if (!jid.includes("@g.us")) return m.send("❌ Group only");

  const raw = (match || "").toLowerCase().trim();
  const bot = m.conn.user.id.split(":")[0];
  const key = `group:${jid}:welcome`;

  if (!raw) {
    const cfg = await db.getAsync(bot, key, null);
    return m.sendreply(`Welcome ${cfg?.status ? "✅ ON" : "❌ OFF"}`);
  }

  if (!["on", "off"].includes(raw)) return m.send("❌ Use on/off");

  await db.set(bot, key, { status: raw === "on" });
  return m.send(raw === "on" ? "✅ Welcome ON" : "❌ Welcome OFF");
});

// GOODBYE
Module({ command: "goodbye", package: "group" })(async (m, match) => {
  const jid = m.chat;
  if (!jid.includes("@g.us")) return m.send("❌ Group only");

  const raw = (match || "").toLowerCase().trim();
  const bot = m.conn.user.id.split(":")[0];
  const key = `group:${jid}:goodbye`;

  if (!raw) {
    const cfg = await db.getAsync(bot, key, null);
    return m.sendreply(`Goodbye ${cfg?.status ? "✅ ON" : "❌ OFF"}`);
  }

  if (!["on", "off"].includes(raw)) return m.send("❌ Use on/off");

  await db.set(bot, key, { status: raw === "on" });
  return m.send(raw === "on" ? "✅ Goodbye ON" : "❌ Goodbye OFF");
});

// ADMINMSG (OWNER + SUPERADMIN)
Module({ command: "adminmsg", package: "group" })(async (m, match) => {
  const jid = m.chat;
  if (!jid.includes("@g.us")) return m.send("❌ Group only");

  const sender = m.sender;
  const allowed = await isOwnerOrSuperAdmin(m.conn, jid, sender);

  if (!allowed) return m.send("❌ Only owner/superadmin");

  const raw = (match || "").toLowerCase().trim();
  const bot = m.conn.user.id.split(":")[0];
  const key = `group:${jid}:adminmsg`;

  if (!raw) {
    const cfg = await db.getAsync(bot, key, null);
    return m.sendreply(`AdminMsg ${cfg?.status ? "✅ ON" : "❌ OFF"}`);
  }

  if (!["on", "off"].includes(raw)) return m.send("❌ Use on/off");

  await db.set(bot, key, { status: raw === "on" });
  return m.send(raw === "on" ? "✅ AdminMsg ON" : "❌ AdminMsg OFF");
});

/* ---------------- EVENT ---------------- */

Module({ on: "group-participants.update" })(async (_m, ev, conn) => {
  try {
    if (!ev?.id || !ev?.participants) return;

    const jid = ev.id;
    const bot = conn.user.id.split(":")[0];

    // ⚡ Load once (optimized)
    const wCfg = await db.getAsync(bot, `group:${jid}:welcome`, null);
    const gCfg = await db.getAsync(bot, `group:${jid}:goodbye`, null);
    const aCfg = await db.getAsync(bot, `group:${jid}:adminmsg`, null);

    const welcomeOn = wCfg?.status === true;
    const goodbyeOn = gCfg?.status === true;
    const adminOn = aCfg?.status === true;

    const meta = await conn.groupMetadata(jid);
    const gName = meta.subject;
    const gSize = meta.participants.length;

    const action = ev.action.toLowerCase();
    const isJoin = ["add", "invite", "join"].includes(action);
    const isLeave = ["remove", "leave"].includes(action);

    for (const user of ev.participants) {
      const uid = jidNormalizedUser(user);
      const mention = `@${uid.split("@")[0]}`;

      // WELCOME
      if (isJoin && welcomeOn) {
        const { text, wantsPp } = buildText(DEFAULT_WELCOME, {
          mentionText: mention,
          name: gName,
          size: gSize,
        });

        const img = wantsPp
          ? await fetchProfileBuffer(conn, uid)
          : null;

        await sendMsg(conn, jid, text, [uid], img);
      }

      // GOODBYE
      if (isLeave && goodbyeOn) {
        const { text, wantsPp } = buildText(DEFAULT_GOODBYE, {
          mentionText: mention,
          name: gName,
          size: gSize,
        });

        const img = wantsPp
          ? await fetchProfileBuffer(conn, uid)
          : null;

        await sendMsg(conn, jid, text, [uid], img);
      }

      // 👑 ADMIN EVENTS (STYLISH)
      if (adminOn && (action === "promote" || action === "demote")) {
        const actor = ev.actor || ev.author || ev.by || null;

        const actorText = actor
          ? `@${actor.split("@")[0]}`
          : "Admin";

        const text = `╭─〔 👑 *Admin Update* 〕
├─ 👤 User: ${mention}
├─ ⚡ Action: ${
  action === "promote" ? "Promoted 🟢" : "Demoted 🔴"
}
├─ 🏷 Group: ${gName}
├─ 🛠 By: ${actorText}
╰─➤ Powered by Rabbitxmd`.trim();

        const mentions = [uid];
        if (actor) mentions.push(actor);

        await sendMsg(conn, jid, text, mentions);
      }
    }
  } catch (e) {
    console.error("Event Error:", e);
  }
});
