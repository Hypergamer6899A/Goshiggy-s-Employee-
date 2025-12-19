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
import dotenv from "dotenv";
import admin from "firebase-admin";
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
  // Firebase
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY
} = process.env;

if (!TOKEN) {
  console.error("❌ Missing TOKEN in .env");
  process.exit(1);
}
if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  console.error("❌ Missing Firebase credentials in .env");
  process.exit(1);
}

// ============================================================================
// 🔥 FIREBASE SETUP
// ============================================================================
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();

// ============================================================================
// 🎥 YOUTUBE ALERT BOT (Firestore edition)
// ============================================================================
async function getLatestVideo() {
  try {
    // 1️⃣ Get the uploads playlist ID for the channel
    const channelRes = await axios.get(
      "https://www.googleapis.com/youtube/v3/channels",
      {
        params: {
          key: YT_API_KEY,
          id: YT_CHANNEL_ID,
          part: "contentDetails",
        },
      }
    );

    const uploadsPlaylist =
      channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylist) return null;

    // 2️⃣ Get the most recent upload from that playlist
    const res = await axios.get(
      "https://www.googleapis.com/youtube/v3/playlistItems",
      {
        params: {
          key: YT_API_KEY,
          playlistId: uploadsPlaylist,
          part: "snippet",
          maxResults: 1,
        },
      }
    );

    const item = res.data.items?.[0];
    if (!item) return null;

    const videoId = item.snippet.resourceId.videoId;

    return {
      id: videoId,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt: item.snippet.publishedAt,
    };
  } catch (err) {
    console.error("❌ YouTube API error:", err.response?.data || err.message);
    return null;
  }
}


// ============================================================================
// 🔢 COUNTING BOT (Firestore edition)
// ============================================================================
let lastNumber = 0;
let lastUserId = null;

async function loadCountData() {
  try {
    const doc = await db.collection("botData").doc("countData").get();
    if (doc.exists) {
      const data = doc.data();
      lastNumber = data.lastNumber || 0;
      lastUserId = data.lastUserId || null;
    } else {
      await saveCountData();
    }
  } catch (err) {
    console.warn("⚠️ Failed to load countData:", err.message);
  }
}

async function saveCountData() {
  try {
    await db.collection("botData").doc("countData").set({
      lastNumber,
      lastUserId,
      updated: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Failed to save countData:", err.message);
  }
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
    return;
  }

  lastNumber = number;
  lastUserId = message.author.id;
  await saveCountData();

  await message.react("✅");
  if (number % 50 === 0) {
    await message.channel.send(`🎉 Nice! The count reached **${number}**!`);
  }
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

  checkForNewVideo();
  setInterval(checkForNewVideo, 15 * 60 * 1000);

  updatePresence();
  setInterval(updatePresence, 5 * 60 * 1000);
});

// ============================================================================
// 🎮 PRESENCE SYSTEM
// ============================================================================
function updatePresence() {
  if (!client.user) return;

  const activities = [
    { name: "Trying to sleep", type: ActivityType.Playing },
    { name: "Doing tasks", type: ActivityType.Watching },
    { name: "Working hard", type: ActivityType.Listening },
    { name: "Watching Goshiggy videos", type: ActivityType.Watching },
    { name: "Counting numbers", type: ActivityType.Playing },
    { name: "Welcoming members", type: ActivityType.Playing },
  ];

  const random = activities[Math.floor(Math.random() * activities.length)];

  client.user.setPresence({
    activities: [random],
    status: "online",
  });

  console.log(`🟢 Presence set to "${random.name}"`);
}

// ============================================================================
// 🧩 COMMAND HANDLER
// ============================================================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "testwelcome") {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: "❌ No permission.", ephemeral: true });

    const user = interaction.options.getUser("user");
    const member = interaction.guild.members.cache.get(user.id);
    if (!member)
      return interaction.reply({ content: "User not found.", ephemeral: true });

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
app.listen(PORT || 3000, () =>
  console.log(`🌐 Web server listening on ${PORT || 3000}`)
);

// ============================================================================
// 🔑 LOGIN
// ============================================================================
client.login(TOKEN).catch((err) => {
  console.error("❌ Discord login failed:", err.message);
});
