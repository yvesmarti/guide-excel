/* =========================================================
   Thème clair / sombre
   ========================================================= */
function chargerTheme() {
  try {
    const sauvegarde = localStorage.getItem("ecfr_theme");
    if (sauvegarde === "sombre" || sauvegarde === "clair") return sauvegarde;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "sombre" : "clair";
  } catch {
    return "clair";
  }
}

function appliquerTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "sombre" ? "sombre" : "");
  try { localStorage.setItem("ecfr_theme", theme); } catch { /* ignore */ }
}

function basculerTheme() {
  const actuel = document.documentElement.getAttribute("data-theme");
  appliquerTheme(actuel === "sombre" ? "clair" : "sombre");
}

appliquerTheme(chargerTheme());

/* =========================================================
   État global
   ========================================================= */
const etat = {
  formules: [],
  raccourcis: [],
  astuces: [],
  section: null,
  mode: "tous",
  type: null,
  categorie: null,
  recherche: "",
  favoris: chargerFavoris(),
  recents: chargerRecents(),
  formulesParNom: {},
  astucesParId: {},
};

const elGrille    = document.getElementById("grille");
const elVide      = document.getElementById("vide");
const elInfo      = document.getElementById("resultat-info");
const elRecherche = document.getElementById("champ-recherche");
const elEffacer   = document.getElementById("recherche-effacer");
const elCompteur  = document.getElementById("compteur-favoris");
const elToast     = document.getElementById("toast");
const elSidebar   = document.getElementById("sidebar");
const elOverlay   = document.getElementById("sidebar-overlay");
const elHamburger = document.getElementById("hamburger");
const elFermer    = document.getElementById("sidebar-fermer");
const elTitre     = document.getElementById("titre-section");
const elIntro     = document.getElementById("section-intro");

async function demarrer() {
  try {
    const [formules, raccourcis, astucesData] = await Promise.all([
      fetch("formulas.json").then((r) => r.json()),
      fetch("shortcuts.json").then((r) => r.json()),
      fetch("astuces-donnees.json").then((r) => r.json()),
    ]);
    etat.formules = formules;
    etat.raccourcis = raccourcis;
    etat.astuces = (astucesData && astucesData.astuces) || [];
    etat.section = (astucesData && astucesData.section) || null;
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
  etat.formulesParNom = {};
  etat.formules.forEach((f) => { etat.formulesParNom[f.nom] = f; });
  etat.astucesParId = {};
  etat.astuces.forEach((a) => { etat.astucesParId[a.id] = { ...a, _type: "astuce" }; });
  majCompteurFavoris();
  brancherEvenements();
  afficher();
  lireUrlDeepLink();
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function brancherEvenements() {
  const afficherDebounce = debounce(() => afficher(), 150);
  elRecherche.addEventListener("input", (e) => {
    etat.recherche = e.target.value.trim().toLowerCase();
    elEffacer.hidden = !e.target.value;
    afficherDebounce();
  });

  elEffacer.addEventListener("click", () => {
    elRecherche.value = "";
    elRecherche.focus();
    etat.recherche = "";
    elEffacer.hidden = true;
    afficher();
  });

  document.querySelectorAll(".sidebar-lien").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sidebar-lien").forEach((b) => b.classList.remove("actif"));
      btn.classList.add("actif");

      const mode = btn.dataset.mode;
      if (mode) {
        etat.mode = mode;
        etat.type = null;
        etat.categorie = null;
      } else {
        etat.mode = "categorie";
        etat.type = btn.dataset.type;
        etat.categorie = btn.dataset.categorie;
      }
      etat.recherche = "";
      elRecherche.value = "";
      elEffacer.hidden = true;
      fermerSidebarMobile();
      afficher();
    });
  });

  document.getElementById("fiche-fermer").addEventListener("click", fermerFiche);
  const ficheOverlay = document.getElementById("fiche-overlay");
  ficheOverlay.addEventListener("click", (e) => {
    if (e.target === ficheOverlay) fermerFiche();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const ficheOverlay = document.getElementById("fiche-overlay");
      if (!ficheOverlay.hidden) { fermerFiche(); return; }
      if (!elOverlay.hidden) { fermerSidebarMobile(); }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      elRecherche.focus();
    }
  });

  elHamburger.addEventListener("click", () => {
    const ouverte = elSidebar.classList.toggle("ouverte");
    elHamburger.setAttribute("aria-expanded", ouverte);
    elOverlay.hidden = !ouverte;
  });

  elFermer.addEventListener("click", fermerSidebarMobile);
  elOverlay.addEventListener("click", fermerSidebarMobile);

  document.querySelectorAll(".theme-toggle").forEach((btn) => {
    btn.addEventListener("click", basculerTheme);
  });
}

