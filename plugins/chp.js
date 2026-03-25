import { Module } from "../lib/plugins.js";

Module({
  command: "chp",
  description: "Send message to WhatsApp channel",
})(async (message, match, m, client) => {
  try {
    if (!match) {
      return message.send("❌ Use:\n.chp message 123@newsletter");
    }

    const args = match.split(" ");
    
    if (args.length < 2) {
      return message.send("❌ Format:\n.chp hello 123@newsletter");
    }

    // last word = JID
    const jid = args[args.length - 1];
    
    // rest = message
    const text = args.slice(0, -1).join(" ");

    if (!jid.includes("@newsletter")) {
      return message.send("❌ Invalid Channel JID!");
    }

    await client.sendMessage(jid, {
      text: text,
    });

    return message.send("✅ Message sent to channel!");

  } catch (err) {
    console.log(err);
    return message.send("❌ Failed to send!");
  }
});
