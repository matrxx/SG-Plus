// =============================================================================
// Portail Services Internes - Logique Frontend
// Version nettoyée et adaptée pour le backend Node.js
// =============================================================================

// -----------------------------------------------------------------------------
// État global
// -----------------------------------------------------------------------------
console.log("APP.JS EXECUTE");
let currentUser = null;
let currentCategoryKey = null;
let currentFormKey = null;
let currentStep = 1;
let formData = {};
let submittedRequests = [];

const sampleRequests = [
  { id: 1, ref: 'BR-2024-001', title: 'Demande de fournitures courantes', category: 'Fournitures', date: '12/08/2026', status: 'en_cours' },
  { id: 2, ref: 'BR-2024-002', title: 'Réservation de véhicule', category: 'Véhicule', date: '08/08/2026', status: 'traitee' }
];

// -----------------------------------------------------------------------------
// Données statiques (icônes, catégories, formulaires)
// -----------------------------------------------------------------------------

// Icônes SVG
const svgIcons = {
  walk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="1.5" fill="currentColor" stroke="none"/><path d="M10.5 21l1.5-5.5-2-1.5.5-4.5 4 1 2 3.5"/><path d="M11 10l-3 1.5L6 14"/><path d="M14 11l2 2 3-1"/></svg>',
  package: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l9-5 9 5-9 5-9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
  printer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="9" width="12" height="7" rx="1"/><path d="M6 9V4h12v5"/><path d="M8 16v4h8v-4"/></svg>',
  spray: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h2l1 3H8l1-3z"/><rect x="7" y="6" width="6" height="15" rx="1.5"/><path d="M16 9l2-1M17 12h2.5M16 15l2 1"/></svg>',
  tool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 105 5l-3-3-2-2z"/><path d="M9.3 17.7a4 4 0 11-5-5l3 3 2 2z"/><path d="M9.3 9.3l5.4 5.4"/></svg>',
  badge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M8 17c.7-1.8 2.2-3 4-3s3.3 1.2 4 3"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8" width="11" height="9" rx="1"/><path d="M13 11h4l3 3v3h-7z"/><circle cx="6" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></svg>',
  desk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h18v3H3z"/><path d="M5 11v9M19 11v9M9 8V5h6v3"/></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16V12l2-4h12l2 4v4"/><path d="M4 16h16"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/></svg>',
  confetti: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l3 7 3-3-2-7z"/><circle cx="17" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="20" cy="11" r="1" fill="currentColor" stroke="none"/><path d="M13 8l4-4M16 13l3-1"/></svg>',
  palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 7 0 100 14c1 0 1.5-.7 1.5-1.5S13 14 13 13a2 2 0 012-2h2a3 3 0 003-3c0-3-3.5-5-8-5z"/><circle cx="8" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/></svg>',
  doorEnter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h4v18h-4"/><path d="M3 12h11M11 8l3 4-3 4"/></svg>',
  doorExit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3H6v18h4"/><path d="M21 12H10M13 8l-4 4 4 4"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l8-8h5v5l-8 8z"/><circle cx="13" cy="6" r="1" fill="currentColor" stroke="none"/><path d="M3 11l7 7"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="13" rx="1"/><path d="M4 7l8-4 8 4M12 11v9"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h6l2 2h10v11H3z"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l4 4-9 9H5v-4z"/></svg>',
  droplet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.5 6 11a6 6 0 11-12 0c0-4.5 6-11 6-11z"/></svg>',
  stars: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5z"/></svg>',
  stamp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v6H9z"/><path d="M7 9h10l2 5H5z"/><path d="M3 19h18"/></svg>',
  files: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h8l4 4v13H7z"/><path d="M5 7v14h12"/></svg>',
  notebook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 3v18M5 8h2M5 14h2"/></svg>',
  cut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M8 7.5L20 18M8 16.5L20 6"/></svg>',
  stairs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20v-4h4v-4h4v-4h4V4h4"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  badgeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3.5"/><path d="M11 11l9 9M17 14l3-3M14 17l2.5-2.5"/></svg>',
  userPlus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><path d="M18 8v5M15.5 10.5h5"/></svg>',
  shieldLock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 5-3 7.5-7 9-4-1.5-7-4-7-9V6z"/><rect x="9.5" y="11" width="5" height="4" rx="0.5"/><path d="M12 11V9.5"/></svg>',
  truckDelivery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="9" width="10" height="7" rx="1"/><path d="M12 12h4l3 2v2h-7z"/><circle cx="6" cy="18" r="1.3"/><circle cx="16" cy="18" r="1.3"/></svg>',
  mailForward: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="14" height="11" rx="1"/><path d="M3 6l7 5 7-5"/><path d="M18 14l3 2-3 2"/></svg>',
  forklift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="13" width="6" height="4"/><path d="M9 15h4l3-8M16 7h3l1 4v4h-2"/><circle cx="6" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/></svg>',
  truckLoading: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="9" width="10" height="7" rx="1"/><path d="M12 12h4l3 2v2h-7z"/><path d="M5 6v3M9 6v3"/></svg>',
  armchair: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12V7a2 2 0 014 0v5M14 12V7a2 2 0 014 0v5"/><path d="M4 12h16v4a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><path d="M6 18v2M18 18v2"/></svg>',
  coffee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h12v5a4 4 0 01-4 4H9a4 4 0 01-4-4z"/><path d="M17 10h2a2 2 0 010 4h-2"/><path d="M8 4c0 1-1 1-1 2M12 4c0 1-1 1-1 2"/></svg>',
  ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9a2 2 0 010 4v3h18v-3a2 2 0 010-4V6H3z"/><path d="M13 6v12"/></svg>',
  presentation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="11" rx="1"/><path d="M12 15v5M8 20h8M8 8l3 3 2-2 3 3"/></svg>',
  fileText: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v14H7z"/><path d="M9 12h6M9 16h6"/></svg>',
  filePencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v14H7z"/><path d="M9.5 16.5l1-3 4-4 2 2-4 4z"/></svg>',
  archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11h14V8"/><path d="M10 13h4"/></svg>',
  mailOpened: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-5 9 5v9H3z"/><path d="M3 9l9 5 9-5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 6l9 7 9-7"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  budget: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16"/><path d="M7 16V8"/><path d="M12 16V5"/><path d="M17 16v-7"/><path d="M5 8h3M10 5h3M15 9h3"/><path d="M6 20V17"/><path d="M18 20V17"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></svg>',
  userCheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><path d="M16 11l2 2 3-3"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-8-8 18-2-8z"/></svg>',
  infoCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v.5M12 11v5"/></svg>'
};

// Génère le markup d'une icône SVG
function icon(name, extraStyle) {
  const svg = svgIcons[name] || svgIcons.fileText;
  return `<span class="svg-icon" style="${extraStyle || ''}">${svg}</span>`;
}

