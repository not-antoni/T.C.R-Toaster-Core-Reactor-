const DEFAULT_API_PORT = 43117;
const API = (typeof window !== "undefined" && window.location && window.location.protocol === "file:")
  ? `http://localhost:${DEFAULT_API_PORT}/api`
  : "/api";
const DEBUG = false;
const BLACKHOLE_CANVAS_Z_INDEX = 9000;
const FLOATING_ELEMENT_Z_INDEX = 9500;
const PHASE8_EXTRA_SPINNERS = 6;
const PHASE8_EXTRA_FLOATERS = 6;
const FLOATING_VIEWPORT_PADDING = 24;

// Button SFX (alarms reserved for thresholds; buttons use tactile sounds)
const BUTTON_SFX = {
  heatCoils: "audio/injecting_fuel.mp3",
  coolantPump: "audio/button_click.mp3",
  shieldToggle: "audio/reactor_shield.mp3",
  ignition: "audio/button_click.mp3"
};

// Phase music
const PHASE_MUSIC = {
  1: "audio/calibration_ignition.mp3",
  2: "audio/awaiting_ignition.mp3",
  3: "audio/critical_browning_MODE.mp3",
  4: "audio/OVERDRIVE.mp3",
  "Restabilization": "audio/restabilization.mp3",
  5: "audio/meltdown.mp3",
  6: "audio/phase_6_case_breakage.mp3",
  7: "audio/phase-7-stabilizers_mode_on.ogg",
  8: "audio/phase_8_blackhole.mp3"
};

let currentPhaseMusic = null;
let currentPhase = 1;
let phaseAudio = null;
let lastEventId = 0;
let audioUnlockedByGesture = false;
let phase8Timers = [];

// Alarm/one-shot registry — cover all remaining audio assets
const ALARMS = {
  highTemp: "audio/high_temp_alarm.mp3",
  highPressure: "audio/high_pressure_alarm.mp3",
  highCookness: "audio/high_cookness_meter_alarm.mp3",
  criticalBrowningWarning: "audio/CRITICAL_BROWNING_warning.mp3",
  powerSpike: "audio/power_spike.mp3",
  pendingStall: "audio/pending_stall_confirmation.mp3",
  reactorHum: "audio/reactor_destabilized_hum.mp3",
  severeDamage: "audio/severe_structure_damage.mp3",
  totalFailure: "audio/total_toaster_failure_alarm.mp3",
  internalExplosion: "audio/internal_explosion.mp3",
  ejectSuccess: "audio/eject_success.mp3",
  overloadLoop: "audio/overload_loop.ogg",
  overloadEnd: "audio/overload_end.ogg",
  demboom: "audio/demboom.ogg",
  thunder1: "lightning/lightning_strike.wav",
  thunder2: "lightning/lightning-storm-sound-effect.mp3",
  thunder3: "lightning/lightning-strike-cool.mp3"
};

// Cooldowns to prevent audio spam
const audioCooldowns = {};
const SFX_MASTER = 0.32; // further reduce SFX/alarms vs music
function playWithCooldown(key, path, cooldownMs = 8000, volume = 0.6) {
  const now = Date.now();
  if (audioCooldowns[key] && now - audioCooldowns[key] < cooldownMs) return;
  audioCooldowns[key] = now;
  const a = new Audio(path);
  a.volume = Math.max(0, Math.min(1, volume * SFX_MASTER));
  a.play();
}

function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

function computeRestabilizationMemeCheck(buttons = {}) {
  return (
    (buttons.heatCoils || 0) >= 21 &&
    (buttons.coolantPump || 0) === 21 &&
    (buttons.shieldToggle || 0) === 21 &&
    Boolean(buttons.ignition)
  );
}

function schedulePhase8Timer(callback, delay) {
  const timerId = window.setTimeout(() => {
    phase8Timers = phase8Timers.filter(id => id !== timerId);
    callback();
  }, delay);
  phase8Timers.push(timerId);
  return timerId;
}

function clearPhase8Timers() {
  phase8Timers.forEach(timerId => clearTimeout(timerId));
  phase8Timers = [];
}

function captureFloatingSize(floating, el) {
  if (!floating.width || !floating.height || floating.isTerminal) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) floating.width = rect.width;
    if (rect.height > 0) floating.height = rect.height;
  }
  return {
    width: floating.width || 0,
    height: floating.height || 0
  };
}

// Restabilization variables
let coilCounter = 0; // local UI fallback; will sync from backend
const coilTarget = 5000;
let memeCheckPassed = false;
let restabDeadlineAt = null;
let restabTimerInterval = null;

// Canvas
const canvas = document.getElementById("toasterCanvas");
const ctx = canvas.getContext("2d");
let meltdownAnimationId = null;
let phaseAnimId = null;
let lastDrawnPhase = null;
let meltdownSeqTimeout = null;
let meltdownSeqActive = false;
let phase6AnimationId = null;
let phase6Active = false;
let caseIntegrity = 100;
let terminalVisible = false;
let terminalCommands = [];
let terminalInterval = null;
let phase7AnimationId = null;
let phase7Active = false;
let stabilizers = {};
let powerInput = 240;
let powerOutput = 240;
let powerTerminalVisible = false;
let stabilizerAudio = null;
let alarm7Audio = null;
let lightningStrikes = [];
let lastLightningTime = 0;
let phase8AnimationId = null;
let phase8Active = false;
let blackholeSize = 10;
let blackholeIntensity = 0;
let whiteFadeAmount = 0;
let whiteFadeStartTime = 0;
let explosionSoundPlayed = false;
let overloadLoopAudio = null;
let overloadEndPlayed = false;
let demboomPlayed = false;
let criticalPhaseStarted = false;
let whiteFlashActive = false;
let whiteFlashTimeout = null;
let lastFlashTime = 0;
let bsodVisible = false;
let bootMenuVisible = false;
let floatingElements = [];
let chaosTerminals = [];
let terminalCounter = 0;
let toasterParticles = [];
let toasterFreed = false;
let particleCanvas = null;
let particleCtx = null;
let blackholeX = 200;
let blackholeY = 200;
let blackholeVX = 0;
let blackholeVY = 0;
let shaderIntensity = 0;
let phase8StartTime = 0;
let phase7Notifications = [];
let lastNotificationTime = 0;
let phase8Notifications = [];
let phase8ErrorInterval = null;
let phase6PageShakeActive = false;
let phase6ShakeIntensity = 0; // 0 = normal, 1 = intense, 2 = extreme
let phase6ShakeStartTime = 0;
let phase7PageShakeActive = false;
let phase7ShakeIntensity = 0; // 0 = normal, 1 = intense, 2 = extreme, 3 = catastrophic
let phase7ShakeStartTime = 0;
let phase7TerminalKillInterval = null;
let killedTerminals = new Set();
let phase6TerminalKillInterval = null;
let phase6KilledTerminals = new Set();

// Funny notification messages for phase 7
const PHASE7_NOTIFICATIONS = [
  "Hey bro how's my bread?",
  "I've heard there are issues with the cooking process...",
  "Is the toaster supposed to be floating?",
  "Why is everything shaking?",
  "Are you sure this is safe?",
  "The bread is getting a bit... crispy",
  "Is that supposed to happen?",
  "I think the toaster is having a mid-life crisis",
  "Should I call a toaster repairman?",
  "This doesn't look like a normal toaster...",
  "Is the toaster supposed to glow like that?",
  "I'm starting to think this isn't a regular toaster",
  "Should I unplug it?",
  "The bread is looking... different",
  "Is this a feature or a bug?",
  "I think the toaster is evolving",
  "This is not how my grandma's toaster worked",
  "Is the toaster supposed to make that sound?",
  "I'm getting concerned about my bread",
  "Should I be worried about the floating toaster?"
];

// Phase 8 error messages
const PHASE8_ERROR_MESSAGES = [
  "CRITICAL: Spacetime distortion detected",
  "ERROR: Gravitational field unstable",
  "WARNING: Event horizon expanding",
  "ALERT: Matter compression at 99.7%",
  "FATAL: Quantum entanglement disrupted",
  "ERROR: Blackhole singularity forming",
  "CRITICAL: Spacetime continuum breaking",
  "WARNING: Hawking radiation spike detected",
  "ERROR: Matter accretion rate critical",
  "FATAL: Spacetime curvature approaching infinity",
  "CRITICAL: Event horizon radius expanding",
  "ERROR: Gravitational lensing effect unstable",
  "WARNING: Matter compression exceeding limits",
  "FATAL: Spacetime fabric tearing",
  "ERROR: Quantum field collapse imminent",
  "CRITICAL: Blackhole mass increasing exponentially",
  "WARNING: Spacetime distortion field unstable",
  "ERROR: Matter density approaching infinity",
  "FATAL: Event horizon consuming space-time",
  "CRITICAL: Blackhole singularity imminent"
];

// Terminal commands for phase 6
const TERMINAL_COMMANDS = [
  "toaster stabilizers<check:false",
  "ignition:false",
  "trying backup stabilizers...loaded",
  "case_integrity_check...",
  "WARNING: structural_damage_detected",
  "emergency_protocol_initiated",
  "stabilizer_matrix_failed",
  "attempting_core_containment...",
  "radiation_leak_detected",
  "backup_systems_offline",
  "CRITICAL: blackhole_formation_imminent",
  "final_countdown_initiated"
];

// Stabilizer detection terminal commands for phase 6
const STABILIZER_TERMINAL_COMMANDS = [
  "ping stabilizer_matrix.local...",
  "Request timeout",
  "ping stabilizer_backup.local...",
  "Request timeout",
  "ping stabilizer_emergency.local...",
  "Request timeout",
  "scanning for stabilizer signals...",
  "No stabilizer signals detected",
  "checking stabilizer_alpha...",
  "OFFLINE",
  "checking stabilizer_beta...",
  "OFFLINE",
  "checking stabilizer_gamma...",
  "OFFLINE",
  "checking stabilizer_delta...",
  "OFFLINE",
  "emergency stabilizer scan initiated...",
  "scanning quantum frequencies...",
  "detecting weak signals...",
  "stabilizer_N-D-U-L: ONLINE",
  "stabilizer_N-D-U-R: ONLINE",
  "stabilizer_W-D-U: ONLINE",
  "stabilizer_W-D-D: ONLINE",
  "stabilizer_E-D-U: ONLINE",
  "stabilizer_E-D-D: ONLINE",
  "stabilizer_S-D-L: ONLINE",
  "stabilizer_S-D-R: ONLINE",
  "STABILIZER_MATRIX: 8/8 ONLINE",
  "initializing stabilizer protocols...",
  "stabilizer matrix ready for deployment"
];

// Case integrity monitoring terminal commands
const CASE_INTEGRITY_TERMINAL_COMMANDS = [
  "case_integrity_monitor:start",
  "monitoring structural integrity...",
  "scanning for microfractures...",
  "detecting stress points...",
  "analyzing material fatigue...",
  "WARNING: integrity at 95%",
  "detecting minor cracks...",
  "WARNING: integrity at 90%",
  "structural stress increasing...",
  "WARNING: integrity at 85%",
  "crack propagation detected...",
  "WARNING: integrity at 80%",
  "critical stress zones identified...",
  "WARNING: integrity at 75%",
  "containment breach risk: HIGH",
  "WARNING: integrity at 70%",
  "emergency protocols activated...",
  "WARNING: integrity at 65%",
  "structural failure imminent...",
  "WARNING: integrity at 60%",
  "containment field weakening...",
  "WARNING: integrity at 55%",
  "CRITICAL: structural collapse likely",
  "WARNING: integrity at 50%",
  "emergency evacuation recommended...",
  "WARNING: integrity at 45%",
  "containment breach in progress...",
  "WARNING: integrity at 40%",
  "CATASTROPHIC FAILURE IMMINENT",
  "WARNING: integrity at 35%",
  "final countdown initiated...",
  "WARNING: integrity at 30%",
  "system shutdown in progress...",
  "WARNING: integrity at 25%",
  "containment field collapsing...",
  "WARNING: integrity at 20%",
  "CASE BREAKAGE DETECTED",
  "WARNING: integrity at 15%",
  "transitioning to Phase 7...",
  "WARNING: integrity at 10%",
  "stabilizer deployment required...",
  "WARNING: integrity at 5%",
  "PHASE 7 INITIATED"
];

// Phase 7 terminal commands for unusual core activity detection
const CORE_ACTIVITY_TERMINAL_COMMANDS = [
  "core_activity_monitor:start",
  "scanning toaster core...",
  "detecting unusual energy signatures...",
  "WARNING: quantum fluctuations detected",
  "analyzing core temperature...",
  "CRITICAL: temperature exceeding limits",
  "monitoring radiation levels...",
  "WARNING: radiation spike detected",
  "checking containment field...",
  "ERROR: containment field unstable",
  "scanning for anomalies...",
  "detecting spatial distortions...",
  "WARNING: spacetime curvature detected",
  "analyzing power consumption...",
  "CRITICAL: power draw increasing exponentially",
  "monitoring stabilizer feedback...",
  "WARNING: stabilizer matrix overload",
  "detecting gravitational anomalies...",
  "ERROR: gravitational field collapsing",
  "scanning for dimensional breaches...",
  "WARNING: dimensional instability detected",
  "analyzing quantum field fluctuations...",
  "CRITICAL: quantum field destabilizing",
  "monitoring core integrity...",
  "ERROR: core structure compromised",
  "detecting energy leaks...",
  "WARNING: massive energy leak detected",
  "scanning for blackhole formation...",
  "CRITICAL: blackhole formation imminent",
  "analyzing event horizon...",
  "WARNING: event horizon expanding",
  "monitoring singularity...",
  "ERROR: singularity approaching",
  "final analysis complete...",
  "CATASTROPHIC FAILURE DETECTED"
];

const QUANTUM_ANALYSIS_TERMINAL_COMMANDS = [
  "quantum_analysis_system:online",
  "initializing quantum scanners...",
  "calibrating dimensional sensors...",
  "scanning quantum field...",
  "detecting quantum fluctuations...",
  "WARNING: quantum field instability",
  "analyzing particle behavior...",
  "detecting quantum tunneling...",
  "WARNING: excessive quantum tunneling",
  "monitoring quantum entanglement...",
  "detecting quantum decoherence...",
  "WARNING: quantum decoherence detected",
  "scanning quantum vacuum...",
  "detecting vacuum fluctuations...",
  "WARNING: vacuum instability",
  "analyzing quantum foam...",
  "detecting quantum foam expansion...",
  "WARNING: quantum foam destabilizing",
  "monitoring quantum coherence...",
  "detecting coherence loss...",
  "WARNING: quantum coherence failing",
  "scanning quantum states...",
  "detecting state superposition...",
  "WARNING: superposition collapse",
  "analyzing quantum probability...",
  "detecting probability wave collapse...",
  "WARNING: probability wave unstable",
  "monitoring quantum spin...",
  "detecting spin decoherence...",
  "WARNING: quantum spin failing",
  "scanning quantum energy...",
  "detecting energy quantization...",
  "WARNING: energy quantization breaking",
  "analyzing quantum field strength...",
  "detecting field weakening...",
  "WARNING: quantum field collapsing",
  "final quantum analysis...",
  "QUANTUM CATASTROPHE IMMINENT"
];

const DIMENSIONAL_SCANNER_TERMINAL_COMMANDS = [
  "dimensional_scanner:activate",
  "initializing dimensional sensors...",
  "calibrating spacetime detectors...",
  "scanning dimensional boundaries...",
  "detecting dimensional instability...",
  "WARNING: dimensional boundaries weakening",
  "analyzing spacetime curvature...",
  "detecting gravitational waves...",
  "WARNING: gravitational wave anomaly",
  "monitoring dimensional flux...",
  "detecting dimensional flux increase...",
  "WARNING: dimensional flux critical",
  "scanning for dimensional tears...",
  "detecting dimensional tears...",
  "WARNING: dimensional tears expanding",
  "analyzing dimensional compression...",
  "detecting compression anomalies...",
  "WARNING: dimensional compression failing",
  "monitoring dimensional expansion...",
  "detecting expansion irregularities...",
  "WARNING: dimensional expansion unstable",
  "scanning for dimensional rifts...",
  "detecting dimensional rifts...",
  "WARNING: dimensional rifts growing",
  "analyzing dimensional density...",
  "detecting density fluctuations...",
  "WARNING: dimensional density collapsing",
  "monitoring dimensional stability...",
  "detecting stability loss...",
  "WARNING: dimensional stability failing",
  "scanning for dimensional breaches...",
  "detecting dimensional breaches...",
  "WARNING: dimensional breaches expanding",
  "analyzing dimensional integrity...",
  "detecting integrity loss...",
  "WARNING: dimensional integrity compromised",
  "final dimensional analysis...",
  "DIMENSIONAL CATASTROPHE DETECTED"
];

const ENERGY_MONITOR_TERMINAL_COMMANDS = [
  "energy_monitor_system:start",
  "initializing energy sensors...",
  "calibrating power detectors...",
  "scanning energy distribution...",
  "detecting energy anomalies...",
  "WARNING: energy distribution unstable",
  "analyzing power consumption...",
  "detecting power surge...",
  "WARNING: power surge detected",
  "monitoring energy efficiency...",
  "detecting efficiency drop...",
  "WARNING: energy efficiency failing",
  "scanning for energy leaks...",
  "detecting massive energy leak...",
  "WARNING: energy leak critical",
  "analyzing energy conversion...",
  "detecting conversion failure...",
  "WARNING: energy conversion failing",
  "monitoring energy storage...",
  "detecting storage overload...",
  "WARNING: energy storage overloaded",
  "scanning for energy spikes...",
  "detecting energy spike...",
  "WARNING: energy spike critical",
  "analyzing energy flow...",
  "detecting flow disruption...",
  "WARNING: energy flow disrupted",
  "monitoring energy balance...",
  "detecting balance loss...",
  "WARNING: energy balance lost",
  "scanning for energy resonance...",
  "detecting resonance anomaly...",
  "WARNING: energy resonance unstable",
  "analyzing energy frequency...",
  "detecting frequency shift...",
  "WARNING: energy frequency shifting",
  "final energy analysis...",
  "ENERGY CATASTROPHE IMMINENT"
];

const GRAVITY_ANALYZER_TERMINAL_COMMANDS = [
  "gravity_analyzer:online",
  "initializing gravity sensors...",
  "calibrating gravitational detectors...",
  "scanning gravitational field...",
  "detecting gravitational anomalies...",
  "WARNING: gravitational field unstable",
  "analyzing gravity waves...",
  "detecting gravity wave distortion...",
  "WARNING: gravity wave anomaly",
  "monitoring gravitational pull...",
  "detecting pull increase...",
  "WARNING: gravitational pull critical",
  "scanning for gravity wells...",
  "detecting gravity well formation...",
  "WARNING: gravity well expanding",
  "analyzing gravitational lensing...",
  "detecting lensing distortion...",
  "WARNING: gravitational lensing failing",
  "monitoring gravitational constant...",
  "detecting constant fluctuation...",
  "WARNING: gravitational constant unstable",
  "scanning for gravitational singularities...",
  "detecting singularity formation...",
  "WARNING: gravitational singularity detected",
  "analyzing gravitational collapse...",
  "detecting collapse acceleration...",
  "WARNING: gravitational collapse accelerating",
  "monitoring gravitational stability...",
  "detecting stability loss...",
  "WARNING: gravitational stability failing",
  "scanning for event horizons...",
  "detecting event horizon formation...",
  "WARNING: event horizon expanding",
  "analyzing gravitational density...",
  "detecting density increase...",
  "WARNING: gravitational density critical",
  "final gravity analysis...",
  "GRAVITATIONAL CATASTROPHE DETECTED"
];

const SYSTEM_OVERRIDE_TERMINAL_COMMANDS = [
  "system_override:initiated",
  "bypassing safety protocols...",
  "overriding system locks...",
  "WARNING: unauthorized access detected",
  "emergency protocols activated...",
  "system_override:escalating",
  "bypassing containment fields...",
  "overriding stabilizer matrix...",
  "WARNING: system integrity compromised",
  "emergency shutdown protocols...",
  "system_override:critical",
  "bypassing reactor controls...",
  "overriding power management...",
  "WARNING: critical system failure",
  "emergency evacuation protocols...",
  "system_override:catastrophic",
  "bypassing all safety systems...",
  "overriding core containment...",
  "WARNING: total system override",
  "emergency containment breach...",
  "system_override:terminal",
  "bypassing final protocols...",
  "overriding emergency systems...",
  "WARNING: system override complete",
  "emergency protocols failed...",
  "system_override:successful",
  "all systems compromised...",
  "containment field offline...",
  "WARNING: system override successful",
  "emergency protocols offline...",
  "system_override:complete",
  "all safety systems bypassed...",
  "reactor core exposed...",
  "WARNING: system override complete",
  "emergency protocols failed...",
  "system_override:terminal",
  "SYSTEM OVERRIDE SUCCESSFUL"
];

// Terminal commands for phase 7
const PHASE7_TERMINAL_COMMANDS = [
  "CASE_BREAKAGE_DETECTED",
  "INITIALIZING_STABILIZER_PROTOCOL",
  "deploying_stabilizer_N-D-U-L...",
  "deploying_stabilizer_N-D-U-R...",
  "deploying_stabilizer_W-D-U...",
  "deploying_stabilizer_W-D-D...",
  "deploying_stabilizer_E-D-U...",
  "deploying_stabilizer_E-D-D...",
  "deploying_stabilizer_S-D-L...",
  "deploying_stabilizer_S-D-R...",
  "STABILIZER_MATRIX_ONLINE",
  "INITIATING_BEAM_CONTAINMENT",
  "WARNING: POWER_SPIKES_DETECTED",
  "lightning_strike_protection_active",
  "monitoring_stabilizer_integrity..."
];

