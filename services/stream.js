export function initStreamCommand({ client, env }) {
  const {
    STREAM_STAFF_CHANNEL_ID,
    STREAM_ANNOUNCE_CHANNEL_ID,
    STREAM_ROLE_ID,
    TWITCH_CHANNEL_NAME,
  } = env;

  client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    // Only allow in staff channel
    if (message.channel.id !== STREAM_STAFF_CHANNEL_ID) return;

    if (!message.content.startsWith("!stream")) return;

    const title = message.content.slice("!stream".length).trim();

    if (!title) {
      return message.reply("❌ You need to include a stream title.");
    }

    const announceChannel =
      message.guild.channels.cache.get(STREAM_ANNOUNCE_CHANNEL_ID);

    if (!announceChannel) {
      return message.reply("❌ Streams channel not found.");
    }

    const announcement =
      `<@&${STREAM_ROLE_ID}> **${TWITCH_CHANNEL_NAME}** is live on Twitch right now!\n` +
      `Go to https://www.twitch.tv/${TWITCH_CHANNEL_NAME} to watch!\n` +
      `**${title}**`;

    await announceChannel.send({ content: announcement });

    // Optional: confirmation in staff
    await message.reply("✅ Stream announcement sent.");

    // Optional: delete command message for cleanliness
    // await message.delete();
  });
}

