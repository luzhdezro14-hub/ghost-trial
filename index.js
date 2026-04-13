const express = require("express");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const cron = require("node-cron");

const app = express();
app.use(express.json());

// 🔑 TU ADMIN API KEY (Ghost)
const ADMIN_API_KEY = "69dc070577f04a0001471c77:c416777f8545b70941afac9e7a1f7eb0c0e1b5c3514e451f28dc0e343567fa54";

// 🔗 TU DOMINIO
const GHOST_URL = "https://pruebas.ghost.io";

// separar id y secret
const [id, secret] = ADMIN_API_KEY.split(":");

// generar token
function generateToken() {
  return jwt.sign({}, Buffer.from(secret, "hex"), {
    keyid: id,
    algorithm: "HS256",
    expiresIn: "5m",
    audience: "/admin/"
  });
}

// 🟢 1. CUANDO SE CREA USUARIO → poner trial
app.post("/webhook", async (req, res) => {
  try {
    const memberId = req.body.member.current.id;

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
          Authorization: `Ghost ${token}`
        }
      }
    );

    console.log("✅ Trial agregado");
    res.send("OK");

  } catch (error) {
    console.log(error.response?.data || error.message);
    res.status(500).send("Error");
  }
});

// 🔴 2. CRON → quitar trial después de 30 días
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

      const hasTrial = member.labels.some(l => l.name === "trial");

      if (hasTrial && diffDays >= 30) {
        console.log("Quitando trial a:", member.email);

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
              Authorization: `Ghost ${token}`
            }
          }
        );
      }
    }

  } catch (error) {
    console.log(error.response?.data || error.message);
  }
});

// 🚀 iniciar servidor
app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});