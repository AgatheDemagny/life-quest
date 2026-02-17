/* main.js — version complète (clean + stable)
   ✅ Corrige les accolades / IIFE
   ✅ Loading écran au refresh (plus de flash login)
   ✅ Cloud sync sans casser l’UI
   ✅ Temps global en XXhXXmn via #globalTimePretty
   ⚠️ IMPORTANT: dans ton HTML, ajoute/assure:
      <span id="globalTimePretty"></span>
      et un écran <div id="loadingScreen" class="hidden">...</div>
*/

document.addEventListener("DOMContentLoaded", () => {
  const v = document.getElementById("appVersion");
  if (v) v.textContent = "V1 - 16/02/2026";
});

// ================== Storage helpers ==================
const STORAGE_KEY = "joueMaVie";
const DATA_VERSION = 1;

function todayLocal() {
  return new Date();
}

function getISOWeekKey(date = todayLocal()) {
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

    settings: {
      weekLoad: "normal",
      weekGoals: { busy: 150, normal: 250, light: 400 },
      monthGoal: 1000,
      levelBase: 120,
      levelGrowth: 1.18
    },

    periods: {
      weekKey: getISOWeekKey(),
      monthKey: getMonthKey()
    },

    history: {
      weeks: {},
      months: {}
    },

    global: {
      totalXp: 0,
      weekXp: 0,
      monthXp: 0
    },

    worlds: {},
    activeWorldId: null
  };
}

let settingsReturnTo = "home"; // "home" ou "world"
let editingObjectiveId = null; // null = ajout, sinon = modification

function formatXp(xp){
  const n = Number(xp || 0);
  return `${n} XP`;
}

function resetObjectiveForm(){
  editingObjectiveId = null;
  const btn = document.getElementById("createObjectiveBtn");
  if (btn) btn.innerText = "Ajouter";

  // reset champs communs
  if (objNameInput) objNameInput.value = "";
  if (objXpInput) objXpInput.value = "";
  if (objNameUniqueInput) objNameUniqueInput.value = "";
  if (objXpUniqueInput) objXpUniqueInput.value = "";

  // milestone fields
  if (milestonePrefixInput) milestonePrefixInput.value = "";
  if (milestoneSuffixInput) milestoneSuffixInput.value = "";
  if (milestoneCountInput) milestoneCountInput.value = "";
  if (milestoneXpInput) milestoneXpInput.value = "";
  if (milestoneStepsPreview) milestoneStepsPreview.innerHTML = "";

  // remettre le type par défaut + champs visibles cohérents
  if (objectiveTypeSelect) objectiveTypeSelect.value = "repeatable";
  showObjectiveFieldsForType("repeatable");
}

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
    if (oldKey) data.history.weeks[oldKey] = { xp: oldXp, goal: oldGoal };

    data.periods.weekKey = wk;
    data.global.weekXp = 0;
    Object.values(data.worlds).forEach(w => { if (w?.stats) w.stats.weekXp = 0; });
  }

  if (data.periods.monthKey !== mk) {
    const oldKey = data.periods.monthKey;
    const oldXp = data.global.monthXp ?? 0;
    const oldGoal = Number(data.settings?.monthGoal) || 1000;
    if (oldKey) data.history.months[oldKey] = { xp: oldXp, goal: oldGoal };

    data.periods.monthKey = mk;
    data.global.monthXp = 0;
    Object.values(data.worlds).forEach(w => { if (w?.stats) w.stats.monthXp = 0; });
  }

  return data;
}

let state = load();

function save() {
  state.meta = state.meta || {};
  state.meta.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleCloudSave(); // si connectée
}

function showObjectiveFieldsForType(type){
  objectiveFieldsRepeatable.classList.toggle("hidden", type !== "repeatable");
  objectiveFieldsUnique.classList.toggle("hidden", type !== "unique");
  objectiveFieldsMilestone.classList.toggle("hidden", type !== "milestone");
}

// ================== DOM ==================
const el = (id) => document.getElementById(id);

const loadingScreen = el("loadingScreen");
const loginScreen = el("loginScreen");
const onboardingScreen = el("onboardingScreen");
const homeScreen = el("homeScreen");
const worldScreen = el("worldScreen");
const settingsScreen = el("settingsScreen");
const performanceScreen = el("performanceScreen");

// onboarding
const playerNameInput = el("playerNameInput");
const startBtn = el("startBtn");
const openPerformanceBtn = el("openPerformanceBtn");

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

// perf page
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

// edit objective modal
const editObjectiveModal = el("editObjectiveModal");
const editObjectiveTitle = el("editObjectiveTitle");
const editObjectiveTypeSelect = el("editObjectiveTypeSelect");

const editObjectiveFieldsRepeatable = el("editObjectiveFieldsRepeatable");
const editObjectiveFieldsUnique = el("editObjectiveFieldsUnique");
const editObjectiveFieldsMilestone = el("editObjectiveFieldsMilestone");

const editObjNameInput = el("editObjNameInput");
const editObjXpInput = el("editObjXpInput");
const editObjNameUniqueInput = el("editObjNameUniqueInput");
const editObjXpUniqueInput = el("editObjXpUniqueInput");

const editMilestonePrefixInput = el("editMilestonePrefixInput");
const editMilestoneSuffixInput = el("editMilestoneSuffixInput");
const editMilestoneCountInput = el("editMilestoneCountInput");
const editMilestoneXpInput = el("editMilestoneXpInput");
const editAddMilestoneStepBtn = el("editAddMilestoneStepBtn");
const editMilestoneStepsPreview = el("editMilestoneStepsPreview");

const editSaveObjectiveBtn = el("editSaveObjectiveBtn");
const editSaveMilestoneBtn = el("editSaveMilestoneBtn");
const editCancelObjectiveBtn = el("editCancelObjectiveBtn");

// popup
const popupEl = el("popup");