// Métadonnées des catégories
const categoryMeta = [
  { key: 'arrivee-depart', icon: 'walk', bg: '#9FE1CB', fg: '#085041' },
  { key: 'fournitures', icon: 'package', bg: '#F5C4B3', fg: '#712B13' },
  { key: 'budget', icon: 'budget', bg: '#B5D4F4', fg: '#0C447C' },
  { key: 'menage', icon: 'spray', bg: '#F4C0D1', fg: '#72243E' },
  { key: 'intervention-technique', icon: 'tool', bg: '#FAC775', fg: '#633806' },
  { key: 'acces-sites', icon: 'badge', bg: '#85B7EB', fg: '#042C53' },
  { key: 'livraison-envoi', icon: 'truck', bg: '#F0997B', fg: '#4A1B0C' },
  { key: 'equipements-bureau', icon: 'desk', bg: '#5DCAA5', fg: '#04342C' },
  { key: 'vehicule', icon: 'car', bg: '#AFA9EC', fg: '#26215C' },
  { key: 'evenementiel', icon: 'confetti', bg: '#ED93B1', fg: '#4B1528' },
 //  { key: 'oeuvres-art', icon: 'palette', bg: '#97C459', fg: '#173404' }
];
const categoryForms = {
  'arrivee-depart': {
    title: 'Arrivée/Départ',
    forms: {
      arrivee: {
        title: "Arrivée d'un nouvel agent",
        ref: "ARR",
        icon: 'doorEnter',
        steps: [
          { label: "Pré-requis à la demande d'installation", title: "Pré-requis à la demande d'installation", desc: "Avant de commencer, confirmez les éléments suivants", type: 'checklist', items: ["La date d'arrivée de l'agent est confirmée par le service RH", "Le poste de travail (bureau) est identifié et disponible", "Le responsable hiérarchique de l'agent est informé"] },
          { label: "Informations sur l'agent concerné", title: "Informations sur l'agent concerné", desc: "Renseignez l'identité du nouvel agent", type: 'fields', fields: [{label: "Prénom", req: true}, {label: "Nom", req: true}, {label: "E-mail", req: true, type: 'email'}, {label: "Date d'arrivée", req: true, type: 'date'}, {label: "Service / direction", req: true}, {label: "Fonction"}] },
          { label: "Contexte de l'arrivée", title: "Contexte de l'arrivée", desc: "Précisez le type de contrat et la localisation", type: 'mixed', radio: { label: "Type de contrat", req: true, options: ["Fonctionnaire", "Contractuel", "Stage / alternance", "Vacataire"] }, fields: [{ label: "Site / bâtiment", req: true, options: ["Paris Carrousel", "Paris Flore", "Versailles aile Paris", "Versailles aile Sceaux"] }, { label: "Numéro de bureau" }] },
          { label: "Mobilier", title: "Mobilier", desc: "Sélectionnez les éléments à installer", type: 'checklist', items: ["Bureau", "Chaise ergonomique", "Caisson de rangement", "Armoire", "Porte-manteau"] },
          { label: "Poste de travail informatique", title: "Poste de travail informatique", desc: "Sélectionnez le type d'ordinateur et les accessoires nécessaires", type: 'mixed', radio: { label: "Type d'ordinateur", req: true, options: ["Ordinateur portable MCC", "Ordinateur fixe", "Déjà existant", "Ordinateur mutualisé"] }, fields: [{ label: "Autre précision" }] },
          { label: "Équipements informatiques nécessaires", title: "Équipements informatiques nécessaires", desc: "Choisissez les équipements à installer", type: 'checklist', items: ["Écran spécifique", "Double écran", "Souris ergonomique", "Casque audio"] },
          { label: "Droits d'accès aux dossiers sur le réseau", title: "Droits d'accès aux dossiers sur le réseau", desc: "Sélectionnez les accès requis", type: 'checklist', items: ["Profil direction", "Profil Secrétariat général", "Profil Recherche", "Profil Restauration", "Profil Régie", "CoDir", "Pas d'accès"] },
          { label: "Téléphonie fixe", title: "Téléphonie fixe", desc: "Configuration de la ligne téléphonique", type: 'mixed', radio: { label: "Type de ligne", req: true, options: ["Poste fixe individuel", "Ligne partagée", "Aucune"] }, fields: [{ label: "Numéro à transférer (si remplacement)" }] },
          { label: "Téléphonie mobile", title: "Téléphonie mobile", desc: "Configuration de la ligne mobile", type: 'mixed', radio: { label: "Type de ligne", req: true, options: ["Nouveau mobile", "Récupération mobile existant", "Aucune"] }, fields: [{ label: "Numéro à récupérer (si repris de l'existant)" }] },
          { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
        ]
      },
      demenagement: { title: "Déménagement d'un agent", ref: "DEM", icon: 'truck', steps: [
        { label: "À propos de l'agent concerné", title: "À propos de l'agent concerné par le déménagement", desc: "Identité et localisation actuelle/nouvelle", type: 'fields', fields: [{label: "Prénom", req: true}, {label: "Nom", req: true}, {label: "E-mail professionnel", req: true, type: 'email'}, {label: "Bureau actuel", req: true}, {label: "Nouveau bureau", req: true}, {label: "Date du déménagement", req: true, type: 'date'}] },
        { label: "Mobilier à déménager", title: "Mobilier à déménager", desc: "Sélectionnez les éléments concernés", type: 'checklist', items: ["Bureau","Chaise","Caisson de rangement","Armoire","Étagères"] },
        { label: "Informatique à déménager", title: "Informatique à déménager", desc: "Équipements informatiques à transférer", type: 'checklist', items: ["Unité centrale / portable","Écran(s)","Imprimante","Périphériques (souris, clavier...)"] },
        { label: "Téléphonie à déménager", title: "Téléphonie à déménager", desc: "Ligne et poste téléphonique", type: 'mixed', radio: {label: "Action requise", options: ["Transfert du poste existant","Nouvelle ligne","Aucune action"]}, fields: [] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      depart: { title: "Départ d'un agent", ref: "DEP", icon: 'doorExit', steps: [
        { label: "À propos de l'agent concerné", title: "À propos de l'agent concerné par le départ", desc: "Identité et date de départ", type: 'fields', fields: [{label: "Prénom", req: true}, {label: "Nom", req: true}, {label: "E-mail professionnel", req: true, type: 'email'}, {label: "Date de départ", req: true, type: 'date'}, {label: "Motif du départ"}] },
        { label: "Mobilier à récupérer", title: "Mobilier à récupérer", desc: "Sélectionnez les éléments à reprendre", type: 'checklist', items: ["Bureau","Chaise","Caisson de rangement","Armoire"] },
        { label: "Matériel informatique à récupérer", title: "Matériel informatique à récupérer", desc: "Équipements à restituer", type: 'checklist', items: ["Ordinateur portable / fixe","Écran(s)","Badge d'accès","Périphériques", "Téléphone mobile professionnel"] },
        { label: "Matériel de téléphonie à récupérer", title: "Matériel de téléphonie à récupérer", desc: "Ligne et poste téléphonique", type: 'mixed', radio: {label: "Action sur la ligne", options: ["Clôture définitive","Réaffectation à un autre agent"]}, fields: [] },
          {desc: "Pour rappel, les badges d'accès sont à restituer obligatoirement au service RH."}, 
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]}
    }
  },

  'fournitures': {
    title: 'Fournitures',
    forms: {
      signaletique: { title: "Signalétique de bureau", ref: "SIG", icon: 'tag', steps: [
        { label: "Votre demande", title: "Signalétique de bureau", desc: "Décrivez votre besoin", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Bureau concerné", req: true},{label: "Texte souhaité sur la plaque", req: true},{label: "Quantité"}] }
      ]},
      cartons: { title: "Cartons d'archives et d'élimination", ref: "CAE", icon: 'box', steps: [
        { label: "Votre demande", title: "Cartons d'archives et d'élimination", desc: "Précisez votre besoin", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Service / direction", req: true},{label: "Nombre de cartons", req: true},{label: "Type (archive / élimination)", req: true}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      dossier_srh: { title: "Dossier spécifique SRH", ref: "SRH", icon: 'folder', steps: [
        { label: "Identité du demandeur", title: "Identité du demandeur", desc: "Renseignez vos coordonnées", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Service / direction", req: true},{label: "Nature du dossier demandé", req: true}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      courantes: { title: "Fournitures courantes", ref: "FCO", icon: 'pencil', steps: [
        { label: "Identité du demandeur", title: "Identité du demandeur", desc: "Renseignez vos coordonnées et votre besoin", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Service / direction", req: true},{label: "Articles souhaités", req: true},{label: "Quantité"}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      sanitaires: { title: "Fournitures sanitaires", ref: "FSA", icon: 'droplet', steps: [
        { label: "Identité du demandeur", title: "Fournitures sanitaires", desc: "Renseignez vos coordonnées et votre besoin", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Service / direction", req: true},{label: "Articles souhaités", req: true}] }
      ]},
      specifiques: { title: "Fournitures spécifiques", ref: "FSP", icon: 'stars', steps: [
        { label: "Identité du demandeur", title: "Fournitures spécifiques", desc: "Décrivez votre besoin particulier", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Service / direction", req: true},{label: "Description du besoin", req: true, type: 'textarea'}] }
      ]},
      tampons: { title: "Tampons", ref: "TAM", icon: 'stamp', steps: [
        { label: "Identité du demandeur", title: "Tampons", desc: "Renseignez le texte souhaité sur le tampon", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Service / direction", req: true},{label: "Texte du tampon", req: true},{label: "Quantité"}] }
      ]}
    }
  },

  'budget': {
    title: 'Budget',
    forms: {
      proposition_depenses: { 
        title: "PROPOSITION DE DÉPENSES", 
        ref: "BUD", 
        icon: 'files', 
        steps: [
          { 
            label: "Identifiant du demandeur", 
            title: "Identifiant du demandeur", 
            desc: "Renseignez vos coordonnées", 
            type: 'fields', 
            fields: [
              {label: "Nom", req: true, type: 'text'},
              {label: "Prénom", req: true, type: 'text'},
              {label: "Direction", req: true, type: 'text'}
            ] 
          },
          { 
            label: "Identifiant du fournisseur", 
            title: "Identifiant du fournisseur", 
            desc: "Renseignez les informations du fournisseur", 
            type: 'fields', 
            fields: [
              {label: "Nom", req: true, type: 'text'},
              {label: "Adresse", req: true, type: 'text'},
              {label: "Mail du fournisseur", req: true, type: 'text'},
              {label: "Si nouveau fournisseur, numéro de SIRET et RIB obligatoires", req: false, type: 'text'}
            ] 
          },
          { 
            label: "Nature de la commande", 
            title: "Nature de la commande", 
            desc: "Précisez les détails de la commande", 
            type: 'mixed', 
            radio: {label: "Type de commande", req: true, options: ["de l'acquisition","de la prestation"]}, 
            fields: [
              {label: "Titre de la commande", req: true, type: 'text'},
              {label: "Justification", req: true, type: 'text'},
              {label: "Si dépense dans le cadre d'un projet spécifique (européen, PNCR) préciser lequel", req: false, type: 'text'},
              {label: "Montant de la commande", req: true, type: 'text'}
            ] 
          },
          { 
            label: "Rappel des procédures", 
            title: "Rappel des procédures", 
            desc: "Pour rappel, les procédures applicables à la commande publique sont les suivantes :", 
            type: 'fixed', 
            content: "<ul><li>Si dépense inférieure à 40 000 € HT : plusieurs devis souhaitables, publicité non obligatoire</li><li>Si dépense comprise entre 40 000€ HT et 90 000€ HT : établissement d'un cahier des charges pour un marché à procédure adaptée, publicité libre ou adaptée</li><li>Si dépense supérieure à 90 000 € HT et inférieure à 140 000 € HT : établissement d'un cahier des charges et publication au BOAMP ou dans un JAL</li><li>Si dépense supérieure à 140 000 HT : publication au BOAMP et au JOUE et recours obligatoire à la procédure formalisée des marchés publics</li></ul>"
          },
          { 
            label: "Pièces jointes", 
            title: "Pièces jointes", 
            desc: "Chargez le devis et autres pièces jointes nécessaires (PDF, Word, JPG, RAW, TIFF - Max 5 Mo par fichier)", 
            type: 'file-upload', 
            allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'raw', 'tiff', 'tif'],
            max_file_size: 5242880,
            max_files: 10,
            required: false
          },
          { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
        ]
      }
    }
  },

  'menage': {
    title: 'Ménage',
    forms: {
      menage_general: { title: "Ménage, désinfestation et déchets", ref: "MEN", icon: 'spray', steps: [
        { label: "Identité du demandeur", title: "Identité du demandeur", desc: "Renseignez vos coordonnées", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Service / direction", req: true},{label: "Site / bâtiment", req: true}] },
        { label: "Votre demande", title: "Votre demande", desc: "Précisez la nature de l'intervention", type: 'mixed', radio: {label: "Type d'intervention", req: true, options: ["Ménage ponctuel","Désinfestation","Enlèvement de déchets"]}, fields: [{label: "Précisions complémentaires"}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]}
    }
  },

  'intervention-technique': {
    title: 'Intervention technique',
    forms: {
      ascenseur: { title: "Ascenseur", ref: "ASC", icon: 'stairs', steps: [
        { label: "Votre demande", title: "Ascenseur", desc: "Décrivez le problème constaté", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Site / bâtiment", req: true},{label: "Description du problème", req: true, type: 'textarea'}] }
      ]},
      intervention: { title: "Demande d'intervention technique", ref: "ITE", icon: 'tool', steps: [
        { label: "Identité du demandeur", title: "Identité du demandeur", desc: "Renseignez vos coordonnées", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Service / direction", req: true},{label: "Site / bâtiment", req: true}] },
        { label: "Votre demande", title: "Votre demande", desc: "Décrivez l'intervention nécessaire", type: 'mixed', radio: {label: "Domaine concerné", options: ["Électricité","Plomberie","Chauffage / climatisation","Autre"]}, fields: [{label: "Description du problème", req: true, type: 'textarea'}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]}
    }
  },

  'acces-sites': {
    title: 'Accès aux sites',
    forms: {
      acces_exceptionnel: { title: "Autorisation d'accès exceptionnel", ref: "AEX", icon: 'clock', steps: [
        { label: "Identité du demandeur", title: "Identité du demandeur", desc: "Renseignez vos coordonnées", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Service / direction", req: true}] },
        { label: "Détail de la demande", title: "Détail de la demande", desc: "Précisez la période concernée", type: 'fields', fields: [{label: "Date et heure d'arrivée", req: true},{label: "Date et heure de départ", req: true},{label: "Motif", req: true, type: 'textarea'}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      perte_badge: { title: "Déclaration de perte du badge", ref: "PBA", icon: 'badgeOff', steps: [
        { label: "Identité du demandeur", title: "Déclaration de perte du badge", desc: "Renseignez vos coordonnées et les circonstances", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Service / direction", req: true},{label: "Date de la perte", req: true, type: 'date'},{label: "Circonstances"}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      cle_bureau: { title: "Clé de bureau", ref: "CLE", icon: 'key', steps: [
        { label: "Votre demande", title: "Clé de bureau", desc: "Renseignez votre demande", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Numéro de bureau", req: true},{label: "Motif"}] }
      ]},
      acces_prestataire: { title: "Autorisation d'accès prestataire ou autre personne extérieure", ref: "APR", icon: 'userPlus', steps: [
        { label: "Votre demande", title: "Votre demande", desc: "Décrivez le contexte de l'intervention", type: 'fields', fields: [{label: "Prénom du demandeur", req: true},{label: "Nom du demandeur", req: true},{label: "Date(s) d'intervention", req: true},{label: "Motif de l'accès", req: true}] },
        { label: "Les intervenants", title: "Les intervenants", desc: "Identité des personnes externes concernées", type: 'fields', fields: [{label: "Nom complet intervenant 1", req: true},{label: "Société", req: true},{label: "Nom complet intervenant 2 (optionnel)"}] }
      ]},
      modif_droits: { title: "Modification des droits du badge", ref: "MDB", icon: 'shieldLock', steps: [
        { label: "Agent concerné", title: "Agent concerné", desc: "Identifiez l'agent dont les droits doivent être modifiés", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Numéro de badge"}] },
        { label: "Détail de la demande", title: "Détail de la demande", desc: "Précisez les zones d'accès concernées", type: 'fields', fields: [{label: "Zones à ajouter"},{label: "Zones à retirer"},{label: "Justification", req: true}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]}
    }
  },

  'livraison-envoi': {
    title: 'Livraison, Envoi et Manutention',
    forms: {
      livraison: { title: "Livraison", ref: "LIV", icon: 'truckDelivery', steps: [
        { label: "Identité du demandeur et sélection du type de livraison", title: "Livraison", desc: "Renseignez les détails de la livraison attendue", type: 'mixed', radio: {label: "Type de livraison", options: ["Colis","Palette","Courrier volumineux"]}, fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Date prévue"}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      signaler_envoi: { title: "Signaler un envoi à la cellule courrier", ref: "SEC", icon: 'mailForward', steps: [
        { label: "Identité du demandeur et sélection du type de livraison", title: "Signaler un envoi", desc: "Renseignez les détails de l'envoi", type: 'mixed', radio: {label: "Type d'envoi", options: ["Courrier standard","Recommandé","Colis"]}, fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Destinataire"}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      manutention: { title: "Manutention sur site", ref: "MAN", icon: 'forklift', steps: [
        { label: "Identité du demandeur", title: "Manutention sur site", desc: "Décrivez le besoin de manutention", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Service / direction", req: true},{label: "Description du besoin", req: true, type: 'textarea'}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      livraison_quai: { title: "Signaler une livraison ou un enlèvement au quai", ref: "LEQ", icon: 'truckLoading', steps: [
        { label: "Identité du demandeur", title: "Signaler une livraison ou un enlèvement au quai", desc: "Renseignez les coordonnées et l'horaire", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Date et heure prévues", req: true},{label: "Nature (livraison / enlèvement)", req: true}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]}
    }
  },

  'equipements-bureau': {
    title: 'Équipements de bureau',
    forms: {
      mobilier_standard: { title: "Mobilier standard", ref: "MST", icon: 'armchair', steps: [
        { label: "Identité du demandeur", title: "Mobilier standard", desc: "Renseignez vos coordonnées et le mobilier souhaité", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Service / direction", req: true},{label: "Mobilier souhaité", req: true}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      equip_specifiques: { title: "Équipements spécifiques de bureau", ref: "ESB", icon: 'desk', steps: [
        { label: "Identité du demandeur", title: "Équipements spécifiques de bureau", desc: "Décrivez le besoin particulier", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Service / direction", req: true},{label: "Description du besoin", req: true, type: 'textarea'}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]}
    }
  },

  'vehicule': {
    title: 'Véhicule',
    forms: {
      reservation: { title: "Réservation de véhicule seul", ref: "VEH", icon: 'car', steps: [
        { label: "Votre demande", title: "Réservation de véhicule seul", desc: "Renseignez les détails de votre réservation", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Date et heure de départ", req: true},{label: "Date et heure de retour", req: true},{label: "Motif du déplacement"}] }
      ]}
    }
  },

  'evenementiel': {
    title: 'Événementiel',
    forms: {
      accueil_cafe: { title: "Accueil café, croissants", ref: "ACC", icon: 'coffee', steps: [
        { label: "Identité du demandeur", title: "Identité du demandeur", desc: "Renseignez vos coordonnées", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Service / direction", req: true}] },
        { label: "Lieu et date de l'événement", title: "Lieu et date de l'événement", desc: "Précisez les modalités", type: 'fields', fields: [{label: "Date", req: true, type: 'date'},{label: "Lieu", req: true},{label: "Nombre de personnes", req: true}] },
        { label: "Bon de commande et facturation", title: "Bon de commande et facturation", desc: "Sélectionnez les articles souhaités", type: 'checklist', items: ["Café","Thé","Croissants / viennoiseries","Jus de fruits","Eau"] },
        { label: "Facturation", title: "Facturation", desc: "Renseignez l'imputation budgétaire", type: 'fields', fields: [{label: "Code budgétaire / centre de coûts", req: true}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      coupon_repas: { title: "Coupon repas", ref: "CRE", icon: 'ticket', steps: [
        { label: "Identité du demandeur", title: "Identité du demandeur", desc: "Renseignez vos coordonnées", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Service / direction", req: true}] },
        { label: "Commande", title: "Commande", desc: "Précisez le nombre de coupons", type: 'fields', fields: [{label: "Nombre de coupons", req: true},{label: "Date d'utilisation prévue"}] },
        { label: "Facturation", title: "Facturation", desc: "Renseignez l'imputation budgétaire", type: 'fields', fields: [{label: "Code budgétaire / centre de coûts", req: true}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      materiel_evenementiel: { title: "Matériel d'événementiel et de réunion", ref: "MER", icon: 'presentation', steps: [
        { label: "Identité du demandeur", title: "Identité du demandeur", desc: "Renseignez vos coordonnées", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Service / direction", req: true}] },
        { label: "Lieu et prestation", title: "Lieu et prestation", desc: "Précisez le matériel et le lieu", type: 'mixed', radio: {label: "Matériel souhaité", options: ["Vidéoprojecteur","Sonorisation","Mobilier de réunion","Visioconférence"]}, fields: [{label: "Lieu / salle", req: true},{label: "Date", req: true, type: 'date'}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]}
    }
  },

 // 'oeuvres-art': {
  //  title: "Œuvres et objets d'art",
   // forms: {
    //  depot_oeuvres: { title: "Dépôt d'œuvres et objets d'art", ref: "OEA", icon: 'palette', steps: [
     //   { label: "Identité du demandeur", title: "Identité du demandeur", desc: "Renseignez vos coordonnées", type: 'fields', fields: [{label: "Prénom", req: true},{label: "Nom", req: true},{label: "Service / direction", req: true},{label: "Description de l'œuvre", req: true, type: 'textarea'}] },
      //  { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
     // ]}
   // }
 // }
};

// -----------------------------------------------------------------------------
// Fonctions utilitaires
// -----------------------------------------------------------------------------

// Vérifier le format de l'e-mail
function isValidEmailFormat(v) {
  const parts = v.trim().split('@');
  return parts.length === 2 && /^[^\s@]+$/.test(parts[0]) && /^[^\s@]+\.[^\s@]+$/.test(parts[1]);
}

// Obtenir le domaine de l'e-mail
function getDomain(email) {
  return email.trim().toLowerCase().split('@')[1] || '';
}

// Vérifier si le domaine est autorisé. Par défaut, le domaine attendu est
// culture.gouv.fr, et il peut être surchargé depuis la configuration du front.
function isAllowedDomain(email) {
  const allowedDomains = (window.ALLOWED_EMAIL_DOMAIN || 'culture.gouv.fr')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  return allowedDomains.includes(getDomain(email));
}

// Vérifier la force du mot de passe
function checkStrength() {
  const v = document.getElementById('su-pass').value;
  const segs = [
    document.getElementById('seg-1'),
    document.getElementById('seg-2'),
    document.getElementById('seg-3')
  ];
  segs.forEach(s => s.className = 'strength-seg');
  
  let score = 0;
  if (v.length >= 8) score++;
  if (/[A-Z]/.test(v) && /[0-9]/.test(v)) score++;
  if (v.length >= 12 && /[^A-Za-z0-9]/.test(v)) score++;
  
  const cls = score <= 1 ? 'on-weak' : score === 2 ? 'on-mid' : 'on-strong';
  for (let i = 0; i < Math.max(score, 1) && i < 3; i++) {
    segs[i].classList.add(cls);
  }
}

// Vérifier le domaine de l'e-mail (affichage)
function checkDomain() {
  const email = document.getElementById('su-email').value.trim();
  const feedback = document.getElementById('domain-feedback');
  
  if (!email || !isValidEmailFormat(email)) {
    feedback.innerHTML = '';
    return;
  }
  
  if (isAllowedDomain(email)) {
    feedback.innerHTML = '<span class="domain-badge domain-ok">' + icon('check') + 'Domaine autorisé</span>';
  } else {
    feedback.innerHTML = '<span class="domain-badge domain-bad">' + icon('x') + 'Domaine non autorisé</span>';
  }
}

// -----------------------------------------------------------------------------
// Authentification
// -----------------------------------------------------------------------------

function parseJsonResponse(response) {
  return response.text().then((text) => {
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (err) {
      console.warn('Réponse non JSON ignorée: ', text.slice(0, 160));
      return {};
    }
  });
}

// Vérifier l'authentification au chargement
async function checkAuth() {
  try {
    const response = await fetch('/api/auth/me');
    const data = await parseJsonResponse(response);

    if (response.ok && data.authenticated) {
      currentUser = data;
      showAuthenticatedUI();
      renderSuiviLists();
    } else {
      currentUser = null;
      showUnauthenticatedUI();
    }
  } catch (err) {
    console.error('Erreur auth: ', err);
    currentUser = null;
    showUnauthenticatedUI();
  }
}

// Afficher l'UI connectée
function showAuthenticatedUI() {
  document.getElementById('screen-connexion').style.display = 'none';
  document.getElementById('screen-accueil').style.display = 'block';
}

// Afficher l'UI non connectée
function showUnauthenticatedUI() {
  document.getElementById('screen-connexion').style.display = 'block';
  document.getElementById('screen-accueil').style.display = 'none';
}

function updateUIForAuthState() {
  if (currentUser) {
    showAuthenticatedUI();
    renderSuiviLists();
  } else {
    showUnauthenticatedUI();
  }
}

// Bypass authentification (TEMPORAIRE - phase de test, à retirer avant mise en prod)
async function bypassAuth() {
  try {
    const response = await fetch('/api/auth/bypass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // ⭐ Important pour envoyer les cookies
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[bypassAuth] Erreur :', error);
      alert(error.error || "Impossible d'activer le bypass.");
      return;
    }

    const { user } = await response.json();
    currentUser = user;
    updateUIForAuthState();
    alert("Bypass activé ! Vous êtes connecté en mode test.");
  } catch (err) {
    console.error('[bypassAuth] Erreur réseau :', err);
    alert("Erreur réseau. Vérifiez que le serveur est en ligne.");
  }
}

// Connexion
async function trySubmitLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEmail = document.getElementById('err-login-email');
  const errPass = document.getElementById('err-login-pass');
  
  let ok = true;
  if (!email || !isValidEmailFormat(email)) {
    errEmail.style.display = 'block';
    ok = false;
  } else {
    errEmail.style.display = 'none';
  }
  if (!pass) {
    errPass.style.display = 'block';
    ok = false;
  } else {
    errPass.style.display = 'none';
  }
  
  if (!ok) return;
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      currentUser = data.user;
      showAuthenticatedUI();
      renderSuiviLists();
    } else {
      alert(data.error || 'Erreur de connexion.');
    }
  } catch (err) {
    console.error('Erreur: ', err);
    alert('Erreur de connexion. Vérifiez votre connexion Internet.');
  }
}

// Mot de passe oublié
async function trySubmitForgot() {
  const email = document.getElementById('forgot-email').value.trim();
  const err = document.getElementById('err-forgot-email');
  
  if (!email || !isValidEmailFormat(email)) {
    err.style.display = 'block';
    return;
  }
  err.style.display = 'none';
  
  try {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showLoginView('forgot-success');
    } else {
      alert(data.error || 'Erreur.');
    }
  } catch (err) {
    console.error('Erreur: ', err);
    alert('Erreur. Vérifiez votre connexion Internet.');
  }
}

// Inscription
async function trySubmitSignup() {
  const firstname = document.getElementById('su-firstname').value.trim();
  const lastname = document.getElementById('su-lastname').value.trim();
  const email = document.getElementById('su-email').value.trim();
  const pass = document.getElementById('su-pass').value;
  const pass2 = document.getElementById('su-pass2').value;
  const errEmail = document.getElementById('err-su-email');
  const errPass = document.getElementById('err-su-pass');
  const errPass2 = document.getElementById('err-su-pass2');
  
  let ok = true;
  if (!email || !isValidEmailFormat(email)) {
    errEmail.style.display = 'block';
    ok = false;
  } else {
    errEmail.style.display = 'none';
  }
  if (pass.length < 8) {
    errPass.style.display = 'block';
    ok = false;
  } else {
    errPass.style.display = 'none';
  }
  if (pass !== pass2 || !pass2) {
    errPass2.style.display = 'block';
    ok = false;
  } else {
    errPass2.style.display = 'none';
  }
  if (!firstname || !lastname) ok = false;
  
  if (!ok) return;
  
  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: firstname, lastName: lastname, email, password: pass }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showLoginView('verify');
    } else {
      alert(data.error || 'Erreur lors de l\'inscription.');
    }
  } catch (err) {
    console.error('Erreur: ', err);
    alert('Erreur lors de l\'inscription. Vérifiez votre connexion Internet.');
  }
}

// Déconnexion
async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    showUnauthenticatedUI();
  } catch (err) {
    console.error('Erreur: ', err);
  }
}

// -----------------------------------------------------------------------------
// Gestion des formulaires
// -----------------------------------------------------------------------------

// Ouvrir un formulaire
function openForm(formKey) {
  currentFormKey = formKey;
  currentStep = 1;
  formData = {};
  
  document.getElementById('menu-view').style.display = 'none';
  document.getElementById('wizard-view').style.display = 'block';
  
  const cat = categoryForms[currentCategoryKey];
  document.getElementById('hero-title').textContent = cat.forms[formKey].title;
  document.getElementById('hero-sub').textContent = cat.title + ' · Formulaire de demande';
  document.getElementById('hero-back').style.display = 'flex';
  
  renderSteps();
  showStep(1);
}

// Retour au menu
function backToMenu() {
  document.getElementById('menu-view').style.display = 'block';
  document.getElementById('wizard-view').style.display = 'none';
  const cat = categoryForms[currentCategoryKey];
  document.getElementById('hero-title').textContent = cat ? cat.title : 'Catégorie';
  document.getElementById('hero-sub').textContent = 'Choisissez le formulaire correspondant à votre demande';
  document.getElementById('hero-back').style.display = 'none';
  renderCategoryMenu();
  currentFormKey = null;
}

function backToAccueil() {
  document.getElementById('wizard-view').style.display = 'none';
  document.getElementById('menu-view').style.display = 'block';
  currentFormKey = null;
  currentCategoryKey = null;
  showScreen('accueil');
}

// Ouvrir une catégorie
function openCategoryScreen(catKey, formKey) {
  currentCategoryKey = catKey;
  const cat = categoryForms[catKey];
  document.getElementById('hero-title').textContent = cat.title;
  
  if (formKey) {
    openForm(formKey);
  } else {
    renderCategoryMenu();
    backToMenu();
  }
}

// Obtenir le formulaire actuel
function getCurrentForm() {
  return categoryForms[currentCategoryKey].forms[currentFormKey];
}

// Soumettre un formulaire
async function submitForm() {
  const form = getCurrentForm();
  
  // Préparer les données
  const requestData = {
    categoryKey: currentCategoryKey,
    formKey: currentFormKey,
    title: form.title,
    data: formData,
  };
  
  try {
    const response = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Ajouter à la liste locale
      submittedRequests.unshift({
        id: data.request.id,
        ref: data.request.reference,
        title: form.title,
        category: categoryForms[currentCategoryKey].title,
        date: new Date().toLocaleDateString('fr-FR'),
        status: data.request.status,
      });
      
      // Afficher le succès
      document.getElementById('wz-main').innerHTML = `
        <div class="wz-success">
          <div class="wz-success-icon">${icon('check')}</div>
          <div class="wz-success-title">Demande envoyée</div>
          <div class="wz-success-text">Votre demande « ${form.title} » a été transmise.</div>
          <div class="wz-success-ref">Référence : <strong>${data.request.reference}</strong></div>
          <button class="wz-btn-primary" style="margin-top: 18px;" onclick="backToAccueil()">Retour à l'accueil</button>
        </div>
      `;
      document.getElementById('wz-footer').style.display = 'none';
      renderSuiviLists();
    } else {
      alert(data.error || 'Erreur lors de l\'envoi.');
    }
  } catch (err) {
    console.error('Erreur: ', err);
    alert('Erreur de connexion.');
  }
}

// Charger les demandes
async function renderSuiviLists() {
  if (!currentUser) {
    submittedRequests = Array.isArray(sampleRequests) ? sampleRequests : [];
  } else {
    try {
      const response = await fetch('/api/requests');
      const data = await parseJsonResponse(response);

      if (response.ok && Array.isArray(data.requests)) {
        submittedRequests = data.requests.map(r => ({
          id: r.id,
          ref: r.reference,
          title: r.title,
          category: r.category_key,
          date: new Date(r.created_at).toLocaleDateString('fr-FR'),
          status: r.status,
        }));
      } else {
        submittedRequests = Array.isArray(sampleRequests) ? sampleRequests : [];
      }
    } catch (err) {
      console.error('Erreur: ', err);
      submittedRequests = Array.isArray(sampleRequests) ? sampleRequests : [];
    }
  }

  const enCoursList = document.getElementById('suivi-en-cours-list');
  const enCoursEmpty = document.getElementById('suivi-en-cours-empty');
  const termineesList = document.getElementById('suivi-terminees-list');
  const termineesEmpty = document.getElementById('suivi-terminees-empty');
  
  const enCours = submittedRequests.filter(r => r.status === 'brouillon' || r.status === 'en_cours');
  const terminees = submittedRequests.filter(r => r.status === 'traitee' || r.status === 'annulee' || r.status === 'rejetee');
  
  enCoursList.innerHTML = enCours.map(renderSuiviCard).join('');
  enCoursEmpty.style.display = enCours.length === 0 ? 'block' : 'none';
  
  termineesList.innerHTML = terminees.map(renderSuiviCard).join('');
  termineesEmpty.style.display = terminees.length === 0 ? 'block' : 'none';
}

// Rendre une carte de suivi
function renderSuiviCard(r) {
  const st = statusLabels[r.status];
  const isDraft = r.status === 'brouillon';
  return `<div class="suivi-card">
    <div class="suivi-card-icon">${icon(isDraft ? 'filePencil' : 'fileText')}</div>
    <div class="suivi-card-main">
      <div class="suivi-card-title">${r.title}</div>
      <div class="suivi-card-meta">${r.category} · Réf. ${r.ref} · ${r.date}</div>
    </div>
    <div class="suivi-card-right">
      <span class="suivi-status ${st.cls}">${st.label}</span>
      ${isDraft ? `<button class="suivi-card-action" onclick="alert('Reprendre le brouillon ${r.ref}')">Reprendre</button>` : `<button class="suivi-card-action" onclick="alert('Détail de la demande ${r.ref}')">Détail</button>`}
    </div>
  </div>`;
}

// -----------------------------------------------------------------------------
// Rendu des catégories et formulaires
// -----------------------------------------------------------------------------

// Rendre les catégories
function renderCategories(filterText) {
  const grid = document.getElementById('cat-grid');
  const noResults = document.getElementById('no-results');
  const q = (filterText || '').trim().toLowerCase();
  let visibleCount = 0;
  let html = '';
  
  categoryMeta.forEach((meta) => {
    const cat = categoryForms[meta.key];
    const allFormKeys = Object.keys(cat.forms);
    let matchingKeys = allFormKeys;
    let catMatches = true;
    
    if (q) {
      const catNameMatch = cat.title.toLowerCase().includes(q);
      matchingKeys = allFormKeys.filter(k => cat.forms[k].title.toLowerCase().includes(q));
      catMatches = catNameMatch || matchingKeys.length > 0;
      if (catNameMatch) matchingKeys = allFormKeys;
    }
    
    if (!catMatches) return;
    visibleCount++;
    const isOpen = q && matchingKeys.length > 0;
    
    html += `<div class="cat-card ${isOpen ? 'open' : ''}" id="cat-${meta.key}">
      <div class="cat-header" onclick="toggleCat('${meta.key}')">
        <div class="cat-header-left">
          <div class="cat-icon" style="background: ${meta.bg};color: ${meta.fg};">${icon(meta.icon)}</div>
          <div class="cat-name">${cat.title}</div>
        </div>
        <span class="svg-icon chevron">${icon('chevronDown')}</span>
      </div>
      <div class="cat-body">
        ${matchingKeys.map(k => {
          const f = cat.forms[k];
          return `<div class="form-item" onclick="event.stopPropagation(); handleFormClick('${meta.key}', '${k}')">
            <span>${f.title}</span>
            <span class="form-item-steps">${f.steps.length} étape${f.steps.length > 1 ? 's' : ''}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  });
  
  grid.innerHTML = html;
  grid.style.display = visibleCount === 0 ? 'none' : 'grid';
  noResults.style.display = visibleCount === 0 ? 'block' : 'none';
}

// Basculer une catégorie
function toggleCat(key) {
  document.getElementById('cat-' + key).classList.toggle('open');
}

// Filtrer les catégories
function filterCategories() {
  renderCategories(document.getElementById('search-input').value);
}

// Alias attendu par le bouton de recherche du HTML
function filterCategoriesReal() {
  filterCategories();
}

// Gérer le clic sur un formulaire
function handleFormClick(catKey, formKey) {
  if (categoryForms[catKey] && categoryForms[catKey].forms[formKey]) {
    openCategoryScreen(catKey, formKey);
  } else {
    alert('Ce formulaire n\'est pas encore construit.');
  }
}

// Rendre le menu des formulaires d'une catégorie
function renderCategoryMenu() {
  const cat = categoryForms[currentCategoryKey];
  const grid = document.getElementById('form-menu-grid');
  
  grid.innerHTML = Object.keys(cat.forms).map(key => {
    const f = cat.forms[key];
    return `<div class="form-menu-item" onclick="openForm('${key}')">
      <div class="form-menu-icon">${icon(f.icon || 'fileText')}</div>
      <div class="form-menu-text">
        <div class="form-menu-name">${f.title}</div>
        <div class="form-menu-steps">${f.steps.length} étape${f.steps.length > 1 ? 's' : ''}</div>
      </div>
      <div class="form-menu-arrow">${icon('chevronRight')}</div>
    </div>`;
  }).join('');
}

// -----------------------------------------------------------------------------
// Rendu des étapes et des champs de formulaire
// -----------------------------------------------------------------------------

// Rendre les étapes
function renderSteps() {
  const form = getCurrentForm();
  document.getElementById('wz-steps').innerHTML = form.steps.map((s, idx) => {
    const num = idx + 1;
    const state = num < currentStep ? 'done' : num === currentStep ? 'current' : '';
    const showLine = num < form.steps.length;
    return `<div class="wz-step ${state}" onclick="goToStep(${num})" style="position: relative;">
      <div class="wz-step-num">${num < currentStep ? icon('check') : num}</div>
      <div class="wz-step-label">${s.label}</div>
      ${showLine ? '<div class="wz-step-line"></div>' : ''}
    </div>`;
  }).join('');
}

// Rendre le contenu d'une étape
function renderStepContent(stepIdx) {
  const form = getCurrentForm();
  const s = form.steps[stepIdx - 1];
  let inner = '';
  
  if (s.type === 'checklist') {
    inner = renderChecklistHtml(s.items, stepIdx);
  } else if (s.type === 'fields') {
    inner = renderFieldsHtml(s.fields, stepIdx);
  } else if (s.type === 'mixed') {
    inner = (s.radio ? renderRadioHtml(s.radio, stepIdx) : '') + (s.fields ? renderFieldsHtml(s.fields, stepIdx) : '');
  } else if (s.type === 'summary') {
    inner = renderSummaryHtml();
  } else if (s.type === 'fixed') {
    inner = `<div class="wz-fixed-content">${s.content || ''}</div>`;
  } else if (s.type === 'file-upload') {
    inner = renderFileUploadHtml(s, stepIdx);
  }
  
  return `<div class="wz-step-header">
    <div class="wz-step-title">${s.title}</div>
    <div class="wz-step-desc">${s.desc}</div>
  </div>${inner}`;
}

// Afficher une étape
function showStep(n) {
  const form = getCurrentForm();
  document.getElementById('wz-main').innerHTML = renderStepContent(n);
  document.getElementById('wz-progress').textContent = `Étape ${n} sur ${form.steps.length}`;
  document.getElementById('btn-prev').disabled = (n === 1);
  const btnNext = document.getElementById('btn-next');
  btnNext.textContent = n === form.steps.length ? 'Envoyer la demande' : 'Suivant →';
  document.getElementById('wz-footer').style.display = 'flex';
  renderSteps();
}

// Aller à une étape
function goToStep(n) {
  saveCurrentStepData(currentStep);
  if (n <= currentStep || n === currentStep + 1) {
    currentStep = n;
    showStep(currentStep);
  }
}

// Sauvegarder les données de l'étape actuelle
function saveCurrentStepData(stepIdx) {
  const form = getCurrentForm();
  const s = form.steps[stepIdx - 1];
  if (!s) return;
  
  if (s.type === 'fields' || s.type === 'mixed') {
    document.querySelectorAll(`.wz-input[data-step="${stepIdx}"]`).forEach(input => {
      formData[stepIdx + '-field-' + input.dataset.field] = input.value;
    });
  }
  
  if (s.type === 'mixed' && s.radio) {
    const selected = document.querySelector(`.wz-radio-row[data-step="${stepIdx}"] .wz-radio-item.selected`);
    formData[stepIdx + '-radio'] = selected ? selected.textContent.trim() : '';
  }
  
  if (s.type === 'checklist') {
    const checked = Array.from(document.querySelectorAll(`.wz-check-group[data-step="${stepIdx}"] .wz-check-item.checked`)).map(el => el.textContent.trim());
    formData[stepIdx + '-checklist'] = checked;
  }
  if (s.type === 'file-upload') {
    const fileList = document.querySelector(`.wz-file-list[data-step="${stepIdx}"]`);
    if (fileList) {
      const files = [];
      fileList.querySelectorAll('.wz-file-item').forEach(item => {
        const fileData = {
          name: item.dataset.filename,
          size: item.dataset.filesize,
          type: item.dataset.filetype
        };
        files.push(fileData);
      });
      formData[stepIdx + '-files'] = files;
    }
  }
}

// Étape suivante
function nextStep() {
  const form = getCurrentForm();
  saveCurrentStepData(currentStep);
  if (currentStep === form.steps.length) {
    submitForm();
    return;
  }
  currentStep++;
  showStep(currentStep);
}

// Étape précédente
function prevStep() {
  if (currentStep > 1) {
    saveCurrentStepData(currentStep);
    currentStep--;
    showStep(currentStep);
  }
}

// Basculer une case à cocher
function toggleCheck(el) {
  el.classList.toggle('checked');
}

// Sélectionner une option radio
function selectRadio(el) {
  const row = el.parentElement;
  row.querySelectorAll('.wz-radio-item').forEach(item => item.classList.remove('selected'));
  el.classList.add('selected');
}

// -----------------------------------------------------------------------------
// Fonctions de rendu HTML
// -----------------------------------------------------------------------------

// Rendre les champs de formulaire
function renderFieldsHtml(fields, stepIdx) {
  return fields.map((f, fi) => {
    if (f.type === 'textarea') {
      return `<div class="wz-field">
        <label class="wz-field-label">${f.label} ${f.req ? '<span class="req">*</span>' : ''}</label>
        <textarea class="wz-input" data-step="${stepIdx}" data-field="${fi}" rows="3" style="resize: vertical;"></textarea>
      </div>`;
    }
    return `<div class="wz-field">
      <label class="wz-field-label">${f.label} ${f.req ? '<span class="req">*</span>' : ''}</label>
      <input class="wz-input" data-step="${stepIdx}" data-field="${fi}" type="${f.type || 'text'}" />
    </div>`;
  }).join('');
}

// Rendre les options radio
function renderRadioHtml(radio, stepIdx) {
  return `<div class="wz-field">
    <label class="wz-field-label">${radio.label} ${radio.req ? '<span class="req">*</span>' : ''}</label>
    <div class="wz-radio-row" data-step="${stepIdx}" data-radiogroup="true">
      ${radio.options.map(opt => `<div class="wz-radio-item" onclick="selectRadio(this)">${opt}</div>`).join('')}
    </div>
  </div>`;
}

// Rendre une checklist
function renderChecklistHtml(items, stepIdx) {
  return `<div class="wz-check-group" data-step="${stepIdx}">
    ${items.map(item => `<div class="wz-check-item" onclick="toggleCheck(this)">
      <div class="wz-checkbox"></div>${item}
    </div>`).join('')}
  </div>`;
}

// Rendre le récapitulatif
function renderSummaryHtml() {
  const form = getCurrentForm();
  let html = '<div class="wz-summary-section"><div class="wz-summary-title">Récapitulatif</div>';
  
  form.steps.forEach((s, idx) => {
    if (s.type === 'summary') return;
    const stepNum = idx + 1;
    
    if (s.type === 'fields') {
      s.fields.forEach((f, fi) => {
        const val = formData[stepNum + '-field-' + fi] || '—';
        html += `<div class="wz-summary-row">
          <span class="wz-summary-key">${f.label}</span>
          <span class="wz-summary-val">${val}</span>
        </div>`;
      });
    } else if (s.type === 'checklist') {
      const checked = formData[stepNum + '-checklist'] || [];
      html += `<div class="wz-summary-row">
        <span class="wz-summary-key">${s.label}</span>
        <span class="wz-summary-val">${checked.length ? checked.join(', ') : 'Aucun'}</span>
      </div>`;
    } else if (s.type === 'mixed') {
      if (s.radio) {
        const val = formData[stepNum + '-radio'] || '—';
        html += `<div class="wz-summary-row">
          <span class="wz-summary-key">${s.radio.label}</span>
          <span class="wz-summary-val">${val}</span>
        </div>`;
      }
      if (s.fields && s.fields.length) {
        s.fields.forEach((f, fi) => {
          const val = formData[stepNum + '-field-' + fi] || '—';
          html += `<div class="wz-summary-row">
            <span class="wz-summary-key">${f.label}</span>
            <span class="wz-summary-val">${val}</span>
          </div>`;
        });
      }
    }
  });
  
  html += '</div><div class="wz-hint">En cliquant sur « Envoyer la demande », celle-ci sera transmise aux services concernés pour traitement.</div>';
  return html;
}

// -----------------------------------------------------------------------------
// Fonctions de compatibilité (pour les appels depuis le HTML)
// -----------------------------------------------------------------------------

// Afficher un écran (compatibilité avec l'ancien code)
function showScreen(name, btn) {
  const accueilScreen = document.getElementById('screen-accueil');
  const connexionScreen = document.getElementById('screen-connexion');

  if (accueilScreen) accueilScreen.style.display = 'none';
  if (connexionScreen) connexionScreen.style.display = 'none';

  if (name === 'accueil') {
    if (accueilScreen) accueilScreen.style.display = 'block';
    if (currentUser) {
      showAuthenticatedUI();
    } else {
      showUnauthenticatedUI();
    }
  } else if (name === 'connexion') {
    if (connexionScreen) connexionScreen.style.display = 'block';
    showUnauthenticatedUI();
  } else if (name === 'categorie') {
    if (accueilScreen) accueilScreen.style.display = 'block';
    if (currentUser) {
      showAuthenticatedUI();
    }
  }
}

// Afficher un onglet de l'accueil (compatibilité)
function showAccueilTab(tab) {
  document.getElementById('tab-accueil').classList.toggle('active', tab === 'accueil');
  document.getElementById('tab-suivi').classList.toggle('active', tab === 'suivi');
  document.getElementById('accueil-tab-view').style.display = tab === 'accueil' ? 'block' : 'none';
  document.getElementById('suivi-tab-view').style.display = tab === 'suivi' ? 'block' : 'none';
  if (tab === 'suivi') renderSuiviLists();
}

// Afficher une vue de connexion (compatibilité)
function showLoginView(name) {
  document.querySelectorAll('.login-view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
}

// Alias pour compatibilité avec le HTML
function showLoginViewReal(name) {
  showLoginView(name);
}

// -----------------------------------------------------------------------------
// Initialisation
// -----------------------------------------------------------------------------

function initApp() {
  renderCategories('');
  checkAuth();

  const bypassBtn = document.getElementById('bypass-auth-btn');
  if (bypassBtn) {
    bypassBtn.addEventListener('click', bypassAuth);
  }
}

// Au chargement de la page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp, { once: true });
} else {
  initApp();
}
