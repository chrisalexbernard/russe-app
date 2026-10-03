# Русский — appli d'apprentissage du russe

App web pour consolider des cours de russe hebdomadaires suivis avec un manuel de 28 leçons.
Principe clé : **les mots d'une leçon restent masqués tant que l'élève ne l'a pas validée**.

## Lancer

Ouvrir `web/index.html` dans un navigateur (aucun build, aucune dépendance). Les polices viennent de Google Fonts.

## Structure

- `web/index.html`, `web/styles.css`, `web/app.js` : l'appli (JS vanilla, routage par hash `#/`, `#/dico`, `#/lecon/N`, `#/verbe/<infinitif>`, `#/grammaire`, `#/valider`). Responsive : menu latéral ≥ 900 px, barre d'onglets en dessous.
- `web/dict.js` : `window.DICT = {…}`, le JSON de `dict/dict.json` tel quel (928 mots, 161 verbes), enveloppé dans une assignation globale. Les deux fichiers doivent rester identiques. Ne pas éditer `dict.js` à la main ; répercuter tout changement dans `dict/dict.json` puis le recopier dans `dict.js`. **Aucun script ne régénère ces fichiers depuis les sources `dict/*.txt` à ce jour** (`build.py`/`shell.py` ne concernent que la maquette `project/`) — toute correction de mot ou de verbe se fait à la main dans les trois fichiers (`.txt` source, `dict.json`, `dict.js`), ou en écrivant un script de génération dédié si le volume de corrections le justifie.
- `dict/164.txt … 170.txt` : transcription du lexique du livre (pp. 164–170), une ligne par mot : `mot|leçon|traduction|nature`, `'` = accent tonique (converti en U+0301 dans `dict.json`). Natures : nm, nf, nn, npl, v, adj, adv, pron, prep, conj, num, part, expr. Somme des lignes des 7 fichiers = 928 (vérifié).
- `dict/verbs.txt` : conjugaisons, `infinitif|impf/pf|paire|1/2/irr|présent(6)|passé(4)|impératif(2)|note`. `R` = formes régulières (déjà développées dans `dict.json`, pas de placeholder côté web). `-` dans la colonne impératif = pas d'impératif pour ce verbe (16 verbes, ex. мочь, ви́деть, нра́виться) ; dans `dict.json`/`app.js` cela devient un tableau `imp` vide et la fiche verbe affiche « Pas d'impératif pour ce verbe. ».
- `dictionnaire-russe.csv` : export pour relecture.
- `project/`, `tpl/`, `build.py`, `shell.py` : maquette Claude Design d'origine (fichiers `.dc.html`, ne tournent que dans Claude Design). Référence visuelle seulement.

## Données

- 928 mots, 161 verbes. Le livre ne donne que le russe et le numéro de leçon : traductions et natures ont été ajoutées par Claude, à faire relire.
- Un mot présent dans deux leçons (дорого́й 15, 23) est rangé dans la première.
- Progression : `localStorage['russe.lessonsDone']` (nombre de leçons validées, 0–28). Seul ce compteur est persisté : la date saisie dans l'écran Valider (`ui.lessonDate`) n'est affichée que pour cette session et n'est jamais sauvegardée.
- Cohérence vérifiée (code ↔ données) : `dict.json`/`dict.js` identiques, 928 mots pour 161 verbes (tous les mots `t:"v"` ont une entrée `verbs`, et vice versa), aucune nature hors liste, aucun doublon russe, leçons 1–28 toutes représentées, tableaux `pres`(6)/`past`(4)/`imp`(0 ou 2) cohérents avec `verbs.txt`.

## Conventions

- Russe imprimé : PT Serif ; cursive : Marck Script (police manuscrite cyrillique) en bleu encre `#2340A0`. Toujours afficher les deux, avec le sélecteur « Les deux / Imprimé / Cursive ».
- Terminaisons de conjugaison et de déclinaison en rouge (`.end`).
- Interface en français.

## À faire

- Règles de grammaire réelles (l'écran Grammaire contient des exemples provisoires dans `RULES`/`CASES` de `app.js`) — l'élève doit fournir les pages de grammaire du livre.
- Ajout/édition de règles de grammaire depuis l'interface.
- Éventuellement : révision (flashcards) sur les mots débloqués.
