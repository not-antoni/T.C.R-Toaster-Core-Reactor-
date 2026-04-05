// backend/gameState.js

const MAX_METER = 100;
const MIN_METER = 0;
const RESTAB_COIL_TARGET = 5000;
const RESTAB_DURATION_MS = 15000; // 15s window
const DEBUG_LOGS = false;

let state = {
  phase: 1,
  meters: {
    radiation: 0,
    cookness: 0,
    heat: 0,
    pressure: 0
  },
  buttons: {
    ignition: false,
    heatCoils: 0,
    coolantPump: 0,
    shieldToggle: 0
  },
  shieldActiveUntil: null,
  restab: {
    active: false,
    coilCounter: 0,
    deadlineAt: null
  },
  thresholds: {
    heat80: false,
    pressure80: false,
    cookness80: false,
    heat95: false,
    pressure95: false
  },
  lastUpdate: Date.now()
};

// Event timeline (ring buffer-like)
let nextEventId = 1;
const events = [];
const MAX_EVENTS = 500;

function emitEvent(type, payload = {}) {
  const evt = { id: nextEventId++, ts: Date.now(), type, ...payload };
  events.push(evt);
  if (events.length > MAX_EVENTS) events.shift();
}

function getEventsSince(sinceId) {
  if (!sinceId) return [...events];
  return events.filter(e => e.id > sinceId);
}

function debugLog(...args) {
  if (DEBUG_LOGS) {
    console.log(...args);
  }
}

const EFFECTS = {
  heatCoils: { heat: +5, cookness: +3, pressure: +2 },
  coolantPump: { pressure: -4, cookness: -1 },
  shieldToggle: { radiation: -5, heat: -2 }
};

function clampMeters() {
  for (let key in state.meters) {
    if (state.meters[key] < MIN_METER) state.meters[key] = MIN_METER;
    if (state.meters[key] > MAX_METER) state.meters[key] = MAX_METER;
  }
}

function resetGame() {
  state = {
    phase: 1,
    meters: { radiation: 0, cookness: 0, heat: 0, pressure: 0 },
    buttons: { ignition: false, heatCoils: 0, coolantPump: 0, shieldToggle: 0 },
    shieldActiveUntil: null,
    restab: { active: false, coilCounter: 0, deadlineAt: null },
    thresholds: { heat80: false, pressure80: false, cookness80: false, heat95: false, pressure95: false },
    lastUpdate: Date.now()
  };
  emitEvent("reset", {});
}

// Emit startup event
emitEvent("game_start", {});

function pressButton(button) {
  debugLog(`Button pressed: ${button}`);
  if (!EFFECTS[button]) {
    debugLog(`No effects for button: ${button}`);
    return;
  }
  let effects = EFFECTS[button];
  debugLog(`Effects for ${button}:`, effects);
  for (let m in effects) {
    const oldValue = state.meters[m];
    state.meters[m] += effects[m];
    if (state.meters[m] < 0) state.meters[m] = 0;
    if (state.meters[m] > 100) state.meters[m] = 100;
    debugLog(`${m}: ${oldValue} -> ${state.meters[m]} (${effects[m]})`);
  }
  state.buttons[button] += 1;
  emitEvent("button_press", { button });

  // Restabilization coil spam is tracked on backend too
  if (state.phase === "Restabilization" && button === "heatCoils") {
    state.restab.coilCounter += 10;
    if (state.restab.coilCounter > RESTAB_COIL_TARGET) {
      state.restab.coilCounter = RESTAB_COIL_TARGET;
    }
  }

  // Shield pulse window for multiplayer UI sync
  if (button === "shieldToggle") {
    state.shieldActiveUntil = Date.now() + 1500; // 1.5s pulse visibility
    emitEvent("shield_pulse", { until: state.shieldActiveUntil });
  }
}