// Chaos terminal data for when stabilizers break - TCR themed
const CHAOS_TERMINAL_DATA = [
  {
    title: "TCR_CORE_DIAGNOSTICS",
    messages: [
      "Toaster Core Temperature: 999°C",
      "Bread Containment: FAILING",
      "Heat Coil Matrix: UNSTABLE",
      "Radiation Flux: DANGEROUS",
      "Emergency Toast Protocols: ACTIVE"
    ]
  },
  {
    title: "TCR_POWER_GRID",
    messages: [
      "Main Toaster Power: FLUCTUATING",
      "Backup Heat Coils: OFFLINE",
      "Grid Stability: 23%",
      "Power Surges: DETECTED",
      "Emergency Shutdown: BLOCKED"
    ]
  },
  {
    title: "TCR_SAFETY_SYSTEMS",
    messages: [
      "Emergency Eject: MALFUNCTION",
      "Coolant Pumps: OVERLOADED",
      "Radiation Shields: CRACKED",
      "Bread Alarm: SILENCED",
      "Safety Protocols: BYPASSED"
    ]
  },
  {
    title: "TCR_NETWORK_STATUS",
    messages: [
      "Connection to HQ: LOST",
      "Remote Monitoring: OFFLINE",
      "Data Backup: FAILED",
      "Security Protocols: BREACHED",
      "System Integrity: COMPROMISED"
    ]
  },
  {
    title: "TCR_STABILIZER_ARRAY",
    messages: [
      "Array Integrity: 45%",
      "Beam Alignment: OFFLINE",
      "Power Distribution: UNEVEN",
      "Control Systems: HACKED",
      "Matrix Stability: CRITICAL"
    ]
  },
  {
    title: "TCR_ENVIRONMENTAL",
    messages: [
      "Atmosphere: TOXIC",
      "Pressure: DANGEROUS",
      "Temperature: EXTREME",
      "Life Support: FAILING",
      "Environmental Seals: BROKEN"
    ]
  },
  {
    title: "TCR_BLACKHOLE_CONTAINMENT",
    messages: [
      "Containment Field: WEAKENING",
      "Event Horizon: EXPANDING",
      "Singularity: UNSTABLE",
      "Spacetime Distortion: CRITICAL",
      "Containment Failure: IMMINENT"
    ]
  },
  {
    title: "TCR_FINAL_STATUS",
    messages: [
      "All Systems: CRITICAL",
      "Toaster Core: MELTDOWN",
      "Stabilizers: DESTROYED",
      "Containment: FAILED",
      "Blackhole Formation: COMPLETE"
    ]
  },
  {
    title: "TCR_BREAD_ANALYSIS",
    messages: [
      "Bread Status: BURNT",
      "Toast Level: MAXIMUM",
      "Crispiness: CRITICAL",
      "Golden Ratio: FAILED",
      "Bread Ejection: BLOCKED"
    ]
  },
  {
    title: "TCR_HEAT_MANAGEMENT",
    messages: [
      "Heat Coils: OVERHEATED",
      "Temperature Control: OFFLINE",
      "Thermal Regulation: FAILED",
      "Heat Distribution: UNEVEN",
      "Cooling System: BROKEN"
    ]
  },
  {
    title: "TCR_RADIATION_CONTROL",
    messages: [
      "Radiation Level: MAXIMUM",
      "Shield Integrity: 12%",
      "Containment: BREACHED",
      "Exposure: CRITICAL",
      "Protection: FAILED"
    ]
  },
  {
    title: "TCR_PRESSURE_SYSTEMS",
    messages: [
      "Pressure: CRITICAL",
      "Valve Control: MALFUNCTION",
      "Pressure Relief: BLOCKED",
      "System Integrity: FAILED",
      "Containment: BREACHED"
    ]
  }
];

function showTerminal() {
  if (terminalVisible) return;
  terminalVisible = true;
  
  // Create terminal element
  const terminal = document.createElement('div');
  terminal.id = 'phase6Terminal';
  terminal.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 300px;
    height: 200px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #00ff00;
    color: #00ff00;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    padding: 10px;
    overflow-y: auto;
    z-index: 1000;
    border-radius: 5px;
  `;
  
  document.body.appendChild(terminal);
  
  // Start showing commands
  let commandIndex = 0;
  terminalInterval = setInterval(() => {
    if (commandIndex < TERMINAL_COMMANDS.length) {
      const command = TERMINAL_COMMANDS[commandIndex];
      terminal.innerHTML += `> ${command}<br>`;
      terminal.scrollTop = terminal.scrollHeight;
      commandIndex++;
    }
  }, 2000);
}

function showStabilizerTerminal() {
  // Create stabilizer detection terminal
  const terminal = document.createElement('div');
  terminal.id = 'stabilizerTerminal';
  terminal.style.cssText = `
    position: fixed;
    top: 240px;
    right: 20px;
    width: 300px;
    height: 200px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #ff6600;
    color: #ff6600;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    padding: 10px;
    overflow-y: auto;
    z-index: 1000;
    border-radius: 5px;
  `;
  
  document.body.appendChild(terminal);
  
  // Start showing stabilizer commands
  let commandIndex = 0;
  const stabilizerInterval = setInterval(() => {
    if (commandIndex < STABILIZER_TERMINAL_COMMANDS.length) {
      const command = STABILIZER_TERMINAL_COMMANDS[commandIndex];
      terminal.innerHTML += `> ${command}<br>`;
      terminal.scrollTop = terminal.scrollHeight;
      commandIndex++;
    } else {
      clearInterval(stabilizerInterval);
    }
  }, 1500);
}

function showCaseIntegrityTerminal() {
  // Create case integrity monitoring terminal
  const terminal = document.createElement('div');
  terminal.id = 'caseIntegrityTerminal';
  terminal.style.cssText = `
    position: fixed;
    top: 20px;
    left: 240px;
    width: 300px;
    height: 200px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #8b5cf6;
    color: #8b5cf6;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    padding: 10px;
    overflow-y: auto;
    z-index: 1000;
    border-radius: 5px;
  `;
  
  document.body.appendChild(terminal);
  
  // Start showing case integrity commands
  let commandIndex = 0;
  const caseIntegrityInterval = setInterval(() => {
    if (commandIndex < CASE_INTEGRITY_TERMINAL_COMMANDS.length) {
      const command = CASE_INTEGRITY_TERMINAL_COMMANDS[commandIndex];
      terminal.innerHTML += `> ${command}<br>`;
      terminal.scrollTop = terminal.scrollHeight;
      commandIndex++;
    } else {
      clearInterval(caseIntegrityInterval);
    }
  }, 1000);
}

function showCoreActivityTerminal() {
  // Create core activity monitoring terminal
  const terminal = document.createElement('div');
  terminal.id = 'coreActivityTerminal';
  terminal.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 280px;
    height: 180px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #ff0000;
    color: #ff0000;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    padding: 8px;
    overflow-y: hidden;
    z-index: 1000;
    border-radius: 5px;
  `;
  
  document.body.appendChild(terminal);
  
  // Start aggressive spamming with random content
  let commandIndex = 0;
  const coreActivityInterval = setInterval(() => {
    if (commandIndex < CORE_ACTIVITY_TERMINAL_COMMANDS.length) {
      const command = CORE_ACTIVITY_TERMINAL_COMMANDS[commandIndex];
      terminal.innerHTML += `> ${command}<br>`;
      terminal.scrollTop = terminal.scrollHeight;
      commandIndex++;
    } else {
      // Start aggressive spamming with random content
      const randomCommands = [
        "ERROR: core temperature critical",
        "WARNING: radiation spike detected",
        "CRITICAL: containment field unstable",
        "ERROR: spatial distortions detected",
        "WARNING: power consumption critical",
        "CRITICAL: stabilizer matrix overload",
        "ERROR: gravitational field collapsing",
        "WARNING: dimensional instability",
        "CRITICAL: quantum field destabilizing",
        "ERROR: core structure compromised",
        "WARNING: massive energy leak",
        "CRITICAL: blackhole formation imminent",
        "ERROR: event horizon expanding",
        "WARNING: singularity approaching",
        "CRITICAL: catastrophic failure detected"
      ];
      
      const randomCommand = randomCommands[Math.floor(Math.random() * randomCommands.length)];
      terminal.innerHTML += `> ${randomCommand}<br>`;
      terminal.scrollTop = terminal.scrollHeight;
      
      // Keep only last 20 lines to prevent memory issues
      const lines = terminal.innerHTML.split('<br>');
      if (lines.length > 20) {
        terminal.innerHTML = lines.slice(-20).join('<br>');
      }
    }
  }, 180); // Much faster spamming
}

function showQuantumAnalysisTerminal() {
  // Create quantum analysis terminal
  const terminal = document.createElement('div');
  terminal.id = 'quantumAnalysisTerminal';
  terminal.style.cssText = `
    position: fixed;
    top: 220px;
    right: 20px;
    width: 280px;
    height: 180px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #00ffff;
    color: #00ffff;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    padding: 8px;
    overflow-y: hidden;
    z-index: 1000;
    border-radius: 5px;
  `;
  
  document.body.appendChild(terminal);
  
  // Start aggressive spamming with random content
  let commandIndex = 0;
  const quantumAnalysisInterval = setInterval(() => {
    if (commandIndex < QUANTUM_ANALYSIS_TERMINAL_COMMANDS.length) {
      const command = QUANTUM_ANALYSIS_TERMINAL_COMMANDS[commandIndex];
      terminal.innerHTML += `> ${command}<br>`;
      terminal.scrollTop = terminal.scrollHeight;
      commandIndex++;
    } else {
      // Start aggressive spamming with random content
      const randomCommands = [
        "ERROR: quantum field instability",
        "WARNING: quantum tunneling excessive",
        "CRITICAL: quantum decoherence detected",
        "ERROR: vacuum fluctuations critical",
        "WARNING: quantum foam destabilizing",
        "CRITICAL: quantum coherence failing",
        "ERROR: superposition collapse",
        "WARNING: probability wave unstable",
        "CRITICAL: quantum spin failing",
        "ERROR: energy quantization breaking",
        "WARNING: quantum field collapsing",
        "CRITICAL: quantum catastrophe imminent",
        "ERROR: quantum state corrupted",
        "WARNING: quantum entanglement lost",
        "CRITICAL: quantum system override"
      ];
      
      const randomCommand = randomCommands[Math.floor(Math.random() * randomCommands.length)];
      terminal.innerHTML += `> ${randomCommand}<br>`;
      terminal.scrollTop = terminal.scrollHeight;
      
      // Keep only last 20 lines to prevent memory issues
      const lines = terminal.innerHTML.split('<br>');
      if (lines.length > 20) {
        terminal.innerHTML = lines.slice(-20).join('<br>');
      }
    }
  }, 160); // Much faster spamming
}

function showDimensionalScannerTerminal() {
  // Create dimensional scanner terminal
  const terminal = document.createElement('div');
  terminal.id = 'dimensionalScannerTerminal';
  terminal.style.cssText = `
    position: fixed;
    top: 420px;
    right: 20px;
    width: 280px;
    height: 180px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #ff00ff;
    color: #ff00ff;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    padding: 8px;
    overflow-y: hidden;
    z-index: 1000;
    border-radius: 5px;
  `;
  
  document.body.appendChild(terminal);
  
  // Start aggressive spamming with random content
  let commandIndex = 0;
  const dimensionalScannerInterval = setInterval(() => {
    if (commandIndex < DIMENSIONAL_SCANNER_TERMINAL_COMMANDS.length) {
      const command = DIMENSIONAL_SCANNER_TERMINAL_COMMANDS[commandIndex];
      terminal.innerHTML += `> ${command}<br>`;
      terminal.scrollTop = terminal.scrollHeight;
      commandIndex++;
    } else {
      // Start aggressive spamming with random content
      const randomCommands = [
        "ERROR: dimensional boundaries weakening",
        "WARNING: gravitational wave anomaly",
        "CRITICAL: dimensional flux critical",
        "ERROR: dimensional tears expanding",
        "WARNING: dimensional compression failing",
        "CRITICAL: dimensional expansion unstable",
        "ERROR: dimensional rifts growing",
        "WARNING: dimensional density collapsing",
        "CRITICAL: dimensional stability failing",
        "ERROR: dimensional breaches expanding",
        "WARNING: dimensional integrity compromised",
        "CRITICAL: dimensional catastrophe detected",
        "ERROR: spacetime curvature critical",
        "WARNING: dimensional field collapsing",
        "CRITICAL: dimensional system override"
      ];
      
      const randomCommand = randomCommands[Math.floor(Math.random() * randomCommands.length)];
      terminal.innerHTML += `> ${randomCommand}<br>`;
      terminal.scrollTop = terminal.scrollHeight;
      
      // Keep only last 20 lines to prevent memory issues
      const lines = terminal.innerHTML.split('<br>');
      if (lines.length > 20) {
        terminal.innerHTML = lines.slice(-20).join('<br>');
      }
    }
  }, 140); // Much faster spamming
}

function showEnergyMonitorTerminal() {
  // Create energy monitor terminal
  const terminal = document.createElement('div');
  terminal.id = 'energyMonitorTerminal';
  terminal.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    width: 280px;
    height: 180px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #ffff00;
    color: #ffff00;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    padding: 8px;
    overflow-y: hidden;
    z-index: 1000;
    border-radius: 5px;
  `;
  
  document.body.appendChild(terminal);
  
  // Start aggressive spamming with random content
  let commandIndex = 0;
  const energyMonitorInterval = setInterval(() => {
    if (commandIndex < ENERGY_MONITOR_TERMINAL_COMMANDS.length) {
      const command = ENERGY_MONITOR_TERMINAL_COMMANDS[commandIndex];
      terminal.innerHTML += `> ${command}<br>`;
      terminal.scrollTop = terminal.scrollHeight;
      commandIndex++;
    } else {
      // Start aggressive spamming with random content
      const randomCommands = [
        "ERROR: energy distribution unstable",
        "WARNING: power surge detected",
        "CRITICAL: energy efficiency failing",
        "ERROR: massive energy leak",
        "WARNING: energy conversion failing",
        "CRITICAL: energy storage overloaded",
        "ERROR: energy spike critical",
        "WARNING: energy flow disrupted",
        "CRITICAL: energy balance lost",
        "ERROR: energy resonance unstable",
        "WARNING: energy frequency shifting",
        "CRITICAL: energy catastrophe imminent",
        "ERROR: power management failed",
        "WARNING: energy containment breached",
        "CRITICAL: energy system override"
      ];
      
      const randomCommand = randomCommands[Math.floor(Math.random() * randomCommands.length)];
      terminal.innerHTML += `> ${randomCommand}<br>`;
      terminal.scrollTop = terminal.scrollHeight;
      
      // Keep only last 20 lines to prevent memory issues
      const lines = terminal.innerHTML.split('<br>');
      if (lines.length > 20) {
        terminal.innerHTML = lines.slice(-20).join('<br>');
      }
    }
  }, 120); // Much faster spamming
}

function showGravityAnalyzerTerminal() {
  // Create gravity analyzer terminal
  const terminal = document.createElement('div');
  terminal.id = 'gravityAnalyzerTerminal';
  terminal.style.cssText = `
    position: fixed;
    top: 220px;
    left: 20px;
    width: 280px;
    height: 180px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #ff6600;
    color: #ff6600;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    padding: 8px;
    overflow-y: hidden;
    z-index: 1000;
    border-radius: 5px;
  `;
  
  document.body.appendChild(terminal);
  
  // Start aggressive spamming with random content
  let commandIndex = 0;
  const gravityAnalyzerInterval = setInterval(() => {
    if (commandIndex < GRAVITY_ANALYZER_TERMINAL_COMMANDS.length) {
      const command = GRAVITY_ANALYZER_TERMINAL_COMMANDS[commandIndex];
      terminal.innerHTML += `> ${command}<br>`;
      terminal.scrollTop = terminal.scrollHeight;
      commandIndex++;
    } else {
      // Start aggressive spamming with random content
      const randomCommands = [
        "ERROR: gravitational field collapsing",
        "WARNING: singularity approaching",
        "CRITICAL: event horizon expanding",
        "ERROR: containment field failing",
        "WARNING: gravitational pull critical",
        "CRITICAL: system override detected",
        "ERROR: emergency protocols failed",
        "WARNING: reactor core exposed",
        "CRITICAL: blackhole formation imminent",
        "ERROR: all systems compromised"
      ];
      
      const randomCommand = randomCommands[Math.floor(Math.random() * randomCommands.length)];
      terminal.innerHTML += `> ${randomCommand}<br>`;
      terminal.scrollTop = terminal.scrollHeight;
      
      // Keep only last 20 lines to prevent memory issues
      const lines = terminal.innerHTML.split('<br>');
      if (lines.length > 20) {
        terminal.innerHTML = lines.slice(-20).join('<br>');
      }
    }
  }, 200); // Much faster spamming
}

function showSystemOverrideTerminal() {
  // Create system override terminal
  const terminal = document.createElement('div');
  terminal.id = 'systemOverrideTerminal';
  terminal.style.cssText = `
    position: fixed;
    top: 420px;
    left: 20px;
    width: 280px;
    height: 180px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #ff0000;
    color: #ff0000;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    padding: 8px;
    overflow-y: hidden;
    z-index: 1000;
    border-radius: 5px;
  `;
  
  document.body.appendChild(terminal);
  
  // Start aggressive spamming with random content
  let commandIndex = 0;
  const systemOverrideInterval = setInterval(() => {
    if (commandIndex < SYSTEM_OVERRIDE_TERMINAL_COMMANDS.length) {
      const command = SYSTEM_OVERRIDE_TERMINAL_COMMANDS[commandIndex];
      terminal.innerHTML += `> ${command}<br>`;
      terminal.scrollTop = terminal.scrollHeight;
      commandIndex++;
    } else {
      // Start aggressive spamming with random content
      const randomCommands = [
        "system_override:active",
        "bypassing safety protocols...",
        "WARNING: unauthorized access",
        "emergency protocols failed...",
        "system_override:escalating",
        "bypassing containment fields...",
        "WARNING: system compromised",
        "emergency shutdown failed...",
        "system_override:critical",
        "bypassing reactor controls...",
        "WARNING: critical failure",
        "emergency evacuation failed...",
        "system_override:catastrophic",
        "bypassing all safety systems...",
        "WARNING: total override",
        "emergency containment failed...",
        "system_override:terminal",
        "bypassing final protocols...",
        "WARNING: override complete",
        "emergency protocols offline..."
      ];
      
      const randomCommand = randomCommands[Math.floor(Math.random() * randomCommands.length)];
      terminal.innerHTML += `> ${randomCommand}<br>`;
      terminal.scrollTop = terminal.scrollHeight;
      
      // Keep only last 20 lines to prevent memory issues
      const lines = terminal.innerHTML.split('<br>');
      if (lines.length > 20) {
        terminal.innerHTML = lines.slice(-20).join('<br>');
      }
    }
  }, 150); // Even faster spamming
}

function hideTerminal() {
  if (!terminalVisible) return;
  terminalVisible = false;
  const terminal = document.getElementById('phase6Terminal');
  if (terminal) {
    terminal.remove();
  }
  if (terminalInterval) {
    clearInterval(terminalInterval);
    terminalInterval = null;
  }
}

function showPowerTerminal() {
  if (powerTerminalVisible) return;
  powerTerminalVisible = true;
  
  // Create power terminal element
  const powerTerminal = document.createElement('div');
  powerTerminal.id = 'phase7PowerTerminal';
  powerTerminal.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    width: 250px;
    height: 120px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #ff0000;
    color: #ff0000;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    padding: 10px;
    z-index: 1000;
    border-radius: 5px;
  `;
  
  document.body.appendChild(powerTerminal);
  
  // Update power readings
  const updatePower = () => {
    if (!powerTerminalVisible) return;
    const terminal = document.getElementById('phase7PowerTerminal');
    if (terminal) {
      terminal.innerHTML = `
        POWER SYSTEM STATUS<br>
        Input: ${powerInput}V<br>
        Output: ${Math.floor(powerOutput)}V<br>
        Status: CRITICAL<br>
        Stabilizers: ${Object.values(stabilizers).filter(s => s.status !== 'gray').length}/8
      `;
    }
    setTimeout(updatePower, 100);
  };
  
  updatePower();
}

function hidePowerTerminal() {
  if (!powerTerminalVisible) return;
  powerTerminalVisible = false;
  const terminal = document.getElementById('phase7PowerTerminal');
  if (terminal) {
    terminal.remove();
  }
}

function hideUIForPhase7() {
  // Hide title
  const title = document.querySelector('h1');
  if (title) title.style.display = 'none';
  
  // Hide all buttons except reset
  const buttons = document.querySelectorAll('#controls button');
  buttons.forEach(btn => {
    if (btn.id !== 'btnReset') {
      btn.style.display = 'none';
    }
  });
  
  // Hide meters
  const meters = document.getElementById('meters');
  if (meters) meters.style.display = 'none';
  
  // Hide shield indicator
  const shield = document.getElementById('shieldIndicator');
  if (shield) shield.style.display = 'none';
  
  // Hide restab div
  const restab = document.getElementById('restab');
  if (restab) restab.style.display = 'none';
  
  // Hide phase indicator
  const phase = document.getElementById('phase')?.closest('p');
  if (phase) phase.style.display = 'none';
}

function showUIAfterPhase7() {
  // Show title
  const title = document.querySelector('h1');
  if (title) title.style.display = 'block';
  
  // Show all buttons
  const buttons = document.querySelectorAll('#controls button');
  buttons.forEach(btn => {
    btn.style.display = 'inline-block';
  });
  
  // Show meters
  const meters = document.getElementById('meters');
  if (meters) meters.style.display = 'block';
  
  // Show phase indicator
  const phase = document.getElementById('phase')?.closest('p');
  if (phase) phase.style.display = 'block';
}

function showUIForPhase8() {
  // Show title
  const title = document.querySelector('h1');
  if (title) title.style.display = 'block';
  
  // Show all buttons
  const buttons = document.querySelectorAll('#controls button');
  buttons.forEach(btn => {
    btn.style.display = 'inline-block';
  });
  
  // Show meters
  const meters = document.getElementById('meters');
  if (meters) meters.style.display = 'block';
  
  // Show shield indicator
  const shield = document.getElementById('shieldIndicator');
  if (shield) shield.style.display = 'block';
  
  // Show restab div
  const restab = document.getElementById('restab');
  if (restab) restab.style.display = 'block';
  
  // Show phase indicator
  const phase = document.getElementById('phase')?.closest('p');
  if (phase) phase.style.display = 'block';
}

function startPhase8BSODSequence() {
  debugLog("FRONTEND: startPhase8BSODSequence called");
  clearPhase8Timers();
  // Stop phase 7 audio but keep phase 8 music ready
  if (stabilizerAudio) { stabilizerAudio.pause(); stabilizerAudio = null; }
  if (alarm7Audio) { alarm7Audio.pause(); alarm7Audio = null; }
  
  // Create BSOD overlay
  const bsod = document.createElement('div');
  bsod.id = 'phase8BSOD';
  bsod.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #0000ff;
    color: #ffffff;
    font-family: 'Courier New', monospace;
    font-size: 16px;
    z-index: 20000;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    line-height: 1.5;
  `;
  
  bsod.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 20px;">TCR CORE SYSTEM FAILURE</div>
    <div>Error Code: 0x${Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase()}</div>
    <div>TOASTER_CORE_REACTOR_CRITICAL_FAILURE</div>
    <br>
    <div>Stabilizer Matrix: DESTROYED</div>
    <div>Containment Field: BREACHED</div>
    <div>Blackhole Formation: IMMINENT</div>
    <br>
    <div>Attempting emergency protocols...</div>
    <div>Loading Phase 8 containment...</div>
    <br>
    <div>Press RESET to restart system</div>
  `;
  
  document.body.appendChild(bsod);
  
  // Play BSOD sound
  const bsodAudio = new Audio("audio/bsod.ogg");
  bsodAudio.volume = 0.7;
  bsodAudio.play().catch(() => {});
  
  // After 3 seconds, show loading GIF
  schedulePhase8Timer(() => {
    showPostBSODLoading();
  }, 3000);
}

