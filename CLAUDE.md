# Excel Companion FR — Référence du projet

## Identité

- **Nom** : Excel Companion FR
- **Sous-titre** : "by KYM"
- **Type** : SPA statique, zéro dépendance, vanilla JS/HTML/CSS
- **Langue UI** : Français
- **Déploiement** : Fichiers statiques (GitHub Pages ou équivalent)

---

## Stack technique

| Fichier | Rôle | Taille |
|---|---|---|
| `index.html` | Structure HTML unique (~83 lignes) | — |
| `app.js` | Toute la logique applicative (~557 lignes) | — |
| `styles.css` | Styles complets avec CSS variables (~451 lignes) | — |
| `formulas.json` | Base de données des formules Excel | 79 entrées |
| `shortcuts.json` | Base de données des raccourcis clavier | 44 entrées |

- Pas de build, pas de `package.json`, pas de framework
- Chargement des données via `Promise.all()` + `fetch()`
- Persistance utilisateur via `localStorage` (clé `ecfr_favoris`)

---

## Design system

### Typographie

- **Bricolage Grotesque** — Titres / Display (700, 800)
- **Public Sans** — Corps de texte (400, 500, 600, 700)
- **JetBrains Mono** — Blocs de code (400, 500, 700)
- `font-smoothing: antialiased` activé globalement

### Palette principale

```css
--vert:        #107C41   /* Excel green — couleur de marque */
--vert-fonce:  #0B5C30   /* Vert foncé (hover, accents) */
--vert-clair:  #E6F4EC   /* Fond léger vert */
--fond:        #FAFAFA   /* Background page (+ radial gradient subtil) */
--carte:       #FFFFFF   /* Fond des cartes */
--texte:       #1F2933   /* Texte principal */
--texte-doux:  #5B6770   /* Texte secondaire / désactivé */
--bordure:     #E5E7EB   /* Bordures, séparateurs */
--code-fond:   #1E2530   /* Fond des blocs de code (dark) */
--code-texte:  #E7EDF3   /* Texte dans les blocs de code */
--rayon:       14px      /* Border-radius standard */
```

### Couleurs sémantiques

- Erreur/Alerte : `#BE123C`
- Succès/Info : Excel green `#107C41`
- Astuce/Avertissement : `#D97706` (ambre)
- Favori : `#F5A623` (étoile dorée)

### Couleurs de catégories (badges)

Chaque catégorie a sa propre variable CSS `--cat-{slug}` :

| Catégorie | Couleur |
|---|---|
| Mathématiques | `#2563EB` (bleu) |
| Logiques | `#7C3AED` (violet) |
| Recherche | `#EA580C` (orange) |
| Texte | `#DB2777` (rose) |
| Date/Heure | `#0891B2` (cyan) |
| Financières | `#16A34A` (vert) |
| Statistiques | `#4F46E5` (indigo) |
| Information | `#64748B` (ardoise) |

### Composants visuels

- **Cartes** : fond blanc, `border-radius: 14px`, ombres à deux couches (subtile + hover), transition `0.12–0.35s`
- **Badges de catégorie** : pills arrondis (`border-radius: 999px`)
- **Blocs de code/syntaxe** : fond dark `#1E2530`, texte clair, séparateurs `;` en vert
- **Touches de clavier** : boutons style keycap avec séparateurs `+`
- **Modale** : overlay `rgba` avec blur, contenu max-width 720px
- **Toast** : notification bas-centre, auto-hide après 1.8s

### Animations

```css
@keyframes apparition  /* translateY(8px) → 0 + opacity */
@keyframes fondu       /* opacity 0 → 1 */
@keyframes monte       /* translateY(14px) → 0 + opacity */
```

Entrée des cartes en cascade avec délais de 18ms.

### Layout

- **Header sticky** : logo gauche + barre de recherche droite
- **Grille cartes** : `repeat(auto-fill, minmax(290px, 1fr))`
- **Breakpoint mobile** : `640px` — grille en colonne unique, header réorganisé

---

## Fonctionnalités

### Navigation / Filtrage

- **3 onglets principaux** : Formules / Raccourcis / Favoris
- **Filtres de catégorie** : générés dynamiquement selon l'onglet actif
- **Recherche temps réel** : interroge nom, syntaxe/actions, description, catégorie (case-insensitive)
- Réinitialisation du filtre à "Toutes" au changement d'onglet

### Fiches détaillées (modale)

