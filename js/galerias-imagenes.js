/* ═══════════════════════════════════════════════════════════
   GALERÍAS DE IMÁGENES — Ajuste dinámico de anchos
   Calcula variables CSS (--ancho-galeria-vertical / horizontal)
   para que las galerías de 2 y 3 imágenes mantengan proporción.
   ═══════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  // Colecciones de galerías según su layout en el DOM
  const galeriasTresImagenes = document.querySelectorAll(".galeria-3-imagenes");
  const galeriasDosImagenes = document.querySelectorAll(".galeria-2-imagenes");

  /* ── Comprobación de carga de imagen ─────────────────── */

  /** Devuelve true si la imagen ya está cargada y tiene dimensiones válidas. */
  function imagenLista(img) {
    return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
  }

  /* ── Variables CSS de la galería ─────────────────────── */

  /** Elimina las variables personalizadas para volver al CSS por defecto. */
  function limpiarVariables(galeria) {
    galeria.style.removeProperty("--ancho-galeria-vertical");
    galeria.style.removeProperty("--ancho-galeria-horizontal");
  }

  /**
   * Obtiene separación (gap) y ancho útil de la galería.
   * En móvil (≤768px) limpia variables y devuelve null.
   */
  function obtenerDatosBase(galeria) {
    if (window.matchMedia("(max-width: 768px)").matches) {
      limpiarVariables(galeria);
      return null;
    }

    const estilos = getComputedStyle(galeria);
    const separacion = parseFloat(estilos.columnGap) || 0;
    const anchoDisponible = galeria.clientWidth - separacion;

    if (anchoDisponible <= 0) return null;

    return { separacion, anchoDisponible };
  }

  /** Escribe los anchos calculados como variables CSS en el contenedor. */
  function aplicarAnchos(galeria, anchoVertical, anchoHorizontal) {
    galeria.style.setProperty("--ancho-galeria-vertical", `${anchoVertical}px`);
    galeria.style.setProperty("--ancho-galeria-horizontal", `${anchoHorizontal}px`);
  }

  /* ── Cálculo por tipo de galería ─────────────────────── */

  /**
   * Galería de 3 imágenes: 1 vertical + 2 horizontales apiladas.
   * Resuelve el sistema de ecuaciones para igualar alturas visuales.
   */
  function ajustarGaleriaTresImagenes(galeria) {
    const datos = obtenerDatosBase(galeria);
    if (!datos) return;

    const vertical = galeria.querySelector(".galeria-imagen-vertical img");
    const horizontales = galeria.querySelectorAll(".galeria-imagen-horizontal img");

    if (!vertical || horizontales.length !== 2) return;
    if (![vertical, ...horizontales].every(imagenLista)) return;

    const proporcionVertical = vertical.naturalWidth / vertical.naturalHeight;
    // Suma de alturas relativas de las horizontales (altura/ancho por imagen)
    const sumaAltosHorizontalesPorAncho = Array.from(horizontales)
      .reduce((total, img) => total + (img.naturalHeight / img.naturalWidth), 0);

    const anchoHorizontal = (
      datos.anchoDisponible - (datos.separacion * proporcionVertical)
    ) / (1 + (proporcionVertical * sumaAltosHorizontalesPorAncho));

    const altoVertical = (anchoHorizontal * sumaAltosHorizontalesPorAncho) + datos.separacion;
    const anchoVertical = altoVertical * proporcionVertical;

    aplicarAnchos(galeria, anchoVertical, anchoHorizontal);
  }

  /**
   * Galería de 2 imágenes: 1 vertical + 1 horizontal en fila.
   * Ambas comparten la misma altura visual.
   */
  function ajustarGaleriaDosImagenes(galeria) {
    const datos = obtenerDatosBase(galeria);
    if (!datos) return;

    const vertical = galeria.querySelector(".galeria-imagen-vertical img");
    const horizontal = galeria.querySelector(".galeria-imagen-horizontal img");

    if (!vertical || !horizontal) return;
    if (![vertical, horizontal].every(imagenLista)) return;

    const proporcionVertical = vertical.naturalWidth / vertical.naturalHeight;
    const proporcionHorizontal = horizontal.naturalWidth / horizontal.naturalHeight;
    const altoComun = datos.anchoDisponible / (proporcionVertical + proporcionHorizontal);

    aplicarAnchos(galeria, altoComun * proporcionVertical, altoComun * proporcionHorizontal);
  }

  /* ── Inicialización y eventos ────────────────────────── */

  /** Recalcula todas las galerías de la página. */
  function ajustarTodas() {
    galeriasTresImagenes.forEach(ajustarGaleriaTresImagenes);
    galeriasDosImagenes.forEach(ajustarGaleriaDosImagenes);
  }

  // Recalcular cuando cada imagen termine de cargar
  [...galeriasTresImagenes, ...galeriasDosImagenes].forEach((galeria) => {
    galeria.querySelectorAll("img").forEach((img) => {
      img.addEventListener("load", ajustarTodas);
    });
  });

  ajustarTodas();
  window.addEventListener("resize", ajustarTodas);
});
