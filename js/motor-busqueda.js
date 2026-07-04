/* ═══════════════════════════════════════════════════════════
   MOTOR DE BÚSQUEDA — AdriTechBusqueda (IIFE)
   Indexa páginas HTML del sitio, busca por términos y expone
   utilidades de resaltado, rutas y navegación a resultados.
   ═══════════════════════════════════════════════════════════ */

const AdriTechBusqueda = (function() {
  const DESTACAR_KEY = "adritech-destacar-busqueda"; // clave sessionStorage al hacer clic en resultado
  const MANIFEST_URL = "data/paginas-busqueda.json";

  /* ── Normalización de texto ──────────────────────────── */

  /** Minúsculas, sin acentos ni puntuación; espacios colapsados. */
  function normalizar(texto) {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* ── Carga de páginas e índice ───────────────────────── */

  async function cargarManifest() {
    const respuesta = await fetch(MANIFEST_URL);
    if (!respuesta.ok) throw new Error("No se pudo cargar el manifiesto de búsqueda");
    return respuesta.json();
  }

  async function cargarPagina(url) {
    const respuesta = await fetch(url, { cache: "no-store" });
    if (!respuesta.ok) throw new Error(`No se pudo cargar ${url}`);
    const html = await respuesta.text();
    return new DOMParser().parseFromString(html, "text/html");
  }

  /* ── Extracción de fragmentos indexables ─────────────── */

  /**
   * Convierte un elemento DOM en un fragmento buscable con href ancla.
   * Asocia h3/h4 como sección contextual para párrafos y listas.
   */
  function crearFragmento(paginaUrl, elemento, seccionActual, seccionActualId) {
    const texto = elemento.textContent.replace(/\s+/g, " ").trim();
    if (!texto || texto.length < 2) return null;

    const idElemento = elemento.id || "";
    const idSeccion = seccionActualId || "";
    let href = paginaUrl;

    if (idElemento) {
      href += `#${idElemento}`;
    } else if (idSeccion) {
      href += `#${idSeccion}`;
    }

    const etiqueta = elemento.tagName;
    let seccion = "";
    let tipo = "contenido";

    if (/^H2$/i.test(etiqueta)) {
      tipo = "titulo";
    } else if (/^H[34]$/i.test(etiqueta)) {
      tipo = "seccion";
      seccion = texto;
    } else if (seccionActual) {
      seccion = seccionActual;
    }

    return { texto, href, seccion, etiqueta, tipo, idElemento, idSeccion };
  }

  /** Evita indexar un h2 que repite el título de la página. */
  function esTituloDuplicado(texto, tituloPagina) {
    return normalizar(texto) === normalizar(tituloPagina);
  }

  /** Recorre main y extrae fragmentos + texto completo normalizado. */
  function extraerDeDocumento(doc, pagina) {
    const main = doc.querySelector("main") || doc.body;
    const tituloPagina = pagina.titulo || doc.querySelector("title")?.textContent?.trim() || "";
    const ruta = Array.isArray(pagina.ruta) && pagina.ruta.length
      ? pagina.ruta
      : [tituloPagina];
    const fragmentos = [];
    const selectores = "h2, h3, h4, p, li, figcaption, .pie-foto, .pie-foto-galeria";
    let seccionActual = "";
    let seccionActualId = "";

    main.querySelectorAll(selectores).forEach((elemento) => {
      if (/^H3$/i.test(elemento.tagName)) {
        seccionActual = elemento.textContent.replace(/\s+/g, " ").trim();
        seccionActualId = elemento.id || "";
      } else if (/^H4$/i.test(elemento.tagName)) {
        seccionActual = elemento.textContent.replace(/\s+/g, " ").trim();
        seccionActualId = elemento.id || "";
      }

      const fragmento = crearFragmento(pagina.url, elemento, seccionActual, seccionActualId);
      if (!fragmento || esTituloDuplicado(fragmento.texto, tituloPagina)) return;
      fragmentos.push(fragmento);
    });

    const textoCompleto = normalizar(
      [tituloPagina, ...fragmentos.map((f) => f.texto)].join(" ")
    );

    return {
      url: pagina.url,
      titulo: tituloPagina,
      ruta,
      fragmentos,
      textoCompleto
    };
  }

  /** Construye el índice completo a partir del manifiesto JSON. */
  async function obtenerIndice() {
    const manifest = await cargarManifest();
    const indice = [];

    for (const pagina of manifest.paginas) {
      try {
        const doc = await cargarPagina(pagina.url);
        indice.push(extraerDeDocumento(doc, pagina));
      } catch (error) {
        console.warn("Página omitida en búsqueda:", pagina.url);
      }
    }

    return indice;
  }

  /* ── Búsqueda y puntuación ───────────────────────────── */

  /** Comprueba que todos los términos aparezcan en el texto normalizado. */
  function coincide(texto, terminos) {
    const normalizado = normalizar(texto);
    return terminos.every((termino) => normalizado.includes(termino));
  }

  /**
   * Busca en el índice y devuelve páginas ordenadas por puntos.
   * Título: +12; encabezados: +6; contenido: +2.
   */
  function buscar(indice, consulta) {
    const terminos = normalizar(consulta)
      .split(/\s+/)
      .filter(Boolean);

    if (!terminos.length) return [];

    const resultados = [];

    indice.forEach((pagina) => {
      let puntos = 0;
      const coincidencias = [];
      const tituloNorm = normalizar(pagina.titulo);

      if (coincide(pagina.titulo, terminos)) puntos += 12;

      pagina.fragmentos.forEach((fragmento) => {
        if (!coincide(fragmento.texto, terminos)) return;
        if (esTituloDuplicado(fragmento.texto, pagina.titulo)) return;

        puntos += /^H[234]$/i.test(fragmento.etiqueta) ? 6 : 2;
        // Evita duplicar la misma coincidencia
        if (!coincidencias.some((c) =>
          c.href === fragmento.href &&
          c.idElemento === fragmento.idElemento &&
          c.texto === fragmento.texto
        )) {
          coincidencias.push(fragmento);
        }
      });

      // Fallback: coincidencia en texto completo sin fragmento concreto
      if (puntos === 0 && coincide(pagina.textoCompleto, terminos)) {
        puntos = 1;
        coincidencias.push({
          texto: pagina.fragmentos[0]?.texto || pagina.titulo,
          href: pagina.url,
          seccion: "",
          etiqueta: "P"
        });
      }

      if (puntos > 0) {
        resultados.push({
          ...pagina,
          puntos,
          coincidencias
        });
      }
    });

    return resultados.sort((a, b) => b.puntos - a.puntos);
  }

  /* ── Presentación de resultados ──────────────────────── */

  function crearExtracto(texto) {
    return texto;
  }

  /** Determina si una palabra debe envolverse en <mark>. */
  function debeResaltarPalabra(palabraNorm, termino) {
    if (palabraNorm === termino) return true;
    if (termino.length < 2) return false;
    return palabraNorm.includes(termino);
  }

  /** Envuelve en <mark> las palabras que coinciden con la consulta. */
  function resaltar(texto, consulta) {
    const terminos = normalizar(consulta).split(/\s+/).filter(Boolean);
    if (!terminos.length) return texto;

    return texto.replace(/(\S+)/g, (palabra) => {
      const palabraNorm = normalizar(palabra);
      const coincide = terminos.some((termino) => debeResaltarPalabra(palabraNorm, termino));
      return coincide ? `<mark>${palabra}</mark>` : palabra;
    });
  }

  /* ── Navegación y persistencia ───────────────────────── */

  function irABusqueda(consulta) {
    const termino = consulta.trim();
    if (!termino) return;
    window.location.href = `busqueda.html?q=${encodeURIComponent(termino)}`;
  }

  /** Guarda en sessionStorage el fragmento para resaltarlo al abrir la página. */
  function guardarDestinoBusqueda(coincidencia) {
    sessionStorage.setItem(DESTACAR_KEY, JSON.stringify({
      idElemento: coincidencia.idElemento || "",
      idSeccion: coincidencia.idSeccion || "",
      texto: coincidencia.texto,
      etiqueta: coincidencia.etiqueta || ""
    }));
  }

  /** Construye la ruta legible «Sección › Subsección» para la UI. */
  function formatearRuta(ruta, coincidencia) {
    const partes = Array.isArray(ruta) ? [...ruta] : [];

    if (coincidencia?.tipo === "seccion" || coincidencia?.tipo === "titulo") {
      const tituloCoincidencia = coincidencia.texto.trim();
      const yaIncluido = partes.some((parte) => normalizar(parte) === normalizar(tituloCoincidencia));
      if (!yaIncluido && tituloCoincidencia) partes.push(tituloCoincidencia);
    } else if (coincidencia?.seccion) {
      const yaIncluido = partes.some((parte) => normalizar(parte) === normalizar(coincidencia.seccion));
      if (!yaIncluido) partes.push(coincidencia.seccion);
    }

    return partes.join(" › ");
  }

  /** Etiqueta humana del tipo de coincidencia (Título, Sección, etc.). */
  function etiquetaTipo(coincidencia) {
    if (coincidencia.tipo === "titulo") return "Título del proyecto";
    if (coincidencia.tipo === "seccion") return "Sección";
    if (coincidencia.seccion) return "Dentro de la sección";
    return "Contenido";
  }

  /* ── API pública ─────────────────────────────────────── */

  return {
    obtenerIndice,
    buscar,
    crearExtracto,
    resaltar,
    irABusqueda,
    guardarDestinoBusqueda,
    formatearRuta,
    etiquetaTipo,
    DESTACAR_KEY
  };
})();
