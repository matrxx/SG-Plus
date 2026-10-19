// Fiche officielle « DEMANDE D'ACCÈS VÉHICULE » (Secrétariat Général / Administration).
//
//  - Word : le modèle fourni (templates/acces-vehicule.docx) est ouvert tel quel
//    et complété : zones de saisie, cases à cocher, liste des intervenants. La mise
//    en page, les logos, l'en-tête et le pied de page restent ceux du modèle.
//  - PDF  : la même page est redessinée (pdfkit), logos du modèle compris, pour
//    ne dépendre d'aucun logiciel installé sur le serveur.
//
// Les valeurs sont retrouvées par LIBELLÉ de champ / d'étape (voir
// public/forms-data.js, formulaire vehicule/acces_vehicule) : renommer un libellé
// là-bas impose de l'adapter ici.

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const PDFDocument = require('pdfkit');

const TEMPLATE = path.join(__dirname, '..', 'templates', 'acces-vehicule.docx');

// Cases du modèle, dans l'ordre où elles apparaissent dans le document Word.
const TYPES = ['Maintenance', 'Prises de vue', "Livraison d'œuvres", 'Autres', 'Travaux', 'Visite', 'Livraison'];
const ESPACES = ['Laboratoire par saut du loup', 'Pavillon de Flore par porte Jaujard', 'Laboratoire par VDI', 'Pavillon de Flore par VDI'];

// ------------------------------------------------------------------ données
function frDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
}

// Valeurs saisies, retrouvées par libellé.
function collect(form, clean) {
  const field = {};
  const checked = {};
  form.steps.forEach((step, i) => {
    const n = i + 1;
    if (step.type === 'fields' || step.type === 'mixed') {
      (step.fields || []).forEach((f, fi) => {
        field[f.label] = String(clean[`${n}-field-${fi}`] || '').trim();
      });
    } else if (step.type === 'checklist') {
      checked[step.label] = new Set(clean[`${n}-checklist`] || []);
    }
  });
  const one = (s) => s.replace(/\s*[\r\n]+\s*/g, ' ');
  const intervenants = (field['Liste des intervenants'] || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 40);
  return {
    demandeur: one(field['Demandeur'] || ''),
    mobile: one(field['Téléphone mobile'] || ''),
    bureau: one(field['Téléphone bureau'] || ''),
    dateDemande: frDate(field['Date de la demande']),
    societe: one(field['Nom de la société'] || ''),
    immat: one(field['Immatriculation du véhicule'] || ''),
    dateIntervention: frDate(field["Date de l'intervention"]),
    duree: one(field['Durée'] || ''),
    heure: one(field['Heure de rendez-vous'] || ''),
    porte: one(field['Porte accès du véhicule'] || ''),
    types: TYPES.map((t) => (checked["Types d'intervention"] || new Set()).has(t)),
    espaces: ESPACES.map((t) => (checked['Espaces concernés'] || new Set()).has(t)),
    intervenants,
    validePar: one(field['Validé par'] || ''),
    dateValidation: frDate(field['Date de validation']),
  };
}

