/* ==========================================================================
   CABECERA — carga header.html y utilidades del encabezado
   Estilos: css/encabezado.css
   ========================================================================== */

// --------------------------------------------------------------------------
// Scripts auxiliares (carga condicional al iniciar la página)
// --------------------------------------------------------------------------

// Inyecta proteccion-copia.js una sola vez si aún no está cargado
(function cargarProteccionCopia() {
  if (document.getElementById("proteccion-copia-js")) return; // ya presente → salir

  const script = document.createElement("script");
  script.id = "proteccion-copia-js";
  script.src = "js/proteccion-copia.js";
  document.head.appendChild(script);
})();

// Inyecta lupa.js solo en páginas de proyectos (detecta style_proyectos en el <head>)
(function cargarLupaProyectos() {
  if (document.getElementById("lupa-js") || !document.querySelector('link[href*="style_proyectos"]')) return;

  const script = document.createElement("script");
  script.id = "lupa-js";
  script.src = "js/lupa.js";
  document.body.appendChild(script);
})();

// --------------------------------------------------------------------------
// Carga del HTML de la cabecera (fetch → inyectar → inicializar módulos)
// --------------------------------------------------------------------------
fetch("header.html")
  .then(response => {
    if (!response.ok) throw new Error("No se pudo cargar el header.html");
    return response.text();
  })
  .then(data => {
    // Sustituye el contenedor vacío por el markup de header.html
    document.getElementById("header-container").innerHTML = data;

    // Inicialización en cadena tras tener el DOM de la cabecera
    iniciarReloj();
    ajustarPosicionTexto();
    marcarMenuActivo();
    iniciarBusqueda();
    rellenarBusquedaDesdeUrl();
    if (typeof window.sincronizarActivoFlotante === 'function') {
      window.sincronizarActivoFlotante();
    }
  })
  .catch(error => console.error("Error:", error));

// --------------------------------------------------------------------------
// Título del sitio — ajuste vertical según número de líneas (solo PC)
// --------------------------------------------------------------------------

/** Centra verticalmente el título según si ocupa 1, 2 o más líneas. En móvil no aplica offset. */
function ajustarPosicionTexto() {
  const texto = document.getElementById('titulo-texto');
  if (!texto) return;
  const contenedor = texto.parentElement;

  // Móvil (≤700px): quitar offset manual; el CSS controla la posición
  if (window.matchMedia('(max-width: 700px)').matches) {
    contenedor.style.top = '';
    return;
  }

  // PC: medir líneas reales y ajustar top del contenedor
  const estilos = getComputedStyle(texto);
  const lineHeight = parseFloat(estilos.lineHeight);
  const alturaTexto = texto.getBoundingClientRect().height;
  const numLineas = Math.round(alturaTexto / lineHeight);

  if (numLineas === 1) {
    contenedor.style.top = '20px';
  } else if (numLineas === 2) {
    contenedor.style.top = '-8px';
  } else {
    contenedor.style.top = '10px';
  }

  if (typeof posicionarFechaCompactaRef === 'function') posicionarFechaCompactaRef();
}

// --------------------------------------------------------------------------
// Búsqueda — PC: siempre visible | Móvil: botón lupa expandible
// --------------------------------------------------------------------------

/** Lee ?q= de la URL y rellena la barra si existe (p. ej. al volver de busqueda.html). */
function rellenarBusquedaDesdeUrl() {
  const consulta = new URLSearchParams(window.location.search).get('q');
  if (!consulta) return;

  ['barra-busqueda', 'barra-busqueda-flotante'].forEach(function(id) {
    const input = document.getElementById(id);
    if (input) input.value = consulta;
  });
}

/** Navega a resultados: API AdriTechBusqueda si está disponible, si no busqueda.html. */
function ejecutarBusqueda(input) {
  const termino = input.value.trim();
  if (!termino) return;

  if (typeof AdriTechBusqueda !== 'undefined') {
    AdriTechBusqueda.irABusqueda(termino);
    return;
  }

  window.location.href = `busqueda.html?q=${encodeURIComponent(termino)}`;
}

