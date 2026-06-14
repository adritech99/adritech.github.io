/* ==========================================================================
   CUBO DE VISTAS 3D — Sincroniza un cubo visual con model-viewer
   El cubo refleja la orientación de la cámara del visor 3D y permite
   saltar a vistas predefinidas (frontal, lateral, isométrica, etc.).
   ========================================================================== */

/* --- Orientaciones CSS del cubo (rotaciones X/Y en grados) --- */

const ORIENTACION_CUBO_PCB = {
  frontal:    { x: 0,   y: 0 },
  posterior:  { x: 0,   y: 180 },
  derecha:    { x: 0,   y: 90 },
  izquierda:  { x: 0,   y: -90 },
  superior:   { x: -90, y: 0 },
  inferior:   { x: 90,  y: 0 },
  isometrica: { x: -28, y: -38 }
};

const ORIENTACION_CUBO_GENERICO = {
  frontal:    { x: 0,   y: 0 },
  posterior:  { x: 0,   y: 180 },
  derecha:    { x: 0,   y: 90 },
  izquierda:  { x: 0,   y: -90 },
  superior:   { x: -90, y: 0 },
  inferior:   { x: 90,  y: 0 },
  isometrica: { x: -28, y: -38 }
};

/* --- Ángulos de cámara (theta/azimut, phi/elevación) por vista --- */

function vistasGenerico() {
  return {
    frontal:    { theta: 0,   phi: 90 },
    posterior:  { theta: 180, phi: 90 },
    superior:   { theta: 0,   phi: 0 },
    inferior:   { theta: 0,   phi: 180 },
    izquierda:  { theta: 90,  phi: 90 },
    derecha:    { theta: 270, phi: 90 },
    isometrica: { theta: 45,  phi: 55 }
  };
}

function vistasPCB(inclinacion) {
  return {
    frontal:    { theta: 0,   phi: inclinacion },
    posterior:  { theta: 180, phi: inclinacion },
    superior:   { theta: 0,   phi: 0 },
    inferior:   { theta: 0,   phi: 180 },
    izquierda:  { theta: 90,  phi: inclinacion },
    derecha:    { theta: 270, phi: inclinacion },
    isometrica: { theta: 35,  phi: inclinacion - 15 }
  };
}

/* --- Calibración según atributos data-* del visor --- */

function obtenerCalibracion(visor) {
  const tipo = visor.dataset.cuboTipo || 'generico';
  const offsetTheta = parseFloat(visor.dataset.cuboOffsetTheta || '0'); // Corrección azimutal
  const inclinacion = parseFloat(visor.dataset.cuboInclinacion || '75'); // Ángulo phi para modelos PCB
  const vistas = tipo === 'pcb' ? vistasPCB(inclinacion) : vistasGenerico();
  const orientaciones = tipo === 'pcb' ? ORIENTACION_CUBO_PCB : ORIENTACION_CUBO_GENERICO;
  return { vistas, orientaciones, offsetTheta, inclinacion };
}

/* --- Utilidades de ángulos --- */

// Normaliza un ángulo al rango [0, 360)
function normalizarAngulo(angulo) {
  return ((angulo % 360) + 360) % 360;
}

// Devuelve el valor de pasos[] más cercano al ángulo dado (distancia circular)
function anguloMasCercano(angulo, pasos) {
  return pasos.reduce((cercano, actual) => {
    const distanciaActual = Math.abs(normalizarAngulo(angulo - actual + 180) - 180);
    const distanciaCercana = Math.abs(normalizarAngulo(angulo - cercano + 180) - 180);
    return distanciaActual < distanciaCercana ? actual : cercano;
  }, pasos[0]);
}

// Theta de cámara efectivo descontando rotación del turntable y offset de calibración
function obtenerThetaEfectivo(visor, calibracion) {
  const orbita = visor.getCameraOrbit();
  const camaraDeg = orbita.theta * 180 / Math.PI; // Radianes → grados
  const turntableDeg = (visor.turntableRotation || 0) * 180 / Math.PI;
  return camaraDeg - turntableDeg - calibracion.offsetTheta;
}

/* --- Sincronización cubo CSS ↔ órbita de cámara --- */

