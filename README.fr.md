# Tournées de coursiers avec fenêtres horaires, augmentées par le Machine Learning

*[English version: README.md](README.md)*

Projet de Machine Learning et d'optimisation logistique (Master AIDA, Dauphine-PSL). Enseignant : Mr Slim Ayedi.
Dataset : **LaDe-P** (Cainiao, licence Apache-2.0), ville de **Yantai**, 1 146 781 colis.

**Idée en une phrase :** le Machine Learning prédit le temps entre deux points de collecte ; un algorithme d'optimisation (TSP avec fenêtres horaires, résolu à chaque arrêt) utilise ces prédictions pour choisir l'ordre de visite.

Le projet est disponible en **français et en anglais** : notebook, rapport et plateforme web.

## Aperçu

### Plateforme web

Plateforme interactive (français / anglais) : vue d'ensemble, explorateur de données, préparation, analyse exploratoire, modèles ML, **simulateur de tournées qui exécute l'optimisation dans le navigateur** et comparaison avant / après.

![Plateforme web : vue d'ensemble](docs/img/platform_overview.png)

![Plateforme web : simulateur de tournées](docs/img/platform_simulator.png)

<details>
<summary>Autres captures</summary>

![Plateforme web : avant / après](docs/img/platform_before_after.png)

![Plateforme web : modèles ML](docs/img/platform_ml_models.png)

![Plateforme web : analyse exploratoire](docs/img/platform_eda.png)

</details>

*Les captures montrent la version anglaise de la plateforme.*

### Figures clés

**Résultat principal : l'optimisation raccourcit les tournées, et le ML rend le plan fiable (moins de retards que l'optimisation sans ML).**

![KPI moyens par journée pour les trois stratégies](docs/img/kpi_before_after.png)

**Pourquoi le ML : la formule de référence sous-estime les temps de trajet (biais très négatif), alors que les modèles ML sont sans biais.**

![Comparaison des modèles sur le jeu de test](docs/img/model_comparison.png)

**Le temps n'est pas proportionnel à la distance, ce qu'une formule « distance ÷ vitesse » ne peut pas capter.**

![Temps entre visites selon la distance](docs/img/time_vs_distance.png)

*Les figures sont en anglais ; les figures françaises sont dans `rapport/figures/`.*

## Structure

```
Projet_Tournees_LaDe/
├── notebook/
│   ├── projet_tournees_lade_fr.ipynb      ← notebook français, déjà exécuté (sorties incluses)
│   └── projet_tournees_lade_en.ipynb      ← notebook anglais (à exécuter pour produire les sorties anglaises)
├── data/
│   ├── pickup_yt.csv                      ← à télécharger (non inclus, 190 Mo, voir ci-dessous)
│   └── donnees_preparees_echantillon.csv  ← 50 000 paires préparées (variables + cible)
├── exports/                               ← résultats du notebook français (JSON / CSV)
├── exports_en/                            ← écrits par le notebook anglais
├── rapport/
│   ├── rapport_final_fr.pdf / .docx       ← rapport français (7 pages, A4)
│   ├── rapport_final_en.pdf / .docx       ← rapport anglais (7 pages, A4)
│   ├── figures/                           ← 18 figures PNG (notebook français)
│   └── figures_en/                        ← 18 figures PNG (notebook anglais)
├── web/
│   ├── index.html, app.js                 ← plateforme française
│   ├── index_en.html, app_en.js           ← plateforme anglaise
│   ├── style.css, simulateur.js           ← communs
│   ├── lib/graphiques.js                  ← moteur de graphiques SVG (aucune dépendance)
│   ├── data/donnees.js                    ← données de la plateforme française (+ JSON/CSV)
│   └── data_en/donnees.js                 ← données de la plateforme anglaise
├── presentation/
│   └── guide_presentation.md              ← résumé, script oral, questions/réponses, explication du code, guide de démo
├── requirements.txt
└── README.md / README.fr.md
```

## 1. Obtenir le dataset

1. Ouvrir https://huggingface.co/datasets/Cainiao-AI/LaDe/tree/main (compte gratuit, accepter les conditions d'usage).
2. Dossier `pickup`, télécharger `pickup_yt.csv`.
3. Le placer dans `data/pickup_yt.csv`.

## 2. Exécuter le notebook

**Google Colab**
1. Ouvrir `notebook/projet_tournees_lade_fr.ipynb` (ou `_en`) dans Colab.
2. Créer un dossier `data/` dans l'espace de fichiers de Colab et y déposer `pickup_yt.csv`.
3. Menu *Exécution > Tout exécuter*. Durée : environ 3 minutes. Aucune installation n'est nécessaire.

**En local**
```bash
pip install -r requirements.txt
cd notebook
jupyter notebook projet_tournees_lade_fr.ipynb
```
Le notebook détecte automatiquement le dossier du projet. Le notebook français régénère les figures (`rapport/figures/`), les exports (`exports/`) et les données du site (`web/data/`) ; le notebook anglais écrit dans `rapport/figures_en/`, `exports_en/` et `web/data_en/`. Les graines aléatoires sont fixées (`SEED = 42`) : les résultats sont reproductibles.

## 3. Lancer la plateforme web

Méthode la plus simple : **double-cliquer sur `web/index.html`** (français) ou `web/index_en.html` (anglais). Le site n'utilise aucun serveur, aucune base de données et aucune connexion internet ; seules les polices Google Fonts sont chargées en ligne, avec un repli automatique hors ligne. Un sélecteur de langue (FR | EN) se trouve dans la barre latérale.

Méthode recommandée (serveur statique Python, pour que les liens vers le rapport et le notebook s'ouvrent correctement) :
```bash
python -m http.server 8000
```
Puis ouvrir http://localhost:8000/web/ (français) ou http://localhost:8000/web/index_en.html (anglais).

## 4. Cohérence entre les livrables

* Le **notebook** est la source de vérité.
* Le **rapport** est généré à partir des exports du notebook ; aucun chiffre n'y est saisi à la main.
* Le **site** lit `web/data*/donnees.js`, créé par la dernière cellule d'export du notebook.
* Le **simulateur web** exécute réellement l'optimisation dans le navigateur, avec les mêmes matrices de temps que le notebook. Sur les 24 journées exportées, il reproduit **exactement** les résultats du notebook (écart maximal : 0). La page du simulateur l'affiche quand λ = 5.

## 5. Ce qui est observé, ce qui est simulé

* **Observé :** positions, fenêtres horaires, moments d'acceptation, ordre réel des coursiers, distances.
* **Prédit par le ML :** temps entre deux visites, selon la distance, le lieu et l'heure.
* **Simulé :** les temps des tournées optimisées, qui n'ont jamais été réalisées. Ils sont notés par un **modèle évaluateur indépendant**, entraîné sur d'autres coursiers. Seules les comparaisons entre stratégies sont interprétables, pas les valeurs absolues des retards.
* **Hypothèse :** λ = 5, c'est-à-dire qu'une minute de retard coûte autant que 5 minutes de trajet. Une analyse de sensibilité est fournie pour λ de 0 à 20.

## Outils

Python 3, pandas, numpy, matplotlib, scikit-learn, scipy (solveur MILP HiGHS via `scipy.optimize.milp`). Tous sont gratuits et préinstallés dans Google Colab. Le site est écrit en HTML, CSS et JavaScript, sans framework.
