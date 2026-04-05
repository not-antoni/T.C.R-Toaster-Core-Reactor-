// backend/routes.js
const express = require("express");
const router = express.Router();
const game = require("./gameState");

// Get current state
router.get("/state", (req, res) => {
  res.json(game.getState());
});

// Press a button
router.post("/press/:button", (req, res) => {
  game.pressButton(req.params.button);
  res.json(game.getState());
});

// Ignition
router.post("/ignition", (req, res) => {
  game.ignition();
  res.json(game.getState());
});

// Reset
router.post("/reset", (req, res) => {
  game.resetGame();
  res.json(game.getState());
});

// Debug: Force phase transition (for testing)
router.post("/debug/phase/:phase", (req, res) => {
  const phase = parseInt(req.params.phase);
  const state = game.getState();
  state.phase = phase;
  if (phase === 7) {
    state.phase7StartTime = Date.now();
    state.powerInput = 240;
    state.powerOutput = 240;
    state.stabilizers = {
      topLeft: { status: 'offline', hits: 0 },
      topRight: { status: 'offline', hits: 0 },
      rightTop: { status: 'offline', hits: 0 },
      rightBottom: { status: 'offline', hits: 0 },
      bottomLeft: { status: 'offline', hits: 0 },
      bottomRight: { status: 'offline', hits: 0 },
      leftTop: { status: 'offline', hits: 0 },
      leftBottom: { status: 'offline', hits: 0 }
    };
    state.stabilizersOnline = 0;
  } else if (phase === 8) {
    state.phase8StartTime = Date.now();
    state.blackholeSize = 10;
    state.blackholeIntensity = 0;
  }
  res.json(game.getState());
});

// Restabilization state (optional helper for frontend)
router.get("/restab", (req, res) => {
  const s = game.getState();
  res.json({ active: s.restab?.active || false, coilCounter: s.restab?.coilCounter || 0, deadlineAt: s.restab?.deadlineAt || null });
});

module.exports = router;

// Events endpoint
router.get("/events", (req, res) => {
  const sinceId = parseInt(req.query.sinceId || "0", 10);
  const evts = game.getEventsSince(sinceId);
  res.json({ events: evts });
});
