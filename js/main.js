document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("appVersion").textContent = "V1 - 13/02/2026";
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

    meta: { updatedAt: Date.now() },

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

    history: {
      weeks: {},  // { "2026-W06": { xp, goal } }
      months: {}  // { "2026-02": { xp, goal } }
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
  if (!data.meta) data.meta = { updatedAt: Date.now() };
  if (!data.meta.updatedAt) data.meta.updatedAt = Date.now();
  if (!data.history) data.history = { weeks: {}, months: {} };
  if (!data.history.weeks) data.history.weeks = {};
  if (!data.history.months) data.history.months = {};

  // reset week/month if keys changed
  const wk = getISOWeekKey();
  const mk = getMonthKey();
  if (data.periods.weekKey !== wk) {
    const oldKey = data.periods.weekKey;
    const oldXp = data.global.weekXp ?? 0;
    const oldGoal = (data.settings?.weekGoals?.[data.settings?.weekLoad] ?? 250);
    if (oldKey) {
      data.history.weeks[oldKey] = { xp: oldXp, goal: oldGoal };
    }
    data.periods.weekKey = wk;
    data.global.weekXp = 0;
    Object.values(data.worlds).forEach(w => { if (w?.stats) w.stats.weekXp = 0; });
  }

  if (data.periods.monthKey !== mk) {
    const oldKey = data.periods.monthKey;
    const oldXp = data.global.monthXp ?? 0;
    const oldGoal = Number(data.settings?.monthGoal) || 1000;
    if (oldKey) {
      data.history.months[oldKey] = { xp: oldXp, goal: oldGoal };
    }
    data.periods.monthKey = mk;
    data.global.monthXp = 0;
    Object.values(data.worlds).forEach(w => { if (w?.stats) w.stats.monthXp = 0; });
  }

  return data;
}

function save() {
  state.meta = state.meta || {};
  state.meta.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  // si connectée : sauvegarde cloud (avec debounce)
  scheduleCloudSave();
}

let state = load();

// ================== DOM ==================
const el = (id) => document.getElementById(id);

const loadingScreen = el("loadingScreen");
const onboardingScreen = el("onboardingScreen");
const homeScreen = el("homeScreen");
const worldScreen = el("worldScreen");
const settingsScreen = el("settingsScreen");

// connexion
const loginScreen = el("loginScreen");

// onboarding
const playerNameInput = el("playerNameInput");
const startBtn = el("startBtn");
const openPerformanceBtn = el("openPerformanceBtn");

// home stats
const playerNameEl = el("playerName");
const globalLevelEl = el("globalLevel");
const globalXpEl = el("globalXp");
const globalTimeHoursEl = el("globalTimeHours");

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

// perf page
const performanceScreen = el("performanceScreen");
const backFromPerformanceBtn = el("backFromPerformanceBtn");
const perfWeekList = el("perfWeekList");
const perfMonthList = el("perfMonthList");

// settings
const openSettingsBtn = el("openSettingsBtn");
const backFromSettingsBtn = el("backFromSettingsBtn");

const monthGoalInput = el("monthGoalInput");
const weekGoalBusyInput = el("weekGoalBusyInput");
const weekGoalNormalInput = el("weekGoalNormalInput");
const weekGoalLightInput = el("weekGoalLightInput");
const saveGoalsBtn = el("saveGoalsBtn");

const manageWorldsActiveList = el("manageWorldsActiveList");
const manageWorldsArchivedList = el("manageWorldsArchivedList");
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
  [loadingScreen, loginScreen, onboardingScreen, homeScreen, worldScreen, settingsScreen, performanceScreen]
    .filter(Boolean)
    .forEach(s => s.classList.add("hidden"));
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

