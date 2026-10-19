// Définition des catégories et formulaires du portail.
// Fichier partagé : chargé par le navigateur (variable globale categoryForms)
// ET par le serveur Node (require) qui s'en sert pour valider les envois et
// construire les e-mails. Aucune donnée secrète ici.
//
// Types d'étapes : fields | mixed | checklist | fixed | file-upload | summary
// Options de champ : req, type (text|email|date|textarea), options (liste déroulante)
// Conditions : une étape ou un champ peut porter when: { step, radio } pour
//   n'être actif que si le choix radio de l'étape `step` vaut `radio` (ou est dans un tableau).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.categoryForms = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // Listes fermées partagées par plusieurs formulaires.
  const SITES_FLORE_CARROUSEL = ['Flore', 'Carrousel'];
  const SITES_LOUVRE_FLORE = ['Louvre Carrousel', 'Flore'];
  // PROVISOIRE : remplacer par la liste réelle des monte-charges du site.
  const EQUIPEMENTS_ELEVATION = ['Ascenseur', 'Monte-charge 1', 'Monte-charge 2', 'Monte-charge 3'];

return {
  'arrivee-depart': {
    title: 'Arrivée/Départ',
    forms: {
      arrivee: {
        title: "Arrivée d'un nouvel agent",
        ref: "ARR",
        icon: 'doorEnter',
        steps: [
          { label: "Pré-requis à la demande d'installation", title: "Pré-requis à la demande d'installation", desc: "Avant de commencer, confirmez les éléments suivants", type: 'checklist', items: ["La date d'arrivée de l'agent est confirmée par le service RH", "Le poste de travail (bureau) est identifié et disponible", "Le responsable hiérarchique de l'agent est informé"] },
          { label: "Informations sur l'agent concerné", title: "Informations sur l'agent concerné", desc: "Renseignez l'identité du nouvel agent", type: 'fields', fields: [{label:"Prénom", req:true}, {label:"Nom", req:true}, {label:"E-mail", req:true, type:'email'}, {label:"Date d'arrivée", req:true, type:'date'}, {label:"Service / direction", req:true}, {label:"Fonction"}] },
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
      depart: { title: "Départ d'un agent", ref: "DEP", icon: 'doorExit', steps: [
        { label: "À propos de l'agent concerné", title: "À propos de l'agent concerné par le départ", desc: "Identité et date de départ", type: 'fields', fields: [{label:"Prénom", req:true}, {label:"Nom", req:true}, {label:"E-mail professionnel", req:true, type:'email'}, {label:"Date de départ", req:true, type:'date'}, {label:"Motif du départ"}] },
        { label: "Mobilier à récupérer", title: "Mobilier à récupérer", desc: "Sélectionnez les éléments à reprendre", type: 'checklist', items: ["Bureau","Chaise","Caisson de rangement","Armoire"] },
        { label: "Matériel informatique à récupérer", title: "Matériel informatique à récupérer", desc: "Équipements à restituer", type: 'checklist', items: ["Ordinateur portable / fixe","Écran(s)","Badge d'accès","Périphériques", "Téléphone mobile professionnel"] },
        { label: "Matériel de téléphonie à récupérer", title: "Matériel de téléphonie à récupérer", desc: "Ligne et poste téléphonique", type: 'mixed', radio: {label:"Action sur la ligne", options:["Clôture définitive","Réaffectation à un autre agent"]}, fields: [] },
        { label: "Rappel badge", title: "Rappel", desc: "À lire avant de valider la demande", type: 'fixed', content: "<p>Pour rappel, les badges d'accès sont à restituer obligatoirement au service RH.</p>" },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]}
    }
  },

  'menage': {
    title: 'Ménage',
    forms: {
      menage_general: { title: "Enlèvement de déchets", ref: "MEN", icon: 'spray', steps: [
        { label: "Identité du demandeur", title: "Identité du demandeur", desc: "Renseignez vos coordonnées", type: 'fields', fields: [{label:"Prénom", req:true},{label:"Nom", req:true},{label:"Service / direction", req:true},{label:"Site / bâtiment", req:true}] },
        { label: "Votre demande", title: "Enlèvement de déchets", desc: "Précisez où se trouvent les déchets à enlever", type: 'fields', fields: [{label:"Emplacement des déchets", req:true},{label:"Précisions complémentaires", type:'textarea'}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      menage_non_fait: { title: "Signaler que le ménage n'est pas fait", ref: "MNF", icon: 'spray', steps: [
        { label: "Identité du demandeur", title: "Identité du demandeur", desc: "Renseignez vos coordonnées", type: 'fields', fields: [{label:"Prénom", req:true},{label:"Nom", req:true},{label:"Service / direction", req:true}] },
        { label: "Votre signalement", title: "Ménage non effectué", desc: "Indiquez où le ménage n'a pas été fait", type: 'fields', fields: [{label:"Site / bâtiment", req:true},{label:"Local / bureau concerné", req:true},{label:"Date du constat", req:true, type:'date'},{label:"Précisions complémentaires", type:'textarea'}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]}
    }
  },

  'intervention-technique': {
    title: 'Intervention technique',
    forms: {
      ascenseur: { title: "Ascenseur / Monte charges", ref: "ASC", icon: 'stairs', steps: [
        { label: "Votre demande", title: "Ascenseur / Monte charges", desc: "Décrivez le problème constaté", type: 'fields', fields: [{label:"Prénom", req:true},{label:"Nom", req:true},{label:"Site / bâtiment", req:true},{label:"Équipement concerné", req:true, options: EQUIPEMENTS_ELEVATION},{label:"Description du problème", req:true, type:'textarea'}] }
      ]},
      intervention: { title: "Demande d'intervention technique", ref: "ITE", icon: 'tool', steps: [
        { label: "Identité du demandeur", title: "Identité du demandeur", desc: "Renseignez vos coordonnées", type: 'fields', fields: [{label:"Prénom", req:true},{label:"Nom", req:true},{label:"Service / direction", req:true},{label:"Site / bâtiment", req:true, options: SITES_FLORE_CARROUSEL}] },
        { label: "Votre demande", title: "Votre demande", desc: "Décrivez l'intervention nécessaire", type: 'mixed', radio: {label:"Domaine concerné", options:["Électricité","Plomberie","Chauffage / climatisation","Autre"]}, fields: [{label:"Description du problème", req:true, type:'textarea'}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]}
    }
  },

  'acces-sites': {
    title: 'Accès aux sites',
    forms: {
      badge: { title: "Badge", ref: "BAD", icon: 'badge', steps: [
        { label: "Votre demande", title: "Badge", desc: "Indiquez le type de demande et vos coordonnées", type: 'mixed', radio: {label:"Type de demande", req:true, options:["Demande de badge","Modification de badge","Perte de badge"]}, fields: [{label:"Prénom", req:true},{label:"Nom", req:true},{label:"Service / direction", req:true}] },
        { label: "Demande de badge", title: "Demande de badge", desc: "Précisez le badge souhaité", when: {step:1, radio:"Demande de badge"}, type: 'fields', fields: [{label:"Fonction", req:true},{label:"Espaces à accéder", req:true, type:'textarea'},{label:"Précisions complémentaires", type:'textarea'}] },
        { label: "Modification de badge", title: "Modification de badge", desc: "Précisez les changements à apporter (demande transmise aux RH)", when: {step:1, radio:"Modification de badge"}, type: 'fields', fields: [{label:"Numéro de badge"},{label:"Nouveau service / fonction"},{label:"Espaces à accéder", req:true, type:'textarea'},{label:"Justification", req:true, type:'textarea'}] },
        { label: "Perte de badge", title: "Déclaration de perte du badge", desc: "Précisez les circonstances (déclaration transmise aux RH et à l'accueil)", when: {step:1, radio:"Perte de badge"}, type: 'fields', fields: [{label:"Date de la perte", req:true, type:'date'},{label:"Circonstances", type:'textarea'}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      acces_valise: { title: "Demande accès valise pour externes", ref: "AVE", icon: 'userPlus', steps: [
        { label: "Identité du demandeur", title: "Identité du demandeur", desc: "Renseignez vos coordonnées", type: 'fields', fields: [{label:"Prénom", req:true},{label:"Nom", req:true},{label:"Service / direction", req:true}] },
        { label: "Les personnes externes", title: "Les personnes externes", desc: "Identifiez les personnes extérieures concernées", type: 'fields', fields: [{label:"Nombre de personnes externes", req:true},{label:"Noms et sociétés des personnes externes", req:true, type:'textarea'}] },
        { label: "Détail de la demande", title: "Détail de la demande", desc: "Précisez la période et les espaces concernés", type: 'fields', fields: [{label:"Date et heure d'arrivée", req:true},{label:"Date et heure de départ", req:true},{label:"Espaces à accéder", req:true},{label:"Motif", req:true, type:'textarea'}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      arrivee_externe: { title: "Arrivée externe", ref: "AEE", icon: 'doorEnter', externalUrl: 'https://app.proxyclick.com/default', steps: [] },
      cle_bureau: { title: "Clés", ref: "CLE", icon: 'key', steps: [
        { label: "Votre demande", title: "Clés", desc: "Renseignez votre demande", type: 'fields', fields: [{label:"Prénom", req:true},{label:"Nom", req:true},{label:"Numéro de bureau"},{label:"Espace concerné", req:true},{label:"Motif / descriptif du besoin", req:true, type:'textarea'}] }
      ]},
      acces_prestataire: { title: "Autorisation d'accès prestataire ou autre personne extérieure", ref: "APR", icon: 'userPlus', steps: [
        { label: "Votre demande", title: "Votre demande", desc: "Décrivez le contexte de l'intervention", type: 'fields', fields: [{label:"Prénom du demandeur", req:true},{label:"Nom du demandeur", req:true},{label:"Date(s) d'intervention", req:true},{label:"Motif de l'accès", req:true}] },
        { label: "Les intervenants", title: "Les intervenants", desc: "Identité des personnes externes concernées", type: 'fields', fields: [{label:"Nom complet intervenant 1", req:true},{label:"Société", req:true},{label:"Nom complet intervenant 2 (optionnel)"}] }
      ]}
    }
  },

  'livraison-envoi': {
    title: 'Livraison, Envoi et Manutention',
    forms: {
      livraison: { title: "Livraison", ref: "LIV", icon: 'truckDelivery', steps: [
        { label: "Demandeur et livraison", title: "Livraison", desc: "Renseignez les détails de la livraison", type: 'mixed', radio: {label:"Type de livraison", req:true, options:["Courrier","Colis","Palette"]}, fields: [{label:"Prénom", req:true},{label:"Nom", req:true},{label:"Lieu de départ de la livraison", req:true},{label:"Date de départ", req:true, type:'date'},{label:"Poids", req:true, options:["Moins de 25 kg","Plus de 25 kg"]}] },
        { label: "Pièce jointe", title: "Pièce jointe", desc: "Ajoutez un document si nécessaire (20 Mo maximum)", type: 'file-upload', allowed_formats: ['pdf','doc','docx','xls','xlsx','jpg','jpeg','png','tif','tiff'], max_file_size: 20971520, max_files: 1, required: false },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      manutention: { title: "Manutention sur site", ref: "MAN", icon: 'forklift', steps: [
        { label: "Identité du demandeur", title: "Manutention sur site", desc: "Décrivez le besoin de manutention", type: 'fields', fields: [{label:"Prénom", req:true},{label:"Nom", req:true},{label:"Service / direction", req:true},{label:"Description du besoin", req:true, type:'textarea'}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      livraison_quai: { title: "Signaler une livraison ou un enlèvement au quai", ref: "LEQ", icon: 'truckLoading', notice: null, documents: ['pdf', 'docx'], steps: [
        { label: "Identité du demandeur", title: "Signaler une livraison ou un enlèvement au quai", desc: "Renseignez vos coordonnées et le lieu concerné", type: 'fields', fields: [{label:"Prénom", req:true},{label:"Nom", req:true},{label:"Site / emplacement", req:true, options: SITES_LOUVRE_FLORE},{label:"Nature", req:true, options:["Livraison","Enlèvement"]}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]}
    }
  },

  'equipements-bureau': {
    title: 'Équipements de bureau',
    forms: {
      mobilier_standard: { title: "Mobilier standard", ref: "MST", icon: 'armchair', steps: [
        { label: "Identité du demandeur", title: "Mobilier standard", desc: "Renseignez vos coordonnées et le mobilier souhaité", type: 'fields', fields: [{label:"Prénom", req:true},{label:"Nom", req:true},{label:"Service / direction", req:true},{label:"Mobilier souhaité", req:true}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      equip_specifiques: { title: "Équipements spécifiques de bureau", ref: "ESB", icon: 'desk', steps: [
        { label: "Identité du demandeur", title: "Équipements spécifiques de bureau", desc: "Décrivez le besoin particulier", type: 'fields', fields: [{label:"Prénom", req:true},{label:"Nom", req:true},{label:"Service / direction", req:true},{label:"Description du besoin", req:true, type:'textarea'}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]}
    }
  },

  'vehicule': {
    title: 'Véhicule',
    forms: {
      reservation: { title: "Réservation de véhicule seul", ref: "VEH", icon: 'car', steps: [
        { label: "Votre demande", title: "Réservation de véhicule seul", desc: "Renseignez les détails de votre réservation", type: 'fields', fields: [{label:"Prénom", req:true},{label:"Nom", req:true},{label:"Date et heure de départ", req:true},{label:"Date et heure de retour", req:true},{label:"Motif du déplacement"}] }
      ]}
    }
  },

  'evenementiel': {
    title: 'Événementiel',
    forms: {
      accueil_cafe: { title: "Accueil café, croissants", ref: "ACC", icon: 'coffee', steps: [
        { label: "Identité du demandeur", title: "Identité du demandeur", desc: "Renseignez vos coordonnées", type: 'fields', fields: [{label:"Prénom", req:true},{label:"Nom", req:true},{label:"Service / direction", req:true}] },
        { label: "Lieu et date de l'événement", title: "Lieu et date de l'événement", desc: "Précisez les modalités", type: 'fields', fields: [{label:"Date", req:true, type:'date'},{label:"Lieu", req:true},{label:"Nombre de personnes", req:true}] },
        { label: "Bon de commande et facturation", title: "Bon de commande et facturation", desc: "Sélectionnez les articles souhaités", type: 'checklist', items: ["Café","Thé","Croissants / viennoiseries","Jus de fruits","Eau"] },
        { label: "Facturation", title: "Facturation", desc: "Renseignez l'imputation budgétaire", type: 'fields', fields: [{label:"Code budgétaire / centre de coûts", req:true}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      coupon_repas: { title: "Coupon repas", ref: "CRE", icon: 'ticket', steps: [
        { label: "Identité du demandeur", title: "Identité du demandeur", desc: "Renseignez vos coordonnées", type: 'fields', fields: [{label:"Prénom", req:true},{label:"Nom", req:true},{label:"Service / direction", req:true}] },
        { label: "Commande", title: "Commande", desc: "Précisez le nombre de coupons", type: 'fields', fields: [{label:"Nombre de coupons", req:true},{label:"Date d'utilisation prévue"}] },
        { label: "Facturation", title: "Facturation", desc: "Renseignez l'imputation budgétaire", type: 'fields', fields: [{label:"Code budgétaire / centre de coûts", req:true}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]},
      materiel_evenementiel: { title: "Matériel d'événementiel et de réunion", ref: "MER", icon: 'presentation', steps: [
        { label: "Identité du demandeur", title: "Identité du demandeur", desc: "Renseignez vos coordonnées", type: 'fields', fields: [{label:"Prénom", req:true},{label:"Nom", req:true},{label:"Service / direction", req:true}] },
        { label: "Lieu et prestation", title: "Lieu et prestation", desc: "Précisez le matériel et le lieu", type: 'mixed', radio: {label:"Matériel souhaité", options:["Vidéoprojecteur","Sonorisation","Mobilier de réunion","Visioconférence"]}, fields: [{label:"Lieu / salle", req:true},{label:"Date", req:true, type:'date'}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]}
    }
  },

  'oeuvres-art': {
    title: "Œuvres et objets d'art",
    forms: {
      depot_oeuvres: { title: "Dépôt d'œuvres et objets d'art", ref: "OEA", icon: 'palette', steps: [
        { label: "Identité du demandeur", title: "Identité du demandeur", desc: "Renseignez vos coordonnées", type: 'fields', fields: [{label:"Prénom", req:true},{label:"Nom", req:true},{label:"Service / direction", req:true},{label:"Description de l'œuvre", req:true, type:'textarea'}] },
        { label: "Validation", title: "Validation", desc: "Vérifiez le récapitulatif avant envoi", type: 'summary' }
      ]}
    }
  }
};
});

