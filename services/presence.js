import { ActivityType } from "discord.js";

export function initPresence(client) {
  function updatePresence() {
    if (!client.user) return;

    const activities = [
{ name: "Trying to sleep", type: ActivityType.Playing }, 
{ name: "Doing tasks", type: ActivityType.Watching }, 
{ name: "Working hard", type: ActivityType.Listening }, 
{ name: "Watching Goshiggy videos", type: ActivityType.Watching }, 
{ name: "Counting numbers", type: ActivityType.Playing }, 
{ name: "Welcoming members", type: ActivityType.Playing },
{ name: "Eating a sandwich", type: ActivityType.Playing },
    ];

    const random = activities[Math.floor(Math.random() * activities.length)];

    client.user.setPresence({
      activities: [random],
      status: "online",
    });
  }

  return { updatePresence };
}