function fermerSidebarMobile() {
  elSidebar.classList.remove("ouverte");
  elHamburger.setAttribute("aria-expanded", "false");
  elOverlay.hidden = true;
}

function afficher() {
  let elements = elementsCourants();
  elements = filtrerParRecherche(elements);

  majTitre();
  majIntro();
  elGrille.innerHTML = "";

  if (elements.length === 0) {
    elVide.hidden = false;
    elInfo.textContent = "";
    return;
  }
  elVide.hidden = true;

  const stats = compterTypes(elements);
  if (etat.recherche) {
    const n = elements.length;
    elInfo.textContent = n + " résultat" + (n > 1 ? "s" : "") + " pour « " + etat.recherche + " »";
  } else {
    const parties = [];
    if (stats.formules > 0) parties.push(stats.formules + " " + (stats.formules > 1 ? "formules" : "formule"));
    if (stats.raccourcis > 0) parties.push(stats.raccourcis + " " + (stats.raccourcis > 1 ? "raccourcis" : "raccourci"));
    if (stats.astuces > 0) parties.push(stats.astuces + " " + (stats.astuces > 1 ? "astuces" : "astuce"));
    elInfo.textContent = joindreEt(parties) + " affiché" + (elements.length > 1 ? "s" : "");
  }

  const groupes = [
    { label: "Formules & fonctions",       items: elements.filter((e) => typeElement(e) === "formule") },
    { label: "Raccourcis clavier",         items: elements.filter((e) => typeElement(e) === "raccourci") },
    { label: "Trucs & astuces données",    items: elements.filter((e) => typeElement(e) === "astuce") },
  ].filter((g) => g.items.length);

  const avecSeparateurs = groupes.length > 1;

  let delai = 0;
  function rendreGroupe(groupe) {
    groupe.forEach((item) => {
      const t = typeElement(item);
      const carte = t === "raccourci" ? carteRaccourci(item)
                  : t === "astuce"    ? carteAstuce(item)
                  : carteFormule(item);
      carte.style.animationDelay = Math.min(delai * 18, 300) + "ms";
      delai++;
      elGrille.appendChild(carte);
    });
  }

  if (avecSeparateurs) {
    groupes.forEach((g) => {
      elGrille.appendChild(creerSeparateur(g.label, g.items.length));
      rendreGroupe(g.items);
    });
  } else {
    rendreGroupe(elements);
  }
}

function joindreEt(parties) {
  if (parties.length <= 1) return parties.join("");
  return parties.slice(0, -1).join(", ") + " et " + parties[parties.length - 1];
}

function majIntro() {
  const montrer = etat.mode === "categorie" && etat.type === "astuces" && etat.section;
  if (montrer) {
    document.getElementById("section-intro-titre").textContent = etat.section.titre;
    document.getElementById("section-intro-texte").textContent = etat.section.intro;
    elIntro.hidden = false;
  } else {
    elIntro.hidden = true;
  }
}

function creerSeparateur(label, count) {
  const div = document.createElement("div");
  div.className = "grille-separateur";
  div.innerHTML = `${echapper(label)} <span class="grille-separateur-compte">${count}</span>`;
  return div;
}

function typeElement(item) {
  return item._type || (item.touches ? "raccourci" : "formule");
}

function compterTypes(elements) {
  let formules = 0, raccourcis = 0, astuces = 0;
  elements.forEach((e) => {
    const t = typeElement(e);
    if (t === "raccourci") raccourcis++;
    else if (t === "astuce") astuces++;
    else formules++;
  });
  return { formules, raccourcis, astuces };
}

function majTitre() {
  const noms = {
    tous: "Toutes les fiches",
    favoris: "Mes favoris",
    recents: "Historique récent",
  };
  if (etat.mode === "categorie") {
    if (etat.type === "astuces") {
      elTitre.textContent = etat.categorie || "Trucs & astuces données";
    } else {
      const prefixe = etat.type === "formules" ? "Formules" : "Raccourcis";
      elTitre.textContent = prefixe + " — " + etat.categorie;
    }
  } else {
    elTitre.textContent = noms[etat.mode] || "Toutes les fiches";
  }
}

