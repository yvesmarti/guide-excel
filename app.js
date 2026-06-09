/* =========================================================
   Excel Companion FR — logique de l'application
   Aucune dépendance, aucun backend. Charge les données depuis
   formulas.json et shortcuts.json, puis affiche des cartes.
   ========================================================= */

/* ---------- État global ---------- */
const etat = {
  formules: [],
  raccourcis: [],
  ongletActif: "formules",      // "formules" | "raccourcis" | "favoris"
  categorieActive: "Toutes",
  recherche: "",
  favoris: chargerFavoris(),     // ensemble (Set) d'identifiants uniques
};

/* ---------- Sélecteurs ---------- */
const elGrille    = document.getElementById("grille");
const elFiltres   = document.getElementById("filtres");
const elVide      = document.getElementById("vide");
const elInfo      = document.getElementById("resultat-info");
const elRecherche = document.getElementById("champ-recherche");
const elCompteur  = document.getElementById("compteur-favoris");
const elToast     = document.getElementById("toast");

/* =========================================================
   Démarrage : on récupère les deux fichiers JSON
   ========================================================= */
async function demarrer() {
  try {
    const [formules, raccourcis] = await Promise.all([
      fetch("formulas.json").then((r) => r.json()),
      fetch("shortcuts.json").then((r) => r.json()),
    ]);
    etat.formules = formules;
    etat.raccourcis = raccourcis;
    initialiser();
  } catch (err) {
    elGrille.innerHTML =
      "<p class='vide'>Impossible de charger les données. " +
      "Si vous ouvrez le fichier directement, lancez plutôt un petit serveur " +
      "local (voir le README) ou publiez le site sur GitHub Pages.</p>";
    console.error(err);
  }
}

function initialiser() {
  majCompteurFavoris();
  brancherEvenements();
  afficher();
}

/* =========================================================
   Événements
   ========================================================= */
function brancherEvenements() {
  // Recherche en temps réel
  elRecherche.addEventListener("input", (e) => {
    etat.recherche = e.target.value.trim().toLowerCase();
    afficher();
  });

  // Changement d'onglet
  document.querySelectorAll(".onglet").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".onglet").forEach((b) => {
        b.classList.remove("actif");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("actif");
      btn.setAttribute("aria-selected", "true");
      etat.ongletActif = btn.dataset.onglet;
      etat.categorieActive = "Toutes"; // on réinitialise le filtre
      afficher();
    });
  });
}

/* =========================================================
   Affichage principal
   ========================================================= */
function afficher() {
  construireFiltres();

  let elements = elementsCourants();          // selon l'onglet
  elements = filtrerParCategorie(elements);   // selon la catégorie
  elements = filtrerParRecherche(elements);   // selon la recherche

  elGrille.innerHTML = "";

  if (elements.length === 0) {
    elVide.hidden = false;
    elInfo.textContent = "";
    return;
  }
  elVide.hidden = true;

  const motType = etat.ongletActif === "raccourcis" ? "raccourci" : "élément";
  elInfo.textContent =
    elements.length + " " + (etat.ongletActif === "raccourcis"
      ? (elements.length > 1 ? "raccourcis" : "raccourci")
      : (elements.length > 1 ? "formules" : "formule")) + " affiché" +
      (elements.length > 1 ? "s" : "");

  // Petit délai d'animation échelonné
  elements.forEach((item, i) => {
    const carte = item._type === "raccourci"
      ? carteRaccourci(item)
      : carteFormule(item);
    carte.style.animationDelay = Math.min(i * 18, 300) + "ms";
    elGrille.appendChild(carte);
  });
}

/* Renvoie la liste de base selon l'onglet sélectionné */
function elementsCourants() {
  const formulesT  = etat.formules.map((f) => ({ ...f, _type: "formule" }));
  const raccourcisT = etat.raccourcis.map((r) => ({ ...r, _type: "raccourci" }));

  if (etat.ongletActif === "formules")  return formulesT;
  if (etat.ongletActif === "raccourcis") return raccourcisT;

  // Onglet Favoris : on mélange les deux types
  return [...formulesT, ...raccourcisT].filter((it) => etat.favoris.has(idDe(it)));
}

/* =========================================================
   Filtres par catégorie
   ========================================================= */
function construireFiltres() {
  // Sur l'onglet Favoris, on n'affiche pas de filtre catégorie
  if (etat.ongletActif === "favoris") {
    elFiltres.innerHTML = "";
    return;
  }

  const source = etat.ongletActif === "raccourcis" ? etat.raccourcis : etat.formules;
  const categories = ["Toutes", ...new Set(source.map((x) => x.categorie))];

  elFiltres.innerHTML = "";
  categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "filtre" + (cat === etat.categorieActive ? " actif" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      etat.categorieActive = cat;
      afficher();
    });
    elFiltres.appendChild(btn);
  });
}

function filtrerParCategorie(elements) {
  if (etat.categorieActive === "Toutes" || etat.ongletActif === "favoris") return elements;
  return elements.filter((e) => e.categorie === etat.categorieActive);
}

function filtrerParRecherche(elements) {
  if (!etat.recherche) return elements;
  const q = etat.recherche;
  return elements.filter((e) => {
    if (e._type === "raccourci") {
      return (
        e.action.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.touches.join(" ").toLowerCase().includes(q) ||
        e.categorie.toLowerCase().includes(q)
      );
    }
    return (
      e.nom.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.syntaxe.toLowerCase().includes(q) ||
      e.categorie.toLowerCase().includes(q)
    );
  });
}

