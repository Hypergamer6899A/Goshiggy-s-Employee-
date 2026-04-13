// ─── index.js ──────────────────────────────────────────────────────────────
import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
} from "discord.js";
import { initFirebase } from "./firebase.js";
import { initYouTube } from "./services/youtube.js";
import { initCounting } from "./services/counting.js";
import { initWelcome } from "./services/welcome.js";
import { initPresence } from "./services/presence.js";
import { initStreamCommand } from "./services/stream.js";
import { initWeb } from "./web.js";

// ─── SECTION 1: Process Guards ─────────────────────────────────────────────
console.log("Starting bot...");

process.on("unhandledRejection", (reason) => console.error("Unhandled Rejection:", reason));
process.on("uncaughtException", (err) => console.error("Uncaught Exception:", err));

if (!process.env.TOKEN) {
  console.error("TOKEN env var is missing.");
  process.exit(1);
}

// ─── SECTION 2: Discord Client ─────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,   // PRIVILEGED — enable in Dev Portal
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // PRIVILEGED — enable in Dev Portal
  ],
});

// ─── SECTION 3: Firebase ───────────────────────────────────────────────────
let db;
try {
  ({ db } = initFirebase(process.env));
  console.log("Firebase initialized");
} catch (err) {
  console.error("Firebase init failed:", err);
  process.exit(1);
}

// ─── SECTION 4: Counting Service ───────────────────────────────────────────
let counting;
try {
  counting = initCounting({ client, db, env: process.env });
  console.log("Counting service initialized");
} catch (err) {
  console.error("Counting init failed:", err);
  process.exit(1);
}

// ─── SECTION 5: Welcome Service ────────────────────────────────────────────
let welcome;
try {
  welcome = initWelcome({ client, env: process.env });
  console.log("Welcome service initialized");
} catch (err) {
  console.error("Welcome init failed:", err);
  process.exit(1);
}

// ─── SECTION 6: Presence Service ───────────────────────────────────────────
let presence;
try {
  presence = initPresence(client);
  console.log("Presence service initialized");
} catch (err) {
  console.error("Presence init failed:", err);
  process.exit(1);
}

// ─── SECTION 7: YouTube Service ────────────────────────────────────────────
let checkForNewVideo;
try {
  ({ checkForNewVideo } = initYouTube({ client, db, env: process.env }));
  console.log("YouTube service initialized");
} catch (err) {
  console.error("YouTube init failed:", err);
  process.exit(1);
}

// ─── SECTION 8: Stream Command ─────────────────────────────────────────────
try {
  initStreamCommand({ client, env: process.env });
  console.log("Stream command initialized");
} catch (err) {
  console.error("Stream command init failed:", err);
  process.exit(1);
}

// ─── SECTION 9: Ready Handler ──────────────────────────────────────────────
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Connected to ${client.guilds.cache.size} guild(s)`);

  try {
    await counting.loadCountData();
    console.log("Counting data loaded");
  } catch (err) {
    console.error("Counting load failed:", err);
  }

  presence.updatePresence();
  setInterval(presence.updatePresence, 5 * 60 * 1000);

  // Stagger YouTube 30s after startup
  checkForNewVideo().catch(console.error);
  setTimeout(() => {
    setInterval(checkForNewVideo, 5 * 60 * 1000);
  }, 30_000);
});

// ─── SECTION 10: Interaction Handler ──────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "testwelcome") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "No permission.", ephemeral: true });
    }
    const user = interaction.options.getUser("user");
    const member = interaction.guild.members.cache.get(user.id);
    if (!member) {
      return interaction.reply({ content: "User not found.", ephemeral: true });
    }
    await welcome.sendWelcome(member, true);
    await interaction.reply({ content: `Test welcome sent to ${user.tag}`, ephemeral: true });
  }
});

// ─── SECTION 11: Client Error Handlers ────────────────────────────────────
client.on("error", (err) => console.error("Discord client error:", err));
client.on("shardError", (err) => console.error("Shard error:", err));

// ─── SECTION 12: Web Server → Login on listening ──────────────────────────
// Login is intentionally deferred until after the web server is bound.
// Render free tier requires a port to be open before the network stack
// is fully ready — attempting the Discord gateway connection before that
// causes the WebSocket to hang indefinitely.
let server;
try {
  server = initWeb({ client, counting, port: process.env.PORT || 3000 });
  console.log("Web server initialized");
} catch (err) {
  console.error("Web server init failed:", err);
  process.exit(1);
}

server.on("listening", () => {
  console.log("Web server ready — attempting Discord login...");

  const loginTimeout = setTimeout(() => {
    console.error("Discord login timed out after 30s");
    process.exit(1);
  }, 30_000);

  client
    .login(process.env.TOKEN)
    .then(() => {
      clearTimeout(loginTimeout);
      console.log("Login promise resolved");
    })
    .catch((err) => {
      console.error("Discord login failed:", err);
      process.exit(1);
    });
});
