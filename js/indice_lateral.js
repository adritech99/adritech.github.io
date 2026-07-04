/* ==========================================================================
   INDICE LATERAL — páginas de proyecto
   Requisitos HTML en cada página:
     <nav class="indice-lateral"><ul></ul></nav>
     <div class="contenedor-hoja"><main>… h3/h4 con id …</main></div>
   Estilos: css/style_proyectos.css
   ========================================================================== */

// Listener principal: todo el índice se inicializa al estar listo el DOM
document.addEventListener("DOMContentLoaded", () => {

  // --------------------------------------------------------------------------
  // Referencias DOM y constantes
  // --------------------------------------------------------------------------
  const indice = document.querySelector(".indice-lateral");
  const contenedor = document.querySelector(".contenedor-hoja");

  // Sin estructura requerida en la página → no hacer nada
  if (!indice || !contenedor) return;

  const lista = indice.querySelector("ul") || indice.appendChild(document.createElement("ul"));
  let areaScroll = null; // contenedor scrollable (se crea en configurarIndice)
  const hero = document.querySelector(".hero"); // bloque superior que afecta --indice-top

  const INDICE_ANCHO_MIN = 120;              // ancho mínimo del panel en px
  const INDICE_MARGEN_EXTRA = 18;            // margen interno al medir texto
  const INDICE_DESPLAZAMIENTO_ACTIVO = 12;   // espacio para resaltar sección activa
  const OFFSET_TOP = 20;                     // separación base desde el borde superior

  // Partículas que no se capitalizan en subtítulos (h4)
  const PARTICULAS = new Set(["de", "del", "la", "las", "el", "los", "es", "y", "a", "en"]);
  // Siglas técnicas que se mantienen en mayúsculas/minúsculas originales
  const ACRONIMOS = new Set([
    "pcb", "cnc", "adc", "gpio", "mqtt", "uart", "usb", "tft", "fdm", "sls",
    "stp", "stl", "3d", "i2c", "spi", "pwm", "diy", "api", "wifi", "mcp"
  ]);

  // --------------------------------------------------------------------------
  // Formateo de títulos (h3 / h4 → texto del índice)
  // --------------------------------------------------------------------------

  /** Devuelve true si la palabra debe tratarse como acrónimo o código. */
  function esAcrónimo(palabra) {
    const limpia = palabra.replace(/[¿?.,!]/g, "");
    const minuscula = limpia.toLowerCase();
    if (!limpia || PARTICULAS.has(minuscula)) return false;
    if (ACRONIMOS.has(minuscula)) return true;
    return /[0-9]/.test(limpia) && limpia === limpia.toUpperCase();
  }

  /** Capitaliza una palabra respetando acrónimos, ¿? y puntuación final. */
  function capitalizarPalabra(palabra) {
    const sufijo = palabra.match(/[¿?.,!]+$/)?.[0] || "";
    const nucleo = palabra.slice(0, palabra.length - sufijo.length);

    if (esAcrónimo(nucleo)) return nucleo + sufijo;

    const minuscula = nucleo.toLowerCase();

    if (minuscula.startsWith("¿")) {
      const resto = minuscula.slice(1);
      return `¿${resto.charAt(0).toUpperCase()}${resto.slice(1)}${sufijo}`;
    }

    return `${minuscula.charAt(0).toUpperCase()}${minuscula.slice(1)}${sufijo}`;
  }

  /** Formatea el texto de un h4 con prefijo » y reglas de partículas. */
  function formatearSubtitulo(texto) {
    const palabras = texto.trim().split(/\s+/);

    return "» " + palabras.map((palabra, indice) => {
      const nucleo = palabra.replace(/[¿?.,!]/g, "").toLowerCase();
      if (indice > 0 && PARTICULAS.has(nucleo)) return palabra.toLowerCase();
      return capitalizarPalabra(palabra);
    }).join(" ");
  }

  /** Construye el DOM de un subíndice (marca » + etiqueta en spans separados). */
  function poblarSubindice(span, texto) {
    const etiqueta = texto.replace(/^»\s*/, "");
    span.replaceChildren();

    const marca = document.createElement("span");
    marca.className = "indice-marca";
    marca.setAttribute("aria-hidden", "true");
    marca.textContent = "»";

    const cuerpo = document.createElement("span");
    cuerpo.className = "indice-etiqueta";
    cuerpo.textContent = etiqueta;

    span.append(marca, cuerpo);
  }

  /** Crea el span .indice-texto dentro del enlace (texto plano, subíndice o HTML manual). */
  function crearTextoIndice(enlace, contenido, esHtml = false) {
    enlace.replaceChildren();
    const span = document.createElement("span");
    span.className = "indice-texto";

    if (esHtml) {
      span.innerHTML = contenido;
    } else if (contenido.startsWith("» ")) {
      poblarSubindice(span, contenido);
    } else {
      span.textContent = contenido;
    }

    enlace.appendChild(span);
    return span;
  }

  // --------------------------------------------------------------------------
  // Medición de texto (cálculo de anchos en canvas oculto)
  // --------------------------------------------------------------------------

  /** Mide el ancho en px de un texto con una fuente dada (elemento oculto temporal). */
  function medirTexto(texto, fuente) {
    const medidor = document.createElement("span");
    medidor.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;";
    medidor.style.font = fuente;
    medidor.textContent = texto;
    document.body.appendChild(medidor);
    const ancho = medidor.offsetWidth;
    document.body.removeChild(medidor);
    return ancho;
  }

  /** Mide el ancho máximo entre líneas de HTML con <br> (entradas manuales). */
  function medirAnchoHtmlMultilinea(html, fuente) {
    return html
      .split(/<br\s*\/?>/gi)
      .map(linea => medirTexto(linea.replace(/<[^>]*>/g, "").trim(), fuente))
      .reduce((max, w) => Math.max(max, w), 0);
  }

  /** Lee una variable CSS numérica del :root (p. ej. --indice-separacion). */
  function obtenerVariableNumerica(nombre) {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(nombre));
  }

  /** Agrupa paddings, bordes, fuente y márgenes extra para el cálculo de ancho. */
  function obtenerMedidasIndice() {
    const estilosIndice = getComputedStyle(indice);
    const contenedorScroll = areaScroll || lista;
    const estilosScroll = getComputedStyle(contenedorScroll);
    const paddingX = parseFloat(estilosIndice.paddingLeft) + parseFloat(estilosIndice.paddingRight);
    const paddingListaX = parseFloat(estilosScroll.paddingLeft) + parseFloat(estilosScroll.paddingRight);
    const bordeX = parseFloat(estilosIndice.borderLeftWidth) + parseFloat(estilosIndice.borderRightWidth);
    const enlaceReferencia = lista.querySelector("a");
    const fuente = enlaceReferencia ? getComputedStyle(enlaceReferencia).font : estilosIndice.font;
    const extra = INDICE_MARGEN_EXTRA + INDICE_DESPLAZAMIENTO_ACTIVO;

    return { paddingX, paddingListaX, bordeX, fuente, extra };
  }

  // --------------------------------------------------------------------------
  // Ancho del panel — PC: hueco a la izquierda del contenido
  //                  Móvil: hasta 80 % del ancho de pantalla
  // --------------------------------------------------------------------------

  /** PC: espacio entre el borde izquierdo y el inicio del .contenedor-hoja. */
  function calcularAnchoDisponible() {
    const separacion = obtenerVariableNumerica("--indice-separacion");
    const margen = obtenerVariableNumerica("--indice-pos-izq");
    const margenContenido = contenedor.getBoundingClientRect().left;

    return Math.floor(margenContenido - separacion - margen);
  }

  /** Lee --indice-ancho-max del CSS o usa 300px por defecto. */
  function obtenerAnchoMaximoIndice() {
    const desdeCss = obtenerVariableNumerica("--indice-ancho-max");
    return Number.isFinite(desdeCss) && desdeCss > 0 ? desdeCss : 300;
  }

  /** Límite superior del ancho: hueco lateral en PC o 80 % viewport en móvil. */
  function calcularAnchoMaximoIndice() {
    const anchoDisponible = calcularAnchoDisponible();
    const anchoMax = obtenerAnchoMaximoIndice();

    // Móvil: sin hueco lateral suficiente → usar porcentaje de pantalla
    if (anchoDisponible < INDICE_ANCHO_MIN) {
      return Math.min(anchoMax, Math.floor(window.innerWidth * 0.80));
    }

    // PC: ajustar al hueco real entre borde y contenido
    return Math.max(INDICE_ANCHO_MIN, Math.min(anchoMax, anchoDisponible));
  }

  /** Calcula --indice-ancho según el texto más ancho de las entradas. */
  function ajustarAnchoIndice() {
    if (document.body.classList.contains("indice-colapsado")) return;

    const anchoMaximoTotal = calcularAnchoMaximoIndice();
    const { paddingX, paddingListaX, bordeX, fuente, extra } = obtenerMedidasIndice();
    const anchoMinimoToggle = 40;
    const maxContenido = anchoMaximoTotal - paddingX - paddingListaX - bordeX - extra;

    let anchoTextoMax = anchoMinimoToggle;

    lista.querySelectorAll("a").forEach((enlace) => {
      let anchoEfectivo;

      if (enlace.dataset.indiceManual) {
        // Entrada con data-indice en el h3/h4: medir HTML tal cual
        const span = enlace.querySelector(".indice-texto");
        const html = span ? span.innerHTML : (enlace.dataset.textoOriginal || "");
        anchoEfectivo = medirAnchoHtmlMultilinea(html, fuente);
      } else {
        const texto = enlace.dataset.textoOriginal;
        if (!texto) return;

        const anchoUnaLinea = medirTexto(texto, fuente);

        if (anchoUnaLinea <= maxContenido) {
          anchoEfectivo = anchoUnaLinea;
        } else {
          const salto = obtenerSaltoOptimo(texto, fuente);
          anchoEfectivo = salto
            ? Math.max(medirTexto(salto[0], fuente), medirTexto(salto[1], fuente))
            : anchoUnaLinea;
        }
      }

      anchoTextoMax = Math.max(anchoTextoMax, Math.ceil(anchoEfectivo));
    });

    const anchoTotalNecesario = anchoTextoMax + extra + paddingX + paddingListaX + bordeX;
    const anchoFinal = Math.min(Math.max(INDICE_ANCHO_MIN, anchoTotalNecesario), anchoMaximoTotal);

    document.documentElement.style.setProperty("--indice-ancho", `${anchoFinal}px`);

    return anchoFinal - paddingX - paddingListaX - bordeX - extra;
  }

  /** Fija --indice-top debajo del hero si existe, o con OFFSET_TOP. */
  function ajustarPosicionIndice() {
    let top = OFFSET_TOP;

    if (hero) {
      const heroRect = hero.getBoundingClientRect();
      top = heroRect.bottom > OFFSET_TOP ? heroRect.bottom + OFFSET_TOP : OFFSET_TOP;
    }

    document.documentElement.style.setProperty("--indice-top", `${top}px`);
  }

  // --------------------------------------------------------------------------
  // Saltos de línea (máx. 2 líneas por entrada)
  // --------------------------------------------------------------------------

  /** Busca el corte en dos líneas que minimice el ancho máximo. */
  function obtenerSaltoOptimo(texto, fuente) {
    const tieneMarca = texto.startsWith("»");
    const textoSinMarca = tieneMarca ? texto.replace(/^»\s*/, "") : texto;
    const palabras = textoSinMarca.split(/\s+/);

    if (palabras.length < 2) return null;

    const prefijo = tieneMarca ? "» " : "";
    let mejorSalto = null;
    let mejorAncho = Infinity;

    for (let i = 1; i < palabras.length; i++) {
      const linea1 = palabras.slice(0, i).join(" ");
      const linea2 = palabras.slice(i).join(" ");
      const linea1Completa = `${prefijo}${linea1}`;
      const ancho = Math.max(medirTexto(linea1Completa, fuente), medirTexto(linea2, fuente));

      if (ancho < mejorAncho) {
        mejorAncho = ancho;
        mejorSalto = [linea1Completa, linea2];
      }
    }

    return mejorSalto;
  }

  /** Aplica salto en el span si reduce el ancho respecto a una sola línea. */
  function aplicarSaltoEnSpan(enlace, span, original, fuente) {
    const anchoUnaLinea = medirTexto(original, fuente);
    const salto = obtenerSaltoOptimo(original, fuente);

    if (enlace.dataset.subindice) {
      poblarSubindice(span, original);
    } else {
      span.textContent = original;
    }

    span.style.whiteSpace = "normal";

    if (!salto) return;

    const anchoConSalto = Math.max(medirTexto(salto[0], fuente), medirTexto(salto[1], fuente));
    if (anchoConSalto >= anchoUnaLinea) return;

    if (enlace.dataset.subindice) {
      const primeraLinea = salto[0].replace(/^»\s*/, "");
      const marca = document.createElement("span");
      marca.className = "indice-marca";
      marca.setAttribute("aria-hidden", "true");
      marca.textContent = "»";

      const cuerpo = document.createElement("span");
      cuerpo.className = "indice-etiqueta";
      cuerpo.innerHTML = `${primeraLinea}<br>${salto[1]}`;

      span.replaceChildren(marca, cuerpo);
      return;
    }

    span.innerHTML = `${salto[0]}<br>${salto[1]}`;
  }

  /** Recorre enlaces y aplica una o dos líneas según maxContenido disponible. */
  function aplicarSaltosMultilinea(maxContenido) {
    if (document.body.classList.contains("indice-colapsado")) return;

    lista.querySelectorAll("a").forEach((enlace) => {
      if (enlace.dataset.indiceManual) return;

      const span = enlace.querySelector(".indice-texto");
      const original = enlace.dataset.textoOriginal;
      if (!span || !original) return;

      const fuente = getComputedStyle(enlace).font;
      const anchoUnaLinea = medirTexto(original, fuente);

      if (maxContenido !== undefined && anchoUnaLinea <= maxContenido) {
        if (enlace.dataset.subindice) {
          poblarSubindice(span, original);
        } else {
          span.textContent = original;
        }
        span.style.whiteSpace = "nowrap";
      } else {
        aplicarSaltoEnSpan(enlace, span, original, fuente);
      }
    });
  }

  /** Orquesta posición vertical, ancho del panel y saltos de línea. */
  function recalcularIndice() {
    ajustarPosicionIndice();
    const maxContenido = ajustarAnchoIndice();
    aplicarSaltosMultilinea(maxContenido);
  }

  // --------------------------------------------------------------------------
  // Generación del índice desde h3/h4 del main
  // --------------------------------------------------------------------------

  /** Construye la lista de enlaces a partir de encabezados con id en <main>. */
  function generarIndice() {
    const secciones = document.querySelectorAll("main h3[id], main h4[id]");
    lista.innerHTML = "";

    secciones.forEach((seccion) => {
      const enlace = document.createElement("a");
      enlace.href = `#${seccion.id}`;

      let texto;

      if (seccion.dataset.indice) {
        // Texto personalizado desde data-indice (puede incluir <br>)
        texto = seccion.dataset.indice.replace(/<br\s*\/?>/gi, " ");
        crearTextoIndice(enlace, seccion.dataset.indice, true);
        enlace.dataset.indiceManual = "true";
      } else if (seccion.tagName === "H4") {
        texto = formatearSubtitulo(seccion.textContent);
        crearTextoIndice(enlace, texto);
        enlace.dataset.subindice = "true";
      } else {
        texto = seccion.textContent.trim();
        crearTextoIndice(enlace, texto);
      }

      enlace.dataset.textoOriginal = texto;
      lista.appendChild(document.createElement("li")).appendChild(enlace);
    });
  }

  // --------------------------------------------------------------------------
  // UI: botón colapsar / expandir (móvil arranca colapsado)
  // --------------------------------------------------------------------------

  /** Crea toggle, área scroll y estado inicial PC vs móvil con localStorage. */
  function configurarIndice() {
    const toggle = document.createElement("button");
    toggle.className = "indice-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-controls", "indice-lateral");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Ocultar índice");
    toggle.innerHTML = '<span aria-hidden="true">‹</span>';

    indice.id = "indice-lateral";
    indice.prepend(toggle);

    areaScroll = document.createElement("div");
    areaScroll.className = "indice-scroll-area";
    lista.parentNode.insertBefore(areaScroll, lista);
    areaScroll.appendChild(lista);

    /** Sincroniza icono, ARIA y etiqueta según clase indice-colapsado en body. */
    function actualizarToggle() {
      const colapsado = document.body.classList.contains("indice-colapsado");
      toggle.setAttribute("aria-expanded", String(!colapsado));
      toggle.setAttribute("aria-label", colapsado ? "Mostrar índice" : "Ocultar índice");
      toggle.querySelector("span").textContent = colapsado ? "›" : "‹";
    }

    // Listener: clic en botón colapsar / expandir
    toggle.addEventListener("click", () => {
      document.body.classList.toggle("indice-colapsado");
      actualizarToggle();
      localStorage.setItem("indice-colapsado", document.body.classList.contains("indice-colapsado") ? "1" : "0");
      recalcularIndice();
    });

    const preferenciaGuardada = localStorage.getItem("indice-colapsado");
    const pantallaMovil = window.matchMedia("(max-width: 700px)").matches;

    // Móvil sin preferencia guardada → colapsado por defecto; PC → expandido
    if (preferenciaGuardada === "1" || (preferenciaGuardada === null && pantallaMovil)) {
      document.body.classList.add("indice-colapsado");
    }

    actualizarToggle();
    ajustarPosicionIndice();
  }

  // --------------------------------------------------------------------------
  // Scroll spy — resalta la sección visible
  // --------------------------------------------------------------------------

  /** Observa h3/h4 y marca .seccion-activa en el enlace correspondiente. */
  function iniciarScrollSpy() {
    const secciones = document.querySelectorAll("main h3[id], main h4[id]");
    const enlacesIndice = indice.querySelectorAll("a");

    const vigilante = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const idSeccion = entry.target.getAttribute("id");

        enlacesIndice.forEach((enlace) => {
          enlace.classList.remove("seccion-activa");
          if (enlace.getAttribute("href") === `#${idSeccion}`) {
            enlace.classList.add("seccion-activa");
          }
        });
      });
    }, {
      root: null,
      rootMargin: "-20% 0px -70% 0px", // zona activa en la parte superior del viewport
      threshold: 0
    });

    secciones.forEach((seccion) => vigilante.observe(seccion));
  }

  // --------------------------------------------------------------------------
  // Inicialización y listeners
  // --------------------------------------------------------------------------
  configurarIndice();
  generarIndice();
  iniciarScrollSpy();
  recalcularIndice();

  // Recálculos diferidos: layout, fuentes e imágenes pueden cambiar medidas
  requestAnimationFrame(recalcularIndice);
  setTimeout(() => {
    recalcularIndice();
    document.body.classList.add("indice-listo"); // evita parpadeo antes del primer cálculo
  }, 100);
  setTimeout(recalcularIndice, 300);

  // Listener: recalcular al terminar de cargar recursos
  window.addEventListener("load", recalcularIndice);

  // Listener: al hacer scroll, solo reposicionar verticalmente (hero fijo/sticky)
  window.addEventListener("scroll", ajustarPosicionIndice);

  // Listener: resize ventana → ancho PC/móvil y saltos de línea
  window.addEventListener("resize", recalcularIndice);

  // ResizeObserver: hero, contenido y cabecera pueden cambiar el hueco lateral (PC)
  if (window.ResizeObserver) {
    const observadorLayout = new ResizeObserver(recalcularIndice);

    if (hero) {
      observadorLayout.observe(hero);
    }

    observadorLayout.observe(contenedor);

    const headerContainer = document.querySelector("#header-container");
    if (headerContainer) {
      observadorLayout.observe(headerContainer);
    }
  }

  // Listener: imagen del hero al cargar puede alterar --indice-top
  const imagenHero = hero?.querySelector("img");
  if (imagenHero) {
    imagenHero.addEventListener("load", recalcularIndice);
  }
});