// ===== Custom Dialog (remplace alert/confirm) =====
// ===== Custom Dialog (remplace alert/confirm/prompt) =====
function openDialog({
  title = "Info",
  message = "",
  okText = "OK",
  cancelText = "Annuler",
  showCancel = true,
  input = null // { value, placeholder, type }
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("dialogModal");
    const t = document.getElementById("dialogTitle");
    const m = document.getElementById("dialogMessage");
    const ok = document.getElementById("dialogOkBtn");
    const cancel = document.getElementById("dialogCancelBtn");

    const inputWrap = document.getElementById("dialogInputWrap");
    const inputEl = document.getElementById("dialogInput");

    // fallback sécurité (au cas où)
    if (!modal || !t || !m || !ok || !cancel) {
      if (input) {
        const v = prompt(message, input.value ?? "");
        resolve(v);
        return;
      }
      resolve(showCancel ? confirm(message) : (alert(message), true));
      return;
    }

    t.textContent = title;
    m.textContent = message;
    ok.textContent = okText;
    cancel.textContent = cancelText;
    cancel.classList.toggle("hidden", !showCancel);

    // input mode (prompt)
    const isPrompt = !!input;
    if (inputWrap && inputEl) {
      inputWrap.classList.toggle("hidden", !isPrompt);
      if (isPrompt) {
        inputEl.type = input.type || "text";
        inputEl.value = (input.value ?? "").toString();
        inputEl.placeholder = input.placeholder || "";
        setTimeout(() => inputEl.focus(), 0);
      }
    }

    function close(result){
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);

      modal.classList.add("hidden");
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");

      resolve(result);
    }

    function onOk(){
      if (isPrompt && inputEl) return close(inputEl.value);
      close(true);
    }
    function onCancel(){
      close(isPrompt ? null : false);
    }
    function onBackdrop(e){
      if (e.target === modal) onCancel();
    }
    function onKey(e){
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onOk();
    }

    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
    modal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);

    modal.classList.remove("hidden");
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
  });
}

function uiConfirm(message, title = "Confirmation") {
  return openDialog({ title, message, okText: "Confirmer", cancelText: "Annuler", showCancel: true });
}

function uiAlert(message, title = "Info") {
  return openDialog({ title, message, okText: "OK", showCancel: false });
}

function uiPrompt(message, {
  title = "Saisie",
  value = "",
  placeholder = "",
  type = "text",
  okText = "Valider",
  cancelText = "Annuler"
} = {}) {
  return openDialog({
    title,
    message,
    okText,
    cancelText,
    showCancel: true,
    input: { value, placeholder, type }
  });
}


function clamp01(x){ return Math.max(0, Math.min(1, x)); }

function getGlobalTotalMinutes() {
  return Object.values(state.worlds || {})
    .filter(w => w && w.active !== false)
    .reduce((sum, w) => sum + (w?.stats?.timeTotal || 0), 0);
}

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
function renderAfterAuth() {
  const user = (window.firebase && firebase.auth) ? firebase.auth().currentUser : null;

  // Pas connectée => écran login
  if (!user) {
    showScreen(loginScreen);
    return;
  }

  // Connectée => pseudo obligatoire
  if (!state.playerName) {
    showScreen(onboardingScreen);
    return;
  }

  // Connectée + pseudo => home
  showScreen(homeScreen);
  renderHome();
}

function renderHome() {
  renderHomeStats();
  renderWorlds();
}

function renderPerformanceScreen() {
  // tabs
  const perfTabs = performanceScreen.querySelectorAll(".tab-btn");
  perfTabs.forEach(btn => {
    btn.onclick = () => setActiveTab(performanceScreen, btn.dataset.tab);
  });
  setActiveTab(performanceScreen, "perfWeek");

  renderPerformanceLists();
}

