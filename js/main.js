document.addEventListener("DOMContentLoaded", () => {
  const v = document.getElementById("appVersion");
  if (v) v.textContent = "V1 - 21/02/2026";
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

    meta: { updatedAt: 0, freshInstall: true },

    settings: {
      weekLoad: "focus",
      weekGoals: { chill: 200, focus: 400, boss: 600 },
      monthGoal: 1600,
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
let cloudHydrated = false;

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
  refreshObjectiveTypeUI();
}

function load() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch(e) {}

  const hadLocal = !!raw && typeof raw === "object";
  const data = hadLocal ? raw : defaultData();
  const def = defaultData();

  // ensure defaults exist
  if (!data.settings) data.settings = def.settings;
  if (!data.periods) data.periods = def.periods;
  if (!data.global) data.global = def.global;
  if (!data.worlds) data.worlds = {};
  if (data.settings.weekGoals == null) data.settings.weekGoals = def.settings.weekGoals;
  if (!data.meta) data.meta = { updatedAt: 0, freshInstall: !hadLocal };
  if (data.meta.updatedAt == null) data.meta.updatedAt = 0;
  if (!data.history) data.history = { weeks: {}, months: {} };
  if (!data.history.weeks) data.history.weeks = {};
  if (!data.history.months) data.history.months = {};
  
  const validLoads = ["chill", "focus", "boss"];
  const mapOldLoad = { light: "chill", normal: "focus", busy: "boss", "chargée": "boss" };
  if (!validLoads.includes(data.settings.weekLoad)) {
    data.settings.weekLoad = mapOldLoad[data.settings.weekLoad] || def.settings.weekLoad; // "focus"
  }

  const g = data.settings.weekGoals || {};
  data.settings.weekGoals = {
    chill: Number(g.chill ?? g.light ?? def.settings.weekGoals.chill),
    focus: Number(g.focus ?? g.normal ?? def.settings.weekGoals.focus),
    boss:  Number(g.boss  ?? g.busy  ?? def.settings.weekGoals.boss)
  };

  if (!Number.isFinite(Number(data.settings.monthGoal)) || Number(data.settings.monthGoal) <= 0) {
    data.settings.monthGoal = def.settings.monthGoal;
  }

  if (!hadLocal) {
    data.meta.freshInstall = true;
    data.meta.updatedAt = 0;
  } else {
    data.meta.freshInstall = false;
  }

  const wk = getISOWeekKey();
  const mk = getMonthKey();

  data.celebrations = data.celebrations || { weekKey: null, monthKey: null };

  if (data.periods.weekKey !== wk) {
    const oldKey = data.periods.weekKey;
    const oldXp = data.global.weekXp ?? 0;
    const oldGoal = (data.settings?.weekGoals?.[data.settings?.weekLoad] ?? 400);
    if (oldKey) data.history.weeks[oldKey] = { xp: oldXp, goal: oldGoal };

    data.periods.weekKey = wk;
    data.global.weekXp = 0;
    Object.values(data.worlds).forEach(w => { if (w?.stats) w.stats.weekXp = 0; });
    data.celebrations.weekKey = null;
  }

  if (data.periods.monthKey !== mk) {
    const oldKey = data.periods.monthKey;
    const oldXp = data.global.monthXp ?? 0;
    const oldGoal = Number(data.settings?.monthGoal) || 1600;
    if (oldKey) data.history.months[oldKey] = { xp: oldXp, goal: oldGoal };

    data.periods.monthKey = mk;
    data.global.monthXp = 0;
    Object.values(data.worlds).forEach(w => { if (w?.stats) w.stats.monthXp = 0; });
    data.celebrations.monthKey = null;
  }

  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
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
const weekGoalChillInput = el("weekGoalChillInput");
const weekGoalFocusInput = el("weekGoalFocusInput");
const weekGoalBossInput = el("weekGoalBossInput");
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
const editObjectiveInfo = el("editObjectiveInfo");

// popup
const popupEl = el("popup");

// quick world settings (future)
const worldQuickSettingsBtn = el("worldQuickSettingsBtn");

const editDeleteObjectiveBtn = el("editDeleteObjectiveBtn");
if (editDeleteObjectiveBtn) editDeleteObjectiveBtn.onclick = () => deleteObjective(editingObjectiveId);

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
  }, 4600);
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

function openCelebrationModal({ title, msg, emoji = "🎉" }){
  const modal = document.getElementById("celebrationModal");
  const t = document.getElementById("celebrationTitle");
  const m = document.getElementById("celebrationMsg");
  const e = document.getElementById("celebrationEmoji");
  const ok = document.getElementById("celebrationOkBtn");

  if (!modal || !t || !m || !ok || !e) return;

  t.textContent = title;
  m.textContent = msg;
  e.textContent = emoji;

  function close(){
    ok.removeEventListener("click", close);
    modal.classList.add("hidden");
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }

  ok.addEventListener("click", close);

  modal.classList.remove("hidden");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}