function ignition() {
  state.buttons.ignition = true;

  if (state.phase === 1) {
    state.phase = 2;
    emitEvent("phase_change", { phase: 2 });
  } else if (state.phase === 2) {
    state.phase = 3;
    emitEvent("phase_change", { phase: 3 });
    emitEvent("critical_browning_warning", {});
  } else if (state.phase === 3) {
    state.phase = 4;
    emitEvent("phase_change", { phase: 4 });
    emitEvent("reactor_hum", {});
    emitEvent("power_spike", {});
  } else if (state.phase === 4) {
    // Enter Restabilization if meme check is met, otherwise immediate meltdown
    if (checkRestabilizationEntry()) {
      state.phase = "Restabilization";
      state.restab.active = true;
      state.restab.coilCounter = 0;
      state.restab.deadlineAt = Date.now() + RESTAB_DURATION_MS;
      emitEvent("restab_start", { deadlineAt: state.restab.deadlineAt });
      emitEvent("phase_change", { phase: "Restabilization" });
    } else {
      state.phase = 5;
      state.restab.active = false;
      state.restab.coilCounter = 0;
      state.restab.deadlineAt = null;
      emitEvent("meltdown_start", {});
      emitEvent("phase_change", { phase: 5 });
    }
  } else if (state.phase === 5) {
    // After meltdown, transition to phase 6 (case breakage)
    state.phase = 6;
    state.caseIntegrity = 100; // Start with full case integrity
    state.phase6StartTime = Date.now();
    emitEvent("phase_change", { phase: 6 });
    emitEvent("case_breakage_start", {});
  } else if (state.phase === "Restabilization") {
    // Attempt to resolve Restabilization on ignition
    const coilOk = state.restab.coilCounter >= RESTAB_COIL_TARGET;
    const memeOk = checkRestabilizationSuccess();
    const timeOk = state.restab.deadlineAt && Date.now() <= state.restab.deadlineAt;

    if (coilOk && memeOk && timeOk) {
      // Success: de-escalate to Phase 3 and cool things down a bit
      state.phase = 3;
      state.restab.active = false;
      state.restab.coilCounter = 0;
      state.restab.deadlineAt = null;
      state.meters.heat = Math.max(state.meters.heat - 20, MIN_METER);
      state.meters.pressure = Math.max(state.meters.pressure - 20, MIN_METER);
      state.meters.radiation = Math.max(state.meters.radiation - 15, MIN_METER);
      emitEvent("restab_success", {});
      emitEvent("phase_change", { phase: 3 });
    } else {
      // Fail: meltdown
      state.phase = 5;
      state.restab.active = false;
      state.restab.coilCounter = 0;
      state.restab.deadlineAt = null;
      emitEvent("restab_fail", {});
      emitEvent("meltdown_start", {});
      emitEvent("phase_change", { phase: 5 });
    }
  } else if (state.phase === 6) {
    // Phase 6: Ignition triggers case breakage acceleration
    if (state.caseIntegrity > 0) {
      // Accelerate case breakage on ignition
      state.caseIntegrity = Math.max(0, state.caseIntegrity - 10);
      emitEvent("case_breakage_accelerated", { integrity: state.caseIntegrity });
    }
  } else if (state.phase === 7) {
    // Phase 7: Ignition spawns stabilizers
    if (state.stabilizersOnline < 8) {
      // Spawn next stabilizer
      const stabilizerKeys = Object.keys(state.stabilizers);
      for (let key of stabilizerKeys) {
        if (state.stabilizers[key].status === 'offline') {
          state.stabilizers[key].status = 'green';
          state.stabilizersOnline++;
          emitEvent("stabilizer_spawned", { stabilizer: key });
          break;
        }
      }
    }
  }
}

function checkRestabilizationEntry() {
  return (
    state.buttons.heatCoils === 21 &&
    state.buttons.coolantPump === 21 &&
    state.buttons.shieldToggle === 21 &&
    state.buttons.ignition
  );
}