function showPostBSODLoading() {
  // Hide BSOD
  const bsod = document.getElementById('phase8BSOD');
  if (bsod) {
    bsod.style.display = 'none';
  }
  
  // Create loading GIF overlay
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'postBSODLoading';
  loadingOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #000;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Create GIF element
  const loadingGif = document.createElement('img');
  loadingGif.src = 'visuals/post_boot_loading_after_bsod.gif';
  loadingGif.style.cssText = `
    width: 100%;
    height: 100%;
    object-fit: cover;
  `;
  
  loadingOverlay.appendChild(loadingGif);
  document.body.appendChild(loadingOverlay);
  
  // After 4 seconds, show terminal
  schedulePhase8Timer(() => {
    showPhase8Terminal();
  }, 4000);
}

function showPhase8Terminal() {
  // Hide loading overlay
  const loadingOverlay = document.getElementById('postBSODLoading');
  if (loadingOverlay) {
    loadingOverlay.remove();
  }
  
  // Show terminal
  const bsod = document.getElementById('phase8BSOD');
  if (!bsod) return;
  
  bsod.style.display = 'block';
  bsod.innerHTML = `
    <div style="font-size: 18px; margin-bottom: 30px;">TCR CORE DIAGNOSTIC TERMINAL</div>
    <div style="text-align: left; margin: 20px; font-family: 'Courier New', monospace;">
      <div>Initializing emergency protocols...</div>
      <div>Loading blackhole containment matrix...</div>
      <div>ERROR: Containment field offline</div>
      <div>ERROR: Stabilizer matrix destroyed</div>
      <div>ERROR: Reactor core unstable</div>
      <br>
      <div>Core Status: CRITICAL</div>
      <div>Radiation Level: MAXIMUM</div>
      <div>Pressure: CRITICAL</div>
      <div>Temperature: EXTREME</div>
      <br>
      <div>Error Codes:</div>
      <div id="errorCodes" style="color: #ff0000;"></div>
      <br>
      <div>Attempting blackhole containment...</div>
      <div>Phase 8 protocols: ACTIVE</div>
    </div>
  `;
  
  // Start error code spam
  startErrorCodeSpam();
  
  // After 5 seconds, minimize terminal and start blackhole
  schedulePhase8Timer(() => {
    // Play terminal death sound
    const terminalDeathAudio = new Audio("audio/terminal_died.mp3");
    terminalDeathAudio.volume = 0.7;
    terminalDeathAudio.play().catch(() => {});
    
    minimizeTerminalAndStartBlackhole();
  }, 5000);
}

function minimizeTerminalAndStartBlackhole() {
  // Get the terminal
  const terminal = document.getElementById('phase8BSOD');
  if (!terminal) return;
  
  // Minimize terminal to small floating window
  terminal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    width: 300px;
    height: 200px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #00ff00;
    border-radius: 8px;
    color: #00ff00;
    font-family: 'Courier New', monospace;
    font-size: 10px;
    padding: 10px;
    z-index: 10001;
    transform: translate(-50%, -50%);
    overflow: hidden;
    resize: both;
    min-width: 200px;
    min-height: 100px;
  `;
  
  // Update terminal content for minimized view
  terminal.innerHTML = `
    <div style="font-size: 12px; margin-bottom: 10px; color: #ff0000;">TCR TERMINAL</div>
    <div id="minimizedErrorCodes" style="font-size: 8px; line-height: 1.2; max-height: 150px; overflow-y: auto;">
      <div>ERROR: 0x92394 - Spacetime distortion</div>
      <div>ERROR: 0x7F8A2 - Quantum field collapse</div>
      <div>ERROR: 0x3B1C9 - Gravitational anomaly</div>
    </div>
  `;
  
  // Start blackhole sequence
  startPhase8Sequence();
  
  // Continue error spam in minimized terminal
  startMinimizedErrorSpam();
}

function startMinimizedErrorSpam() {
  const errorCodesEl = document.getElementById('minimizedErrorCodes');
  if (!errorCodesEl) return;
  
  const errorInterval = setInterval(() => {
    if (!phase8Active) {
      clearInterval(errorInterval);
      return;
    }
    
    const errorCode = `0x${Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0')}`;
    const errorType = ['Spacetime distortion', 'Quantum field collapse', 'Gravitational anomaly', 'Matter compression', 'Event horizon breach'][Math.floor(Math.random() * 5)];
    const color = Math.random() > 0.5 ? '#ff0000' : '#00ff00';
    
    const errorDiv = document.createElement('div');
    errorDiv.style.color = color;
    errorDiv.textContent = `ERROR: ${errorCode} - ${errorType}`;
    
    errorCodesEl.appendChild(errorDiv);
    
    // Keep only last 20 errors
    while (errorCodesEl.children.length > 20) {
      errorCodesEl.removeChild(errorCodesEl.firstChild);
    }
    
    // Auto-scroll to bottom
    errorCodesEl.scrollTop = errorCodesEl.scrollHeight;
  }, 1000 + Math.random() * 2000);
}

function startErrorCodeSpam() {
  const errorCodesEl = document.getElementById('errorCodes');
  if (!errorCodesEl) return;
  
  const errorCodes = [
    '0x92394', '0x7A1B2', '0x4F8C3', '0x2E9D1', '0x6B5A7',
    '0x1C8F4', '0x9E2A6', '0x3D7B9', '0x5F1C8', '0x8A4E2'
  ];
  
  let errorIndex = 0;
  const errorInterval = setInterval(() => {
    if (!errorCodesEl) {
      clearInterval(errorInterval);
      return;
    }
    
    const errorCode = errorCodes[errorIndex % errorCodes.length];
    const color = Math.random() > 0.5 ? '#ff0000' : '#00ff00';
    
    errorCodesEl.innerHTML += `<div style="color: ${color};">ERROR: ${errorCode}</div>`;
    errorCodesEl.scrollTop = errorCodesEl.scrollHeight;
    
    errorIndex++;
  }, 200);
  
  // Store interval for cleanup
  window.phase8ErrorInterval = errorInterval;
}

function hidePhase8BSOD() {
  const bsod = document.getElementById('phase8BSOD');
  if (bsod) {
    bsod.remove();
  }
  
  // Clear error spam interval
  if (window.phase8ErrorInterval) {
    clearInterval(window.phase8ErrorInterval);
    window.phase8ErrorInterval = null;
  }
}

function showBSOD() {
  if (bsodVisible) return;
  bsodVisible = true;
  
  // Stop all audio and clear all event handlers
  if (phaseAudio) { 
    phaseAudio.pause(); 
    phaseAudio.onended = null; // Clear any lingering event handlers
    phaseAudio = null; 
  }
  if (stabilizerAudio) { stabilizerAudio.pause(); stabilizerAudio = null; }
  if (alarm7Audio) { alarm7Audio.pause(); alarm7Audio = null; }
  
  // Create BSOD overlay
  const bsod = document.createElement('div');
  bsod.id = 'bsodScreen';
  bsod.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #0000ff;
    color: #ffffff;
    font-family: 'Courier New', monospace;
    font-size: 16px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    line-height: 1.5;
  `;
  
  bsod.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 20px;">CRITICAL SYSTEM FAILURE</div>
    <div>Error Code: 0x0000007E</div>
    <div>SYSTEM_THREAD_EXCEPTION_NOT_HANDLED</div>
    <br>
    <div>Toaster Reactor Core has stopped responding</div>
    <div>Stabilizer Matrix: FAILED</div>
    <div>Containment Field: BREACHED</div>
    <br>
    <div>Disconnected from Camera 2</div>
    <div>Attempting reconnection...</div>
    <br>
    <div>Press RESET to restart system</div>
  `;
  
  document.body.appendChild(bsod);
  
  // Play BSOD sound
  const bsodAudio = new Audio("audio/bsod.ogg");
  bsodAudio.volume = 0.7;
  bsodAudio.play();
  
  // After 5 seconds, show boot menu
  setTimeout(() => {
    showBootMenu();
  }, 5000);
}

function showBootMenu() {
  if (bootMenuVisible) return;
  bootMenuVisible = true;
  
  const bsod = document.getElementById('bsodScreen');
  if (bsod) {
    bsod.innerHTML = `
      <div style="font-size: 18px; margin-bottom: 30px;">TOASTER REACTOR SYSTEM BOOT</div>
      <div style="text-align: left; margin: 20px;">
        <div>Initializing core systems...</div>
        <div>Loading stabilizer protocols...</div>
        <div>Checking containment field...</div>
        <div>ERROR: Containment field offline</div>
        <div>ERROR: Stabilizer matrix destroyed</div>
        <div>ERROR: Reactor core unstable</div>
        <br>
        <div>Attempting emergency protocols...</div>
        <div>Loading Phase 8 protocols...</div>
        <div>BLACKHOLE CONTAINMENT INITIATED</div>
        <br>
        <div>Camera 2 reconnected</div>
        <div>System ready</div>
      </div>
    `;
  }
  
  // After 3 seconds, hide BSOD and start Phase 8
  setTimeout(() => {
    hideBSOD();
    startPhase8Sequence();
  }, 3000);
}

function hideBSOD() {
  const bsod = document.getElementById('bsodScreen');
  if (bsod) {
    bsod.remove();
  }
  bsodVisible = false;
  bootMenuVisible = false;
}

