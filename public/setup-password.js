// Page de définition du mot de passe d'un compte valideur (lien reçu par e-mail).
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

if (!token) {
  document.getElementById('message').textContent = 'Token manquant. Veuillez vérifier le lien.';
  document.getElementById('message').className = 'alert alert-error';
  document.getElementById('message').style.display = 'block';
  document.getElementById('setupForm').style.display = 'none';
}

document.getElementById('setupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const submitBtn = document.getElementById('submitBtn');
  const messageEl = document.getElementById('message');

  if (password !== confirmPassword) {
    messageEl.textContent = 'Les mots de passe ne correspondent pas.';
    messageEl.className = 'alert alert-error';
    messageEl.style.display = 'block';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'En cours...';

  try {
    const response = await fetch('/api/auth/setup-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Une erreur est survenue.');
    }

    messageEl.textContent = data.message || 'Votre mot de passe a été configuré avec succès.';
    messageEl.className = 'alert alert-success';
    messageEl.style.display = 'block';
    document.getElementById('setupForm').style.display = 'none';

    // Rediriger après 3 secondes
    setTimeout(() => {
      window.location.href = '/';
    }, 3000);
  } catch (err) {
    messageEl.textContent = err.message;
    messageEl.className = 'alert alert-error';
    messageEl.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Configurer le mot de passe';
  }
});
