#!/usr/bin/env bash
# Met à jour Nestor-C2 depuis GitHub.   Usage : npm run update
#
#  - Première fois (dossier pas encore relié à GitHub) : relie le dossier au dépôt
#    SANS toucher au .env ; une sauvegarde complète du dossier est faite avant.
#  - Ensuite : récupère les nouveautés (git, jamais de suppression forcée),
#    lance npm install seulement si package.json a changé, puis les migrations.
#
# Variables facultatives :
#   NESTOR_REPO     adresse du dépôt   (défaut : https://github.com/matrxx/SG-Plus)
#   NESTOR_BRANCH   branche suivie     (défaut : Portail-C2RMF)
#   NESTOR_SKIP_NPM=1   ne lance ni npm install ni la migration (tests)
#
# Appel hors du dossier du projet (premier lancement) :
#   bash /tmp/update.sh "/chemin/vers/le/projet"

set -Eeuo pipefail

REPO_URL="${NESTOR_REPO:-https://github.com/matrxx/SG-Plus}"
BRANCH="${NESTOR_BRANCH:-Portail-C2RMF}"

if [ -n "${1:-}" ]; then
  APP_DIR="$1"
else
  APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
cd "$APP_DIR"

say()  { printf '[update] %s\n' "$*"; }
retry() { local n; for n in 1 2 3; do "$@" && return 0; [ "$n" -lt 3 ] && sleep 3; done; return 1; }

# Si l'opération de première connexion échoue en route, on retire le dépôt
# à moitié créé : le dossier retrouve son état d'avant (rien n'est à nettoyer à la main).
CREATED_GIT=0
on_exit() {
  local rc=$?
  if [ "$rc" -ne 0 ] && [ "$CREATED_GIT" = "1" ]; then
    rm -rf .git
    printf '%s\n' "[update] Connexion interrompue : le dossier est revenu à son état initial (sauvegarde : ${ARCHIVE:-aucune})." >&2
  fi
}
trap on_exit EXIT
trap 'printf "[update] ERREUR ligne %s (commande : %s)\n" "$LINENO" "$BASH_COMMAND" >&2' ERR
fail() { printf '[update] ERREUR : %s\n' "$*" >&2; exit 1; }

[ -f package.json ] && [ -f server.js ] || fail "$APP_DIR ne ressemble pas au dossier du projet (package.json / server.js introuvables)."
command -v git >/dev/null 2>&1 || fail "git n'est pas installé. Installez-le avec : sudo apt install git"

say "Dossier : $APP_DIR"
say "Dépôt   : $REPO_URL (branche $BRANCH)"

# --- Le dépôt répond-il ? (proxy, réseau, droits) -----------------------------
REACHABLE=0
for attempt in 1 2 3; do
  if git ls-remote --exit-code "$REPO_URL" "refs/heads/$BRANCH" >/dev/null 2>&1; then REACHABLE=1; break; fi
  [ "$attempt" -lt 3 ] && { say "GitHub ne répond pas (tentative $attempt/3), nouvel essai..."; sleep 3; }
done
if [ "$REACHABLE" != "1" ]; then
  printf '%s\n' \
    "[update] ERREUR : impossible de lire $REPO_URL (branche $BRANCH)." \
    "         - Derrière le proxy de l'entreprise, lancez une fois :" \
    "             git config --global http.proxy http://proxy.culture.fr:8000" \
    "         - Si le dépôt est privé, git demandera un identifiant (jeton d'accès) : relancez dans un terminal interactif." >&2
  exit 1
fi

# --- Sauvegarde du .env avant toute opération (rempli de vraies valeurs) -------
BACKUP_DIR="$HOME/.nestor-backups"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
ENV_BAK=""
if [ -f .env ]; then
  ENV_BAK="$BACKUP_DIR/env-$STAMP"
  cp -p .env "$ENV_BAK"
  chmod 600 "$ENV_BAK"
fi