function renderPerformanceLists() {
  // WEEK
  const weekItems = { ...(state.history?.weeks || {}) };
  const currentWeekKey = state.periods.weekKey;
  weekItems[currentWeekKey] = { xp: state.global.weekXp ?? 0, goal: getWeekGoal() };

  const weekKeys = Object.keys(weekItems).sort().reverse();
  perfWeekList.innerHTML = weekKeys.length ? "" : `<p class="hint">Aucune donnée.</p>`;

  weekKeys.forEach(k => {
    const { xp, goal } = weekItems[k] || { xp: 0, goal: 1 };
    const pct = clamp01((xp || 0) / Math.max(1, goal || 1));
    perfWeekList.innerHTML += `
      <div class="card subtle" style="margin:10px 0;">
        <div style="display:flex;justify-content:space-between;gap:8px;">
          <strong>${k}</strong>
          <span class="hint">${xp} / ${goal} XP</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(pct*100)}%">${Math.round(pct*100)}%</div></div>
      </div>
    `;
  });

  // MONTH
  const monthItems = { ...(state.history?.months || {}) };
  const currentMonthKey = state.periods.monthKey;
  monthItems[currentMonthKey] = { xp: state.global.monthXp ?? 0, goal: getMonthGoal() };

  const monthKeys = Object.keys(monthItems).sort().reverse();
  perfMonthList.innerHTML = monthKeys.length ? "" : `<p class="hint">Aucune donnée.</p>`;

  monthKeys.forEach(k => {
    const { xp, goal } = monthItems[k] || { xp: 0, goal: 1 };
    const pct = clamp01((xp || 0) / Math.max(1, goal || 1));
    perfMonthList.innerHTML += `
      <div class="card subtle" style="margin:10px 0;">
        <div style="display:flex;justify-content:space-between;gap:8px;">
          <strong>${k}</strong>
          <span class="hint">${xp} / ${goal} XP</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(pct*100)}%">${Math.round(pct*100)}%</div></div>
      </div>
    `;
  });
}

