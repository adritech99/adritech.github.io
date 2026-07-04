/* ═══════════════════════════════════════════════════════════
   PÁGINA DE BÚSQUEDA — Presentación de resultados
   Lee ?q= de la URL, consulta AdriTechBusqueda y pinta
   tarjetas con coincidencias resaltadas.
   ═══════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", async () => {
  const contenedor = document.getElementById("resultados-busqueda");
  const resumen = document.getElementById("resumen-busqueda");
  const params = new URLSearchParams(window.location.search);
  const consulta = (params.get("q") || "").trim();

  if (!contenedor) return;

  /* ── Estado sin consulta ─────────────────────────────── */

  if (!consulta) {
    resumen.textContent = "Escribe un término en la barra de búsqueda.";
    contenedor.innerHTML = "";
    return;
  }

  resumen.textContent = `Resultados para «${consulta}»`;
  contenedor.innerHTML = '<p class="busqueda-estado">Buscando en la web…</p>';

  try {
    const indice = await AdriTechBusqueda.obtenerIndice();
    const resultados = AdriTechBusqueda.buscar(indice, consulta);

    if (!resultados.length) {
      contenedor.innerHTML = '<p class="busqueda-sin-resultados">No se encontraron coincidencias.</p>';
      return;
    }

    contenedor.replaceChildren();

    /* ── Construcción de tarjetas por página ───────────── */

    resultados.forEach((resultado) => {
      const tarjeta = document.createElement("article");
      tarjeta.className = "tarjeta-resultado";

      // Cabecera: ruta de navegación + título enlazado
      const cabecera = document.createElement("div");
      cabecera.className = "resultado-cabecera";

      const rutaPagina = document.createElement("p");
      rutaPagina.className = "resultado-ruta";
      rutaPagina.textContent = AdriTechBusqueda.formatearRuta(resultado.ruta);
      cabecera.appendChild(rutaPagina);

      const enlaceTitulo = document.createElement("a");
      enlaceTitulo.className = "resultado-titulo";
      enlaceTitulo.href = resultado.url;
      enlaceTitulo.textContent = resultado.titulo;
      cabecera.appendChild(enlaceTitulo);

      tarjeta.appendChild(cabecera);

      // Lista de fragmentos coincidentes dentro de la página
      const lista = document.createElement("ul");
      lista.className = "resultado-coincidencias";

      resultado.coincidencias.forEach((coincidencia) => {
        const item = document.createElement("li");
        const enlaceItem = document.createElement("a");
        enlaceItem.href = coincidencia.href;
        enlaceItem.className = "resultado-item resultado-item-enlace";

        // Guarda destino para resaltar al llegar a la página destino
        enlaceItem.addEventListener("click", () => {
          AdriTechBusqueda.guardarDestinoBusqueda(coincidencia);
        });

        const ubicacion = document.createElement("p");
        ubicacion.className = "resultado-ubicacion";
        ubicacion.textContent = AdriTechBusqueda.formatearRuta(resultado.ruta, coincidencia);
        enlaceItem.appendChild(ubicacion);

        const cuerpo = document.createElement("div");
        cuerpo.className = "resultado-cuerpo";

        const tipo = document.createElement("span");
        tipo.className = "resultado-tipo";
        tipo.textContent = AdriTechBusqueda.etiquetaTipo(coincidencia);
        cuerpo.appendChild(tipo);

        const texto = document.createElement("span");
        texto.className = "resultado-texto";

        // Títulos y secciones se muestran completos; el resto usa extracto
        const esEncabezado = coincidencia.tipo === "titulo" || coincidencia.tipo === "seccion";
        const textoVisible = esEncabezado
          ? coincidencia.texto
          : AdriTechBusqueda.crearExtracto(coincidencia.texto, consulta);

        texto.innerHTML = AdriTechBusqueda.resaltar(textoVisible, consulta);
        cuerpo.appendChild(texto);
        enlaceItem.appendChild(cuerpo);

        item.appendChild(enlaceItem);
        lista.appendChild(item);
      });

      tarjeta.appendChild(lista);
      contenedor.appendChild(tarjeta);
    });
  } catch (error) {
    console.error(error);
    contenedor.innerHTML = '<p class="busqueda-error">No se pudo completar la búsqueda.</p>';
  }
});
