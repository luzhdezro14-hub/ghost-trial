const express = require("express");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const cron = require("node-cron");

const app = express();
app.use(express.json());

const ADMIN_API_KEY = "69dc070577f04a0001471c77:c416777f8545b70941afac9e7a1f7eb0c0e1b5c3514e451f28dc0e343567fa54";
const GHOST_URL = "https://pruebas.ghost.io";
const TIER_ID = "69779b4c4d08f00008e7bce9"; 

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

// RUTAS DE PRUEBA
app.get("/", (req, res) => {
  res.send("Servidor funcionando");
});

app.get("/webhook", (req, res) => {
  res.send("Webhook activo");
});

//WEBHOOK → ASIGNAR TIER (TRIAL)
app.post("/webhook", async (req, res) => {
  try {
    console.log("Webhook recibido:", JSON.stringify(req.body, null, 2));

    const memberId = req.body.member?.current?.id || req.body.member?.id;

    if (!memberId) {
      console.log("No se encontró memberId");
      return res.status(400).send("No member ID");
    }

    const token = generateToken();

    await axios.post(
        `${GHOST_URL}/ghost/api/admin/members/${memberId}/subscriptions/`,
    {
        subscriptions: [
        {
            tier: TIER_ID,
            status: "active"
        }
        ]
    },
    {
        headers: {
        Authorization: `Ghost ${token}`
        }
    }
    );

    console.log("Trial (tier) asignado a:", memberId);

    res.send("OK");

  } catch (error) {
    console.log("ERROR:", error.response?.data || error.message);
    res.status(500).send("Error");
  }
});

//CRON → quitar trial después de 30 días
cron.schedule("0 0 * * *", async () => {
  console.log("Revisando trials...");

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

      const hasSubscription = member.subscriptions?.length > 0;

      if (hasSubscription && diffDays >= 30) {
        console.log("Quitando trial a:", member.email);

        for (let sub of member.subscriptions) {
          await axios.delete(
            `${GHOST_URL}/ghost/api/admin/members/${member.id}/subscriptions/${sub.id}/`,
            {
              headers: {
                Authorization: `Ghost ${token}`
              }
            }
          );
        }
      }
    }

  } catch (error) {
    console.log("ERROR CRON:", error.response?.data || error.message);
  }
});

//iniciar servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});