// ------------------------------------------------------------------ Word
function xmlEscape(s) {
  return String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function run(text, size = 22) {
  return `<w:r><w:rPr><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

// Écrit `text` dans une zone de saisie flottante du modèle (le modèle en contient
// deux copies : DrawingML et VML ; les deux sont remplies).
function withText(zoneXml, text) {
  if (!text) return zoneXml;
  return zoneXml.replace(/<w:txbxContent>([\s\S]*?)<\/w:txbxContent>/g, (all, inner) => {
    const filled = /\/>\s*$/.test(inner) && !/<\/w:p>\s*$/.test(inner)
      ? inner.replace(/\/>\s*$/, () => '>' + run(text) + '</w:p>') // <w:p ... /> : paragraphe vide auto-fermé
      : inner.replace(/<\/w:p>\s*$/, () => run(text) + '</w:p>');
    return `<w:txbxContent>${filled}</w:txbxContent>`;
  });
}
async function buildDocx(ctx) {
  const d = collect(ctx.form, ctx.data || {});
  const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE));
  let xml = await zip.file('word/document.xml').async('string');

  // 1) Zones de saisie, dans l'ordre du document :
  //  1 département (texte fixe)  2 demandeur  3 date de la demande  4 téléphones
  //  5 société  6 immatriculation  7 durée  8 date de l'intervention
  //  9 porte d'accès  10 heure de rendez-vous  11 date de validation
  const zones = {
    2: d.demandeur,
    3: d.dateDemande,
    5: d.societe,
    6: d.immat,
    7: d.duree,
    8: d.dateIntervention,
    9: d.porte,
    10: d.heure,
    11: d.dateValidation,
  };
  let zoneIndex = 0;
  xml = xml.replace(/<mc:AlternateContent>[\s\S]*?<\/mc:AlternateContent>/g, (zoneXml) => {
    let zone = zoneXml;
    if (/w14:checkbox/.test(zone)) return zone; // case à cocher, traitée plus bas
    zoneIndex += 1;
    if (zoneIndex === 4) {
      // Téléphones : le modèle porte « Mobile : Bureau : » sur une ligne ; deux lignes pour tenir dans le cadre.
      const lines = [`Mobile : ${d.mobile}`.trimEnd(), `Bureau : ${d.bureau}`.trimEnd()];
      const paragraphs = lines
        .map((l) => `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run(l, 20)}</w:p>`)
        .join('');
      return zone.replace(/<w:txbxContent>[\s\S]*?<\/w:txbxContent>/g, () => `<w:txbxContent>${paragraphs}</w:txbxContent>`);
    }
    if (zoneIndex === 11) {
      // Cadre de la date de validation : plus bas que les autres, il rognait le texte.
      zone = zone.replace(/cy="195580"/g, 'cy="290830"').replace(/height:15\.4pt/g, 'height:22.9pt').replace(/<w:sz w:val="28"\/>/g, '<w:sz w:val="22"/>');
    }
    return zones[zoneIndex] ? withText(zone, zones[zoneIndex]) : zone;
  });

  // 2) Cases à cocher (contrôles de contenu Word), dans l'ordre du document.
  const ticks = [...d.types, ...d.espaces];
  let boxIndex = 0;
  xml = xml.replace(/<w:sdt>[\s\S]*?<\/w:sdt>/g, (sdt) => {
    if (!/w14:checkbox/.test(sdt)) return sdt;
    const on = ticks[boxIndex++];
    return on ? sdt.replace('<w14:checked w14:val="0"/>', '<w14:checked w14:val="1"/>').replace('☐', '☒') : sdt;
  });

  // 3) Liste des intervenants : sous le titre ; les cadres suivants sont ancrés à
  //    leur paragraphe et descendent donc avec le texte.
  if (d.intervenants.length) {
    const lines = d.intervenants
      .map((l) => `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${run('• ' + l)}</w:p>`)
      .join('');
    const at = xml.indexOf('INTERVENANTS');
    const end = at === -1 ? -1 : xml.indexOf('</w:p>', at);
    if (end !== -1) xml = xml.slice(0, end + 6) + lines + xml.slice(end + 6);
  }

  // 4) « Validé par » : le nom est écrit sur la ligne suivante, sous l'étiquette, pour
  //    que « DATE LE » et son cadre restent à leur place d'origine.
  if (d.validePar) {
    const at = xml.lastIndexOf('<w:sectPr');
    if (at !== -1) {
      const line = `<w:p><w:pPr><w:spacing w:before="240" w:after="0"/></w:pPr>${run(d.validePar)}</w:p>`;
      xml = xml.slice(0, at) + line + xml.slice(at);
    }
  }
  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ------------------------------------------------------------------ PDF
// Coordonnées relevées sur le modèle rendu en 800 px de large ; 1 px = 0,744 pt.
const K = 595.28 / 800;
const px = (v) => v * K;
const SLATE = '#44546A';
const BOX = '#E2E2E2';

async function logos() {
  const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE));
  return {
    louvre: await zip.file('word/media/image1.jpeg').async('nodebuffer'),
    c2rmf: await zip.file('word/media/image2.png').async('nodebuffer'),
  };
}

async function buildPdf(ctx) {
  const d = collect(ctx.form, ctx.data || {});
  const img = await logos();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: "Demande d'accès véhicule", Author: 'SG+' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const text = (value, x, y, opts = {}) => {
      doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size || 9.5).fillColor(opts.color || '#000000');
      doc.text(String(value), px(x), px(y), { lineBreak: false, ...(opts.width ? { width: px(opts.width), ellipsis: true, lineBreak: false } : {}) });
    };
    const box = (x1, y1, x2, y2, color = BOX, width = 1) => {
      doc.lineWidth(width).strokeColor(color).rect(px(x1), px(y1), px(x2 - x1), px(y2 - y1)).stroke();
    };
    const field = (x1, y1, x2, y2, value) => {
      box(x1, y1, x2, y2);
      if (value) text(value, x1 + 6, y1 + (y2 - y1) / 2 - 7, { size: 10, width: x2 - x1 - 10 });
    };
    const check = (x, y, label, on, width) => {
      const s = px(11);
      const top = px(y) - s / 2;
      doc.lineWidth(0.9).strokeColor('#000000').rect(px(x), top, s, s).stroke();
      if (on) {
        doc.lineWidth(1.4).moveTo(px(x) + 2, top + 2).lineTo(px(x) + s - 2, top + s - 2).moveTo(px(x) + s - 2, top + 2).lineTo(px(x) + 2, top + s - 2).stroke();
      }
      text(label, x + 21, y - 8, { size: 10.5, width });
    };

    const footer = () => doc.font('Helvetica').fontSize(10).fillColor('#00833E')
      .text('C1 Données Internes', 0, px(1087), { width: doc.page.width, align: 'center', lineBreak: false });
    footer();
    doc.on('pageAdded', footer);

    // Logos et titre
    doc.image(img.louvre, px(48), px(59), { width: px(140), height: px(55) });
    doc.image(img.c2rmf, px(642), px(47), { width: px(76), height: px(63) });
    doc.font('Helvetica-Bold').fontSize(16.5).fillColor(SLATE)
      .text("DEMANDE D'ACCÈS VÉHICULE", 0, px(137), { width: doc.page.width, align: 'center', lineBreak: false });

    // Demandeur
    text('Département :', 49, 181);
    text('Secrétariat Général / Administration', 160, 181, { bold: true, size: 10 });
    text('Demandeur :', 49, 211);
    field(148, 208, 727, 239, d.demandeur);
    text('Téléphone :', 49, 241);
    box(148, 243, 360, 296);
    text(`Mobile : ${d.mobile}`.trimEnd(), 204, 255, { size: 9.5, width: 150 });
    text(`Bureau : ${d.bureau}`.trimEnd(), 204, 275, { size: 9.5, width: 150 });
    text('Date de la demande :', 372, 241);
    field(506, 243, 724, 273, d.dateDemande);

    // Cadre principal
    box(41, 298, 752, 499, '#000000', 1.1);
    text('Nom de la société :', 49, 303);
    field(190, 300, 718, 332, d.societe);
    text('Immatriculation du véhicule :', 49, 363);
    field(232, 355, 716, 385, d.immat);
    text("Date de l'intervention :", 49, 423);
    field(199, 412, 441, 443, d.dateIntervention);
    text('Durée :', 486, 423);
    field(542, 412, 716, 443, d.duree);
    text('Heure de rendez-vous :', 49, 483);
    field(197, 463, 364, 494, d.heure);
    text('Porte accès du véhicule :', 387, 483);
    field(546, 463, 717, 494, d.porte);

    // Types d'intervention
    doc.font('Helvetica-Bold').fontSize(10).fillColor(SLATE).text("•  TYPES D'INTERVENTION", px(49), px(515), { lineBreak: false });
    box(41, 544, 752, 610, '#000000', 1.1);
    const typePos = [[56, 560], [263, 560], [449, 560], [657, 560], [51, 598], [257, 598], [434, 598]];
    typePos.forEach(([x, y], i) => check(x, y, TYPES[i], d.types[i], 150));

    // Espaces concernés
    doc.font('Helvetica-Bold').fontSize(10).fillColor(SLATE).text('•  ESPACES CONCERNES', px(49), px(626), { lineBreak: false });
    box(41, 656, 752, 722, '#000000', 1.1);
    const espPos = [[52, 671], [403, 671], [52, 709], [400, 709]];
    espPos.forEach(([x, y], i) => check(x, y, ESPACES[i], d.espaces[i], 330));

    // Liste des intervenants, puis validation (sur une nouvelle page si la liste est longue)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(SLATE).text('•  LISTE DES INTERVENANTS :', px(49), px(738), { lineBreak: false });
    let y = px(762);
    const bottom = doc.page.height - px(110);
    d.intervenants.forEach((line) => {
      if (y > bottom) { doc.addPage(); y = px(60); }
      doc.font('Helvetica').fontSize(10).fillColor('#000000').text('•  ' + line, px(49), y, { width: px(700), lineBreak: false, ellipsis: true });
      y += 15;
    });
    if (y > bottom - 20) { doc.addPage(); y = px(60); }
    y += 12;
    doc.font('Helvetica').fontSize(9.5).fillColor('#000000').text(`Validé par${d.validePar ? ' : ' + d.validePar : ''}`, px(49), y, { width: px(320), lineBreak: false, ellipsis: true });
    doc.text('DATE LE', px(380), y, { lineBreak: false });
    doc.lineWidth(1).strokeColor(BOX).rect(px(512), y - 4, px(249), 20).stroke();
    if (d.dateValidation) doc.fontSize(10).text(d.dateValidation, px(518), y, { lineBreak: false });

    doc.end();
  });
}

module.exports = { buildDocx, buildPdf, collect, TYPES, ESPACES };
