requiereSesion();

const REFRESCO_MS = 10000;
const SVG_NS = 'http://www.w3.org/2000/svg';

const usuario = getUsuario();
document.getElementById('usuario-info').textContent = usuario
  ? `${usuario.nombre} (${usuario.rol})`
  : '';
document.getElementById('btn-logout').addEventListener('click', cerrarSesion);
if (usuario && usuario.rol === 'admin') {
  document.getElementById('nav-usuarios').classList.remove('d-none');
  document.getElementById('nav-salud').classList.remove('d-none');
}

// ── Estado ──────────────────────────────────────────────────────────

const estado = {
  sedes: [],
  camaras: [],
  sensores: [],
  alertas: [],
  ultimasLecturas: [],
  lecturasChart: [],
  filtroSede: '',
  filtroCamara: '',
  filtroTipo: '',
};

const ETIQUETAS_TIPO = {
  temp_alta: 'Temperatura alta',
  temp_baja: 'Temperatura baja',
  humedad_alta: 'Humedad alta',
  apertura: 'Apertura de puerta',
  movimiento: 'Movimiento',
  agua: 'Agua / fuga',
  humo: 'Humo',
  sin_senal: 'Sin señal',
};

const BADGE_TIPO = {
  temp_alta: 'text-bg-danger',
  temp_baja: 'text-bg-danger',
  humedad_alta: 'text-bg-warning',
  apertura: 'text-bg-warning',
  movimiento: 'text-bg-secondary',
  agua: 'text-bg-danger',
  humo: 'text-bg-danger',
  sin_senal: 'text-bg-secondary',
};

// ── Utilidades ──────────────────────────────────────────────────────

