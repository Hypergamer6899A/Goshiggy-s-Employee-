import { initYouTube } from "./services/youtube.js";

const { checkForNewVideo } = initYouTube({
  client,
  db,
  env: process.env,
});

client.once("clientReady", async () => {
  checkForNewVideo();
  setInterval(checkForNewVideo, 15 * 60 * 1000);
});
