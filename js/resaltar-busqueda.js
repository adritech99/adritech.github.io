/* ==========================================================================
   RESALTAR BÚSQUEDA — Destaca un fragmento al llegar desde el buscador
   Lee datos guardados en sessionStorage, localiza el elemento en la página
   y aplica una animación de resaltado temporal con scroll automático.
   ========================================================================== */

(function() {

  /* --- Configuración --- */

  // Clave de sessionStorage: usa la del módulo global AdriTechBusqueda si existe
  const DESTACAR_KEY = typeof AdriTechBusqueda !== "undefined"
    ? AdriTechBusqueda.DESTACAR_KEY
    : "adritech-destacar-busqueda";
  const DURACION_MS = 3000; // Tiempo visible del resaltado antes de la animación de salida

  /* --- Normalización de texto para comparaciones --- */

  // Pasa a minúsculas, quita acentos y unifica espacios/puntuación para comparar textos
  function normalizar(texto) {
    return texto
      .toLowerCase()
      .normalize("NFD") // Descompone caracteres acentuados
      .replace(/[\u0300-\u036f]/g, "") // Elimina marcas diacríticas (acentos)
      .replace(/[^\p{L}\p{N}]+/gu, " ") // Sustituye símbolos por espacio
      .replace(/\s+/g, " ") // Colapsa espacios múltiples
      .trim();
  }

  /* --- Selectores y filtrado por sección --- */

  // Devuelve un selector CSS válido según la etiqueta indicada, o uno por defecto
  function selectorEtiqueta(etiqueta) {
    if (!etiqueta || !/^[A-Z][A-Z0-9]*$/i.test(etiqueta)) {
      return "p, li, figcaption, h2, h3, h4, .pie-foto, .pie-foto-galeria";
    }
    return etiqueta.toLowerCase();
  }

  // Restringe candidatos a elementos que aparecen después de la sección dada en el DOM
  function filtrarDespuesDeSeccion(candidatos, idSeccion) {
    const seccion = document.getElementById(idSeccion);
    if (!seccion) return candidatos;

    return candidatos.filter((elemento) =>
      Boolean(seccion.compareDocumentPosition(elemento) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
  }

  /* --- Búsqueda del elemento objetivo --- */

  // Localiza en la página el nodo que coincide con los datos de la búsqueda
  function encontrarElemento(datos) {
    const main = document.querySelector("main") || document.body;
    const textoObjetivo = datos.texto.replace(/\s+/g, " ").trim();
    const textoNorm = normalizar(textoObjetivo);

    // Prioridad 1: búsqueda directa por id de elemento
    if (datos.idElemento) {
      const porId = document.getElementById(datos.idElemento);
      if (porId) return porId;
    }

    let candidatos = [...main.querySelectorAll(selectorEtiqueta(datos.etiqueta))];

    // Limita candidatos a los que están tras la sección indicada
    if (datos.idSeccion) {
      candidatos = filtrarDespuesDeSeccion(candidatos, datos.idSeccion);
    }

    // Prioridad 2: coincidencia exacta del texto normalizado
    for (const elemento of candidatos) {
      const texto = elemento.textContent.replace(/\s+/g, " ").trim();
      if (normalizar(texto) === textoNorm) return elemento;
    }

    // Prioridad 3: el texto objetivo está contenido en el elemento
    for (const elemento of candidatos) {
      if (normalizar(elemento.textContent).includes(textoNorm)) return elemento;
    }

    // Respaldo: devuelve la sección si no se encontró el fragmento exacto
    if (datos.idSeccion) {
      return document.getElementById(datos.idSeccion);
    }

    return null;
  }

  /* --- Aplicación del efecto visual --- */

  // Añade clases CSS de resaltado, hace scroll y las retira tras la animación
  function aplicarDestacado(elemento) {
    elemento.classList.add("destacado-busqueda");
    elemento.scrollIntoView({ behavior: "smooth", block: "center" }); // Centra el elemento en pantalla

    window.setTimeout(() => {
      elemento.classList.add("destacado-busqueda-saliendo"); // Inicia transición de salida
      window.setTimeout(() => {
        elemento.classList.remove("destacado-busqueda", "destacado-busqueda-saliendo");
      }, 500); // Duración de la animación de salida (ms)
    }, DURACION_MS);
  }

  /* --- Punto de entrada --- */

  // Lee sessionStorage, parsea JSON y dispara el resaltado en el siguiente frame
  function iniciarDestacadoBusqueda() {
    const datosRaw = sessionStorage.getItem(DESTACAR_KEY);
    if (!datosRaw) return; // No hay búsqueda pendiente de resaltar

    sessionStorage.removeItem(DESTACAR_KEY); // Evita repetir el resaltado al recargar

    let datos;
    try {
      datos = JSON.parse(datosRaw);
    } catch (error) {
      return; // JSON inválido: abortar sin error visible
    }

    // Espera al siguiente repintado para asegurar que el DOM esté listo
    window.requestAnimationFrame(() => {
      const elemento = encontrarElemento(datos);
      if (elemento) aplicarDestacado(elemento);
    });
  }

  // Ejecuta al cargar el DOM o de inmediato si el documento ya está listo
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarDestacadoBusqueda);
  } else {
    iniciarDestacadoBusqueda();
  }
})();