function elementsCourants() {
  const formulesT  = etat.formules.map((f) => ({ ...f, _type: "formule" }));
  const raccourcisT = etat.raccourcis.map((r) => ({ ...r, _type: "raccourci" }));
  const astucesT = etat.astuces.map((a) => ({ ...a, _type: "astuce" }));

  if (etat.mode === "tous") return [...formulesT, ...raccourcisT, ...astucesT];
  if (etat.mode === "favoris") {
    return [...formulesT, ...raccourcisT, ...astucesT].filter((it) => etat.favoris.has(idDe(it)));
  }

  if (etat.mode === "recents") {
    const map = {};
    formulesT.forEach((f) => { map[idDe(f)] = f; });
    raccourcisT.forEach((r) => { map[idDe(r)] = r; });
    astucesT.forEach((a) => { map[idDe(a)] = a; });
    return etat.recents.map((id) => map[id]).filter(Boolean);
  }

  if (etat.type === "astuces") {
    return etat.categorie ? astucesT.filter((e) => e.categorie === etat.categorie) : astucesT;
  }

  const source = etat.type === "raccourcis" ? raccourcisT : formulesT;
  return source.filter((e) => e.categorie === etat.categorie);
}

function filtrerParRecherche(elements) {
  if (!etat.recherche) return elements;
  const q = etat.recherche;
  return elements.filter((e) => {
    if (typeElement(e) === "raccourci") {
      return (
        correspond(q, e.action) ||
        correspond(q, e.description) ||
        correspond(q, e.touches.join(" ")) ||
        correspond(q, e.categorie)
      );
    }
    if (typeElement(e) === "astuce") {
      return (
        correspond(q, e.titre) ||
        correspond(q, e.accroche) ||
        correspond(q, e.probleme) ||
        correspond(q, e.categorie) ||
        correspond(q, e.astuce) ||
        correspond(q, (e.etapes || []).join(" "))
      );
    }
    return (
      correspond(q, e.nom) ||
      correspond(q, e.description) ||
      correspond(q, e.syntaxe) ||
      correspond(q, e.categorie) ||
      correspond(q, (e.mots_cles || []).join(" "))
    );
  });
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
  if (nt.includes(nq)) return true;
  const motsQ = nq.split(/\s+/).filter(Boolean);
  if (motsQ.length > 1 && motsQ.every((m) => nt.includes(m))) return true;
  if (nq.length >= 2 && nq.length <= 5) {
    const bgQ = bigrammes(nq);
    const bgT = bigrammes(nt);
    let intersection = 0;
    bgQ.forEach((b) => { if (bgT.has(b)) intersection++; });
    if (intersection / bgQ.size >= 0.6) return true;
  }
  return false;
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

  carte.querySelector(".exemple").addEventListener("click", (e) => {
    e.stopPropagation();
    copier(f.exemple);
  });

  carte.querySelector(".favori").addEventListener("click", (e) => {
    e.stopPropagation();
    basculerFavori(id, e.currentTarget);
  });

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

function carteAstuce(a) {
  const carte = document.createElement("article");
  carte.className = "carte carte-cliquable carte-astuce";
  carte.setAttribute("role", "button");
  carte.setAttribute("tabindex", "0");
  carte.setAttribute("aria-label", "Ouvrir l'astuce : " + a.titre);

  const id = idDe(a);
  const estFavori = etat.favoris.has(id);
  const niveau = a.niveau
    ? `<span class="badge-niveau niveau-${accentLess(a.niveau)}">${echapper(a.niveau)}</span>`
    : "";

  carte.innerHTML = `
    <div class="carte-haut">
      <span class="badge" style="background:${couleurCategorie(a.categorie)}">${echapper(a.categorie)}</span>
      ${boutonFavori(estFavori)}
    </div>
    <h2 class="titre-astuce">${echapper(a.titre)}</h2>
    <p class="accroche">${echapper(a.accroche)}</p>
    <div class="carte-pied">
      ${niveau}
      <span class="voir-fiche">Voir la fiche détaillée →</span>
    </div>`;

  carte.querySelector(".favori").addEventListener("click", (e) => {
    e.stopPropagation();
    basculerFavori(id, e.currentTarget);
  });

  carte.addEventListener("click", () => ouvrirFiche(a));
  carte.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrirFiche(a); }
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
   Fiche détaillée (modale)
   ========================================================= */
const elFiche   = document.getElementById("fiche-contenu");
let dernierFocusAvantModale = null;

function ouvrirFiche(f) {
  dernierFocusAvantModale = document.activeElement;
  const estAstuce = f._type === "astuce";
  elFiche.innerHTML = estAstuce ? contenuAstuce(f) : contenuFiche(f);
  const overlay = document.getElementById("fiche-overlay");
  overlay.hidden = false;
  document.body.classList.add("sans-defilement");
  if (estAstuce) brancherActionsAstuce(f);
  else brancherActionsFiche(f);
  overlay.querySelector(".fiche").scrollTop = 0;
  document.getElementById("fiche-fermer").focus();
  ajouterRecent(f);
  if (estAstuce) {
    history.pushState(null, "", "?a=" + encodeURIComponent(f.id));
  } else if (f._type !== "raccourci") {
    history.pushState(null, "", "?f=" + encodeURIComponent(f.nom));
  }
}

function fermerFiche() {
  document.getElementById("fiche-overlay").hidden = true;
  document.body.classList.remove("sans-defilement");
  history.pushState(null, "", location.pathname);
  if (dernierFocusAvantModale) {
    dernierFocusAvantModale.focus();
    dernierFocusAvantModale = null;
  }
}

function contenuFiche(f) {
  const id = idDe(f);
  const estFavori = etat.favoris.has(id);

  const niveau = f.niveau
    ? `<span class="badge-niveau niveau-${accentLess(f.niveau)}">${echapper(f.niveau)}</span>`
    : "";

  let argsHTML = "";
  if (Array.isArray(f.arguments) && f.arguments.length) {
    argsHTML = section("Arguments",
      `<div class="liste-args">` + f.arguments.map((a) => `
        <div class="arg">
          <span class="arg-nom">${echapper(a.nom)}</span>
          <span class="arg-desc">${echapper(a.description)}</span>
        </div>`).join("") + `</div>`);
  }

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

  let etapesHTML = "";
  if (Array.isArray(f.etapes) && f.etapes.length) {
    etapesHTML = section("Guide d'application pas à pas",
      `<ol class="etapes">` + f.etapes.map((e) => `<li>${echapper(e)}</li>`).join("") + `</ol>`);
  }

  let erreursHTML = "";
  if (Array.isArray(f.erreurs) && f.erreurs.length) {
    erreursHTML = section("Erreurs fréquentes",
      `<div class="liste-erreurs">` + f.erreurs.map((er) => `
        <div class="erreur">
          <p class="erreur-pb">${iconeAlerte()} ${echapper(er.probleme)}</p>
          <p class="erreur-sol">${echapper(er.solution)}</p>
        </div>`).join("") + `</div>`);
  }

  const astuceHTML = f.astuce
    ? `<div class="astuce">${iconeAmpoule()}<p>${echapper(f.astuce)}</p></div>`
    : "";

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

function brancherActionsFiche(f) {
  elFiche.querySelectorAll(".exemple-copiable").forEach((bloc) => {
    bloc.addEventListener("click", () => copier(bloc.dataset.copier));
  });
  const favBtn = elFiche.querySelector(".fiche-favori");
  if (favBtn) {
    favBtn.addEventListener("click", () => {
      basculerFavori(idDe(f), favBtn);
      afficher();
    });
  }
  elFiche.querySelectorAll(".puce-lien").forEach((b) => {
    b.addEventListener("click", () => {
      const cible = etat.formulesParNom[b.dataset.aller];
      if (cible) ouvrirFiche(cible);
    });
  });
}

function contenuAstuce(a) {
  const id = idDe(a);
  const estFavori = etat.favoris.has(id);

  const niveau = a.niveau
    ? `<span class="badge-niveau niveau-${accentLess(a.niveau)}">${echapper(a.niveau)}</span>`
    : "";

  const problemeHTML = a.probleme
    ? section("Le problème", `<div class="probleme-bloc">${echapper(a.probleme)}</div>`)
    : "";

  let etapesHTML = "";
  if (Array.isArray(a.etapes) && a.etapes.length) {
    etapesHTML = section("Comment faire, pas à pas",
      `<ol class="etapes">` + a.etapes.map((e) => `<li>${echapper(e)}</li>`).join("") + `</ol>`);
  }

  let erreursHTML = "";
  if (Array.isArray(a.erreurs) && a.erreurs.length) {
    erreursHTML = section("Pièges fréquents",
      `<div class="liste-erreurs">` + a.erreurs.map((er) => `
        <div class="erreur">
          <p class="erreur-pb">${iconeAlerte()} ${echapper(er)}</p>
        </div>`).join("") + `</div>`);
  }

  const astuceHTML = a.astuce
    ? `<div class="astuce">${iconeAmpoule()}<p>${echapper(a.astuce)}</p></div>`
    : "";

  let voirHTML = "";
  if (Array.isArray(a.voirAussi) && a.voirAussi.length) {
    voirHTML = section("Voir aussi",
      `<div class="voir-aussi">` + a.voirAussi.map((ref) => {
        const astuceCible = etat.astucesParId[ref];
        if (astuceCible) {
          return `<button class="puce-lien" data-astuce="${echapper(ref)}">${echapper(astuceCible.titre)}</button>`;
        }
        if (etat.formulesParNom[ref]) {
          return `<button class="puce-lien" data-aller="${echapper(ref)}">${echapper(ref)}</button>`;
        }
        return `<span class="puce-inerte">${echapper(ref)}</span>`;
      }).join("") + `</div>`);
  }

  return `
    <div class="fiche-entete">
      <div class="fiche-badges">
        <span class="badge" style="background:${couleurCategorie(a.categorie)}">${echapper(a.categorie)}</span>
        ${niveau}
      </div>
      <button class="favori fiche-favori ${estFavori ? "actif" : ""}" aria-label="Favori" title="Favori">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.6 1.4 6.8L12 17.8 5.9 21.3l1.4-6.8L2.2 9.9l6.9-.8L12 2z"/>
        </svg>
      </button>
    </div>

    <h2 class="fiche-nom fiche-nom-astuce" id="fiche-titre">${echapper(a.titre)}</h2>
    <p class="fiche-accroche">${echapper(a.accroche)}</p>

    ${problemeHTML}
    ${etapesHTML}
    ${erreursHTML}
    ${astuceHTML}
    ${voirHTML}`;
}

function brancherActionsAstuce(a) {
  const favBtn = elFiche.querySelector(".fiche-favori");
  if (favBtn) {
    favBtn.addEventListener("click", () => {
      basculerFavori(idDe(a), favBtn);
      afficher();
    });
  }
  elFiche.querySelectorAll(".puce-lien[data-astuce]").forEach((b) => {
    b.addEventListener("click", () => {
      const cible = etat.astucesParId[b.dataset.astuce];
      if (cible) ouvrirFiche(cible);
    });
  });
  elFiche.querySelectorAll(".puce-lien[data-aller]").forEach((b) => {
    b.addEventListener("click", () => {
      const cible = etat.formulesParNom[b.dataset.aller];
      if (cible) ouvrirFiche({ ...cible, _type: "formule" });
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

function accentLess(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
}

/* =========================================================
   Favoris (localStorage)
   ========================================================= */
function idDe(item) {
  if (item._type === "raccourci") return "r:" + item.action;
  if (item._type === "astuce") return "a:" + item.id;
  return "f:" + item.nom;
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
  } catch { /* mode privé : on ignore */ }
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
  if (etat.mode === "favoris") afficher();
}

function majCompteurFavoris() {
  elCompteur.textContent = etat.favoris.size;
}

/* =========================================================
   Récents (localStorage)
   ========================================================= */
const MAX_RECENTS = 15;

function chargerRecents() {
  try {
    const brut = localStorage.getItem("ecfr_recents");
    return brut ? JSON.parse(brut) : [];
  } catch {
    return [];
  }
}

function sauvegarderRecents() {
  try {
    localStorage.setItem("ecfr_recents", JSON.stringify(etat.recents));
  } catch { /* ignore */ }
}

function ajouterRecent(item) {
  const id = idDe(item);
  etat.recents = etat.recents.filter((r) => r !== id);
  etat.recents.unshift(id);
  if (etat.recents.length > MAX_RECENTS) etat.recents = etat.recents.slice(0, MAX_RECENTS);
  sauvegarderRecents();
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

function surlignerPV(s) {
  return echapper(s).replace(/;/g, '<span class="pv">;</span>');
}

function couleurCategorie(cat) {
  const cle = "--cat-" + cat
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
  const valeur = getComputedStyle(document.documentElement).getPropertyValue(cle);
  return valeur.trim() || "#64748B";
}

/* =========================================================
   Deep linking  (?f=SOMME)
   ========================================================= */
function lireUrlDeepLink() {
  const params = new URLSearchParams(location.search);
  const nomFormule = params.get("f");
  if (nomFormule) {
    const formule = etat.formules.find((f) => f.nom === nomFormule);
    if (formule) { ouvrirFiche({ ...formule, _type: "formule" }); return; }
  }
  const idAstuce = params.get("a");
  if (idAstuce) {
    const astuce = etat.astucesParId[idAstuce];
    if (astuce) ouvrirFiche(astuce);
  }
}

demarrer();
