// --- Imports ---
import {
  Client,
  GatewayIntentBits,
  ActivityType,
  REST,
  Routes,
  PermissionFlagsBits
} from "discord.js";
import axios from "axios";
import express from "express";
import fs from "fs-extra";
import dotenv from "dotenv";
dotenv.config();

// --- Discord Client ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// --- Environment Variables ---
const {
  TOKEN,
  PORT,
  GUILD_ID,
  // YouTube alert
  YT_API_KEY,
  YT_CHANNEL_ID,
  DISCORD_CHANNEL_ID,
  PING_ROLE_ID,
  // Counting bot
  COUNTING_CHANNEL_ID,
  STRIKE_ROLE_ID,
  BAN_ROLE_ID,
  // Welcome bot
  CHANNEL_ID,
} = process.env;

if (!TOKEN) {
  console.error("❌ Missing TOKEN in .env");
  process.exit(1);
}

// --- Paths for Data Files ---
const LAST_VIDEO_FILE = "./lastVideo.json";
const COUNT_DATA_FILE = "./countData.json";

// ============================================================================
// 🎥 YOUTUBE ALERT BOT
// ============================================================================
async function getLatestVideo() {
  try {
    const res = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        key: YT_API_KEY,
        channelId: YT_CHANNEL_ID,
        part: "snippet",
        order: "date",
        maxResults: 1,
        type: "video",
      },
    });

    const item = res.data.items?.[0];
    if (!item) return null;

    return {
      id: item.id.videoId,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      publishedAt: item.snippet.publishedAt,
    };
  } catch (err) {
    console.error("❌ YouTube API error:", err.response?.data || err.message);
    return null;
  }
}

async function checkForNewVideo() {
  if (!YT_API_KEY || !YT_CHANNEL_ID || !DISCORD_CHANNEL_ID || !PING_ROLE_ID) return;

  const latest = await getLatestVideo();
  if (!latest) return;

  const publishedTime = new Date(latest.publishedAt).getTime();
  const now = Date.now();
  const ageHours = (now - publishedTime) / (1000 * 60 * 60);

  if (ageHours > 2) return; // Ignore old videos

  let saved = { lastVideoId: "", lastTimestamp: 0 };
  try {
    if (await fs.pathExists(LAST_VIDEO_FILE)) {
      saved = await fs.readJson(LAST_VIDEO_FILE);
    } else {
      await fs.writeJson(LAST_VIDEO_FILE, saved, { spaces: 2 });
    }
  } catch {
    console.warn("⚠️ Could not access lastVideo.json");
  }

  if (saved.lastVideoId !== latest.id) {
    try {
      const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
      await channel.send(
        `<@&${PING_ROLE_ID}> New video uploaded!\n**${latest.title}**\n${latest.url}`
      );
      console.log("✅ YouTube alert sent.");
    } catch (err) {
      console.error("❌ Failed to send YouTube alert:", err.message);
    }

    saved.lastVideoId = latest.id;
    saved.lastTimestamp = now;
    await fs.writeJson(LAST_VIDEO_FILE, saved, { spaces: 2 });
  }
}

// ============================================================================
// 🔢 COUNTING BOT
// ============================================================================
let lastNumber = 0;
let lastUserId = null;

async function loadCountData() {
  try {
    if (await fs.pathExists(COUNT_DATA_FILE)) {
      const data = await fs.readJson(COUNT_DATA_FILE);
      lastNumber = data.lastNumber || 0;
      lastUserId = data.lastUserId || null;
    }
  } catch (err) {
    console.warn("⚠️ Failed to load countData.json:", err.message);
  }
}

async function saveCountData() {
  await fs.writeJson(COUNT_DATA_FILE, { lastNumber, lastUserId }, { spaces: 2 });
}

