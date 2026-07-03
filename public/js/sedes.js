requiereSesion();

const usuario = getUsuario();
// Vista exclusiva del admin.
if (!usuario || usuario.rol !== 'admin') window.location.href = 'index.html';

document.getElementById('usuario-info').textContent = `${usuario.nombre} (${usuario.rol})`;
document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

const UNIDAD_POR_TIPO = {
  temperatura: '°C',
  humedad: '%',
  apertura: 'bool',
  movimiento: 'bool',
  agua: 'bool',
  humo: 'bool',
};

const SENSORES_DEFECTO = ['temperatura', 'humedad', 'apertura'];

let sedes = [];
let camaras = [];
let sensores = [];
let sedeSeleccionada = null;
let camaraSeleccionada = null;

function avisar(mensaje, tipo = 'success') {
  const aviso = document.getElementById('aviso');
  aviso.className = `alert alert-${tipo}`;
  aviso.textContent = mensaje;
  setTimeout(() => aviso.classList.add('d-none'), 4000);
}

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

function mostrarError(id, mensaje) {
  const box = document.getElementById(id);
  box.textContent = mensaje;
  box.classList.remove('d-none');
}

// ── Carga y render ──────────────────────────────────────────────────

async function cargar() {
  try {
    const [resSedes, resCamaras, resSensores] = await Promise.all([
      apiFetch('/sedes'),
      apiFetch('/camaras'),
      apiFetch('/sensores'),
    ]);
    sedes = resSedes.datos;
    camaras = resCamaras.datos;
    sensores = resSensores.datos;
    pintar();
  } catch (err) {
    avisar(`Error cargando catálogo: ${err.message}`, 'danger');
  }
}

function pintar() {
  const cont = document.getElementById('lista-sedes');
  if (!sedes.length) {
    cont.innerHTML = '<div class="text-center text-muted py-5">Sin sedes registradas</div>';
    return;
  }

  cont.innerHTML = sedes.map((sede) => {
    const camarasSede = camaras.filter((c) => c.sede_id === sede.id);
    const filas = camarasSede.map((c) => {
      const sensoresCamara = sensores.filter((s) => s.camara_id === c.id);
      const chips = sensoresCamara.length
        ? sensoresCamara.map((s) =>
            `<span class="badge text-bg-light border me-1">${escapeHtml(s.tipo)}${s.activo ? '' : ' (inactivo)'}</span>`).join('')
        : '<span class="text-danger small">⚠ Sin sensores — no reportará</span>';
      return `
        <tr>
          <td>${escapeHtml(c.nombre)}</td>
          <td class="text-muted small">${c.temp_min}°C a ${c.temp_max}°C</td>
          <td>${chips}</td>
          <td class="text-end">
            <button class="btn btn-outline-primary btn-sm" onclick="abrirSensor(${c.id})">+ Sensor</button>
          </td>
        </tr>`;
    }).join('');

    return `
      <div class="card mb-3">
        <div class="card-header bg-white d-flex justify-content-between align-items-center">
          <div>
            <strong>${escapeHtml(sede.nombre)}</strong>
            <span class="badge text-bg-secondary ms-2">${escapeHtml(sede.tipo)}</span>
            <div class="text-muted small">${escapeHtml(sede.direccion || 'Sin dirección')}</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="abrirCamara(${sede.id})">+ Cámara</button>
        </div>
        ${camarasSede.length ? `
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead class="table-light">
              <tr><th>Cámara</th><th>Rango</th><th>Sensores</th><th></th></tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>` : '<div class="card-body text-muted small">Sin cámaras todavía.</div>'}
      </div>`;
  }).join('');
}

// ── Nueva sede ──────────────────────────────────────────────────────

document.getElementById('form-sede').addEventListener('submit', async (e) => {
  e.preventDefault();
  document.getElementById('error-sede').classList.add('d-none');
  try {
    const res = await apiFetch('/sedes', {
      method: 'POST',
      body: JSON.stringify({
        nombre: document.getElementById('sede-nombre').value.trim(),
        tipo: document.getElementById('sede-tipo').value,
        direccion: document.getElementById('sede-direccion').value.trim() || undefined,
      }),
    });
    bootstrap.Modal.getInstance(document.getElementById('modal-sede')).hide();
    e.target.reset();
    avisar(`Sede creada. Ahora agrégale una cámara con el botón "+ Cámara".`);
    await cargar();
    // Abrir directo el siguiente paso del flujo
    abrirCamara(res.datos.id);
  } catch (err) {
    mostrarError('error-sede', err.message);
  }
});

// ── Nueva cámara (con sensores por defecto) ─────────────────────────

function abrirCamara(sedeId) {
  sedeSeleccionada = sedes.find((s) => s.id === sedeId);
  if (!sedeSeleccionada) return;
  document.getElementById('titulo-camara').textContent = `Nueva cámara en ${sedeSeleccionada.nombre}`;
  document.getElementById('error-camara').classList.add('d-none');
  new bootstrap.Modal(document.getElementById('modal-camara')).show();
}

document.getElementById('form-camara').addEventListener('submit', async (e) => {
  e.preventDefault();
  document.getElementById('error-camara').classList.add('d-none');
  const tempMin = parseFloat(document.getElementById('camara-min').value);
  const tempMax = parseFloat(document.getElementById('camara-max').value);

  try {
    if (tempMin >= tempMax) throw new Error('La temperatura mínima debe ser menor que la máxima');

    const res = await apiFetch('/camaras', {
      method: 'POST',
      body: JSON.stringify({
        sede_id: sedeSeleccionada.id,
        nombre: document.getElementById('camara-nombre').value.trim(),
        temp_min: tempMin,
        temp_max: tempMax,
      }),
    });

    if (document.getElementById('camara-sensores-defecto').checked) {
      for (const tipo of SENSORES_DEFECTO) {
        await apiFetch('/sensores', {
          method: 'POST',
          body: JSON.stringify({ camara_id: res.datos.id, tipo, unidad: UNIDAD_POR_TIPO[tipo] }),
        });
      }
    }

    bootstrap.Modal.getInstance(document.getElementById('modal-camara')).hide();
    e.target.reset();
    avisar('Cámara creada. La simulación la detectará en su próximo ciclo.');
    await cargar();
  } catch (err) {
    mostrarError('error-camara', err.message);
  }
});

// ── Nuevo sensor ────────────────────────────────────────────────────

function abrirSensor(camaraId) {
  camaraSeleccionada = camaras.find((c) => c.id === camaraId);
  if (!camaraSeleccionada) return;
  document.getElementById('titulo-sensor').textContent = `Nuevo sensor en ${camaraSeleccionada.nombre}`;
  document.getElementById('error-sensor').classList.add('d-none');
  new bootstrap.Modal(document.getElementById('modal-sensor')).show();
}

document.getElementById('form-sensor').addEventListener('submit', async (e) => {
  e.preventDefault();
  document.getElementById('error-sensor').classList.add('d-none');
  const tipo = document.getElementById('sensor-tipo').value;
  try {
    await apiFetch('/sensores', {
      method: 'POST',
      body: JSON.stringify({
        camara_id: camaraSeleccionada.id,
        tipo,
        unidad: UNIDAD_POR_TIPO[tipo],
      }),
    });
    bootstrap.Modal.getInstance(document.getElementById('modal-sensor')).hide();
    avisar('Sensor agregado');
    await cargar();
  } catch (err) {
    mostrarError('error-sensor', err.message);
  }
});

cargar();
