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

console.log("Starting Discord bot process...");

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

if (!process.env.TOKEN) {
  console.error("TOKEN env var is missing.");
  process.exit(1);
}
console.log("TOKEN detected");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const { db } = initFirebase(process.env);

const counting = initCounting({ client, db, env: process.env });
const welcome = initWelcome({ client, env: process.env });
const presence = initPresence(client);
const { checkForNewVideo } = initYouTube({ client, db, env: process.env });

initStreamCommand({ client, env: process.env });
initWeb({ client, counting, port: process.env.PORT || 3000 });

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

  // Stagger YouTube checks 30s after startup to avoid overlapping with presence updates
  checkForNewVideo().catch(console.error);
  setTimeout(() => {
    setInterval(checkForNewVideo, 5 * 60 * 1000);
  }, 30 * 1000);
});

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

client.on("error", (err) => console.error("Discord client error:", err));
client.on("shardError", (err) => console.error("Shard error:", err));

console.log("Attempting Discord login...");
client
  .login(process.env.TOKEN)
  .then(() => console.log("Login promise resolved"))
  .catch((err) => {
    console.error("Discord login failed:", err);
    process.exit(1);
  });