function ensureCelebrationsState(){
  if (!state.celebrations) state.celebrations = { weekKey: null, monthKey: null };
}

// ================== Modals helpers ==================
function forceCloseAddWorldModal() {
  const modal = document.getElementById("addWorldModal");
  if (!modal) return;
  modal.classList.add("hidden");
  if (minutesBaseInput && (minutesBaseInput.value === "" || minutesBaseInput.value == null)) {
    minutesBaseInput.value = "1";
  }
  if (xpBaseInput && (xpBaseInput.value === "" || xpBaseInput.value == null)) {
    xpBaseInput.value = "1";
  }
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
  if (minutesBaseInput) minutesBaseInput.value = "1";
  if (xpBaseInput) xpBaseInput.value = "1";
}
function forceOpenAddWorldModal() {
  const modal = document.getElementById("addWorldModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}

let editDraftMilestoneSteps = [];
let editMilestoneEditIndex = null;

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
  editMilestoneEditIndex = null;
  if (editAddMilestoneStepBtn) editAddMilestoneStepBtn.innerText = "Ajouter palier";
  editDraftMilestoneSteps = [];
  renderEditMilestonePreview();
  if (editObjectiveInfo) editObjectiveInfo.textContent = "";
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

  editDraftMilestoneSteps
    .slice()
    .sort((a,b) => Number(a.count) - Number(b.count))
    .forEach((s, i) => {
      const pill = document.createElement("div");
      pill.className = "step-pill";
      pill.innerText = `${s.count} → ${s.xp} XP`;

      // rendre cliquable
      pill.style.cursor = "pointer";

      // highlight si sélectionné
      if (editMilestoneEditIndex === i) {
        pill.classList.add("active");
      }

      pill.onclick = () => {
        // on passe en mode édition de ce palier
        editMilestoneEditIndex = i;

        if (editMilestoneCountInput) editMilestoneCountInput.value = s.count;
        if (editMilestoneXpInput) editMilestoneXpInput.value = s.xp;

        if (editAddMilestoneStepBtn) editAddMilestoneStepBtn.innerText = "Modifier ce palier";
        renderEditMilestonePreview();
      };

      editMilestoneStepsPreview.appendChild(pill);
    });
}

if (editObjectiveTypeSelect) editObjectiveTypeSelect.onchange = refreshEditObjectiveTypeUI;
if (editCancelObjectiveBtn) editCancelObjectiveBtn.onclick = closeEditObjectiveModal;

// clic sur overlay pour fermer
document.addEventListener("click", (e) => {
  if (editObjectiveModal && e.target === editObjectiveModal) closeEditObjectiveModal();
});

const resetGoalsBtn = document.getElementById("resetGoalsBtn");

if (resetGoalsBtn) {
  resetGoalsBtn.addEventListener("click", () => {
    const defaults = defaultData().settings;

    document.getElementById("weekGoalChillInput").value = defaults.weekGoals.chill;
    document.getElementById("weekGoalFocusInput").value = defaults.weekGoals.focus;
    document.getElementById("weekGoalBossInput").value  = defaults.weekGoals.boss;
    document.getElementById("monthGoalInput").value     = defaults.monthGoal;
  });
}

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
  const load = state.settings.weekLoad || "focus";
  return state.settings.weekGoals?.[load] ?? 400;
}
function getMonthGoal() {
  return Number(state.settings.monthGoal) || 1600;
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
  if (gNow > gPrev) showPopup(`⭐ Niveau global ${gNow} atteint !`);

  const { prev: wPrev, now: wNow } = levelsGained(
    prevWorldXp, w.stats.totalXp,
    state.settings.levelBase, state.settings.levelGrowth
  );
  if (wNow > wPrev) showPopup(`🏰​​ Niveau ${wNow} atteint dans ${w.icon} ${w.name} !`);

  renderHomeStats();
  renderWorldStats();
}

// ✅ XP OBJECTIFS : affecte seulement TOTAL (global + monde), pas week/month
function addXpObjectiveOnly(worldId, xp, reasonText) {
  const w = state.worlds[worldId];
  if (!w) return;

  const prevGlobalXp = state.global.totalXp;
  const prevWorldXp = w.stats.totalXp;

  state.global.totalXp += xp;
  w.stats.totalXp += xp;

  save();
  showPopup(`${reasonText} +${xp} XP`);

  // levels (inchangé)
  const { prev: gPrev, now: gNow } = levelsGained(
    prevGlobalXp, state.global.totalXp,
    state.settings.levelBase, state.settings.levelGrowth
  );
  if (gNow > gPrev) showPopup(`⭐ Niveau global ${gNow} atteint !`);

  const { prev: wPrev, now: wNow } = levelsGained(
    prevWorldXp, w.stats.totalXp,
    state.settings.levelBase, state.settings.levelGrowth
  );
  if (wNow > wPrev) showPopup(`🏰 Niveau ${wNow} atteint dans ${w.icon} ${w.name} !`);

  renderHomeStats();
  renderWorldStats();
}

