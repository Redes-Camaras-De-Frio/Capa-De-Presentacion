// Si ya hay sesión, ir directo al dashboard.
if (getToken()) window.location.href = 'index.html';

const form = document.getElementById('form-login');
const errorBox = document.getElementById('error');
const btn = document.getElementById('btn-login');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.classList.add('d-none');
  btn.disabled = true;
  btn.textContent = 'Ingresando…';

  try {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
      }),
    });

    localStorage.setItem('token', res.datos.token);
    localStorage.setItem('usuario', JSON.stringify(res.datos.usuario));
    window.location.href = 'index.html';
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('d-none');
    btn.disabled = false;
    btn.textContent = 'Ingresar';
  }
});
