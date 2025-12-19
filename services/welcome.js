const joinMessages = [
"{ServerName} has joined {Username}... Wait I got it backwards, dang it",
"{Username} has arrived, let's see how long they last...",
"{Username} just made the member count {PlayerCount}", 
"Good luck {Username}, you'll need it", "{PlayerCount} members now counting {Username}!", 
"{Username}? That's an interesting name...", 
"No way, could it be? Is it... oh wait, it's just {Username}", 
"{ServerName} has a brand new member. It's the one, the only, {Username}!", 
"{Username} just got kidnapped", "{Username} discovered the nether", 
"{Username} might just be the reason I quit", "{Username} joined {ServerName}, or did they?", 
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

export function initWelcome({ client, env }) {
  const { CHANNEL_ID } = env;

  async function sendWelcome(member, isTest = false) {
    if (!CHANNEL_ID) return;
    if (member.user.bot && !isTest) return;

    const channel = member.guild.channels.cache.get(CHANNEL_ID);
    if (!channel) return;

    const msg = formatMessage(
      joinMessages[Math.floor(Math.random() * joinMessages.length)],
      member
    );

    await channel.send(msg);
  }

  client.on("guildMemberAdd", (member) => sendWelcome(member));

  return { sendWelcome };
}
