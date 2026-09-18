const express = require("express");
const crypto = require("crypto");
const {
  Client,
  GatewayIntentBits
} = require("discord.js");

const app = express();

const PORT = process.env.PORT || 3000;

// ================================
// DISCORD CONFIG
// ================================

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const MEMBER_ROLE_ID = process.env.MEMBER_ROLE_ID;
const VERIFIED_ROLE_ID = process.env.VERIFIED_ROLE_ID;
const UNVERIFIED_ROLE_ID = process.env.UNVERIFIED_ROLE_ID;

// ================================
// DISCORD BOT
// ================================

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

bot.once("ready", () => {
  console.log(`🤖 Warrior Bot is online as ${bot.user.tag}`);
  console.log(`🏰 Guild ID: ${GUILD_ID}`);
  console.log(`👤 Member Role: ${MEMBER_ROLE_ID}`);
  console.log(`⚔️ Verified Role: ${VERIFIED_ROLE_ID}`);
  console.log(`🔒 Unverified Role: ${UNVERIFIED_ROLE_ID}`);
});

bot.on("error", (error) => {
  console.error("Discord Bot Error:", error);
});

// Start Discord bot
if (BOT_TOKEN) {
  bot.login(BOT_TOKEN).catch((error) => {
    console.error("❌ Discord bot login failed:", error);
  });
} else {
  console.error("❌ DISCORD_BOT_TOKEN is missing!");
}

// ================================
// TEMPORARY OAUTH STATE
// ================================

const oauthStates = new Map();

// ================================
// HTML ESCAPE
// ================================

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ================================
// HOME
// ================================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "Warrior Bot backend is running!",
    bot: bot.isReady() ? "online" : "connecting"
  });
});

// ================================
// BOT STATUS
// ================================

app.get("/api/bot-status", (req, res) => {
  res.json({
    botOnline: bot.isReady(),
    botName: bot.user ? bot.user.tag : null,
    guildId: GUILD_ID
  });
});

// ================================
// DISCORD LOGIN
// ================================

app.get("/auth/discord", (req, res) => {
  const state = crypto.randomBytes(32).toString("hex");

  oauthStates.set(state, {
    createdAt: Date.now()
  });

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: "identify",
    state: state
  });

  res.redirect(
    `https://discord.com/oauth2/authorize?${params.toString()}`
  );
});

// ================================
// DISCORD CALLBACK
// ================================

app.get("/auth/discord/callback", async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).send("Missing Discord OAuth information.");
    }

    if (!oauthStates.has(state)) {
      return res.status(400).send("Invalid or expired OAuth state.");
    }

    oauthStates.delete(state);

    // Exchange authorization code for token
    const tokenResponse = await fetch(
      "https://discord.com/api/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: "authorization_code",
          code: code,
          redirect_uri: REDIRECT_URI
        })
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("OAuth token error:", tokenData);
      return res.status(400).send("Discord OAuth failed.");
    }

    // Get Discord user
    const userResponse = await fetch(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      }
    );

    const user = await userResponse.json();

    if (!userResponse.ok) {
      console.error("Discord user error:", user);
      return res.status(400).send("Could not get Discord user.");
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Warrior Bot - Discord Connected</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: #050b16;
            color: white;
            font-family: Arial, sans-serif;
          }

          .box {
            width: 90%;
            max-width: 550px;
            padding: 40px;
            text-align: center;
            background: #0d1728;
            border: 1px solid #263c5c;
            border-radius: 15px;
            box-shadow: 0 0 30px rgba(0,0,0,.5);
          }

          h1 {
            color: #57ff8a;
          }

          .username {
            font-size: 22px;
            margin: 20px 0;
          }
        </style>
      </head>

      <body>
        <div class="box">
          <h1>✅ Discord Connected</h1>

          <div class="username">
            Welcome, <strong>${escapeHtml(user.username)}</strong>!
          </div>

          <p>
            Your Discord account has been successfully connected
            to Warrior Bot.
          </p>

          <p>
            You can now continue with Minecraft verification.
          </p>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error("OAuth callback error:", error);

    res.status(500).send(
      "Something went wrong while connecting Discord."
    );
  }
});

// ================================
// CLEANUP OLD OAUTH STATES
// ================================

setInterval(() => {
  const now = Date.now();

  for (const [state, data] of oauthStates.entries()) {
    if (now - data.createdAt > 10 * 60 * 1000) {
      oauthStates.delete(state);
    }
  }
}, 60 * 1000);

// ================================
// START SERVER
// ================================

app.listen(PORT, () => {
  console.log(`🌐 Warrior Bot backend running on port ${PORT}`);
});
