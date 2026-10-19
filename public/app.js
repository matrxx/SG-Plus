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
let uploadedFiles = {};      // fichiers déposés par étape : { [étape]: [{ id, name, size }] }
let uploadsInProgress = 0;   // dépôts en cours (bloque l'avancement)
let submittingForm = false;  // envoi en cours (anti double-clic)

const statusLabels = {
  brouillon: { label: 'Brouillon', cls: 'status-brouillon' },
  en_cours: { label: 'En cours', cls: 'status-encours' },
  en_attente_validation: { label: 'En attente de validation', cls: 'status-encours' },
  validee_responsable: { label: 'Validée par le responsable', cls: 'status-traitee' },
  transmise_budget: { label: 'Transmise au service budget', cls: 'status-traitee' },
  traitee: { label: 'Traitée', cls: 'status-traitee' },
  annulee: { label: 'Annulée', cls: 'status-annulee' },
  rejetee: { label: 'Rejetée', cls: 'status-rejetee' },
};

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
  Budgets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
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
  { key: 'menage', icon: 'spray', bg: '#F4C0D1', fg: '#72243E' },
  { key: 'intervention-technique', icon: 'tool', bg: '#FAC775', fg: '#633806' },
  { key: 'acces-sites', icon: 'badge', bg: '#85B7EB', fg: '#042C53' },
  { key: 'livraison-envoi', icon: 'truck', bg: '#F0997B', fg: '#4A1B0C' },
  { key: 'equipements-bureau', icon: 'desk', bg: '#5DCAA5', fg: '#04342C' },
  { key: 'vehicule', icon: 'car', bg: '#AFA9EC', fg: '#26215C' },
  { key: 'evenementiel', icon: 'confetti', bg: '#ED93B1', fg: '#4B1528' },
 //  { key: 'oeuvres-art', icon: 'palette', bg: '#97C459', fg: '#173404' }
];
// Les catégories et formulaires sont définis dans forms-data.js (global categoryForms).

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
  const allowedDomains = ['culture.gouv.fr', ...(window.ALLOWED_EMAIL_DOMAIN || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, '').replace(/\.$/, ''))
    .filter(Boolean)];

  return [...new Set(allowedDomains)].includes(getDomain(email).replace(/\.$/, ''));
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
      console.warn('Réponse non JSON ignorée:', text.slice(0, 160));
      return {};
    }
  });
}

// Lecture stricte d'une réponse de l'API d'authentification. Si le corps n'est
// pas du JSON, la page n'est pas servie par le serveur Node (ex. Apache/XAMPP
// qui renvoie une page 404 HTML) : on le signale clairement à l'utilisateur
// au lieu d'un faux "vérifiez votre connexion Internet".
async function readApiJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    const e = new Error('API_UNREACHABLE');
    e.status = response.status;
    throw e;
  }
}

function describeApiError(err, fallback) {
  if (err && err.message === 'API_UNREACHABLE') {
    return "Le serveur Nestor-C2 ne répond pas à cette adresse. Ouvrez l'application via le serveur Node (par défaut http://localhost:3000) et non via un autre serveur web.";
  }
  if (err instanceof TypeError) {
    return "Impossible de joindre le serveur Nestor-C2. Vérifiez qu'il est démarré (npm start) et que vous utilisez la bonne adresse.";
  }
  return fallback;
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
    console.error('Erreur auth:', err);
    currentUser = null;
    showUnauthenticatedUI();
  }
}

// Libellés des rôles affichés dans l'en-tête
const roleLabels = { agent: 'Agent', validator: 'Valideur', valideur: 'Valideur', admin: 'Administrateur', superAdmin: 'SuperAdmin' };

