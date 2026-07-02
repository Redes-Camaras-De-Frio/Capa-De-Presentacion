requiereSesion();

const REFRESCO_MS = 10000;
const UMBRAL_MIN = 2; // la simulación reporta cada 10 s; a los 2 min ya es "sin señal"

const usuario = getUsuario();
// Vista exclusiva del admin.
if (!usuario || usuario.rol !== 'admin') window.location.href = 'index.html';

document.getElementById('usuario-info').textContent = `${usuario.nombre} (${usuario.rol})`;
document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

function formatoFecha(iso) {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatoUptime(seg) {
  if (seg < 3600) return `${Math.floor(seg / 60)} min`;
  const horas = Math.floor(seg / 3600);
  return `${horas} h ${Math.floor((seg % 3600) / 60)} min`;
}

function haceCuanto(minutos) {
  if (minutos === null || minutos === undefined) return 'nunca reportó';
  if (minutos < 1) return 'menos de 1 min';
  if (minutos < 60) return `${minutos} min`;
  if (minutos < 1440) return `${Math.floor(minutos / 60)} h`;
  return `${Math.floor(minutos / 1440)} días`;
}

const BADGE_ESTADO = {
  ok: ['text-bg-success', 'Reportando'],
  sin_senal: ['text-bg-danger', 'Sin señal'],
  inactivo: ['text-bg-secondary', 'Inactivo'],
};

async function cargar() {
  const marca = document.getElementById('ultima-actualizacion');
  try {
    const res = await apiFetch(`/salud?umbral_min=${UMBRAL_MIN}`);
    const d = res.datos;

    pintarEstado('estado-api', d.api.estado === 'ok');
    document.getElementById('api-uptime').textContent =
      d.api.uptimeSeg !== undefined ? `· activa hace ${formatoUptime(d.api.uptimeSeg)}` : '';

    pintarEstado('estado-bd', d.baseDatos.estado === 'ok');
    document.getElementById('bd-latencia').textContent =
      d.baseDatos.latenciaMs !== undefined ? `· ${d.baseDatos.latenciaMs} ms` : '';

    document.getElementById('estado-sensores').textContent =
      `${d.resumen.reportando}/${d.resumen.total}`;
    const sinSenal = document.getElementById('estado-sin-senal');
    sinSenal.textContent = d.resumen.sinSenal;
    sinSenal.className = `fs-4 fw-bold ${d.resumen.sinSenal > 0 ? 'text-danger' : 'text-success'}`;

    document.getElementById('umbral-info').textContent =
      `Umbral: sin lecturas por más de ${d.umbralMin} min = sin señal`;

    pintarSensores(d.sensores);
    marca.textContent = `Actualizado: ${new Date().toLocaleTimeString('es-PE')}`;
  } catch (err) {
    // Si ni la API responde, se refleja aquí en vez de en la card.
    marca.textContent = `Sin respuesta de la API (${err.message})`;
    pintarEstado('estado-api', false);
    pintarEstado('estado-bd', false);
  }
}

function pintarEstado(id, ok) {
  const el = document.getElementById(id);
  el.textContent = ok ? '● En línea' : '● Caída';
  el.className = `fs-4 fw-bold ${ok ? 'text-success' : 'text-danger'}`;
}

function pintarSensores(sensores) {
  const tbody = document.getElementById('tabla-sensores');
  if (!sensores || !sensores.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Sin sensores registrados</td></tr>';
    return;
  }

  tbody.innerHTML = sensores.map((s) => {
    const [clase, etiqueta] = BADGE_ESTADO[s.estado] || BADGE_ESTADO.inactivo;
    return `
      <tr class="${s.estado === 'sin_senal' ? 'table-danger' : ''}">
        <td class="small">${escapeHtml(s.sede_nombre)}</td>
        <td class="small">${escapeHtml(s.camara_nombre)}</td>
        <td>#${s.id} · ${escapeHtml(s.tipo)} <span class="text-muted small">(${escapeHtml(s.unidad)})</span></td>
        <td class="text-muted small">${s.ultima_lectura ? formatoFecha(s.ultima_lectura) : '—'}</td>
        <td class="small">${haceCuanto(s.minutos_sin_reportar)}</td>
        <td><span class="badge ${clase}">${etiqueta}</span></td>
      </tr>`;
  }).join('');
}

cargar();
setInterval(cargar, REFRESCO_MS);
