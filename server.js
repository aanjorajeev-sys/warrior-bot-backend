const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Discord OAuth2 settings
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

// Temporary OAuth states
const oauthStates = new Map();

app.get("/", (req, res) => {
    res.json({
        status: "online",
        message: "Warrior Bot backend is running!"
    });
});

// Start Discord OAuth2
app.get("/auth/discord", (req, res) => {
    const state = crypto.randomBytes(32).toString("hex");

    oauthStates.set(state, Date.now());

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

// Discord OAuth2 callback
app.get("/auth/discord/callback", async (req, res) => {
    try {
        const { code, state } = req.query;

        if (!code || !state) {
            return res.status(400).send("Missing OAuth2 code or state.");
        }

        if (!oauthStates.has(state)) {
            return res.status(400).send("Invalid or expired OAuth2 state.");
        }

        oauthStates.delete(state);

        // Exchange authorization code for access token
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
            console.error("Discord token error:", tokenData);
            return res.status(400).send("Discord OAuth2 authorization failed.");
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
            return res.status(400).send("Could not get Discord account.");
        }

        console.log("Discord user connected:", user.id, user.username);

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Warrior Bot - Discord Connected</title>
                <style>
                    body {
                        background: #080b12;
                        color: white;
                        font-family: Arial, sans-serif;
                        text-align: center;
                        padding-top: 100px;
                    }

                    .box {
                        max-width: 500px;
                        margin: auto;
                        padding: 35px;
                        background: #111827;
                        border: 1px solid #2563eb;
                        border-radius: 15px;
                    }

                    h1 {
                        color: #3b82f6;
                    }
                </style>
            </head>

            <body>
                <div class="box">
                    <h1>✅ Discord Connected</h1>
                    <p>Welcome, <strong>${escapeHtml(user.username)}</strong>!</p>
                    <p>Your Discord account has been successfully connected to Warrior Bot.</p>
                    <p>You can close this page.</p>
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        console.error("OAuth2 error:", error);
        res.status(500).send("Warrior Bot OAuth2 server error.");
    }
});

// Prevent HTML injection in username
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

app.listen(PORT, () => {
    console.log(`Warrior Bot backend running on port ${PORT}`);
});
