document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("appVersion").textContent = "V1 - 12/02/2026";
});

// ================== Storage helpers ==================
const STORAGE_KEY = "joueMaVie";
const DATA_VERSION = 1;

function todayLocal() {
  return new Date();
}

function getISOWeekKey(date = todayLocal()) {
  // ISO week number (approx) using local time
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const year = d.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

function getMonthKey(date = todayLocal()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function defaultData() {
  return {
    version: DATA_VERSION,
    playerName: null,

    // goals configurable
    settings: {
      weekLoad: "normal",
      weekGoals: { busy: 150, normal: 250, light: 400 },
      monthGoal: 1000,

      // Level curve (progressive)
      levelBase: 120,
      levelGrowth: 1.18
    },

    // current period keys
    periods: {
      weekKey: getISOWeekKey(),
      monthKey: getMonthKey()
    },

    global: {
      totalXp: 0,
      weekXp: 0,
      monthXp: 0
    },

    worlds: {}, // id -> world
    activeWorldId: null
  };
}

let settingsReturnTo = "home"; // "home" ou "world"


function load() {
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
  const data = raw && typeof raw === "object" ? raw : defaultData();

  // ensure defaults exist
  if (!data.settings) data.settings = defaultData().settings;
  if (!data.periods) data.periods = defaultData().periods;
  if (!data.global) data.global = defaultData().global;
  if (!data.worlds) data.worlds = {};
  if (data.settings.weekGoals == null) data.settings.weekGoals = defaultData().settings.weekGoals;

  // reset week/month if keys changed
  const wk = getISOWeekKey();
  const mk = getMonthKey();
  if (data.periods.weekKey !== wk) {
    data.periods.weekKey = wk;
    data.global.weekXp = 0;
    Object.values(data.worlds).forEach(w => { if (w?.stats) w.stats.weekXp = 0; });
  }
  if (data.periods.monthKey !== mk) {
    data.periods.monthKey = mk;
    data.global.monthXp = 0;
    Object.values(data.worlds).forEach(w => { if (w?.stats) w.stats.monthXp = 0; });
  }

  return data;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = load();

// ================== DOM ==================
const el = (id) => document.getElementById(id);

const onboardingScreen = el("onboardingScreen");
const homeScreen = el("homeScreen");
const worldScreen = el("worldScreen");
const settingsScreen = el("settingsScreen");

// onboarding
const playerNameInput = el("playerNameInput");
const startBtn = el("startBtn");

// home stats
const playerNameEl = el("playerName");
const globalLevelEl = el("globalLevel");
const globalXpEl = el("globalXp");

const weekLoadPicker = el("weekLoadPicker");
const weekXpEl = el("weekXp");
const weekGoalEl = el("weekGoal");
const weekProgressEl = el("weekProgress");

const monthXpEl = el("monthXp");
const monthGoalEl = el("monthGoal");
const monthProgressEl = el("monthProgress");

// home worlds
const worldsListEl = el("worldsList");
const openAddWorldBtn = el("openAddWorldBtn");
const addWorldModal = el("addWorldModal");
const worldNameInput = el("worldNameInput");
const worldIconInput = el("worldIconInput");
const minutesBaseInput = el("minutesBaseInput");
const xpBaseInput = el("xpBaseInput");
const createWorldBtn = el("createWorldBtn");
const cancelWorldBtn = el("cancelWorldBtn");

// world page
const backHomeBtn = el("backHomeBtn");
const worldHeaderTitle = el("worldHeaderTitle");
const entriesListEl = el("entriesList");

const worldLevelEl = el("worldLevel");
const worldWeekXpEl = el("worldWeekXp");
const worldTotalXpEl = el("worldTotalXp");
const worldRuleTextEl = el("worldRuleText");
const worldTotalTimeEl = el("worldTotalTime");

const timeMinutesInput = el("timeMinutesInput");
const validateTimeBtn = el("validateTimeBtn");
const timePreviewEl = el("timePreview");

const objectivesListEl = el("objectivesList");
const objectiveTypeSelect = el("objectiveTypeSelect");

const objectiveFieldsRepeatable = el("objectiveFieldsRepeatable");
const objectiveFieldsUnique = el("objectiveFieldsUnique");
const objectiveFieldsMilestone = el("objectiveFieldsMilestone");

const objNameInput = el("objNameInput");
const objXpInput = el("objXpInput");
const objNameUniqueInput = el("objNameUniqueInput");
const objXpUniqueInput = el("objXpUniqueInput");

const milestonePrefixInput = el("milestonePrefixInput");
const milestoneSuffixInput = el("milestoneSuffixInput");
const milestoneCountInput = el("milestoneCountInput");
const milestoneXpInput = el("milestoneXpInput");
const addMilestoneStepBtn = el("addMilestoneStepBtn");
const milestoneStepsPreview = el("milestoneStepsPreview");
const createMilestoneObjectiveBtn = el("createMilestoneObjectiveBtn");

const createObjectiveBtn = el("createObjectiveBtn");

// settings
const openSettingsBtn = el("openSettingsBtn");
const backFromSettingsBtn = el("backFromSettingsBtn");

const monthGoalInput = el("monthGoalInput");
const weekGoalBusyInput = el("weekGoalBusyInput");
const weekGoalNormalInput = el("weekGoalNormalInput");
const weekGoalLightInput = el("weekGoalLightInput");
const saveGoalsBtn = el("saveGoalsBtn");

const manageWorldsList = el("manageWorldsList");
const resetGameBtn = el("resetGameBtn");

// popup
const popupEl = el("popup");

// quick world settings (future)
const worldQuickSettingsBtn = el("worldQuickSettingsBtn");

function forceCloseAddWorldModal() {
  const modal = document.getElementById("addWorldModal");
  if (!modal) return;

  // Cache de manière sûre, même si le CSS/class bug
  modal.classList.add("hidden");
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
}

function forceOpenAddWorldModal() {
  const modal = document.getElementById("addWorldModal");
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.style.display = "flex"; // ou "block" selon ton CSS
  modal.setAttribute("aria-hidden", "false");
}

// ================== UI helpers ==================
function showScreen(which) {
  [onboardingScreen, homeScreen, worldScreen, settingsScreen].forEach(s => s.classList.add("hidden"));
  which.classList.remove("hidden");
}

function setActiveTab(containerSection, tabId) {
  const tabs = containerSection.querySelectorAll(".tab-btn");
  tabs.forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
  const panels = containerSection.querySelectorAll(".tab-panel");
  panels.forEach(p => p.classList.toggle("hidden", p.id !== tabId));
}

function showPopup(text) {
  if (!popupEl) return;
  popupEl.innerText = text;
  popupEl.style.display = "block";
  clearTimeout(showPopup._t);
  showPopup._t = setTimeout(() => {
    popupEl.style.display = "none";
  }, 1600);
}

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

// ================== Levels (progressive curve) ==================
function xpForNextLevel(level, base, growth) {
  // xp needed to go from level -> level+1 (progressive)
  return Math.round(base * Math.pow(growth, Math.max(0, level - 1)));
}

function levelFromXp(totalXp, base, growth) {
  let level = 1;
  let remaining = totalXp;
  // safety cap
  for (let i = 0; i < 500; i++) {
    const need = xpForNextLevel(level, base, growth);
    if (remaining < need) break;
    remaining -= need;
    level++;
  }
  return level;
}

function levelsGained(prevXp, newXp, base, growth) {
  const prev = levelFromXp(prevXp, base, growth);
  const now = levelFromXp(newXp, base, growth);
  return { prev, now };
}

// ================== Core rules ==================
function getWeekGoal() {
  const load = state.settings.weekLoad || "normal";
  return state.settings.weekGoals?.[load] ?? 250;
}

function getMonthGoal() {
  return Number(state.settings.monthGoal) || 1000;
}

function calculateTimeXp(world, minutes) {
  const m = Number(world.rules.minutesBase) || 30;
  const x = Number(world.rules.xpBase) || 10;
  const raw = (minutes / m) * x;
  // round to make it feel fair
  return Math.max(1, Math.round(raw));
}

function addXp(worldId, xp, reasonText) {
  const w = state.worlds[worldId];
  if (!w) return;

  const prevGlobalXp = state.global.totalXp;
  const prevWorldXp = w.stats.totalXp;

  // apply
  state.global.totalXp += xp;
  state.global.weekXp += xp;
  state.global.monthXp += xp;

  w.stats.totalXp += xp;
  w.stats.weekXp += xp;
  w.stats.monthXp += xp;

  save();

  showPopup(`${reasonText} +${xp} XP`);

  // level up popups (global & world)
  const { prev: gPrev, now: gNow } = levelsGained(prevGlobalXp, state.global.totalXp, state.settings.levelBase, state.settings.levelGrowth);
  if (gNow > gPrev) showPopup(`🎉 Niveau global ${gNow} atteint !`);

  const { prev: wPrev, now: wNow } = levelsGained(prevWorldXp, w.stats.totalXp, state.settings.levelBase, state.settings.levelGrowth);
  if (wNow > wPrev) showPopup(`⭐ Niveau ${wNow} atteint dans ${w.icon} ${w.name} !`);

  // rerender relevant
  renderHomeStats();
  renderWorldStats();
}

// ================== Rendering ==================
function renderOnboardingOrHome() {
  if (!state.playerName) {
    showScreen(onboardingScreen);
  } else {
    showScreen(homeScreen);
    renderHome();
  }
}

function renderHome() {
  renderHomeStats();
  renderWorlds();
}

function renderHomeStats() {
  playerNameEl.innerText = state.playerName || "";
  globalXpEl.innerText = state.global.totalXp ?? 0;
  globalLevelEl.innerText = levelFromXp(state.global.totalXp ?? 0, state.settings.levelBase, state.settings.levelGrowth);

  // week load buttons
  const buttons = weekLoadPicker.querySelectorAll("button");
  buttons.forEach(b => {
    b.classList.toggle("active", b.dataset.load === state.settings.weekLoad);
    b.onclick = () => {
      state.settings.weekLoad = b.dataset.load;
      save();
      renderHomeStats();
    };
  });

  const wg = getWeekGoal();
  weekXpEl.innerText = state.global.weekXp ?? 0;
  weekGoalEl.innerText = wg;
  const wPct = clamp01((state.global.weekXp ?? 0) / wg);
  weekProgressEl.style.width = `${Math.round(wPct*100)}%`;
  weekProgressEl.innerText = `${Math.round(wPct*100)}%`;

  const mg = getMonthGoal();
  monthXpEl.innerText = state.global.monthXp ?? 0;
  monthGoalEl.innerText = mg;
  const mPct = clamp01((state.global.monthXp ?? 0) / mg);
  monthProgressEl.style.width = `${Math.round(mPct*100)}%`;
  monthProgressEl.innerText = `${Math.round(mPct*100)}%`;
}

function renderWorlds() {
  worldsListEl.innerHTML = "";

  const activeWorlds = Object.values(state.worlds).filter(w => w && w.active !== false);

  if (activeWorlds.length === 0) {
    worldsListEl.innerHTML = `<div class="card"><p>Aucun monde créé pour l’instant.</p></div>`;
    return;
  }

  activeWorlds.forEach(world => {
    const btn = document.createElement("button");
    btn.className = "world-btn";
    btn.innerText = `${world.icon} ${world.name}`;
    btn.onclick = () => openWorld(world.id);
    worldsListEl.appendChild(btn);
  });
}

function renderWorldScreen() {
  const w = state.worlds[state.activeWorldId];
  if (!w) return;
  renderEntries();

  worldHeaderTitle.innerText = `${w.icon} ${w.name}`;

  // tabs
  const worldTabs = worldScreen.querySelectorAll(".tab-btn");
  worldTabs.forEach(btn => {
    btn.onclick = () => setActiveTab(worldScreen, btn.dataset.tab);
  });
  setActiveTab(worldScreen, "worldStats");

  // input preview
  timeMinutesInput.value = "";
  timePreviewEl.innerText = "";
  timeMinutesInput.oninput = () => {
    const minutes = parseInt(timeMinutesInput.value, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      timePreviewEl.innerText = "";
      return;
    }
    const xp = calculateTimeXp(w, minutes);
    timePreviewEl.innerText = `≈ ${xp} XP gagnée(s)`;
  };

  renderWorldStats();
  renderObjectives();
}

function renderWorldStats() {
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  worldLevelEl.innerText = levelFromXp(w.stats.totalXp, state.settings.levelBase, state.settings.levelGrowth);
  worldWeekXpEl.innerText = w.stats.weekXp ?? 0;
  worldTotalXpEl.innerText = w.stats.totalXp ?? 0;
  worldRuleTextEl.innerText = `${w.rules.minutesBase} min = ${w.rules.xpBase} XP`;
  worldTotalTimeEl.innerText = w.stats.timeTotal ?? 0;
}

function renderObjectives() {
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  objectivesListEl.innerHTML = "";

  const list = Array.isArray(w.objectives) ? w.objectives : (w.objectives = []);
  if (list.length === 0) {
    objectivesListEl.innerHTML = `<p class="hint">Aucun objectif pour l’instant.</p>`;
    return;
  }

  list.forEach(obj => {
    const row = document.createElement("div");
    row.className = "objective-row";

    const label = document.createElement("div");
    label.className = "label";

    const badge = document.createElement("span");
    badge.className = "badge";

    let title = "";
    let canValidate = true;
    let xp = 0;

    if (obj.type === "repeatable") {
      const done = obj.doneCount || 0;
      title = `${obj.name}`;
      badge.innerText = `🔁 x${done}`;
      xp = obj.xp;
    } else if (obj.type === "unique") {
      title = obj.name;
      badge.innerText = obj.done ? "✅" : "⭐";
      xp = obj.xp;
      canValidate = !obj.done;
      if (obj.done) label.style.textDecoration = "line-through";
        } else if (obj.type === "milestone") {
      const steps = obj.steps || [];
      const doneSteps = steps.filter(s => s.done);
      const lastDone = doneSteps.length ? doneSteps[doneSteps.length - 1] : null;
      const next = steps.find(s => !s.done) || null;

      if (!next && !lastDone) {
        // cas bizarre: pas de steps
        label.innerText = "(objectif palier vide)";
        badge.innerText = "📈";
        canValidate = false;
        xp = 0;
      } else if (!next && lastDone) {
        // terminé
        label.innerText = `${obj.prefix} ${lastDone.count} ${obj.suffix} ✅`;
        badge.innerText = "✅";
        canValidate = false;
        xp = 0;
        label.style.textDecoration = "line-through";
      } else {
        // actif (prochain palier)
        const lastDoneHtml = lastDone
          ? `<div style="opacity:.65;text-decoration:line-through;">${obj.prefix} ${lastDone.count} ${obj.suffix} ✅</div>`
          : "";
        const nextHtml = `<div><strong>${obj.prefix} ${next.count} ${obj.suffix}</strong></div>`;

        label.innerHTML = `${lastDoneHtml}${nextHtml}`;
        badge.innerText = "📈";
        canValidate = true;
        xp = next.xp;
      }
    }

    if (obj.type !== "milestone") {
    label.innerText = title;
    }

    const btn = document.createElement("button");
    btn.innerText = canValidate ? `${xp} XP` : "✓";
    btn.disabled = !canValidate;
    btn.onclick = () => validateObjective(obj.id);

    row.appendChild(label);
    row.appendChild(badge);
    row.appendChild(btn);
    objectivesListEl.appendChild(row);
  });
}

function formatDateTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function canDeleteEntry(entry) {
  const ageMs = Date.now() - entry.createdAt;
  return ageMs <= 24 * 60 * 60 * 1000; // 24h
}

function renderEntries() {
  const w = state.worlds[state.activeWorldId];
  if (!w || !entriesListEl) return;

  if (!Array.isArray(w.entries)) w.entries = [];
  entriesListEl.innerHTML = "";

  if (w.entries.length === 0) {
    entriesListEl.innerHTML = `<p class="hint">Aucune saisie pour l’instant.</p>`;
    return;
  }

  w.entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "objective-row"; // réutilise ton style flex

    const label = document.createElement("div");
    label.className = "label";
    label.innerHTML = `<strong>${formatDateTime(entry.createdAt)}</strong><br><span class="hint">Temps saisi : ${entry.minutes} min • +${entry.xp} XP</span>`;

    const del = document.createElement("button");
    del.className = "ghost";
    del.textContent = "✕";

    const allowed = canDeleteEntry(entry);
    del.disabled = !allowed;
    if (!allowed) {
      del.style.opacity = "0.5";
      del.title = "Suppression possible uniquement dans les 24h";
    }

    del.onclick = () => deleteEntry(entry.id);

    row.appendChild(label);
    row.appendChild(del);
    entriesListEl.appendChild(row);
  });
}

function deleteEntry(entryId) {
  const w = state.worlds[state.activeWorldId];
  if (!w || !Array.isArray(w.entries)) return;

  const entry = w.entries.find(e => e.id === entryId);
  if (!entry) return;

  if (!canDeleteEntry(entry)) {
    alert("Tu ne peux supprimer une saisie qu’à moins de 24h.");
    return;
  }

  const ok = confirm(`Supprimer cette saisie (${entry.minutes} min, -${entry.xp} XP) ?`);
  if (!ok) return;

  // Retirer l'entry
  w.entries = w.entries.filter(e => e.id !== entryId);

  // Retirer le temps
  w.stats.timeTotal = Math.max(0, (w.stats.timeTotal || 0) - entry.minutes);

  // Retirer les XP : monde + global + périodes
  w.stats.totalXp = Math.max(0, (w.stats.totalXp || 0) - entry.xp);
  w.stats.weekXp = Math.max(0, (w.stats.weekXp || 0) - entry.xp);
  w.stats.monthXp = Math.max(0, (w.stats.monthXp || 0) - entry.xp);

  state.global.totalXp = Math.max(0, (state.global.totalXp || 0) - entry.xp);
  state.global.weekXp = Math.max(0, (state.global.weekXp || 0) - entry.xp);
  state.global.monthXp = Math.max(0, (state.global.monthXp || 0) - entry.xp);

  save();

  showPopup(`🗑️ Saisie supprimée (-${entry.xp} XP)`);

  // Refresh UI
  renderHomeStats();
  renderWorldStats();
  renderEntries();
}

// ================== Navigation ==================
function openWorld(worldId) {
  state.activeWorldId = worldId;
  save();
  showScreen(worldScreen);
  renderWorldScreen();
}

function goHome() {
  showScreen(homeScreen);
  renderHome();
  state.activeWorldId = null;
  save();

}

// ================== Modals ==================
openAddWorldBtn.onclick = forceOpenAddWorldModal;
cancelWorldBtn.onclick = (e) => {
  e.preventDefault();
  forceCloseAddWorldModal();
};


function closeAddWorldModal() {
  addWorldModal.classList.add("hidden");
  worldNameInput.value = "";
  worldIconInput.value = "";
  minutesBaseInput.value = "";
  xpBaseInput.value = "";
}

createWorldBtn.onclick = () => {
  const name = worldNameInput.value.trim();
  const icon = worldIconInput.value.trim();
  const minutes = parseInt(minutesBaseInput.value, 10);
  const xp = parseInt(xpBaseInput.value, 10);

  if (!name) return alert("Nom du monde requis");
  if (!icon) return alert("Icône requise (emoji)");
  if (!Number.isFinite(minutes) || minutes <= 0) return alert("Minutes invalides");
  if (!Number.isFinite(xp) || xp <= 0) return alert("XP invalides");

  const id = "world-" + Date.now();

  state.worlds[id] = {
    id,
    name,
    icon,
    active: true,
    rules: { minutesBase: minutes, xpBase: xp },
    stats: { totalXp: 0, weekXp: 0, monthXp: 0, timeTotal: 0 },
    objectives: []
  };

  save();
  renderWorlds();
  forceCloseAddWorldModal();
};

// onboarding
startBtn.onclick = () => {
  const name = (playerNameInput.value || "").trim();
  if (!name) return alert("Entre un pseudo");
  state.playerName = name;
  save();
  renderOnboardingOrHome();
};

// back buttons
backHomeBtn.onclick = () => goHome();
openSettingsBtn.onclick = () => {
    settingsReturnTo = "home";
    showScreen(settingsScreen);
    renderSettings();
};
backFromSettingsBtn.onclick = () => {
  if (settingsReturnTo === "world" && state.activeWorldId) {
    showScreen(worldScreen);
    renderWorldScreen();
  } else {
    showScreen(homeScreen);
    renderHome();
  }
};

// world quick settings (future hook)
if (worldQuickSettingsBtn) {
  worldQuickSettingsBtn.onclick = () => {
    showPopup("⚙️ Paramètres monde : bientôt !");
  };
}

// ================== Time entry ==================
validateTimeBtn.onclick = () => {
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  const minutes = parseInt(timeMinutesInput.value, 10);
  if (!Number.isFinite(minutes) || minutes <= 0) return alert("Minutes invalides");

  const xp = calculateTimeXp(w, minutes);

  // --- create entry (historique) ---
  if (!Array.isArray(w.entries)) w.entries = [];
  const entry = {
    id: "entry-" + Date.now(),
    createdAt: Date.now(),
    minutes,
    xp
  };
  w.entries.unshift(entry); // ✅ plus récent en premier

  // apply time
  w.stats.timeTotal = (w.stats.timeTotal || 0) + minutes;
  save();

  addXp(w.id, xp, "⏱️ Temps validé !");

  timeMinutesInput.value = "";
  timePreviewEl.innerText = "";
};

// ================== Objectives create / validate ==================
let draftMilestoneSteps = [];

function refreshObjectiveTypeUI() {
  const t = objectiveTypeSelect.value;
  objectiveFieldsRepeatable.classList.toggle("hidden", t !== "repeatable");
  objectiveFieldsUnique.classList.toggle("hidden", t !== "unique");
  objectiveFieldsMilestone.classList.toggle("hidden", t !== "milestone");
  createObjectiveBtn.classList.toggle("hidden", t === "milestone"); // milestone uses separate create button
}
objectiveTypeSelect.onchange = refreshObjectiveTypeUI;
refreshObjectiveTypeUI();

addMilestoneStepBtn.onclick = () => {
  const count = parseInt(milestoneCountInput.value, 10);
  const xp = parseInt(milestoneXpInput.value, 10);
  if (!Number.isFinite(count) || count <= 0) return alert("Palier invalide");
  if (!Number.isFinite(xp) || xp <= 0) return alert("XP invalide");
  // Empêche d'ajouter un palier <= au dernier palier (ordre obligatoire)
  const last = draftMilestoneSteps[draftMilestoneSteps.length - 1];
  if (last && count <= last.count) {
    return alert(`Ajoute des paliers dans l’ordre (ex : ${last.count + 1}, puis plus grand).`);
  }

  draftMilestoneSteps.push({ count, xp, done: false });

  milestoneCountInput.value = "";
  milestoneXpInput.value = "";

  renderMilestonePreview();
};

function renderMilestonePreview() {
  milestoneStepsPreview.innerHTML = "";
  draftMilestoneSteps.forEach(s => {
    const pill = document.createElement("div");
    pill.className = "step-pill";
    pill.innerText = `${s.count} → ${s.xp} XP`;
    milestoneStepsPreview.appendChild(pill);
  });
}

createMilestoneObjectiveBtn.onclick = () => {
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  const prefix = milestonePrefixInput.value.trim();
  const suffix = milestoneSuffixInput.value.trim();
  if (!prefix) return alert("Texte 1 requis (ex : Lire)");
  if (!suffix) return alert("Texte 2 requis (ex : livres)");
  if (draftMilestoneSteps.length === 0) return alert("Ajoute au moins un palier");

  const id = "obj-" + Date.now();

  w.objectives.push({
    id,
    type: "milestone",
    prefix,
    suffix,
    steps: draftMilestoneSteps.map(s => ({ ...s }))
  });

  // reset UI
  milestonePrefixInput.value = "";
  milestoneSuffixInput.value = "";
  draftMilestoneSteps = [];
  renderMilestonePreview();

  save();
  showPopup("🎯 Objectif palier ajouté");
  renderObjectives();
};

createObjectiveBtn.onclick = () => {
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  const t = objectiveTypeSelect.value;
  const id = "obj-" + Date.now();

  if (t === "repeatable") {
    const name = objNameInput.value.trim();
    const xp = parseInt(objXpInput.value, 10);
    if (!name) return alert("Nom requis");
    if (!Number.isFinite(xp) || xp <= 0) return alert("XP invalide");

    w.objectives.push({ id, type: "repeatable", name, xp, doneCount: 0 });

    objNameInput.value = "";
    objXpInput.value = "";
  }

  if (t === "unique") {
    const name = objNameUniqueInput.value.trim();
    const xp = parseInt(objXpUniqueInput.value, 10);
    if (!name) return alert("Nom requis");
    if (!Number.isFinite(xp) || xp <= 0) return alert("XP invalide");

    w.objectives.push({ id, type: "unique", name, xp, done: false });

    objNameUniqueInput.value = "";
    objXpUniqueInput.value = "";
  }

  save();
  showPopup("🎯 Objectif ajouté");
  renderObjectives();
};

function validateObjective(objectiveId) {
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  const obj = (w.objectives || []).find(o => o.id === objectiveId);
  if (!obj) return;

  if (!confirm("Valider cet objectif ?")) return;

  if (obj.type === "repeatable") {
    obj.doneCount = (obj.doneCount || 0) + 1;
    save();
    addXp(w.id, obj.xp, "🎯 Objectif validé !");
    renderObjectives();
    return;
  }

  if (obj.type === "unique") {
    if (obj.done) return;
    obj.done = true;
    save();
    addXp(w.id, obj.xp, "🎯 Objectif validé !");
    renderObjectives();
    return;
  }

  if (obj.type === "milestone") {
    const step = (obj.steps || []).find(s => !s.done);
    if (!step) return;
    step.done = true;
    save();
    addXp(w.id, step.xp, "🎯 Palier validé !");
    renderObjectives();
    return;
  }
}

// ================== Settings ==================
function renderSettings() {
  // fill inputs
  monthGoalInput.value = getMonthGoal();
  weekGoalBusyInput.value = state.settings.weekGoals.busy;
  weekGoalNormalInput.value = state.settings.weekGoals.normal;
  weekGoalLightInput.value = state.settings.weekGoals.light;

  renderManageWorlds();
}

function renderManageWorlds() {
  manageWorldsList.innerHTML = "";

  const worlds = Object.values(state.worlds);
  if (worlds.length === 0) {
    manageWorldsList.innerHTML = `<p class="hint">Aucun monde à gérer pour l’instant.</p>`;
    return;
  }

  worlds.forEach(w => {
    const row = document.createElement("div");
    row.className = "objective-row";

    const label = document.createElement("div");
    label.className = "label";
    label.innerText = `${w.icon} ${w.name}`;

    const toggle = document.createElement("button");
    toggle.innerText = w.active === false ? "Réactiver" : "Désactiver";
    toggle.onclick = () => {
      w.active = w.active === false ? true : false;
      // if deactivating current world, go home
      if (state.activeWorldId === w.id && w.active === false) {
        state.activeWorldId = null;
      }
      save();
      renderManageWorlds();
      renderWorlds();
    };

    const edit = document.createElement("button");
    edit.className = "ghost";
    edit.innerText = "Règle XP";
    edit.onclick = () => {
      const m = prompt(`Minutes de base pour ${w.name} ? (actuel: ${w.rules.minutesBase})`, w.rules.minutesBase);
      if (m === null) return;
      const x = prompt(`XP de base pour ${w.name} ? (actuel: ${w.rules.xpBase})`, w.rules.xpBase);
      if (x === null) return;

      const mm = parseInt(m, 10);
      const xx = parseInt(x, 10);
      if (!Number.isFinite(mm) || mm <= 0 || !Number.isFinite(xx) || xx <= 0) {
        alert("Valeurs invalides");
        return;
      }
      w.rules.minutesBase = mm;
      w.rules.xpBase = xx;
      save();
      showPopup("✅ Règle mise à jour");
      if (state.activeWorldId === w.id) renderWorldStats();
    };

    row.appendChild(label);
    row.appendChild(toggle);
    row.appendChild(edit);
    manageWorldsList.appendChild(row);
  });
}

saveGoalsBtn.onclick = () => {
  const mg = parseInt(monthGoalInput.value, 10);
  const b = parseInt(weekGoalBusyInput.value, 10);
  const n = parseInt(weekGoalNormalInput.value, 10);
  const l = parseInt(weekGoalLightInput.value, 10);

  if (![mg, b, n, l].every(v => Number.isFinite(v) && v > 0)) {
    alert("Valeurs invalides");
    return;
  }

  state.settings.monthGoal = mg;
  state.settings.weekGoals = { busy: b, normal: n, light: l };
  save();

  showPopup("✅ Objectifs enregistrés");
  renderHomeStats();
};

resetGameBtn.onclick = () => {
  const ok1 = confirm("Es-tu sûre de vouloir supprimer toutes les données ?");
  if (!ok1) return;
  const ok2 = confirm("Dernière confirmation : tout sera perdu. Continuer ?");
  if (!ok2) return;

  localStorage.removeItem(STORAGE_KEY);
  location.reload();
};

// ================== Tab init (home/world) ==================
(function initTabs() {
  // Home tabs bound in renderHome
  // World tabs bound in renderWorldScreen
})();

// ================== Init ==================
renderOnboardingOrHome();

// === PATCH: fermeture du modal "Créer un monde" (inratable) ===
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("addWorldModal");
  const cancelBtn = document.getElementById("cancelWorldBtn");

  if (cancelBtn && modal) {
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      modal.classList.add("hidden");
    });
  }
});

