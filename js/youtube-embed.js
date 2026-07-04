/* ==========================================================================
   YOUTUBE EMBED — Sustituye contenedores por iframes de YouTube
   Busca elementos con data-youtube-url, extrae el ID del vídeo y crea
   un iframe con dominio youtube-nocookie para mayor privacidad.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const videos = document.querySelectorAll("[data-youtube-url]"); // Todos los marcadores de vídeo

  /* --- Extracción del ID de vídeo desde distintos formatos de URL --- */

  function obtenerIdYoutube(url) {
    try {
      const parsedUrl = new URL(url);

      // Formato corto: youtu.be/VIDEO_ID
      if (parsedUrl.hostname.includes("youtu.be")) {
        return parsedUrl.pathname.split("/").filter(Boolean)[0];
      }

      // YouTube Shorts: youtube.com/shorts/VIDEO_ID
      if (parsedUrl.pathname.startsWith("/shorts/")) {
        return parsedUrl.pathname.split("/").filter(Boolean)[1];
      }

      // URL ya embebida: youtube.com/embed/VIDEO_ID
      if (parsedUrl.pathname.startsWith("/embed/")) {
        return parsedUrl.pathname.split("/").filter(Boolean)[1];
      }

      // Formato clásico: youtube.com/watch?v=VIDEO_ID
      return parsedUrl.searchParams.get("v");
    } catch {
      return null; // URL mal formada
    }
  }

  /* --- Creación e inserción de iframes --- */

  videos.forEach((contenedor) => {
    const url = contenedor.dataset.youtubeUrl;
    const videoId = obtenerIdYoutube(url);

    // Marca error si falta ID o sigue el placeholder de plantilla
    if (!videoId || videoId === "ID_DEL_VIDEO") {
      contenedor.dataset.videoError = "true";
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}`; // Dominio sin cookies de seguimiento
    iframe.title = "Vídeo de YouTube";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.loading = "lazy"; // Carga diferida para no bloquear el render inicial

    contenedor.prepend(iframe); // Inserta el iframe al inicio del contenedor
  });
});
