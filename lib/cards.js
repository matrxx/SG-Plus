// Règles de réservation des cartes ICOM / ICOMOS.
//
//  - Une réservation dure au plus 1 semaine (7 jours entre le retrait et la
//    restitution), ou 3 semaines (21 jours) pour un départ en vacances ou en
//    déplacement (motif à préciser).
//  - Le retrait et la restitution se font un jour ouvré (ni week-end ni férié).
//  - Rappel par e-mail 1 jour ouvré avant la restitution.
//  Les durées se règlent dans .env : CARDS_MAX_DAYS (7) et CARDS_MAX_DAYS_EXTENDED (21).

const { parseDate, diffDays, addDays, isWorkingDay, previousWorkingDay, closedReason, longDateFr } = require('./workdays');

const KINDS = ['ICOM', 'ICOMOS'];
const REASONS = ['vacances', 'deplacement'];
const REASON_LABELS = { vacances: 'départ en vacances', deplacement: 'déplacement' };
const MAX_AHEAD_DAYS = 180; // pas de réservation plus de 6 mois à l'avance

function rules() {
  const int = (v, d) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : d);
  const maxDays = int(process.env.CARDS_MAX_DAYS, 7);
  return {
    maxDays,
    maxDaysExtended: Math.max(maxDays, int(process.env.CARDS_MAX_DAYS_EXTENDED, 21)),
    maxAheadDays: MAX_AHEAD_DAYS,
  };
}

// Valide une période. Renvoie { error } ou { extended, days } (days = jours entre retrait et restitution).
function validatePeriod({ startDate, endDate, reason }, today) {
  const r = rules();
  if (!parseDate(startDate) || !parseDate(endDate)) return { error: 'Les dates sont invalides.' };
  if (startDate < today) return { error: 'Le retrait ne peut pas être dans le passé.' };
  if (diffDays(today, startDate) > r.maxAheadDays) return { error: 'La réservation ne peut pas dépasser 6 mois à l\'avance.' };
  if (endDate < startDate) return { error: 'La restitution doit avoir lieu après le retrait.' };

  for (const [label, date] of [['Le retrait', startDate], ['La restitution', endDate]]) {
    const closed = closedReason(date);
    if (closed) return { error: `${label} doit avoir lieu un jour ouvré : le ${longDateFr(date)} est fermé (${closed.toLowerCase()}).` };
  }

  const days = diffDays(startDate, endDate);
  if (days > r.maxDaysExtended) {
    return { error: `La durée maximale est de ${r.maxDaysExtended / 7} semaines, même en cas de vacances ou de déplacement.` };
  }
  const extended = days > r.maxDays;
  if (extended && !REASONS.includes(reason)) {
    return { error: `Au-delà d'une semaine, indiquez le motif : départ en vacances ou en déplacement (${r.maxDaysExtended / 7} semaines maximum).` };
  }
  return { extended, days };
}

// Jour du rappel : le jour ouvré qui précède la restitution. Si ce jour tombe avant
// le retrait (réservation très courte), le rappel part le jour du retrait.
function reminderDateFor(startDate, endDate) {
  const before = previousWorkingDay(endDate);
  return before < startDate ? startDate : before;
}

module.exports = { KINDS, REASONS, REASON_LABELS, rules, validatePeriod, reminderDateFor, addDays, isWorkingDay };