/** Enlaza botón, input y cierre por clic/Escape; comportamiento distinto PC vs móvil. */
function iniciarBusqueda() {
  const contenedor = document.querySelector('.busqueda-header');
  const cabecera = document.querySelector('.cabecera');
  const boton = document.getElementById('boton-buscar');
  const input = document.getElementById('barra-busqueda');
  if (!contenedor || !boton || !input) return;

  // Umbral compartido con encabezado.css (700px)
  const esMovil = () => window.matchMedia('(max-width: 700px)').matches;

  /** Móvil: contrae el panel de búsqueda y restaura estado ARIA. */
  function cerrarBusqueda() {
    contenedor.classList.remove('busqueda-expandida');
    if (cabecera) cabecera.classList.remove('busqueda-activa');
    input.blur();
    actualizarBusquedaMovil();
  }

  /** Sincroniza clases y atributos ARIA según viewport y estado expandido. */
  function actualizarBusquedaMovil() {
    // PC: búsqueda siempre visible; forzar estado "expandido" en ARIA
    if (!esMovil()) {
      contenedor.classList.remove('busqueda-expandida');
      if (cabecera) cabecera.classList.remove('busqueda-activa');
      boton.setAttribute('aria-expanded', 'true');
      boton.setAttribute('aria-label', 'Buscar');
      return;
    }

    // Móvil: reflejar si el panel está desplegado
    const expandida = contenedor.classList.contains('busqueda-expandida');
    boton.setAttribute('aria-expanded', String(expandida));
    boton.setAttribute('aria-label', expandida ? 'Buscar' : 'Mostrar búsqueda');
  }

  // Listener: clic en botón lupa / buscar
  boton.addEventListener('click', function(event) {
    if (esMovil()) {
      event.stopPropagation(); // evitar que el listener de document cierre al instante
      const expandida = contenedor.classList.contains('busqueda-expandida');

      // Móvil cerrado → abrir y enfocar input
      if (!expandida) {
        contenedor.classList.add('busqueda-expandida');
        if (cabecera) cabecera.classList.add('busqueda-activa');
        input.focus();
        actualizarBusquedaMovil();
        return;
      }

      // Móvil abierto con texto → ejecutar búsqueda
      if (input.value.trim()) {
        ejecutarBusqueda(input);
        return;
      }

      // Móvil abierto sin texto → cerrar panel
      cerrarBusqueda();
      return;
    }

    // PC: un clic siempre lanza la búsqueda
    ejecutarBusqueda(input);
  });

  // Listener: teclado en el input (Enter universal; Escape solo móvil)
  input.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      ejecutarBusqueda(input);
      return;
    }

    if (event.key === 'Escape' && esMovil()) cerrarBusqueda();
  });

  // Listener: clic fuera del panel — solo móvil con búsqueda expandida
  document.addEventListener('click', function(event) {
    if (!esMovil()) return;
    if (!contenedor.classList.contains('busqueda-expandida')) return;
    if (!contenedor.contains(event.target)) cerrarBusqueda();
  });

  // Exponer para el listener global de resize
  actualizarBusquedaMovilRef = actualizarBusquedaMovil;
  actualizarBusquedaMovil();
  iniciarBusquedaFlotante();
}

/** Enlaza la búsqueda flotante (misma lógica que la principal). */
function iniciarBusquedaFlotante() {
  const contenedor = document.querySelector('.busqueda-flotante');
  const cabecera = document.getElementById('cabecera-flotante');
  const input = document.getElementById('barra-busqueda-flotante');
  const boton = document.getElementById('boton-buscar-flotante');
  const inputPrincipal = document.getElementById('barra-busqueda');
  if (!input || !boton || !contenedor) return;

  const esMovil = () => window.matchMedia('(max-width: 700px)').matches;

  function sincronizarConPrincipal() {
    if (inputPrincipal) inputPrincipal.value = input.value;
  }

  function sincronizarDesdePrincipal() {
    if (inputPrincipal) input.value = inputPrincipal.value;
  }

  function cerrarBusquedaFlotante() {
    contenedor.classList.remove('busqueda-expandida');
    if (cabecera) cabecera.classList.remove('busqueda-activa');
    input.blur();
    actualizarBusquedaFlotanteMovil();
  }

  function actualizarBusquedaFlotanteMovil() {
    if (!esMovil()) {
      contenedor.classList.remove('busqueda-expandida');
      if (cabecera) cabecera.classList.remove('busqueda-activa');
      boton.setAttribute('aria-expanded', 'true');
      boton.setAttribute('aria-label', 'Buscar');
      return;
    }

    const expandida = contenedor.classList.contains('busqueda-expandida');
    boton.setAttribute('aria-expanded', String(expandida));
    boton.setAttribute('aria-label', expandida ? 'Buscar' : 'Mostrar búsqueda');
  }

  if (inputPrincipal) {
    inputPrincipal.addEventListener('input', sincronizarDesdePrincipal);
  }

  input.addEventListener('input', sincronizarConPrincipal);

  boton.addEventListener('click', function(event) {
    if (esMovil()) {
      event.stopPropagation();
      const expandida = contenedor.classList.contains('busqueda-expandida');

      if (!expandida) {
        contenedor.classList.add('busqueda-expandida');
        if (cabecera) cabecera.classList.add('busqueda-activa');
        input.focus();
        actualizarBusquedaFlotanteMovil();
        return;
      }

      if (input.value.trim()) {
        if (inputPrincipal) inputPrincipal.value = input.value;
        ejecutarBusqueda(input);
        return;
      }

      cerrarBusquedaFlotante();
      return;
    }

    if (inputPrincipal) inputPrincipal.value = input.value;
    ejecutarBusqueda(input);
  });

  input.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (inputPrincipal) inputPrincipal.value = input.value;
      ejecutarBusqueda(input);
      return;
    }

    if (event.key === 'Escape' && esMovil()) cerrarBusquedaFlotante();
  });

  document.addEventListener('click', function(event) {
    if (!esMovil()) return;
    if (!contenedor.classList.contains('busqueda-expandida')) return;
    if (!contenedor.contains(event.target)) cerrarBusquedaFlotante();
  });

  actualizarBusquedaFlotanteMovilRef = actualizarBusquedaFlotanteMovil;
  actualizarBusquedaFlotanteMovil();
}

