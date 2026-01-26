import { Client, GatewayIntentBits } from "discord.js";

console.log("🚀 Starting Discord bot process...");

/* ---------------------------------- */
/* GLOBAL ERROR TRAPS                 */
/* ---------------------------------- */

process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

/* ---------------------------------- */
/* ENV CHECK                          */
/* ---------------------------------- */

if (!process.env.TOKEN) {
  console.error("❌ TOKEN is missing from environment variables");
  process.exit(1);
}

console.log("🔑 TOKEN detected (length:", process.env.TOKEN.length, ")");

/* ---------------------------------- */
/* CLIENT                             */
/* ---------------------------------- */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/* ---------------------------------- */
/* EVENTS                             */
/* ---------------------------------- */

client.once("ready", () => {
  console.log("✅ BOT ONLINE");
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log(`📡 Connected to ${client.guilds.cache.size} guild(s)`);
});

client.on("error", (err) => {
  console.error("❌ Client error:", err);
});

client.on("shardError", (err) => {
  console.error("❌ Shard error:", err);
});

/* ---------------------------------- */
/* LOGIN                              */
/* ---------------------------------- */

console.log("🔐 Attempting Discord login...");

client
  .login(process.env.TOKEN)
  .then(() => {
    console.log("📨 Login promise resolved");
  })
  .catch((err) => {
    console.error("❌ Login failed:", err);
    process.exit(1);
  });