client.on("messageCreate", async (message) => {
  if (!COUNTING_CHANNEL_ID) return;
  if (message.author.bot) return;
  if (message.channel.id !== COUNTING_CHANNEL_ID) return;

  const number = parseInt(message.content.trim());
  if (isNaN(number)) return;

  const expected = lastNumber + 1;

  if (number !== expected || message.author.id === lastUserId) {
    if (message._countHandled) return;
    message._countHandled = true;

    await message.channel.send(
      `❌ Count reset! <@${message.author.id}> messed it up! Back to **1**.`
    );

    try {
      const member = await message.guild.members.fetch(message.author.id);
      if (member.roles.cache.has(STRIKE_ROLE_ID)) {
        if (!member.roles.cache.has(BAN_ROLE_ID)) {
          await member.roles.add(BAN_ROLE_ID);
          await message.channel.send(`🚫 <@${member.id}> is banned from counting!`);
        }
      } else {
        await member.roles.add(STRIKE_ROLE_ID);
        await message.channel.send(`⚠️ <@${member.id}> got a strike!`);
      }
    } catch (err) {
      console.error("❌ Role assignment error:", err.message);
    }

    lastNumber = 0;
    lastUserId = null;
    await saveCountData();

    client.user.setPresence({
      activities: [{ name: `Counting paused`, type: ActivityType.Playing }],
      status: "online",
    });
    return;
  }

  lastNumber = number;
  lastUserId = message.author.id;
  await saveCountData();

  await message.react("✅");
  if (number % 50 === 0) {
    await message.channel.send(`🎉 Nice! The count reached **${number}**!`);
  }

  client.user.setPresence({
    activities: [{ name: `Counting, rn at ${lastNumber}`, type: ActivityType.Playing }],
    status: "online",
  });
});

// ============================================================================
// 👋 WELCOME BOT
// ============================================================================
const joinMessages = [
  "{ServerName} has joined {Username}... Wait I got it backwards, dang it",
  "{Username} has arrived, let's see how long they last...",
  "{Username} just made the member count {PlayerCount}",
  "Good luck {Username}, you'll need it",
  "{PlayerCount} members now counting {Username}!",
  "{Username}? That's an interesting name...",
  "No way, could it be? Is it... oh wait, it's just {Username}",
  "{ServerName} has a brand new member. It's the one, the only, {Username}!",
  "{Username} just got kidnapped",
  "{Username} discovered the nether",
  "{Username} might just be the reason I quit",
  "{Username} joined {ServerName}, or did they?",
  "Hey {Username}, {ServerName} here. Your home security system is great! Or is it?",
  "Do we really need {Username}? Oh wait they're already here",
  "It's a bird, it's a plane, it's... it's {Username}!",
  "{ServerName} now has {Username} to worry about",
  "Welcome {Username}. Yes I got lazy with this message, don't judge me"
];

function formatMessage(template, member) {
  return template
    .replace(/{Username}/g, `<@${member.id}>`)
    .replace(/{PlayerCount}/g, member.guild.memberCount)
    .replace(/{ServerName}/g, member.guild.name);
}

async function sendWelcome(member, isTest = false) {
  if (!CHANNEL_ID) return;
  if (!member) return;
  if (member.user.bot && !isTest) return;

  const channel = member.guild.channels.cache.get(CHANNEL_ID);
  if (!channel) return;

  const msg = formatMessage(
    joinMessages[Math.floor(Math.random() * joinMessages.length)],
    member
  );

  try {
    await channel.send(msg);
  } catch (err) {
    console.error("❌ Welcome send error:", err.message);
  }
}

client.on("guildMemberAdd", (member) => sendWelcome(member));

// ============================================================================
// 🚀 ON READY
// ============================================================================
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await loadCountData();

  client.user.setPresence({
    activities: [{ name: "Running all systems", type: ActivityType.Playing }],
    status: "online",
  });

  // Register /testwelcome
  const commands = [
    {
      name: "testwelcome",
      description: "Sends a test welcome message",
      options: [
        { name: "user", type: 6, description: "Target user", required: true }
      ],
      default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    },
  ];

  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
      body: commands,
    });
    console.log("✅ Slash commands registered.");
  } catch (err) {
    console.error("❌ Command registration failed:", err.message);
  }

  // Start YouTube checks
  checkForNewVideo();
  setInterval(checkForNewVideo, 15 * 60 * 1000);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName === "testwelcome") {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: "❌ No permission.", ephemeral: true });

    const user = interaction.options.getUser("user");
    const member = interaction.guild.members.cache.get(user.id);
    if (!member)
      return interaction.reply({
        content: "User not found.",
        ephemeral: true,
      });

    await sendWelcome(member, true);
    await interaction.reply({
      content: `✅ Test welcome sent to ${user.tag}`,
      ephemeral: true,
    });
  }
});

// ============================================================================
// 🌐 EXPRESS KEEPALIVE
// ============================================================================
const app = express();
app.get("/", (_, res) => res.send("✅ Discord Superbot running"));
app.get("/health", (_, res) =>
  res.json({
    status: "ok",
    bot: client.user ? client.user.tag : "starting",
    count: { lastNumber, lastUserId },
    time: new Date().toISOString(),
  })
);
app.listen(PORT || 3000, () => console.log(`🌐 Web server listening on ${PORT || 3000}`));

// ============================================================================
// 🔑 LOGIN
// ============================================================================
client.login(TOKEN).catch((err) => {
  console.error("❌ Discord login failed:", err.message);
});