function checkRestabilizationSuccess() {
  return (
    state.buttons.heatCoils >= 21 &&
    state.buttons.coolantPump === 21 &&
    state.buttons.shieldToggle === 21 &&
    state.buttons.ignition
  );
}

function tick() {
  let now = Date.now();
  if (now - state.lastUpdate > 2000) {
    state.lastUpdate = now;

    // Passive dynamics by phase
    if (state.phase === 1) {
      state.meters.heat += Math.random() * 0.5;
      state.meters.cookness += Math.random() * 0.2;
      state.meters.radiation += Math.random() * 0.3; // slow baseline radiation rise
    } else if (state.phase === 2) {
      state.meters.heat += 1 + Math.random();
      state.meters.cookness += 0.8 + Math.random() * 0.6;
      state.meters.pressure += Math.random() * 0.8;
      state.meters.radiation += Math.random() * 0.5;
    } else if (state.phase === 3) {
      state.meters.heat += 1.5 + Math.random() * 1.5;
      state.meters.cookness += 1.2 + Math.random() * 1.0;
      state.meters.pressure += 0.8 + Math.random() * 1.2;
      state.meters.radiation += Math.random() * 0.8;
    } else if (state.phase === 4) {
      state.meters.heat += 2 + Math.random() * 2;
      state.meters.cookness += 1.5 + Math.random() * 1.5;
      state.meters.pressure += 1.2 + Math.random() * 1.5;
      state.meters.radiation += 0.8 + Math.random() * 1.2;
  } else if (state.phase === "Restabilization") {
    // During Restabilization, things are unstable: slight increases but slower
    state.meters.heat += Math.random() * 0.8;
    state.meters.pressure += Math.random() * 0.8;
    state.meters.radiation += Math.random() * 0.8;

    // Timer check
    if (state.restab.active && state.restab.deadlineAt && now > state.restab.deadlineAt) {
      state.phase = 5;
      state.restab.active = false;
      state.restab.coilCounter = 0;
      state.restab.deadlineAt = null;
      emitEvent("restab_timeout", {});
      emitEvent("meltdown_start", {});
      emitEvent("phase_change", { phase: 5 });
    }
  } else if (state.phase === 6) {
    // Phase 6: Case breakage - gradually decrease case integrity
    if (state.caseIntegrity > 0) {
      // Case integrity drops faster over time
      const timeElapsed = (now - state.phase6StartTime) / 1000;
      const dropRate = 0.5 + (timeElapsed * 0.1); // Accelerating damage
      state.caseIntegrity = Math.max(0, state.caseIntegrity - dropRate);
      
      // All meters continue to rise during case breakage
      state.meters.heat += 1 + Math.random() * 2;
      state.meters.cookness += 1 + Math.random() * 1.5;
      state.meters.pressure += 1 + Math.random() * 2;
      state.meters.radiation += 1 + Math.random() * 1.5;
      
      // Auto-transition to Phase 7 when case integrity reaches 0
      if (state.caseIntegrity <= 0 && !state.phase7Transitioned) {
        state.phase = 7;
        state.phase7Transitioned = true;
        state.phase7StartTime = Date.now();
        state.powerInput = 240; // 240V input
        state.powerOutput = 240; // Start at 240V, will grow massively
        state.lastLightningOutput = 240; // Initialize lightning tracking
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
        
        // Auto-spawn first stabilizer when Phase 7 starts
        state.stabilizers.topLeft.status = 'green';
        state.stabilizersOnline++;
        debugLog(`Phase 7 started, spawned stabilizer: topLeft`);
        emitEvent("stabilizer_spawned", { stabilizer: 'topLeft' });
        
        emitEvent("phase_change", { phase: 7 });
        emitEvent("internal_explosion", {});
        emitEvent("case_broken", {});
      }
    }
  } else if (state.phase === 7) {
    // Phase 7: Stabilizer mode - exactly 394 seconds (6:34) to sync with music
    const timeElapsed = (now - state.phase7StartTime) / 1000;
    
    // Auto-spawn stabilizers based on time progression
    if (timeElapsed > 30 && state.stabilizers.topRight.status === 'offline') {
      state.stabilizers.topRight.status = 'green';
      state.stabilizersOnline++;
      emitEvent("stabilizer_spawned", { stabilizer: 'topRight' });
    }
    if (timeElapsed > 60 && state.stabilizers.rightTop.status === 'offline') {
      state.stabilizers.rightTop.status = 'green';
      state.stabilizersOnline++;
      emitEvent("stabilizer_spawned", { stabilizer: 'rightTop' });
    }
    if (timeElapsed > 90 && state.stabilizers.rightBottom.status === 'offline') {
      state.stabilizers.rightBottom.status = 'green';
      state.stabilizersOnline++;
      emitEvent("stabilizer_spawned", { stabilizer: 'rightBottom' });
    }
    if (timeElapsed > 120 && state.stabilizers.bottomLeft.status === 'offline') {
      state.stabilizers.bottomLeft.status = 'green';
      state.stabilizersOnline++;
      emitEvent("stabilizer_spawned", { stabilizer: 'bottomLeft' });
    }
    if (timeElapsed > 150 && state.stabilizers.bottomRight.status === 'offline') {
      state.stabilizers.bottomRight.status = 'green';
      state.stabilizersOnline++;
      emitEvent("stabilizer_spawned", { stabilizer: 'bottomRight' });
    }
    if (timeElapsed > 180 && state.stabilizers.leftTop.status === 'offline') {
      state.stabilizers.leftTop.status = 'green';
      state.stabilizersOnline++;
      emitEvent("stabilizer_spawned", { stabilizer: 'leftTop' });
    }
    if (timeElapsed > 210 && state.stabilizers.leftBottom.status === 'offline') {
      state.stabilizers.leftBottom.status = 'green';
      state.stabilizersOnline++;
      emitEvent("stabilizer_spawned", { stabilizer: 'leftBottom' });
    }
    
    // Power output grows to create more lightning
    state.powerOutput += 80 + Math.random() * 40;
    
    // Lightning strikes every 50V increase (much faster)
    const lightningThreshold = 50;
    if (state.powerOutput >= state.lastLightningOutput + lightningThreshold) {
      state.lastLightningOutput = state.powerOutput;
      
      // Only target stabilizers that are online (not offline or gray)
      const onlineStabilizers = Object.entries(state.stabilizers)
        .filter(([key, stab]) => stab.status !== 'offline' && stab.status !== 'gray');
      
      if (onlineStabilizers.length > 0) {
        const randomIndex = Math.floor(Math.random() * onlineStabilizers.length);
        const [randomKey, stab] = onlineStabilizers[randomIndex];
        
        stab.hits++;
        if (stab.hits === 1) {
          stab.status = 'yellow';
        } else if (stab.hits === 2) {
          stab.status = 'red';
        } else if (stab.hits >= 3) {
          stab.status = 'gray';
          state.stabilizersOnline--;
        }
        
        emitEvent("lightning_strike", { target: randomKey, hits: stab.hits, status: stab.status });
        
        // Spawn chaos terminal when stabilizer breaks (turns gray)
        if (stab.status === 'gray') {
          emitEvent("spawn_chaos_terminal", { 
            brokenStabilizer: randomKey,
            totalBroken: Object.values(state.stabilizers).filter(s => s.status === 'gray').length
          });
        }
      }
    }
    
    // Force transition to Phase 8 after exactly 175 seconds (2:55) OR when all stabilizers are broken
    const allStabilizersBroken = Object.values(state.stabilizers).every(stab => stab.status === 'gray');
    if ((timeElapsed >= 175 || allStabilizersBroken) && state.phase === 7) {
      debugLog("TRANSITIONING TO PHASE 8 - Time elapsed:", timeElapsed);
      state.phase = 8;
      state.phase8StartTime = Date.now();
      emitEvent("phase_change", { phase: 8 });
      emitEvent("all_stabilizers_broken", {});
      debugLog("PHASE 8 TRANSITION COMPLETE - New phase:", state.phase);
    }
    
    // All meters continue to rise
    state.meters.heat += 2 + Math.random() * 3;
    state.meters.cookness += 1.5 + Math.random() * 2;
    state.meters.pressure += 2 + Math.random() * 3;
    state.meters.radiation += 2 + Math.random() * 2.5;
  } else if (state.phase === 8) {
    // Phase 8: Blackhole formation
    const timeElapsed = (now - state.phase8StartTime) / 1000;
    
    // Blackhole grows over time
    state.blackholeSize = Math.min(200, 10 + timeElapsed * 5);
    state.blackholeIntensity = Math.min(1, timeElapsed * 0.1);
    
    // All meters max out
    state.meters.heat = 100;
    state.meters.cookness = 100;
    state.meters.pressure = 100;
    state.meters.radiation = 100;
    
    // Check for blackhole explosion (after 30 seconds)
    if (timeElapsed > 30 && !state.blackholeExploded) {
      state.blackholeExploded = true;
      emitEvent("blackhole_explosion", {});
    }
  }

    // Natural bleed-offs
    if (state.phase !== 4 && state.phase !== 5) {
      state.meters.heat = Math.max(state.meters.heat - 0.5, MIN_METER);
      state.meters.pressure = Math.max(state.meters.pressure - 0.3, MIN_METER);
    }

    clampMeters();

    // Meltdown if anything exceeds safe limits (but not during phase 6, 7 or 8)
    if (state.meters.radiation >= MAX_METER || state.meters.pressure >= MAX_METER) {
      if (state.phase !== 5 && state.phase !== 6 && state.phase !== 7 && state.phase !== 8) {
        debugLog("MELTDOWN TRIGGERED - Phase:", state.phase, "Radiation:", state.meters.radiation, "Pressure:", state.meters.pressure);
        state.phase = 5;
        emitEvent("meltdown_start", {});
        emitEvent("phase_change", { phase: 5 });
      } else {
        debugLog("MELTDOWN BLOCKED - Phase:", state.phase, "Radiation:", state.meters.radiation, "Pressure:", state.meters.pressure);
      }
    }

    // Threshold events (once when crossing up, reset when falling below)
    const t = state.thresholds;
    const m = state.meters;
    if (!t.heat80 && m.heat >= 80) { t.heat80 = true; emitEvent("threshold_high_temp", { value: m.heat }); }
    if (t.heat80 && m.heat < 78) { t.heat80 = false; }
    if (!t.pressure80 && m.pressure >= 80) { t.pressure80 = true; emitEvent("threshold_high_pressure", { value: m.pressure }); }
    if (t.pressure80 && m.pressure < 78) { t.pressure80 = false; }
    if (!t.cookness80 && m.cookness >= 80) { t.cookness80 = true; emitEvent("threshold_high_cookness", { value: m.cookness }); }
    if (t.cookness80 && m.cookness < 78) { t.cookness80 = false; }
    if (!t.heat95 && m.heat >= 95) { t.heat95 = true; emitEvent("severe_damage", { metric: "heat", value: m.heat }); }
    if (t.heat95 && m.heat < 93) { t.heat95 = false; }
    if (!t.pressure95 && m.pressure >= 95) { t.pressure95 = true; emitEvent("severe_damage", { metric: "pressure", value: m.pressure }); }
    if (t.pressure95 && m.pressure < 93) { t.pressure95 = false; }
  }
}

module.exports = {
  getState: () => state,
  getEventsSince,
  resetGame,
  pressButton,
  ignition,
  tick
};
