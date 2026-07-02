// Cliente mínimo de la API de MonitoreoCF.
// El dashboard corre en el navegador, por eso apunta al puerto publicado
// de la capa de aplicación y no al nombre interno del contenedor.
const API_URL = `http://${window.location.hostname}:3000/api`;

function getToken() {
  return localStorage.getItem('token');
}

function getUsuario() {
  const raw = localStorage.getItem('usuario');
  return raw ? JSON.parse(raw) : null;
}

function cerrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
}

// Redirige a login si no hay sesión. Llamar al inicio de páginas protegidas.
function requiereSesion() {
  if (!getToken()) window.location.href = 'login.html';
}

async function apiFetch(ruta, opciones = {}) {
  const res = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...opciones.headers,
    },
  });

  // Sesión expirada: solo aplica si había un token guardado
  // (un 401 en el login son credenciales inválidas, no expiración).
  if (res.status === 401 && getToken()) {
    cerrarSesion();
    return;
  }

  const cuerpo = await res.json();
  if (!res.ok) throw new Error(cuerpo.error || `Error ${res.status}`);
  return cuerpo;
}
