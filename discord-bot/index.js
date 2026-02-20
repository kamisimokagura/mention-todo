import { Client, GatewayIntentBits, Events } from "discord.js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_WEBHOOK_SECRET = process.env.DISCORD_WEBHOOK_SECRET;
const NEXT_APP_URL = process.env.NEXT_APP_URL || "http://localhost:3000";
const WATCHED_CHANNEL_IDS = process.env.DISCORD_WATCHED_CHANNEL_IDS
  ? process.env.DISCORD_WATCHED_CHANNEL_IDS.split(",").map((s) => s.trim())
  : []; // empty = watch all channels

if (!DISCORD_BOT_TOKEN) {
  console.error("DISCORD_BOT_TOKEN is not set in .env");
  process.exit(1);
}

if (!DISCORD_WEBHOOK_SECRET) {
  console.error("DISCORD_WEBHOOK_SECRET is not set in .env");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`[Discord Bot] Logged in as ${c.user.tag}`);
  console.log(`[Discord Bot] Forwarding mentions to ${NEXT_APP_URL}`);
  if (WATCHED_CHANNEL_IDS.length > 0) {
    console.log(`[Discord Bot] Watching channels: ${WATCHED_CHANNEL_IDS.join(", ")}`);
  } else {
    console.log(`[Discord Bot] Watching all channels`);
  }
});

client.on(Events.MessageCreate, async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Check if bot is mentioned
  const isMentioned = message.mentions.has(client.user);

  // Check if in watched channel
  const isWatchedChannel =
    WATCHED_CHANNEL_IDS.length === 0 || WATCHED_CHANNEL_IDS.includes(message.channelId);

  if (!isMentioned || !isWatchedChannel) return;

  console.log(
    `[Discord Bot] Mention detected from ${message.author.tag} in #${message.channel.name || message.channelId}`
  );

  const payload = {
    messageId: message.id,
    content: message.content,
    authorName: message.author.tag,
    authorId: message.author.id,
    channelId: message.channelId,
    channelName: message.channel.name || null,
    guildId: message.guildId,
    guildName: message.guild?.name || null,
    timestamp: message.createdAt.toISOString(),
  };

  try {
    const response = await fetch(
      `${NEXT_APP_URL}/api/integrations/discord/webhook`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": DISCORD_WEBHOOK_SECRET,
        },
        body: JSON.stringify(payload),
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log(
        `[Discord Bot] Message ${data.created ? "created" : "already exists"}: ${message.id}`
      );
    } else {
      console.error(`[Discord Bot] Webhook error: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.error(`[Discord Bot] Failed to forward mention:`, err.message);
  }
});

client.login(DISCORD_BOT_TOKEN);