// En-tête : identité de l'utilisateur connecté (nom si connu, sinon e-mail)
function renderHeaderUser() {
  const nameEl = document.getElementById('user-name');
  const roleEl = document.getElementById('user-role');
  if (!nameEl || !roleEl || !currentUser) return;
  const fullName = [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ').trim();
  nameEl.textContent = fullName || currentUser.email || '';
  roleEl.textContent = roleLabels[currentUser.role] || '';
}

// Afficher l'UI connectée
function showAuthenticatedUI() {
  document.getElementById('screen-connexion').style.display = 'none';
  document.getElementById('screen-accueil').style.display = 'block';
  document.getElementById('app-header').style.display = 'block';
  renderHeaderUser();
  setAdminPanelVisibility();
}

// Afficher l'UI non connectée
function showUnauthenticatedUI() {
  document.getElementById('screen-connexion').style.display = 'block';
  document.getElementById('screen-accueil').style.display = 'none';
  document.getElementById('screen-categorie').style.display = 'none';
  document.getElementById('app-header').style.display = 'none';
  setAdminPanelVisibility(false);
  selectTab('accueil'); // le prochain utilisateur repart toujours de l'accueil
}

// Le bouton "Administration" existe pour un superAdmin (tout) et pour un admin
// simple (liste des comptes, désactivation / réactivation seulement) ; la vue
// elle-même ne s'affiche qu'au clic sur l'onglet (voir showAccueilTab).
function isSuperAdminUser() {
  return !!(currentUser && currentUser.role === 'superAdmin');
}
function isStaffUser() {
  return !!(currentUser && (currentUser.role === 'superAdmin' || currentUser.role === 'admin'));
}

function setAdminPanelVisibility(forceVisible) {
  const toggle = document.getElementById('admin-panel-toggle');
  const panel = document.getElementById('admin-panel');
  const staff = isStaffUser();
  const shouldShow = typeof forceVisible === 'boolean' ? forceVisible : staff;

  if (toggle) toggle.style.display = shouldShow ? 'inline-flex' : 'none';
  if (!shouldShow) {
    if (panel) panel.style.display = 'none';
    if (toggle) toggle.classList.remove('active');
  }

  if (shouldShow && staff) {
    // Un admin simple ne voit que les comptes : ni création, ni onglet Demandes.
    const superAdmin = isSuperAdminUser();
    const createCard = document.getElementById('admin-create-card');
    const tabs = document.getElementById('admin-section-tabs');
    const subtitle = document.getElementById('admin-panel-subtitle');
    if (createCard) createCard.style.display = superAdmin ? '' : 'none';
    if (tabs) tabs.style.display = superAdmin ? '' : 'none';
    if (subtitle) subtitle.textContent = superAdmin ? 'Gestion des comptes et du traitement des demandes' : 'Gestion des comptes : désactivation et réactivation';
    if (!superAdmin) {
      // Vue "Comptes" uniquement (l'onglet Demandes pourrait être resté ouvert par un précédent superAdmin).
      const usersSection = document.getElementById('admin-users-section');
      const requestsSection = document.getElementById('admin-requests-section');
      if (usersSection) usersSection.style.display = 'grid';
      if (requestsSection) requestsSection.style.display = 'none';
    }
    renderAdminUsers();
    if (superAdmin) renderAdminRequests();
  }
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

let adminUsersCache = [];

async function renderAdminUsers() {
  if (!isStaffUser()) return;
  const superAdmin = isSuperAdminUser();

  try {
    const response = await fetch('/api/admin/users');
    const data = await parseJsonResponse(response);

    const list = document.getElementById('admin-user-list');
    if (!list) return;

    if (!response.ok || !Array.isArray(data.users)) {
      list.innerHTML = '<div class="admin-empty-state">Impossible de charger les comptes.</div>';
      return;
    }

    adminUsersCache = data.users;
    if (data.users.length === 0) {
      list.innerHTML = '<div class="admin-empty-state">Aucun compte enregistré.</div>';
      return;
    }

    list.innerHTML = data.users.map(user => {
      const roleKey = (user.role || 'agent').toLowerCase();
      const roleClass = roleKey === 'validator' || roleKey === 'valideur' ? 'role-validator' : roleKey === 'admin' ? 'role-admin' : roleKey === 'superadmin' ? 'role-superadmin' : 'role-agent';
      const roleText = roleKey === 'validator' || roleKey === 'valideur' ? 'Valideur' : roleKey === 'admin' ? 'Admin' : roleKey === 'superadmin' ? 'SuperAdmin' : 'Agent';
      const statusKey = (user.status || 'active').toLowerCase();
      const statusClass = statusKey === 'expired' ? 'status-expired' : statusKey === 'pending' ? 'status-pending' : statusKey === 'disabled' ? 'status-disabled' : 'status-active';
      const statusText = statusKey === 'expired' ? 'Expiré' : statusKey === 'pending' ? 'En attente' : statusKey === 'disabled' ? 'Désactivé' : 'Actif';
      const isExpired = !!user.is_expired;
      const isSelf = !!currentUser && String(user.email).toLowerCase() === String(currentUser.email || '').toLowerCase();
      // Admin simple : agents et valideurs uniquement. Jamais sur son propre compte.
      const manageable = !isSelf && (superAdmin || roleKey === 'agent' || roleKey === 'validator' || roleKey === 'valideur');
      const canToggle = manageable && (statusKey === 'active' || statusKey === 'disabled');
      const canDelete = superAdmin && !isSelf;

      return `
        <div class="admin-user-item">
          <div class="admin-user-header">
            <div>
              <div class="admin-user-name">${escapeHtml((user.first_name || '').trim() || '-')} ${escapeHtml((user.last_name || '').trim() || '')}${isSelf ? ' <span class="admin-self">(vous)</span>' : ''}</div>
              <div class="admin-user-email">${escapeHtml(user.email)}</div>
            </div>
            <div class="admin-user-actions">
              ${canToggle ? (statusKey === 'active'
                ? `<button class="admin-toggle-btn" type="button" data-onclick="setAdminUserStatus(${Number(user.id)}, 'disabled')">Désactiver</button>`
                : `<button class="admin-toggle-btn" type="button" data-onclick="setAdminUserStatus(${Number(user.id)}, 'active')">Réactiver</button>`) : ''}
              ${canDelete ? `<button class="admin-delete-btn" type="button" data-onclick="deleteAdminUser(${Number(user.id)})">Supprimer</button>` : ''}
            </div>
          </div>
          <div class="admin-user-meta">
            <span class="admin-badge ${roleClass}">${roleText}</span>
            <span class="admin-badge ${statusClass}">${statusText}</span>
            ${isExpired && statusKey !== 'expired' ? '<span class="admin-badge status-expired">Expiré</span>' : ''}
          </div>
          ${superAdmin ? `
          <div class="admin-user-edit">
            <input type="text" id="admin-edit-firstname-${user.id}" value="${escapeHtml(user.first_name)}" aria-label="Prénom">
            <input type="text" id="admin-edit-lastname-${user.id}" value="${escapeHtml(user.last_name)}" aria-label="Nom">
            <input type="email" id="admin-edit-email-${user.id}" value="${escapeHtml(user.email)}" aria-label="E-mail">
            <select id="admin-edit-role-${user.id}" aria-label="Rôle">
              <option value="agent" ${roleKey === 'agent' ? 'selected' : ''}>Agent</option>
              <option value="validator" ${roleKey === 'validator' || roleKey === 'valideur' ? 'selected' : ''}>Valideur</option>
              <option value="admin" ${roleKey === 'admin' ? 'selected' : ''}>Administrateur</option>
              <option value="superAdmin" ${roleKey === 'superadmin' ? 'selected' : ''}>SuperAdmin</option>
            </select>
            <select id="admin-edit-status-${user.id}" aria-label="Statut">
              <option value="active" ${statusKey === 'active' ? 'selected' : ''}>Actif</option>
              <option value="pending" ${statusKey === 'pending' ? 'selected' : ''}>En attente</option>
              <option value="expired" ${statusKey === 'expired' ? 'selected' : ''}>Expiré</option>
              <option value="disabled" ${statusKey === 'disabled' ? 'selected' : ''}>Désactivé</option>
            </select>
            <button class="admin-save-btn" type="button" data-onclick="saveAdminUser(${Number(user.id)})">Enregistrer les modifications</button>
          </div>` : ''}
        </div>
      `;    }).join('');
  } catch (err) {
    console.error('[admin/users] Erreur de chargement :', err);
    const list = document.getElementById('admin-user-list');
    if (list) {
      list.innerHTML = '<div class="admin-empty-state">Impossible de charger les comptes.</div>';
    }
  }
}

async function saveAdminUser(userId) {
  const payload = {
    firstName: document.getElementById(`admin-edit-firstname-${userId}`).value.trim(),
    lastName: document.getElementById(`admin-edit-lastname-${userId}`).value.trim(),
    email: document.getElementById(`admin-edit-email-${userId}`).value.trim(),
    role: document.getElementById(`admin-edit-role-${userId}`).value,
    status: document.getElementById(`admin-edit-status-${userId}`).value,
  };

  try {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      alert(data.error || 'Modification impossible.');
      return;
    }
    await renderAdminUsers();
    alert(data.message || 'Compte modifié.');
  } catch (err) {
    console.error('[admin/update-user] Erreur :', err);
    alert('Erreur lors de la modification du compte.');
  }
}

async function renderAdminRequests() {
  if (!currentUser || currentUser.role !== 'superAdmin') return;

  const list = document.getElementById('admin-request-list');
  if (!list) return;

  try {
    const response = await fetch('/api/admin/requests');
    const data = await parseJsonResponse(response);
    if (!response.ok || !Array.isArray(data.requests)) {
      list.innerHTML = '<div class="admin-empty-state">Impossible de charger les demandes.</div>';
      return;
    }

    const filter = document.getElementById('admin-request-status-filter')?.value || 'all';
    const requests = data.requests.filter(request => filter === 'all' || request.status === filter);
    if (requests.length === 0) {
      list.innerHTML = '<div class="admin-empty-state">Aucune demande pour ce filtre.</div>';
      return;
    }

    // État de l'e-mail de notification : seuls les cas à traiter sont signalés
    const mailLabels = {
      pending: "E-mail en attente d'envoi",
      failed: "Échec de l'envoi de l'e-mail",
      not_configured: 'Aucun destinataire configuré',
      smtp_disabled: 'Envoi d\'e-mails non configuré',
    };

    list.innerHTML = requests.map(request => {
      const mailIssue = request.notification_status && request.notification_status !== 'sent';
      return `
      <div class="admin-request-item">
        <div>
          <div class="admin-request-title">${escapeHtml(request.title)}</div>
          <div class="admin-request-meta">${escapeHtml(request.reference || '-')} · ${escapeHtml(request.user_email || '-')} · ${request.created_at ? new Date(request.created_at).toLocaleDateString('fr-FR') : '-'}</div>
          ${mailIssue ? `<div class="admin-user-meta"><span class="admin-badge mail-warn">${escapeHtml(mailLabels[request.notification_status] || request.notification_status)}</span></div>` : ''}
        </div>
        <div class="admin-request-controls">
          ${mailIssue ? `<button class="admin-save-btn" type="button" data-onclick="resendNotification(${Number(request.id)})">Renvoyer l'e-mail</button>` : ''}
          <select class="admin-request-status" id="admin-request-status-${request.id}" aria-label="Statut de la demande">
            <option value="en_cours" ${request.status === 'en_cours' ? 'selected' : ''}>En cours</option>
            <option value="traitee" ${request.status === 'traitee' ? 'selected' : ''}>Traitée</option>
            <option value="rejetee" ${request.status === 'rejetee' ? 'selected' : ''}>Rejetée</option>
            <option value="annulee" ${request.status === 'annulee' ? 'selected' : ''}>Annulée</option>
          </select>
          <button class="admin-save-btn" type="button" data-onclick="saveAdminRequest(${request.id})">Enregistrer</button>
        </div>
      </div>
    `;
    }).join('');
  } catch (err) {
    console.error('[admin/requests] Erreur :', err);
    list.innerHTML = '<div class="admin-empty-state">Impossible de charger les demandes.</div>';
  }
}

async function saveAdminRequest(requestId) {
  const status = document.getElementById(`admin-request-status-${requestId}`).value;
  try {
    const response = await fetch(`/api/admin/requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      alert(data.error || 'Modification impossible.');
      return;
    }
    await renderAdminRequests();
  } catch (err) {
    console.error('[admin/update-request] Erreur :', err);
    alert('Erreur lors de la modification de la demande.');
  }
}

// Renvoie l'e-mail de notification d'une demande (adresse configurée après coup,
// incident SMTP passager…)
async function resendNotification(requestId) {
  try {
    const response = await fetch(`/api/admin/requests/${requestId}/resend-notification`, { method: 'POST' });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      alert(data.error || "Renvoi impossible.");
      return;
    }
    const messages = {
      sent: "L'e-mail a été envoyé.",
      not_configured: "Aucun destinataire n'est encore configuré pour ce formulaire (voir les variables MAIL_* du fichier .env).",
      smtp_disabled: "L'envoi d'e-mails n'est pas configuré sur le serveur (variables SMTP_*).",
      failed: `L'envoi a échoué : ${data.error || 'erreur du serveur de messagerie'}`,
    };
    alert(messages[data.notification] || 'Renvoi effectué.');
    await renderAdminRequests();
  } catch (err) {
    console.error('[admin/resend-notification] Erreur :', err);
    alert("Erreur lors du renvoi de l'e-mail.");
  }
}

function showAdminSection(section) {
  if (!currentUser || currentUser.role !== 'superAdmin') return;
  const usersSection = document.getElementById('admin-users-section');
  const requestsSection = document.getElementById('admin-requests-section');
  const usersTab = document.getElementById('admin-section-users-tab');
  const requestsTab = document.getElementById('admin-section-requests-tab');
  const showUsers = section === 'users';

  usersSection.style.display = showUsers ? 'grid' : 'none';
  requestsSection.style.display = showUsers ? 'none' : 'block';
  usersTab.classList.toggle('active', showUsers);
  requestsTab.classList.toggle('active', !showUsers);
  if (!showUsers) renderAdminRequests();
}

function refreshAdminData() {
  if (!isStaffUser()) return;
  renderAdminUsers();
  if (isSuperAdminUser()) renderAdminRequests();
}

// Désactiver / réactiver un compte (admin et superAdmin).
async function setAdminUserStatus(userId, status) {
  const user = adminUsersCache.find(u => Number(u.id) === Number(userId));
  const label = user ? user.email : 'ce compte';
  const question = status === 'disabled'
    ? `Désactiver le compte ${label} ?\n\nLa personne sera déconnectée et ne pourra plus se connecter. Ses demandes sont conservées ; vous pourrez réactiver le compte à tout moment.`
    : `Réactiver le compte ${label} ?`;
  if (!window.confirm(question)) return;

  try {
    const response = await fetch(`/api/admin/users/${Number(userId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      alert(data.error || 'Modification impossible.');
      return;
    }
    await renderAdminUsers();
  } catch (err) {
    console.error('[admin/user-status] Erreur :', err);
    alert('Erreur lors de la modification du compte.');
  }
}

// Suppression définitive (superAdmin) : emporte les demandes du compte.
async function deleteAdminUser(userId) {
  if (!userId || !isSuperAdminUser()) return;

  const user = adminUsersCache.find(u => Number(u.id) === Number(userId));
  const label = user ? user.email : 'ce compte';
  const count = user ? Number(user.request_count) || 0 : 0;
  const consequence = count > 0
    ? `Ses ${count} demande(s) et leurs pièces jointes seront aussi supprimées.`
    : 'Ce compte n\'a aucune demande.';
  const confirmed = window.confirm(`Supprimer DÉFINITIVEMENT le compte ${label} ?\n\n${consequence}\nCette action est irréversible. Pour seulement bloquer l'accès, utilisez « Désactiver ».`);
  if (!confirmed) return;

  try {
    const response = await fetch(`/api/admin/users/${Number(userId)}`, { method: 'DELETE' });
    const data = await parseJsonResponse(response);

    if (!response.ok) {
      alert(data.error || 'Suppression impossible.');
      return;
    }

    await renderAdminUsers();
    alert(data.message || 'Compte supprimé.');
  } catch (err) {
    console.error('[admin/delete-user] Erreur :', err);
    alert('Erreur lors de la suppression.');
  }
}
function toggleAdminPanel() {
  const panel = document.getElementById('admin-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function bindAdminForm() {
  const form = document.getElementById('admin-create-user-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      firstName: document.getElementById('admin-firstname').value.trim(),
      lastName: document.getElementById('admin-lastname').value.trim(),
      email: document.getElementById('admin-email').value.trim(),
      password: document.getElementById('admin-password').value,
      role: document.getElementById('admin-role').value,
    };

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await parseJsonResponse(response);

      if (!response.ok) {
        alert(data.error || 'Erreur lors de la création du compte.');
        return;
      }

      form.reset();
      await renderAdminUsers();
      alert(data.message || 'Compte créé avec succès.');
    } catch (err) {
      console.error('[admin/create-user] Erreur réseau :', err);
      alert('Erreur réseau lors de la création du compte.');
    }
  });
}

function updateUIForAuthState() {
  if (currentUser) {
    showAuthenticatedUI();
    renderSuiviLists();
  } else {
    showUnauthenticatedUI();
  }
}

// Mode test : le serveur indique s'il autorise le bouton « TEST » (ALLOW_TEST_BYPASS).
// Sans réponse positive, le bouton reste caché.
async function loadAuthConfig() {
  const box = document.getElementById('bypass-box');
  if (!box) return;
  try {
    const response = await fetch('/api/auth/config');
    const data = await readApiJson(response);
    box.style.display = response.ok && data.testBypass === true ? 'flex' : 'none';
  } catch (err) {
    box.style.display = 'none';
  }
}

// Connexion de test sans mot de passe (bouton « TEST »)
async function bypassAuth() {
  const button = document.getElementById('bypass-btn');
  if (button) button.disabled = true;
  try {
    const response = await fetch('/api/auth/bypass', { method: 'POST' });
    const data = await readApiJson(response);
    if (!response.ok) {
      alert(data.error || "Impossible d'ouvrir la session de test.");
      return;
    }
    currentUser = data.user;
    showAuthenticatedUI();
    renderSuiviLists();
  } catch (err) {
    console.error('Erreur:', err);
    alert(describeApiError(err, "Impossible d'ouvrir la session de test."));
  } finally {
    if (button) button.disabled = false;
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
  } else if (!isAllowedDomain(email)) {
    errEmail.textContent = 'Utilisez une adresse e-mail @culture.gouv.fr.';
    errEmail.style.display = 'block';
    ok = false;
  } else {
    errEmail.textContent = 'Veuillez saisir une adresse e-mail valide.';
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
    
    const data = await readApiJson(response);

    if (response.ok) {
      currentUser = data.user;
      showAuthenticatedUI();
      renderSuiviLists();
      setAdminPanelVisibility();
    } else {
      alert(data.error || 'Erreur de connexion.');
    }
  } catch (err) {
    console.error('Erreur:', err);
    alert(describeApiError(err, 'Erreur de connexion.'));
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
    
    const data = await readApiJson(response);

    if (response.ok) {
      showLoginView('forgot-success');
    } else {
      alert(data.error || 'Erreur.');
    }
  } catch (err) {
    console.error('Erreur:', err);
    alert(describeApiError(err, 'Erreur.'));
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
    
    const data = await readApiJson(response);

    if (response.ok) {
      showLoginView('verify');
    } else {
      alert(data.error || 'Erreur lors de l\'inscription.');
    }
  } catch (err) {
    console.error('Erreur:', err);
    alert(describeApiError(err, 'Erreur lors de l\'inscription.'));
  }
}

// Déconnexion
async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.error('Erreur:', err);
  }
  // Quoi qu'il arrive côté réseau, on referme la session dans l'interface
  // et on efface toute donnée de l'utilisateur précédent.
  currentUser = null;
  currentCategoryKey = null;
  currentFormKey = null;
  formData = {};
  uploadedFiles = {};
  submittedRequests = [];
  const pass = document.getElementById('login-pass');
  if (pass) pass.value = '';
  showLoginView('login');
  showUnauthenticatedUI();
}

