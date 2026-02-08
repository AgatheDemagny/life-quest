// ================== DATA ==================
let data = JSON.parse(localStorage.getItem("joueMaVie")) || {
  worlds: {}
};

function save() {
  localStorage.setItem("joueMaVie", JSON.stringify(data));
}

// ================== ELEMENTS ==================
const worldsListEl = document.getElementById("worldsList");
const openAddWorldBtn = document.getElementById("openAddWorldBtn");
const addWorldModal = document.getElementById("addWorldModal");

const worldNameInput = document.getElementById("worldNameInput");
const worldIconInput = document.getElementById("worldIconInput");
const minutesBaseInput = document.getElementById("minutesBaseInput");
const xpBaseInput = document.getElementById("xpBaseInput");

const createWorldBtn = document.getElementById("createWorldBtn");
const cancelWorldBtn = document.getElementById("cancelWorldBtn");

// ================== RENDER ==================
function renderWorlds() {
  worldsListEl.innerHTML = "";

  const worlds = Object.values(data.worlds);

  if (worlds.length === 0) {
    worldsListEl.innerHTML = "<p>Aucun monde créé pour l’instant.</p>";
    return;
  }

  worlds.forEach(world => {
    const btn = document.createElement("button");
    btn.className = "world-btn";
    btn.innerText = `${world.icon} ${world.name}`;
    worldsListEl.appendChild(btn);
  });
}

// ================== MODAL ==================
openAddWorldBtn.onclick = () => {
  addWorldModal.classList.remove("hidden");
};

cancelWorldBtn.onclick = () => {
  closeAddWorld();
};

function closeAddWorld() {
  addWorldModal.classList.add("hidden");
  worldNameInput.value = "";
  worldIconInput.value = "";
  minutesBaseInput.value = "";
  xpBaseInput.value = "";
}

// ================== CREATE WORLD ==================
createWorldBtn.onclick = () => {
  const name = worldNameInput.value.trim();
  const icon = worldIconInput.value.trim();
  const minutes = parseInt(minutesBaseInput.value);
  const xp = parseInt(xpBaseInput.value);

  if (!name) return alert("Nom du monde requis");
  if (!icon) return alert("Icône requise (emoji)");
  if (!minutes || !xp) return alert("Règle XP invalide");

  const id = "world-" + Date.now();

  data.worlds[id] = {
    id,
    name,
    icon,
    rules: {
      minutesBase: minutes,
      xpBase: xp
    },
    stats: {
      time: 0,
      xp: 0
    },
    active: true
  };

  save();
  closeAddWorld();
  renderWorlds();
};

// ================== INIT ==================
renderWorlds();

// ================== RESET APP ==================
const resetBtn = document.getElementById("resetAppBtn");

if (resetBtn) {
  resetBtn.onclick = () => {
    if (confirm("Tout effacer ? (mondes, XP, tout)")) {
      localStorage.removeItem("joueMaVie");

      // IMPORTANT pour la PWA
      if ("caches" in window) {
        caches.keys().then(keys => {
          keys.forEach(key => caches.delete(key));
        });
      }

      location.reload();
    }
  };
}

