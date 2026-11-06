// PDF « DEMANDE DE BADGE D'IDENTIFICATION » du C2RMF, complété avec l'étape
// « Demande de badge » du formulaire « Arrivée d'un nouvel agent ».
//
// Le PDF fourni (templates/demande-badge.pdf) est un formulaire interactif : ses
// champs sont remplis tels quels, sans redessiner la page. Ils restent modifiables,
// ce qui permet au service concerné de compléter le bloc « VALIDATION (et suivi
// interne) » (date, signature, dates d'arrivée et de remise du badge).
//
// Les valeurs sont retrouvées par LIBELLÉ de champ (voir public/forms-data.js) :
// renommer un libellé là-bas impose de l'adapter ici.

const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { fieldValue } = require('./forms');

const TEMPLATE = path.join(__dirname, '..', 'templates', 'demande-badge.pdf');

// Libellé du formulaire -> champ du PDF (les noms du PDF contiennent des
// caractères accentués encodés sous la forme #C3#A9, d'où la comparaison normalisée).
const TYPE_BOXES = { Initiale: 'Demande initiale', Prolongation: 'Prolongation ?', Modification: 'Modification' };
const CIRCULATION_FIELDS = [
  'Accès supplémentaires', 'Accès supplémentaires_2', 'Accès supplémentaires_3',
  'Accès supplémentaires_4', 'Accès supplémentaires_5', 'Accès supplémentaires_6',
];
// Catégorie -> case à cocher, champ de détail du PDF, libellé du champ du formulaire
const CATEGORIES = {
  'Personnel C2RMF': { box: 'Personnel C2RMF', detail: 'département', label: 'Département (si Personnel C2RMF)', kind: 'dropdown' },
  'Restaurateur(trice)': { box: 'Restaurateur', detail: 'filière', label: 'Filière (si Restaurateur(trice))', kind: 'dropdown' },
  'Doctorant & stagiaires': { box: 'Doctorant & stagiaires', detail: 'référent doctorant', label: 'Référent (si Doctorant & stagiaires)', kind: 'text' },
  Prestataire: { box: 'Prestataire', detail: 'société', label: 'Société (si Prestataire)', kind: 'text' },
  Autre: { box: 'Autre', detail: 'préciser autre', label: 'À préciser (si Autre)', kind: 'text' },
};

function decodeName(name) {
  try {
    return decodeURIComponent(String(name).replace(/#/g, '%'));
  } catch (e) {
    return String(name);
  }
}

function frDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
}

async function buildPdf(ctx) {
  const data = ctx.data || {};
  const v = (label) => fieldValue(ctx.form, data, label).trim();

  const pdf = await PDFDocument.load(fs.readFileSync(TEMPLATE));
  const form = pdf.getForm();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const index = new Map(form.getFields().map((f) => [decodeName(f.getName()), f]));
  const find = (name) => {
    const f = index.get(name);
    if (!f) throw new Error(`Champ « ${name} » introuvable dans templates/demande-badge.pdf`);
    return f;
  };
  const text = (name, value) => { if (value) find(name).setText(value); };
  const choose = (name, value) => { if (value) find(name).select(value); };
  const tick = (name, on) => { const box = find(name); if (on) box.check(); else box.uncheck(); };

  // Identité : reprise de l'étape « Informations sur l'agent concerné »
  text('NOM', v('Nom').toLocaleUpperCase('fr-FR'));
  text('PRENOM', v('Prénom'));
  text('Date fin validité', frDate(v('Date de fin de validité')));

  // Création du badge
  const type = v('Type de demande');
  Object.entries(TYPE_BOXES).forEach(([label, box]) => tick(box, label === type));

  // Accès aux sites et circulations intérieures (liste « PAS D'ACCES » par défaut dans le PDF)
  choose('Configuration CA FLORE', v('Accès Flore'));
  choose('Configuration CA Laboratoire', v('Accès Laboratoire'));
  CIRCULATION_FIELDS.forEach((name, i) => choose(name, v(`Circulation intérieure ${i + 1}`)));

  // Informations complémentaires : seule la catégorie choisie est cochée, avec son détail
  const category = v('Catégorie de la personne');
  Object.entries(CATEGORIES).forEach(([label, c]) => {
    const on = label === category;
    tick(c.box, on);
    if (!on) return;
    if (c.kind === 'dropdown') choose(c.detail, v(c.label));
    else text(c.detail, v(c.label));
  });

  form.updateFieldAppearances(font);
  return Buffer.from(await pdf.save());
}

// Nom du fichier téléchargé / joint : Demande-badge-NOM-Prenom.pdf
function filename(ctx) {
  const part = (label) => fieldValue(ctx.form, ctx.data || {}, label)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const parts = ['Demande-badge', part('Nom'), part('Prénom')].filter(Boolean);
  return `${parts.join('-')}.pdf`;
}

module.exports = { buildPdf, filename };