// -----------------------------------------------------------------------------
// Gestion des formulaires
// -----------------------------------------------------------------------------

// Ouvrir un formulaire
function openForm(formKey) {
  currentFormKey = formKey;
  currentStep = 1;
  formData = {};
  uploadedFiles = {};

  document.getElementById('menu-view').style.display = 'none';
  document.getElementById('wizard-view').style.display = 'block';

  const cat = categoryForms[currentCategoryKey];
  const form = cat.forms[formKey];
  document.getElementById('hero-title').textContent = form.title;
  document.getElementById('hero-sub').textContent = cat.title + ' · Formulaire de demande';
  setHeroBack("Retour aux formulaires");

  // Message d'avertissement en haut du formulaire (propriété `notice`)
  const notice = document.getElementById('wz-notice');
  notice.textContent = form.notice || '';
  notice.style.display = form.notice ? 'block' : 'none';

  renderSteps();
  showStep(1);
}

// Bouton "retour" de l'en-tête : son libellé et son action dépendent de la vue
function setHeroBack(label) {
  document.getElementById('hero-back').style.display = 'flex';
  document.getElementById('hero-back-label').textContent = label;
}

function heroBack() {
  const wizardOpen = document.getElementById('wizard-view').style.display !== 'none';
  if (wizardOpen) backToMenu();
  else backToAccueil();
}

