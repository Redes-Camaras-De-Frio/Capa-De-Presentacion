requiereSesion();

const usuario = getUsuario();
// Vista exclusiva del admin: cualquier otro rol vuelve al panel.
if (!usuario || usuario.rol !== 'admin') window.location.href = 'index.html';

document.getElementById('usuario-info').textContent = `${usuario.nombre} (${usuario.rol})`;
document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

let sedes = [];
let usuarios = [];
let usuarioEditando = null;

function avisar(mensaje, tipo = 'success') {
  const aviso = document.getElementById('aviso');
  aviso.className = `alert alert-${tipo}`;
  aviso.textContent = mensaje;
  setTimeout(() => aviso.classList.add('d-none'), 4000);
}

function nombreSede(id) {
  const sede = sedes.find((s) => s.id === id);
  return sede ? sede.nombre : `Sede ${id}`;
}

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// ── Carga y render ──────────────────────────────────────────────────

async function cargar() {
  try {
    const [resSedes, resUsuarios] = await Promise.all([
      apiFetch('/sedes'),
      apiFetch('/usuarios'),
    ]);
    sedes = resSedes.datos;
    usuarios = resUsuarios.datos;
    pintarCheckboxesSedes(document.getElementById('crear-sedes'), []);
    pintarTabla();
  } catch (err) {
    avisar(`Error cargando datos: ${err.message}`, 'danger');
  }
}

function pintarTabla() {
  const tbody = document.getElementById('tabla-usuarios');
  tbody.innerHTML = usuarios.map((u) => {
    const sedesTexto = u.rol === 'admin'
      ? '<span class="text-muted">Todas</span>'
      : (u.sedes.length
          ? u.sedes.map((id) => `<span class="badge text-bg-light border me-1">${escapeHtml(nombreSede(id))}</span>`).join('')
          : '<span class="text-danger small">Sin sedes</span>');

    const esYo = u.id === usuario.id;
    return `
      <tr class="${u.activo ? '' : 'table-secondary'}">
        <td>
          <strong>${escapeHtml(u.nombre)}</strong>${esYo ? ' <span class="badge text-bg-info">tú</span>' : ''}
          <div class="text-muted small">${escapeHtml(u.email)}</div>
        </td>
        <td><span class="badge ${u.rol === 'admin' ? 'text-bg-dark' : 'text-bg-primary'}">${escapeHtml(u.rol)}</span></td>
        <td>${sedesTexto}</td>
        <td>
          <span class="badge ${u.activo ? 'text-bg-success' : 'text-bg-secondary'}">${u.activo ? 'Activo' : 'Inactivo'}</span>
        </td>
        <td class="text-end">
          ${u.rol !== 'admin' ? `<button class="btn btn-outline-primary btn-sm me-1" onclick="abrirSedes(${u.id})">Sedes</button>` : ''}
          ${esYo ? '' : `<button class="btn btn-outline-${u.activo ? 'danger' : 'success'} btn-sm" onclick="cambiarActivo(${u.id}, ${!u.activo})">${u.activo ? 'Desactivar' : 'Activar'}</button>`}
        </td>
      </tr>`;
  }).join('');
}

function pintarCheckboxesSedes(contenedor, seleccionadas) {
  contenedor.replaceChildren();
  sedes.forEach((s) => {
    const label = document.createElement('label');
    label.className = 'form-check form-check-inline mb-0';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'form-check-input';
    input.value = s.id;
    input.checked = seleccionadas.includes(s.id);
    const texto = document.createElement('span');
    texto.className = 'form-check-label';
    texto.textContent = s.nombre;
    label.append(input, texto);
    contenedor.appendChild(label);
  });
}

function sedesMarcadas(contenedor) {
  return [...contenedor.querySelectorAll('input:checked')].map((i) => parseInt(i.value, 10));
}

// ── Crear usuario ───────────────────────────────────────────────────

document.getElementById('crear-rol').addEventListener('change', (e) => {
  document.getElementById('grupo-sedes').style.display = e.target.value === 'admin' ? 'none' : '';
});

document.getElementById('form-crear').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('error-crear');
  errorBox.classList.add('d-none');
  const btn = document.getElementById('btn-crear');
  btn.disabled = true;

  const rol = document.getElementById('crear-rol').value;
  const seleccion = sedesMarcadas(document.getElementById('crear-sedes'));

  try {
    if (rol === 'operador' && seleccion.length === 0) {
      throw new Error('Un operador necesita al menos una sede asignada');
    }
    await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        nombre: document.getElementById('crear-nombre').value.trim(),
        email: document.getElementById('crear-email').value.trim(),
        password: document.getElementById('crear-password').value,
        rol,
        ...(rol === 'operador' ? { sedes: seleccion } : {}),
      }),
    });
    bootstrap.Modal.getInstance(document.getElementById('modal-crear')).hide();
    e.target.reset();
    document.getElementById('grupo-sedes').style.display = '';
    avisar('Usuario creado correctamente');
    await cargar();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('d-none');
  } finally {
    btn.disabled = false;
  }
});

// ── Activar / desactivar ────────────────────────────────────────────

async function cambiarActivo(id, activo) {
  try {
    await apiFetch(`/usuarios/${id}/activo`, {
      method: 'PATCH',
      body: JSON.stringify({ activo }),
    });
    avisar(activo ? 'Usuario activado' : 'Usuario desactivado');
    await cargar();
  } catch (err) {
    avisar(err.message, 'danger');
  }
}

// ── Editar sedes ────────────────────────────────────────────────────

function abrirSedes(id) {
  usuarioEditando = usuarios.find((u) => u.id === id);
  if (!usuarioEditando) return;
  document.getElementById('titulo-sedes').textContent = `Sedes de ${usuarioEditando.nombre}`;
  document.getElementById('error-sedes').classList.add('d-none');
  pintarCheckboxesSedes(document.getElementById('editar-sedes'), usuarioEditando.sedes);
  new bootstrap.Modal(document.getElementById('modal-sedes')).show();
}

document.getElementById('form-sedes').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('error-sedes');
  errorBox.classList.add('d-none');
  try {
    await apiFetch(`/usuarios/${usuarioEditando.id}/sedes`, {
      method: 'PUT',
      body: JSON.stringify({ sedes: sedesMarcadas(document.getElementById('editar-sedes')) }),
    });
    bootstrap.Modal.getInstance(document.getElementById('modal-sedes')).hide();
    avisar('Sedes actualizadas');
    await cargar();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('d-none');
  }
});

cargar();
