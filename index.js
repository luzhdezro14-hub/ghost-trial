const express = require("express");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const cron = require("node-cron");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Servidor funcionando");
});

app.get("/webhook", (req, res) => {
  res.send("Webhook activo");
});

// 🔑 TU ADMIN API KEY (Ghost)
const ADMIN_API_KEY = "69dc070577f04a0001471c77:c416777f8545b70941afac9e7a1f7eb0c0e1b5c3514e451f28dc0e343567fa54";

// 🔗 TU DOMINIO REAL
const GHOST_URL = "https://pruebas.ghost.io";

// separar id y secret
const [id, secret] = ADMIN_API_KEY.split(":");

// 🔐 generar token JWT
function generateToken() {
  return jwt.sign({}, Buffer.from(secret, "hex"), {
    keyid: id,
    algorithm: "HS256",
    expiresIn: "5m",
    audience: "/admin/"
  });
}

// 🟢 WEBHOOK → cuando alguien se registra
app.post("/webhook", async (req, res) => {
  try {
    console.log("📩 BODY:", JSON.stringify(req.body, null, 2));

    const memberId = req.body.member?.current?.id || req.body.member?.id;

    if (!memberId) {
      console.log("❌ No memberId");
      return res.status(400).send("No memberId");
    }

    const token = generateToken();

    await axios.put(
      `${GHOST_URL}/ghost/api/admin/members/${memberId}/`,
      {
        members: [
          {
            labels: ["trial"]
          }
        ]
      },
      {
        headers: {
          Authorization: `Ghost ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Trial agregado a:", memberId);
    res.send("OK");

  } catch (error) {
    console.log("❌ ERROR:", error.response?.data || error.message);
    res.status(500).send("Error");
  }
});

// 🔴 CRON → revisar diario y quitar trial después de 30 días
cron.schedule("0 0 * * *", async () => {
  console.log("⏰ Revisando trials...");

  try {
    const token = generateToken();

    const response = await axios.get(
      `${GHOST_URL}/ghost/api/admin/members/`,
      {
        headers: {
          Authorization: `Ghost ${token}`
        }
      }
    );

    const members = response.data.members;
    const now = new Date();

    for (let member of members) {
      const created = new Date(member.created_at);
      const diffDays = (now - created) / (1000 * 60 * 60 * 24);

      const hasTrial = member.labels?.some(l => l.name === "trial");

      if (hasTrial && diffDays >= 30) {
        console.log("❌ Quitando trial a:", member.email);

        await axios.put(
          `${GHOST_URL}/ghost/api/admin/members/${member.id}/`,
          {
            members: [
              {
                labels: []
              }
            ]
          },
          {
            headers: {
              Authorization: `Ghost ${token}`,
              "Content-Type": "application/json"
            }
          }
        );
      }
    }

  } catch (error) {
    console.log("❌ ERROR CRON:", error.response?.data || error.message);
  }
});

// 🚀 servidor (IMPORTANTE PARA RENDER)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto " + PORT);
});