function renderHomeStats() {
  playerNameEl.innerText = state.playerName || "";
  globalXpEl.innerText = state.global.totalXp ?? 0;
  globalLevelEl.innerText = levelFromXp(state.global.totalXp ?? 0, state.settings.levelBase, state.settings.levelGrowth);
  const totalHours = getGlobalTotalMinutes() / 60;
  globalTimeHoursEl.innerText = (Math.round(totalHours * 10) / 10).toString(); // 1 décimale

  // week load buttons
  const buttons = weekLoadPicker.querySelectorAll("button");
  buttons.forEach(b => {
    b.classList.toggle("active", b.dataset.load === state.settings.weekLoad);
    b.onclick = async () => {
      const nextLoad = b.dataset.load;
      const current = state.settings.weekLoad;

      if (nextLoad === current) return;

      const label = nextLoad === "busy" ? "chargée" : nextLoad === "normal" ? "normale" : "légère";
      const ok = await uiConfirm(`Confirmer semaine ${label} ?`, "Objectif hebdo");
      if (!ok) return;

      state.settings.weekLoad = nextLoad;
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
    worldsListEl.innerHTML = `<p class="hint">Aucun monde créé pour l’instant.</p>`;
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
      const gained = done * (obj.xp || 0);
      title = `${obj.name} (${obj.xp} / ${gained} XP)`;
      badge.innerText = `🔁 x${done}`;
      xp = obj.xp;

    } else if (obj.type === "unique") {
      const gained = obj.done ? obj.xp : 0;
      title = `${obj.name} (${obj.xp} / ${gained} XP)`;
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
        const gained = doneSteps.reduce((s, st) => s + (st.xp || 0), 0);
        label.innerText = `${obj.prefix} ${lastDone.count} ${obj.suffix} ✅ (${0} / ${gained} XP)`;
        badge.innerText = "✅";
        canValidate = false;
        xp = 0;
        label.style.textDecoration = "line-through";
      } else {
        // actif (prochain palier)
        const gained = doneSteps.reduce((s, st) => s + (st.xp || 0), 0);
        const lastDoneHtml = lastDone
          ? `<div style="opacity:.65;text-decoration:line-through;">${obj.prefix} ${lastDone.count} ${obj.suffix} ✅</div>`
          : "";
        const nextHtml = `<div><strong>${obj.prefix} ${next.count} ${obj.suffix}</strong> <span class="hint">(${next.xp} / ${gained} XP)</span></div>`;

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

async function deleteEntry(entryId) {
  const w = state.worlds[state.activeWorldId];
  if (!w || !Array.isArray(w.entries)) return;

  const entry = w.entries.find(e => e.id === entryId);
  if (!entry) return;

  if (!canDeleteEntry(entry)) {
    await uiAlert("Tu ne peux supprimer une saisie qu’à moins de 24h.", "Suppression");
    return;
  }

  const ok = await uiConfirm(`Supprimer cette saisie (${entry.minutes} min, -${entry.xp} XP) ?`, "Suppression");
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

createWorldBtn.onclick = async () => {
  const name = worldNameInput.value.trim();
  const icon = worldIconInput.value.trim();
  const minutes = parseInt(minutesBaseInput.value, 10);
  const xp = parseInt(xpBaseInput.value, 10);

  if (!name) return uiAlert("Nom du monde requis", "Créer un monde");
  if (!icon) return uiAlert("Icône requise (emoji)", "Créer un monde");
  if (!Number.isFinite(minutes) || minutes <= 0) return uiAlert("Minutes invalides", "Créer un monde");
  if (!Number.isFinite(xp) || xp <= 0) return uiAlert("XP invalides", "Créer un monde");

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
startBtn.onclick = async () => {
  const name = (playerNameInput.value || "").trim();
  if (!name) return uiAlert("Entre un pseudo", "Bienvenue");
  state.playerName = name;
  save();
  renderAfterAuth();
};

// back buttons
openPerformanceBtn.onclick = () => {
  showScreen(performanceScreen);
  renderPerformanceScreen();
};

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

backFromPerformanceBtn.onclick = () => {
  showScreen(homeScreen);
  renderHome();
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
  if (!Number.isFinite(minutes) || minutes <= 0) return uiAlert("Minutes invalides", "Saisie temps");

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

addMilestoneStepBtn.onclick = async () => {
  const count = parseInt(milestoneCountInput.value, 10);
  const xp = parseInt(milestoneXpInput.value, 10);
  if (!Number.isFinite(count) || count <= 0) return uiAlert("Palier invalide", "Objectifs");
  if (!Number.isFinite(xp) || xp <= 0) return uiAlert("XP invalide", "Objectifs");
  // Empêche d'ajouter un palier <= au dernier palier (ordre obligatoire)
  const last = draftMilestoneSteps[draftMilestoneSteps.length - 1];
  if (last && count <= last.count) {
    return uiAlert(`Ajoute des paliers dans l’ordre (ex : ${last.count + 1}, puis plus grand).`, "Objectifs");
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

createMilestoneObjectiveBtn.onclick = async () => {
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  const prefix = milestonePrefixInput.value.trim();
  const suffix = milestoneSuffixInput.value.trim();
  if (!prefix) return uiAlert("Texte 1 requis (ex : Lire)", "Objectifs");
  if (!suffix) return uiAlert("Texte 2 requis (ex : livres)", "Objectifs");
  if (draftMilestoneSteps.length === 0) return uiAlert("Ajoute au moins un palier", "Objectifs");

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

createObjectiveBtn.onclick = async () => {
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  const t = objectiveTypeSelect.value;
  const id = "obj-" + Date.now();

  if (t === "repeatable") {
    const name = objNameInput.value.trim();
    const xp = parseInt(objXpInput.value, 10);
    if (!name) return uiAlert("Nom requis");
    if (!Number.isFinite(xp) || xp <= 0) return alert("XP invalide");

    w.objectives.push({ id, type: "repeatable", name, xp, doneCount: 0 });

    objNameInput.value = "";
    objXpInput.value = "";
  }

  if (t === "unique") {
    const name = objNameUniqueInput.value.trim();
    const xp = parseInt(objXpUniqueInput.value, 10);
    if (!name) return uiAlert("Nom requis");
    if (!Number.isFinite(xp) || xp <= 0) return alert("XP invalide");

    w.objectives.push({ id, type: "unique", name, xp, done: false });

    objNameUniqueInput.value = "";
    objXpUniqueInput.value = "";
  }

  save();
  showPopup("🎯 Objectif ajouté");
  renderObjectives();
};

async function validateObjective(objectiveId) {
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  const obj = (w.objectives || []).find(o => o.id === objectiveId);
  if (!obj) return;

  const ok = await uiConfirm("Valider cet objectif ?", "Objectifs");
  if (!ok) return;


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
  // Compte: pseudo + email
  const u = (window.firebase && firebase.auth) ? firebase.auth().currentUser : null;
  const pseudoLine = document.getElementById("accountPseudoLine");
  const emailLine = document.getElementById("accountEmailLine");
  if (pseudoLine) pseudoLine.textContent = state?.playerName || "—";
  if (emailLine) emailLine.textContent = u?.email || "—";
}

function renderManageWorlds() {
  if (!manageWorldsActiveList || !manageWorldsArchivedList) return;

  manageWorldsActiveList.innerHTML = "";
  manageWorldsArchivedList.innerHTML = "";

  const worlds = Object.values(state.worlds || {});
  const activeWorlds = worlds.filter(w => w && w.active !== false);
  const archivedWorlds = worlds.filter(w => w && w.active === false);

  // --- empty states
  if (activeWorlds.length === 0) {
    manageWorldsActiveList.innerHTML = `<p class="hint">Aucun monde actif pour le moment.</p>`;
  }
  if (archivedWorlds.length === 0) {
    manageWorldsArchivedList.innerHTML = `<p class="hint">Aucun monde archivé pour le moment.</p>`;
  }

  // --- Actifs: Supprimer (= archiver) + Règle XP
  activeWorlds.forEach(w => {
    const row = document.createElement("div");
    row.className = "objective-row";

    const label = document.createElement("div");
    label.className = "label";
    label.innerText = `${w.icon} ${w.name}`;

    const archiveBtn = document.createElement("button");
    archiveBtn.innerText = "Supprimer";
    archiveBtn.onclick = async () => {
      const ok = await uiConfirm(
        `Archiver ${w.icon} ${w.name} ?\n(Il disparaît de l’accueil, mais tes XP ne changent pas.)`,
        "Supprimer un monde"
      );
      if (!ok) return;

      w.active = false;

      // si on archive le monde ouvert, on sort
      if (state.activeWorldId === w.id) state.activeWorldId = null;

      save();
      renderManageWorlds();
      renderWorlds();
      renderHomeStats();
    };

    const ruleBtn = document.createElement("button");
    ruleBtn.className = "ghost";
    ruleBtn.innerText = "Règle XP";
    ruleBtn.onclick = async () => {
      const m = await uiPrompt(`Minutes de base pour ${w.name} ?`, {
        title: "Règle XP",
        value: w.rules.minutesBase,
        type: "number",
        placeholder: "Ex: 30"
      });
      if (m === null) return;

      const x = await uiPrompt(`XP de base pour ${w.name} ?`, {
        title: "Règle XP",
        value: w.rules.xpBase,
        type: "number",
        placeholder: "Ex: 10"
      });
      if (x === null) return;

      const mm = parseInt(m, 10);
      const xx = parseInt(x, 10);

      if (!Number.isFinite(mm) || mm <= 0 || !Number.isFinite(xx) || xx <= 0) {
        await uiAlert("Valeurs invalides", "Règle XP");
        return;
      }

      w.rules.minutesBase = mm;
      w.rules.xpBase = xx;

      save();
      showPopup("✅ Règle mise à jour");
      if (state.activeWorldId === w.id) renderWorldStats();
    };

    row.appendChild(label);
    row.appendChild(archiveBtn);
    row.appendChild(ruleBtn);
    manageWorldsActiveList.appendChild(row);
  });

  // --- Archivés: Restaurer
  archivedWorlds.forEach(w => {
    const row = document.createElement("div");
    row.className = "objective-row";

    const label = document.createElement("div");
    label.className = "label";
    label.innerText = `${w.icon} ${w.name}`;

    const restoreBtn = document.createElement("button");
    restoreBtn.className = "ghost";
    restoreBtn.innerText = "Restaurer";
    restoreBtn.onclick = async () => {
      const ok = await uiConfirm(`Restaurer ${w.icon} ${w.name} ?`, "Restaurer un monde");
      if (!ok) return;

      w.active = true;
      save();
      renderManageWorlds();
      renderWorlds();
      renderHomeStats();
    };

    row.appendChild(label);
    row.appendChild(restoreBtn);
    manageWorldsArchivedList.appendChild(row);
  });
}

saveGoalsBtn.onclick = () => {
  const mg = parseInt(monthGoalInput.value, 10);
  const b = parseInt(weekGoalBusyInput.value, 10);
  const n = parseInt(weekGoalNormalInput.value, 10);
  const l = parseInt(weekGoalLightInput.value, 10);

  if (![mg, b, n, l].every(v => Number.isFinite(v) && v > 0)) {
    return uiAlert("Valeurs invalides", "Paramètres");
    return;
  }

  state.settings.monthGoal = mg;
  state.settings.weekGoals = { busy: b, normal: n, light: l };
  save();

  showPopup("✅ Objectifs enregistrés");
  renderHomeStats();
};

if (resetGameBtn) resetGameBtn.onclick = async () => {
  const user = (window.firebase && firebase.auth) ? firebase.auth().currentUser : null;
  if (!user) return uiAlert("Tu dois être connectée pour réinitialiser le jeu.", "Réinitialisation");

  const ok1 = await uiConfirm("Es-tu sûre de vouloir supprimer toutes les données ?", "Réinitialisation");
  if (!ok1) return;

  const ok2 = await uiConfirm("Dernière confirmation : tout sera perdu. Continuer ?", "Réinitialisation");
  if (!ok2) return;

  // 1) reset local
  state = defaultData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  // 2) reset cloud (supprime la sauvegarde)
  try {
    const db = firebase.firestore();
    await db.collection("users").doc(user.uid).collection("app").doc("save").delete();
  } catch (e) {
    console.error(e);
    showPopup("⚠️ Reset cloud impossible");
  }

  showPopup("🧹 Jeu réinitialisé");
  renderAfterAuth(); // => onboarding (pseudo)
};


// ================== Tab init (home/world) ==================
(function initTabs() {
  // Home tabs bound in renderHome
  // World tabs bound in renderWorldScreen
})();

// ================== Init ==================
showScreen(loadingScreen);

// === PATCH: fermeture du modal "Créer un monde" (inratable) ===
document.addEventListener("DOMContentLoaded", () => {
  const cancelBtn = document.getElementById("cancelWorldBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      forceCloseAddWorldModal();
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

let cloudAuthUser = null;
let cloudDb = null;
let cloudSaveTimer = null;

// ================== FIREBASE AUTH (Email/MDP) ==================
(function setupFirebaseAuth(){
  // UI (écran login)
  const authStatus = document.getElementById("authStatus");
  const authEmail = document.getElementById("authEmail");
  const authPassword = document.getElementById("authPassword");
  const btnLogin = document.getElementById("btnLogin");
  const btnSignup = document.getElementById("btnSignup");

  // UI (paramètres)
  const btnLogout = document.getElementById("btnLogout");
  const accountEmailLine = document.getElementById("accountEmailLine"); // optionnel

  if (!window.firebase || !firebase.auth) {
    console.warn("Firebase Auth non chargé.");
    if (authStatus) authStatus.textContent = "Firebase non chargé";
    return;
  }

  const auth = firebase.auth();

  async function signup() {
    const email = (authEmail?.value || "").trim();
    const pass = (authPassword?.value || "").trim();
    if (!email || !pass) return uiAlert("Email et mot de passe requis", "Connexion");

    try {
      await auth.createUserWithEmailAndPassword(email, pass);

      // ✅ nouveau compte => nouveau départ local
      state = defaultData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

      showPopup("✅ Compte créé");
      renderAfterAuth(); // => onboarding (pseudo)
    } catch (e) {
      await uiAlert(e.message, "Connexion");
    }
  }

  async function login() {
    const email = (authEmail?.value || "").trim();
    const pass = (authPassword?.value || "").trim();
    if (!email || !pass) return uiAlert("Email et mot de passe requis", "Connexion");

    try {
      await auth.signInWithEmailAndPassword(email, pass);
      showPopup("✅ Connectée");
      // l'affichage + sync se fait dans onAuthStateChanged
    } catch (e) {
      await uiAlert(e.message, "Connexion");
    }
  }

  async function logout() {
    try {
      await auth.signOut();
      showPopup("👋 Déconnectée");
      // onAuthStateChanged -> retour loginScreen
    } catch (e) {
      await uiAlert(e.message, "Connexion");
    }
  }

  // events
  if (btnLogin) btnLogin.onclick = login;
  if (btnSignup) btnSignup.onclick = signup;
  if (btnLogout) btnLogout.onclick = logout;

  // ✅ UN SEUL onAuthStateChanged (source de vérité)
  auth.onAuthStateChanged(async (user) => {
    cloudAuthUser = user || null;

    if (authStatus) authStatus.textContent = user ? `Connectée : ${user.email}` : "Non connectée";
    if (accountEmailLine) accountEmailLine.textContent = user ? `Connectée : ${user.email}` : "";

    if (!user) {
      renderAfterAuth(); // => loginScreen
      return;
    }

    // Connectée -> sync cloud puis affichage
    try {
      await pullCloudAndMerge();
    } catch (e) {
      console.error(e);
      showPopup("⚠️ Sync cloud impossible");
    }

    renderAfterAuth();
  });
})();

// ================== FIRESTORE CLOUD SAVE ==================
// doc: users/{uid}/app/save
function cloudSaveRef(uid) {
  return cloudDb.collection("users").doc(uid).collection("app").doc("save");
}

function initCloudDbIfReady() {
  if (!window.firebase || !firebase.firestore || !firebase.auth) return false;
  if (!cloudDb) cloudDb = firebase.firestore();
  return true;
}

function scheduleCloudSave() {
  // pas connectée -> rien
  if (!cloudAuthUser) return;
  if (!initCloudDbIfReady()) return;

  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    pushCloudSave().catch(console.error);
  }, 800);
}

async function pushCloudSave() {
  if (!cloudAuthUser) return;
  if (!initCloudDbIfReady()) return;

  const uid = cloudAuthUser.uid;
  const ref = cloudSaveRef(uid);

  await ref.set(
    {
      updatedAt: state?.meta?.updatedAt || Date.now(),
      state: state
    },
    { merge: true }
  );

  console.log("☁️ Cloud save ok");
}

async function pullCloudAndMerge() {
  if (!cloudAuthUser) return;
  if (!initCloudDbIfReady()) return;

  const uid = cloudAuthUser.uid;
  const ref = cloudSaveRef(uid);
  const snap = await ref.get();

  // Si rien en cloud : on pousse le local (première connexion)
  if (!snap.exists) {
    await pushCloudSave();
    showPopup("☁️ Sauvegarde cloud créée");
    return;
  }

  const cloud = snap.data() || {};
  const cloudState = cloud.state;
  const cloudUpdatedAt = cloud.updatedAt || 0;
  const localUpdatedAt = state?.meta?.updatedAt || 0;

  // règle simple : la plus récente gagne
  if (cloudState && cloudUpdatedAt > localUpdatedAt) {
    state = cloudState;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    showPopup("☁️ Données récupérées");
    renderAfterAuth();
  } else {
    // local plus récent -> push
    await pushCloudSave();
    showPopup("☁️ Données synchronisées");
  }
}
