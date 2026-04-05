# Nuclear Toaster Reactor (T.C.R) – Discord SDK Activity Prototype

## Project Overview

The **Nuclear Toaster Reactor (T.C.R)** is a Discord SDK interactive activity prototype built in **Node.js** with a 2D frontend. Players manage a high-risk nuclear toaster and must carefully balance multiple meters to cook bread without causing a meltdown.  

The activity is designed to integrate with Discord voice channels using **activities** and can be run entirely from a **Render web service**, with frontend assets and audio served via Express.

---

## Gameplay Concept

Players interact with a **nuclear toaster** that has 4 primary meters:

1. **Radiation** – Keep this as low as possible.
2. **Cookness** – Measures how toasted the bread is.
3. **Heat** – Speeds up cooking but destabilizes the reactor if too high.
4. **Pressure** – High pressure risks overcooking and prevents bread ejection.

Players control the toaster using **buttons** corresponding to different actions:

- Heat Coils
- Coolant Pump
- Shield Toggle
- Ignition

The game progresses through **5 phases**:

1. **Calibration** – Phase 1 music plays, players learn the mechanics.
2. **Ignition** – Start the reactor safely.
3. **Critical Browning** – Manage cookness carefully.
4. **Overdrive** – High stakes, pushes the reactor near meltdown.
5. **Restabilization / Meltdown** – Restabilization can be triggered only during Overdrive:
   - Players must set all buttons to “21” (the meme) and press ignition.
   - Heat coil must be spammed to 5000% (simulated; UI capped at 100%).
   - **There is a timer until meltdown**, so players cannot restabilize indefinitely.
   - Failing this triggers a dramatic meltdown animation with sparks and fire.
   
**Restabilization Notes:**
- Checks are performed every 2 seconds.
- Visual feedback shows coil counter, meme check, and remaining time before meltdown.
- Sparks animation during Restabilization for dramatic effect.

---

## Current Progress

✅ **Frontend:**  
- Canvas-based toaster and bread animation.  
- Sparks animation during Restabilization.  
- Bread browning visualized.  
- UI displays meters and phases.  
- Button SFX integrated.  
- Phase music integrated.  

✅ **Audio Assets:**  
- Phase music for all 5 phases uploaded.  
- Sound effects for button clicks, alarms, meltdown, overdrive, etc.

✅ **Gameplay Mechanics:**  
- Basic phase progression implemented.  
- Restabilization logic with meme check, coil spam, and timer implemented.  
- Meltdown animation added.

💀 **Backend / Node.js:**  
- API skeleton exists but full logic for meters, phase transitions, Restabilization timer, and player actions needs refinement.  

💀 **Render Deployment:**  
- Directory structure and package.json currently misaligned.  
- Web service config pending finalization.

---

## Directory Structure

```
/jarvis-tcr
│
├── package.json          <-- Node dependencies + start script
├── server.js             <-- Backend API
├── render.yaml           <-- Render configuration
├── /frontend
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── /audio
│       ├── awaiting_ignition.mp3
│       ├── button_click.mp3
│       └── ... other mp3s
└── /img                  <-- optional image assets
```

---

## What Needs To Be Done

1. **Backend Completion**  
   - Implement complete API logic for:
     - Phase progression and timing
     - Meter changes over time and player interactions
     - Restabilization checks (meme + coil counter + meltdown timer)
     - Meltdown triggers
   - Track player actions per button press.
   - Serve static frontend assets via Express.

2. **Deployment Preparation**  
   - Fix directory structure for Render deployment.
   - Ensure `package.json` exists at root.
   - Test npm install and start commands:
     - Build: `npm install`
     - Start: `npm start`
   - Ensure environment variables (e.g., PORT) are handled by Render.

3. **Frontend Enhancements**  
   - Improve animation for sparks, fire, and bread browning.
   - Add interactive visual feedback for buttons, meters, and remaining Restabilization time.
   - Optional: Add more sound effects or dynamic music transitions.

4. **Testing & Debugging**  
   - Full end-to-end test of phase progression.
   - Validate Restabilization logic, meme check, coil spam, and meltdown timer.
   - Ensure multiplayer interactions (if multiple players control buttons).

5. **Documentation & Final Polish**  
   - Add proper comments to scripts.
   - Provide README for deployment instructions.
   - Include all required audio and image assets in the repo.

---

## Notes for the AI / Developer

- This project is a **prototype**, not yet fully functional.  
- The AI should **complete backend API logic**, integrate all meters, phase progression, and Restabilization timer, and finalize the Render deployment structure.  
- All frontend interactivity, canvas animation, and audio logic are mostly complete; focus should be on **backend + deployment + testing**.  
- Respect the quirky “nuclear toaster” theme — it’s intentionally absurd, e.g., meme checks, exaggerated coil spam, meltdown drama.  
- Remember: players cannot restabilize indefinitely; the timer must force progression to either success or meltdown.

---

## References

- Discord SDK Activities: [https://discord.com/developers/docs/game-sdk/activities](https://discord.com/developers/docs/game-sdk/activities)  
- Render Deployment Docs: [https://render.com/docs](https://render.com/docs)  
- Node.js Express Static File Serving: [https://expressjs.com/en/starter/static-files.html](https://expressjs.com/en/starter/static-files.html)

---

**Project Status:** Prototype stage, backend and deployment pending completion, Restabilization timer added.