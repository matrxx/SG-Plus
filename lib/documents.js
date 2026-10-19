// Génération de documents PDF / Word complétés avec les champs du formulaire.
//
// ATTENTION : ces documents suivent une mise en page générique (en-tête, tableau
// libellé / valeur). Si un modèle officiel doit être respecté à l'identique,
// il faut le fournir pour adapter la mise en page ici.

const PDFDocument = require('pdfkit');
const {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  BorderStyle,
  HeadingLevel,
  AlignmentType,
} = require('docx');

function meta({ category, form, requester, reference }) {
  const date = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long', timeStyle: 'short' });
  const rows = [
    ['Catégorie', category.title],
    ['Formulaire', form.title],
    ['Demandeur', `${requester.first_name} ${requester.last_name}`],
    ['E-mail du demandeur', requester.email],
    ['Date', date],
  ];
  if (reference) rows.unshift(['Référence', reference]);
  return rows;
}

function fileBaseName(form) {
  const day = new Date().toISOString().slice(0, 10);
  return `${form.ref || 'FORM'}-${day}`;
}

// ---------------------------------------------------------------- PDF
function buildPdf(ctx, sections) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: ctx.form.title, Author: 'SG+' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const labelWidth = Math.round(width * 0.38);

    const row = (label, value) => {
      const text = String(value ?? '');
      doc.font('Helvetica').fontSize(10);
      const height = Math.max(
        doc.heightOfString(label, { width: labelWidth - 10 }),
        doc.heightOfString(text, { width: width - labelWidth - 10 })
      ) + 10;
      if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const y = doc.y;
      doc.fillColor('#555555').text(label, left + 4, y + 5, { width: labelWidth - 10 });
      doc.fillColor('#000000').text(text, left + labelWidth, y + 5, { width: width - labelWidth - 6 });
      doc.moveTo(left, y + height).lineTo(left + width, y + height).strokeColor('#dddddd').lineWidth(0.5).stroke();
      doc.y = y + height;
    };

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#777777').text('SG+ — SERVICES INTERNES DU C2RMF', left, 50);
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#000000').text(ctx.form.title, { width });
    doc.moveDown(0.8);
    meta(ctx).forEach(([k, v]) => row(k, v));

    sections.forEach((section) => {
      doc.moveDown(1);
      if (doc.y > doc.page.height - 120) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000').text(section.title, left, doc.y, { width });
      doc.moveDown(0.3);
      section.rows.forEach((r) => row(r.label, r.value));
    });

    doc.end();
  });
}

// ---------------------------------------------------------------- Word
const thin = { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' };
const cellBorders = { top: thin, bottom: thin, left: thin, right: thin };

function wordTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 38, type: WidthType.PERCENTAGE },
              borders: cellBorders,
              children: [new Paragraph({ children: [new TextRun({ text: String(label), color: '555555', size: 20 })] })],
            }),
            new TableCell({
              width: { size: 62, type: WidthType.PERCENTAGE },
              borders: cellBorders,
              children: String(value ?? '')
                .split('\n')
                .map((line) => new Paragraph({ children: [new TextRun({ text: line, size: 20 })] })),
            }),
          ],
        })
    ),
  });
}

function buildDocx(ctx, sections) {
  const children = [
    new Paragraph({ children: [new TextRun({ text: 'SG+ — SERVICES INTERNES DU C2RMF', color: '777777', size: 16, bold: true })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.LEFT, children: [new TextRun({ text: ctx.form.title })] }),
    wordTable(meta(ctx)),
  ];
  sections.forEach((section) => {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300 }, children: [new TextRun({ text: section.title })] }));
    children.push(wordTable(section.rows.map((r) => [r.label, r.value])));
  });

  const doc = new Document({
    creator: 'SG+',
    title: ctx.form.title,
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}

// Formulaires dotés d'une fiche officielle propre (propriété `documentTemplate`
// de public/forms-data.js) : la mise en page du modèle remplace le tableau générique.
const TEMPLATES = {
  'acces-vehicule': () => require('./accesVehiculeDocument'),
};

async function generateDocument(format, ctx, sections) {
  const template = ctx.form.documentTemplate && TEMPLATES[ctx.form.documentTemplate];
  if (template && (format === 'pdf' || format === 'docx')) {
    const t = template();
    return format === 'pdf'
      ? { buffer: await t.buildPdf(ctx), contentType: 'application/pdf', filename: `${fileBaseName(ctx.form)}.pdf` }
      : {
          buffer: await t.buildDocx(ctx),
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          filename: `${fileBaseName(ctx.form)}.docx`,
        };
  }
  if (format === 'pdf') {
    return { buffer: await buildPdf(ctx, sections), contentType: 'application/pdf', filename: `${fileBaseName(ctx.form)}.pdf` };
  }
  if (format === 'docx') {
    return {
      buffer: await buildDocx(ctx, sections),
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      filename: `${fileBaseName(ctx.form)}.docx`,
    };
  }
  throw new Error('Format non pris en charge');
}

module.exports = { generateDocument };
