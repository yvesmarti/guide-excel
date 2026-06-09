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
const elEffacer   = document.getElementById("recherche-effacer");
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
  // Index des formules par nom (pour la navigation « Voir aussi »)
  etat.formulesParNom = {};
  etat.formules.forEach((f) => { etat.formulesParNom[f.nom] = f; });

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
    elEffacer.hidden = !e.target.value;
    afficher();
  });

  // Effacement du champ recherche
  elEffacer.addEventListener("click", () => {
    elRecherche.value = "";
    elRecherche.focus();
    etat.recherche = "";
    elEffacer.hidden = true;
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

  // Fermeture de la fiche détaillée
  document.getElementById("fiche-fermer").addEventListener("click", fermerFiche);
  elOverlay.addEventListener("click", (e) => {
    if (e.target === elOverlay) fermerFiche(); // clic sur le fond
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !elOverlay.hidden) fermerFiche();
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

function normaliser(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function bigrammes(s) {
  const r = new Set();
  for (let i = 0; i < s.length - 1; i++) r.add(s.slice(i, i + 2));
  return r;
}

function correspond(q, texte) {
  const nq = normaliser(q);
  const nt = normaliser(texte);
  // 1. Sous-chaîne directe (gère les accents)
  if (nt.includes(nq)) return true;
  // 2. Tous les mots de la requête apparaissent dans le texte (ordre libre)
  const motsQ = nq.split(/\s+/).filter(Boolean);
  if (motsQ.length > 1 && motsQ.every((m) => nt.includes(m))) return true;
  // 3. Fuzzy : pour les requêtes courtes, similarité de bigrammes
  if (nq.length >= 2 && nq.length <= 5) {
    const bgQ = bigrammes(nq);
    const bgT = bigrammes(nt);
    let intersection = 0;
    bgQ.forEach((b) => { if (bgT.has(b)) intersection++; });
    if (intersection / bgQ.size >= 0.6) return true;
  }
  return false;
}

function filtrerParRecherche(elements) {
  if (!etat.recherche) return elements;
  const q = etat.recherche;
  return elements.filter((e) => {
    if (e._type === "raccourci") {
      return (
        correspond(q, e.action) ||
        correspond(q, e.description) ||
        correspond(q, e.touches.join(" ")) ||
        correspond(q, e.categorie)
      );
    }
    return (
      correspond(q, e.nom) ||
      correspond(q, e.description) ||
      correspond(q, e.syntaxe) ||
      correspond(q, e.categorie)
    );
  });
}

/* =========================================================
   Cartes
   ========================================================= */
function carteFormule(f) {
  const carte = document.createElement("article");
  carte.className = "carte carte-cliquable";
  carte.setAttribute("role", "button");
  carte.setAttribute("tabindex", "0");
  carte.setAttribute("aria-label", "Ouvrir la fiche " + f.nom);

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
    </div>
    <span class="voir-fiche">Voir la fiche détaillée →</span>`;

  // Copier l'exemple (sans ouvrir la fiche)
  carte.querySelector(".exemple").addEventListener("click", (e) => {
    e.stopPropagation();
    copier(f.exemple);
  });

  // Favori (sans ouvrir la fiche)
  carte.querySelector(".favori").addEventListener("click", (e) => {
    e.stopPropagation();
    basculerFavori(id, e.currentTarget);
  });

  // Ouvrir la fiche : clic ou touche Entrée / Espace
  carte.addEventListener("click", () => ouvrirFiche(f));
  carte.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrirFiche(f); }
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
   Fiche détaillée (fenêtre modale)
   Affiche toutes les sections disponibles. Les champs absents
   (formules encore en version simple) ne sont pas affichés.
   ========================================================= */
const elOverlay = document.getElementById("fiche-overlay");
const elFiche   = document.getElementById("fiche-contenu");

function ouvrirFiche(f) {
  elFiche.innerHTML = contenuFiche(f);
  elOverlay.hidden = false;
  document.body.classList.add("sans-defilement");
  brancherActionsFiche(f);
  // Mettre le focus sur le bouton fermer, et remonter en haut
  elOverlay.querySelector(".fiche").scrollTop = 0;
  document.getElementById("fiche-fermer").focus();
}

function fermerFiche() {
  elOverlay.hidden = true;
  document.body.classList.remove("sans-defilement");
}

function contenuFiche(f) {
  const id = idDe(f);
  const estFavori = etat.favoris.has(id);

  // Badge niveau (facultatif)
  const niveau = f.niveau
    ? `<span class="badge-niveau niveau-${accentLess(f.niveau)}">${echapper(f.niveau)}</span>`
    : "";

  // Arguments (facultatif)
  let argsHTML = "";
  if (Array.isArray(f.arguments) && f.arguments.length) {
    argsHTML = section("Arguments",
      `<div class="liste-args">` + f.arguments.map((a) => `
        <div class="arg">
          <span class="arg-nom">${echapper(a.nom)}</span>
          <span class="arg-desc">${echapper(a.description)}</span>
        </div>`).join("") + `</div>`);
  }

  // Exemples : simple + métier (facultatif)
  let exemplesHTML = `
    <div class="exemple-bloc">
      <p class="exemple-label">Exemple simple</p>
      <div class="exemple-copiable" data-copier="${echapper(f.exemple)}">
        <code>${echapper(f.exemple)}</code>${iconeCopier()}
      </div>
    </div>`;
  if (f.exempleMetier) {
    const m = f.exempleMetier;
    exemplesHTML += `
      <div class="exemple-bloc exemple-metier">
        <p class="exemple-label vert">Exemple métier</p>
        ${m.contexte ? `<p class="exemple-contexte">${echapper(m.contexte)}</p>` : ""}
        ${m.formule ? `<div class="exemple-copiable" data-copier="${echapper(m.formule)}"><code>${echapper(m.formule)}</code>${iconeCopier()}</div>` : ""}
        ${m.resultat ? `<p class="exemple-resultat">${iconeInfo()} ${echapper(m.resultat)}</p>` : ""}
      </div>`;
  }

  // Guide pas à pas (facultatif)
  let etapesHTML = "";
  if (Array.isArray(f.etapes) && f.etapes.length) {
    etapesHTML = section("Guide d'application pas à pas",
      `<ol class="etapes">` + f.etapes.map((e) => `<li>${echapper(e)}</li>`).join("") + `</ol>`);
  }

  // Erreurs fréquentes (facultatif)
  let erreursHTML = "";
  if (Array.isArray(f.erreurs) && f.erreurs.length) {
    erreursHTML = section("Erreurs fréquentes",
      `<div class="liste-erreurs">` + f.erreurs.map((er) => `
        <div class="erreur">
          <p class="erreur-pb">${iconeAlerte()} ${echapper(er.probleme)}</p>
          <p class="erreur-sol">${echapper(er.solution)}</p>
        </div>`).join("") + `</div>`);
  }

  // Astuce (facultatif)
  const astuceHTML = f.astuce
    ? `<div class="astuce">${iconeAmpoule()}<p>${echapper(f.astuce)}</p></div>`
    : "";

  // Voir aussi (facultatif) — cliquable si la formule existe
  let voirHTML = "";
  if (Array.isArray(f.voirAussi) && f.voirAussi.length) {
    voirHTML = section("Voir aussi",
      `<div class="voir-aussi">` + f.voirAussi.map((nom) => {
        const existe = !!etat.formulesParNom[nom];
        return existe
          ? `<button class="puce-lien" data-aller="${echapper(nom)}">${echapper(nom)}</button>`
          : `<span class="puce-inerte">${echapper(nom)}</span>`;
      }).join("") + `</div>`);
  }

  return `
    <div class="fiche-entete">
      <div class="fiche-badges">
        <span class="badge" style="background:${couleurCategorie(f.categorie)}">${echapper(f.categorie)}</span>
        ${niveau}
      </div>
      <button class="favori fiche-favori ${estFavori ? "actif" : ""}" aria-label="Favori" title="Favori">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.6 1.4 6.8L12 17.8 5.9 21.3l1.4-6.8L2.2 9.9l6.9-.8L12 2z"/>
        </svg>
      </button>
    </div>

    <h2 class="fiche-nom" id="fiche-titre">${echapper(f.nom)}</h2>
    <p class="fiche-description">${echapper(f.description)}</p>

    ${section("Syntaxe", `<div class="syntaxe">${surlignerPV(f.syntaxe)}</div>`)}
    ${argsHTML}
    ${section("Exemples", exemplesHTML)}
    ${etapesHTML}
    ${erreursHTML}
    ${astuceHTML}
    ${voirHTML}`;
}

function section(titre, contenu) {
  return `<section class="fiche-section">
    <h3 class="fiche-section-titre">${echapper(titre)}</h3>
    ${contenu}
  </section>`;
}

// Branche les boutons internes de la fiche (copie, favori, voir aussi)
function brancherActionsFiche(f) {
  // Copie des exemples
  elFiche.querySelectorAll(".exemple-copiable").forEach((bloc) => {
    bloc.addEventListener("click", () => copier(bloc.dataset.copier));
  });
  // Favori
  const favBtn = elFiche.querySelector(".fiche-favori");
  if (favBtn) {
    favBtn.addEventListener("click", () => {
      basculerFavori(idDe(f), favBtn);
      afficher(); // resynchronise les étoiles de la grille
    });
  }
  // Voir aussi → ouvrir une autre fiche
  elFiche.querySelectorAll(".puce-lien").forEach((b) => {
    b.addEventListener("click", () => {
      const cible = etat.formulesParNom[b.dataset.aller];
      if (cible) ouvrirFiche(cible);
    });
  });
}

/* Petites icônes SVG */
function iconeCopier() {
  return `<button class="bouton-copier" aria-label="Copier"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button>`;
}
function iconeInfo() {
  return `<svg class="ico-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>`;
}
function iconeAlerte() {
  return `<svg class="ico-alerte" viewBox="0 0 24 24"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>`;
}
function iconeAmpoule() {
  return `<svg class="ico-ampoule" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>`;
}

// "Débutant" -> "debutant" (pour la classe CSS du niveau)
function accentLess(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
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
      () => toast("Copié\u00A0!"),
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
  try { document.execCommand("copy"); toast("Copié\u00A0!"); }
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