// quick world settings (future)
const worldQuickSettingsBtn = el("worldQuickSettingsBtn");

// ================== UI helpers ==================
function showScreen(which) {
  [
    loadingScreen, loginScreen, onboardingScreen,
    homeScreen, worldScreen, settingsScreen, performanceScreen
  ]
    .filter(Boolean)
    .forEach(s => s.classList.add("hidden"));

  if (which) which.classList.remove("hidden");
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

// ===== Custom Dialog (remplace alert/confirm/prompt) =====
function openDialog({
  title = "Info",
  message = "",
  okText = "OK",
  cancelText = "Annuler",
  showCancel = true,
  input = null
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("dialogModal");
    const t = document.getElementById("dialogTitle");
    const m = document.getElementById("dialogMessage");
    const ok = document.getElementById("dialogOkBtn");
    const cancel = document.getElementById("dialogCancelBtn");

    const inputWrap = document.getElementById("dialogInputWrap");
    const inputEl = document.getElementById("dialogInput");

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

// ================== Modals helpers ==================
function forceCloseAddWorldModal() {
  const modal = document.getElementById("addWorldModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
}
function forceOpenAddWorldModal() {
  const modal = document.getElementById("addWorldModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}

let editDraftMilestoneSteps = [];

function openEditObjectiveModal(){
  if (!editObjectiveModal) return;
  editObjectiveModal.classList.remove("hidden");
  editObjectiveModal.style.display = "flex";
  editObjectiveModal.setAttribute("aria-hidden", "false");
}

function closeEditObjectiveModal(){
  if (!editObjectiveModal) return;
  editObjectiveModal.classList.add("hidden");
  editObjectiveModal.style.display = "none";
  editObjectiveModal.setAttribute("aria-hidden", "true");
  editingObjectiveId = null;
  editDraftMilestoneSteps = [];
  renderEditMilestonePreview();
}

function refreshEditObjectiveTypeUI(){
  const t = editObjectiveTypeSelect?.value || "repeatable";
  if (editObjectiveFieldsRepeatable) editObjectiveFieldsRepeatable.classList.toggle("hidden", t !== "repeatable");
  if (editObjectiveFieldsUnique) editObjectiveFieldsUnique.classList.toggle("hidden", t !== "unique");
  if (editObjectiveFieldsMilestone) editObjectiveFieldsMilestone.classList.toggle("hidden", t !== "milestone");

  // bouton save classique caché si milestone (car milestone a son bouton dédié)
  if (editSaveObjectiveBtn) editSaveObjectiveBtn.classList.toggle("hidden", t === "milestone");
  if (editSaveMilestoneBtn) editSaveMilestoneBtn.classList.toggle("hidden", t !== "milestone");
}

function renderEditMilestonePreview(){
  if (!editMilestoneStepsPreview) return;
  editMilestoneStepsPreview.innerHTML = "";
  editDraftMilestoneSteps.forEach(s => {
    const pill = document.createElement("div");
    pill.className = "step-pill";
    pill.innerText = `${s.count} → ${s.xp} XP`;
    editMilestoneStepsPreview.appendChild(pill);
  });
}

if (editObjectiveTypeSelect) editObjectiveTypeSelect.onchange = refreshEditObjectiveTypeUI;
if (editCancelObjectiveBtn) editCancelObjectiveBtn.onclick = closeEditObjectiveModal;

// clic sur overlay pour fermer
document.addEventListener("click", (e) => {
  if (editObjectiveModal && e.target === editObjectiveModal) closeEditObjectiveModal();
});


// ================== Levels ==================
function xpForNextLevel(level, base, growth) {
  return Math.round(base * Math.pow(growth, Math.max(0, level - 1)));
}
function levelFromXp(totalXp, base, growth) {
  let level = 1;
  let remaining = totalXp;
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
  return Math.max(1, Math.round(raw));
}
function getGlobalTotalMinutes() {
  return Object.values(state.worlds || {})
    .filter(w => w)
    .reduce((sum, w) => sum + (w?.stats?.timeTotal || 0), 0);
}

function addXp(worldId, xp, reasonText) {
  const w = state.worlds[worldId];
  if (!w) return;

  const prevGlobalXp = state.global.totalXp;
  const prevWorldXp = w.stats.totalXp;

  state.global.totalXp += xp;
  state.global.weekXp += xp;
  state.global.monthXp += xp;

  w.stats.totalXp += xp;
  w.stats.weekXp += xp;
  w.stats.monthXp += xp;

  save();
  showPopup(`${reasonText} +${xp} XP`);

  const { prev: gPrev, now: gNow } = levelsGained(
    prevGlobalXp, state.global.totalXp,
    state.settings.levelBase, state.settings.levelGrowth
  );
  if (gNow > gPrev) showPopup(`🎉 Niveau global ${gNow} atteint !`);

  const { prev: wPrev, now: wNow } = levelsGained(
    prevWorldXp, w.stats.totalXp,
    state.settings.levelBase, state.settings.levelGrowth
  );
  if (wNow > wPrev) showPopup(`⭐ Niveau ${wNow} atteint dans ${w.icon} ${w.name} !`);

  renderHomeStats();
  renderWorldStats();
}

// ================== Rendering ==================
function renderAfterAuth() {
  const user = (window.firebase && firebase.auth) ? firebase.auth().currentUser : null;

  if (!user) {
    showScreen(loginScreen);
    return;
  }
  if (!state.playerName) {
    showScreen(onboardingScreen);
    return;
  }
  showScreen(homeScreen);
  renderHome();
}

function renderHome() {
  renderHomeStats();
  renderWorlds();
}

function renderPerformanceScreen() {
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
  if (playerNameEl) playerNameEl.innerText = state.playerName || "";
  if (globalXpEl) globalXpEl.innerText = state.global.totalXp ?? 0;
  if (globalLevelEl) globalLevelEl.innerText = levelFromXp(
    state.global.totalXp ?? 0,
    state.settings.levelBase,
    state.settings.levelGrowth
  );

  // temps global -> XXhXXmn
  const totalMin = getGlobalTotalMinutes();
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  const pretty = `${String(hh).padStart(2,"0")}h${String(mm).padStart(2,"0")}mn`;
  const globalTimePrettyEl = document.getElementById("globalTimePretty");
  if (globalTimePrettyEl) globalTimePrettyEl.textContent = pretty;

  // week load buttons
  if (weekLoadPicker) {
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
  }

  const wg = getWeekGoal();
  if (weekXpEl) weekXpEl.innerText = state.global.weekXp ?? 0;
  if (weekGoalEl) weekGoalEl.innerText = wg;
  const wPct = clamp01((state.global.weekXp ?? 0) / wg);
  if (weekProgressEl) {
    weekProgressEl.style.width = `${Math.round(wPct*100)}%`;
    weekProgressEl.innerText = `${Math.round(wPct*100)}%`;
  }

  const mg = getMonthGoal();
  if (monthXpEl) monthXpEl.innerText = state.global.monthXp ?? 0;
  if (monthGoalEl) monthGoalEl.innerText = mg;
  const mPct = clamp01((state.global.monthXp ?? 0) / mg);
  if (monthProgressEl) {
    monthProgressEl.style.width = `${Math.round(mPct*100)}%`;
    monthProgressEl.innerText = `${Math.round(mPct*100)}%`;
  }
}

function renderWorlds() {
  if (!worldsListEl) return;
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
  if (worldHeaderTitle) worldHeaderTitle.innerText = `${w.icon} ${w.name}`;

  const worldTabs = worldScreen.querySelectorAll(".tab-btn");
  worldTabs.forEach(btn => {
    btn.onclick = () => setActiveTab(worldScreen, btn.dataset.tab);
  });
  setActiveTab(worldScreen, "worldStats");

  if (timeMinutesInput && timePreviewEl) {
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
  }

  renderWorldStats();
  renderObjectives();
}

function renderWorldStats() {
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  if (worldLevelEl) worldLevelEl.innerText = levelFromXp(
    w.stats.totalXp,
    state.settings.levelBase,
    state.settings.levelGrowth
  );
  if (worldWeekXpEl) worldWeekXpEl.innerText = w.stats.weekXp ?? 0;
  if (worldTotalXpEl) worldTotalXpEl.innerText = w.stats.totalXp ?? 0;
  if (worldRuleTextEl) worldRuleTextEl.innerText = `${w.rules.minutesBase} min = ${w.rules.xpBase} XP`;
  if (worldTotalTimeEl) {
    const totalMin = w.stats.timeTotal ?? 0;
    const hh = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
    worldTotalTimeEl.innerText =
      `${String(hh).padStart(2, "0")}h${String(mm).padStart(2, "0")}mn`;
  }
}

function renderObjectives() {
  const w = state.worlds[state.activeWorldId];
  if (!w || !objectivesListEl) return;

  const list = Array.isArray(w.objectives) ? w.objectives : (w.objectives = []);

  // uniques non faits
  const enCours = list.filter(o => o.type === "unique" && !o.done);

  // milestones encore actifs = au moins un step non fait
  const paliers = list.filter(o => o.type === "milestone" && !isMilestoneAllDone(o));

  // répétables (toujours visibles)
  const repetables = list.filter(o => o.type === "repeatable");

  // archivés = uniques faits + steps milestone faits
  const archivedItems = [];

  // uniques done
  list.filter(o => o.type === "unique" && o.done).forEach(o => {
    archivedItems.push({
      kind: "unique",
      id: o.id,
      title: `${(o.name || "Objectif").trim()} (${Number(o.xp || 0)} XP)`,
      xp: Number(o.xp || 0),
      doneAt: o.doneAt || null,
      undoable: canUndo(o.doneAt),
      ref: o
    });
  });

  // milestone steps done = une ligne par palier atteint
  list.filter(o => o.type === "milestone").forEach(o => {
    (o.steps || []).filter(s => s.done).forEach(s => {
      const t = `🏅 ${o.prefix} ${s.count} ${o.suffix} (${Number(s.xp || 0)} XP)`;
      archivedItems.push({
        kind: "milestoneStep",
        id: `${o.id}-${s.count}`,
        title: t,
        xp: Number(s.xp || 0),
        doneAt: s.doneAt || null,
        undoable: canUndo(s.doneAt),
        ref: { obj: o, step: s }
      });
    });
  });

  // tri des archives par date desc
  archivedItems.sort((a,b) => (b.doneAt||0) - (a.doneAt||0));

  objectivesListEl.innerHTML = "";

  // Si aucun objectif du tout : uniquement le titre (donc rien ici)
  const nothing =
    enCours.length === 0 &&
    paliers.length === 0 &&
    repetables.length === 0 &&
    archivedItems.length === 0;

  if (nothing) return;

  addObjectiveSection("En cours", enCours, { mode: "uniqueActive" });
  addObjectiveSection("Palier", paliers, { mode: "milestoneActive" });
  addObjectiveSection("Répétables", repetables, { mode: "repeatable" });
  addArchivedSection("Archivés", archivedItems);
}

function isMilestoneAllDone(obj){
  const steps = obj.steps || [];
  return steps.length > 0 && steps.every(s => s.done);
}

function getMilestoneNextStep(obj){
  return (obj.steps || []).find(s => !s.done) || null;
}

function addObjectiveSection(title, items, opts){
  if (!items || items.length === 0) return;

  const h = document.createElement("div");
  h.className = "obj-section-title";
  h.textContent = title;
  objectivesListEl.appendChild(h);

  items.forEach(obj => objectivesListEl.appendChild(renderObjectiveRowV2(obj, opts)));
}

function addArchivedSection(title, items){
  if (!items || items.length === 0) return;

  const h = document.createElement("div");
  h.className = "obj-section-title";
  h.textContent = title;
  objectivesListEl.appendChild(h);

  items.forEach(item => objectivesListEl.appendChild(renderArchivedRow(item)));
}

function renderObjectiveRowV2(obj, opts){
  const row = document.createElement("div");
  row.className = "obj-row";

  const left = document.createElement("div");
  left.className = "obj-left";

  // titre
  const t = document.createElement("div");
  t.className = "obj-title";

  // meta
  const meta = document.createElement("div");
  meta.className = "obj-meta";

  // actions
  const actions = document.createElement("div");
  actions.className = "obj-actions";

  // bouton valider
  const validateBtn = document.createElement("button");
  validateBtn.className = "obj-edit-btn";
  validateBtn.type = "button";
  validateBtn.title = "Valider";
  validateBtn.textContent = "✅";
  validateBtn.onclick = () => validateObjective(obj.id);

  // bouton modifier (pour plus tard on fera mieux, mais on le laisse)
  const editBtn = document.createElement("button");
  editBtn.className = "obj-edit-btn";
  editBtn.type = "button";
  editBtn.title = "Modifier";
  editBtn.textContent = "🗒️";
  editBtn.onclick = () => startEditObjective(obj);

  // contenu selon type
  if (opts.mode === "uniqueActive") {
    t.textContent = `${(obj.name || "Objectif").trim()} (${Number(obj.xp || 0)} XP)`;
  }

  if (opts.mode === "repeatable") {
    const n = Number(obj.doneCount || 0);
    t.textContent = `${(obj.name || "Objectif").trim()} (${Number(obj.xp || 0)} XP)`;
    meta.textContent = `${n} fois`;
  }

  if (opts.mode === "milestoneActive") {
    const next = getMilestoneNextStep(obj);
    const total = (obj.steps || []).length;
    const done = (obj.steps || []).filter(s => s.done).length;
    const current = Number(obj.progress || 0);

    t.textContent = `🏅 ${obj.prefix} … ${obj.suffix} (${next ? Number(next.xp || 0) : 0} XP)`;

    if (next) {
      meta.textContent = `Progression ${current}/${next.count} • Paliers ${done}/${total}`;
    } else {
      meta.textContent = `Paliers ${done}/${total}`;
    }
  }

  left.appendChild(t);
  if (meta.textContent) left.appendChild(meta);

  actions.appendChild(validateBtn);
  actions.appendChild(editBtn);

  row.appendChild(left);
  row.appendChild(actions);
  return row;
}

function renderArchivedRow(item){
  const row = document.createElement("div");
  row.className = "obj-row";

  const left = document.createElement("div");
  left.className = "obj-left";

  const title = document.createElement("div");
  title.className = "obj-title";
  title.textContent = item.title;

  const meta = document.createElement("div");
  meta.className = "obj-meta";
  meta.textContent = item.doneAt ? `✅ ${formatDateShort(item.doneAt)}` : "";

  left.appendChild(title);
  left.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "obj-actions";

  // bouton undo (24h)
  const undoBtn = document.createElement("button");
  undoBtn.className = "obj-edit-btn";
  undoBtn.type = "button";
  undoBtn.title = item.undoable ? "Annuler (24h)" : "Annulation impossible (24h dépassées)";
  undoBtn.textContent = "↩️";
  undoBtn.disabled = !item.undoable;

  undoBtn.onclick = async () => {
    const ok = await uiConfirm("Annuler cette validation ?", "Archivés");
    if (!ok) return;
    undoArchivedItem(item);
  };

  actions.appendChild(undoBtn);

  row.appendChild(left);
  row.appendChild(actions);
  return row;
}

function undoArchivedItem(item){
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  // Unique : on remet done false
  if (item.kind === "unique") {
    const obj = item.ref;
    obj.done = false;
    obj.doneAt = null;
    // ⚠️ pour l’instant on ne retire pas les XP (on peut l’ajouter après)
    save();
    renderObjectives();
    return;
  }

  // Milestone step : on remet step.done = false et step.doneAt = null
  if (item.kind === "milestoneStep") {
    const obj = item.ref.obj;
    const step = item.ref.step;
    step.done = false;
    step.doneAt = null;

    // ⚠️ on ne touche pas à progress (car progress = nb de validations “livres”)
    // sinon ça casserait ta logique compteur
    save();
    renderObjectives();
    return;
  }
}

function renderObjectiveRow(obj, opts){
  const row = document.createElement("div");
  row.className = "obj-row";

  const left = document.createElement("div");
  left.className = "obj-left";

  // checkbox (pas sur archivés)
  if (opts.showCheck) {
    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "obj-check";

    // état checkbox selon type
    check.checked = isArchivedObjective(obj);

    check.onchange = () => {
      // unique : check => done true/false
      if (obj.type === "unique") {
        obj.done = check.checked;
      }
      // milestone : check => finit tous les steps / ou réactive (remet tout à false)
      else if (obj.type === "milestone") {
        if (check.checked) {
          (obj.steps || []).forEach(s => s.done = true);
        } else {
          (obj.steps || []).forEach(s => s.done = false);
        }
      }
      // repeatable : on archive via une propriété dédiée
      else if (obj.type === "repeatable") {
        obj.archived = check.checked;
      }

      save();
      renderObjectives();
    };

    left.appendChild(check);
  }

  const title = document.createElement("div");
  title.className = "obj-title";
  title.textContent = `${getObjectiveTitle(obj)} (${getObjectiveXpText(obj)})`;
  left.appendChild(title);

  const metaText = getObjectiveMetaText(obj);
  if (metaText) {
    const meta = document.createElement("div");
    meta.className = "obj-meta";
    meta.textContent = metaText;
    left.appendChild(meta);
  }

  const actions = document.createElement("div");
  actions.className = "obj-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "obj-edit-btn";
  editBtn.type = "button";
  editBtn.title = "Modifier";
  editBtn.textContent = "🗒️";
  editBtn.onclick = () => startEditObjective(obj);
  actions.appendChild(editBtn);

  row.appendChild(left);
  row.appendChild(actions);
  return row;
}

function getObjectiveTitle(obj){
  if (obj.type === "milestone") {
    // exemple: "Lire X livres" -> on garde prefix/suffix sans mettre le X ici
    return `${obj.prefix} … ${obj.suffix}`.trim();
  }
  return (obj.name || "Objectif").trim();
}

function isMilestoneDone(obj){
  const steps = obj.steps || [];
  return steps.length > 0 && steps.every(s => s.done);
}

function isArchivedObjective(obj){
  if (obj.type === "unique") return !!obj.done;
  if (obj.type === "milestone") return isMilestoneDone(obj);
  if (obj.type === "repeatable") return !!obj.archived;
  return false;
}

function getObjectiveXpText(obj){
  if (obj.type === "milestone") {
    // XP du prochain palier (ou 0 si fini)
    const step = (obj.steps || []).find(s => !s.done);
    return step ? `${step.xp} XP` : `0 XP`;
  }
  // unique / repeatable
  return `${Number(obj.xp || 0)} XP`;
}

function getObjectiveMetaText(obj){
  if (obj.type === "milestone") {
    const steps = obj.steps || [];
    const done = steps.filter(s => s.done).length;
    const total = steps.length;
    if (total > 0) return `Palier ${Math.min(done + 1, total)}/${total}`;
    return "";
  }
  if (obj.type === "repeatable") {
    const n = Number(obj.doneCount || 0);
    return `${n} fois`;
  }
  return "";
}

function startEditObjective(obj){
  editingObjectiveId = obj.id;

  if (editObjectiveTitle) {
    editObjectiveTitle.textContent = `Modifier l’objectif`;
  }

  // type
  if (editObjectiveTypeSelect) editObjectiveTypeSelect.value = obj.type || "repeatable";
  refreshEditObjectiveTypeUI();

  // reset champs
  if (editObjNameInput) editObjNameInput.value = "";
  if (editObjXpInput) editObjXpInput.value = "";
  if (editObjNameUniqueInput) editObjNameUniqueInput.value = "";
  if (editObjXpUniqueInput) editObjXpUniqueInput.value = "";
  if (editMilestonePrefixInput) editMilestonePrefixInput.value = "";
  if (editMilestoneSuffixInput) editMilestoneSuffixInput.value = "";
  editDraftMilestoneSteps = [];
  renderEditMilestonePreview();

  // pré-remplir selon type
  if (obj.type === "repeatable") {
    if (editObjNameInput) editObjNameInput.value = obj.name || "";
    if (editObjXpInput) editObjXpInput.value = obj.xp ?? "";
  } else if (obj.type === "unique") {
    if (editObjNameUniqueInput) editObjNameUniqueInput.value = obj.name || "";
    if (editObjXpUniqueInput) editObjXpUniqueInput.value = obj.xp ?? "";
  } else if (obj.type === "milestone") {
    if (editMilestonePrefixInput) editMilestonePrefixInput.value = obj.prefix || "";
    if (editMilestoneSuffixInput) editMilestoneSuffixInput.value = obj.suffix || "";
    editDraftMilestoneSteps = (obj.steps || []).map(s => ({ ...s }));
    renderEditMilestonePreview();
  }

  openEditObjectiveModal();
}

function formatDateTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function canDeleteEntry(entry) {
  const ageMs = Date.now() - entry.createdAt;
  return ageMs <= 24 * 60 * 60 * 1000;
}

function canUndo(ts) {
  if (!ts) return false;
  return (Date.now() - ts) <= 24 * 60 * 60 * 1000;
}

function formatDateShort(ts){
  if (!ts) return "";
  return formatDateTime(ts); // tu as déjà une fonction propre
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
    row.className = "objective-row";

    const label = document.createElement("div");
    label.className = "label";
    label.innerHTML =
      `<strong>${formatDateTime(entry.createdAt)}</strong><br>` +
      `<span class="hint">Temps saisi : ${entry.minutes} min • +${entry.xp} XP</span>`;

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

  w.entries = w.entries.filter(e => e.id !== entryId);

  w.stats.timeTotal = Math.max(0, (w.stats.timeTotal || 0) - entry.minutes);

  w.stats.totalXp = Math.max(0, (w.stats.totalXp || 0) - entry.xp);
  w.stats.weekXp = Math.max(0, (w.stats.weekXp || 0) - entry.xp);
  w.stats.monthXp = Math.max(0, (w.stats.monthXp || 0) - entry.xp);

  state.global.totalXp = Math.max(0, (state.global.totalXp || 0) - entry.xp);
  state.global.weekXp = Math.max(0, (state.global.weekXp || 0) - entry.xp);
  state.global.monthXp = Math.max(0, (state.global.monthXp || 0) - entry.xp);

  save();
  showPopup(`🗑️ Saisie supprimée (-${entry.xp} XP)`);

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
if (openAddWorldBtn) openAddWorldBtn.onclick = forceOpenAddWorldModal;
if (cancelWorldBtn) cancelWorldBtn.onclick = (e) => {
  e.preventDefault();
  forceCloseAddWorldModal();
};

if (createWorldBtn) createWorldBtn.onclick = async () => {
  const name = (worldNameInput?.value || "").trim();
  const icon = (worldIconInput?.value || "").trim();
  const minutes = parseInt(minutesBaseInput?.value || "", 10);
  const xp = parseInt(xpBaseInput?.value || "", 10);

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
    objectives: [],
    entries: []
  };

  save();
  renderWorlds();
  forceCloseAddWorldModal();
};

// onboarding
if (startBtn) startBtn.onclick = async () => {
  const name = (playerNameInput?.value || "").trim();
  if (!name) return uiAlert("Entre un pseudo", "Bienvenue");
  state.playerName = name;
  save();
  renderAfterAuth();
};

// back buttons
if (openPerformanceBtn) openPerformanceBtn.onclick = () => {
  showScreen(performanceScreen);
  renderPerformanceScreen();
};
if (backHomeBtn) backHomeBtn.onclick = () => goHome();

if (openSettingsBtn) openSettingsBtn.onclick = () => {
  settingsReturnTo = "home";
  showScreen(settingsScreen);
  renderSettings();
};
if (backFromSettingsBtn) backFromSettingsBtn.onclick = () => {
  if (settingsReturnTo === "world" && state.activeWorldId) {
    showScreen(worldScreen);
    renderWorldScreen();
  } else {
    showScreen(homeScreen);
    renderHome();
  }
};

if (backFromPerformanceBtn) backFromPerformanceBtn.onclick = () => {
  showScreen(homeScreen);
  renderHome();
};

if (worldQuickSettingsBtn) {
  worldQuickSettingsBtn.onclick = () => {
    settingsReturnTo = "world";
    showScreen(settingsScreen);
    renderSettings();
  };
}

// ================== Time entry ==================
if (validateTimeBtn) validateTimeBtn.onclick = () => {
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  const minutes = parseInt(timeMinutesInput?.value || "", 10);
  if (!Number.isFinite(minutes) || minutes <= 0) return uiAlert("Minutes invalides", "Saisie temps");

  const xp = calculateTimeXp(w, minutes);

  if (!Array.isArray(w.entries)) w.entries = [];
  const entry = { id: "entry-" + Date.now(), createdAt: Date.now(), minutes, xp };
  w.entries.unshift(entry);

  w.stats.timeTotal = (w.stats.timeTotal || 0) + minutes;
  save();

  addXp(w.id, xp, "⏱️ Temps validé !");
  if (timeMinutesInput) timeMinutesInput.value = "";
  if (timePreviewEl) timePreviewEl.innerText = "";
};

// ================== Objectives create / validate ==================
let draftMilestoneSteps = [];

function refreshObjectiveTypeUI() {
  const t = objectiveTypeSelect?.value || "repeatable";
  if (objectiveFieldsRepeatable) objectiveFieldsRepeatable.classList.toggle("hidden", t !== "repeatable");
  if (objectiveFieldsUnique) objectiveFieldsUnique.classList.toggle("hidden", t !== "unique");
  if (objectiveFieldsMilestone) objectiveFieldsMilestone.classList.toggle("hidden", t !== "milestone");
  if (createObjectiveBtn) createObjectiveBtn.classList.toggle("hidden", t === "milestone");
}
if (objectiveTypeSelect) objectiveTypeSelect.onchange = refreshObjectiveTypeUI;
refreshObjectiveTypeUI();

if (addMilestoneStepBtn) addMilestoneStepBtn.onclick = async () => {
  const count = parseInt(milestoneCountInput?.value || "", 10);
  const xp = parseInt(milestoneXpInput?.value || "", 10);
  if (!Number.isFinite(count) || count <= 0) return uiAlert("Palier invalide", "Objectifs");
  if (!Number.isFinite(xp) || xp <= 0) return uiAlert("XP invalide", "Objectifs");

  const last = draftMilestoneSteps[draftMilestoneSteps.length - 1];
  if (last && count <= last.count) {
    return uiAlert(`Ajoute des paliers dans l’ordre (ex : ${last.count + 1}, puis plus grand).`, "Objectifs");
  }

  draftMilestoneSteps.push({ count, xp, done: false });

  if (milestoneCountInput) milestoneCountInput.value = "";
  if (milestoneXpInput) milestoneXpInput.value = "";
  renderMilestonePreview();
};

function renderMilestonePreview() {
  if (!milestoneStepsPreview) return;
  milestoneStepsPreview.innerHTML = "";
  draftMilestoneSteps.forEach(s => {
    const pill = document.createElement("div");
    pill.className = "step-pill";
    pill.innerText = `${s.count} → ${s.xp} XP`;
    milestoneStepsPreview.appendChild(pill);
  });
}

if (createMilestoneObjectiveBtn) createMilestoneObjectiveBtn.onclick = async () => {
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  const isEditing = !!editingObjectiveId;
  let obj = null;

  if (isEditing) {
    obj = (w.objectives || []).find(o => o.id === editingObjectiveId);
    if (!obj) { resetObjectiveForm(); return; }
  } else {
    obj = { id: "obj-" + Date.now(), type: "milestone", progress: 0 };
    w.objectives.push(obj);
  }

  const prefix = (milestonePrefixInput?.value || "").trim();
  const suffix = (milestoneSuffixInput?.value || "").trim();
  if (!prefix) return uiAlert("Texte 1 requis (ex : Lire)", "Objectifs");
  if (!suffix) return uiAlert("Texte 2 requis (ex : livres)", "Objectifs");
  if (draftMilestoneSteps.length === 0) return uiAlert("Ajoute au moins un palier", "Objectifs");

  obj.type = "milestone";
  obj.prefix = prefix;
  obj.suffix = suffix;
  obj.progress = Number(obj.progress || 0); // compteur
  obj.steps = draftMilestoneSteps.map(s => ({
    count: Number(s.count),
    xp: Number(s.xp),
    done: !!s.done,
    doneAt: s.done ? (s.doneAt || Date.now()) : null
}));

  // reset
  if (milestonePrefixInput) milestonePrefixInput.value = "";
  if (milestoneSuffixInput) milestoneSuffixInput.value = "";
  draftMilestoneSteps = [];
  renderMilestonePreview();

  editingObjectiveId = null;
  if (createObjectiveBtn) createObjectiveBtn.innerText = "Ajouter";

  save();
  showPopup(isEditing ? "📝 Objectif palier modifié" : "🎯 Objectif palier ajouté");
  renderObjectives();
};


if (createObjectiveBtn) createObjectiveBtn.onclick = async () => {
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  const t = objectiveTypeSelect?.value || "repeatable";
  const isEditing = !!editingObjectiveId;

  // si édition : on récupère l'objet existant
  let obj = null;
  if (isEditing) {
    obj = (w.objectives || []).find(o => o.id === editingObjectiveId);
    if (!obj) {
      resetObjectiveForm();
      return;
    }
  } else {
    obj = { id: "obj-" + Date.now(), type: t };
    w.objectives.push(obj);
  }

  // IMPORTANT : si l'utilisateur change le type pendant l'édition
  obj.type = t;

  if (t === "repeatable") {
    const name = (objNameInput?.value || "").trim();
    const xp = parseInt(objXpInput?.value || "", 10);
    if (!name) return uiAlert("Nom requis", "Objectifs");
    if (!Number.isFinite(xp) || xp <= 0) return uiAlert("XP invalide", "Objectifs");

    obj.name = name;
    obj.xp = xp;
    obj.doneCount = obj.doneCount || 0;
    obj.archived = !!obj.archived;

    if (objNameInput) objNameInput.value = "";
    if (objXpInput) objXpInput.value = "";
  }

  if (t === "unique") {
    const name = (objNameUniqueInput?.value || "").trim();
    const xp = parseInt(objXpUniqueInput?.value || "", 10);
    if (!name) return uiAlert("Nom requis", "Objectifs");
    if (!Number.isFinite(xp) || xp <= 0) return uiAlert("XP invalide", "Objectifs");

    obj.name = name;
    obj.xp = xp;
    obj.done = !!obj.done;
    obj.doneAt = obj.done ? (obj.doneAt || Date.now()) : null;

    if (objNameUniqueInput) objNameUniqueInput.value = "";
    if (objXpUniqueInput) objXpUniqueInput.value = "";
  }
  // fin édition
  editingObjectiveId = null;
  if (createObjectiveBtn) createObjectiveBtn.innerText = "Ajouter";

  save();
  showPopup(isEditing ? "📝 Objectif modifié" : "🎯 Objectif ajouté");
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
    obj.doneAt = Date.now();
    save();
    addXp(w.id, obj.xp, "🎯 Objectif validé !");
    renderObjectives();
    return;
  }

if (obj.type === "milestone") {
  if (!Array.isArray(obj.steps)) obj.steps = [];
  obj.progress = Number(obj.progress || 0) + 1;

  // palier suivant non atteint
  const next = obj.steps.find(s => !s.done);
  if (!next) {
    // déjà fini
    save();
    renderObjectives();
    return;
  }

  // si on vient d'atteindre (ou dépasser) ce palier
  if (obj.progress >= Number(next.count || 0)) {
    next.done = true;
    next.doneAt = Date.now(); // ✅ date d’archivage du palier

    save();
    addXp(w.id, Number(next.xp || 0), "🏅 Palier atteint !");
    renderObjectives();
    return;
  }

  // sinon : juste progression, pas d’XP
  save();
  showPopup(`📚 Progression : ${obj.progress}`);
  renderObjectives();
  return;
}
}

if (editSaveObjectiveBtn) editSaveObjectiveBtn.onclick = async () => {
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  const obj = (w.objectives || []).find(o => o.id === editingObjectiveId);
  if (!obj) return;

  const t = editObjectiveTypeSelect?.value || obj.type;
  obj.type = t;

  if (t === "repeatable") {
    const name = (editObjNameInput?.value || "").trim();
    const xp = parseInt(editObjXpInput?.value || "", 10);
    if (!name) return uiAlert("Nom requis", "Modifier objectif");
    if (!Number.isFinite(xp) || xp <= 0) return uiAlert("XP invalide", "Modifier objectif");

    obj.name = name;
    obj.xp = xp;
  }

  if (t === "unique") {
    const name = (editObjNameUniqueInput?.value || "").trim();
    const xp = parseInt(editObjXpUniqueInput?.value || "", 10);
    if (!name) return uiAlert("Nom requis", "Modifier objectif");
    if (!Number.isFinite(xp) || xp <= 0) return uiAlert("XP invalide", "Modifier objectif");

    obj.name = name;
    obj.xp = xp;
  }

  save();
  showPopup("📝 Objectif modifié");
  closeEditObjectiveModal();
  renderObjectives();
};

if (editAddMilestoneStepBtn) editAddMilestoneStepBtn.onclick = async () => {
  const count = parseInt(editMilestoneCountInput?.value || "", 10);
  const xp = parseInt(editMilestoneXpInput?.value || "", 10);

  if (!Number.isFinite(count) || count <= 0) return uiAlert("Palier invalide", "Modifier objectif");
  if (!Number.isFinite(xp) || xp <= 0) return uiAlert("XP invalide", "Modifier objectif");

  editDraftMilestoneSteps.push({ count, xp, done: false });

  if (editMilestoneCountInput) editMilestoneCountInput.value = "";
  if (editMilestoneXpInput) editMilestoneXpInput.value = "";

  renderEditMilestonePreview();
};

if (editSaveMilestoneBtn) editSaveMilestoneBtn.onclick = async () => {
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  const obj = (w.objectives || []).find(o => o.id === editingObjectiveId);
  if (!obj) return;

  const prefix = (editMilestonePrefixInput?.value || "").trim();
  const suffix = (editMilestoneSuffixInput?.value || "").trim();

  if (!prefix) return uiAlert("Texte 1 requis", "Modifier objectif");
  if (!suffix) return uiAlert("Texte 2 requis", "Modifier objectif");
  if (editDraftMilestoneSteps.length === 0) return uiAlert("Ajoute au moins un palier", "Modifier objectif");

  obj.type = "milestone";
  obj.prefix = prefix;
  obj.suffix = suffix;
  obj.steps = editDraftMilestoneSteps.map(s => ({ ...s }));

  save();
  showPopup("📝 Objectif palier modifié");
  closeEditObjectiveModal();
  renderObjectives();
};

// ================== Settings ==================
function renderSettings() {
  if (monthGoalInput) monthGoalInput.value = getMonthGoal();
  if (weekGoalBusyInput) weekGoalBusyInput.value = state.settings.weekGoals.busy;
  if (weekGoalNormalInput) weekGoalNormalInput.value = state.settings.weekGoals.normal;
  if (weekGoalLightInput) weekGoalLightInput.value = state.settings.weekGoals.light;

  renderManageWorlds();

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

  if (activeWorlds.length === 0) manageWorldsActiveList.innerHTML = `<p class="hint">Aucun monde actif pour le moment.</p>`;
  if (archivedWorlds.length === 0) manageWorldsArchivedList.innerHTML = `<p class="hint">Aucun monde archivé pour le moment.</p>`;

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

if (saveGoalsBtn) saveGoalsBtn.onclick = () => {
  const mg = parseInt(monthGoalInput?.value || "", 10);
  const b = parseInt(weekGoalBusyInput?.value || "", 10);
  const n = parseInt(weekGoalNormalInput?.value || "", 10);
  const l = parseInt(weekGoalLightInput?.value || "", 10);

  if (![mg, b, n, l].every(v => Number.isFinite(v) && v > 0)) {
    return uiAlert("Valeurs invalides", "Paramètres");
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

  state = defaultData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  try {
    const db = firebase.firestore();
    await db.collection("users").doc(user.uid).collection("app").doc("save").delete();
  } catch (e) {
    console.error(e);
    showPopup("⚠️ Reset cloud impossible");
  }

  showPopup("🧹 Jeu réinitialisé");
  renderAfterAuth();
};

// ================== Init + patches ==================

// Init: afficher loading direct (évite flash login)
showScreen(loadingScreen);

// fermeture modal (bouton annuler)
document.addEventListener("DOMContentLoaded", () => {
  const cancelBtn = document.getElementById("cancelWorldBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      forceCloseAddWorldModal();
    });
  }
});

// fermeture modal (clic overlay)
document.addEventListener("click", (e) => {
  const modal = document.getElementById("addWorldModal");
  if (!modal) return;
  if (e.target === modal) forceCloseAddWorldModal();
});

// service worker update -> reload
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}

// ================== Cloud globals ==================
let cloudAuthUser = null;
let cloudDb = null;
let cloudSaveTimer = null;

// ================== FIREBASE AUTH (Email/MDP) ==================
(function setupFirebaseAuth(){
  const authStatus = document.getElementById("authStatus");
  const authEmail = document.getElementById("authEmail");
  const authPassword = document.getElementById("authPassword");
  const btnLogin = document.getElementById("btnLogin");
  const btnSignup = document.getElementById("btnSignup");

  const btnLogout = document.getElementById("btnLogout");
  const accountEmailLine = document.getElementById("accountEmailLine");

  if (!window.firebase || !firebase.auth) {
    console.warn("Firebase Auth non chargé.");
    if (authStatus) authStatus.textContent = "Firebase non chargé";
    showScreen(loginScreen);
    return;
  }

  const auth = firebase.auth();

  async function signup() {
    const email = (authEmail?.value || "").trim();
    const pass = (authPassword?.value || "").trim();
    if (!email || !pass) return uiAlert("Email et mot de passe requis", "Connexion");

    try {
      await auth.createUserWithEmailAndPassword(email, pass);

      state = defaultData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

      showPopup("✅ Compte créé");
      renderAfterAuth();
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
    } catch (e) {
      await uiAlert(e.message, "Connexion");
    }
  }

  async function logout() {
    try {
      await auth.signOut();
      showPopup("👋 Déconnectée");
    } catch (e) {
      await uiAlert(e.message, "Connexion");
    }
  }

  if (btnLogin) btnLogin.onclick = login;
  if (btnSignup) btnSignup.onclick = signup;
  if (btnLogout) btnLogout.onclick = logout;

  // ✅ source de vérité au refresh
  auth.onAuthStateChanged(async (user) => {
    cloudAuthUser = user || null;

    // Loading visible tant qu’on n’a pas décidé
    showScreen(loadingScreen);

    if (authStatus) authStatus.textContent = user ? `Connectée : ${user.email}` : "Non connectée";
    if (accountEmailLine) accountEmailLine.textContent = user ? `${user.email}` : "";

    if (!user) {
      renderAfterAuth(); // -> login
      return;
    }

    try {
      await pullCloudAndMerge(); // peut remplacer state
    } catch (e) {
      console.error(e);
      showPopup("⚠️ Sync cloud impossible");
    }

    renderAfterAuth(); // -> home/onboarding
    // re-render pour être sûre que tout est à jour
    renderHome();
    renderHomeStats();
    renderWorlds();
  });
})();

// ================== FIRESTORE CLOUD SAVE ==================
function cloudSaveRef(uid) {
  return cloudDb.collection("users").doc(uid).collection("app").doc("save");
}

function initCloudDbIfReady() {
  if (!window.firebase || !firebase.firestore || !firebase.auth) return false;
  if (!cloudDb) cloudDb = firebase.firestore();
  return true;
}

function scheduleCloudSave() {
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

  if (!snap.exists) {
    await pushCloudSave();
    showPopup("☁️ Sauvegarde cloud créée");
    return;
  }

  const cloud = snap.data() || {};
  const cloudState = cloud.state;
  const cloudUpdatedAt = cloud.updatedAt || 0;
  const localUpdatedAt = state?.meta?.updatedAt || 0;

  if (cloudState && cloudUpdatedAt > localUpdatedAt) {
    state = cloudState;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    showPopup("☁️ Données récupérées");
  } else {
    await pushCloudSave();
    showPopup("☁️ Données synchronisées");
  }
}
