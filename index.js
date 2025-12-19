import { initYouTube } from "./services/youtube.js";
import { initCounting } from "./services/counting.js";
import { initWelcome } from "./services/welcome.js";
import { initPresence } from "./services/presence.js";

const counting = initCounting({ client, db, env: process.env });
const welcome = initWelcome({ client, env: process.env });
const presence = initPresence(client);
const { checkForNewVideo } = initYouTube({
  client,
  db,
  env: process.env,
});

client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  await counting.loadCountData();

  presence.updatePresence();
  setInterval(presence.updatePresence, 5 * 60 * 1000);
});

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

    // ✅ THIS is where it goes
    await welcome.sendWelcome(member, true);

    await interaction.reply({
      content: `✅ Test welcome sent to ${user.tag}`,
      ephemeral: true,
    });
  }
});