function formatoFecha(iso) {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function formatoHora(iso) {
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

function camarasVisibles() {
  return estado.camaras.filter((c) =>
    (!estado.filtroSede || c.sede_id === parseInt(estado.filtroSede, 10)) &&
    (!estado.filtroCamara || c.id === parseInt(estado.filtroCamara, 10)));
}

// Cámara que alimenta el gráfico: la seleccionada, o la primera visible.
function camaraDelChart() {
  const visibles = camarasVisibles();
  if (estado.filtroCamara) {
    return visibles.find((c) => c.id === parseInt(estado.filtroCamara, 10)) || null;
  }
  return visibles[0] || null;
}

function sensorTemperatura(camaraId) {
  return estado.sensores.find((s) => s.camara_id === camaraId && s.tipo === 'temperatura') || null;
}

// ── Filtros ─────────────────────────────────────────────────────────

function poblarFiltros() {
  const selSede = document.getElementById('filtro-sede');
  estado.sedes.forEach((s) => {
    const op = document.createElement('option');
    op.value = s.id;
    op.textContent = s.nombre;
    selSede.appendChild(op);
  });
  poblarFiltroCamaras();

  selSede.addEventListener('change', (e) => {
    estado.filtroSede = e.target.value;
    estado.filtroCamara = '';
    poblarFiltroCamaras();
    refrescar();
  });
  document.getElementById('filtro-camara').addEventListener('change', (e) => {
    estado.filtroCamara = e.target.value;
    refrescar();
  });
  document.getElementById('filtro-tipo').addEventListener('change', (e) => {
    estado.filtroTipo = e.target.value;
    pintarAlertas();
  });
}

function poblarFiltroCamaras() {
  const sel = document.getElementById('filtro-camara');
  sel.innerHTML = '<option value="">Todas</option>';
  estado.camaras
    .filter((c) => !estado.filtroSede || c.sede_id === parseInt(estado.filtroSede, 10))
    .forEach((c) => {
      const op = document.createElement('option');
      op.value = c.id;
      op.textContent = c.nombre;
      sel.appendChild(op);
    });
  sel.value = estado.filtroCamara;
}

// ── Carga de datos ──────────────────────────────────────────────────

async function cargarCatalogos() {
  const [sedes, camaras, sensores] = await Promise.all([
    apiFetch('/sedes'),
    apiFetch('/camaras'),
    apiFetch('/sensores'),
  ]);
  estado.sedes = sedes.datos;
  estado.camaras = camaras.datos;
  estado.sensores = sensores.datos;
}

async function refrescar() {
  try {
    const camaraChart = camaraDelChart();
    const sensor = camaraChart ? sensorTemperatura(camaraChart.id) : null;

    const [ultimas, alertas, lecturas] = await Promise.all([
      apiFetch('/lecturas/ultimas-por-camara'),
      apiFetch('/alertas?limite=200'),
      sensor ? apiFetch(`/lecturas?sensor_id=${sensor.id}&limite=60`) : Promise.resolve({ datos: [] }),
    ]);

    estado.ultimasLecturas = ultimas.datos;
    estado.alertas = alertas.datos;
    // La API entrega descendente; el gráfico se dibuja cronológico.
    estado.lecturasChart = lecturas.datos.slice().reverse();

    pintarKpis();
    pintarLecturas();
    pintarAlertas();
    pintarChart(camaraChart);

    document.getElementById('ultima-actualizacion').textContent =
      `Actualizado: ${new Date().toLocaleTimeString('es-PE')}`;
  } catch (err) {
    console.error('Error cargando dashboard:', err.message);
  }
}

// ── KPIs ────────────────────────────────────────────────────────────

function pintarKpis() {
  const visibles = camarasVisibles();
  const idsVisibles = new Set(visibles.map((c) => c.id));
  const sedesVisibles = estado.filtroSede
    ? estado.sedes.filter((s) => s.id === parseInt(estado.filtroSede, 10))
    : estado.sedes;

  const hace24h = Date.now() - 24 * 3600 * 1000;
  const alertas24h = estado.alertas.filter((a) =>
    idsVisibles.has(a.camara_id) && new Date(a.creado_en).getTime() >= hace24h);

  document.getElementById('kpi-sedes').textContent = sedesVisibles.length;
  document.getElementById('kpi-camaras').textContent = visibles.length;
  document.getElementById('kpi-sensores').textContent =
    estado.sensores.filter((s) => idsVisibles.has(s.camara_id)).length;
  document.getElementById('kpi-alertas').textContent = alertas24h.length;
}

// ── Tabla de últimas lecturas ───────────────────────────────────────

function pintarLecturas() {
  const tbody = document.getElementById('tabla-lecturas');
  const idsVisibles = new Set(camarasVisibles().map((c) => c.id));
  const filas = estado.ultimasLecturas.filter((l) => idsVisibles.has(l.camara_id));

  if (!filas.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Sin lecturas registradas</td></tr>';
    return;
  }

  const porId = new Map(estado.camaras.map((c) => [c.id, c]));

  tbody.innerHTML = filas.map((l) => {
    const camara = porId.get(l.camara_id);
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

// ── Historial de alertas ────────────────────────────────────────────

function pintarAlertas() {
  const tbody = document.getElementById('tabla-alertas');
  const idsVisibles = new Set(camarasVisibles().map((c) => c.id));

  const filas = estado.alertas.filter((a) =>
    idsVisibles.has(a.camara_id) &&
    (!estado.filtroTipo || a.tipo === estado.filtroTipo));

  document.getElementById('alertas-total').textContent = `${filas.length} registros`;

  if (!filas.length) {
    tbody.innerHTML = '<tr><td class="text-center text-muted py-4">Sin alertas para este filtro</td></tr>';
    return;
  }

  tbody.innerHTML = filas.slice(0, 50).map((a) => `
    <tr>
      <td>
        <span class="badge ${BADGE_TIPO[a.tipo] || 'text-bg-secondary'}">${escapeHtml(ETIQUETAS_TIPO[a.tipo] || a.tipo)}</span>
        <strong class="small ms-1">${escapeHtml(a.camara_nombre)}</strong>
        <div class="small">${escapeHtml(a.mensaje)}</div>
        <div class="text-muted small">${formatoFecha(a.creado_en)}</div>
      </td>
    </tr>`).join('');
}

// ── Gráfico de temperatura (SVG) ────────────────────────────────────

const MARGEN = { arriba: 14, derecha: 64, abajo: 26, izquierda: 44 };

function pintarChart(camara) {
  const svg = document.getElementById('chart');
  const vacio = document.getElementById('chart-vacio');
  const datos = estado.lecturasChart;

  document.getElementById('chart-subtitulo').textContent = camara
    ? `${camara.nombre} — rango permitido ${camara.temp_min}°C a ${camara.temp_max}°C`
    : '';

  svg.replaceChildren();
  if (!camara || datos.length < 2) {
    svg.setAttribute('height', 0);
    vacio.classList.remove('d-none');
    return;
  }
  svg.setAttribute('height', 260);
  vacio.classList.add('d-none');

  const ancho = svg.clientWidth || 700;
  const alto = 260;
  const x0 = MARGEN.izquierda;
  const x1 = ancho - MARGEN.derecha;
  const y0 = alto - MARGEN.abajo;
  const y1 = MARGEN.arriba;

  const tMin = parseFloat(camara.temp_min);
  const tMax = parseFloat(camara.temp_max);
  const valores = datos.map((d) => parseFloat(d.valor));
  const yLo = Math.floor(Math.min(tMin, ...valores)) - 1;
  const yHi = Math.ceil(Math.max(tMax, ...valores)) + 1;

  const tiempos = datos.map((d) => new Date(d.registrado_en).getTime());
  const t0 = tiempos[0];
  const t1 = tiempos[tiempos.length - 1];

  const escX = (t) => x0 + ((t - t0) / (t1 - t0 || 1)) * (x1 - x0);
  const escY = (v) => y0 - ((v - yLo) / (yHi - yLo || 1)) * (y0 - y1);

  const el = (tag, attrs) => {
    const nodo = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) nodo.setAttribute(k, v);
    return nodo;
  };
  const texto = (x, y, contenido, attrs = {}) => {
    const nodo = el('text', { x, y, ...attrs });
    nodo.textContent = contenido;
    svg.appendChild(nodo);
    return nodo;
  };

  const css = getComputedStyle(document.getElementById('chart-wrap'));
  const C = {
    serie: css.getPropertyValue('--viz-series').trim(),
    critico: css.getPropertyValue('--viz-critical').trim(),
    grid: css.getPropertyValue('--viz-grid').trim(),
    eje: css.getPropertyValue('--viz-axis').trim(),
    superficie: css.getPropertyValue('--viz-surface').trim(),
  };

  // Banda del rango permitido: wash de la serie al 8%
  svg.appendChild(el('rect', {
    x: x0, y: escY(tMax), width: x1 - x0, height: escY(tMin) - escY(tMax),
    fill: C.serie, opacity: 0.08,
  }));

  // Gridlines horizontales + ticks Y (números limpios)
  const pasoY = (yHi - yLo) <= 8 ? 2 : 5;
  for (let v = Math.ceil(yLo / pasoY) * pasoY; v <= yHi; v += pasoY) {
    svg.appendChild(el('line', { x1: x0, y1: escY(v), x2: x1, y2: escY(v), stroke: C.grid, 'stroke-width': 1 }));
    texto(x0 - 6, escY(v) + 4, `${v}°`, { 'text-anchor': 'end', class: 'tick-y' });
  }

  // Límites del rango con etiqueta
  [[tMax, 'máx'], [tMin, 'mín']].forEach(([v, nombre]) => {
    svg.appendChild(el('line', { x1: x0, y1: escY(v), x2: x1, y2: escY(v), stroke: C.eje, 'stroke-width': 1 }));
    texto(x1 + 6, escY(v) + 4, `${nombre} ${v}°`, {});
  });

  // Ticks X: 4 marcas de tiempo
  for (let i = 0; i < 4; i++) {
    const t = t0 + ((t1 - t0) * i) / 3;
    texto(escX(t), y0 + 18, formatoHora(new Date(t).toISOString()), {
      'text-anchor': i === 0 ? 'start' : i === 3 ? 'end' : 'middle', class: 'tick-y',
    });
  }

  // Eje base
  svg.appendChild(el('line', { x1: x0, y1: y0, x2: x1, y2: y0, stroke: C.eje, 'stroke-width': 1 }));

  // Línea de la serie: 2px, uniones redondeadas
  const puntos = datos.map((d, i) => `${escX(tiempos[i]).toFixed(1)},${escY(parseFloat(d.valor)).toFixed(1)}`);
  svg.appendChild(el('polyline', {
    points: puntos.join(' '), fill: 'none', stroke: C.serie,
    'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
  }));

  // Puntos fuera de rango: estado crítico, con anillo de superficie
  datos.forEach((d, i) => {
    const v = parseFloat(d.valor);
    if (v < tMin || v > tMax) {
      svg.appendChild(el('circle', {
        cx: escX(tiempos[i]), cy: escY(v), r: 4,
        fill: C.critico, stroke: C.superficie, 'stroke-width': 2,
      }));
    }
  });

  // Marcador y etiqueta del último valor
  const ultimo = datos[datos.length - 1];
  const vUlt = parseFloat(ultimo.valor);
  svg.appendChild(el('circle', {
    cx: escX(t1), cy: escY(vUlt), r: 4,
    fill: (vUlt < tMin || vUlt > tMax) ? C.critico : C.serie,
    stroke: C.superficie, 'stroke-width': 2,
  }));
  texto(x1 + 6, escY(vUlt) - 8, `${vUlt.toFixed(1)}°C`, { class: 'etiqueta-final' });

  instalarCrosshair(svg, datos, tiempos, escX, escY, { x0, x1, y0, y1, tMin, tMax, color: C });
}

// Crosshair vertical + tooltip: apunta a la hora, no a la línea de 2px.
function instalarCrosshair(svg, datos, tiempos, escX, escY, ctx) {
  const tooltip = document.getElementById('chart-tooltip');
  const wrap = document.getElementById('chart-wrap');

  const linea = document.createElementNS(SVG_NS, 'line');
  linea.setAttribute('stroke', ctx.color.eje);
  linea.setAttribute('stroke-width', 1);
  linea.setAttribute('y1', ctx.y1);
  linea.setAttribute('y2', ctx.y0);
  linea.style.display = 'none';
  svg.appendChild(linea);

  const punto = document.createElementNS(SVG_NS, 'circle');
  punto.setAttribute('r', 5);
  punto.setAttribute('stroke', ctx.color.superficie);
  punto.setAttribute('stroke-width', 2);
  punto.style.display = 'none';
  svg.appendChild(punto);

  svg.onpointermove = (e) => {
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (px < ctx.x0 || px > ctx.x1) return ocultar();

    // Punto más cercano en X
    let idx = 0;
    let dist = Infinity;
    tiempos.forEach((t, i) => {
      const d = Math.abs(escX(t) - px);
      if (d < dist) { dist = d; idx = i; }
    });

    const d = datos[idx];
    const v = parseFloat(d.valor);
    const cx = escX(tiempos[idx]);
    const cy = escY(v);
    const fuera = v < ctx.tMin || v > ctx.tMax;

    linea.setAttribute('x1', cx);
    linea.setAttribute('x2', cx);
    linea.style.display = '';
    punto.setAttribute('cx', cx);
    punto.setAttribute('cy', cy);
    punto.setAttribute('fill', fuera ? ctx.color.critico : ctx.color.serie);
    punto.style.display = '';

    // Contenido del tooltip con textContent (datos no confiables)
    tooltip.replaceChildren();
    const valor = document.createElement('div');
    valor.className = 'valor';
    valor.textContent = `${v.toFixed(2)}°C`;
    tooltip.appendChild(valor);
    if (fuera) {
      const estadoEl = document.createElement('div');
      estadoEl.className = 'fuera';
      estadoEl.textContent = '⚠ Fuera de rango';
      tooltip.appendChild(estadoEl);
    }
    const hora = document.createElement('div');
    hora.className = 'hora';
    hora.textContent = formatoHora(d.registrado_en);
    tooltip.appendChild(hora);
    tooltip.classList.remove('d-none');

    const wrapRect = wrap.getBoundingClientRect();
    const izq = cx + rect.left - wrapRect.left;
    tooltip.style.left = `${Math.min(izq + 12, wrapRect.width - tooltip.offsetWidth - 8)}px`;
    tooltip.style.top = `${cy + rect.top - wrapRect.top - tooltip.offsetHeight - 12}px`;
  };

  svg.onpointerleave = ocultar;

  function ocultar() {
    linea.style.display = 'none';
    punto.style.display = 'none';
    tooltip.classList.add('d-none');
  }
}

// ── Inicio ──────────────────────────────────────────────────────────

async function iniciar() {
  try {
    await cargarCatalogos();
    poblarFiltros();
    await refrescar();
    setInterval(refrescar, REFRESCO_MS);
    window.addEventListener('resize', () => pintarChart(camaraDelChart()));
  } catch (err) {
    console.error('Error iniciando dashboard:', err.message);
  }
}

iniciar();