// Retour au menu
function backToMenu() {
  document.getElementById('menu-view').style.display = 'block';
  document.getElementById('wizard-view').style.display = 'none';
  const cat = categoryForms[currentCategoryKey];
  document.getElementById('hero-title').textContent = cat ? cat.title : 'Catégorie';
  document.getElementById('hero-sub').textContent = 'Choisissez le formulaire correspondant à votre demande';
  setHeroBack("Retour à l'accueil");
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
  showScreen('categorie');

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
  if (submittingForm) return; // évite les envois en double (double-clic)
  const form = getCurrentForm();

  // Préparer les données (le serveur reprend le titre depuis la définition)
  const requestData = {
    categoryKey: currentCategoryKey,
    formKey: currentFormKey,
    data: formData,
  };

  submittingForm = true;
  const nextBtn = document.getElementById('btn-next');
  nextBtn.disabled = true;
  nextBtn.textContent = 'Envoi en cours…';

  try {
    const response = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
    });

    const data = await readApiJson(response);

    if (response.ok) {
      uploadedFiles = {};
      const mailOk = data.notification === 'sent';
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
          <div class="wz-success-text">Votre demande « ${escapeHtml(form.title)} » a été transmise.</div>
          ${mailOk ? '' : '<div class="wz-hint">Votre demande est bien enregistrée, mais la notification par e-mail n\'a pas pu être envoyée immédiatement : elle sera retransmise par l\'administration.</div>'}
          <div class="wz-success-ref">Référence : <strong>${escapeHtml(data.request.reference)}</strong></div>
          <button type="button" class="wz-btn-primary" data-onclick="backToAccueil()">Retour à l'accueil</button>
        </div>
      `;
      document.getElementById('wz-footer').style.display = 'none';
      renderSuiviLists();
    } else {
      showStepError(data.error || 'Erreur lors de l\'envoi.');
    }
  } catch (err) {
    console.error('Erreur:', err);
    showStepError(describeApiError(err, 'Erreur de connexion.'));
  } finally {
    submittingForm = false;
    // Toujours réactiver le bouton (il serait sinon bloqué pour le formulaire
    // suivant) ; le libellé n'est remis que si le formulaire est encore affiché.
    nextBtn.disabled = false;
    if (document.getElementById('wz-footer').style.display !== 'none') {
      nextBtn.textContent = 'Envoyer la demande';
    }
  }
}

// Charger les demandes
async function renderSuiviLists() {
  if (!currentUser) {
    submittedRequests = [];
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
        submittedRequests = [];
      }
    } catch (err) {
      console.error('Erreur:', err);
      submittedRequests = [];
    }
  }

  const enCoursList = document.getElementById('suivi-en-cours-list');
  const enCoursEmpty = document.getElementById('suivi-en-cours-empty');
  const termineesList = document.getElementById('suivi-terminees-list');
  const termineesEmpty = document.getElementById('suivi-terminees-empty');
  
  const enCours = submittedRequests.filter(r => r.status === 'brouillon' || r.status === 'en_cours' || r.status === 'en_attente_validation' || r.status === 'validee_responsable');
  const terminees = submittedRequests.filter(r => r.status === 'transmise_budget' || r.status === 'traitee' || r.status === 'annulee' || r.status === 'rejetee');
  
  enCoursList.innerHTML = enCours.map(renderSuiviCard).join('');
  enCoursEmpty.style.display = enCours.length === 0 ? 'block' : 'none';
  
  termineesList.innerHTML = terminees.map(renderSuiviCard).join('');
  termineesEmpty.style.display = terminees.length === 0 ? 'block' : 'none';
}

// Rendre une carte de suivi
function categoryTitle(key) {
  return (categoryForms[key] && categoryForms[key].title) || key || '';
}

function renderSuiviCard(r) {
  const st = statusLabels[r.status] || { label: r.status || 'Inconnu', cls: 'status-brouillon' };
  const id = Number(r.id);
  return `<div class="suivi-card">
    <div class="suivi-card-icon">${icon('fileText')}</div>
    <div class="suivi-card-main">
      <div class="suivi-card-title">${escapeHtml(r.title)}</div>
      <div class="suivi-card-meta">${escapeHtml(categoryTitle(r.category))} · Réf. ${escapeHtml(r.ref)} · ${escapeHtml(r.date)}</div>
    </div>
    <div class="suivi-card-right">
      <span class="suivi-status ${st.cls}">${escapeHtml(st.label)}</span>
      <button type="button" class="suivi-card-action" data-onclick="showRequestDetail(${id})">Détail</button>
    </div>
  </div>`;
}

// Mise en forme lisible des données d'une demande (même logique que le serveur) :
// [{ title, rows: [{ label, value }] }], étapes inactives exclues.
function describeRequestData(form, data) {
  const isActive = (cond) => {
    if (!cond) return true;
    const expected = Array.isArray(cond.radio) ? cond.radio : [cond.radio];
    return expected.includes(data[cond.step + '-radio']);
  };
  const sections = [];
  form.steps.forEach((step, i) => {
    const index = i + 1;
    if (!isActive(step.when)) return;
    const rows = [];
    if (step.type === 'fields' || step.type === 'mixed') {
      if (step.radio) rows.push({ label: step.radio.label, value: data[index + '-radio'] || '—' });
      (step.fields || []).forEach((field, fi) => {
        if (!isActive(field.when)) return;
        rows.push({ label: field.label, value: data[`${index}-field-${fi}`] || '—' });
      });
    } else if (step.type === 'checklist') {
      const picked = data[index + '-checklist'] || [];
      rows.push({ label: step.label || step.title, value: picked.length ? picked.join(', ') : 'Aucun' });
    } else if (step.type === 'file-upload') {
      const files = data[index + '-files'] || [];
      rows.push({ label: step.label || step.title, files });
    } else {
      return;
    }
    if (rows.length) sections.push({ title: step.title || step.label, rows });
  });
  return sections;
}

function renderRequestSections(form, data) {
  return describeRequestData(form, data || {}).map((section) => `
    <div class="wz-summary-section">
      <div class="wz-summary-title">${escapeHtml(section.title)}</div>
      ${section.rows.map((row) => {
        const value = row.files
          ? (row.files.length
              ? row.files.map((f) => `<a href="/api/attachments/${encodeURIComponent(f.id)}" download>${escapeHtml(f.name)}</a> (${formatFileSize(Number(f.size) || 0)})`).join('<br>')
              : 'Aucun fichier')
          : escapeHtml(row.value);
        return `<div class="wz-summary-row"><span class="wz-summary-key">${escapeHtml(row.label)}</span><span class="wz-summary-val">${value}</span></div>`;
      }).join('')}
    </div>`).join('');
}

// Fenêtre de détail d'une demande
async function showRequestDetail(id) {
  const dialog = document.getElementById('detail-dialog');
  const title = document.getElementById('detail-title');
  const meta = document.getElementById('detail-meta');
  const body = document.getElementById('detail-body');
  title.textContent = 'Chargement…';
  meta.textContent = '';
  body.innerHTML = '';
  if (!dialog.open) dialog.showModal();

  try {
    const response = await fetch('/api/requests/' + encodeURIComponent(id));
    const data = await readApiJson(response);
    if (!response.ok) throw new Error(data.error || 'Demande introuvable.');

    const r = data.request;
    const st = statusLabels[r.status] || { label: r.status };
    const form = categoryForms[r.category_key] && categoryForms[r.category_key].forms[r.form_key];
    title.textContent = r.title;
    meta.textContent = `${categoryTitle(r.category_key)} · Réf. ${r.reference} · ${new Date(r.created_at).toLocaleDateString('fr-FR')} · ${st.label}`;
    body.innerHTML = form
      ? renderRequestSections(form, r.data)
      : '<p class="wz-hint">Le contenu de cette demande ne peut pas être affiché (formulaire retiré).</p>';
    if (r.status === 'rejetee' && r.rejected_reason) {
      body.insertAdjacentHTML('afterbegin', `<div class="wz-error">Motif du rejet : ${escapeHtml(r.rejected_reason)}</div>`);
    }
  } catch (err) {
    title.textContent = 'Détail indisponible';
    body.innerHTML = `<div class="wz-error">${escapeHtml(describeApiError(err, err.message))}</div>`;
  }
}

function closeRequestDetail() {
  const dialog = document.getElementById('detail-dialog');
  if (dialog && dialog.open) dialog.close();
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
      <div class="cat-header" role="button" tabindex="0" aria-expanded="${isOpen ? 'true' : 'false'}" aria-controls="cat-body-${meta.key}" data-onclick="toggleCat('${meta.key}')">
        <div class="cat-header-left">
          <div class="cat-icon">${icon(meta.icon)}</div>
          <div class="cat-info">
            <div class="cat-name">${cat.title}</div>
            <div class="cat-count">${allFormKeys.length} formulaire${allFormKeys.length > 1 ? 's' : ''}</div>
          </div>
        </div>
        <span class="svg-icon chevron">${icon('chevronDown')}</span>
      </div>
      <div class="cat-body" id="cat-body-${meta.key}">
        <div class="cat-body-inner">
        ${matchingKeys.map(k => {
          const f = cat.forms[k];
          return `<div class="form-item" role="button" tabindex="0" data-onclick="handleFormClick('${meta.key}', '${k}')">
            <span>${f.title}</span>
            <span class="form-item-steps">${stepCountLabel(f)}</span>
          </div>`;
        }).join('')}
        </div>
      </div>
    </div>`;
  });
  
  grid.innerHTML = html;
  grid.style.display = visibleCount === 0 ? 'none' : 'grid';
  noResults.style.display = visibleCount === 0 ? 'block' : 'none';
}

