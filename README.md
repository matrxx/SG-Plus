# Nestor-C2 — Portail de Services Internes

> Un portail sécurisé pour la gestion des demandes internes (arrivées/départs, fournitures, etc.)

## 📌 À propos

**Nestor-C2** est une application web conçue pour les organisations souhaitant centraliser et simplifier la gestion des demandes internes. Elle permet aux agents de soumettre des formulaires (ex: arrivée/départ, commandes de fournitures) et aux valideurs de les traiter.

### Fonctionnalités clés
- ✅ **Authentification sécurisée** : Inscription avec vérification par e-mail, connexion par mot de passe (haché en Argon2id)
- ✅ **Gestion des rôles** : Agents, Valideurs, Administrateurs
- ✅ **Formulaires personnalisables** : Catégories et types de demandes configurables
- ✅ **Restriction réseau** : Accès limité au réseau interne de l'organisation
- ✅ **Suivi des demandes** : Historique des statuts et notifications
- ✅ **Réinitialisation de mot de passe** : Lien sécurisé envoyé par e-mail

---

## 🚀 Installation

### Prérequis
- [Node.js](https://nodejs.org/) ≥ 18.x
- [PostgreSQL](https://www.postgresql.org/) ≥ 13
- Un serveur SMTP interne (pour l'envoi d'e-mails)
- Accès au réseau interne de l'organisation

### 1. Cloner le dépôt
```bash
git clone https://github.com/sdellupo-dotcom/Nestor-C2.git
cd Nestor-C2
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configurer l'environnement
Copiez le fichier `.env.example` en `.env` et renseignez les variables :
```bash
cp .env.example .env
nano .env  # ou utilisez votre éditeur préféré
```

#### Variables d'environnement requises
| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL de connexion PostgreSQL | `postgresql://user:password@localhost:5432/nestor_c2` |
| `SESSION_SECRET` | Clé secrète pour les sessions | `votre_clé_sécrète_ici` |
| `ALLOWED_EMAIL_DOMAIN` | Domaine e-mail autorisé (séparés par des virgules) | `mon-entreprise.com` |
| `ALLOWED_IP_RANGES` | Plages IP autorisées (format CIDR) | `10.0.0.0/8,192.168.0.0/16` |
| `PUBLIC_BASE_URL` | URL publique du portail | `https://portail.mon-entreprise.com` |
| `SMTP_HOST` | Hôte SMTP | `smtp.mon-entreprise.com` |
| `SMTP_PORT` | Port SMTP | `587` |
| `SMTP_USER` | Utilisateur SMTP | `portail@mon-entreprise.com` |
| `SMTP_PASSWORD` | Mot de passe SMTP | `votre_mot_de_passe` |
| `SMTP_SECURE` | Utiliser TLS (true/false) | `false` |
| `USE_HTTPS` | Activer HTTPS (true/false) | `true` |
| `TLS_KEY_PATH` | Chemin vers la clé TLS | `/etc/ssl/private/portail.key` |
| `TLS_CERT_PATH` | Chemin vers le certificat TLS | `/etc/ssl/certs/portail.crt` |
| `PGSSL` | Activer SSL pour PostgreSQL (true/false) | `true` |

### 4. Initialiser la base de données
```bash
# Appliquer le schéma
npm run migrate
```

### 5. Créer le premier compte administrateur
```bash
npm run create-admin prenom.nom@mon-entreprise.com "Prénom" "Nom"
```
> ⚠️ **Important** : Ce script vous demandera de saisir un mot de passe de manière interactive.

### 6. Générer un certificat TLS (optionnel, pour HTTPS)
```bash
bash generate-self-signed-cert.sh
```
> Ce script génère un certificat auto-signé. Pour un environnement de production, utilisez un certificat valide (Let's Encrypt, etc.).

---

## 🏃 Démarrage

### Développement (HTTP)
```bash
npm run dev
```
> Le serveur démarrera sur `http://localhost:3000` (accès restreint aux IP locales).

### Production (HTTPS)
```bash
USE_HTTPS=true npm start
```
> Le serveur démarrera sur `https://localhost:3000` (ou le port spécifié dans `.env`).

---

## 📂 Structure du projet

```
Nestor-C2/
├── db/
│   ├── schema.sql          # Schéma PostgreSQL
│   ├── pool.js             # Connexion à la base de données
│   ├── migrate.js          # Script de migration
│   └── create-admin.js     # Script de création de l'admin
├── middleware/
│   ├── requireAuth.js      # Vérifie la session utilisateur
│   ├── requireRole.js      # Vérifie le rôle utilisateur
│   └── restrictToLan.js    # Restreint l'accès au réseau interne
├── routes/
│   ├── auth.js             # Routes d'authentification
│   ├── requests.js         # Routes de gestion des demandes
│   └── admin.js            # Routes d'administration
├── utils/
│   ├── tokens.js           # Génération et hachage des tokens
│   ├── mailer.js           # Envoi d'e-mails
│   └── emailDomain.js      # Validation des domaines e-mail
├── public/
│   ├── index.html          # Page principale (à créer)
│   ├── verify-email.html   # Page de vérification e-mail
│   ├── reset-password.html # Page de réinitialisation
│   └── setup-password.html # Page de configuration mot de passe
├── .env.example            # Exemple de configuration
├── .gitignore              # Fichiers à ignorer
├── package.json            # Dépendances et scripts
├── server.js               # Serveur Express principal
└── README.md               # Ce fichier
```

---

## 🔒 Sécurité

### Bonnes pratiques appliquées
- ❌ **Pas de mots de passe en clair** : Tous les mots de passe sont hachés avec **Argon2id** (résistant aux attaques par GPU).
- ❌ **Pas de fuite d'informations** : Les messages d'erreur sont génériques pour éviter l'énumération de comptes.
- ❌ **Tokens à usage unique** : Les liens de vérification et de réinitialisation expirent et ne peuvent être réutilisés.
- ❌ **Restriction réseau** : L'accès est limité aux IP internes (configurable via `ALLOWED_IP_RANGES`).
- ❌ **Sessions sécurisées** : Les cookies de session sont `httpOnly`, `secure` (en HTTPS) et `sameSite=lax`.
- ❌ **Rate limiting** : Protection contre les attaques par force brute sur les routes d'authentification.

### Recommandations supplémentaires
1. **Ne pas exposer le serveur sur Internet** : Utilisez un réseau interne ou un VPN.
2. **Utiliser HTTPS** : Même en interne, activez `USE_HTTPS=true` pour chiffrer le trafic.
3. **Sauvegarder la base de données** : Effectuez des sauvegardes régulières de la base PostgreSQL.
4. **Mettre à jour les dépendances** : Exécutez `npm audit` régulièrement.
5. **Configurer un reverse proxy** (optionnel) : Pour ajouter une couche de sécurité supplémentaire (ex: Nginx avec fail2ban).

---

## 📡 API Endpoints

### Authentification
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/signup` | Inscription (auto-vérification par e-mail) |
| GET | `/api/auth/verify-email?token=...` | Vérifier l'e-mail |
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/logout` | Déconnexion |
| POST | `/api/auth/forgot-password` | Demander une réinitialisation |
| POST | `/api/auth/reset-password` | Réinitialiser le mot de passe |
| POST | `/api/auth/setup-password` | Configurer le mot de passe (valideurs) |
| GET | `/api/auth/me` | Vérifier la session active |

### Demandes
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/requests` | Lister mes demandes |
| POST | `/api/requests` | Créer une demande |
| GET | `/api/requests/:id` | Détails d'une demande |
| PUT | `/api/requests/:id` | Mettre à jour une demande |
| DELETE | `/api/requests/:id` | Supprimer une demande (brouillon uniquement) |

### Administration (Admin uniquement)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/admin/validators` | Lister les valideurs |
| POST | `/api/admin/validators` | Créer un valideur |
| GET | `/api/admin/validators/:userId/categories` | Lister les catégories d'un valideur |
| POST | `/api/admin/validators/:userId/categories` | Associer une catégorie |
| DELETE | `/api/admin/validators/:userId/categories/:categoryKey` | Retirer une catégorie |
| GET | `/api/admin/requests` | Lister toutes les demandes |

---

## 🛠️ Développement

### Frontend
Les pages statiques sont servies depuis le dossier `public/`. Vous pouvez utiliser n'importe quel framework (React, Vue, Svelte) ou du HTML/CSS/JS pur.

#### Exemple de structure pour `public/index.html`
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Portail Services Internes</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="app"></div>
  <script src="/app.js"></script>
</body>
</html>
```

### Backend
Le backend utilise **Express.js** avec une architecture modulaire :
- **Routes** : Dans `routes/` (auth, requests, admin)
- **Middleware** : Dans `middleware/` (authentification, rôles, restriction IP)
- **Utilitaires** : Dans `utils/` (tokens, e-mails, validation)
- **Base de données** : PostgreSQL avec `pg` (pool de connexions)

---

## 🐛 Dépannage

### Problèmes courants

#### 1. Erreur de connexion à PostgreSQL
```
Error: Connection refused
```
**Solution** :
- Vérifiez que PostgreSQL est en cours d'exécution (`sudo systemctl status postgresql`).
- Vérifiez les informations de connexion dans `DATABASE_URL`.
- Si vous utilisez SSL, assurez-vous que `PGSSL=true` est défini.

#### 2. Erreur SMTP
```
Error: getaddrinfo ENOTFOUND
```
**Solution** :
- Vérifiez `SMTP_HOST` et `SMTP_PORT` dans `.env`.
- Testez la connexion SMTP avec `telnet` :
  ```bash
  telnet smtp.mon-entreprise.com 587
  ```

#### 3. Accès refusé (403)
```
Accès refusé : ce service est réservé au réseau interne.
```
**Solution** :
- Vérifiez que votre IP est dans `ALLOWED_IP_RANGES`.
- Si vous testez en local, ajoutez `127.0.0.1/32` à `ALLOWED_IP_RANGES`.

#### 4. Certificat TLS invalide
```
Error: unable to verify the first certificate
```
**Solution** :
- Si vous utilisez un certificat auto-signé, assurez-vous que `USE_HTTPS=true` et que les chemins `TLS_KEY_PATH` et `TLS_CERT_PATH` sont corrects.
- Pour ignorer les erreurs de certificat (développement uniquement), ajoutez `NODE_TLS_REJECT_UNAUTHORIZED=0` à `.env`.

---

## 📜 Licence

MIT © [sdellupo-dotcom](https://github.com/sdellupo-dotcom)
