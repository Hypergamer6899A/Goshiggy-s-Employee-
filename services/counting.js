export function initCounting({ client, db, env }) {
  const {
    COUNTING_CHANNEL_ID,
    STRIKE_ROLE_ID,
    BAN_ROLE_ID,
  } = env;

  let lastNumber = 0;
  let lastUserId = null;
  let saveTimeout = null;

  async function loadCountData() {
    const doc = await db.collection("botData").doc("countData").get();
    if (doc.exists) {
      lastNumber = doc.data().lastNumber || 0;
      lastUserId = doc.data().lastUserId || null;
    } else {
      await saveCountData();
    }
  }

  async function saveCountData() {
    await db.collection("botData").doc("countData").set({
      lastNumber,
      lastUserId,
      updated: new Date().toISOString(),
    });
  }

  function scheduleSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveCountData().catch(console.error);
    }, 3000);
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
      } catch {}

      lastNumber = 0;
      lastUserId = null;
      // Immediate save on reset — losing this state would be bad
      await saveCountData();
      return;
    }

    lastNumber = number;
    lastUserId = message.author.id;
    // Debounced save on valid counts — no need to write every single message
    scheduleSave();

    await message.react("✅");
    if (number % 50 === 0) {
      await message.channel.send(`🎉 Nice! The count reached **${number}**!`);
    }
  });

  return { loadCountData };
}
