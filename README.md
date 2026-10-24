# L’Atelier de Béré

Site vitrine de **L’Atelier de Béré**, prothésiste ongulaire à Brest (Av. de Tarente, 29200).
Objectif : donner envie et faire **prendre rendez-vous** (appel, SMS préparé, Instagram).

Site 100 % statique : aucun build, aucune dépendance à installer.

```bash
python3 -m http.server 8000   # puis ouvrir http://localhost:8000
```

## Structure

```
index.html                 contenu, SEO, données structurées LocalBusiness (NailSalon)
assets/css/style.css       design tokens, mise en page, responsive, mouvement réduit
assets/js/main.js          animations (GSAP) + fonctions du site
assets/js/vendor/          gsap, ScrollTrigger, Lenis (embarqués, aucun CDN)
assets/fonts/              Bodoni Moda (titres) et Jost (texte), latin, auto-hébergées
assets/img/                photos de l’atelier, logo, favicon
```

## Direction artistique — « gel & porcelaine »

- **Palette** : nude `#ECDED5` (fond) · beurre `#F1E69F` (accent chaud) — imposées —, avec lait `#FBF6F0`,
  cacao `#2B1B1E` (texte, sections sombres), cerise `#B3122F` (vernis rouge des photos : survols, appels à l’action), rose poudré `#E4B5AD`.
- **Typographies** : *Bodoni Moda* (titres géants, italique d’accent) + *Jost* (texte).
- **Fil rouge** : l’**ongle amande** et son **reflet de vernis** (cadres photo, curseurs, puces, loader, aperçu interactif)
  et la **« smile line »** de la french manicure comme séparateur de sections.

## Mise en scène

Loader (l’ongle se remplit de vernis) · hero multicouche (parallaxe au scroll et à la souris) · bandeaux défilants
réactifs au scroll · récit « Le rituel » épinglé en 4 temps · carte des prestations en **défilement horizontal**
(cartes 3D + reflet) · nuancier où l’ongle se transforme selon la ligne de tarif · chiffres clés animés ·
galerie (rideau, parallaxe décalée, inclinaison 3D, visionneuse) · avis en carrousel (pause, précédent/suivant) ·
FAQ · préparation d’un SMS de rendez-vous · horaires avec statut ouvert/fermé en temps réel · carte Google Maps cliquable ·
footer au nom géant.

Amélioration progressive : sans JavaScript, ou avec `prefers-reduced-motion`, le site reste entièrement lisible
(pas de loader, pas d’épinglage, défilement natif, aucun contenu masqué). Sur mobile, l’épinglage est remplacé par
une image « sticky » et le ruban de prestations se balaye au doigt.

## À compléter / améliorer

- **Photos** : les 4 photos fournies font 480 px de large ; elles sont affichées à leur taille native pour rester nettes.
  Avec des fichiers plus grands (1200 px+), on peut passer à des visuels plein écran et à une vidéo hero 16:9
  (`autoplay muted loop playsinline` + image de secours). Le logo fourni fait 150 px : un fichier vectoriel / HD serait préférable.
- **Chiffres clés** : ils reposent uniquement sur des données réelles (jours d’ouverture, tarifs). Si pertinent, ajouter
  *années d’expérience* ou *nombre de clientes* dans la section « En chiffres » (`data-count`).
- **Avis** : les deux avis sont repris mot pour mot. Les ajouter dans `index.html` (section `#avis`) et dans
  `initReviews` (compteur « / 02 » et points de progression) s’il y en a d’autres.
- **Mise en ligne** : renseigner l’URL canonique, une image Open Graph absolue (`og:image`) et les mentions légales
  (SIRET, hébergeur) une fois le nom de domaine connu.