document.addEventListener("click", (e) => {
  const modal = document.getElementById("addWorldModal");
  if (!modal) return;

  // si clic sur le fond du modal (overlay), fermer
  if (e.target === modal) {
    forceCloseAddWorldModal();
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}

// ================== FIREBASE AUTH (Email/MDP) ==================
(function setupFirebaseAuth(){
  // éléments UI
  const authStatus = document.getElementById("authStatus");
  const authEmail = document.getElementById("authEmail");
  const authPassword = document.getElementById("authPassword");
  const btnLogin = document.getElementById("btnLogin");
  const btnSignup = document.getElementById("btnSignup");
  const btnLogout = document.getElementById("btnLogout");

  // sécurité: si firebase n'est pas chargé, on ne casse pas l'app
  if (!window.firebase || !firebase.auth) {
    console.warn("Firebase Auth non chargé (scripts manquants ou cache).");
    if (authStatus) authStatus.textContent = "Firebase non chargé (attends la MAJ)";
    return;
  }

  const auth = firebase.auth();

  function setLoggedOutUI() {
    if (authStatus) authStatus.textContent = "Non connectée";
    btnLogout?.classList.add("hidden");
  }

  function setLoggedInUI(user) {
    if (authStatus) authStatus.textContent = `Connectée : ${user.email}`;
    btnLogout?.classList.remove("hidden");
  }

  async function signup() {
    const email = (authEmail?.value || "").trim();
    const pass = (authPassword?.value || "").trim();
    if (!email || !pass) return alert("Email et mot de passe requis");
    try {
      await auth.createUserWithEmailAndPassword(email, pass);
      showPopup("✅ Compte créé");
    } catch (e) {
      alert(e.message);
    }
  }

  async function login() {
    const email = (authEmail?.value || "").trim();
    const pass = (authPassword?.value || "").trim();
    if (!email || !pass) return alert("Email et mot de passe requis");
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      showPopup("✅ Connectée");
    } catch (e) {
      alert(e.message);
    }
  }

  async function logout() {
    try {
      await auth.signOut();
      showPopup("👋 Déconnectée");
    } catch (e) {
      alert(e.message);
    }
  }

  // events
  btnLogin && (btnLogin.onclick = login);
  btnSignup && (btnSignup.onclick = signup);
  btnLogout && (btnLogout.onclick = logout);

  // état session
  auth.onAuthStateChanged((user) => {
    if (user) setLoggedInUI(user);
    else setLoggedOutUI();
  });
})();
