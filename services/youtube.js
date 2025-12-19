import axios from "axios";

export function initYouTube({ client, db, env }) {
  const {
    YT_API_KEY,
    YT_CHANNEL_ID,
    DISCORD_CHANNEL_ID,
    PING_ROLE_ID,
  } = env;

  async function getLatestVideo() {
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

    const uploads =
      channelRes.data.items[0].contentDetails.relatedPlaylists.uploads;

    const res = await axios.get(
      "https://www.googleapis.com/youtube/v3/playlistItems",
      {
        params: {
          key: YT_API_KEY,
          playlistId: uploads,
          part: "snippet",
          maxResults: 1,
        },
      }
    );

    const item = res.data.items[0];
    return {
      id: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
      publishedAt: item.snippet.publishedAt,
    };
  }

  async function checkForNewVideo() {
    const latest = await getLatestVideo();
    if (!latest) return;

    const doc = await db.collection("botData").doc("lastVideo").get();
    if (doc.exists && doc.data().lastVideoId === latest.id) return;

    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
    await channel.send(
      `<@&${PING_ROLE_ID}> **New video uploaded!**\n**${latest.title}**\n${latest.url}`
    );

    await db.collection("botData").doc("lastVideo").set({
      lastVideoId: latest.id,
      lastTimestamp: Date.now(),
    });
  }

  return { checkForNewVideo };
}
