// backend/index.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const routes = require("./routes");
const game = require("./gameState");

const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use("/api", routes);

// Serve frontend
app.use(express.static(path.join(__dirname, "/frontend")));
app.use(express.static(path.join(__dirname, "/public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "/frontend/index.html"));
});

// Game loop tick
setInterval(() => {
  game.tick();
}, 2000);

// Port
const DEFAULT_PORT = 43117;
const PORT = process.env.PORT || DEFAULT_PORT;
app.listen(PORT, () => console.log(`🚀 TCR backend running on port ${PORT}`));
