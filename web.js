// ─── web.js ────────────────────────────────────────────────────────────────
import express from "express";

export function initWeb({ client, counting, port }) {
  const app = express();
  let botTag = null;

  app.get("/", (_, res) => {
    res.send("Discord Superbot running");
  });

  app.get("/health", (_, res) => {
    if (!botTag && client.user) botTag = client.user.tag;
    res.json({
      status: "ok",
      bot: botTag ?? "starting",
      counting: {
        lastNumber: counting?.lastNumber ?? null,
        lastUserId: counting?.lastUserId ?? null,
      },
      time: new Date().toISOString(),
    });
  });

  // Return the server so index.js can defer login until "listening" fires
  return app.listen(port, () => {
    console.log(`Web server listening on ${port}`);
  });
}
