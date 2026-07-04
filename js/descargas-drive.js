/* ==========================================================================
   DESCARGAS DRIVE — Enlaces de descarga directa desde Google Drive
   Intercepta clics en tarjetas de descarga y redirige a la URL uc?export
   para forzar la descarga del archivo en lugar de abrir la vista previa.
   ========================================================================== */

(function() {

  /* --- Extracción del ID de archivo de Drive --- */

  // Obtiene el identificador del archivo desde URLs de compartir de Google Drive
  function extraerIdDrive(url) {
    if (!url) return "";

    const patrones = [
      /\/file\/d\/([a-zA-Z0-9_-]+)/, // Formato: drive.google.com/file/d/ID/...
      /[?&]id=([a-zA-Z0-9_-]+)/      // Formato con parámetro ?id=ID
    ];

    for (const patron of patrones) {
      const coincidencia = url.match(patron);
      if (coincidencia) return coincidencia[1];
    }

    return "";
  }

  /* --- Construcción de URL de descarga directa --- */

  // Convierte un enlace de vista de Drive en enlace de descarga forzada
  function enlaceDescargaDrive(url) {
    const id = extraerIdDrive(url);
    if (!id) return url; // Si no hay ID, devuelve la URL original sin modificar
    return `https://drive.google.com/uc?export=download&id=${id}`;
  }

  /* --- Registro de manejadores en las tarjetas --- */

  function iniciarDescargasDrive() {
    document.querySelectorAll(".tarjeta-descarga[data-descarga-drive]").forEach((enlace) => {
      enlace.addEventListener("click", (evento) => {
        const url = enlace.getAttribute("href");

        // Enlace vacío o placeholder: cancelar navegación
        if (!url || url === "#") {
          evento.preventDefault();
          return;
        }

        // Enlaces que no son de Drive: dejar el comportamiento por defecto del navegador
        if (!url.includes("drive.google.com")) return;

        evento.preventDefault(); // Evita abrir la página de vista previa de Drive
        window.location.href = enlaceDescargaDrive(url); // Redirige a descarga directa
      });
    });
  }

  /* --- Punto de entrada --- */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarDescargasDrive);
  } else {
    iniciarDescargasDrive(); // DOM ya listo: ejecutar de inmediato
  }
})();
