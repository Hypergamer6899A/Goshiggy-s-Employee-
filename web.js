import express from "express";

export function initWeb({ client, counting, port }) {
  const app = express();

  app.get("/", (_, res) => {
    res.send("✅ Discord Superbot running");
  });

  app.get("/health", (_, res) => {
    res.json({
      status: "ok",
      bot: client.user ? client.user.tag : "starting",
      counting: {
        lastNumber: counting?.lastNumber ?? null,
        lastUserId: counting?.lastUserId ?? null,
      },
      time: new Date().toISOString(),
    });
  });

  app.listen(port, () => {
    console.log(`🌐 Web server listening on ${port}`);
  });
}