/* =========================================================
   Cartes
   ========================================================= */
function carteFormule(f) {
  const carte = document.createElement("article");
  carte.className = "carte";

  const id = idDe(f);
  const estFavori = etat.favoris.has(id);

  carte.innerHTML = `
    <div class="carte-haut">
      <span class="badge" style="background:${couleurCategorie(f.categorie)}">${echapper(f.categorie)}</span>
      ${boutonFavori(estFavori)}
    </div>
    <h2 class="nom-formule">${echapper(f.nom)}</h2>
    <div class="syntaxe">${surlignerPV(f.syntaxe)}</div>
    <p class="description">${echapper(f.description)}</p>
    <div class="exemple" title="Cliquer pour copier l'exemple">
      <code>${echapper(f.exemple)}</code>
      <button class="bouton-copier" aria-label="Copier l'exemple">
        <svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
      </button>
    </div>`;

  // Copier (clic sur la zone exemple ou sur le bouton)
  const zoneExemple = carte.querySelector(".exemple");
  zoneExemple.addEventListener("click", () => copier(f.exemple));

  // Favori
  carte.querySelector(".favori").addEventListener("click", (e) => {
    e.stopPropagation();
    basculerFavori(id, e.currentTarget);
  });

  return carte;
}

function carteRaccourci(r) {
  const carte = document.createElement("article");
  carte.className = "carte";

  const id = idDe(r);
  const estFavori = etat.favoris.has(id);

  const touchesHTML = r.touches
    .map((t) => `<span class="touche">${echapper(t)}</span>`)
    .join('<span class="plus">+</span>');

  carte.innerHTML = `
    <div class="carte-haut">
      <span class="badge" style="background:${couleurCategorie(r.categorie)}">${echapper(r.categorie)}</span>
      ${boutonFavori(estFavori)}
    </div>
    <h2 class="titre-raccourci">${echapper(r.action)}</h2>
    <div class="touches">${touchesHTML}</div>
    <p class="description">${echapper(r.description)}</p>`;

  carte.querySelector(".favori").addEventListener("click", (e) => {
    e.stopPropagation();
    basculerFavori(id, e.currentTarget);
  });

  return carte;
}

function boutonFavori(actif) {
  return `
    <button class="favori ${actif ? "actif" : ""}" aria-label="Ajouter aux favoris" title="Favori">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.6 1.4 6.8L12 17.8 5.9 21.3l1.4-6.8L2.2 9.9l6.9-.8L12 2z"/>
      </svg>
    </button>`;
}

/* =========================================================
   Favoris (localStorage)
   ========================================================= */
function idDe(item) {
  return item._type === "raccourci" ? "r:" + item.action : "f:" + item.nom;
}

function chargerFavoris() {
  try {
    const brut = localStorage.getItem("ecfr_favoris");
    return new Set(brut ? JSON.parse(brut) : []);
  } catch {
    return new Set();
  }
}

function sauvegarderFavoris() {
  try {
    localStorage.setItem("ecfr_favoris", JSON.stringify([...etat.favoris]));
  } catch {/* mode privé : on ignore */}
}

function basculerFavori(id, bouton) {
  if (etat.favoris.has(id)) {
    etat.favoris.delete(id);
    bouton.classList.remove("actif");
    toast("Retiré des favoris");
  } else {
    etat.favoris.add(id);
    bouton.classList.add("actif");
    toast("Ajouté aux favoris ★");
  }
  sauvegarderFavoris();
  majCompteurFavoris();

  // Sur l'onglet Favoris, on rafraîchit pour faire disparaître la carte retirée
  if (etat.ongletActif === "favoris") afficher();
}

function majCompteurFavoris() {
  elCompteur.textContent = etat.favoris.size;
}

/* =========================================================
   Copie dans le presse-papiers
   ========================================================= */
function copier(texte) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texte).then(
      () => toast("Copié : " + texte),
      () => copierSecours(texte)
    );
  } else {
    copierSecours(texte);
  }
}

function copierSecours(texte) {
  const tmp = document.createElement("textarea");
  tmp.value = texte;
  tmp.style.position = "fixed";
  tmp.style.opacity = "0";
  document.body.appendChild(tmp);
  tmp.select();
  try { document.execCommand("copy"); toast("Copié : " + texte); }
  catch { toast("Copie impossible"); }
  document.body.removeChild(tmp);
}

/* =========================================================
   Toast
   ========================================================= */
let minuteurToast;
function toast(message) {
  elToast.textContent = message;
  elToast.classList.add("visible");
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => elToast.classList.remove("visible"), 1800);
}

/* =========================================================
   Utilitaires
   ========================================================= */
function echapper(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Surligne les points-virgules dans la syntaxe (après échappement)
function surlignerPV(s) {
  return echapper(s).replace(/;/g, '<span class="pv">;</span>');
}

// Associe chaque catégorie à sa couleur (variables CSS)
function couleurCategorie(cat) {
  const cle = "--cat-" + cat
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // enlève les accents
    .replace(/[^a-z]/g, "");                            // enlève espaces, /, &, etc.
  const valeur = getComputedStyle(document.documentElement).getPropertyValue(cle);
  return valeur.trim() || "#64748B";
}

/* C'est parti */
demarrer();