# Garde seulement les 10 dernières sauvegardes du .env
ls -1t "$BACKUP_DIR"/env-* 2>/dev/null | tail -n +11 | while read -r old; do rm -f "$old"; done

protect_env_files() {
  # Fichiers de configuration éventuellement suivis par le dépôt : jamais écrasés ici.
  local f
  for f in .env exemple.env; do
    if [ -e "$f" ] && git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
      git update-index --skip-worktree "$f"
    fi
  done
}

check_env_untouched() {
  if [ -n "$ENV_BAK" ] && ! cmp -s "$ENV_BAK" .env; then
    cp -p "$ENV_BAK" .env
    say "ATTENTION : le .env avait été modifié par la mise à jour, il a été restauré à l'identique."
  fi
}

# --- Première fois : relier le dossier au dépôt ---------------------------------
if [ ! -d .git ]; then
  say "Ce dossier n'est pas encore relié à GitHub : connexion (première fois)."
  ARCHIVE="$BACKUP_DIR/projet-$STAMP.tgz"
  tar czf "$ARCHIVE" --exclude=./node_modules --exclude=./.devdb --exclude=./uploads . 2>/dev/null || true
  chmod 600 "$ARCHIVE" 2>/dev/null || true
  say "Sauvegarde du dossier actuel : $ARCHIVE"

  git init -q
  CREATED_GIT=1
  git remote add origin "$REPO_URL"
  retry git fetch -q origin "$BRANCH"
  git symbolic-ref HEAD "refs/heads/$BRANCH"
  # "mixed" : l'index prend l'état du dépôt, les fichiers du disque ne bougent pas.
  git reset -q "origin/$BRANCH"
  git branch -q --set-upstream-to="origin/$BRANCH" "$BRANCH"
  git config pull.ff only
  protect_env_files
  # Les fichiers du projet prennent la version GitHub, sauf .env / exemple.env.
  git restore --source=HEAD --worktree -- . ':(exclude).env' ':(exclude)exemple.env'
  check_env_untouched
  CREATED_GIT=0
  say "Dossier relié à GitHub et mis à jour."
  CHANGED_PKG=1
else
  [ "$(git symbolic-ref --short -q HEAD || true)" = "$BRANCH" ] || fail "la branche locale n'est pas $BRANCH (git checkout $BRANCH puis relancez)."
  protect_env_files
  retry git fetch -q origin "$BRANCH"
  if [ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BRANCH")" ]; then
    say "Déjà à jour ($(git rev-parse --short HEAD))."
    CHANGED_PKG=0
  else
    CHANGED_FILES="$(git diff --name-only HEAD "origin/$BRANCH")"
    if ! git merge -q --ff-only "origin/$BRANCH"; then
      printf '%s\n' \
        "[update] ERREUR : mise à jour impossible sans écraser des modifications faites sur ce serveur :" >&2
      git status --short --untracked-files=no >&2 || true
      fail "mettez ces fichiers de côté (git stash) puis relancez npm run update."
    fi
    check_env_untouched
    say "Fichiers mis à jour :"
    printf '%s\n' "$CHANGED_FILES" | sed 's/^/           /'
    if printf '%s\n' "$CHANGED_FILES" | grep -qE '^package(-lock)?\.json$'; then CHANGED_PKG=1; else CHANGED_PKG=0; fi
  fi
fi

# --- Dépendances et base de données -----------------------------------------------
if [ "${NESTOR_SKIP_NPM:-0}" != "1" ]; then
  if [ "$CHANGED_PKG" = "1" ] || [ ! -d node_modules ]; then
    say "package.json modifié : npm install"
    npm install --no-audit --no-fund
  fi
  say "Migrations de la base de données"
  npm run -s migrate || say "ATTENTION : la migration a échoué (la base est-elle démarrée ? npm run dev-db). Relancez npm run update ensuite."
fi

say "Version en place : $(git log -1 --format='%h %ad %s' --date=short)"
say "Le serveur (nodemon) redémarre tout seul ; les pages web sont servies à jour sans redémarrage."
say "Terminé."
