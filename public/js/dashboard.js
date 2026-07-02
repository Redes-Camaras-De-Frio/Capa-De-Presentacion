requiereSesion();

const REFRESCO_MS = 30000;

const usuario = getUsuario();
document.getElementById('usuario-info').textContent = usuario
  ? `${usuario.nombre} (${usuario.rol})`
  : '';

document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

function formatoFecha(iso) {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

async function cargarDashboard() {
  try {
    const [resumen, camaras, alertas] = await Promise.all([
      apiFetch('/dashboard'),
      apiFetch('/camaras'),
      apiFetch('/alertas?resuelta=false&limite=10'),
    ]);

    pintarKpis(resumen.datos);
    pintarLecturas(resumen.datos.ultimasLecturas, camaras.datos);
    pintarAlertas(alertas.datos);

    document.getElementById('ultima-actualizacion').textContent =
      `Actualizado: ${new Date().toLocaleTimeString('es-PE')}`;
  } catch (err) {
    console.error('Error cargando dashboard:', err.message);
  }
}

function pintarKpis(datos) {
  document.getElementById('kpi-sedes').textContent = datos.sedes;
  document.getElementById('kpi-camaras').textContent = datos.camaras;
  document.getElementById('kpi-sensores').textContent = datos.sensores;
  document.getElementById('kpi-alertas').textContent = datos.alertasActivas;
  document.getElementById('card-alertas')
    .classList.toggle('sin-alertas', datos.alertasActivas === 0);
}

function pintarLecturas(lecturas, camaras) {
  const tbody = document.getElementById('tabla-lecturas');
  if (!lecturas.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Sin lecturas registradas</td></tr>';
    return;
  }

  const rangos = new Map(camaras.map((c) => [c.id, c]));

  tbody.innerHTML = lecturas.map((l) => {
    const camara = rangos.get(l.camara_id);
    const valor = parseFloat(l.valor);
    const fuera = camara && (valor < parseFloat(camara.temp_min) || valor > parseFloat(camara.temp_max));
    const rango = camara ? `${camara.temp_min}°C a ${camara.temp_max}°C` : '—';
    return `
      <tr>
        <td>${escapeHtml(l.camara_nombre)}</td>
        <td class="text-end ${fuera ? 'temp-fuera' : 'temp-ok'}">${valor.toFixed(1)}°C</td>
        <td class="text-muted small">${rango}</td>
        <td class="text-muted small">${formatoFecha(l.registrado_en)}</td>
      </tr>`;
  }).join('');
}

function pintarAlertas(alertas) {
  const tbody = document.getElementById('tabla-alertas');
  if (!alertas.length) {
    tbody.innerHTML = '<tr><td colspan="2" class="text-center text-success py-4">✓ Sin alertas activas</td></tr>';
    return;
  }

  tbody.innerHTML = alertas.map((a) => `
    <tr>
      <td>
        <span class="badge text-bg-danger mb-1">${escapeHtml(a.tipo)}</span>
        <strong class="small ms-1">${escapeHtml(a.camara_nombre)}</strong>
        <div class="small">${escapeHtml(a.mensaje)}</div>
        <div class="text-muted small">${formatoFecha(a.creado_en)}</div>
      </td>
      <td class="text-end">
        <button class="btn btn-outline-success btn-sm" onclick="resolverAlerta(${a.id})">Resolver</button>
      </td>
    </tr>`).join('');
}

async function resolverAlerta(id) {
  try {
    await apiFetch(`/alertas/${id}/resolver`, {
      method: 'PATCH',
      body: JSON.stringify({ usuario_id: usuario.id }),
    });
    cargarDashboard();
  } catch (err) {
    alert(`No se pudo resolver la alerta: ${err.message}`);
  }
}

cargarDashboard();
setInterval(cargarDashboard, REFRESCO_MS);