// Basculer une catégorie
function toggleCat(key) {
  // Une seule catégorie ouverte à la fois : ouvrir l'une ferme les autres.
  const card = document.getElementById('cat-' + key);
  const willOpen = !card.classList.contains('open');
  document.querySelectorAll('.cat-card.open').forEach((c) => c.classList.remove('open'));
  if (willOpen) card.classList.add('open');
  document.querySelectorAll('.cat-card .cat-header').forEach((h) => {
    h.setAttribute('aria-expanded', h.parentElement.classList.contains('open') ? 'true' : 'false');
  });
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
  const form = categoryForms[catKey] && categoryForms[catKey].forms[formKey];
  if (!form) {
    alert('Ce formulaire n\'est pas encore construit.');
  } else if (form.externalUrl) {
    openExternalForm(form);
  } else {
    openCategoryScreen(catKey, formKey);
  }
}

// Formulaire qui renvoie vers un service externe (ex. Proxyclick) : nouvel onglet
function openExternalForm(form) {
  window.open(form.externalUrl, '_blank', 'noopener,noreferrer');
}

// Clic dans le menu d'une catégorie (même règle qu'au clic depuis l'accueil)
function openMenuForm(formKey) {
  handleFormClick(currentCategoryKey, formKey);
}

// "3 étapes", "1 étape" ou "Lien externe"
function stepCountLabel(form) {
  if (form.externalUrl) return 'Lien externe';
  // Les étapes conditionnelles (when) ne s'additionnent pas : un parcours
  // en suit une seule (ex. "Badge" : demande OU modification OU perte).
  const n = form.steps.filter((s) => !s.when).length + (form.steps.some((s) => s.when) ? 1 : 0);
  return n + ' étape' + (n > 1 ? 's' : '');
}

// Rendre le menu des formulaires d'une catégorie
function renderCategoryMenu() {
  const cat = categoryForms[currentCategoryKey];
  const grid = document.getElementById('form-menu-grid');
  
  grid.innerHTML = Object.keys(cat.forms).map(key => {
    const f = cat.forms[key];
    return `<div class="form-menu-item" role="button" tabindex="0" data-onclick="openMenuForm('${key}')">
      <div class="form-menu-icon">${icon(f.icon || 'fileText')}</div>
      <div class="form-menu-text">
        <div class="form-menu-name">${f.title}</div>
        <div class="form-menu-steps">${stepCountLabel(f)}</div>
      </div>
      <div class="form-menu-arrow">${icon('chevronRight')}</div>
    </div>`;
  }).join('');
}

// -----------------------------------------------------------------------------
// Rendu des étapes et des champs de formulaire
// -----------------------------------------------------------------------------

// Une étape portant when: { step, radio } n'est active que si le choix de
// l'étape `step` correspond (ex. formulaire "Badge" : une étape par type de demande).
function stepIsActive(step) {
  if (!step.when) return true;
  const chosen = formData[step.when.step + '-radio'];
  const expected = Array.isArray(step.when.radio) ? step.when.radio : [step.when.radio];
  return expected.includes(chosen);
}

