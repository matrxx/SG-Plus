// Routage des e-mails : à qui est envoyée chaque demande.
//
// Les adresses se règlent dans .env (une ou plusieurs, séparées par des
// virgules ou points-virgules). Tant qu'une adresse n'est pas renseignée, les
// demandes concernées sont ENREGISTRÉES normalement mais marquées
// "not_configured" (aucun e-mail ne part) : rien n'est perdu, et on peut
// renvoyer la notification depuis l'administration une fois l'adresse connue.
//
//   MAIL_TECHNIQUE    maintenance, ménage, livraison, manutention, véhicule
//                     (défaut : c2rmf.technique@culture.gouv.fr)
//   MAIL_RH           demandes de badge (création, modification, perte)
//   MAIL_ACCUEIL      perte de badge (en plus de MAIL_RH)
//   MAIL_EQUIPEMENTS  équipements de bureau
//   MAIL_QUAI         livraison / enlèvement au quai
//   MAIL_ACCES        accès externes, clés
//   MAIL_DEFAUT       toute demande sans destinataire dédié
//
// Objet de chaque e-mail : "<Catégorie> - <Formulaire>"
//   ex. "Intervention technique - Ascenseur / Monte charges"
// (pour permettre à la réception de créer des règles de tri).

function list(value) {
  return String(value || '')
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function addresses() {
  return {
    technique: list(process.env.MAIL_TECHNIQUE || 'c2rmf.technique@culture.gouv.fr'),
    rh: list(process.env.MAIL_RH),
    accueil: list(process.env.MAIL_ACCUEIL),
    equipements: list(process.env.MAIL_EQUIPEMENTS),
    quai: list(process.env.MAIL_QUAI),
    acces: list(process.env.MAIL_ACCES),
    defaut: list(process.env.MAIL_DEFAUT),
  };
}

// Destinataires par formulaire ("catégorie/formulaire"). Une fonction reçoit
// les adresses et les données validées (pour router selon un choix).
const ROUTES = {
  'intervention-technique/ascenseur': (a) => a.technique,
  'intervention-technique/intervention': (a) => a.technique,
  'livraison-envoi/livraison': (a) => a.technique,
  'livraison-envoi/manutention': (a) => a.technique,
  'livraison-envoi/livraison_quai': (a) => (a.quai.length ? a.quai : a.defaut),
  'menage/menage_general': (a) => a.technique,
  'menage/menage_non_fait': (a) => a.technique,
  'vehicule/reservation': (a) => a.technique,
  'equipements-bureau/mobilier_standard': (a) => (a.equipements.length ? a.equipements : a.defaut),
  'equipements-bureau/equip_specifiques': (a) => (a.equipements.length ? a.equipements : a.defaut),
  'acces-sites/acces_valise': (a) => (a.acces.length ? a.acces : a.defaut),
  'acces-sites/acces_prestataire': (a) => (a.acces.length ? a.acces : a.defaut),
  'acces-sites/cle_bureau': (a) => (a.acces.length ? a.acces : a.defaut),
  // Formulaire "Badge" : le destinataire dépend du type de demande (étape 1)
  'acces-sites/badge': (a, data) => {
    const type = data['1-radio'];
    if (type === 'Perte de badge') return [...new Set([...a.rh, ...a.accueil])];
    return a.rh; // demande de badge, modification de badge
  },
};

function recipientsFor(categoryKey, formKey, data) {
  const a = addresses();
  const route = ROUTES[`${categoryKey}/${formKey}`];
  const to = route ? route(a, data || {}) : a.defaut;
  return [...new Set(to)];
}

module.exports = { recipientsFor, ROUTES };
