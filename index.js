const express = require("express");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const app = express();
app.use(express.json());

//ADMIN API KEY
const ADMIN_API_KEY = "69dc070577f04a0001471c77:c416777f8545b70941afac9e7a1f7eb0c0e1b5c3514e451f28dc0e343567fa54";

//DOMINIO
const GHOST_URL = "https://pruebas.ghost.io";

// separar id y secret
const [id, secret] = ADMIN_API_KEY.split(":");

//generar JWT
function generateToken() {
  return jwt.sign({}, Buffer.from(secret, "hex"), {
    keyid: id,
    algorithm: "HS256",
    expiresIn: "5m",
    audience: "/admin/"
  });
}

//WEBHOOK → DAR TRIAL (PAID TEMPORAL)
app.post("/webhook", async (req, res) => {
  try {
    console.log("Datos recibidos:", JSON.stringify(req.body, null, 2));

    const memberId = req.body.member?.current?.id || req.body.member?.id;

    if (!memberId) {
      console.log("No hay memberId");
      return res.status(400).send("No memberId");
    }

    const token = generateToken();

    await axios.put(
      `${GHOST_URL}/ghost/api/admin/members/${memberId}/`,
      {
        tiers: [
          {
            id: "69779b4c4d08f00008e7bce8" // 👈 TU TIER "Pruebas"
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

    console.log("✅ Usuario convertido a PAID (trial)");
    res.send("OK");

  } catch (error) {
    console.log("❌ ERROR:", error.response?.data || error.message);
    res.status(500).send("Error");
  }
});

//rutas de prueba
app.get("/", (req, res) => {
  res.send("Servidor funcionando");
});

app.get("/webhook", (req, res) => {
  res.send("Webhook activo");
});

//servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});