// Étapes actives, avec leur numéro d'origine (1..N) qui préfixe les clés de données
function getActiveSteps() {
  const form = getCurrentForm();
  return form.steps.map((step, i) => ({ step, index: i + 1 })).filter(({ step }) => stepIsActive(step));
}

function nextActiveIndex() {
  const next = getActiveSteps().find(({ index }) => index > currentStep);
  return next ? next.index : null;
}

function prevActiveIndex() {
  const previous = getActiveSteps().filter(({ index }) => index < currentStep).pop();
  return previous ? previous.index : null;
}

// Rendre les étapes
function renderSteps() {
  const active = getActiveSteps();
  document.getElementById('wz-steps').innerHTML = active.map(({ step, index }, pos) => {
    const state = index < currentStep ? 'done' : index === currentStep ? 'current' : '';
    const showLine = pos < active.length - 1;
    return `<div class="wz-step ${state}" role="button" tabindex="0"${state === 'current' ? ' aria-current="step"' : ''} data-onclick="goToStep(${index})">
      <div class="wz-step-num">${index < currentStep ? icon('check') : pos + 1}</div>
      <div class="wz-step-label">${step.label}</div>
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
  window.scrollTo(0, 0); // chaque étape commence en haut, titre visible sous l'en-tête
  document.getElementById('wz-footer').style.display = 'flex';
  // Le bouton a pu rester désactivé par un envoi précédent (submitForm)
  document.getElementById('btn-next').disabled = false;
  restoreStepData(n);
  renderSteps();
  refreshProgress();
}

// Compteur "Étape X sur N", bouton Précédent et libellé du bouton principal :
// recalculés aussi quand un choix radio active ou retire des étapes.
function refreshProgress() {
  const active = getActiveSteps();
  const position = active.findIndex(({ index }) => index === currentStep) + 1;
  document.getElementById('wz-progress').textContent = `Étape ${position} sur ${active.length}`;
  document.getElementById('btn-prev').disabled = prevActiveIndex() === null;
  document.getElementById('btn-next').textContent = nextActiveIndex() === null ? 'Envoyer la demande' : 'Suivant →';
}

// Réaffiche les valeurs déjà saisies quand on revient sur une étape
// (sinon elles seraient perdues, puis écrasées par du vide à la sauvegarde).
function restoreStepData(stepIdx) {
  document.querySelectorAll(`.wz-input[data-step="${stepIdx}"]`).forEach((input) => {
    const saved = formData[stepIdx + '-field-' + input.dataset.field];
    if (saved !== undefined) input.value = saved;
  });

  const savedRadio = formData[stepIdx + '-radio'];
  if (savedRadio) {
    document.querySelectorAll(`.wz-radio-row[data-step="${stepIdx}"] .wz-radio-item`).forEach((item) => {
      if (item.textContent.trim() === savedRadio) {
        item.classList.add('selected');
        item.setAttribute('aria-checked', 'true');
      }
    });
  }

  const savedChecks = formData[stepIdx + '-checklist'];
  if (Array.isArray(savedChecks)) {
    document.querySelectorAll(`.wz-check-group[data-step="${stepIdx}"] .wz-check-item`).forEach((item) => {
      if (savedChecks.includes(item.textContent.trim())) {
        item.classList.add('checked');
        item.setAttribute('aria-checked', 'true');
      }
    });
  }
}

// Contrôle des champs obligatoires d'une étape (après saveCurrentStepData).
// Renvoie un message d'erreur, ou '' si l'étape est valide.
function validateStep(stepIdx) {
  const form = getCurrentForm();
  const s = form.steps[stepIdx - 1];
  if (!s) return '';

  const missing = [];
  const checkField = (f, fi) => {
    const value = String(formData[stepIdx + '-field-' + fi] || '').trim();
    if (f.req && !value) missing.push(f.label);
    else if (value && f.type === 'email' && !isValidEmailFormat(value)) missing.push(f.label + ' (adresse e-mail invalide)');
  };

  if (s.type === 'fields' || s.type === 'mixed') (s.fields || []).forEach(checkField);
  if (s.type === 'mixed' && s.radio && s.radio.req && !formData[stepIdx + '-radio']) {
    missing.push(s.radio.label);
  }
  if (s.type === 'file-upload' && s.required && !(uploadedFiles[stepIdx] || []).length) {
    return `Merci d'ajouter au moins un fichier (« ${s.label} »).`;
  }
  if (s.type === 'file-upload' && uploadsInProgress > 0) {
    return "Un fichier est en cours d'envoi, merci de patienter quelques instants.";
  }

  return missing.length ? 'Merci de compléter : ' + missing.join(', ') + '.' : '';
}

function showStepError(message) {
  let box = document.getElementById('wz-step-error');
  if (!box) {
    box = document.createElement('div');
    box.id = 'wz-step-error';
    box.className = 'wz-error';
    box.setAttribute('role', 'alert');
    const main = document.getElementById('wz-main');
    main.insertBefore(box, main.firstChild);
  }
  box.textContent = message;
  // Sur un long formulaire, le message est en haut : on y amène l'utilisateur
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Aller à une étape (retour libre ; en avant, uniquement l'étape active suivante)
function goToStep(n) {
  saveCurrentStepData(currentStep);
  if (!getActiveSteps().some(({ index }) => index === n)) return;

  if (n > currentStep) {
    if (n !== nextActiveIndex()) return;
    const error = validateStep(currentStep);
    if (error) {
      showStepError(error);
      return;
    }
  }
  currentStep = n;
  showStep(currentStep);
}

// Sauvegarder les données de l'étape actuelle
function saveCurrentStepData(stepIdx) {
  const form = getCurrentForm();
  const s = form.steps[stepIdx - 1];
  if (!s) return;

  if (s.type === 'fields' || s.type === 'mixed') {
    document.querySelectorAll(`.wz-input[data-step="${stepIdx}"]`).forEach((input) => {
      formData[stepIdx + '-field-' + input.dataset.field] = input.value;
    });
  }

  if (s.type === 'mixed' && s.radio) {
    const selected = document.querySelector(`.wz-radio-row[data-step="${stepIdx}"] .wz-radio-item.selected`);
    formData[stepIdx + '-radio'] = selected ? selected.textContent.trim() : '';
  }

  if (s.type === 'checklist') {
    const checked = Array.from(document.querySelectorAll(`.wz-check-group[data-step="${stepIdx}"] .wz-check-item.checked`)).map((el) => el.textContent.trim());
    formData[stepIdx + '-checklist'] = checked;
  }

  if (s.type === 'file-upload') {
    formData[stepIdx + '-files'] = (uploadedFiles[stepIdx] || []).map((f) => ({ id: f.id, name: f.name, size: f.size }));
  }
}

// Étape suivante
function nextStep() {
  saveCurrentStepData(currentStep);
  const error = validateStep(currentStep);
  if (error) {
    showStepError(error);
    return;
  }
  const next = nextActiveIndex();
  if (next === null) {
    submitForm();
    return;
  }
  currentStep = next;
  showStep(currentStep);
}

// Étape précédente
function prevStep() {
  const previous = prevActiveIndex();
  if (previous !== null) {
    saveCurrentStepData(currentStep);
    currentStep = previous;
    showStep(currentStep);
  }
}

// Basculer une case à cocher
function toggleCheck(el) {
  el.classList.toggle('checked');
  el.setAttribute('aria-checked', el.classList.contains('checked') ? 'true' : 'false');
}

// Sélectionner une option radio
function selectRadio(el) {
  const row = el.parentElement;
  row.querySelectorAll('.wz-radio-item').forEach((item) => {
    item.classList.remove('selected');
    item.setAttribute('aria-checked', 'false');
  });
  el.classList.add('selected');
  el.setAttribute('aria-checked', 'true');
  // Un choix peut activer ou désactiver des étapes (formulaire "Badge") :
  // on enregistre et on rafraîchit la liste des étapes tout de suite.
  saveCurrentStepData(currentStep);
  renderSteps();
  refreshProgress();
}

// -----------------------------------------------------------------------------
// Fonctions de rendu HTML
// -----------------------------------------------------------------------------

// Rendre les champs de formulaire (texte, date, zone de texte, liste déroulante)
function renderFieldsHtml(fields, stepIdx) {
  return fields.map((f, fi) => {
    const label = `<label class="wz-field-label">${f.label} ${f.req ? '<span class="req">*</span>' : ''}</label>`;
    const attrs = `class="wz-input" data-step="${stepIdx}" data-field="${fi}"`;

    if (f.options) {
      return `<div class="wz-field">${label}
        <select ${attrs}>
          <option value="">— Choisir —</option>
          ${f.options.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')}
        </select>
      </div>`;
    }
    if (f.type === 'textarea') {
      return `<div class="wz-field">${label}
        <textarea ${attrs} rows="3" style="resize:vertical;"></textarea>
      </div>`;
    }
    return `<div class="wz-field">${label}
      <input ${attrs} type="${f.type || 'text'}" />
    </div>`;
  }).join('');
}

// Rendre les options radio
function renderRadioHtml(radio, stepIdx) {
  return `<div class="wz-field">
    <label class="wz-field-label">${radio.label} ${radio.req ? '<span class="req">*</span>' : ''}</label>
    <div class="wz-radio-row" role="radiogroup" data-step="${stepIdx}" data-radiogroup="true">
      ${radio.options.map((opt) => `<div class="wz-radio-item" role="radio" aria-checked="false" tabindex="0" data-onclick="selectRadio(this)">${opt}</div>`).join('')}
    </div>
  </div>`;
}

// Rendre une checklist
function renderChecklistHtml(items, stepIdx) {
  return `<div class="wz-check-group" data-step="${stepIdx}">
    ${items.map((item) => `<div class="wz-check-item" role="checkbox" aria-checked="false" tabindex="0" data-onclick="toggleCheck(this)">
      <div class="wz-checkbox"></div>${item}
    </div>`).join('')}
  </div>`;
}

// -----------------------------------------------------------------------------
// Pièces jointes : dépôt immédiat sur le serveur, rattachement à l'envoi
// -----------------------------------------------------------------------------

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' Ko';
  return (bytes / 1024 / 1024).toFixed(1) + ' Mo';
}

function renderFileListHtml(stepIdx) {
  const files = uploadedFiles[stepIdx] || [];
  return files.map((f) => `<div class="wz-file-item">
    <span class="wz-file-name">${escapeHtml(f.name)}</span>
    <span class="wz-file-size">${formatFileSize(f.size)}</span>
    <span class="wz-file-remove" role="button" tabindex="0" aria-label="Retirer le fichier" data-onclick="removeUploadedFile(${stepIdx}, '${f.id}')">✕</span>
  </div>`).join('');
}

function renderFileUploadHtml(step, stepIdx) {
  const maxMb = Math.round((step.max_file_size || 20971520) / 1048576);
  const formats = (step.allowed_formats || []).map((f) => f.toUpperCase()).join(', ');
  const multiple = step.max_files && step.max_files > 1;
  return `<div class="wz-file-upload-container">
    <div class="wz-file-upload-hint">Formats acceptés : ${formats} — ${maxMb} Mo maximum par fichier${step.max_files ? ' — ' + step.max_files + ' fichier' + (step.max_files > 1 ? 's' : '') + ' maximum' : ''}</div>
    <input type="file" class="wz-file-input" id="wz-file-input-${stepIdx}" ${multiple ? 'multiple' : ''} data-onchange="onFilePicked(this, ${stepIdx})" />
    <button type="button" class="wz-btn-ghost" data-onclick="pickFile(${stepIdx})">Ajouter un fichier</button>
    <div id="wz-file-status-${stepIdx}" class="wz-file-status" role="status"></div>
    <div class="wz-file-list" data-step="${stepIdx}" id="wz-file-list-${stepIdx}">${renderFileListHtml(stepIdx)}</div>
  </div>`;
}

function setFileStatus(stepIdx, message, isError) {
  const el = document.getElementById('wz-file-status-' + stepIdx);
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('is-error', !!isError);
}

function pickFile(stepIdx) {
  const input = document.getElementById('wz-file-input-' + stepIdx);
  if (input) input.click();
}

async function onFilePicked(input, stepIdx) {
  const step = getCurrentForm().steps[stepIdx - 1];
  const files = Array.from(input.files || []);
  input.value = '';
  if (files.length === 0) return;

  const maxBytes = step.max_file_size || 20971520;
  uploadedFiles[stepIdx] = uploadedFiles[stepIdx] || [];

  for (const file of files) {
    if (step.max_files && uploadedFiles[stepIdx].length >= step.max_files) {
      setFileStatus(stepIdx, `${step.max_files} fichier${step.max_files > 1 ? 's' : ''} maximum : retirez-en un pour en ajouter un autre.`, true);
      break;
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (step.allowed_formats && !step.allowed_formats.includes(ext)) {
      setFileStatus(stepIdx, `« ${file.name} » : format non accepté (${step.allowed_formats.join(', ')}).`, true);
      continue;
    }
    if (file.size > maxBytes) {
      setFileStatus(stepIdx, `« ${file.name} » dépasse ${Math.round(maxBytes / 1048576)} Mo.`, true);
      continue;
    }

    uploadsInProgress++;
    setFileStatus(stepIdx, `Envoi de « ${file.name} »…`, false);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/uploads', { method: 'POST', body });
      const data = await readApiJson(response);
      if (!response.ok) throw new Error(data.error || 'Dépôt du fichier impossible.');
      uploadedFiles[stepIdx].push(data.file);
      setFileStatus(stepIdx, '', false);
    } catch (err) {
      setFileStatus(stepIdx, describeApiError(err, err.message), true);
    } finally {
      uploadsInProgress--;
    }
    const list = document.getElementById('wz-file-list-' + stepIdx);
    if (list) list.innerHTML = renderFileListHtml(stepIdx);
  }
}

async function removeUploadedFile(stepIdx, fileId) {
  uploadedFiles[stepIdx] = (uploadedFiles[stepIdx] || []).filter((f) => f.id !== fileId);
  const list = document.getElementById('wz-file-list-' + stepIdx);
  if (list) list.innerHTML = renderFileListHtml(stepIdx);
  try {
    await fetch('/api/uploads/' + encodeURIComponent(fileId), { method: 'DELETE' });
  } catch (err) {
    console.warn('Suppression du dépôt impossible (il sera purgé automatiquement) :', err);
  }
}

// -----------------------------------------------------------------------------
// Récapitulatif et documents PDF / Word
// -----------------------------------------------------------------------------

function summaryRow(label, value) {
  return `<div class="wz-summary-row">
    <span class="wz-summary-key">${label}</span>
    <span class="wz-summary-val">${escapeHtml(value)}</span>
  </div>`;
}

// Rendre le récapitulatif (étapes actives uniquement)
function renderSummaryHtml() {
  const form = getCurrentForm();
  let html = '<div class="wz-summary-section"><div class="wz-summary-title">Récapitulatif</div>';

  getActiveSteps().forEach(({ step: s, index: stepNum }) => {
    if (s.type === 'summary' || s.type === 'fixed') return;

    if (s.type === 'checklist') {
      const checked = formData[stepNum + '-checklist'] || [];
      html += summaryRow(s.label, checked.length ? checked.join(', ') : 'Aucun');
    } else if (s.type === 'file-upload') {
      const files = uploadedFiles[stepNum] || [];
      html += summaryRow(s.label, files.length ? files.map((f) => f.name).join(', ') : 'Aucun fichier');
    } else if (s.type === 'fields' || s.type === 'mixed') {
      if (s.radio) html += summaryRow(s.radio.label, formData[stepNum + '-radio'] || '—');
      (s.fields || []).forEach((f, fi) => {
        html += summaryRow(f.label, formData[stepNum + '-field-' + fi] || '—');
      });
    }
  });

  html += '</div>';

  if (Array.isArray(form.documents) && form.documents.length) {
    const names = { pdf: 'PDF', docx: 'Word' };
    html += `<div class="wz-summary-section doc-panel">
      <div class="wz-summary-title">Document complété</div>
      <p class="wz-hint">Téléchargez la fiche remplie avec les informations ci-dessus.</p>
      <div class="doc-actions">
        ${form.documents.map((f) => `<button type="button" class="wz-btn-ghost" data-onclick="downloadDocument('${f}')">Télécharger en ${names[f] || f}</button>`).join('')}
      </div>
      <div class="doc-mail">
        <label class="doc-mail-label" for="doc-mail-to">Envoyer le document par e-mail</label>
        <input id="doc-mail-to" class="wz-input" type="email" autocomplete="off" placeholder="adresse.du.destinataire@exemple.fr" data-onenter="sendDocumentByEmail()" />
        <div class="doc-mail-formats">
          ${form.documents.map((f) => `<label><input type="checkbox" class="doc-mail-format" value="${f}" checked /> ${names[f] || f}</label>`).join('')}
        </div>
        <button type="button" class="wz-btn-primary" id="doc-mail-btn" data-onclick="sendDocumentByEmail()">Envoyer le document</button>
        <div id="doc-mail-status" class="doc-status" role="status"></div>
      </div>
    </div>`;
  }

  html += '<div class="wz-hint">En cliquant sur « Envoyer la demande », celle-ci sera transmise aux services concernés pour traitement.</div>';
  return html;
}

function setDocMailStatus(message, isError) {
  const el = document.getElementById('doc-mail-status');
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('is-error', !!isError);
  el.classList.toggle('is-ok', !isError && !!message);
}

// Envoie le(s) document(s) complété(s) à l'adresse saisie (champ libre)
async function sendDocumentByEmail() {
  const input = document.getElementById('doc-mail-to');
  const button = document.getElementById('doc-mail-btn');
  const to = input ? input.value.trim() : '';
  const formats = Array.from(document.querySelectorAll('.doc-mail-format:checked')).map((c) => c.value);

  if (!to || !isValidEmailFormat(to)) {
    setDocMailStatus("Saisissez une adresse e-mail valide pour le destinataire.", true);
    return;
  }
  if (formats.length === 0) {
    setDocMailStatus('Cochez au moins un format (PDF ou Word).', true);
    return;
  }

  button.disabled = true;
  setDocMailStatus('Envoi en cours…', false);
  try {
    const response = await fetch(`/api/forms/${encodeURIComponent(currentCategoryKey)}/${encodeURIComponent(currentFormKey)}/document/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, formats, data: formData }),
    });
    const data = await readApiJson(response);
    if (response.ok) {
      setDocMailStatus(data.message || 'Document envoyé.', false);
    } else {
      setDocMailStatus(data.error || "L'envoi a échoué.", true);
    }
  } catch (err) {
    setDocMailStatus(describeApiError(err, "L'envoi a échoué."), true);
  } finally {
    button.disabled = false;
  }
}

async function downloadDocument(format) {
  try {
    const response = await fetch(`/api/forms/${encodeURIComponent(currentCategoryKey)}/${encodeURIComponent(currentFormKey)}/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, data: formData }),
    });
    if (!response.ok) {
      const data = await readApiJson(response).catch(() => ({}));
      showStepError(data.error || 'Impossible de générer le document.');
      return;
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = /filename="?([^";]+)"?/.exec(disposition);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = match ? match[1] : 'document.' + format;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  } catch (err) {
    showStepError(describeApiError(err, 'Impossible de générer le document.'));
  }
}

