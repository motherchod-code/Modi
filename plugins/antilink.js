// plugins/antilink.js
import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";

const DEBUG = false;
const debug = (...args) => DEBUG && console.debug("[antilink]", ...args);

const LINK_REGEX =
  /(?:https?:\/\/[^\s]+)|(?:chat\.whatsapp\.com\/[A-Za-z0-9_-]+)|(?:wa\.me\/[0-9]+)|(?:t\.me\/[A-Za-z0-9_\-]+)|(?:telegram\.me\/[A-Za-z0-9_\-]+)|(?:discord\.gg\/[A-Za-z0-9_\-]+)|(?:bit\.ly\/[A-Za-z0-9_\-]+)|(?:tinyurl\.com\/[A-Za-z0-9_\-]+)|\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|gg|xyz|me|app|online|site|link)\b/gi;

function getBotNum(conn) {
  const id = conn?.user?.id || conn?.user?.jid || conn?.user || null;
  if (!id) return "unknown";
  return String(id).split("@")[0].split(":")[0];
}

function enabledKey(gJid) { return `antilink:${gJid}:enabled`; }
function modeKey(gJid)    { return `antilink:${gJid}:mode`; }
function warnKey(gJid, sJid) { return `antilink:${gJid}:warn:${sJid}`; }
function warnLimitKey(gJid) { return `antilink:${gJid}:warnlimit`; }

// ── Command ──────────────────────────────────────────────────────────────────
Module({
  command: "antilink",
  package: "owner",
  description: "Enable/disable anti-link for this group or set mode (kick/delete/warn/null). .antilink warnlimit <n> to set warn kicks",
})(async (message, match) => {
  try {
    if (!(message.isFromMe || message.isfromMe))
      return message.send("_Only bot owner can use this command._");
    if (!message.isGroup)
      return message.send("❌ This command works only in groups.");
    await message.loadGroupInfo?.();

    const botNumber = getBotNum(message.conn);
    const gJid = message.from;
    const raw  = (match || "").trim().toLowerCase();

    // Show status
    if (!raw) {
      const on    = db.get(botNumber, enabledKey(gJid), false) === true;
      const mode  = String(db.get(botNumber, modeKey(gJid), "kick") || "kick").toLowerCase();
      const limit = db.get(botNumber, warnLimitKey(gJid), 3);
      return message.send(
        `⚙️ *AntiLink Status*\n• Status: ${on ? "✅ ON" : "❌ OFF"}\n• Mode: *${mode.toUpperCase()}*\n• Warn Limit: *${limit}* warnings before kick\n\nUsage:\n• .antilink on/off\n• .antilink kick\n• .antilink delete\n• .antilink warn\n• .antilink null\n• .antilink warnlimit <number>`
      );
    }

    // Warn limit setter
    if (raw.startsWith("warnlimit")) {
      const parts = raw.split(/\s+/);
      const n = parseInt(parts[1] || "3", 10);
      if (isNaN(n) || n < 1) return message.send("❌ Enter a valid number. Example: .antilink warnlimit 3");
      db.setHot(botNumber, warnLimitKey(gJid), n);
      return message.send(`✅ Warn limit set to *${n}*. After ${n} warnings user will be kicked.`);
    }

    if (raw === "on") {
      db.setHot(botNumber, enabledKey(gJid), true);
      if (!db.get(botNumber, modeKey(gJid), null))
        db.setHot(botNumber, modeKey(gJid), "kick");
      const m = db.get(botNumber, modeKey(gJid), "kick");
      return message.send(`✅ AntiLink *ENABLED*. Mode: *${String(m).toUpperCase()}*`);
    }

    if (raw === "off") {
      db.setHot(botNumber, enabledKey(gJid), false);
      return message.send("✅ AntiLink *DISABLED* for this group.");
    }

    const validModes = ["kick", "null", "warn", "delete", "remove"];
    if (validModes.includes(raw)) {
      const normalized = raw === "remove" ? "kick" : raw;
      db.setHot(botNumber, modeKey(gJid), normalized);
      db.setHot(botNumber, enabledKey(gJid), true);
      return message.send(
        `✅ AntiLink mode set to *${normalized.toUpperCase()}* and *ENABLED*.${normalized === "warn" ? `\n⚠️ After ${db.get(botNumber, warnLimitKey(gJid), 3)} warnings, user will be kicked.` : ""}`
      );
    }

    return message.send("❌ Unknown option.\nUsage: .antilink on/off/kick/delete/warn/null\n.antilink warnlimit <number>");
  } catch (err) {
    console.error("[antilink][cmd]", err);
    return message.send("❌ Error: " + err.message);
  }
});

