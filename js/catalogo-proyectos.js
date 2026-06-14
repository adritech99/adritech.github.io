/* ═══════════════════════════════════════════════════════════
   CATÁLOGO DE PROYECTOS — Renderizado de tarjetas
   Lee el array global PROYECTOS_CATALOGO y genera el HTML
   del grid en la página de proyectos.
   ═══════════════════════════════════════════════════════════ */

/**
 * Construye y pinta todas las tarjetas de proyecto en #catalogo-proyectos.
 * Requiere que data/proyectos-catalogo.js se haya cargado antes.
 */
function renderizarCatalogo() {
  const contenedor = document.getElementById("catalogo-proyectos");
  if (!contenedor || typeof PROYECTOS_CATALOGO === "undefined") return;

  contenedor.innerHTML = "";

  PROYECTOS_CATALOGO.forEach((proyecto) => {
    const tarjeta = document.createElement("a");
    tarjeta.href = proyecto.href;
    tarjeta.className = "tarjeta-proyecto";
    tarjeta.setAttribute("draggable", "false"); // evita arrastre accidental de enlaces

    // Etiquetas opcionales (tecnologías, categorías…)
    const etiquetasHTML = (proyecto.etiquetas || [])
      .map((e) => `<span class="proyecto-tag">${e}</span>`)
      .join("");

    tarjeta.innerHTML = `
      <div class="tarjeta-proyecto-imagen">
        <img src="${proyecto.imagen}" alt="${proyecto.titulo}" draggable="false">
        <div class="tarjeta-proyecto-brillo"></div>
      </div>
      <div class="tarjeta-proyecto-cuerpo">
        <h3 class="tarjeta-proyecto-titulo">${proyecto.titulo}</h3>
        <p class="tarjeta-proyecto-desc">${proyecto.descripcion}</p>
        <div class="tarjeta-proyecto-tags">${etiquetasHTML}</div>
      </div>
      <div class="tarjeta-proyecto-flecha">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      </div>
    `;

    contenedor.appendChild(tarjeta);
  });
}

/* ── Arranque (compatible con script al final del body) ── */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderizarCatalogo);
} else {
  renderizarCatalogo();
}