// Calcula rotateX/rotateY del cubo a partir de theta y phi de la cámara
function orientarCuboDesdeOrbita(cubo3d, theta, phi, calibracion, conTransicion) {
  const phiReferencia = calibracion.inclinacion || 90;
  // Mapea phi (elevación) a rotación X del cubo según la inclinación de referencia
  let rotX = phi <= phiReferencia
    ? ((phi - phiReferencia) / phiReferencia) * 90
    : ((phi - phiReferencia) / (180 - phiReferencia)) * 90;
  let rotY = -theta;

  const thetaNorm = normalizarAngulo(theta);
  const lateralCercano = anguloMasCercano(thetaNorm, [0, 90, 180, 270]);
  const distLateral = Math.abs(normalizarAngulo(thetaNorm - lateralCercano + 180) - 180);

  // En vistas laterales puras, alinea el cubo sin inclinación X y evita saltos de 360°
  if (distLateral < 4 && Math.abs(phi - phiReferencia) < 8) {
    rotX = 0;
    // Usar el equivalente continuo de -lateralCercano más cercano al rotY actual,
    // para evitar saltos grandes que la transición CSS convertiría en giros locos.
    const base = -lateralCercano;
    const vuelta = Math.round((rotY - base) / 360) * 360; // Múltiplo de 360 más cercano
    rotY = base + vuelta;
  }

  cubo3d.style.transition = conTransicion ? 'transform 0.35s ease' : 'none';
  cubo3d.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
}

/* --- Inicialización de cubos en la página --- */

function iniciarCubosVistas() {
  document.querySelectorAll('.cubo-vistas').forEach(iniciarCuboVistas);
}

function iniciarCuboVistas(cubo) {
  const visor = cubo.closest('.visor-3d-wrapper')?.querySelector('model-viewer');
  const cubo3d = cubo.querySelector('.cubo-vistas-cubo');
  if (!visor || !cubo3d) return;

  const calibracion = obtenerCalibracion(visor);

  // Botones de vista: al pulsar, mueven la cámara del model-viewer
  cubo.querySelectorAll('[data-vista]').forEach((boton) => {
    boton.addEventListener('click', (e) => {
      e.stopPropagation(); // No propagar al visor 3D (evita interferir con el arrastre)
      irAVista(visor, cubo3d, boton.dataset.vista, calibracion);
    });
  });

  // Sincroniza el cubo con la órbita actual de la cámara (sin animación)
  const sincronizarCubo = () => {
    if (typeof visor.getCameraOrbit !== 'function') return;
    const orbita = visor.getCameraOrbit();
    const theta = obtenerThetaEfectivo(visor, calibracion);
    const phi = orbita.phi * 180 / Math.PI;
    orientarCuboDesdeOrbita(cubo3d, theta, phi, calibracion, false);
  };

  // Bucle requestAnimationFrame para seguir el movimiento continuo de la cámara
  function bucleSincronizacion() {
    sincronizarCubo();
    visor._cuboRafId = requestAnimationFrame(bucleSincronizacion);
  }

  visor.addEventListener('camera-change', sincronizarCubo);
  visor.addEventListener('load', sincronizarCubo);
  bucleSincronizacion();
}

/* --- Navegación a una vista predefinida --- */

function irAVista(visor, cubo3d, vista, calibracion) {
  const angulos = calibracion.vistas[vista];
  if (!angulos || typeof visor.getCameraOrbit !== 'function') return;

  const orbita = visor.getCameraOrbit();
  const theta = angulos.theta + calibracion.offsetTheta; // Aplica corrección azimutal

  visor.autoRotate = false;
  if (typeof visor.resetTurntableRotation === 'function') {
    visor.resetTurntableRotation(0); // Reinicia rotación acumulada del modelo
  }
  visor.cameraOrbit = `${theta}deg ${angulos.phi}deg ${orbita.radius}m`; // Mantiene la distancia (radio)
  orientarCuboDesdeOrbita(cubo3d, angulos.theta, angulos.phi, calibracion, true); // Con transición CSS
}

/* --- Arranque cuando model-viewer esté disponible --- */

if (customElements.get('model-viewer')) {
  iniciarCubosVistas();
} else {
  customElements.whenDefined('model-viewer').then(iniciarCubosVistas); // Espera al web component
}