Sections affichées conditionnellement :
1. Header (badges niveau/catégorie + bouton favori)
2. Titre
3. Description
4. Syntaxe (bloc code)
5. Arguments (tableau optionnel)
6. Exemples (simple + métier avec contexte)
7. Guide étape par étape (numérotation circulaire)
8. Erreurs courantes (problème / solution)
9. Astuce (icône ampoule, fond surligné)
10. Voir aussi (boutons cliquables vers d'autres formules)

### Système de favoris

- Stockage : `localStorage`, clé `ecfr_favoris`
- IDs : `f:{nom_formule}` pour les formules, `r:{action}` pour les raccourcis
- Compteur temps réel sur l'onglet Favoris
- Bouton étoile sur chaque carte et dans les modales

### Interactions

- Copie d'exemples au clic (clipboard API + fallback)
- Toast notifications (confirmation copie / favori)
- Navigation clavier : `Enter`, `Space`, `Escape`, focus trap dans la modale
- Accessibilité ARIA : `role="tab"`, `role="dialog"`, `aria-selected`, `aria-live="polite"`

---

## Structure des données

### Formule (`formulas.json`)

```json
{
  "nom": "SOMME",
  "categorie": "Mathématiques",
  "niveau": "Débutant | Intermédiaire | Avancé",
  "description": "...",
  "syntaxe": "SOMME(nombre1; [nombre2]; ...)",
  "arguments": [{ "nom": "nombre1", "description": "..." }],
  "exemple": "=SOMME(A1:A10)",
  "exempleMetier": { "contexte": "...", "formule": "...", "resultat": "..." },
  "etapes": ["Étape 1...", "Étape 2..."],
  "erreurs": [{ "probleme": "...", "solution": "..." }],
  "astuce": "...",
  "voirAussi": ["NB", "MOYENNE"]
}
```

### Raccourci (`shortcuts.json`)

```json
{
  "touches": ["Ctrl", "C"],
  "action": "Copier",
  "description": "...",
  "categorie": "Édition"
}
```

### Catégories des formules (8)

Navigation, Sélection, Édition, Mise en forme, Lignes & colonnes, Données, Formules, Feuilles & classeur

### Catégories des raccourcis (8)

Mathématiques, Logiques, Recherche, Texte, Date/Heure, Financières, Statistiques, Information

---

## Évolutions prévues — Refonte de la navigation

### Objectif

Remplacer la navigation horizontale actuelle (onglets + filtres) par un **volet latéral fixe (sidebar)**, inspiré de l'image de référence fournie. L'organisation doit être plus directe et la recherche plus proéminente.

### Layout cible

```
┌─────────────────┬────────────────────────────────────────┐
│   SIDEBAR       │  ZONE PRINCIPALE                       │
│                 │                                        │
│ [Barre rech.]   │  ┌──────────────────────────────────┐ │
│                 │  │ Grille de cartes / détail        │ │
│ MA BIBLIOTHÈQUE │  │                                  │ │
│  · Favoris      │  │                                  │ │
│  · Récents      │  └──────────────────────────────────┘ │
│                 │                                        │
│ RACCOURCIS      │                                        │
│  · Navigation   │                                        │
│  · Sélection    │                                        │
│  · Édition      │                                        │
│  · ...          │                                        │
│                 │                                        │
│ FORMULES        │                                        │
│  · Math & Trig  │                                        │
│  · Logique      │                                        │
│  · Recherche    │                                        │
│  · ...          │                                        │
└─────────────────┴────────────────────────────────────────┘
```

### Détails de la sidebar

- **Barre de recherche en haut** de la sidebar (ou en haut de la zone principale), avec indication du raccourci clavier (`⌘K` / `Ctrl+K`)
- **Section "MA BIBLIOTHÈQUE"** : Favoris, Récents (historique de navigation)
- **Section "RACCOURCIS CLAVIER"** : chaque sous-catégorie est un lien direct
- **Section "FORMULES & FONCTIONS"** : chaque sous-catégorie est un lien direct
- Item actif mis en évidence (fond vert clair, texte vert)
- La sidebar peut être collapsible sur mobile (hamburger menu)

### Comportement attendu

- Cliquer une catégorie dans la sidebar filtre directement le contenu principal
- La barre de recherche (`⌘K`) peut ouvrir un spotlight/command palette global
- Les "Récents" trackent les fiches détaillées consultées (localStorage)
- L'état actif de la sidebar est synchronisé avec le contenu affiché

### Ce qui change vs. l'existant

| Actuel | Cible |
|---|---|
| Onglets horizontaux (Formules/Raccourcis/Favoris) | Sidebar avec sections hiérarchiques |
| Filtres de catégorie sous les onglets | Liens de catégorie dans la sidebar |
| Recherche dans le header | Recherche en haut de sidebar ou zone principale |
| Pas de "Récents" | Section "Récents" dans MA BIBLIOTHÈQUE |

---

## Fichiers clés à modifier lors de la refonte

- `index.html` — Structure HTML (ajouter `<aside>`, réorganiser `<main>`)
- `styles.css` — Nouveau layout sidebar + variables de largeur
- `app.js` — Logique de navigation sidebar, historique récents, raccourci `⌘K`
