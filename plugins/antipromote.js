// plugins/anti-pd-split.js

import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";

// 🧠 DB init
db.data = db.data || {};
db.data.antipromote = db.data.antipromote || {};
db.data.antidemote = db.data.antidemote || {};
db.data.pdmode = db.data.pdmode || {}; // demote / kick


// ─────────────────────────────
// 🔐 SET MODE (DEMOTE / KICK)
// ─────────────────────────────
Module({
  command: "pdmode",
  desc: "Set punishment mode",
  category: "group",
})(async (message, match) => {
  if (!message.isGroup)
    return message.reply("❌ Group only");

  if (!message.isAdmin && !message.isfromMe)
    return message.reply("❌ Only admins");

  if (!message.isBotAdmin)
    return message.reply("❌ Bot must be admin");

  const input = match?.trim()?.toLowerCase();

  if (!input)
    return message.reply("⚙️ Usage:\n.pdmode demote / kick");

  if (!["demote", "kick"].includes(input))
    return message.reply("❌ Use demote / kick");

  db.data.pdmode[message.jid] = input;

  return message.reply(`✅ Punishment set to *${input.toUpperCase()}*`);
});


// ─────────────────────────────
// 🔐 ANTIPROMOTE
// ─────────────────────────────
Module({
  command: "antipromote",
})(async (message, match) => {
  if (!message.isGroup)
    return message.reply("❌ Group only");

  if (!message.isAdmin && !message.isfromMe)
    return message.reply("❌ Only admins");

  if (!message.isBotAdmin)
    return message.reply("❌ Bot must be admin");

  const input = match?.trim()?.toLowerCase();

  if (!input)
    return message.reply(".antipromote on/off");

  db.data.antipromote[message.jid] = input === "on";
  return message.reply(`✅ Anti Promote ${input.toUpperCase()}`);
});


// ─────────────────────────────
// 🔐 ANTIDEMOTE
// ─────────────────────────────
Module({
  command: "antidemote",
})(async (message, match) => {
  if (!message.isGroup)
    return message.reply("❌ Group only");

  if (!message.isAdmin && !message.isfromMe)
    return message.reply("❌ Only admins");

  if (!message.isBotAdmin)
    return message.reply("❌ Bot must be admin");

  const input = match?.trim()?.toLowerCase();

  if (!input)
    return message.reply(".antidemote on/off");

  db.data.antidemote[message.jid] = input === "on";
  return message.reply(`✅ Anti Demote ${input.toUpperCase()}`);
});


// ─────────────────────────────
// 🔥 MAIN EVENT
// ─────────────────────────────
export async function onGroupUpdate(update, client) {
  try {
    const { id, participants, action, author } = update;

    if (!id || !participants || !action || !author) return;
    if (author === client.user.id) return;
    if (!Array.isArray(participants)) return;

    const mode = db.data.pdmode[id] || "demote";

    const punish = async () => {
      if (mode === "kick") {
        await client.groupParticipantsUpdate(id, [author], "remove");
      } else {
        await client.groupParticipantsUpdate(id, [author], "demote");
      }
    };

    const users = participants.map(u => "@" + u.split("@")[0]).join(", ");

    // ─────────────
    // 🚫 ANTI PROMOTE
    // ─────────────
    if (action === "promote" && db.data.antipromote[id]) {

      await Promise.all(
        participants.map(u =>
          client.groupParticipantsUpdate(id, [u], "demote")
        )
      );

      try { await punish(); } catch {}

      await client.sendMessage(id, {
        text:
          "🚫 *Anti Promote Active*\n\n" +
          `👤 @${author.split("@")[0]} tried to promote:\n` +
          `➡️ ${users}\n\n` +
          `📛 Punishment: ${mode.toUpperCase()}`,
        mentions: [author, ...participants]
      });
    }

    // ─────────────
    // 🚫 ANTI DEMOTE
    // ─────────────
    if (action === "demote" && db.data.antidemote[id]) {

      await Promise.all(
        participants.map(u =>
          client.groupParticipantsUpdate(id, [u], "promote")
        )
      );

      try { await punish(); } catch {}

      await client.sendMessage(id, {
        text:
          "🚫 *Anti Demote Active*\n\n" +
          `👤 @${author.split("@")[0]} tried to demote:\n` +
          `➡️ ${users}\n\n` +
          `📛 Punishment: ${mode.toUpperCase()}`,
        mentions: [author, ...participants]
      });
    }

  } catch (e) {
    console.log("AntiPD Error:", e);
  }
}