// Referencia global al sincronizador móvil (asignada en iniciarBusqueda)
var actualizarBusquedaMovilRef;
var actualizarBusquedaFlotanteMovilRef;

// --------------------------------------------------------------------------
// Reloj y fecha — PC: fecha larga | Móvil: dd/mm/aaaa
// --------------------------------------------------------------------------

/** Centra la fecha en el hueco libre a la derecha del título (PC compacto). */
function posicionarFechaCompacta() {
  var bloqueFecha = document.querySelector('.header-fecha-hora');
  var titulo = document.querySelector('.header-texto');
  var cabecera = document.querySelector('.cabecera');
  if (!bloqueFecha || !cabecera) return;

  var esPcCompacto = window.matchMedia('(min-width: 701px) and (max-width: 1499px)').matches;
  if (!esPcCompacto || !bloqueFecha.classList.contains('fecha-compacta')) {
    bloqueFecha.style.left = '';
    bloqueFecha.style.right = '';
    bloqueFecha.style.transform = '';
    return;
  }

  var cabeceraRect = cabecera.getBoundingClientRect();
  var tituloRect = titulo ? titulo.getBoundingClientRect() : cabeceraRect;
  var margenDer = 24;
  var inicioLibre = tituloRect.right;
  var finLibre = cabeceraRect.right - margenDer;
  var anchoLibre = finLibre - inicioLibre;
  var anchoFecha = bloqueFecha.offsetWidth;

  if (anchoLibre < anchoFecha + 12) {
    bloqueFecha.style.left = '';
    bloqueFecha.style.right = '1.25rem';
    bloqueFecha.style.transform = '';
    return;
  }

  var centro = inicioLibre + anchoLibre / 2 - cabeceraRect.left;
  bloqueFecha.style.left = centro + 'px';
  bloqueFecha.style.right = 'auto';
  bloqueFecha.style.transform = 'translateX(-50%)';
}

/** Actualiza fecha y hora cada segundo; formato distinto según ancho de pantalla. */
function iniciarReloj() {
  var contenedor = document.getElementById("fecha-hora");
  var bloqueFecha = document.querySelector(".header-fecha-hora");

  function formatoFechaNumerica(ahora) {
    var dia = String(ahora.getDate()).padStart(2, "0");
    var mes = String(ahora.getMonth() + 1).padStart(2, "0");
    var anio = ahora.getFullYear();
    return dia + "/" + mes + "/" + anio;
  }

  function actualizarFechaHora() {
    if (!contenedor) return;
    var ahora = new Date();
    var hora = ahora.toLocaleTimeString("es-ES");
    var fecha;
    var esMovil = window.matchMedia("(max-width: 700px)").matches;
    var esPcCompacto = window.matchMedia("(max-width: 1499px)").matches;

    if (bloqueFecha) {
      bloqueFecha.classList.toggle("fecha-compacta", !esMovil && esPcCompacto);
    }

    if (esMovil || esPcCompacto) {
      fecha = formatoFechaNumerica(ahora);
    } else {
      var opcionesFecha = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      };

      fecha = ahora.toLocaleDateString("es-ES", opcionesFecha);
      fecha = fecha.split(" ").map(function(palabra) {
        if (palabra.toLowerCase() === "de") return "de";
        return palabra.charAt(0).toUpperCase() + palabra.slice(1);
      }).join(" ");
    }

    contenedor.textContent = fecha + " | " + hora;
    requestAnimationFrame(posicionarFechaCompacta);
  }

  posicionarFechaCompactaRef = posicionarFechaCompacta;
  actualizarFechaHoraRef = actualizarFechaHora;
  actualizarFechaHora();
  setInterval(actualizarFechaHora, 1000);
}