// -----------------------------------------------------------------------------
// Fonctions de compatibilité (pour les appels depuis le HTML)
// -----------------------------------------------------------------------------

// Afficher un écran (compatibilité avec l'ancien code)
function showScreen(name, btn) {
  // Un seul écran visible à la fois : accueil, catégorie/formulaire ou connexion.
  ['accueil', 'categorie', 'connexion'].forEach((n) => {
    const el = document.getElementById('screen-' + n);
    if (el) el.style.display = 'none';
  });

  // Sans session, seul l'écran de connexion est accessible.
  if (!currentUser && name !== 'connexion') {
    showUnauthenticatedUI();
    return;
  }

  if (name === 'connexion') {
    showUnauthenticatedUI();
    return;
  }

  const target = document.getElementById('screen-' + name);
  if (target) target.style.display = 'block';
  if (name === 'accueil') setAdminPanelVisibility();
  window.scrollTo(0, 0); // un nouvel écran s'ouvre toujours en haut de page
}

// Afficher un onglet de l'accueil (compatibilité)
// Active un onglet (accueil | suivi | admin) : bouton + vue, sans appel réseau
function selectTab(tab) {
  const views = { accueil: 'accueil-tab-view', suivi: 'suivi-tab-view', admin: 'admin-panel' };
  const buttons = { accueil: 'tab-accueil', suivi: 'tab-suivi', admin: 'admin-panel-toggle' };
  Object.keys(views).forEach((key) => {
    const view = document.getElementById(views[key]);
    const button = document.getElementById(buttons[key]);
    if (view) view.style.display = key === tab ? 'block' : 'none';
    if (button) {
      button.classList.toggle('active', key === tab);
      if (key === tab) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  });
}

// Clic sur un onglet de la navigation principale
function showAccueilTab(tab) {
  if (tab === 'admin' && !isStaffUser()) tab = 'accueil';
  // Depuis un formulaire ouvert, un onglet ramène d'abord à l'accueil
  if (document.getElementById('screen-categorie').style.display === 'block') backToAccueil();
  selectTab(tab);
  if (tab === 'suivi') renderSuiviLists();
  if (tab === 'admin') refreshAdminData();
  window.scrollTo(0, 0);
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

// Affiche la version/le build du serveur en bas à droite (diagnostic)
async function showBuildInfo() {
  const el = document.getElementById('build-info');
  if (!el) return;
  try {
    const info = await (await fetch('/api/health')).json();
    el.textContent = 'v' + info.version + ' · build ' + String(info.build || '?').replace('T', ' ').slice(0, 16);
  } catch (err) {
    el.textContent = 'serveur API injoignable (page non servie par Node ?)';
    el.classList.add('is-error');
  }
}

function initApp() {
  showBuildInfo();
  renderCategories('');
  bindAdminForm();
  checkAuth();
  loadAuthConfig();

  // Fenêtre de détail : un clic sur le fond sombre la referme (Échap fonctionne déjà)
  const detailDialog = document.getElementById('detail-dialog');
  if (detailDialog) {
    detailDialog.addEventListener('click', (event) => {
      if (event.target === detailDialog) detailDialog.close();
    });
  }
}

// Au chargement de la page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp, { once: true });
} else {
  initApp();
}
