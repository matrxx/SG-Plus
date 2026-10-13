// Délégation d'événements pour les attributs data-onclick / data-oninput /
// data-onchange / data-onenter.
//
// Pourquoi : la politique de sécurité (CSP) envoyée par le serveur interdit
// les gestionnaires en ligne (onclick="..."), qui sont la porte d'entrée
// habituelle des attaques XSS. Le HTML porte donc l'appel sous la forme
// data-onclick="nomDeFonction('argument', 12, this)" ; ce script le lit et
// appelle la fonction globale correspondante, SANS eval ni Function().
//
// Syntaxe acceptée : un seul appel nom(arg, arg, ...) avec des arguments
// littéraux : chaîne 'x' ou "x", nombre, true, false, null, this.
//
// Clavier : un élément portant data-onclick ET tabindex (carte, étape, case à
// cocher…) se déclenche aussi à Entrée / Espace ; data-onenter="fn()" sur un
// champ déclenche fn à la touche Entrée.

(function () {
  const CALL_RE = /^\s*([A-Za-z_$][\w$]*)\s*\(([\s\S]*)\)\s*;?\s*$/;
  const cache = new Map();

  function parseArgs(src) {
    const args = [];
    let i = 0;
    const n = src.length;
    while (i < n) {
      while (i < n && /[\s,]/.test(src[i])) i++;
      if (i >= n) break;
      const ch = src[i];
      if (ch === "'" || ch === '"') {
        let out = '';
        i++;
        while (i < n && src[i] !== ch) {
          if (src[i] === '\\' && i + 1 < n) {
            out += src[i + 1];
            i += 2;
          } else {
            out += src[i++];
          }
        }
        i++; // guillemet fermant
        args.push({ type: 'value', value: out });
      } else {
        let j = i;
        while (j < n && src[j] !== ',') j++;
        const token = src.slice(i, j).trim();
        i = j;
        if (token === 'this') args.push({ type: 'this' });
        else if (token === 'true') args.push({ type: 'value', value: true });
        else if (token === 'false') args.push({ type: 'value', value: false });
        else if (token === 'null') args.push({ type: 'value', value: null });
        else if (token !== '' && !Number.isNaN(Number(token))) args.push({ type: 'value', value: Number(token) });
        else throw new Error('Argument non supporté : ' + token);
      }
    }
    return args;
  }

  function parseCall(expression) {
    let parsed = cache.get(expression);
    if (parsed) return parsed;
    const match = CALL_RE.exec(expression);
    if (!match) throw new Error('Appel non supporté : ' + expression);
    parsed = { name: match[1], args: parseArgs(match[2]) };
    cache.set(expression, parsed);
    return parsed;
  }

  // Appelle la fonction globale décrite par `expression`, avec `el` comme `this`.
  function invoke(el, expression) {
    try {
      const { name, args } = parseCall(expression);
      const fn = window[name];
      if (typeof fn !== 'function') {
        console.error('[ui-events] Fonction introuvable :', name);
        return;
      }
      fn.apply(el, args.map((a) => (a.type === 'this' ? el : a.value)));
    } catch (err) {
      console.error('[ui-events]', err);
    }
  }

  function dispatch(eventType, event) {
    const attr = 'data-on' + eventType;
    const el = event.target.closest && event.target.closest('[' + attr + ']');
    if (!el) return;
    invoke(el, el.getAttribute(attr));
  }

  ['click', 'input', 'change'].forEach((type) => {
    document.addEventListener(type, (event) => dispatch(type, event));
  });

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (!target || !target.hasAttribute) return;

    // Entrée dans un champ : déclenche son action (connexion, recherche…)
    if (event.key === 'Enter' && target.hasAttribute('data-onenter')) {
      event.preventDefault();
      invoke(target, target.getAttribute('data-onenter'));
      return;
    }

    // Entrée / Espace sur un contrôle personnalisé focalisable
    if ((event.key === 'Enter' || event.key === ' ') && target.hasAttribute('data-onclick') && target.hasAttribute('tabindex')) {
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName)) return;
      event.preventDefault(); // Espace ne doit pas faire défiler la page
      invoke(target, target.getAttribute('data-onclick'));
    }
  });
})();
