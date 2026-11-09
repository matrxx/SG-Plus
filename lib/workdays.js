// Jours ouvrés (France) : week-ends et jours fériés exclus.
//
// Toutes les dates sont des chaînes civiles "AAAA-MM-JJ" (aucun fuseau horaire,
// donc aucun décalage d'un jour possible). Les jours fériés sont calculés
// (Pâques et fêtes mobiles comprises) ; les fermetures exceptionnelles de
// l'établissement (ponts, etc.) se déclarent dans .env :
//   CLOSED_DAYS=2026-05-15,2026-12-24

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ''));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  // refuse 2026-02-31 & co : la date relue doit être identique
  return format(d) === str ? d : null;
}

function format(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(str, n) {
  return format(new Date(parseDate(str).getTime() + n * DAY_MS));
}

// Nombre de jours entre deux dates (b - a)
function diffDays(a, b) {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / DAY_MS);
}

// 0 = dimanche ... 6 = samedi
function weekday(str) {
  return parseDate(str).getUTCDay();
}

// Dimanche de Pâques (algorithme de Meeus / Jones / Butcher)
function easter(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return format(new Date(Date.UTC(year, month - 1, day)));
}

const holidayCache = new Map();

// { 'AAAA-MM-JJ': 'Libellé' } des jours fériés de l'année
function holidays(year) {
  if (holidayCache.has(year)) return holidayCache.get(year);
  const p = easter(year);
  const fixed = (mm, dd, label) => [`${year}-${mm}-${dd}`, label];
  const list = [
    fixed('01', '01', "Jour de l'an"),
    [addDays(p, 1), 'Lundi de Pâques'],
    fixed('05', '01', 'Fête du travail'),
    fixed('05', '08', 'Victoire 1945'),
    [addDays(p, 39), "Jeudi de l'Ascension"],
    [addDays(p, 50), 'Lundi de Pentecôte'],
    fixed('07', '14', 'Fête nationale'),
    fixed('08', '15', 'Assomption'),
    fixed('11', '01', 'Toussaint'),
    fixed('11', '11', 'Armistice 1918'),
    fixed('12', '25', 'Noël'),
  ];
  const map = Object.fromEntries(list);
  holidayCache.set(year, map);
  return map;
}

function closedDays() {
  return new Set(
    String(process.env.CLOSED_DAYS || '')
      .split(/[;,\s]+/)
      .map((s) => s.trim())
      .filter((s) => parseDate(s))
  );
}

// Raison pour laquelle le jour n'est pas ouvré ('Week-end', nom du férié, 'Fermeture'), ou null
function closedReason(str) {
  const w = weekday(str);
  if (w === 0 || w === 6) return 'Week-end';
  const holiday = holidays(Number(str.slice(0, 4)))[str];
  if (holiday) return holiday;
  if (closedDays().has(str)) return 'Fermeture';
  return null;
}

function isWorkingDay(str) {
  return closedReason(str) === null;
}

// Dernier jour ouvré STRICTEMENT avant `str`
function previousWorkingDay(str) {
  let d = addDays(str, -1);
  while (!isWorkingDay(d)) d = addDays(d, -1);
  return d;
}

// Lundi de la semaine qui contient `str`
function mondayOf(str) {
  const w = weekday(str);
  return addDays(str, w === 0 ? -6 : 1 - w);
}

// Date du jour à Paris (et non à l'heure du serveur)
function todayParis(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function hourParis(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false }).format(now)) % 24;
}

// « lundi 10 novembre 2026 »
function longDateFr(str) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseDate(str));
}

module.exports = {
  parseDate, addDays, diffDays, weekday, holidays, closedReason, isWorkingDay,
  previousWorkingDay, mondayOf, todayParis, hourParis, longDateFr,
};