function removeXpObjectiveOnly(worldId, xp, reasonText) {
  const w = state.worlds[worldId];
  if (!w) return;

  state.global.totalXp = Math.max(0, (state.global.totalXp || 0) - xp);
  w.stats.totalXp = Math.max(0, (w.stats.totalXp || 0) - xp);

  save();
  showPopup(`${reasonText} -${xp} XP`);

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

  const totalMin = getGlobalTotalMinutes();
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  const pretty = `${String(hh).padStart(2,"0")}h${String(mm).padStart(2,"0")}mn`;
  const globalTimePrettyEl = document.getElementById("globalTimePretty");
  if (globalTimePrettyEl) globalTimePrettyEl.textContent = pretty;

  if (weekLoadPicker) {
    const buttons = weekLoadPicker.querySelectorAll("button");
    buttons.forEach(b => {
      b.classList.toggle("active", b.dataset.load === state.settings.weekLoad);
      b.onclick = async () => {
        const nextLoad = b.dataset.load;
        const current = state.settings.weekLoad;
        if (nextLoad === current) return;

        const label = nextLoad === "chill" ? "Chill" : nextLoad === "focus" ? "Focus" : "Boss";
        const ok = await uiConfirm(`Passer le mode de la semaine en ${label} ?`, "Modification de l'objectif hebdomadaire");
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

  ensureCelebrationsState();

  if (wPct >= 1 && state.celebrations.weekKey !== state.periods.weekKey) {
    state.celebrations.weekKey = state.periods.weekKey;
    save();
    openCelebrationModal({
      title: "🥇 Objectif hebdomadaire atteint !",
      msg: "Félicitations ! Tu as complété ton objectif de la semaine !",
      emoji: "🎉"
    });
  }

  if (mPct >= 1 && state.celebrations.monthKey !== state.periods.monthKey) {
    state.celebrations.monthKey = state.periods.monthKey;
    save();
    openCelebrationModal({
      title: "🏆 Objectif mensuel atteint !",
      msg: "Incroyable ! Tu as complété ton objectif du mois !",
      emoji: "🎉"
    });
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

    const time = world?.stats?.timeTotal ?? 0;
    const xp = world?.stats?.totalXp ?? 0;
    const hh = Math.floor(time / 60);
    const mm = time % 60;

    btn.innerHTML = `
      <div class="world-title-row">
        <div class="world-title">${world.icon} ${world.name}</div>
      </div>
      <div class="world-meta">
        ${String(hh).padStart(2,"0")}h${String(mm).padStart(2,"0")} • ${xp} XP
      </div>
    `;

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

function normalizeWorldObjectives(w){
  if (!w) return;
  if (!Array.isArray(w.objectives)) w.objectives = [];

  w.objectives.forEach(o => {
    if (!o || !o.type) return;

    // Repeatable: events = historique de validations (1 ligne par validation)
    if (o.type === "repeatable") {
      if (!Array.isArray(o.events)) o.events = [];
      const n = Number(o.doneCount || 0);
      if (n > 0 && o.events.length === 0) {
        const now = Date.now();
        for (let i = 0; i < n; i++) o.events.push({ ts: now, xp: Number(o.xp || 0) });
      }
      o.doneCount = o.events.length;
    }

    // Unique
    if (o.type === "unique") {
      o.done = !!o.done;
      if (o.done && !o.doneAt) o.doneAt = Date.now();
      if (!o.done) o.doneAt = null;
    }

    // Milestone
    if (o.type === "milestone") {
      if (!Array.isArray(o.steps)) o.steps = [];
      o.progress = Number(o.progress || 0);
      if (!Array.isArray(o.progressEvents)) o.progressEvents = []; // chaque validation +1 (même sans XP)
      // sécurité types
      o.steps = o.steps.map(s => ({
        count: Number(s.count || 0),
        xp: Number(s.xp || 0),
        done: !!s.done,
        doneAt: s.done ? (s.doneAt || Date.now()) : null
      }));
      o.steps.sort((a,b) => a.count - b.count);
    }
  });
}

function getObjectiveIcon(type){
  if (type === "unique") return "🎖️";
  if (type === "repeatable") return "🔮";
  if (type === "milestone") return "🧗🏼";
  return "🎯";
}

function isMilestoneAllDone(obj){
  const steps = obj.steps || [];
  return steps.length > 0 && steps.every(s => s.done);
}

function getMilestoneNextStep(obj){
  return (obj.steps || []).find(s => !s.done) || null;
}

// 2 sections : En cours / Archivés
function renderObjectives() {
  const w = state.worlds[state.activeWorldId];
  if (!w || !objectivesListEl) return;

  normalizeWorldObjectives(w);

  const list = w.objectives || [];

  // EN COURS
  const inProgress = [];
  list.forEach(o => {
    if (!o) return;
    if (o.deleted) return; 

    if (o.type === "unique" && !o.done) inProgress.push(o);
    if (o.type === "repeatable") inProgress.push(o);
    if (o.type === "milestone" && !isMilestoneAllDone(o)) inProgress.push(o);
  });

  // ARCHIVÉS (items flatten)
  const archived = [];

  // uniques validés
  list.filter(o => o.type === "unique" && o.done).forEach(o => {
    archived.push({
      kind: "uniqueDone",
      id: o.id,
      icon: "🎖️",
      title: `${(o.name || "Objectif").trim()}`,
      xp: Number(o.xp || 0),
      ts: o.doneAt || null,
      undoable: canUndo(o.doneAt),
      ref: { obj: o }
    });
  });

  // répétables : 1 ligne par validation
  list.filter(o => o.type === "repeatable").forEach(o => {
    const events = Array.isArray(o.events) ? o.events : [];
    if (events.length === 0) return;

    events.forEach((ev, idx) => {
      const n = idx + 1;
      const isLast = idx === events.length - 1;

      archived.push({
        kind: "repeatableEvent",
        id: `${o.id}-ev-${idx}`,
        icon: "🔮",
        title: `${(o.name || "Objectif").trim()} • x${n}`,
        xp: Number(ev.xp || 0),
        ts: ev.ts || null,
        undoable: isLast && canUndo(ev.ts),
        ref: { obj: o }
      });
    });
  });

  // paliers atteints : 1 ligne par palier validé
  list.filter(o => o.type === "milestone").forEach(o => {
    const doneSteps = (o.steps || []).filter(s => s.done);
    if (doneSteps.length === 0) return;

    // undo uniquement sur le dernier palier atteint (sinon incohérences)
    const lastTs = Math.max(...doneSteps.map(s => Number(s.doneAt || 0)));

    doneSteps.forEach(s => {
      archived.push({
        kind: "milestoneStep",
        id: `${o.id}-step-${s.count}`,
        icon: "🧗🏼",
        title: `${(o.prefix || "").trim()} ${s.count} ${(o.suffix || "").trim()}`,
        xp: Number(s.xp || 0),
        ts: s.doneAt || null,
        undoable: (s.doneAt === lastTs) && canUndo(s.doneAt),
        ref: { obj: o, step: s }
      });
    });
  });

  // tri des archives par date desc
  archived.sort((a,b) => (Number(b.ts||0) - Number(a.ts||0)));

  // RENDER
  objectivesListEl.innerHTML = "";

  // Si rien : tu voulais "juste le titre Objectifs" => donc on n’affiche rien ici
  if (inProgress.length === 0 && archived.length === 0) return;

  renderObjectivesSection("Objectifs en cours", inProgress);
  renderArchivedSection("Objectifs archivés", archived);
}

function renderObjectivesSection(title, items){
  if (!items || items.length === 0) return;

  const h = document.createElement("div");
  h.className = "obj-section-title";
  h.textContent = title;
  objectivesListEl.appendChild(h);

  items.forEach(o => objectivesListEl.appendChild(renderInProgressRow(o)));
}

function renderArchivedSection(title, items){
  if (!items || items.length === 0) return;

  const h = document.createElement("div");
  h.className = "obj-section-title";
  h.textContent = title;
  objectivesListEl.appendChild(h);

  items.forEach(item => objectivesListEl.appendChild(renderArchivedRow(item)));
}

function renderInProgressRow(obj){
  const row = document.createElement("div");
  row.className = "obj-row";

  const left = document.createElement("div");
  left.className = "obj-left";

  const title = document.createElement("div");
  title.className = "obj-title";

  const xpLine = document.createElement("div");
  xpLine.className = "obj-meta";

  const icon = getObjectiveIcon(obj.type);

  if (obj.type === "unique") {
    title.textContent = `${icon} ${(obj.name || "Objectif").trim()}`;
    xpLine.textContent = `${Number(obj.xp || 0)} XP`;
  }

  if (obj.type === "repeatable") {
    title.textContent = `${icon} ${(obj.name || "Objectif").trim()}`;
    xpLine.textContent = `${Number(obj.xp || 0)} XP`;
  }

  if (obj.type === "milestone") {
    const next = getMilestoneNextStep(obj);
    const xp = next ? Number(next.xp || 0) : 0;
    title.textContent = `${icon} ${(obj.prefix || "").trim()} 1 ${(obj.suffix || "").trim()}`;
    xpLine.textContent = `${xp} XP`;
  }

  left.appendChild(title);
  left.appendChild(xpLine);

  const actions = document.createElement("div");
  actions.className = "obj-actions";

  const validateBtn = document.createElement("button");
  validateBtn.className = "obj-icon-inline";
  validateBtn.type = "button";
  validateBtn.title = "Valider";
  validateBtn.textContent = "🎯";
  validateBtn.onclick = () => validateObjective(obj.id);

  const editBtn = document.createElement("button");
  editBtn.className = "obj-icon-inline";
  editBtn.type = "button";
  editBtn.title = "Modifier";
  editBtn.textContent = "✏️";
  editBtn.onclick = () => startEditObjective(obj);

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
  title.textContent = `${item.icon} ${item.title}`;

  const meta = document.createElement("div");
  meta.className = "obj-meta";
  meta.textContent = item.ts ? `🎯 ${formatDateShort(item.ts)}` : "";

  const xpLine = document.createElement("div");
  xpLine.className = "obj-meta";
  xpLine.textContent = `${Number(item.xp || 0)} XP`;
  left.appendChild(title);
  left.appendChild(xpLine);
  left.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "obj-actions";

  const undoBtn = document.createElement("button");
  undoBtn.className = "obj-icon-inline";
  undoBtn.type = "button";
  undoBtn.title = item.undoable ? "Annuler (24h)" : "Annulation impossible";
  undoBtn.textContent = "👾​";
  undoBtn.disabled = !item.undoable;

  undoBtn.onclick = () => undoArchivedItem(item);

  actions.appendChild(undoBtn);

  row.appendChild(left);
  row.appendChild(actions);
  return row;
}

async function undoArchivedItem(item){
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  if (!item.undoable) {
    await uiAlert("Tu ne peux annuler que pendant 24h.", "Archivés");
    return;
  }

  const ok = await uiConfirm("Annuler cet objectif ?", "Annuler l'objectif");
  if (!ok) return;

  // UNIQUE
  if (item.kind === "uniqueDone") {
    const obj = item.ref.obj;
    obj.done = false;
    obj.doneAt = null;

    removeXpObjectiveOnly(w.id, Number(item.xp || 0), "👾​ Objectif annulé");
    save();
    renderObjectives();
    return;
  }

  // RÉPÉTABLE : annule seulement la DERNIÈRE validation
  if (item.kind === "repeatableEvent") {
    const obj = item.ref.obj;
    obj.events = Array.isArray(obj.events) ? obj.events : [];
    if (obj.events.length === 0) return;

    const last = obj.events[obj.events.length - 1];
    if (!canUndo(last.ts)) return;

    obj.events.pop();
    obj.doneCount = obj.events.length;

    removeXpObjectiveOnly(w.id, Number(last.xp || obj.xp || 0), "↩️ Annulation");
    save();
    renderObjectives();
    return;
  }

  // PALIER : annule seulement le DERNIER palier atteint (cohérence)
  if (item.kind === "milestoneStep") {
    const obj = item.ref.obj;
    const step = item.ref.step;

    // sécurité : ne pas casser si ce n'est pas le dernier step atteint
    const doneSteps = (obj.steps || []).filter(s => s.done);
    const lastTs = Math.max(...doneSteps.map(s => Number(s.doneAt || 0)));
    if (Number(step.doneAt || 0) !== Number(lastTs || 0)) return;

    // on retire 1 validation de progression (celle qui a déclenché ce palier)
    obj.progress = Math.max(0, Number(obj.progress || 0) - 1);
    if (Array.isArray(obj.progressEvents) && obj.progressEvents.length) {
      obj.progressEvents.pop();
    }

    step.done = false;
    step.doneAt = null;

    removeXpObjectiveOnly(w.id, Number(step.xp || 0), "↩️ Annulation");
    save();
    renderObjectives();
    return;
  }
}

function startEditObjective(obj){
  editingObjectiveId = obj.id;

  // 🔒 type non modifiable
  if (editObjectiveTypeSelect) {
    editObjectiveTypeSelect.value = obj.type || "repeatable";
    editObjectiveTypeSelect.disabled = true;
  }
  refreshEditObjectiveTypeUI();

  if (editObjectiveTitle) {
    editObjectiveTitle.textContent = `Modifier l’objectif`;
  }

  // reset champs
  if (editObjNameInput) editObjNameInput.value = "";
  if (editObjXpInput) editObjXpInput.value = "";
  if (editObjNameUniqueInput) editObjNameUniqueInput.value = "";
  if (editObjXpUniqueInput) editObjXpUniqueInput.value = "";
  if (editMilestonePrefixInput) editMilestonePrefixInput.value = "";
  if (editMilestoneSuffixInput) editMilestoneSuffixInput.value = "";
  editDraftMilestoneSteps = [];
  renderEditMilestonePreview();
  editMilestoneEditIndex = null;
  if (editAddMilestoneStepBtn) editAddMilestoneStepBtn.innerText = "Ajouter palier";
  // pré-remplir selon type
  if (obj.type === "repeatable") {
    if (editObjNameInput) { editObjNameInput.value = obj.name || ""; editObjNameInput.disabled = true; }
    if (editObjXpInput)   { editObjXpInput.value = obj.xp ?? ""; editObjXpInput.disabled = false; }
  }

  if (obj.type === "unique") {
    if (editObjNameUniqueInput) { editObjNameUniqueInput.value = obj.name || ""; editObjNameUniqueInput.disabled = true; }
    if (editObjXpUniqueInput)   { editObjXpUniqueInput.value = obj.xp ?? ""; editObjXpUniqueInput.disabled = false; }
  }

  if (obj.type === "milestone") {
    if (editMilestonePrefixInput) { editMilestonePrefixInput.value = obj.prefix || ""; editMilestonePrefixInput.disabled = true; }
    if (editMilestoneSuffixInput) { editMilestoneSuffixInput.value = obj.suffix || ""; editMilestoneSuffixInput.disabled = true; }

    // ✅ seulement les paliers NON validés
    const nonDone = (obj.steps || []).filter(s => !s.done).map(s => ({ ...s, done:false, doneAt:null }));
    editDraftMilestoneSteps = nonDone;
    renderEditMilestonePreview();
  }
  // Infos non modifiables (affichées hors champs)
  if (editObjectiveInfo) {
    if (obj.type === "repeatable") {
      editObjectiveInfo.textContent = `Seule la récompense associée peut être modifiée`;
    } else if (obj.type === "unique") {
      editObjectiveInfo.textContent = `Seule la récompense associée peut être modifiée`;
    } else if (obj.type === "milestone") {
      editObjectiveInfo.textContent =
        `Non modifiable : Texte = "Seul l'ajout de nouveaux paliers et la modification de paliers non atteints est possible`;
    } else {
      editObjectiveInfo.textContent = "";
    }
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
    entriesListEl.innerHTML = `<p class="hint">Aucune temps n'a été saisi pour le moment.</p>`;
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

async function deleteObjective(objectiveId){
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  const obj = (w.objectives || []).find(o => o.id === objectiveId);
  if (!obj) return;

  const ok = await uiConfirm("Es-tu sûre de vouloir supprimer l’objectif ?", "Supprimer l'objectif");
  if (!ok) return;

  const also = await uiConfirm(
    "Veux-tu aussi supprimer l’historique associé (lignes archivées) et ainsi perdre les XP gagnées ?",
    "Supprimer aussi l’historique"
  );

  // CAS 1 : suppression simple (on garde l’historique)
  if (!also) {
    obj.deleted = true;       // ✅ soft delete
    obj.deletedAt = Date.now();
    save();
    closeEditObjectiveModal();
    renderObjectives();
    return;
  }

  // CAS 2 : suppression totale + retrait XP + effacement historique
  let totalObjXp = 0;

  if (obj.type === "unique") {
    if (obj.done) totalObjXp += Number(obj.xp || 0);
    obj.done = false;
    obj.doneAt = null;
  }

  if (obj.type === "repeatable") {
    const events = Array.isArray(obj.events) ? obj.events : [];
    totalObjXp += events.reduce((s, ev) => s + Number(ev.xp || 0), 0);
    obj.events = [];
    obj.doneCount = 0;
  }

  if (obj.type === "milestone") {
    const steps = Array.isArray(obj.steps) ? obj.steps : [];
    const doneSteps = steps.filter(s => s.done);
    totalObjXp += doneSteps.reduce((s, st) => s + Number(st.xp || 0), 0);

    obj.progress = 0;
    obj.progressEvents = [];
    obj.steps = steps.map(s => ({ ...s, done:false, doneAt:null }));
  }

  if (totalObjXp > 0) {
    removeXpObjectiveOnly(w.id, totalObjXp, "❌ Objectif et historique supprimé");
  }

  // on retire l'objectif complètement
  w.objectives = (w.objectives || []).filter(o => o.id !== obj.id);

  save();
  closeEditObjectiveModal();
  renderObjectives();
  renderHomeStats();
  renderWorldStats();
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

  const ok = await uiConfirm(`Es-tu sûr de vouloir supprimer cette saisie: ${entry.minutes} min - ${entry.xp} XP ?`, "Supprimer la saisie");
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
  showPopup(`❌ Saisie supprimée (-${entry.xp} XP)`);

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

  const minutesRaw = (minutesBaseInput?.value || "").trim();
  const xpRaw = (xpBaseInput?.value || "").trim();

  if (!name) return uiAlert("Nom du monde requis", "Créer un monde");
  if (!icon) return uiAlert("Icône requise (emoji)", "Créer un monde");

  // ✅ Cas 1 : les 2 vides -> défaut 1 / 1
  let minutes, xp;
  if (minutesRaw === "" && xpRaw === "") {
    minutes = 1;
    xp = 1;
  } else {
    // ✅ Cas 2 : un seul rempli -> erreur
    if (minutesRaw === "" || xpRaw === "") {
      return uiAlert("Si tu personnalises la règle XP, il faut renseigner à la fois Minutes ET XP.", "Ajouter un monde");
    }

    // ✅ Cas 3 : les 2 remplis -> ok
    minutes = parseInt(minutesRaw, 10);
    xp = parseInt(xpRaw, 10);

    if (!Number.isFinite(minutes) || minutes <= 0) return uiAlert("Minutes invalides", "Ajouter un monde");
    if (!Number.isFinite(xp) || xp <= 0) return uiAlert("XP invalides", "Ajouter un monde");
  }

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
  if (!name) return uiAlert("Saisir un pseudo", "Bienvenue");
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
  if (!Number.isFinite(minutes) || minutes <= 0) return uiAlert("Minutes saisies invalides", "Saisie de temps invalides");

  const xp = calculateTimeXp(w, minutes);

  if (!Array.isArray(w.entries)) w.entries = [];
  const entry = { id: "entry-" + Date.now(), createdAt: Date.now(), minutes, xp };
  w.entries.unshift(entry);

  w.stats.timeTotal = (w.stats.timeTotal || 0) + minutes;
  save();

  addXp(w.id, xp, "⏱️ Temps ajouté !");
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
    return uiAlert(`Les paliers saisis doivent être dans l'ordre croissant !`, "Objectifs");
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
  if (!prefix) return uiAlert("Partie 1 du nom requise", "Objectifs");
  if (!suffix) return uiAlert("Partie 2 du nom requise", "Objectifs");
  if (draftMilestoneSteps.length === 0) return uiAlert("Ajoute au moins un palier pour pouvoir créer l'objectif", "Objectifs");

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
  showPopup(isEditing ? "📝 Objectif palier modifié" : "✅​ Objectif palier ajouté");
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

  const effectiveType = isEditing ? obj.type : t;
  if (!isEditing) obj.type = t;

  if (effectiveType  === "repeatable") {
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

  if (effectiveType  === "unique") {
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
  showPopup(isEditing ? "📝 Objectif modifié" : "✅​ Objectif ajouté");
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
  obj.events = Array.isArray(obj.events) ? obj.events : [];
  const ts = Date.now();
  obj.events.push({ ts, xp: Number(obj.xp || 0) });
  obj.doneCount = obj.events.length;

  save();
  addXpObjectiveOnly(w.id, Number(obj.xp || 0), "🎯 Objectif validé !");
  renderObjectives();
  return;
}

else if (obj.type === "unique") {
  if (obj.done) return;
  obj.done = true;
  obj.doneAt = Date.now();

  save();
  addXpObjectiveOnly(w.id, Number(obj.xp || 0), "🎯 Objectif validé !");
  renderObjectives();
  return;
}

else if (obj.type === "milestone") {
  if (!Array.isArray(obj.steps)) obj.steps = [];
  obj.progress = Number(obj.progress || 0);
  obj.progressEvents = Array.isArray(obj.progressEvents) ? obj.progressEvents : [];

  // +1 “livre”
  const ts = Date.now();
  obj.progress += 1;
  obj.progressEvents.push({ ts });

  const next = obj.steps.find(s => !s.done);
  if (!next) {
    save();
    renderObjectives();
    return;
  }

  // palier atteint ?
  if (obj.progress >= Number(next.count || 0)) {
    next.done = true;
    next.doneAt = ts;

    save();
    addXpObjectiveOnly(w.id, Number(next.xp || 0), "🏅 Palier atteint !");
    renderObjectives();
    return;
  }

  save();
  showPopup(`📚 Progression : ${obj.progress}/${next.count}`);
  renderObjectives();
  return;
}
}

if (editSaveObjectiveBtn) editSaveObjectiveBtn.onclick = async () => {
  const w = state.worlds[state.activeWorldId];
  if (!w) return;

  const obj = (w.objectives || []).find(o => o.id === editingObjectiveId);
  if (!obj) return;

  const t = obj.type; // 🔒 type verrouillé

  if (t === "repeatable") {
    const xp = parseInt(editObjXpInput?.value || "", 10);
    if (!Number.isFinite(xp) || xp <= 0) return uiAlert("XP invalide", "Modifier objectif");
    obj.xp = xp;
  }

  if (t === "unique") {
    const xp = parseInt(editObjXpUniqueInput?.value || "", 10);
    if (!Number.isFinite(xp) || xp <= 0) return uiAlert("XP invalide", "Modifier objectif");
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

  // Si on MODIFIE un palier existant
  if (editMilestoneEditIndex !== null) {
    // empêcher doublon de count avec un autre palier (hors celui modifié)
    const dup = editDraftMilestoneSteps.some((s, idx) => idx !== editMilestoneEditIndex && Number(s.count) === count);
    if (dup) return uiAlert("Un autre palier a déjà ce nombre.", "Modifier objectif");

    editDraftMilestoneSteps[editMilestoneEditIndex] = { count, xp, done: false };

    // reset mode édition
    editMilestoneEditIndex = null;
    if (editAddMilestoneStepBtn) editAddMilestoneStepBtn.innerText = "Ajouter palier";
  } else {
    // Sinon, AJOUT classique
    if (editDraftMilestoneSteps.some(s => Number(s.count) === count)) {
      return uiAlert("Ce palier existe déjà dans la liste.", "Modifier objectif");
    }
    editDraftMilestoneSteps.push({ count, xp, done:false });
  }

  // garder trié
  editDraftMilestoneSteps.sort((a,b) => Number(a.count) - Number(b.count));

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
  if (editDraftMilestoneSteps.length === 0) return uiAlert("Ajoute au moins un palier pour pouvoir créer l'objectif", "Modifier objectif");

  obj.type = "milestone";
  obj.prefix = prefix;
  obj.suffix = suffix;
  const doneSteps = (obj.steps || []).filter(s => s.done); // on garde les validés
  const newNonDone = editDraftMilestoneSteps.map(s => ({
    count: Number(s.count || 0),
    xp: Number(s.xp || 0),
    done: false,
    doneAt: null
  }));

  // sécurité : les nouveaux paliers doivent être > dernier palier validé
  const lastDoneCount = doneSteps.length ? Math.max(...doneSteps.map(s => Number(s.count || 0))) : 0;
  if (newNonDone.some(s => s.count <= lastDoneCount)) {
    return uiAlert(`Tes nouveaux paliers doivent être > ${lastDoneCount}.`, "Modifier objectif");
  }

  obj.steps = [...doneSteps, ...newNonDone].sort((a,b) => a.count - b.count);

  save();
  showPopup("📝 Objectif palier modifié");
  closeEditObjectiveModal();
  renderObjectives();
};

// ================== Settings ==================
function renderSettings() {
  if (monthGoalInput) monthGoalInput.value = getMonthGoal();
  const defS = defaultData().settings;
  if (weekGoalChillInput) weekGoalChillInput.value = state.settings.weekGoals?.chill ?? defS.weekGoals.chill;
  if (weekGoalFocusInput) weekGoalFocusInput.value = state.settings.weekGoals?.focus ?? defS.weekGoals.focus;
  if (weekGoalBossInput)  weekGoalBossInput.value = state.settings.weekGoals?.boss  ?? defS.weekGoals.boss;
  if (monthGoalInput)     monthGoalInput.value     = getMonthGoal();


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
    archiveBtn.innerText = "Archiver";
    archiveBtn.onclick = async () => {
      const ok = await uiConfirm(
        `Archiver ${w.name} ?\nSi oui, ${w.name} disparaîtra de l'écran d'accueil, sans impacter tes XP.`,
        "Archiver un monde"
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
  const b = parseInt(weekGoalChillInput?.value || "", 10);
  const n = parseInt(weekGoalFocusInput?.value || "", 10);
  const l = parseInt(weekGoalBossInput?.value || "", 10);

  if (![mg, b, n, l].every(v => Number.isFinite(v) && v > 0)) {
    return uiAlert("Valeurs invalides", "Paramètres");
  }

  state.settings.monthGoal = mg;
  state.settings.weekGoals = { chill: b, focus: n, boss: l };
  save();

  showPopup("✅ Objectifs enregistrés");
  renderHomeStats();
};

if (resetGameBtn) resetGameBtn.onclick = async () => {
  const user = (window.firebase && firebase.auth) ? firebase.auth().currentUser : null;
  if (!user) return uiAlert("Tu dois être connectée pour réinitialiser le jeu.", "Réinitialisation");

  const ok1 = await uiConfirm("Es-tu sûre de vouloir supprimer toutes tes données ?", "Réinitialisation");
  if (!ok1) return;

  const ok2 = await uiConfirm("Dernière confirmation: tout sera perdu. Continuer ?", "Réinitialisation");
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
      showPopup("✅ Connecté");
    } catch (e) {
      await uiAlert(e.message, "Connexion");
    }
  }

  async function logout() {
    try {
      await auth.signOut();
      showPopup("👋 Déconnecté");
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
    cloudHydrated = false;
    await pullCloudAndMerge();
    cloudHydrated = true;

    // Loading visible tant qu’on n’a pas décidé
    showScreen(loadingScreen);

    if (authStatus) authStatus.textContent = user ? `Connectée : ${user.email}` : "Il faut être connecté à un compte pour pouvoir utiliser l'app";
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
  if (!cloudHydrated) return; // ✅ pas de push tant que pas hydraté
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

  // si pas de cloud: on crée à partir du local (même fresh)
  if (!snap.exists) {
    // le user est nouveau => ok de pousser
    state.meta = state.meta || {};
    state.meta.freshInstall = false;
    state.meta.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    await pushCloudSave();
    showPopup("☁️ Sauvegarde cloud créée");
    return;
  }

  const cloud = snap.data() || {};
  const cloudState = cloud.state;
  const cloudUpdatedAt = Number(cloud.updatedAt || 0);

  const localUpdatedAt = Number(state?.meta?.updatedAt || 0);
  const isFresh = !!state?.meta?.freshInstall;

  // ✅ PROTECTION CRITIQUE : si cache vidé (= fresh) et cloud existe => on recharge cloud
  if (isFresh && cloudState) {
    state = cloudState;
    state.meta = state.meta || {};
    state.meta.freshInstall = false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    showPopup("☁️ Données récupérées (cloud)");
    return;
  }

  // comportement normal: la plus récente gagne
  if (cloudState && cloudUpdatedAt > localUpdatedAt) {
    state = cloudState;
    state.meta = state.meta || {};
    state.meta.freshInstall = false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    showPopup("☁️ Données récupérées");
  } else {
    // avant de pousser, on marque plus fresh
    state.meta = state.meta || {};
    state.meta.freshInstall = false;
    state.meta.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    await pushCloudSave();
    showPopup("☁️ Données synchronisées");
  }
}

