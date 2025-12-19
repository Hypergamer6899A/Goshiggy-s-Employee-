import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
} from "discord.js";
import { initYouTube } from "./services/youtube.js";
import { initCounting } from "./services/counting.js";
import { initWelcome } from "./services/welcome.js";
import { initPresence } from "./services/presence.js";
import { initFirebase } from "./firebase.js";
import { initWeb } from "./web.js";

// 1️⃣ Create Discord client first
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// 2️⃣ Initialize Firebase
const { db } = initFirebase(process.env);

// 3️⃣ Initialize services (client exists now)
const counting = initCounting({ client, db, env: process.env });
const welcome = initWelcome({ client, env: process.env });
const presence = initPresence(client);
const { checkForNewVideo } = initYouTube({
  client,
  db,
  env: process.env,
});

// 4️⃣ Start web server
initWeb({
  client,
  counting,
  port: process.env.PORT || 3000,
});

// 5️⃣ Discord ready
client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  await counting.loadCountData();

  presence.updatePresence();
  setInterval(presence.updatePresence, 5 * 60 * 1000);
});

// 6️⃣ Slash commands
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "testwelcome") {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: "❌ No permission.",
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("user");
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({
        content: "User not found.",
        ephemeral: true,
      });
    }

    await welcome.sendWelcome(member, true);

    await interaction.reply({
      content: `✅ Test welcome sent to ${user.tag}`,
      ephemeral: true,
    });
  }
});

// 7️⃣ Login Discord
client.login(process.env.TOKEN).catch((err) => {
  console.error("❌ Discord login failed:", err.message);
});
