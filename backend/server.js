require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { generateCards } = require("./aiCardGenerator");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("AI Card Generator Backend is running."));

app.post("/api/generate-cards", async (req, res) => {
  try {
    const cards = await generateCards(req.body);
    res.json({ cards });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to generate cards" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