// ── Enforcement ───────────────────────────────────────────────────────────────
Module({
  on: "text",
  package: "group",
  description: "Enforce anti-link policy in groups",
})(async (message) => {
  try {
    if (!message || !message.isGroup) return;
    const body = (message.body || "").toString();
    if (!body) return;

    const botNumber = getBotNum(message.conn);
    const gJid = message.from;

    const enabled = db.get(botNumber, enabledKey(gJid), false) === true;
    if (!enabled) return;

    try { await message.loadGroupInfo?.(); } catch {}

    if (!message.isBotAdmin) return;
    if (message.isAdmin || message.isFromMe || message.isfromMe) return;

    const matches = body.match(LINK_REGEX);
    if (!matches || matches.length === 0) return;
    debug("links detected", matches);

    let mode = "kick";
    try {
      mode = String(db.get(botNumber, modeKey(gJid), "kick") || "kick").toLowerCase();
    } catch {}

    // Delete the offending message
    try {
      await message.conn.sendMessage(message.from, { delete: message.key }).catch(() => {});
    } catch {}

    const senderJid = message.sender || message.key?.participant || message.key?.from || null;
    const senderNum = senderJid ? String(senderJid).split("@")[0] : "unknown";

    if (mode === "delete") {
      await message.send?.(`⚠️ Link removed from @${senderNum}`, { mentions: senderJid ? [senderJid] : [] });
      return;
    }

    if (mode === "null") {
      await message.send?.(`⚠️ @${senderNum}, links are not allowed here.`, { mentions: senderJid ? [senderJid] : [] });
      return;
    }

    if (mode === "warn") {
      const wk = warnKey(gJid, senderJid);
      const limit = db.get(botNumber, warnLimitKey(gJid), 3);
      let count = (db.get(botNumber, wk, 0) || 0) + 1;
      db.setHot(botNumber, wk, count);

      if (count >= limit) {
        // Reset warn count and kick
        db.delHot(botNumber, wk);
        try {
          await message.send?.(
            `🚫 @${senderNum} has been kicked after *${limit} warnings* for posting links.`,
            { mentions: senderJid ? [senderJid] : [] }
          );
          await new Promise(r => setTimeout(r, 500));
          if (typeof message.removeParticipant === "function")
            await message.removeParticipant([senderJid]);
          else
            await message.conn.groupParticipantsUpdate(message.from, [senderJid], "remove");
        } catch (e) {
          await message.send?.(`❌ Couldn't kick @${senderNum}. Please remove manually.`, { mentions: senderJid ? [senderJid] : [] });
        }
      } else {
        await message.send?.(
          `⚠️ @${senderNum}, links are not allowed!\n📛 *Warning ${count}/${limit}* — you will be kicked at ${limit} warnings.`,
          { mentions: senderJid ? [senderJid] : [] }
        );
      }
      return;
    }

    // kick/remove mode
    if (mode === "kick" || mode === "remove") {
      try {
        await message.send?.(
          `🚫 @${senderNum} posted a prohibited link and will be removed.`,
          { mentions: senderJid ? [senderJid] : [] }
        );
        await new Promise(r => setTimeout(r, 600));
        if (typeof message.removeParticipant === "function")
          await message.removeParticipant([senderJid]);
        else
          await message.conn.groupParticipantsUpdate(message.from, [senderJid], "remove");
      } catch (err) {
        console.error("[antilink] remove failed", err);
        await message.send?.(`❌ Failed to remove @${senderNum}. Remove manually.`, { mentions: senderJid ? [senderJid] : [] });
      }
      return;
    }
  } catch (error) {
    console.error("[antilink] enforcement error:", error);
  }
});
