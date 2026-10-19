// Lecture et validation côté serveur des formulaires définis dans
// public/forms-data.js (même fichier que celui utilisé par le navigateur).
//
// Le serveur ne fait JAMAIS confiance au navigateur : listes fermées,
// champs obligatoires, étapes conditionnelles et pièces jointes sont
// revalidés ici, et seules les clés connues des étapes actives sont conservées.
//
// Clés de données (identiques à celles produites par le front) :
//   "<étape>-field-<n°>"   valeur d'un champ        (étape = numéro 1..N)
//   "<étape>-radio"        choix unique de l'étape
//   "<étape>-checklist"    tableau de cases cochées
//   "<étape>-files"        tableau de { id } des pièces jointes déposées

const categoryForms = require('../public/forms-data.js');

const MAX_TEXT_LENGTH = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function getForm(categoryKey, formKey) {
  const category = Object.prototype.hasOwnProperty.call(categoryForms, categoryKey)
    ? categoryForms[categoryKey]
    : null;
  if (!category) return null;
  const form = Object.prototype.hasOwnProperty.call(category.forms, formKey)
    ? category.forms[formKey]
    : null;
  if (!form) return null;
  return { category, form };
}

// Une étape (ou un champ) portant when: { step, radio } n'est active que si le
// choix de l'étape `step` correspond (radio peut être une valeur ou un tableau).
function isActive(condition, data) {
  if (!condition) return true;
  const chosen = data[condition.step + '-radio'];
  const expected = Array.isArray(condition.radio) ? condition.radio : [condition.radio];
  return expected.includes(chosen);
}

// Étapes actives avec leur numéro d'origine (1..N) : c'est ce numéro qui sert
// de préfixe aux clés de données.
function getActiveSteps(form, data) {
  return form.steps
    .map((step, i) => ({ step, index: i + 1 }))
    .filter(({ step }) => isActive(step.when, data));
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

// Valide `rawData` contre la définition du formulaire.
// Renvoie { errors: string[], clean: object, fileRefs: [{ step, ids }] }.
function validateSubmission(form, rawData) {
  const input = rawData && typeof rawData === 'object' && !Array.isArray(rawData) ? rawData : {};
  const errors = [];
  const clean = {};
  const fileRefs = [];

  // Le choix radio d'une étape peut conditionner les suivantes : on le lit d'abord.
  const radios = {};
  form.steps.forEach((step, i) => {
    if (step.radio) {
      const value = cleanText(input[i + 1 + '-radio']);
      radios[i + 1 + '-radio'] = value;
    }
  });

  for (const { step, index } of getActiveSteps(form, radios)) {
    if (step.type === 'fields' || step.type === 'mixed') {
      if (step.radio) {
        const key = index + '-radio';
        const value = radios[key];
        if (value && !step.radio.options.includes(value)) {
          errors.push(`Choix invalide pour « ${step.radio.label} ».`);
        } else if (step.radio.req && !value) {
          errors.push(`« ${step.radio.label} » est obligatoire.`);
        }
        if (value && step.radio.options.includes(value)) clean[key] = value;
      }

      (step.fields || []).forEach((field, fi) => {
        if (!isActive(field.when, radios)) return;
        const key = `${index}-field-${fi}`;
        const value = cleanText(input[key]);

        if (field.req && !value) {
          errors.push(`« ${field.label} » est obligatoire.`);
          return;
        }
        if (!value) return;

        if (field.options && !field.options.includes(value)) {
          errors.push(`Valeur invalide pour « ${field.label} ».`);
          return;
        }
        if (field.type === 'email' && !EMAIL_RE.test(value)) {
          errors.push(`« ${field.label} » : adresse e-mail invalide.`);
          return;
        }
        if (field.type === 'date' && !DATE_RE.test(value)) {
          errors.push(`« ${field.label} » : date invalide.`);
          return;
        }
        if (field.type === 'time' && !TIME_RE.test(value)) {
          errors.push(`« ${field.label} » : heure invalide.`);
          return;
        }
        clean[key] = value;
      });
    } else if (step.type === 'checklist') {
      const raw = Array.isArray(input[index + '-checklist']) ? input[index + '-checklist'] : [];
      const picked = raw.map(cleanText).filter((v) => step.items.includes(v));
      clean[index + '-checklist'] = [...new Set(picked)];
    } else if (step.type === 'file-upload') {
      const raw = Array.isArray(input[index + '-files']) ? input[index + '-files'] : [];
      const ids = raw
        .map((f) => (f && typeof f === 'object' ? String(f.id || '') : ''))
        .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
      if (step.max_files && ids.length > step.max_files) {
        errors.push(`« ${step.label} » : ${step.max_files} fichier(s) maximum.`);
      }
      if (step.required && ids.length === 0) {
        errors.push(`« ${step.label} » : au moins un fichier est requis.`);
      }
      if (ids.length) fileRefs.push({ step: index, ids: [...new Set(ids)], config: step });
    }
  }

  return { errors, clean, fileRefs };
}

// Mise en forme lisible (libellés) des données validées, pour l'e-mail et les
// documents PDF/Word : [{ title, rows: [{ label, value }] }]
function describeSubmission(form, clean, filesByStep = {}) {
  const sections = [];
  for (const { step, index } of getActiveSteps(form, clean)) {
    const rows = [];

    if (step.type === 'fields' || step.type === 'mixed') {
      if (step.radio) {
        rows.push({ label: step.radio.label, value: clean[index + '-radio'] || '—' });
      }
      (step.fields || []).forEach((field, fi) => {
        if (!isActive(field.when, clean)) return;
        rows.push({ label: field.label, value: clean[`${index}-field-${fi}`] || '—' });
      });
    } else if (step.type === 'checklist') {
      const picked = clean[index + '-checklist'] || [];
      rows.push({ label: step.label || step.title, value: picked.length ? picked.join(', ') : 'Aucun' });
    } else if (step.type === 'file-upload') {
      const files = filesByStep[index] || [];
      rows.push({
        label: step.label || step.title,
        value: files.length ? files.map((f) => `${f.original_name} (${formatBytes(f.size_bytes)})`).join(', ') : 'Aucun fichier',
      });
    } else {
      continue; // fixed / summary : pas de donnée saisie
    }

    if (rows.length) sections.push({ title: step.title || step.label, rows });
  }
  return sections;
}

function formatBytes(n) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

module.exports = { categoryForms, getForm, isActive, getActiveSteps, validateSubmission, describeSubmission, formatBytes };