function createChaosTerminal(brokenStabilizer, totalBroken) {
  // Create multiple terminals for more chaos
  const numTerminals = Math.min(3 + totalBroken, 6); // More terminals as more stabilizers break
  
  for (let i = 0; i < numTerminals; i++) {
  terminalCounter++;
    const terminalData = CHAOS_TERMINAL_DATA[Math.min(totalBroken - 1 + i, CHAOS_TERMINAL_DATA.length - 1)];
  
    // Random position on screen with better distribution
  const x = Math.random() * (window.innerWidth - 350);
  const y = Math.random() * (window.innerHeight - 200);
  
  const terminal = document.createElement('div');
  terminal.id = `chaosTerminal${terminalCounter}`;
  terminal.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
      width: 320px;
      height: 200px;
      background: rgba(0, 0, 0, 0.95);
    border: 2px solid #ff0000;
    color: #ff0000;
    font-family: 'Courier New', monospace;
      font-size: 11px;
      padding: 12px;
    overflow-y: auto;
    z-index: 1000;
    border-radius: 5px;
      box-shadow: 0 0 25px rgba(255, 0, 0, 0.7);
  `;
  
  terminal.innerHTML = `
      <div style="font-size: 13px; margin-bottom: 8px; text-align: center; color: #ff4444;">
      ${terminalData.title}
    </div>
      <div style="color: #ff6666; margin-bottom: 5px; font-size: 10px;">
        Stabilizer ${brokenStabilizer}: OFFLINE | TCR Status: CRITICAL
    </div>
      <div style="color: #ffaaaa; line-height: 1.2;">
      ${terminalData.messages.map(msg => `${msg}<br>`).join('')}
    </div>
      <div style="color: #ff0000; margin-top: 5px; font-size: 9px;">
        ERROR: ${Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase()}
      </div>
  `;
  
  document.body.appendChild(terminal);
  chaosTerminals.push(terminal);
  
    // Make terminal float and shake more aggressively
  let shakeX = 0;
  let shakeY = 0;
  let shakeInterval = setInterval(() => {
      shakeX = (Math.random() - 0.5) * 6;
      shakeY = (Math.random() - 0.5) * 6;
    terminal.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
    }, 80);
    
    // Add pulsing effect
    let pulseInterval = setInterval(() => {
      const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
      terminal.style.boxShadow = `0 0 ${20 + pulse * 10}px rgba(255, 0, 0, ${0.5 + pulse * 0.3})`;
    }, 50);
    
    // Remove terminal after 20 seconds (longer for more chaos)
  setTimeout(() => {
    clearInterval(shakeInterval);
      clearInterval(pulseInterval);
    terminal.remove();
    const index = chaosTerminals.indexOf(terminal);
    if (index > -1) {
      chaosTerminals.splice(index, 1);
    }
    }, 20000);
  }
}

function createFloatingElements() {
  floatingElements = [];

  const targetSelectors = [
    "h1",
    "#meters",
    "#controls button",
    "#shieldIndicator",
    "#errorBanner",
    "#restab",
    "#phase8BSOD"
  ];

  const elements = [];
  targetSelectors.forEach(selector => {
    const found = document.querySelectorAll(selector);
    found.forEach(el => {
      // Avoid duplicates
      if (!elements.includes(el)) {
        elements.push(el);
      }
    });
  });

  elements.forEach((el, index) => {
    if (el.id === 'bsodScreen' || 
        el.id === 'phase6Terminal' || 
        el.id === 'phase7PowerTerminal' ||
        el.id === 'freeFloatingBlackhole' ||
        el.id === 'phase8ErrorNotifications' ||
        el.id === 'postBSODLoading' ||
        el.id === 'phase7Notifications' ||
        el.id === 'caseIntegrityHealthBar' ||
        el.id === 'whiteFlashOverlay' ||
        el.id === 'phaseTransitionExplosion' ||
        el.className === 'spinning-phase-element' ||
        el.tagName === 'SCRIPT' ||
        el.tagName === 'STYLE' ||
        el.tagName === 'META' ||
        el.tagName === 'TITLE' ||
        el.tagName === 'LINK') {
      return;
    }

    const rect = el.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(el);

    if (rect.width < 20 || rect.height < 20 || 
        rect.width > window.innerWidth * 0.6 || 
        rect.height > window.innerHeight * 0.6 ||
        computedStyle.display === 'none' ||
        computedStyle.visibility === 'hidden' ||
        computedStyle.opacity === '0') {
      return;
    }

    const blackholeX = window.innerWidth / 2;
    const blackholeY = window.innerHeight / 2;
    const baseRadius = 180 + (index % 4) * 110;
    const angle = (index / Math.max(elements.length, 1)) * Math.PI * 2 + Math.random() * 0.2;
    const x = blackholeX + Math.cos(angle) * baseRadius - rect.width / 2;
    const y = blackholeY + Math.sin(angle) * baseRadius - rect.height / 2;

    floatingElements.push({
      element: el,
      originalX: rect.left,
      originalY: rect.top,
      x: x,
      y: y,
      width: rect.width,
      height: rect.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.06,
      isTerminal: el.id === 'phase8BSOD',
      elementType: el.tagName.toLowerCase(),
      originalDisplay: computedStyle.display,
      originalPosition: computedStyle.position,
      originalTransform: el.style.transform
    });

    el.style.position = 'fixed';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.zIndex = String(FLOATING_ELEMENT_Z_INDEX);
    el.style.pointerEvents = 'none';
    el.style.transition = 'none';
    el.style.opacity = '1';
    el.style.willChange = 'transform, left, top';

    if (el.tagName.toLowerCase() === 'button') {
      el.style.boxShadow = '0 0 12px rgba(255, 255, 255, 0.15)';
      el.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    } else if (el.tagName.toLowerCase() === 'canvas') {
      el.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    }
  });

  createAdditionalSpinningElements();
}

function triggerWhiteFlash() {
  if (whiteFlashActive) return; // Prevent overlapping flashes
  
  whiteFlashActive = true;
  
  // Create white flash overlay
  const flashOverlay = document.createElement('div');
  flashOverlay.id = 'whiteFlashOverlay';
  flashOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: white;
    z-index: 999999;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.1s ease-in-out;
  `;
  document.body.appendChild(flashOverlay);
  
  // Random number of flashes (1 or 2)
  const flashCount = Math.random() < 0.5 ? 1 : 2;
  
  // Random thunder sound
  const thunderSounds = [ALARMS.thunder1, ALARMS.thunder2, ALARMS.thunder3];
  const randomThunder = thunderSounds[Math.floor(Math.random() * thunderSounds.length)];
  
  // Play thunder sound
  const thunderAudio = new Audio(randomThunder);
  thunderAudio.volume = 0.7;
  thunderAudio.play();
  
  // Flash sequence
  let currentFlash = 0;
  
  function doFlash() {
    if (currentFlash >= flashCount) {
      // End flash sequence
      flashOverlay.style.opacity = '0';
      setTimeout(() => {
        if (flashOverlay.parentNode) {
          flashOverlay.parentNode.removeChild(flashOverlay);
        }
        whiteFlashActive = false;
      }, 100);
      return;
    }
    
    // Flash on
    flashOverlay.style.opacity = '1';
    
    // Flash off after short duration
    setTimeout(() => {
      flashOverlay.style.opacity = '0';
      currentFlash++;
      
      // Next flash after short delay
      setTimeout(() => {
        doFlash();
      }, 100 + Math.random() * 200);
    }, 50 + Math.random() * 100);
  }
  
  // Start flash sequence
  doFlash();
}

function triggerPhaseTransitionExplosion() {
  if (whiteFlashActive) return; // Prevent overlapping flashes
  
  whiteFlashActive = true;
  
  // Create white flash overlay for phase transition
  const flashOverlay = document.createElement('div');
  flashOverlay.id = 'phaseTransitionFlash';
  flashOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: white;
    z-index: 999999;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.1s ease-in-out;
  `;
  document.body.appendChild(flashOverlay);
  
  // Play internal explosion sound for phase transition
  const explosionAudio = new Audio(ALARMS.internalExplosion);
  explosionAudio.volume = 0.6;
  explosionAudio.play();
  
  // Flash sequence for phase transition (2 flashes)
  let currentFlash = 0;
  const flashCount = 2;
  
  function doFlash() {
    if (currentFlash >= flashCount) {
      // End flash sequence
      flashOverlay.style.opacity = '0';
      setTimeout(() => {
        if (flashOverlay.parentNode) {
          flashOverlay.parentNode.removeChild(flashOverlay);
        }
        whiteFlashActive = false;
      }, 100);
      return;
    }
    
    // Flash on
    flashOverlay.style.opacity = '1';
    
    // Flash off after short duration
    setTimeout(() => {
      flashOverlay.style.opacity = '0';
      currentFlash++;
      
      // Next flash after short delay
      setTimeout(() => {
        doFlash();
      }, 200);
    }, 100);
  }
  
  // Start flash sequence
  doFlash();
}

function createAdditionalSpinningElements() {
  const phaseTexts = [
    "PHASE 1", "PHASE 2", "PHASE 3", "PHASE 4", "PHASE 5", 
    "PHASE 6", "PHASE 7", "PHASE 8", "RESTABILIZATION",
    "HEAT COILS", "COOLANT PUMP", "SHIELD TOGGLE", "IGNITION",
    "RADIATION", "COOKNESS", "HEAT", "PRESSURE",
    "CRITICAL", "WARNING", "ERROR", "SYSTEM FAILURE",
    "NUCLEAR", "REACTOR", "CONTAINMENT", "BREACH",
    "MELTDOWN", "EXPLOSION", "DESTRUCTION", "CHAOS",
    "BLACKHOLE", "SINGULARITY", "SPACETIME", "GRAVITY",
    "QUANTUM", "FIELD", "COLLAPSE", "ANOMALY"
  ];
  
  const colors = [
    '#ff0000', '#ff6600', '#ffaa00', '#ffff00', '#aaff00',
    '#00ff00', '#00ffaa', '#00ffff', '#00aaff', '#0066ff',
    '#0000ff', '#6600ff', '#aa00ff', '#ff00ff', '#ff00aa',
    '#ffffff', '#ffaaaa', '#aaffaa', '#aaaaff', '#ffffaa'
  ];

  for (let i = 0; i < PHASE8_EXTRA_SPINNERS; i++) {
    const div = document.createElement('div');
    div.className = 'spinning-phase-element';
    div.textContent = phaseTexts[i % phaseTexts.length];

    const blackholeX = window.innerWidth / 2;
    const blackholeY = window.innerHeight / 2;
    const ringRadius = 280 + (i % 3) * 120;
    const angle = (i / PHASE8_EXTRA_SPINNERS) * Math.PI * 2 + Math.random() * 0.15;
    const x = blackholeX + Math.cos(angle) * ringRadius;
    const y = blackholeY + Math.sin(angle) * ringRadius;

    div.style.cssText = `
      position: fixed;
      color: #ffffff;
      font-weight: 700;
      font-size: ${20 + Math.random() * 10}px;
      text-shadow: 0 0 10px currentColor;
      pointer-events: none;
      z-index: ${FLOATING_ELEMENT_Z_INDEX};
      white-space: nowrap;
      opacity: 1;
      border: 2px solid ${colors[i % colors.length]};
      padding: 10px 14px;
      border-radius: 12px;
      background: rgba(12, 10, 24, 0.78);
      box-shadow: 0 0 14px ${colors[i % colors.length]};
    `;

    document.body.appendChild(div);
    const rect = div.getBoundingClientRect();

    floatingElements.push({
      element: div,
      originalX: x,
      originalY: y,
      x: x,
      y: y,
      width: rect.width,
      height: rect.height,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.03,
      isTerminal: false,
      elementType: 'spinning-text'
    });

    div.style.left = x + 'px';
    div.style.top = y + 'px';
    div.style.willChange = 'transform, left, top';
  }
}

function updateFloatingElements() {
  const screenBlackholeX = window.innerWidth / 2;
  const screenBlackholeY = window.innerHeight / 2;
  const now = Date.now();

  for (let index = floatingElements.length - 1; index >= 0; index -= 1) {
    const floating = floatingElements[index];
    const el = floating.element;

    if (!el || !el.isConnected) {
      floatingElements.splice(index, 1);
      continue;
    }

    const { width, height } = captureFloatingSize(floating, el);
    const dx = screenBlackholeX - floating.x;
    const dy = screenBlackholeY - floating.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    if (distance > 0) {
      const targetRadius = blackholeSize + 140 + (index % 4) * 110 + Math.sin(now * 0.0004 + index) * 18;

      if (distance < targetRadius * 0.82) {
        const pushForce = (targetRadius * 0.82 - distance) * 0.08;
        floating.vx -= Math.cos(angle) * pushForce;
        floating.vy -= Math.sin(angle) * pushForce;
      } else if (distance > targetRadius * 1.18) {
        const pullForce = (distance - targetRadius * 1.18) * 0.04;
        floating.vx += Math.cos(angle) * pullForce;
        floating.vy += Math.sin(angle) * pullForce;
      }

      const spinSpeed = 0.55 + Math.sin(now * 0.0008 + index) * 0.18;
      const perpendicularAngle = angle + Math.PI / 2;
      floating.vx += Math.cos(perpendicularAngle) * spinSpeed * 0.07;
      floating.vy += Math.sin(perpendicularAngle) * spinSpeed * 0.07;
      floating.vx += (Math.random() - 0.5) * 0.03;
      floating.vy += (Math.random() - 0.5) * 0.03;
      floating.vx *= 0.97;
      floating.vy *= 0.97;
    }

    floating.x += floating.vx;
    floating.y += floating.vy;

    const maxX = Math.max(FLOATING_VIEWPORT_PADDING, window.innerWidth - width - FLOATING_VIEWPORT_PADDING);
    const maxY = Math.max(FLOATING_VIEWPORT_PADDING, window.innerHeight - height - FLOATING_VIEWPORT_PADDING);
    floating.x = Math.max(FLOATING_VIEWPORT_PADDING, Math.min(maxX, floating.x));
    floating.y = Math.max(FLOATING_VIEWPORT_PADDING, Math.min(maxY, floating.y));

    el.style.left = floating.x + 'px';
    el.style.top = floating.y + 'px';

    floating.rotation += floating.rotationSpeed;
    const pulseScale = 1 + Math.sin(now * 0.002 + index) * 0.04;
    const stretchX = 1 + Math.max(0, 1 - (distance / 700)) * 0.08;
    const stretchY = 1 - Math.max(0, 1 - (distance / 700)) * 0.04;
    el.style.transform = `translateZ(0) rotate(${(floating.rotation * 180) / Math.PI}deg) scale(${pulseScale * stretchX}, ${pulseScale * stretchY})`;
    el.style.opacity = '1';
  }
}

function startPhase8Sequence() {
  debugLog("FRONTEND: startPhase8Sequence called");
  clearPhase8Timers();
  
  // Trigger phase transition explosion with white flash
  triggerPhaseTransitionExplosion();
  
  phase8Active = true;
  phase8StartTime = Date.now();
  
  // Add phase8-active class to body for CSS styling
  document.body.classList.add('phase8-active');
  
  // Show UI elements for phase 8 (they were hidden in phase 7)
  showUIForPhase8();
  
  // Reset white fade variables
  whiteFadeAmount = 0;
  whiteFadeStartTime = 0;
  explosionSoundPlayed = false;
  overloadEndPlayed = false;
  demboomPlayed = false;
  criticalPhaseStarted = false;
  if (overloadLoopAudio) {
    overloadLoopAudio.pause();
    overloadLoopAudio = null;
  }
  
  // Initialize blackhole position to center of screen
  blackholeX = window.innerWidth / 2;
  blackholeY = window.innerHeight / 2;
  blackholeVX = 0;
  blackholeVY = 0;
  
  
  if (phase8AnimationId) {
    cancelAnimationFrame(phase8AnimationId);
  }
  phase8AnimationId = requestAnimationFrame(phase8Loop);
  
  // Hide the canvas and make blackhole free-floating
  const canvas = document.getElementById("toasterCanvas");
  if (canvas) {
    canvas.style.display = 'none';
    canvas.style.visibility = 'hidden';
    canvas.style.position = 'absolute';
    canvas.style.left = '-9999px';
    canvas.style.top = '-9999px';
    canvas.style.zIndex = '-1';
  }
  
  // Stop Phase 7 shake immediately when Phase 8 starts
  stopPhase7PageShake();
  stopPhase7TerminalKills();
  
  // Hide all terminals from previous phases to prevent stuck terminals
  const terminalsToHide = [
    'phase6Terminal', 'stabilizerTerminal', 'caseIntegrityTerminal',
    'coreActivityTerminal', 'quantumAnalysisTerminal', 'dimensionalScannerTerminal',
    'energyMonitorTerminal', 'gravityAnalyzerTerminal', 'systemOverrideTerminal',
    'phase7PowerTerminal'
  ];
  
  terminalsToHide.forEach(terminalId => {
    const terminal = document.getElementById(terminalId);
    if (terminal) {
      terminal.style.display = 'none';
      debugLog(`Hiding terminal: ${terminalId}`);
    }
  });
  
  // Also remove any remaining terminal elements completely
  terminalsToHide.forEach(terminalId => {
    const terminal = document.getElementById(terminalId);
    if (terminal && terminal.parentNode) {
      terminal.parentNode.removeChild(terminal);
      debugLog(`Removed terminal: ${terminalId}`);
    }
  });
  
  // Remove any elements that might be stuck near the blackhole
  const stuckElements = document.querySelectorAll('[id*="terminal"], [class*="terminal"], [id*="Terminal"], [class*="Terminal"]');
  stuckElements.forEach(el => {
    if (el.id !== 'phase8BSOD' && el.parentNode) {
      el.parentNode.removeChild(el);
      debugLog(`Removed stuck element: ${el.tagName} (${el.id || 'no-id'})`);
    }
  });
  
  // Kill the existing phase8BSOD and recreate it as a floating element
  const existingBSOD = document.getElementById('phase8BSOD');
  if (existingBSOD) {
    existingBSOD.remove();
    debugLog('Removed existing phase8BSOD');
  }
  
  // Create a new phase8BSOD that will float around the blackhole
  const newBSOD = document.createElement('div');
  newBSOD.id = 'phase8BSOD';
  newBSOD.innerHTML = `
    <div style="font-size: 12px; margin-bottom: 10px; color: #ff0000;">TCR TERMINAL</div>
    <div id="minimizedErrorCodes" style="font-size: 8px; line-height: 1.2; max-height: 150px; overflow-y: auto;">
      <div>ERROR: 0x7F8A2 - Quantum field collapse</div>
      <div>ERROR: 0x3B1C9 - Gravitational anomaly</div>
      <div style="color: rgb(0, 255, 0);">ERROR: 0xA01FA4 - Matter compression</div>
      <div style="color: rgb(0, 255, 0);">ERROR: 0x3AAA1F - Event horizon breach</div>
      <div style="color: rgb(255, 0, 0);">ERROR: 0x1BE0CA - Matter compression</div>
      <div style="color: rgb(0, 255, 0);">ERROR: 0xB83931 - Event horizon breach</div>
      <div style="color: rgb(255, 0, 0);">ERROR: 0x1B3DDE - Spacetime distortion</div>
      <div style="color: rgb(0, 255, 0);">ERROR: 0x146FAB - Matter compression</div>
      <div style="color: rgb(0, 255, 0);">ERROR: 0x088465 - Event horizon breach</div>
      <div style="color: rgb(255, 0, 0);">ERROR: 0xA3D51E - Event horizon breach</div>
      <div style="color: rgb(0, 255, 0);">ERROR: 0x6D84F6 - Quantum field collapse</div>
      <div style="color: rgb(0, 255, 0);">ERROR: 0x0EC12F - Spacetime distortion</div>
      <div style="color: rgb(255, 0, 0);">ERROR: 0xEC8033 - Spacetime distortion</div>
      <div style="color: rgb(0, 255, 0);">ERROR: 0x7163DC - Gravitational anomaly</div>
      <div style="color: rgb(0, 255, 0);">ERROR: 0x5214B3 - Gravitational anomaly</div>
      <div style="color: rgb(255, 0, 0);">ERROR: 0xF9E96C - Event horizon breach</div>
      <div style="color: rgb(0, 255, 0);">ERROR: 0x07A873 - Quantum field collapse</div>
      <div style="color: rgb(255, 0, 0);">ERROR: 0xB3B9E2 - Quantum field collapse</div>
      <div style="color: rgb(255, 0, 0);">ERROR: 0xD3DB06 - Gravitational anomaly</div>
      <div style="color: rgb(255, 0, 0);">ERROR: 0xF76B37 - Gravitational anomaly</div>
    </div>
  `;
  
  // Style it to be visible and floating
  newBSOD.style.cssText = `
    position: fixed;
    width: 300px;
    height: 200px;
    background: rgba(0, 0, 0, 0.9);
    border: 4px solid #ff00ff;
    border-radius: 8px;
    color: #00ff00;
    font-family: "Courier New", monospace;
    font-size: 10px;
    padding: 10px;
    z-index: 10001;
    overflow: hidden;
    resize: both;
    min-width: 200px;
    min-height: 100px;
    opacity: 1;
    box-shadow: 0 0 40px #ff00ff, 0 0 80px #ff00ff;
  `;
  
  document.body.appendChild(newBSOD);
  debugLog('Created new phase8BSOD that will float around the blackhole');
  
  // Create free-floating blackhole canvas
  createFreeFloatingBlackhole();
  
  // Create floating elements AFTER blackhole is created (with small delay)
  schedulePhase8Timer(() => {
    createFloatingElements();
    createAdditionalFloatingElements();
  }, 100);
  schedulePhase8Timer(() => {
    startBlackholeStatusTerminals();
  }, 10000);
  
  // Start phase 8 error notifications
  startPhase8ErrorNotifications();
  
  // Play Phase 8 music
  debugLog("FRONTEND: Playing phase 8 music");
  playPhaseMusic(8);
}

function stopPhase8Sequence() {
  phase8Active = false;
  clearPhase8Timers();
  
  // Remove phase8-active class from body
  document.body.classList.remove('phase8-active');
  
  if (phase8AnimationId) {
    cancelAnimationFrame(phase8AnimationId);
    phase8AnimationId = null;
  }
  
  // Reset floating elements to normal positions
  floatingElements.forEach(floating => {
    if (floating.element.className === 'spinning-phase-element') {
      // Remove additional spinning elements
      floating.element.remove();
    } else {
      // Reset original elements
      floating.element.style.position = '';
      floating.element.style.left = '';
      floating.element.style.top = '';
      floating.element.style.transform = '';
      floating.element.style.zIndex = '';
      floating.element.style.opacity = '1';
      floating.element.style.pointerEvents = '';
      floating.element.style.filter = '';
      floating.element.style.transition = '';
      floating.element.style.boxShadow = '';
      floating.element.style.border = '';
      floating.element.style.willChange = '';
    }
  });
  floatingElements = [];
  
  // Remove free-floating blackhole canvas
  const blackholeCanvas = document.getElementById('freeFloatingBlackhole');
  if (blackholeCanvas) {
    blackholeCanvas.remove();
  }
  
  // Show the original canvas again
  const canvas = document.getElementById("toasterCanvas");
  if (canvas) {
    canvas.style.display = 'block';
    canvas.style.visibility = 'visible';
    canvas.style.position = '';
    canvas.style.left = '';
    canvas.style.top = '';
    canvas.style.zIndex = '';
  }
  
  // Clear references
  window.blackholeCanvas = null;
  window.blackholeCtx = null;
  
  // Stop phase 8 error notifications
  stopPhase8ErrorNotifications();
  
  // Stop Phase 7 page shake
  stopPhase7PageShake();
  
  // Stop Phase 7 terminal kills
  stopPhase7TerminalKills();
  
  
  // Remove phase8BSOD terminal if it exists
  const phase8BSOD = document.getElementById('phase8BSOD');
  if (phase8BSOD) {
    phase8BSOD.remove();
  }
  
  // Remove postBSODLoading if it exists
  const postBSODLoading = document.getElementById('postBSODLoading');
  if (postBSODLoading) {
    postBSODLoading.remove();
  }
}

function phase8Loop() {
  if (!phase8Active) return;
  
  const now = Date.now();
  const timeElapsed = (now - phase8StartTime) / 1000;
  
  // Update shader intensity progressively (starts at 30 seconds)
  if (timeElapsed > 30) {
    shaderIntensity = Math.min(1, (timeElapsed - 30) / 60); // Ramp up over 60 seconds
  }
  
  // Update blackhole size and intensity over time
  blackholeSize = Math.min(200, 10 + timeElapsed * 2); // Grow from 10 to 200 over time
  blackholeIntensity = Math.min(1, timeElapsed / 30); // Ramp up intensity over 30 seconds
  
  // Start critical phase at 60 seconds (115 seconds before explosion)
  if (timeElapsed >= 60 && !criticalPhaseStarted) {
    criticalPhaseStarted = true;
    // Start overload loop
    overloadLoopAudio = new Audio(ALARMS.overloadLoop);
    overloadLoopAudio.volume = 0.6;
    overloadLoopAudio.loop = true;
    overloadLoopAudio.play();
  }
  
  // Stop overload loop and play overload_end at 116.5 seconds (20 seconds earlier)
  if (timeElapsed >= 116.5 && overloadLoopAudio && !overloadEndPlayed) {
    overloadEndPlayed = true;
    // Stop overload loop gracefully
    overloadLoopAudio.pause();
    overloadLoopAudio.currentTime = 0;
    
    // Play overload_end immediately
    const overloadEndAudio = new Audio(ALARMS.overloadEnd);
    overloadEndAudio.volume = 0.6;
    overloadEndAudio.play();
    
    // When overload_end finishes, play demboom immediately
    overloadEndAudio.onended = () => {
      if (!demboomPlayed) {
        demboomPlayed = true;
        const demboomAudio = new Audio(ALARMS.demboom);
        demboomAudio.volume = 0.8;
        demboomAudio.play();
      }
    };
  }
  
  // demboom.ogg is now the final sound (no internal explosion)
  
  // Update floating elements and check for absorption
  updateFloatingElements();
  
  // Draw blackhole
  drawBlackhole();
  
  // Check for explosion after 2:55 (175 seconds)
  if (timeElapsed >= 175) {
    triggerBlackholeExplosion();
    return;
  }
  
  phase8AnimationId = requestAnimationFrame(phase8Loop);
}

function drawBlackhole() {
  const canvas = window.blackholeCanvas;
  const ctx = canvas.getContext("2d");
  
  if (!canvas || !ctx) return;
  
  // Keep blackhole in center
  blackholeX = canvas.width / 2;
  blackholeY = canvas.height / 2;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw the blackhole with all effects
    drawBlackhole2D();
  
  // Elements now orbit around blackhole instead of being absorbed
}


function drawBlackhole2D() {
  const canvas = window.blackholeCanvas;
  const ctx = canvas.getContext("2d");
  
  if (!canvas || !ctx) return;
  
  const time = Date.now() * 0.005;
  const timeElapsed = (Date.now() - phase8StartTime) / 1000;
  
  // Calculate expanding horizon based on time (0 to 175 seconds)
  const horizonProgress = Math.min(1, timeElapsed / 175);
  const horizonRadius = 50 + horizonProgress * (Math.min(canvas.width, canvas.height) * 0.8);
  
  // Draw expanding dark background
  const horizonGradient = ctx.createRadialGradient(blackholeX, blackholeY, 0, blackholeX, blackholeY, horizonRadius);
  horizonGradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
  horizonGradient.addColorStop(0.7, 'rgba(20, 20, 20, 0.9)');
  horizonGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  
  ctx.fillStyle = horizonGradient;
  ctx.beginPath();
  ctx.arc(blackholeX, blackholeY, horizonRadius, 0, 2 * Math.PI);
  ctx.fill();
  
  // Draw the main accretion disk with gravitational lensing effect
  const diskRadius = blackholeSize + 40;
  const diskThickness = 35; // Increased thickness to reduce gaps
  
  // Calculate intensity based on time (more intense as explosion approaches)
  const intensityMultiplier = 1 + (timeElapsed / 175) * 2; // Gets 3x more intense by explosion
  
  // Upper arc of accretion disk (above blackhole) - more complete
  ctx.save();
  ctx.globalAlpha = 0.9 * intensityMultiplier;
  const upperArcGradient = ctx.createRadialGradient(blackholeX, blackholeY - 15, diskRadius - diskThickness, blackholeX, blackholeY - 15, diskRadius + diskThickness);
  upperArcGradient.addColorStop(0, 'rgba(255, 250, 240, 0)');
  upperArcGradient.addColorStop(0.2, 'rgba(255, 250, 240, 0.9)');
  upperArcGradient.addColorStop(0.5, 'rgba(255, 250, 240, 1.0)');
  upperArcGradient.addColorStop(0.8, 'rgba(255, 240, 220, 0.8)');
  upperArcGradient.addColorStop(1, 'rgba(255, 220, 180, 0)');
  
  ctx.fillStyle = upperArcGradient;
  ctx.beginPath();
  ctx.arc(blackholeX, blackholeY - 15, diskRadius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
  
  // Lower arc of accretion disk (below blackhole) - more complete
  ctx.save();
  ctx.globalAlpha = 0.9 * intensityMultiplier;
  const lowerArcGradient = ctx.createRadialGradient(blackholeX, blackholeY + 15, diskRadius - diskThickness, blackholeX, blackholeY + 15, diskRadius + diskThickness);
  lowerArcGradient.addColorStop(0, 'rgba(255, 250, 240, 0)');
  lowerArcGradient.addColorStop(0.2, 'rgba(255, 250, 240, 0.9)');
  lowerArcGradient.addColorStop(0.5, 'rgba(255, 250, 240, 1.0)');
  lowerArcGradient.addColorStop(0.8, 'rgba(255, 240, 220, 0.8)');
  lowerArcGradient.addColorStop(1, 'rgba(255, 220, 180, 0)');
  
  ctx.fillStyle = lowerArcGradient;
  ctx.beginPath();
  ctx.arc(blackholeX, blackholeY + 15, diskRadius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
  
  // Add side stretching effect for gravitational lensing (same as accretion disk)
  ctx.save();
  ctx.globalAlpha = 0.8 * intensityMultiplier;
  const sideStretchGradient = ctx.createLinearGradient(blackholeX - diskRadius * 1.5, blackholeY, blackholeX + diskRadius * 1.5, blackholeY);
  sideStretchGradient.addColorStop(0, 'rgba(255, 250, 240, 0)');
  sideStretchGradient.addColorStop(0.2, 'rgba(255, 250, 240, 0.9)');
  sideStretchGradient.addColorStop(0.5, 'rgba(255, 250, 240, 1.0)');
  sideStretchGradient.addColorStop(0.8, 'rgba(255, 240, 220, 0.8)');
  sideStretchGradient.addColorStop(1, 'rgba(255, 220, 180, 0)');
  
  // Create elliptical stretching effect
  const stretchAmount = 1 + (timeElapsed / 175) * 1.5; // Gets more stretched over time
  ctx.scale(stretchAmount, 1);
  ctx.fillStyle = sideStretchGradient;
  ctx.fillRect((blackholeX - diskRadius * 1.5) / stretchAmount, blackholeY - 15, (diskRadius * 3) / stretchAmount, 30);
  ctx.restore();
  
  // Draw the bright horizontal event horizon line (most prominent feature)
  const lineY = blackholeY;
  const lineWidth = 8;
  const lineAlpha = 1.0;
  
  // Main bright horizontal line
  const lineGradient = ctx.createLinearGradient(0, lineY, canvas.width, lineY);
  lineGradient.addColorStop(0, 'rgba(255, 250, 240, 0)');
  lineGradient.addColorStop(0.2, 'rgba(255, 250, 240, 0.6)');
  lineGradient.addColorStop(0.4, 'rgba(255, 255, 255, 1.0)');
  lineGradient.addColorStop(0.6, 'rgba(255, 255, 255, 1.0)');
  lineGradient.addColorStop(0.8, 'rgba(255, 250, 240, 0.6)');
  lineGradient.addColorStop(1, 'rgba(255, 250, 240, 0)');
  
  ctx.strokeStyle = lineGradient;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(0, lineY);
  ctx.lineTo(canvas.width, lineY);
  ctx.stroke();
  
  // Add glow effect to the horizontal line
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = 'rgba(255, 250, 240, 0.8)';
  ctx.lineWidth = lineWidth * 3;
  ctx.beginPath();
  ctx.moveTo(0, lineY);
  ctx.lineTo(canvas.width, lineY);
  ctx.stroke();
  ctx.restore();
  
  // Draw wispy horizontal rays extending from the main line
  for (let i = 0; i < 8; i++) {
    const offsetY = (Math.random() - 0.5) * 20;
    const rayY = lineY + offsetY;
    const rayLength = 200 + Math.random() * 300;
    const rayStartX = blackholeX - rayLength / 2;
    const rayEndX = blackholeX + rayLength / 2;
    
    const rayGradient = ctx.createLinearGradient(rayStartX, rayY, rayEndX, rayY);
    rayGradient.addColorStop(0, 'rgba(255, 250, 240, 0)');
    rayGradient.addColorStop(0.3, 'rgba(255, 240, 220, 0.4)');
    rayGradient.addColorStop(0.7, 'rgba(255, 240, 220, 0.4)');
    rayGradient.addColorStop(1, 'rgba(255, 250, 240, 0)');
    
    ctx.strokeStyle = rayGradient;
    ctx.lineWidth = 2 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(rayStartX, rayY);
    ctx.lineTo(rayEndX, rayY);
    ctx.stroke();
  }
  
  // Draw gamma ray lines that get more intense as explosion approaches
  const gammaRayCount = Math.floor(5 + (timeElapsed / 175) * 15); // 5 to 20 rays
  const gammaRayIntensity = 0.3 + (timeElapsed / 175) * 0.7; // 0.3 to 1.0 intensity
  
  for (let i = 0; i < gammaRayCount; i++) {
    const angle = (i / gammaRayCount) * 2 * Math.PI + time * 0.3;
    const rayLength = 80 + (timeElapsed / 175) * 120; // Gets longer over time
    const rayWidth = 1 + (timeElapsed / 175) * 3; // Gets thicker over time
    
    const startX = blackholeX + Math.cos(angle) * blackholeSize;
    const startY = blackholeY + Math.sin(angle) * blackholeSize;
    const endX = blackholeX + Math.cos(angle) * rayLength;
    const endY = blackholeY + Math.sin(angle) * rayLength;
    
    // Gamma rays are more blue/white and intense
    const gammaGradient = ctx.createLinearGradient(startX, startY, endX, endY);
    gammaGradient.addColorStop(0, `rgba(255, 255, 255, ${gammaRayIntensity})`);
    gammaGradient.addColorStop(0.3, `rgba(200, 220, 255, ${gammaRayIntensity * 0.8})`);
    gammaGradient.addColorStop(0.7, `rgba(150, 180, 255, ${gammaRayIntensity * 0.6})`);
    gammaGradient.addColorStop(1, `rgba(100, 140, 255, 0)`);
    
    ctx.strokeStyle = gammaGradient;
    ctx.lineWidth = rayWidth;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // Add glow effect to gamma rays
    ctx.save();
    ctx.globalAlpha = gammaRayIntensity * 0.3;
    ctx.strokeStyle = `rgba(200, 220, 255, ${gammaRayIntensity * 0.5})`;
    ctx.lineWidth = rayWidth * 3;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.restore();
  }
  
  // Draw thin rays shooting across the screen (get spammier over time)
  const thinRayCount = Math.floor(10 + (timeElapsed / 175) * 40); // 10 to 50 rays
  const thinRayIntensity = 0.2 + (timeElapsed / 175) * 0.8; // 0.2 to 1.0 intensity
  
  for (let i = 0; i < thinRayCount; i++) {
    const angle = (i / thinRayCount) * 2 * Math.PI + time * 0.5;
    const rayLength = 150 + Math.random() * 200; // Random length
    const rayWidth = 0.5 + Math.random() * 1.5; // Very thin
    
    const startX = blackholeX + Math.cos(angle) * blackholeSize;
    const startY = blackholeY + Math.sin(angle) * blackholeSize;
    const endX = blackholeX + Math.cos(angle) * rayLength;
    const endY = blackholeY + Math.sin(angle) * rayLength;
    
    // Thin rays are white/light beige like accretion disk
    const thinRayGradient = ctx.createLinearGradient(startX, startY, endX, endY);
    thinRayGradient.addColorStop(0, `rgba(255, 250, 240, ${thinRayIntensity})`);
    thinRayGradient.addColorStop(0.3, `rgba(255, 240, 220, ${thinRayIntensity * 0.8})`);
    thinRayGradient.addColorStop(0.7, `rgba(255, 220, 180, ${thinRayIntensity * 0.6})`);
    thinRayGradient.addColorStop(1, `rgba(255, 200, 150, 0)`);
    
    ctx.strokeStyle = thinRayGradient;
    ctx.lineWidth = rayWidth;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
  
  // Draw the central blackhole (stretched ellipse for gravitational lensing)
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  ctx.beginPath();
  // Stretch the blackhole horizontally for gravitational lensing effect
  const stretchFactor = 1 + (timeElapsed / 175) * 0.5; // Gets more stretched over time
  ctx.scale(stretchFactor, 1); // Stretch horizontally
  ctx.arc(blackholeX / stretchFactor, blackholeY, blackholeSize, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
  
  // Add subtle glow around the blackhole edge
  ctx.save();
  ctx.globalAlpha = 0.3;
  const coreGlowGradient = ctx.createRadialGradient(blackholeX, blackholeY, blackholeSize * 0.8, blackholeX, blackholeY, blackholeSize * 1.2);
  coreGlowGradient.addColorStop(0, 'rgba(255, 250, 240, 0)');
  coreGlowGradient.addColorStop(1, 'rgba(255, 250, 240, 0.2)');
  ctx.fillStyle = coreGlowGradient;
  ctx.beginPath();
  ctx.arc(blackholeX, blackholeY, blackholeSize * 1.2, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
  
  // Draw white fade overlay (starts at 150 seconds, lasts 25 seconds)
  if (timeElapsed >= 150) {
    const fadeProgress = Math.min(1, (timeElapsed - 150) / 25);
    ctx.fillStyle = `rgba(255, 255, 255, ${fadeProgress})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// Removed drawAbsorbedElements - elements now orbit around blackhole instead

function triggerBlackholeExplosion() {
  console.log("FRONTEND: Blackhole explosion triggered!");
  phase8Active = false;
  
  // Remove phase8-active class from body
  document.body.classList.remove('phase8-active');
  
  // Create massive explosion effect
  createBlackholeExplosion();
  
  // Trigger white flash
  triggerWhiteFlash();
  
  // Play explosion sound
  const explosionAudio = new Audio("audio/internal_explosion.mp3");
  explosionAudio.volume = 1.0;
  explosionAudio.play().catch(e => console.log("Explosion audio failed:", e));
  
  // Reset after explosion
  setTimeout(() => {
    resetGame();
  }, 5000);
}

function createBlackholeExplosion() {
  // Create explosion particles
  const explosionParticles = [];
  const particleCount = 200;
  
  for (let i = 0; i < particleCount; i++) {
    explosionParticles.push({
      x: blackholeX,
      y: blackholeY,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      life: 1.0,
      size: Math.random() * 10 + 5,
      color: `hsl(${Math.random() * 60 + 300}, 100%, 50%)` // Purple to red range
    });
  }
  
  // Animate explosion particles
  const animateExplosion = () => {
    const canvas = window.blackholeCanvas;
    const ctx = window.blackholeCtx || canvas.getContext("2d");
    
    if (!canvas || !ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update and draw particles
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
      const particle = explosionParticles[i];
      
      // Update position
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.98; // Friction
      particle.vy *= 0.98;
      particle.life -= 0.02;
      
      // Draw particle
      if (particle.life > 0) {
        ctx.save();
        ctx.globalAlpha = particle.life;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      } else {
        explosionParticles.splice(i, 1);
      }
    }
    
    // Continue animation if particles remain
    if (explosionParticles.length > 0) {
      requestAnimationFrame(animateExplosion);
    }
  };
  
  animateExplosion();
}

function startPhase7Notifications() {
  // Create notification container
  let container = document.getElementById('phase7Notifications');
  if (!container) {
    container = document.createElement('div');
    container.id = 'phase7Notifications';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 10000;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }
  
  // Start notification loop
  const notificationInterval = setInterval(() => {
    if (!phase7Active) {
      clearInterval(notificationInterval);
      return;
    }
    createPhase7Notification();
  }, 3000 + Math.random() * 4000); // Random interval between 3-7 seconds
}

function createPhase7Notification() {
  const container = document.getElementById('phase7Notifications');
  if (!container) return;
  
  // Play notification sound
  const notificationAudio = new Audio("audio/notification.ogg");
  notificationAudio.volume = 0.6;
  notificationAudio.play().catch(e => console.log("Notification audio failed:", e));
  
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
    color: white;
    padding: 12px 16px;
    margin-bottom: 8px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-family: 'Courier New', monospace;
    font-size: 14px;
    font-weight: bold;
    max-width: 300px;
    word-wrap: break-word;
    transform: translateX(-100%);
    opacity: 0;
    transition: all 0.3s ease-out;
    border-left: 4px solid #ff4757;
  `;
  
  // Random message
  const message = PHASE7_NOTIFICATIONS[Math.floor(Math.random() * PHASE7_NOTIFICATIONS.length)];
  notification.textContent = message;
  
  container.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
    notification.style.opacity = '1';
  }, 10);
  
  // Animate out after 4 seconds
  setTimeout(() => {
    notification.style.transform = 'translateX(-100%)';
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);
  
  // Add to tracking array
  phase7Notifications.push(notification);
}

function createCaseIntegrityHealthBar() {
  // Remove existing health bar if it exists
  removeCaseIntegrityHealthBar();
  
  // Create health bar container
  const healthBarContainer = document.createElement('div');
  healthBarContainer.id = 'caseIntegrityHealthBar';
  healthBarContainer.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.8);
    border: 2px solid #8b5cf6;
    border-radius: 10px;
    padding: 10px;
    min-width: 200px;
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
  `;
  
  // Create title
  const title = document.createElement('div');
  title.textContent = 'CASE INTEGRITY';
  title.style.cssText = `
    color: #8b5cf6;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 8px;
    text-shadow: 0 0 10px rgba(139, 92, 246, 0.8);
  `;
  
  // Create health bar background
  const healthBarBg = document.createElement('div');
  healthBarBg.style.cssText = `
    width: 100%;
    height: 20px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid #4a5568;
    border-radius: 10px;
    overflow: hidden;
    position: relative;
  `;
  
  // Create health bar fill
  const healthBarFill = document.createElement('div');
  healthBarFill.id = 'caseIntegrityFill';
  healthBarFill.style.cssText = `
    height: 100%;
    background: linear-gradient(90deg, #8b5cf6, #a855f7, #c084fc);
    border-radius: 10px;
    transition: width 0.3s ease;
    box-shadow: 0 0 15px rgba(139, 92, 246, 0.8);
    position: relative;
    overflow: hidden;
  `;
  
  // Create pulsing effect
  const pulseEffect = document.createElement('div');
  pulseEffect.style.cssText = `
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
    animation: caseIntegrityPulse 2s infinite;
  `;
  
  // Add CSS animation
  if (!document.getElementById('caseIntegrityStyles')) {
    const style = document.createElement('style');
    style.id = 'caseIntegrityStyles';
    style.textContent = `
      @keyframes caseIntegrityPulse {
        0% { left: -100%; }
        100% { left: 100%; }
      }
      @keyframes caseIntegrityGlow {
        0%, 100% { box-shadow: 0 0 15px rgba(139, 92, 246, 0.8); }
        50% { box-shadow: 0 0 25px rgba(139, 92, 246, 1), 0 0 35px rgba(139, 92, 246, 0.6); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Add glow animation to the fill
  healthBarFill.style.animation = 'caseIntegrityGlow 1.5s infinite';
  
  // Assemble the health bar
  healthBarFill.appendChild(pulseEffect);
  healthBarBg.appendChild(healthBarFill);
  healthBarContainer.appendChild(title);
  healthBarContainer.appendChild(healthBarBg);
  
  // Add to page
  document.body.appendChild(healthBarContainer);
  
  // Initialize with full health
  updateCaseIntegrityHealthBar(100);
}

function updateCaseIntegrityHealthBar(integrity) {
  const fill = document.getElementById('caseIntegrityFill');
  if (!fill) return;
  
  const percentage = Math.max(0, Math.min(100, integrity));
  fill.style.width = `${percentage}%`;
  
  // Change color based on health level
  if (percentage > 60) {
    fill.style.background = 'linear-gradient(90deg, #8b5cf6, #a855f7, #c084fc)';
  } else if (percentage > 30) {
    fill.style.background = 'linear-gradient(90deg, #f59e0b, #f97316, #fb923c)';
  } else {
    fill.style.background = 'linear-gradient(90deg, #ef4444, #f87171, #fca5a5)';
  }
  
  // Trigger whole-page shake when case integrity reaches 50% or below
  if (percentage <= 50 && !phase6PageShakeActive && phase6Active) {
    startPhase6PageShake();
  }
}

function startPhase6PageShake() {
  if (phase6PageShakeActive) return;
  
  phase6PageShakeActive = true;
  phase6ShakeStartTime = Date.now();
  phase6ShakeIntensity = 0;
  console.log("Starting Phase 6 whole-page shake - case integrity at 50% or below");
  
  // Add shake class to body
  document.body.classList.add('phase6-page-shake');
  
  // Apply shake to all fixed elements
  applyShakeToFixedElements();
  
  // Start progressive shake intensity
  updatePhase6ShakeIntensity();
}

function updatePhase6ShakeIntensity() {
  if (!phase6PageShakeActive) return;
  
  const timeElapsed = (Date.now() - phase6ShakeStartTime) / 1000; // seconds
  let newIntensity = 0;
  
  // Progressive intensity based on time and case integrity
  if (timeElapsed > 10 || caseIntegrity < 30) {
    newIntensity = 2; // Extreme
  } else if (timeElapsed > 5 || caseIntegrity < 40) {
    newIntensity = 1; // Intense
  } else {
    newIntensity = 0; // Normal
  }
  
  // Update intensity if changed
  if (newIntensity !== phase6ShakeIntensity) {
    phase6ShakeIntensity = newIntensity;
    
    // Remove old shake classes from body
    document.body.classList.remove('phase6-page-shake', 'phase6-page-shake-intense', 'phase6-page-shake-extreme');
    
    // Add new shake class to body
    if (phase6ShakeIntensity === 0) {
      document.body.classList.add('phase6-page-shake');
    } else if (phase6ShakeIntensity === 1) {
      document.body.classList.add('phase6-page-shake-intense');
    } else {
      document.body.classList.add('phase6-page-shake-extreme');
    }
    
    // Apply shake to all fixed elements that don't inherit body transform
    applyShakeToFixedElements();
    
    console.log(`Phase 6 shake intensity updated to: ${phase6ShakeIntensity} (${phase6ShakeIntensity === 0 ? 'normal' : phase6ShakeIntensity === 1 ? 'intense' : 'extreme'})`);
  }
  
  // Continue checking intensity
  setTimeout(updatePhase6ShakeIntensity, 1000);
}

function applyShakeToFixedElements() {
  // Get all elements that need to shake
  const elementsToShake = [
    'caseIntegrityHealthBar',
    'phase6Terminal',
    'stabilizerTerminal',
    'caseIntegrityTerminal'
  ];
  
  // Add all buttons
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => elementsToShake.push(button.id || `button-${Math.random()}`));
  
  elementsToShake.forEach(elementId => {
    const element = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
    if (element && element.style.position === 'fixed') {
      // Remove old shake classes
      element.classList.remove('phase6-page-shake', 'phase6-page-shake-intense', 'phase6-page-shake-extreme');
      
      // Add new shake class
      if (phase6ShakeIntensity === 0) {
        element.classList.add('phase6-page-shake');
      } else if (phase6ShakeIntensity === 1) {
        element.classList.add('phase6-page-shake-intense');
      } else {
        element.classList.add('phase6-page-shake-extreme');
      }
    }
  });
}

function stopPhase6PageShake() {
  if (!phase6PageShakeActive) return;
  
  phase6PageShakeActive = false;
  phase6ShakeIntensity = 0;
  console.log("Stopping Phase 6 whole-page shake");
  
  // Remove all shake classes from body
  document.body.classList.remove('phase6-page-shake', 'phase6-page-shake-intense', 'phase6-page-shake-extreme');
  
  // Remove shake classes from all fixed elements
  const elementsToClean = [
    'caseIntegrityHealthBar',
    'phase6Terminal',
    'stabilizerTerminal',
    'caseIntegrityTerminal'
  ];
  
  // Add all buttons
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => elementsToClean.push(button));
  
  elementsToClean.forEach(elementId => {
    const element = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
    if (element) {
      element.classList.remove('phase6-page-shake', 'phase6-page-shake-intense', 'phase6-page-shake-extreme');
    }
  });
}

// Phase 7 shake functions
function startPhase7PageShake() {
  if (phase7PageShakeActive) return;
  
  phase7PageShakeActive = true;
  phase7ShakeStartTime = Date.now();
  phase7ShakeIntensity = 0;
  console.log("Starting Phase 7 whole-page shake");
  
  // Add shake class to body
  document.body.classList.add('phase7-page-shake');
  
  // Apply shake to all fixed elements
  applyPhase7ShakeToFixedElements();
  
  // Start progressive shake intensity
  updatePhase7ShakeIntensity();
}

function updatePhase7ShakeIntensity() {
  if (!phase7PageShakeActive) return;
  
  const timeElapsed = (Date.now() - phase7ShakeStartTime) / 1000; // seconds
  let newIntensity = 0;
  
  // Progressive intensity based on time - Phase 7 is 394 seconds total
  const phase7Progress = timeElapsed / 394; // 0 to 1
  
  if (phase7Progress > 0.8 || timeElapsed > 300) {
    newIntensity = 3; // Catastrophic - approaching Phase 8
  } else if (phase7Progress > 0.6 || timeElapsed > 200) {
    newIntensity = 2; // Extreme
  } else if (phase7Progress > 0.3 || timeElapsed > 100) {
    newIntensity = 1; // Intense
  } else {
    newIntensity = 0; // Normal
  }
  
  // Update intensity if changed
  if (newIntensity !== phase7ShakeIntensity) {
    phase7ShakeIntensity = newIntensity;
    
    // Remove old shake classes from body
    document.body.classList.remove('phase7-page-shake', 'phase7-page-shake-intense', 'phase7-page-shake-extreme', 'phase7-page-shake-catastrophic');
    
    // Add new shake class to body
    if (phase7ShakeIntensity === 0) {
      document.body.classList.add('phase7-page-shake');
    } else if (phase7ShakeIntensity === 1) {
      document.body.classList.add('phase7-page-shake-intense');
    } else if (phase7ShakeIntensity === 2) {
      document.body.classList.add('phase7-page-shake-extreme');
    } else {
      document.body.classList.add('phase7-page-shake-catastrophic');
    }
    
    // Apply shake to all fixed elements
    applyPhase7ShakeToFixedElements();
    
    console.log(`Phase 7 shake intensity updated to: ${phase7ShakeIntensity} (${phase7ShakeIntensity === 0 ? 'normal' : phase7ShakeIntensity === 1 ? 'intense' : phase7ShakeIntensity === 2 ? 'extreme' : 'catastrophic'})`);
  }
  
  // Continue checking intensity
  setTimeout(updatePhase7ShakeIntensity, 2000); // Check every 2 seconds
}

function applyPhase7ShakeToFixedElements() {
  // Get all Phase 7 elements that need to shake
  const elementsToShake = [
    'phase7PowerTerminal',
    'coreActivityTerminal',
    'quantumAnalysisTerminal',
    'dimensionalScannerTerminal',
    'energyMonitorTerminal',
    'gravityAnalyzerTerminal',
    'systemOverrideTerminal'
  ];
  
  // Add all buttons
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => elementsToShake.push(button));
  
  elementsToShake.forEach(elementId => {
    const element = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
    if (element && element.style.position === 'fixed') {
      // Remove old shake classes
      element.classList.remove('phase7-page-shake', 'phase7-page-shake-intense', 'phase7-page-shake-extreme', 'phase7-page-shake-catastrophic');
      
      // Add new shake class
      if (phase7ShakeIntensity === 0) {
        element.classList.add('phase7-page-shake');
      } else if (phase7ShakeIntensity === 1) {
        element.classList.add('phase7-page-shake-intense');
      } else if (phase7ShakeIntensity === 2) {
        element.classList.add('phase7-page-shake-extreme');
      } else {
        element.classList.add('phase7-page-shake-catastrophic');
      }
    }
  });
}

function stopPhase7PageShake() {
  if (!phase7PageShakeActive) return;
  
  phase7PageShakeActive = false;
  phase7ShakeIntensity = 0;
  console.log("Stopping Phase 7 whole-page shake");
  
  // Remove all shake classes from body
  document.body.classList.remove('phase7-page-shake', 'phase7-page-shake-intense', 'phase7-page-shake-extreme', 'phase7-page-shake-catastrophic');
  
  // Remove shake classes from all fixed elements
  const elementsToClean = [
    'phase7PowerTerminal',
    'coreActivityTerminal',
    'quantumAnalysisTerminal',
    'dimensionalScannerTerminal',
    'energyMonitorTerminal',
    'gravityAnalyzerTerminal',
    'systemOverrideTerminal'
  ];
  
  // Add all buttons
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => elementsToClean.push(button));
  
  elementsToClean.forEach(elementId => {
    const element = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
    if (element) {
      element.classList.remove('phase7-page-shake', 'phase7-page-shake-intense', 'phase7-page-shake-extreme', 'phase7-page-shake-catastrophic');
    }
  });
}

// Terminal kill system for Phase 7
function startPhase7TerminalKills() {
  if (phase7TerminalKillInterval) return;
  
  console.log("Starting Phase 7 terminal kill system");
  
  // Start killing terminals after 35 seconds of Phase 7 (wait for all 6 terminals to spawn)
  phase7TerminalKillInterval = setInterval(() => {
    killRandomPhase7Terminal();
  }, 10000); // Kill a terminal every 10 seconds
}

function killRandomPhase7Terminal() {
  const terminalIds = [
    'coreActivityTerminal',
    'quantumAnalysisTerminal', 
    'dimensionalScannerTerminal',
    'energyMonitorTerminal',
    'gravityAnalyzerTerminal',
    'systemOverrideTerminal'
  ];
  
  // Filter out already killed terminals
  const availableTerminals = terminalIds.filter(id => !killedTerminals.has(id));
  
  if (availableTerminals.length === 0) {
    console.log("All Phase 7 terminals have been killed");
    return;
  }
  
  // Pick a random terminal to kill
  const terminalId = availableTerminals[Math.floor(Math.random() * availableTerminals.length)];
  const terminal = document.getElementById(terminalId);
  
  if (!terminal) return;
  
  console.log(`Killing terminal: ${terminalId}`);
  console.log(`Terminal element found:`, terminal);
  killedTerminals.add(terminalId);
  
  // Add offline styling
  terminal.classList.add('terminal-offline');
  
  // Create offline flash effect
  const killFlash = document.createElement('div');
  killFlash.className = 'terminal-offline-flash';
  killFlash.textContent = 'TERMINAL OFFLINE';
  terminal.appendChild(killFlash);
  console.log(`Created offline flash for ${terminalId}:`, killFlash);
  
  // Remove kill flash after animation
  setTimeout(() => {
    if (killFlash.parentNode) {
      killFlash.parentNode.removeChild(killFlash);
    }
  }, 1200); // Extended duration for better visibility
  
  // Show disconnected message after kill flash
  setTimeout(() => {
    const disconnectedMsg = document.createElement('div');
    disconnectedMsg.className = 'terminal-disconnected';
    disconnectedMsg.textContent = 'TERMINAL DISCONNECTED';
    terminal.appendChild(disconnectedMsg);
    
    // Remove disconnected message after animation
    setTimeout(() => {
      if (disconnectedMsg.parentNode) {
        disconnectedMsg.parentNode.removeChild(disconnectedMsg);
      }
    }, 2000);
  }, 1300); // Adjusted timing to work with extended flash
  
  // Second kill effect - final black screen (no text)
  setTimeout(() => {
    console.log(`Applying final kill effect to ${terminalId}`);
    terminal.innerHTML = '';
    terminal.style.background = '#000000';
    terminal.style.color = '#000000'; // No text color
    terminal.style.display = 'flex';
    terminal.style.alignItems = 'center';
    terminal.style.justifyContent = 'center';
    terminal.style.fontSize = '0px'; // No text size
    terminal.style.fontWeight = 'bold';
    terminal.style.textShadow = 'none';
    terminal.style.border = '2px solid #ff0000';
    terminal.style.boxShadow = '0 0 20px #ff0000, inset 0 0 20px #ff0000';
    terminal.textContent = ''; // No text
    console.log(`Final kill effect applied to ${terminalId} - terminal is now completely black`);
  }, 4000); // 4 seconds after initial kill (allows time for flash + disconnected message)
  
  // Stop the terminal's content animation and replace with offline screen
  console.log(`Replacing terminal content for ${terminalId}`);
  
  // Replace the terminal content directly
  terminal.innerHTML = '';
  terminal.style.background = '#000000';
  terminal.style.color = '#ff0000';
  terminal.style.display = 'flex';
  terminal.style.alignItems = 'center';
  terminal.style.justifyContent = 'center';
  terminal.style.fontSize = '20px';
  terminal.style.fontWeight = 'bold';
  terminal.style.textShadow = '0 0 15px #ff0000';
  terminal.style.border = '2px solid #ff0000';
  terminal.style.boxShadow = '0 0 20px #ff0000, inset 0 0 20px #ff0000';
  terminal.textContent = 'TERMINAL OFFLINE';
  console.log(`Successfully replaced terminal content for ${terminalId} with offline screen`);
}

function stopPhase7TerminalKills() {
  if (phase7TerminalKillInterval) {
    clearInterval(phase7TerminalKillInterval);
    phase7TerminalKillInterval = null;
    console.log("Stopping Phase 7 terminal kill system");
  }
  
  // Reset killed terminals
  killedTerminals.clear();
  
  // Remove kill styling from all terminals
  const terminalIds = [
    'coreActivityTerminal',
    'quantumAnalysisTerminal', 
    'dimensionalScannerTerminal',
    'energyMonitorTerminal',
    'gravityAnalyzerTerminal',
    'systemOverrideTerminal'
  ];
  
  terminalIds.forEach(terminalId => {
    const terminal = document.getElementById(terminalId);
    if (terminal) {
      terminal.classList.remove('terminal-killed', 'terminal-offline');
    }
  });
}

// Phase 6 terminal kill system
function startPhase6TerminalKills() {
  if (phase6TerminalKillInterval) return;
  
  console.log("Starting Phase 6 terminal kill system");
  
  // Start killing terminals after 45 seconds of Phase 6 (wait for all terminals to spawn)
  phase6TerminalKillInterval = setInterval(() => {
    killRandomPhase6Terminal();
  }, 6000); // Kill a terminal every 6 seconds
}

function killRandomPhase6Terminal() {
  const terminalIds = [
    'phase6Terminal',
    'stabilizerTerminal',
    'caseIntegrityTerminal'
  ];
  
  // Filter out already killed terminals
  const availableTerminals = terminalIds.filter(id => !phase6KilledTerminals.has(id));
  
  if (availableTerminals.length === 0) {
    console.log("All Phase 6 terminals have been killed");
    return;
  }
  
  // Pick a random terminal to kill
  const terminalId = availableTerminals[Math.floor(Math.random() * availableTerminals.length)];
  const terminal = document.getElementById(terminalId);
  
  if (!terminal) return;
  
  console.log(`Killing Phase 6 terminal: ${terminalId}`);
  console.log(`Terminal element found:`, terminal);
  phase6KilledTerminals.add(terminalId);
  
  // Add offline styling
  terminal.classList.add('terminal-offline');
  
  // Create offline flash effect
  const killFlash = document.createElement('div');
  killFlash.className = 'terminal-offline-flash';
  killFlash.textContent = 'TERMINAL OFFLINE';
  terminal.appendChild(killFlash);
  console.log(`Created offline flash for ${terminalId}:`, killFlash);
  
  // Remove kill flash after animation
  setTimeout(() => {
    if (killFlash.parentNode) {
      killFlash.parentNode.removeChild(killFlash);
    }
  }, 1200); // Extended duration for better visibility
  
  // Show disconnected message after kill flash
  setTimeout(() => {
    const disconnectedMsg = document.createElement('div');
    disconnectedMsg.className = 'terminal-disconnected';
    disconnectedMsg.textContent = 'TERMINAL DISCONNECTED';
    terminal.appendChild(disconnectedMsg);
    
    // Remove disconnected message after animation
    setTimeout(() => {
      if (disconnectedMsg.parentNode) {
        disconnectedMsg.parentNode.removeChild(disconnectedMsg);
      }
    }, 2000);
  }, 1300); // Adjusted timing to work with extended flash
  
  // Second kill effect - final black screen (no text)
  setTimeout(() => {
    console.log(`Applying final kill effect to ${terminalId}`);
    terminal.innerHTML = '';
    terminal.style.background = '#000000';
    terminal.style.color = '#000000'; // No text color
    terminal.style.display = 'flex';
    terminal.style.alignItems = 'center';
    terminal.style.justifyContent = 'center';
    terminal.style.fontSize = '0px'; // No text size
    terminal.style.fontWeight = 'bold';
    terminal.style.textShadow = 'none';
    terminal.style.border = '2px solid #ff0000';
    terminal.style.boxShadow = '0 0 20px #ff0000, inset 0 0 20px #ff0000';
    terminal.textContent = ''; // No text
    console.log(`Final kill effect applied to ${terminalId} - terminal is now completely black`);
  }, 4000); // 4 seconds after initial kill (allows time for flash + disconnected message)
  
  // Stop the terminal's content animation and replace with offline screen
  console.log(`Replacing terminal content for ${terminalId}`);
  
  // Replace the terminal content directly
  terminal.innerHTML = '';
  terminal.style.background = '#000000';
  terminal.style.color = '#ff0000';
  terminal.style.display = 'flex';
  terminal.style.alignItems = 'center';
  terminal.style.justifyContent = 'center';
  terminal.style.fontSize = '20px';
  terminal.style.fontWeight = 'bold';
  terminal.style.textShadow = '0 0 15px #ff0000';
  terminal.style.border = '2px solid #ff0000';
  terminal.style.boxShadow = '0 0 20px #ff0000, inset 0 0 20px #ff0000';
  terminal.textContent = 'TERMINAL OFFLINE';
  console.log(`Successfully replaced terminal content for ${terminalId} with offline screen`);
}

function stopPhase6TerminalKills() {
  if (phase6TerminalKillInterval) {
    clearInterval(phase6TerminalKillInterval);
    phase6TerminalKillInterval = null;
    console.log("Stopping Phase 6 terminal kill system");
  }
  
  // Reset killed terminals
  phase6KilledTerminals.clear();
  
  // Remove kill styling from all terminals
  const terminalIds = [
    'phase6Terminal',
    'stabilizerTerminal',
    'caseIntegrityTerminal'
  ];
  
  terminalIds.forEach(terminalId => {
    const terminal = document.getElementById(terminalId);
    if (terminal) {
      terminal.classList.remove('terminal-killed', 'terminal-offline');
    }
  });
}


function removeCaseIntegrityHealthBar() {
  const healthBar = document.getElementById('caseIntegrityHealthBar');
  if (healthBar && healthBar.parentNode) {
    healthBar.parentNode.removeChild(healthBar);
  }
}

function createFreeFloatingBlackhole() {
  // Remove existing blackhole canvas if it exists
  const existing = document.getElementById('freeFloatingBlackhole');
  if (existing) {
    existing.remove();
  }
  
  // Create new free-floating blackhole canvas
  const blackholeCanvas = document.createElement('canvas');
  blackholeCanvas.id = 'freeFloatingBlackhole';
  blackholeCanvas.width = window.innerWidth;
  blackholeCanvas.height = window.innerHeight;
  blackholeCanvas.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: ${BLACKHOLE_CANVAS_Z_INDEX};
    pointer-events: none;
  `;
  
  document.body.appendChild(blackholeCanvas);
  
  // Store references
  window.blackholeCanvas = blackholeCanvas;
  window.blackholeCtx = blackholeCanvas.getContext('2d');
}


function startPhase8ErrorNotifications() {
  // Create error notification container
  let container = document.getElementById('phase8ErrorNotifications');
  if (!container) {
    container = document.createElement('div');
    container.id = 'phase8ErrorNotifications';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 10001;
      pointer-events: none;
      max-width: 400px;
    `;
    document.body.appendChild(container);
  }
  
  // Start error notification loop
  phase8ErrorInterval = setInterval(() => {
    if (!phase8Active) {
      clearInterval(phase8ErrorInterval);
      return;
    }
    createPhase8ErrorNotification();
  }, 2000 + Math.random() * 3000); // Random interval between 2-5 seconds
}

function createPhase8ErrorNotification() {
  const container = document.getElementById('phase8ErrorNotifications');
  if (!container) return;
  
  // Play error sound
  const errorAudio = new Audio("audio/notification.ogg");
  errorAudio.volume = 0.8;
  errorAudio.play().catch(e => console.log("Error audio failed:", e));
  
  // Create error notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
    color: #ff4444;
    padding: 8px 12px;
    margin-bottom: 6px;
    border-radius: 4px;
    border-left: 4px solid #ff4444;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    font-weight: bold;
    word-wrap: break-word;
    transform: translateX(-100%);
    opacity: 0;
    transition: all 0.3s ease-out;
    box-shadow: 0 2px 8px rgba(255, 68, 68, 0.3);
    text-shadow: 0 0 5px rgba(255, 68, 68, 0.8);
  `;
  
  // Random error message
  const message = PHASE8_ERROR_MESSAGES[Math.floor(Math.random() * PHASE8_ERROR_MESSAGES.length)];
  notification.textContent = message;
  
  container.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
    notification.style.opacity = '1';
  }, 10);
  
  // Animate out after 3 seconds
  setTimeout(() => {
    notification.style.transform = 'translateX(-100%)';
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
  
  // Add to tracking array
  phase8Notifications.push(notification);
}

function stopPhase8ErrorNotifications() {
  // Clear error interval
  if (phase8ErrorInterval) {
    clearInterval(phase8ErrorInterval);
    phase8ErrorInterval = null;
  }
  
  // Remove error container
  const container = document.getElementById('phase8ErrorNotifications');
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
  phase8Notifications = [];
}


// Toaster image (drawn above bread slices)
const toasterImg = new Image();
toasterImg.src = "toaster.png";
let toasterImgLoaded = false;
toasterImg.onload = () => { 
  toasterImgLoaded = true; 
  console.log("Toaster image loaded successfully");
  // Ensure current frame re-renders with the image available across all phases
  try { fetchState(); } catch(_) {}
};
toasterImg.onerror = () => {
  console.log("Failed to load toaster image");
  toasterImgLoaded = false;
};

// Draw toaster and bread
function drawToaster(cookness, sparks=false, meltdown=false, phase6=false, phase7=false) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Shake effect for meltdown, phase 6, and phase 7
  let offsetX = (meltdown || phase6 || phase7) ? Math.random()*10-5 : 0;
  let offsetY = (meltdown || phase6 || phase7) ? Math.random()*10-5 : 0;

  // Bread slices (draw first so toaster image overlays front lip)
  const slotTopY = 150 + offsetY;
  const sliceMaxHeight = 70;
  const breadHeight = (cookness / 100) * sliceMaxHeight;
  const visibleTop = slotTopY + (sliceMaxHeight - breadHeight);
  const sliceWidth = 40;
  const leftSliceX = 140 + offsetX;
  const rightSliceX = 220 + offsetX;

  // Browning color based on cookness
  const brown = Math.min(220, Math.floor(120 + breadHeight * 1.2));
  const brownG = Math.max(70, Math.floor(brown - 40));
  ctx.fillStyle = `rgb(${brown}, ${brownG}, 20)`;
  // Left slice
  ctx.fillRect(leftSliceX, visibleTop, sliceWidth, breadHeight);
  // Right slice
  ctx.fillRect(rightSliceX, visibleTop, sliceWidth, breadHeight);

  // Toaster body image (overlay)
  if (toasterImgLoaded) {
    ctx.drawImage(toasterImg, 100 + offsetX, 140 + offsetY, 200, 120);
  } else {
    // Fallback vector toaster while image loads
    ctx.fillStyle = "#555";
    ctx.fillRect(100+offsetX, 150+offsetY, 200, 100);
    ctx.fillStyle = "#333";
    ctx.fillRect(110+offsetX, 160+offsetY, 180, 80);
    // Add some details to make it more recognizable
    ctx.fillStyle = "#666";
    ctx.fillRect(120+offsetX, 170+offsetY, 160, 60);
    // Slots
    ctx.fillStyle = "#222";
    ctx.fillRect(130+offsetX, 175+offsetY, 30, 50);
    ctx.fillRect(210+offsetX, 175+offsetY, 30, 50);
  }

  // Sparks
  if (sparks || meltdown) {
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgb(${200+Math.random()*55}, ${Math.random()*255}, 0)`;
      ctx.fillRect(Math.random()*400, 150 + Math.random()*100, 2, 2);
    }
  }

  // Fire overlay for meltdown
  if (meltdown) {
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(255, ${Math.random()*150}, 0, 0.6)`;
      ctx.beginPath();
      ctx.arc(Math.random()*400, 250+Math.random()*30, Math.random()*20, 0, 2*Math.PI);
      ctx.fill();
    }
  }

  // Phase 6 effects: Purple particles and growing animation
  if (phase6) {
    // Growing animation - make toaster bigger as case integrity drops
    const growthFactor = 1 + ((100 - caseIntegrity) / 100) * 0.5; // Up to 50% bigger
    
    // Purple particles
    for (let i = 0; i < 80; i++) {
      const alpha = 0.3 + Math.random() * 0.4;
      ctx.fillStyle = `rgba(${100 + Math.random()*100}, 0, ${150 + Math.random()*100}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(Math.random()*400, Math.random()*300, Math.random()*8 + 2, 0, 2*Math.PI);
      ctx.fill();
    }
    
    // Blue flames when case integrity < 50%
    if (caseIntegrity < 50) {
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(0, ${100 + Math.random()*155}, ${200 + Math.random()*55}, 0.7)`;
        ctx.beginPath();
        ctx.arc(Math.random()*400, 250+Math.random()*30, Math.random()*25 + 5, 0, 2*Math.PI);
        ctx.fill();
      }
    }
    
    // Overlay the toaster with growth effect
    if (toasterImgLoaded) {
      const newWidth = 200 * growthFactor;
      const newHeight = 120 * growthFactor;
      const newX = 100 + offsetX - (newWidth - 200) / 2;
      const newY = 140 + offsetY - (newHeight - 120) / 2;
      ctx.drawImage(toasterImg, newX, newY, newWidth, newHeight);
    }
  }

  // Phase 7 effects: Broken case, white tent effects, stabilizers
  if (phase7) {
    // White tent effects - growing upward
    const tentHeight = Math.min(200, powerOutput / 10);
    const tentWidth = Math.min(300, powerOutput / 8);
    
    // Draw white tent shape
    ctx.fillStyle = `rgba(255, 255, 255, 0.3)`;
    ctx.beginPath();
    ctx.moveTo(200 - tentWidth/2, 300);
    ctx.lineTo(200, 300 - tentHeight);
    ctx.lineTo(200 + tentWidth/2, 300);
    ctx.closePath();
    ctx.fill();
    
    // White particles
    for (let i = 0; i < 100; i++) {
      const alpha = 0.4 + Math.random() * 0.4;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(Math.random()*400, Math.random()*300, Math.random()*6 + 2, 0, 2*Math.PI);
      ctx.fill();
    }
    
    // Debris particles (toaster fragments)
    for (let i = 0; i < 30; i++) {
      const alpha = 0.3 + Math.random() * 0.3;
      ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`;
      ctx.fillRect(
        120 + Math.random()*160, 
        160 + Math.random()*80, 
        Math.random()*8 + 2, 
        Math.random()*8 + 2
      );
    }
    
    // Draw stabilizers
    drawStabilizers();
    
    // Draw lightning strikes
    drawLightningStrikes();
    
    // Draw broken toaster case (cracked/broken appearance)
    if (toasterImgLoaded) {
      // Draw toaster with broken effect - multiple fragments
      ctx.save();
      ctx.globalAlpha = 0.8;
      
      // Draw main toaster body (cracked)
      ctx.drawImage(toasterImg, 100 + offsetX, 140 + offsetY, 200, 120);
      
      // Draw broken fragments
      ctx.globalAlpha = 0.6;
      ctx.drawImage(toasterImg, 95 + offsetX + Math.random()*3, 135 + offsetY + Math.random()*3, 50, 30);
      ctx.drawImage(toasterImg, 245 + offsetX + Math.random()*3, 135 + offsetY + Math.random()*3, 50, 30);
      ctx.drawImage(toasterImg, 95 + offsetX + Math.random()*3, 225 + offsetY + Math.random()*3, 50, 30);
      ctx.drawImage(toasterImg, 245 + offsetX + Math.random()*3, 225 + offsetY + Math.random()*3, 50, 30);
      
      ctx.restore();
      
      // Add major crack lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(150 + offsetX, 160 + offsetY);
      ctx.lineTo(250 + offsetX, 240 + offsetY);
      ctx.moveTo(180 + offsetX, 140 + offsetY);
      ctx.lineTo(220 + offsetX, 260 + offsetY);
      ctx.moveTo(120 + offsetX, 200 + offsetY);
      ctx.lineTo(280 + offsetX, 200 + offsetY);
      ctx.stroke();
      
      // Add smaller cracks
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(160 + offsetX, 150 + offsetY);
      ctx.lineTo(240 + offsetX, 250 + offsetY);
      ctx.moveTo(190 + offsetX, 150 + offsetY);
      ctx.lineTo(210 + offsetX, 250 + offsetY);
      ctx.stroke();
      
      // Add glowing edges on cracks
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(149 + offsetX, 159 + offsetY);
      ctx.lineTo(249 + offsetX, 239 + offsetY);
      ctx.moveTo(179 + offsetX, 139 + offsetY);
      ctx.lineTo(219 + offsetX, 259 + offsetY);
      ctx.stroke();
    }
  }
}

// Draw stabilizers around the toaster (outside canvas)
function drawStabilizers() {
  // Position stabilizers completely outside the canvas area
  const stabilizerPositions = {
    topLeft: { x: 20, y: 50 },
    topRight: { x: 380, y: 50 },
    rightTop: { x: 420, y: 100 },
    rightBottom: { x: 420, y: 280 },
    bottomLeft: { x: 20, y: 350 },
    bottomRight: { x: 380, y: 350 },
    leftTop: { x: -20, y: 100 },
    leftBottom: { x: -20, y: 280 }
  };
  
  Object.entries(stabilizers).forEach(([key, stabilizer]) => {
    if (!stabilizerPositions[key]) return;
    
    const pos = stabilizerPositions[key];
    const color = getStabilizerColor(stabilizer.status);
    
    // Draw detailed stabilizer
    drawDetailedStabilizer(pos, color, stabilizer.status);
    
    // Draw beam if stabilizer is active
    if (stabilizer.status !== 'gray' && stabilizer.status !== 'offline') {
      drawStabilizerBeam(pos, stabilizer.status);
    }
  });
}

function drawDetailedStabilizer(pos, color, status) {
  const size = 28;
  
  // Main stabilizer body (complex mechanical design)
  ctx.fillStyle = color;
  ctx.fillRect(pos.x - size/2, pos.y - size/2, size, size);
  
  // Add mechanical details - corner brackets
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(pos.x - size/2, pos.y - size/2, 4, 4);
  ctx.fillRect(pos.x + size/2 - 4, pos.y - size/2, 4, 4);
  ctx.fillRect(pos.x - size/2, pos.y + size/2 - 4, 4, 4);
  ctx.fillRect(pos.x + size/2 - 4, pos.y + size/2 - 4, 4, 4);
  
  // Central core
  ctx.fillStyle = status === 'gray' ? '#333' : '#ffffff';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 8, 0, 2 * Math.PI);
  ctx.fill();
  
  // Inner energy core
  if (status !== 'gray' && status !== 'offline') {
    ctx.fillStyle = status === 'red' ? '#ff4444' : status === 'yellow' ? '#ffff44' : '#44ff44';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 5, 0, 2 * Math.PI);
    ctx.fill();
    
    // Pulsing effect for active stabilizers
    const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255, 255, 255, ${pulse * 0.5})`;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 3, 0, 2 * Math.PI);
    ctx.fill();
  }
  
  // Outer mechanical ring
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(pos.x - size/2 - 2, pos.y - size/2 - 2, size + 4, size + 4);
  
  // Side panels
  ctx.fillStyle = '#cccccc';
  ctx.fillRect(pos.x - size/2 - 1, pos.y - 3, 2, 6);
  ctx.fillRect(pos.x + size/2 - 1, pos.y - 3, 2, 6);
  ctx.fillRect(pos.x - 3, pos.y - size/2 - 1, 6, 2);
  ctx.fillRect(pos.x - 3, pos.y + size/2 - 1, 6, 2);
  
  // Status lights
  ctx.fillStyle = status === 'gray' ? '#666666' : status === 'red' ? '#ff0000' : status === 'yellow' ? '#ffff00' : '#00ff00';
  ctx.fillRect(pos.x - 6, pos.y - size/2 - 6, 3, 3);
  ctx.fillRect(pos.x + 3, pos.y - size/2 - 6, 3, 3);
}

function getStabilizerColor(status) {
  switch (status) {
    case 'green': return '#00ff00';
    case 'yellow': return '#ffff00';
    case 'red': return '#ff0000';
    case 'gray': return '#666666';
    default: return '#333333';
  }
}

function drawStabilizerBeam(pos, status) {
  const toasterCenter = { x: 200, y: 200 };
  const beamColor = status === 'red' ? 'rgba(255, 0, 0, 0.6)' : 'rgba(0, 255, 0, 0.6)';
  
  ctx.strokeStyle = beamColor;
  ctx.lineWidth = 3;
  ctx.setLineDash(status === 'red' ? [10, 5] : []);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
  ctx.lineTo(toasterCenter.x, toasterCenter.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

// Play SFX
function playSFX(path) {
  const audio = new Audio(path);
  audio.volume = 0.18; // quieter per request
  audio.play();
}

// Phase music
function playPhaseMusic(phase) {
  if (currentPhaseMusic === phase) return;
  currentPhaseMusic = phase;
  if (phaseAudio) { 
    phaseAudio.pause(); 
    phaseAudio.onended = null; // Clear any lingering event handlers
    phaseAudio = null; 
  }
  const path = PHASE_MUSIC[phase];
  if (!path) return;
  phaseAudio = new Audio(path);
  phaseAudio.loop = false; // Changed to false - music only plays once
  phaseAudio.volume = 0.6; // keep music slightly louder than SFX
  // Guard against autoplay restrictions; will be triggered on first user gesture too
  const playPromise = phaseAudio.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

// Fetch state
function showErrorBanner(show) {
  const el = document.getElementById("errorBanner");
  if (!el) return;
  el.style.display = show ? "block" : "none";
}

async function fetchState() {
  let data;
  try {
    const res = await fetch(`${API}/state`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
    showErrorBanner(false);
  } catch (err) {
    console.error("Failed to fetch /state:", err);
    showErrorBanner(true);
    return;
  }

  document.getElementById("radiation").innerText = data.meters.radiation.toFixed(1);
  document.getElementById("cookness").innerText = data.meters.cookness.toFixed(1);
  document.getElementById("heat").innerText = data.meters.heat.toFixed(1);
  document.getElementById("pressure").innerText = data.meters.pressure.toFixed(1);
  document.getElementById("phase").innerText = data.phase;
  currentPhase = data.phase;
  memeCheckPassed = computeRestabilizationMemeCheck(data.buttons);
  debugLog("FRONTEND: Current phase received:", data.phase, "Previous phase:", window.__prevPhase);

  // Update case integrity for phase 6
  if (data.phase === 6 && typeof data.caseIntegrity !== "undefined") {
    caseIntegrity = data.caseIntegrity;
    updateCaseIntegrityHealthBar(caseIntegrity);
  }

  // Update phase 7 data
  if (data.phase === 7) {
    if (typeof data.powerInput !== "undefined") powerInput = data.powerInput;
    if (typeof data.powerOutput !== "undefined") powerOutput = data.powerOutput;
    if (typeof data.stabilizers !== "undefined") stabilizers = data.stabilizers;
  }

  // Update phase 8 data
  if (data.phase === 8) {
    if (typeof data.blackholeSize !== "undefined") blackholeSize = data.blackholeSize;
    if (typeof data.blackholeIntensity !== "undefined") blackholeIntensity = data.blackholeIntensity;
  }

  playPhaseMusic(data.phase);

  // Detect phase transitions for one-shots
  if (typeof window.__prevPhase === "undefined") {
    window.__prevPhase = data.phase;
    debugLog("FRONTEND: Initial phase set to:", data.phase);
    // If we start directly in phase 8, trigger the sequence
    if (data.phase === 8) {
      debugLog("FRONTEND: Starting directly in phase 8, triggering BSOD sequence");
      startPhase8BSODSequence();
    }
  }
  debugLog("FRONTEND: Phase transition check - Current:", data.phase, "Previous:", window.__prevPhase);
  if (window.__prevPhase !== data.phase) {
    debugLog("FRONTEND: Phase transition detected from", window.__prevPhase, "to", data.phase);
    // Entering Overdrive
    if (data.phase === 4) {
      playWithCooldown("reactorHum", ALARMS.reactorHum, 12000, 0.4);
      playWithCooldown("powerSpike", ALARMS.powerSpike, 2000, 0.6);
    }
    // Entering Critical Browning
    if (data.phase === 3) {
      // If coming from Restabilization, celebrate
      if (window.__prevPhase === "Restabilization") {
        playWithCooldown("ejectSuccess", ALARMS.ejectSuccess, 2000, 0.7);
      } else {
        playWithCooldown("criticalWarn", ALARMS.criticalBrowningWarning, 5000, 0.7);
      }
    }
    // Entering Restabilization
    if (data.phase === "Restabilization") {
      playWithCooldown("pendingStall", ALARMS.pendingStall, 2000, 0.7);
    }
    // Entering Meltdown
    if (data.phase === 5) {
      playWithCooldown("totalFailure", ALARMS.totalFailure, 4000, 0.8);
      // Start accelerating internal explosions under the meltdown track
      startMeltdownSequence();
      // Hook finale at end of meltdown music loop iteration
      try {
        if (phaseAudio) {
          phaseAudio.onended = () => {
            // Finale: energy surge then big explosion
            playWithCooldown("powerSpikeFinale", ALARMS.powerSpike, 1000, 0.7);
            setTimeout(() => playWithCooldown("explosionFinale", ALARMS.internalExplosion, 1000, 0.95), 350);
          };
        }
      } catch(_) {}
    }
    // Entering Phase 6
    if (data.phase === 6) {
      stopMeltdownSequence();
      startPhase6Sequence();
    }
    // Entering Phase 7
    if (data.phase === 7) {
      stopPhase6Sequence();
      startPhase7Sequence();
    }
    // Entering Phase 8
    if (data.phase === 8) {
      debugLog("FRONTEND: Entering Phase 8 - Previous phase:", window.__prevPhase);
      stopPhase7Sequence();
      startPhase8BSODSequence();
    }
    // Leaving Meltdown
    if (window.__prevPhase === 5 && data.phase !== 5) {
      stopMeltdownSequence();
      // Clear any lingering meltdown event handlers
      if (phaseAudio) {
        phaseAudio.onended = null;
      }
    }
    // Leaving Phase 6
    if (window.__prevPhase === 6 && data.phase !== 6) {
      stopPhase6Sequence();
    }
    // Leaving Phase 7
    if (window.__prevPhase === 7 && data.phase !== 7) {
      stopPhase7Sequence();
    }
    // Leaving Phase 8
    if (window.__prevPhase === 8 && data.phase !== 8) {
      stopPhase8Sequence();
      showUIAfterPhase7();
    }
    window.__prevPhase = data.phase;
  }

  // Restabilization UI
  const restabDiv = document.getElementById("restab");
  if (data.phase === "Restabilization") {
    restabDiv.style.display = "block";
    // Sync restab state from backend
    try {
      const r = await fetch(`${API}/restab`);
      const rj = await r.json();
      if (typeof rj.coilCounter === "number") {
        coilCounter = rj.coilCounter;
      }
      restabDeadlineAt = rj.deadlineAt || null;
    } catch(_) {}

    document.getElementById("coilCounter").innerText = coilCounter;
    document.getElementById("memeCheck").innerText = memeCheckPassed ? "✅ Meme Check Passed!" : "Waiting for 21 meme...";
    drawToaster(data.meters.cookness, true);
    if (!restabTimerInterval) {
      restabTimerInterval = setInterval(() => {
        const el = document.getElementById("restabTimer");
        if (!el) return;
        if (!restabDeadlineAt) { el.innerText = "--"; return; }
        const remaining = Math.max(0, Math.floor((restabDeadlineAt - Date.now())/1000));
        el.innerText = remaining;
        if (remaining <= 0) {
          clearInterval(restabTimerInterval);
          restabTimerInterval = null;
        }
      }, 250);
    }
    const timerEl = document.getElementById("restabTimer");
    if (timerEl) {
      if (!restabDeadlineAt) {
        timerEl.innerText = "--";
      } else {
        timerEl.innerText = Math.max(0, Math.floor((restabDeadlineAt - Date.now())/1000));
      }
    }
  } else {
    restabDiv.style.display = "none";
    restabDeadlineAt = null;
    if (restabTimerInterval) { clearInterval(restabTimerInterval); restabTimerInterval = null; }
  }

  // Meltdown animation
  if (data.phase === 5) {
    if (!meltdownAnimationId) meltdownAnimationId = requestAnimationFrame(meltdownLoop);
  } else if (meltdownAnimationId) {
    cancelAnimationFrame(meltdownAnimationId);
    meltdownAnimationId = null;
    drawToaster(data.meters.cookness); // reset canvas
  }
  
  // Phase 6 animation (handled by startPhase6Sequence)
  if (data.phase === 6) {
    // Phase 6 animation is handled by the phase6Loop
  }
  
  // Phase 7 animation (handled by startPhase7Sequence)
  if (data.phase === 7) {
    // Phase 7 animation is handled by the phase7Loop
  }
  
  // Phase 8 animation (handled by startPhase8Sequence)
  if (data.phase === 8) {
    // Phase 8 animation is handled by the phase8Loop
  }
  
  // Ensure ambient loop is running for non-meltdown, non-phase6, non-phase7, and non-phase8 phases
  if (!phaseAnimId && data.phase !== 5 && data.phase !== 6 && data.phase !== 7 && data.phase !== 8) {
    phaseAnimId = requestAnimationFrame(phaseAnimationLoop);
  }

  // Shield pulse indicator (multiplayer synced via backend timestamp)
  try {
    const ind = document.getElementById("shieldIndicator");
    const until = data.shieldActiveUntil || 0;
    if (until && Date.now() < until) {
      ind.style.display = "block";
    } else {
      ind.style.display = "none";
    }
  } catch(_) {}

  // Threshold alarms (debounced) - disabled during phase 5, 7, and 8
  if (data.meters.heat >= 80 && data.phase !== 5 && data.phase !== 7 && data.phase !== 8) {
    playWithCooldown("highTemp", ALARMS.highTemp, 10000, 0.6);
  }
  if (data.meters.pressure >= 80 && data.phase !== 5 && data.phase !== 7 && data.phase !== 8) {
    playWithCooldown("highPressure", ALARMS.highPressure, 10000, 0.6);
  }
  if (data.meters.cookness >= 80 && data.phase !== 5 && data.phase !== 7 && data.phase !== 8) {
    playWithCooldown("highCookness", ALARMS.highCookness, 10000, 0.6);
  }
  if ((data.meters.pressure >= 95 || data.meters.heat >= 95) && data.phase !== 5 && data.phase !== 7 && data.phase !== 8) {
    playWithCooldown("severeDamage", ALARMS.severeDamage, 12000, 0.7);
  }
}

// Meltdown accelerating SFX loop
function startMeltdownSequence() {
  stopMeltdownSequence();
  meltdownSeqActive = true;
  let interval = 3000; // start slower
  const minInterval = 500; // cap speed higher (slower overall)
  const stepFactor = 0.9; // gentler acceleration
  const loop = () => {
    if (!meltdownSeqActive) return;
    // play internal explosion quieter under music
    try {
      const a = new Audio(ALARMS.internalExplosion);
      a.volume = 0.2; // quieter per spec
      a.play();
    } catch(_) {}
    interval = Math.max(minInterval, Math.floor(interval * stepFactor));
    meltdownSeqTimeout = setTimeout(loop, interval);
  };
  meltdownSeqTimeout = setTimeout(loop, interval);
}

function stopMeltdownSequence() {
  meltdownSeqActive = false;
  if (meltdownSeqTimeout) { clearTimeout(meltdownSeqTimeout); meltdownSeqTimeout = null; }
}

// Phase 6 animation loop
function phase6Loop() {
  if (!phase6Active) return;
  drawToaster(100, true, false, true); // cookness maxed, sparks, no meltdown, phase6=true
  
  // Check if blue particles should be active (case integrity < 50) and trigger page shake
  if (caseIntegrity < 50 && !phase6PageShakeActive) {
    startPhase6PageShake();
  }
  
  phase6AnimationId = requestAnimationFrame(phase6Loop);
}

function startPhase6Sequence() {
  phase6Active = true;
  if (phase6AnimationId) {
    cancelAnimationFrame(phase6AnimationId);
  }
  phase6AnimationId = requestAnimationFrame(phase6Loop);
  
  // Add screen shake to the canvas
  const canvas = document.getElementById("toasterCanvas");
  if (canvas) {
    canvas.classList.add("phase6-shake");
  }
  
  // Create case integrity health bar
  createCaseIntegrityHealthBar();
  
  // Show main terminal after 30 seconds of music
  setTimeout(() => {
    showTerminal();
  }, 30000);
  
  // Show stabilizer terminal after 35 seconds
  setTimeout(() => {
    showStabilizerTerminal();
  }, 35000);
  
  // Show case integrity terminal after 40 seconds
  setTimeout(() => {
    showCaseIntegrityTerminal();
  }, 40000);
  
  // Start Phase 6 terminal kill system
  setTimeout(() => {
    startPhase6TerminalKills();
  }, 45000); // Start killing terminals 45 seconds after Phase 6 begins (after all terminals spawn)
}

function stopPhase6Sequence() {
  phase6Active = false;
  if (phase6AnimationId) {
    cancelAnimationFrame(phase6AnimationId);
    phase6AnimationId = null;
  }
  
  // Stop whole-page shake
  stopPhase6PageShake();
  
  // Stop Phase 6 terminal kills
  stopPhase6TerminalKills();
  
  // Hide all terminals
  hideTerminal();
  
  // Remove stabilizer terminal
  const stabilizerTerminal = document.getElementById('stabilizerTerminal');
  if (stabilizerTerminal) {
    stabilizerTerminal.remove();
  }
  
  // Remove case integrity terminal
  const caseIntegrityTerminal = document.getElementById('caseIntegrityTerminal');
  if (caseIntegrityTerminal) {
    caseIntegrityTerminal.remove();
  }
  
  // Remove case integrity health bar
  removeCaseIntegrityHealthBar();
  
  // Remove screen shake from the canvas
  const canvas = document.getElementById("toasterCanvas");
  if (canvas) {
    canvas.classList.remove("phase6-shake");
  }
}

// Phase 7 animation loop
function phase7Loop() {
  if (!phase7Active) return;
  drawToaster(100, true, false, false, true); // cookness maxed, sparks, no meltdown, no phase6, phase7=true
  
  // Random white flashes during phase 7 (occasional)
  const now = Date.now();
  if (now - lastFlashTime > 3000 + Math.random() * 5000) { // 3-8 seconds between flashes
    if (Math.random() < 0.3) { // 30% chance when time is up
      triggerWhiteFlash();
      lastFlashTime = now;
    }
  }
  
  phase7AnimationId = requestAnimationFrame(phase7Loop);
}

function breakToasterFree() {
  if (toasterFreed) return;
  toasterFreed = true;
  
  const canvas = document.getElementById("toasterCanvas");
  if (!canvas) return;
  
  // Get canvas position and size
  const rect = canvas.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  // Create explosion particles
  createToasterExplosion(centerX, centerY);
  
  // Make canvas free-floating
  canvas.style.position = 'fixed';
  canvas.style.left = rect.left + 'px';
  canvas.style.top = rect.top + 'px';
  canvas.style.zIndex = '1000';
  canvas.style.pointerEvents = 'none';
  
  // Add floating animation to canvas
  canvas.style.animation = 'toasterFloat 3s ease-in-out infinite';
  
  // Create particle canvas overlay
  createParticleCanvas();
  
  // Start particle animation loop
  animateToasterParticles();
}

function createParticleCanvas() {
  // Create particle canvas overlay
  particleCanvas = document.createElement('canvas');
  particleCanvas.id = 'particleCanvas';
  particleCanvas.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 999;
    pointer-events: none;
  `;
  particleCanvas.width = window.innerWidth;
  particleCanvas.height = window.innerHeight;
  particleCtx = particleCanvas.getContext('2d');
  document.body.appendChild(particleCanvas);
}

function createToasterExplosion(centerX, centerY) {
  // Create explosion particles
  for (let i = 0; i < 50; i++) {
    const angle = (i / 50) * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    const size = 2 + Math.random() * 6;
    
    toasterParticles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: size,
      life: 1.0,
      decay: 0.02 + Math.random() * 0.03,
      color: `hsl(${Math.random() * 60 + 15}, 100%, ${50 + Math.random() * 50}%)` // Orange to red
    });
  }
  
  // Add some larger debris pieces
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    const size = 8 + Math.random() * 12;
    
    toasterParticles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: size,
      life: 1.0,
      decay: 0.01 + Math.random() * 0.02,
      color: `hsl(${Math.random() * 30 + 20}, 60%, ${30 + Math.random() * 40}%)`, // Brown to gray
      isDebris: true
    });
  }
}

function animateToasterParticles() {
  if (!phase7Active || !particleCtx) return;
  
  // Clear particle canvas
  particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  
  // Update and draw particles
  for (let i = toasterParticles.length - 1; i >= 0; i--) {
    const particle = toasterParticles[i];
    
    // Update position
    particle.x += particle.vx;
    particle.y += particle.vy;
    
    // Apply gravity to debris
    if (particle.isDebris) {
      particle.vy += 0.1;
    }
    
    // Update life
    particle.life -= particle.decay;
    
    // Remove dead particles
    if (particle.life <= 0) {
      toasterParticles.splice(i, 1);
      continue;
    }
    
    // Draw particle
    particleCtx.save();
    particleCtx.globalAlpha = particle.life;
    particleCtx.fillStyle = particle.color;
    particleCtx.beginPath();
    particleCtx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    particleCtx.fill();
    particleCtx.restore();
  }
  
  // Continue animation
  requestAnimationFrame(animateToasterParticles);
}

function startPhase7Sequence() {
  phase7Active = true;
  if (phase7AnimationId) {
    cancelAnimationFrame(phase7AnimationId);
  }
  phase7AnimationId = requestAnimationFrame(phase7Loop);
  
  // Hide UI elements for phase 7
  hideUIForPhase7();
  
  // Break toaster free from container and add particle explosion
  breakToasterFree();
  
  // Start notification system
  startPhase7Notifications();
  
  // Add screen shake to the canvas
  const canvas = document.getElementById("toasterCanvas");
  if (canvas) {
    canvas.classList.add("phase6-shake");
  }
  
  // Show power terminal immediately
  showPowerTerminal();
  
  // Update terminal with phase 7 commands
  updateTerminalWithPhase7Commands();
  
  // Show core activity monitoring terminals with staggered timing
  setTimeout(() => {
    showCoreActivityTerminal();
  }, 5000); // 5 seconds after Phase 7 starts
  
  setTimeout(() => {
    showEnergyMonitorTerminal();
  }, 10000); // 10 seconds after Phase 7 starts
  
  setTimeout(() => {
    showQuantumAnalysisTerminal();
  }, 15000); // 15 seconds after Phase 7 starts
  
  setTimeout(() => {
    showGravityAnalyzerTerminal();
  }, 20000); // 20 seconds after Phase 7 starts
  
  setTimeout(() => {
    showDimensionalScannerTerminal();
  }, 25000); // 25 seconds after Phase 7 starts
  
  setTimeout(() => {
    showSystemOverrideTerminal();
  }, 30000); // 30 seconds after Phase 7 starts
  
  // Start Phase 7 page shake
  setTimeout(() => {
    startPhase7PageShake();
  }, 2000); // Start shaking 2 seconds after Phase 7 begins
  
  // Start terminal kill system
  setTimeout(() => {
    startPhase7TerminalKills();
  }, 35000); // Start killing terminals 35 seconds after Phase 7 begins (after all terminals spawn)
  
  // Play internal explosion sound
  playWithCooldown("internalExplosion", "audio/internal_explosion.mp3", 1000, 0.8);
  
  // Check for stabilizer sound after a delay
  setTimeout(() => {
    const activeStabilizers = Object.values(stabilizers).filter(s => s.status !== 'gray' && s.status !== 'offline').length;
    if (activeStabilizers > 0) {
      playStabilizerSound();
    }
  }, 5000);
}

function stopPhase7Sequence() {
  phase7Active = false;
  if (phase7AnimationId) {
    cancelAnimationFrame(phase7AnimationId);
    phase7AnimationId = null;
  }
  hidePowerTerminal();
  
  // Stop stabilizer audio
  if (stabilizerAudio) {
    stabilizerAudio.pause();
    stabilizerAudio = null;
  }
  
  // Stop alarm7 audio
  if (alarm7Audio) {
    alarm7Audio.pause();
    alarm7Audio = null;
  }
  
  // Clear lightning strikes
  lightningStrikes = [];
  
  // Clear chaos terminals
  chaosTerminals.forEach(terminal => {
    if (terminal && terminal.parentNode) {
      terminal.remove();
    }
  });
  chaosTerminals = [];
  
  // Remove Phase 7 monitoring terminals
  const phase7Terminals = [
    'coreActivityTerminal',
    'quantumAnalysisTerminal', 
    'dimensionalScannerTerminal',
    'energyMonitorTerminal',
    'gravityAnalyzerTerminal',
    'systemOverrideTerminal'
  ];
  
  phase7Terminals.forEach(terminalId => {
    const terminal = document.getElementById(terminalId);
    if (terminal && terminal.parentNode) {
      terminal.remove();
    }
  });
  
  // Clean up notifications
  const container = document.getElementById('phase7Notifications');
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
  phase7Notifications = [];
  
  // Reset toaster position and clear particles
  const canvas = document.getElementById("toasterCanvas");
  if (canvas) {
    canvas.classList.remove("phase6-shake");
    canvas.style.position = '';
    canvas.style.left = '';
    canvas.style.top = '';
    canvas.style.zIndex = '';
    canvas.style.pointerEvents = '';
    canvas.style.animation = '';
  }
  
  // Clear particles and remove particle canvas
  toasterParticles = [];
  toasterFreed = false;
  if (particleCanvas && particleCanvas.parentNode) {
    particleCanvas.parentNode.removeChild(particleCanvas);
  }
  particleCanvas = null;
  particleCtx = null;
}

function updateTerminalWithPhase7Commands() {
  const terminal = document.getElementById('phase6Terminal');
  if (!terminal) return;
  
  terminal.innerHTML = '';
  let commandIndex = 0;
  
  const addCommand = () => {
    if (commandIndex < PHASE7_TERMINAL_COMMANDS.length) {
      const command = PHASE7_TERMINAL_COMMANDS[commandIndex];
      terminal.innerHTML += `> ${command}<br>`;
      terminal.scrollTop = terminal.scrollHeight;
      commandIndex++;
      setTimeout(addCommand, 1500);
    }
  };
  
  addCommand();
}

function playStabilizerSound() {
  if (stabilizerAudio) {
    stabilizerAudio.pause();
  }
  stabilizerAudio = new Audio("audio/stabilizer_sound.mp3");
  stabilizerAudio.loop = true;
  stabilizerAudio.volume = 0.6;
  stabilizerAudio.play();
}

function playStabilizerBeamSound() {
  const audio = new Audio("audio/stabilizer_sound_beam.mp3");
  audio.volume = 0.4;
  audio.currentTime = 0;
  audio.play();
}

function playAlarm7(brokenStabilizers) {
  if (alarm7Audio) {
    alarm7Audio.pause();
  }
  alarm7Audio = new Audio("audio/alarm7.ogg");
  const speedMultiplier = 1 + (brokenStabilizers * 0.1);
  alarm7Audio.playbackRate = Math.min(speedMultiplier, 1.8);
  alarm7Audio.loop = true;
  alarm7Audio.volume = 0.7;
  alarm7Audio.play();
}

function createLightningStrike(targetStabilizer) {
  const now = Date.now();
  if (now - lastLightningTime < 100) return; // Prevent spam
  
  lastLightningTime = now;
  
  const stabilizerPositions = {
    topLeft: { x: 20, y: 50 },
    topRight: { x: 380, y: 50 },
    rightTop: { x: 420, y: 100 },
    rightBottom: { x: 420, y: 280 },
    bottomLeft: { x: 20, y: 350 },
    bottomRight: { x: 380, y: 350 },
    leftTop: { x: -20, y: 100 },
    leftBottom: { x: -20, y: 280 }
  };
  
  const targetPos = stabilizerPositions[targetStabilizer];
  if (!targetPos) return;
  
  // Create lightning from toaster center to stabilizer
  const toasterCenter = { x: 200, y: 200 };
  
  lightningStrikes.push({
    startX: toasterCenter.x,
    startY: toasterCenter.y,
    endX: targetPos.x,
    endY: targetPos.y,
    intensity: 1.0,
    lifetime: 500 // 500ms duration
  });
  
  // Create lightning GIF effect
  createLightningGIFEffect(targetPos);
}

function createLightningGIFEffect(targetPos) {
  // Create lightning GIF overlay
  const lightningGif = document.createElement('img');
  lightningGif.src = 'visuals/lightning.gif';
  lightningGif.style.cssText = `
    position: fixed;
    left: ${targetPos.x - 25}px;
    top: ${targetPos.y - 25}px;
    width: 50px;
    height: 50px;
    z-index: 1001;
    pointer-events: none;
    opacity: 0.8;
  `;
  
  document.body.appendChild(lightningGif);
  
  // Remove after animation
  setTimeout(() => {
    if (lightningGif.parentNode) {
      lightningGif.parentNode.removeChild(lightningGif);
    }
  }, 1000);
}

function drawLightningStrikes() {
  const now = Date.now();
  
  for (let i = lightningStrikes.length - 1; i >= 0; i--) {
    const lightning = lightningStrikes[i];
    const age = now - lightning.lifetime;
    const progress = 1 - (age / 500);
    
    if (progress <= 0) {
      lightningStrikes.splice(i, 1);
      continue;
    }
    
    // Draw main lightning bolt
    ctx.strokeStyle = `rgba(255, 255, 255, ${progress * 0.9})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(lightning.startX, lightning.startY);
    
    // Add jagged lightning path
    const segments = 8;
    const dx = (lightning.endX - lightning.startX) / segments;
    const dy = (lightning.endY - lightning.startY) / segments;
    
    for (let j = 1; j <= segments; j++) {
      const x = lightning.startX + dx * j + (Math.random() - 0.5) * 20;
      const y = lightning.startY + dy * j + (Math.random() - 0.5) * 20;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(lightning.endX, lightning.endY);
    ctx.stroke();
    
    // Draw bright core
    ctx.strokeStyle = `rgba(200, 200, 255, ${progress * 0.7})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw glow effect
    ctx.strokeStyle = `rgba(100, 150, 255, ${progress * 0.3})`;
    ctx.lineWidth = 12;
    ctx.stroke();
    
    // Draw impact flash at stabilizer
    if (progress > 0.8) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(progress - 0.8) * 5})`;
      ctx.beginPath();
      ctx.arc(lightning.endX, lightning.endY, 15, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}

// Event polling for global sync
async function fetchEvents() {
  try {
    const res = await fetch(`${API}/events?sinceId=${lastEventId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const evts = data.events || [];
    for (const e of evts) {
      lastEventId = Math.max(lastEventId, e.id || 0);
      switch (e.type) {
        case "phase_change":
          currentPhase = e.phase;
          playPhaseMusic(e.phase);
          if (e.phase === 5) startMeltdownSequence();
          if (e.phase !== 5) stopMeltdownSequence();
          break;
        case "critical_browning_warning":
          playWithCooldown("criticalWarn", ALARMS.criticalBrowningWarning, 5000, 0.7);
          break;
        case "reactor_hum":
          playWithCooldown("reactorHum", ALARMS.reactorHum, 12000, 0.4);
          break;
        case "power_spike":
          playWithCooldown("powerSpike", ALARMS.powerSpike, 2000, 0.6);
          break;
        case "meltdown_start":
          playWithCooldown("totalFailure", ALARMS.totalFailure, 4000, 0.8);
          break;
        case "threshold_high_temp":
          playWithCooldown("highTemp", ALARMS.highTemp, 10000, 0.6);
          break;
        case "threshold_high_pressure":
          // Disabled during Phase 7
          if (currentPhase !== 7) {
            playWithCooldown("highPressure", ALARMS.highPressure, 10000, 0.6);
          }
          break;
        case "threshold_high_cookness":
          playWithCooldown("highCookness", ALARMS.highCookness, 10000, 0.6);
          break;
        case "severe_damage":
          playWithCooldown("severeDamage", ALARMS.severeDamage, 12000, 0.7);
          break;
        case "restab_start":
          playWithCooldown("pendingStall", ALARMS.pendingStall, 2000, 0.7);
          break;
        case "restab_success":
          playWithCooldown("ejectSuccess", ALARMS.ejectSuccess, 2000, 0.7);
          break;
        case "restab_fail":
          // handled by meltdown_start as well
          break;
        case "restab_timeout":
          // handled by meltdown_start as well
          break;
        case "shield_pulse":
          // UI will display via state; but we play subtle shield sound
          playWithCooldown("reactorShield", BUTTON_SFX.shieldToggle, 1500, 0.5);
          break;
        case "button_press":
          // Avoid double-playing local click: rely on local SFX on click only
          break;
        case "game_start":
          // Start phase 1 music on game start
          playPhaseMusic(1);
          break;
        case "internal_explosion":
          playWithCooldown("internalExplosion", ALARMS.internalExplosion, 1000, 0.8);
          break;
        case "case_broken":
          // Case breakage visual effect already handled in phase 7 animation
          break;
        case "stabilizer_spawned":
          playStabilizerBeamSound();
          break;
        case "lightning_strike":
          // Lightning strike visual effect
          createLightningStrike(e.target);
          const brokenCount = Object.values(stabilizers).filter(s => s.status === 'gray').length;
          if (brokenCount > 0) {
            playAlarm7(brokenCount);
          }
          break;
        case "spawn_chaos_terminal":
          // Spawn chaos terminal when stabilizer breaks
          createChaosTerminal(e.brokenStabilizer, e.totalBroken);
          // Trigger white flash effect when stabilizer breaks
          triggerWhiteFlash();
          break;
        case "all_stabilizers_broken":
          // Play boot.ogg when all stabilizers break
          const bootAudio = new Audio("audio/boot.ogg");
          bootAudio.volume = 0.7;
          bootAudio.play();
          // Trigger white flash effect when all stabilizers break
          triggerWhiteFlash();
          break;
        case "blackhole_explosion":
          // Trigger white flash and explosion
          triggerWhiteFlash();
          break;
        case "reset":
          try { 
            if (phaseAudio) { 
              phaseAudio.pause(); 
              phaseAudio.onended = null; 
              phaseAudio = null; 
              currentPhaseMusic = null; 
            } 
          } catch(_) {}
          stopMeltdownSequence();
          stopPhase7Sequence();
          for (let k in audioCooldowns) delete audioCooldowns[k];
          break;
      }
    }
  } catch(err) {
    console.error("Failed to fetch /events:", err);
  }
}

setInterval(fetchEvents, 500);

// Meltdown loop
function meltdownLoop() {
  drawToaster(100, true, true); // cookness maxed during meltdown
  meltdownAnimationId = requestAnimationFrame(meltdownLoop);
}

// Phase-specific ambient animation
function drawPhaseAmbient(state) {
  const phase = state.phase;
  const cook = state.meters.cookness;
  const heat = state.meters.heat;
  const pressure = state.meters.pressure;

  // Base toaster + slices
  drawToaster(cook, false, false);

  // Phase overlays
  if (phase === 1) {
    // Calibration: subtle glow pulse
    const t = Date.now() * 0.002;
    const alpha = 0.1 + 0.05 * (1 + Math.sin(t));
    ctx.fillStyle = `rgba(0, 200, 255, ${alpha})`;
    ctx.fillRect(100, 140, 200, 120);
  } else if (phase === 2) {
    // Ignition: occasional gentle sparks
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = `rgba(${200+Math.random()*55}, ${100+Math.random()*155}, 0, 0.6)`;
      ctx.fillRect(Math.random()*400, 170 + Math.random()*70, 2, 2);
    }
  } else if (phase === 3) {
    // Critical Browning: mild reactor effects with gentle shake
    const t = Date.now() * 0.003;
    
    // Add shake class to canvas
    const canvas = document.getElementById("toasterCanvas");
    if (canvas) {
      canvas.classList.add("phase3-shake");
    }
    
    // BRIGHT orange glow to make it obvious
    const glowAlpha = 0.3 + 0.2 * Math.sin(t * 4);
    ctx.fillStyle = `rgba(255, 150, 0, ${glowAlpha})`;
    ctx.fillRect(80, 120, 240, 160);
    
    // Heat shimmer waves - make them more visible
    for (let i = 0; i < 8; i++) {
      const y = 140 + Math.sin((t + i * 0.5) * 2) * 8 + i * 15;
      const alpha = 0.4 + 0.3 * Math.sin(t * 3 + i);
      ctx.fillStyle = `rgba(255, ${150 + i * 10}, 0, ${alpha})`;
      ctx.fillRect(100, y, 200, 5); // Make thicker
    }
    
    // Bright sparks around toaster
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = `rgba(255, ${150 + Math.random()*100}, 0, 0.8)`;
      const x = 70 + Math.random() * 260;
      const y = 110 + Math.random() * 180;
      ctx.fillRect(x, y, 3, 3); // Make bigger
    }
  } else if (phase === 4) {
    debugLog("Drawing Phase 4: Intense overdrive effects");
    // Overdrive: intense effects with heavy shake
    const t = Date.now() * 0.005;
    
    // Add intense shake class to canvas
    const canvas = document.getElementById("toasterCanvas");
    if (canvas) {
      canvas.classList.add("phase4-shake");
    }
    
    // BRIGHT red glow with intense pulsing
    const glowAlpha = 0.5 + 0.3 * Math.sin(t * 6);
    ctx.fillStyle = `rgba(255, 20, 0, ${glowAlpha})`;
    ctx.fillRect(70, 110, 260, 180);
    
    // Violent heat waves - make them more visible
    for (let i = 0; i < 12; i++) {
      const y = 130 + Math.sin((t + i * 0.3) * 4) * 12 + i * 12;
      const alpha = 0.6 + 0.4 * Math.sin(t * 5 + i);
      ctx.fillStyle = `rgba(255, ${80 + i * 15}, 0, ${alpha})`;
      ctx.fillRect(90, y, 220, 8); // Make thicker
    }
    
    // MASSIVE sparks everywhere
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(255, ${Math.random()*100}, 0, 1.0)`;
      const x = 60 + Math.random() * 280;
      const y = 100 + Math.random() * 200;
      ctx.fillRect(x, y, 5, 5); // Make bigger
    }
    
    // Overdrive energy beams - make them more visible
    for (let i = 0; i < 8; i++) {
      const angle = (t * 2 + i) * Math.PI / 4;
      const x = 200 + Math.cos(angle) * 120;
      const y = 200 + Math.sin(angle) * 120;
      ctx.fillStyle = `rgba(255, 150, 0, 0.9)`;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2); // Make bigger
      ctx.fill();
    }
  }
}

async function phaseAnimationLoop() {
  try {
    const res = await fetch(`${API}/state`);
    const state = await res.json();
    if (state.phase === 5) {
      // Handled by meltdown loop
      if (phaseAnimId) { cancelAnimationFrame(phaseAnimId); phaseAnimId = null; }
      if (!meltdownAnimationId) meltdownAnimationId = requestAnimationFrame(meltdownLoop);
      return;
    }
    if (state.phase === 6) {
      // Handled by phase 6 loop
      if (phaseAnimId) { cancelAnimationFrame(phaseAnimId); phaseAnimId = null; }
      return;
    }
    if (state.phase === 7) {
      // Handled by phase 7 loop
      if (phaseAnimId) { cancelAnimationFrame(phaseAnimId); phaseAnimId = null; }
      return;
    }
    if (state.phase === 8) {
      // Handled by phase 8 loop
      if (phaseAnimId) { cancelAnimationFrame(phaseAnimId); phaseAnimId = null; }
      return;
    }
    if (meltdownAnimationId) { cancelAnimationFrame(meltdownAnimationId); meltdownAnimationId = null; }
    drawPhaseAmbient(state);
  } catch(_) {}
  phaseAnimId = requestAnimationFrame(phaseAnimationLoop);
}

// Button press
async function press(btn) {
  // Unlock audio on first user gesture
  if (!audioUnlockedByGesture) {
    audioUnlockedByGesture = true;
    // Re-kick current phase music if any
    playPhaseMusic(currentPhaseMusic || 1);
  }
  if (BUTTON_SFX[btn]) playSFX(BUTTON_SFX[btn]);
  
  try {
    const pressRes = await fetch(`${API}/press/${btn}`, { method: "POST" });
    if (!pressRes.ok) throw new Error(`Press failed: ${pressRes.status}`);
  } catch (err) {
    console.error(`Failed to press ${btn}:`, err);
    showErrorBanner(true);
    return;
  }

  try {
    const res = await fetch(`${API}/state`);
    if (!res.ok) throw new Error(`State fetch failed: ${res.status}`);
    const state = await res.json();
    currentPhase = state.phase;

    if (state.phase === "Restabilization" && typeof state.restab?.coilCounter === "number") {
      coilCounter = state.restab.coilCounter;
      document.getElementById("coilCounter").innerText = coilCounter;
    }

    memeCheckPassed = computeRestabilizationMemeCheck(state.buttons);

    if (btn === "heatCoils" && (state.phase === 3 || state.phase === 4)) {
      playWithCooldown("powerSpike", ALARMS.powerSpike, 1500, 0.55);
    }

  } catch (err) {
    console.error(`Failed to fetch state after press:`, err);
    showErrorBanner(true);
    return;
  }

  fetchState();
}

// Ignition
async function ignition() {
  if (!audioUnlockedByGesture) {
    audioUnlockedByGesture = true;
    playPhaseMusic(currentPhaseMusic || 1);
  }
  if (BUTTON_SFX["ignition"]) playSFX(BUTTON_SFX["ignition"]);
  const wasRestabilizing = currentPhase === "Restabilization";

  let state;
  try {
    const ignitionRes = await fetch(`${API}/ignition`, { method: "POST" });
    if (!ignitionRes.ok) throw new Error(`Ignition failed: ${ignitionRes.status}`);
    const res = await fetch(`${API}/state`);
    if (!res.ok) throw new Error(`State fetch failed: ${res.status}`);
    state = await res.json();
    currentPhase = state.phase;
    memeCheckPassed = computeRestabilizationMemeCheck(state.buttons);
    showErrorBanner(false);
  } catch (err) {
    console.error("Failed to trigger ignition:", err);
    showErrorBanner(true);
    return;
  }

  if (wasRestabilizing) {
    if (state.phase === 3) {
      alert("🎉 Restabilization success! Bread saved!");
    } else if (state.phase === 5) {
      alert("❌ Restabilization failed! Meltdown!");
    }
  }

  fetchState();
}

// Reset
async function resetGame() {
  coilCounter = 0;
  memeCheckPassed = false;
  caseIntegrity = 100;
  powerInput = 240;
  powerOutput = 240;
  stabilizers = {};
  lightningStrikes = [];
  blackholeSize = 10;
  blackholeIntensity = 0;
  chaosTerminals = [];
  terminalCounter = 0;
  await fetch(`${API}/reset`, { method: "POST" });
  // Stop any phase music immediately and clear handlers
  try { 
    if (phaseAudio) { 
      phaseAudio.pause(); 
      phaseAudio.onended = null; 
      phaseAudio = null; 
      currentPhaseMusic = null; 
    } 
  } catch(_) {}
  // Clear audio cooldowns
  for (let k in audioCooldowns) delete audioCooldowns[k];
  // Clear restab timer
  restabDeadlineAt = null;
  if (restabTimerInterval) { clearInterval(restabTimerInterval); restabTimerInterval = null; }
  // Stop phase sequences
  stopPhase6Sequence();
  stopPhase7Sequence();
  stopPhase8Sequence();
  window.__prevPhase = undefined;
  fetchState();
}

setInterval(fetchState, 1000);
fetchState();

// (Keyboard controls removed per spec; click-only interactions)
window.addEventListener("DOMContentLoaded", () => {
  const btnHeat = document.getElementById("btnHeat");
  const btnCoolant = document.getElementById("btnCoolant");
  const btnShield = document.getElementById("btnShield");
  const btnIgnition = document.getElementById("btnIgnition");
  const btnReset = document.getElementById("btnReset");
  if (btnHeat) btnHeat.addEventListener("click", () => press("heatCoils"));
  if (btnCoolant) btnCoolant.addEventListener("click", () => press("coolantPump"));
  if (btnShield) btnShield.addEventListener("click", () => press("shieldToggle"));
  if (btnIgnition) btnIgnition.addEventListener("click", () => ignition());
  if (btnReset) btnReset.addEventListener("click", () => resetGame());
});

function createAdditionalFloatingElements() {
  const blackholeX = window.innerWidth / 2;
  const blackholeY = window.innerHeight / 2;
  const blackholeSize = 100;
  const ringRadius = blackholeSize + 200;
  
  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
  const texts = ['ERROR', 'WARNING', 'CRITICAL', 'FAILURE', 'MELTDOWN', 'EXPLOSION', 'CHAOS', 'DESTRUCTION'];
  
  for (let i = 0; i < PHASE8_EXTRA_FLOATERS; i++) {
    const div = document.createElement('div');
    div.textContent = texts[i % texts.length];
    div.className = 'floating-spin-element';
    
    const angle = (i / PHASE8_EXTRA_FLOATERS) * Math.PI * 2 + Math.random() * 0.15;
    
    const x = blackholeX + Math.cos(angle) * ringRadius;
    const y = blackholeY + Math.sin(angle) * ringRadius;
    
    div.style.cssText = `
      position: fixed;
      color: #ffffff;
      font-weight: bold;
      font-size: ${18 + Math.random() * 10}px;
      text-shadow: 0 0 10px currentColor;
      pointer-events: none;
      z-index: ${FLOATING_ELEMENT_Z_INDEX};
      white-space: nowrap;
      opacity: 1;
      border: 2px solid ${colors[i % colors.length]};
      padding: 10px 14px;
      border-radius: 12px;
      background: rgba(18, 12, 28, 0.8);
      box-shadow: 0 0 12px ${colors[i % colors.length]};
    `;
    
    document.body.appendChild(div);
    const rect = div.getBoundingClientRect();
    
    floatingElements.push({
      element: div,
      originalX: x,
      originalY: y,
      x: x,
      y: y,
      width: rect.width,
      height: rect.height,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.04,
      isTerminal: false,
      elementType: 'div',
      originalDisplay: 'block',
      originalPosition: 'fixed',
      originalTransform: 'none'
    });
    div.style.willChange = 'transform, left, top';
  }
}

function startBlackholeStatusTerminals() {
  if (!phase8Active) return;

  const terminalCount = 2;
  const spawnInterval = 5000;
  let spawnedCount = 0;
  
  const spawnTerminal = () => {
    if (!phase8Active || spawnedCount >= terminalCount) return;
    
    const terminal = document.createElement('div');
    terminal.className = 'blackhole-status-terminal';
    terminal.style.cssText = `
      position: fixed;
      width: 280px;
      height: 180px;
      background: rgba(0, 0, 0, 0.95);
      border: 3px solid #ff0000;
      border-radius: 8px;
      color: #00ff00;
      font-family: "Courier New", monospace;
      font-size: 10px;
      padding: 10px;
      z-index: ${FLOATING_ELEMENT_Z_INDEX};
      overflow: hidden;
      box-shadow: 0 0 20px #ff0000;
      left: ${Math.max(FLOATING_VIEWPORT_PADDING, Math.random() * Math.max(1, window.innerWidth - 320))}px;
      top: ${Math.max(FLOATING_VIEWPORT_PADDING, Math.random() * Math.max(1, window.innerHeight - 220))}px;
    `;
    
    // Add terminal content with commands
    terminal.innerHTML = `
      <div style="font-size: 12px; margin-bottom: 10px; color: #ff0000;">BLACKHOLE STATUS TERMINAL</div>
      <div id="statusCommands" style="font-size: 8px; line-height: 1.2; max-height: 140px; overflow-y: auto;">
        <div style="color: #00ff00;">$ blackhole --status</div>
        <div style="color: #ffff00;">ERROR: Command not found</div>
        <div style="color: #00ff00;">$ singularity --check</div>
        <div style="color: #ff0000;">ERROR: Not found</div>
        <div style="color: #00ff00;">$ quantum --analyze</div>
        <div style="color: #ffff00;">ERROR: Not found</div>
        <div style="color: #00ff00;">$ gravity --measure</div>
        <div style="color: #ff0000;">ERROR: Not found</div>
        <div style="color: #00ff00;">$ spacetime --scan</div>
        <div style="color: #ffff00;">ERROR: Not found</div>
        <div style="color: #ff0000;">CRITICAL: All systems offline</div>
        <div style="color: #ffff00;">WARNING: Blackhole status unknown</div>
        <div style="color: #ff0000;">ERROR: Cannot establish connection</div>
      </div>
    `;
    
    document.body.appendChild(terminal);
    
    // Add flashing effect
    let flashCount = 0;
    const maxFlashes = 8;
    const flashInterval = setInterval(() => {
      if (!phase8Active) {
        clearInterval(flashInterval);
        if (terminal.parentNode) {
          terminal.remove();
        }
        return;
      }
      if (flashCount >= maxFlashes) {
        clearInterval(flashInterval);
        // After flashing, add terminal to floating system
        addTerminalToFloating(terminal);
        return;
      }
      
      // Flash between red, blue, and yellow
      const colors = ['#ff0000', '#0000ff', '#ffff00'];
      const color = colors[flashCount % colors.length];
      terminal.style.border = `3px solid ${color}`;
      terminal.style.boxShadow = `0 0 20px ${color}`;
      
      flashCount++;
    }, 200);
    
    spawnedCount++;
  };
  
  // Start spawning terminals
  const spawnTimer = setInterval(() => {
    if (!phase8Active) {
      clearInterval(spawnTimer);
      return;
    }
    spawnTerminal();
    if (spawnedCount >= terminalCount) {
      clearInterval(spawnTimer);
    }
  }, spawnInterval);
  
  // Spawn first terminal immediately
  spawnTerminal();
}

function addTerminalToFloating(terminal) {
  const blackholeX = window.innerWidth / 2;
  const blackholeY = window.innerHeight / 2;
  const baseRadius = 300 + Math.random() * 200; // Random distance from blackhole
  const angle = Math.random() * Math.PI * 2;
  
  const rect = terminal.getBoundingClientRect();
  const x = blackholeX + Math.cos(angle) * baseRadius - rect.width / 2;
  const y = blackholeY + Math.sin(angle) * baseRadius - rect.height / 2;
  
  floatingElements.push({
    element: terminal,
    originalX: rect.left,
    originalY: rect.top,
    x: x,
    y: y,
    width: rect.width,
    height: rect.height,
    vx: (Math.random() - 0.5) * 0.18,
    vy: (Math.random() - 0.5) * 0.18,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.03,
    isTerminal: true,
    elementType: 'div',
    originalDisplay: 'block',
    originalPosition: 'fixed',
    originalTransform: 'none'
  });
  terminal.style.zIndex = String(FLOATING_ELEMENT_Z_INDEX);
  terminal.style.willChange = 'transform, left, top';
}
