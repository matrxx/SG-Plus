// Page de vérification d'e-mail : lit le token dans l'URL et appelle l'API.
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

const messageEl = document.getElementById('message');
const loadingEl = document.getElementById('loading');
const titleEl = document.getElementById('card-title');
const subEl = document.getElementById('card-sub');

// Le titre reflète le résultat (il n'a plus à dire "en cours" une fois terminé)
function showResult(ok, text) {
  titleEl.textContent = ok ? 'Adresse e-mail vérifiée' : 'Vérification impossible';
  subEl.style.display = 'none';
  messageEl.textContent = text;
  messageEl.className = ok ? 'alert alert-success' : 'alert alert-error';
  messageEl.style.display = 'block';
  loadingEl.style.display = 'none';
}

if (!token) {
  showResult(false, 'Token manquant. Veuillez vérifier le lien.');
} else {
  // Appeler l'API pour vérifier l'e-mail
  fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        throw new Error(data.error);
      }
      showResult(true, data.message || 'Votre compte a été activé avec succès !');

      // Rediriger après 3 secondes
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    })
    .catch((err) => {
      showResult(false, err.message);
    });
}