// Referencia global al actualizador de fecha (asignada en iniciarReloj)
var actualizarFechaHoraRef;
var posicionarFechaCompactaRef;

// --------------------------------------------------------------------------
// Menú de navegación — marca la página / subpágina activa
// --------------------------------------------------------------------------

/** Resalta el enlace actual y, si aplica, el ítem padre del submenú. */
function marcarMenuActivo() {
  const enlaces = document.querySelectorAll('.menu-navegacion a');
  const menuItems = document.querySelectorAll('.menu-item');
  let rutaActual = window.location.pathname.split('/').pop() || '';

  if (!rutaActual) {
    rutaActual = 'index.html';
  }

  rutaActual = decodeURIComponent(rutaActual).toLowerCase();
  menuItems.forEach(item => item.classList.remove('menu-item-activo'));

  enlaces.forEach(enlace => {
    enlace.classList.remove('active');

    const href = decodeURIComponent((enlace.getAttribute('href') || '').split('/').pop()).toLowerCase();
    if (!href || rutaActual !== href) return;

    enlace.classList.add('active');

    // Si el enlace está dentro de un submenú, marcar también el padre
    const submenu = enlace.closest('.submenu');
    if (!submenu) return;

    const menuItem = submenu.closest('.menu-item');
    const padrePrincipal = menuItem?.querySelector(':scope > a');

    if (menuItem) {
      menuItem.classList.add('menu-item-activo');
    }

    if (padrePrincipal && padrePrincipal !== enlace) {
      padrePrincipal.classList.add('active');
    }
  });
}

// --------------------------------------------------------------------------
// Eventos globales de la cabecera (resize: reajustar PC/móvil)
// --------------------------------------------------------------------------

// Listener: al redimensionar ventana, recalcular título, fecha y búsqueda móvil
window.addEventListener('resize', function() {
  ajustarPosicionTexto();
  if (typeof actualizarFechaHoraRef === 'function') actualizarFechaHoraRef();
  if (typeof posicionarFechaCompactaRef === 'function') posicionarFechaCompactaRef();
  if (typeof actualizarBusquedaMovilRef === 'function') actualizarBusquedaMovilRef();
  if (typeof actualizarBusquedaFlotanteMovilRef === 'function') actualizarBusquedaFlotanteMovilRef();
});

// --------------------------------------------------------------------------
// Menú flotante — aparece al hacer scroll hacia arriba, se oculta al bajar
// --------------------------------------------------------------------------

(function iniciarMenuFlotante() {
  var ultimoScroll = window.scrollY;
  var umbralMostrar = 120; // píxeles que hay que bajar antes de que aparezca al subir

  function sincronizarActivoFlotante() {
    // Copia la clase active del menú principal al flotante
    var enlacesPrincipal = document.querySelectorAll('.menu-navegacion a');
    var enlacesFlotante  = document.querySelectorAll('#menu-flotante a');

    enlacesFlotante.forEach(function(ef) {
      ef.classList.remove('active');
      var hrefF = (ef.getAttribute('href') || '').split('/').pop().toLowerCase();
      enlacesPrincipal.forEach(function(ep) {
        var hrefP = (ep.getAttribute('href') || '').split('/').pop().toLowerCase();
        if (hrefF === hrefP && ep.classList.contains('active')) {
          ef.classList.add('active');
        }
      });
    });
  }

  function gestionarScroll() {
    var scrollActual = window.scrollY;
    var barra = document.getElementById('cabecera-flotante');
    if (!barra) return;

    // Ocultar si estamos en la parte superior (el encabezado es visible)
    if (scrollActual <= umbralMostrar) {
      barra.classList.remove('visible');
      ultimoScroll = scrollActual;
      return;
    }

    if (scrollActual < ultimoScroll) {
      // Scroll hacia arriba → mostrar
      barra.classList.add('visible');
    } else {
      // Scroll hacia abajo → ocultar
      barra.classList.remove('visible');
    }

    ultimoScroll = scrollActual;
  }

  // Sincronizar activos tras cargar el header (también se llama desde fetch)
  window.sincronizarActivoFlotante = sincronizarActivoFlotante;

  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(sincronizarActivoFlotante, 300);
  });

  window.addEventListener('scroll', gestionarScroll, { passive: true });
})();
