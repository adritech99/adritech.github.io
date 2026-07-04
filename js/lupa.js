/* ==========================================================================
   LUPA Y VISOR DE IMÁGENES — Zoom en escritorio y visor a pantalla completa
   - Escritorio: lupa cuadrada que sigue el cursor sobre imágenes con zoom.
   - Todas las vistas: clic abre un visor modal con la imagen ampliada.
   ========================================================================== */

/* --- Utilidades de viewport --- */

// Detecta si el ancho de pantalla corresponde a vista móvil (≤768px)
function esVistaMovil() {
  return window.matchMedia("(max-width: 768px)").matches;
}

/* --- Visor modal a pantalla completa --- */

// Crea (o reutiliza) el overlay modal para mostrar imágenes ampliadas
function crearVisor() {
  let visor = document.getElementById("visor-esquema-movil");

  if (!visor) {
    visor = document.createElement("div");
    visor.id = "visor-esquema-movil";
    visor.className = "visor-esquema-movil";
    visor.innerHTML = `
      <button type="button" class="visor-esquema-cerrar" aria-label="Cerrar">×</button>
      <img class="visor-esquema-imagen" alt="">
    `;
    document.body.appendChild(visor);

    // Cerrar al pulsar fuera de la imagen (sobre el fondo oscuro)
    visor.addEventListener("click", (evento) => {
      if (evento.target === visor) cerrarVisor();
    });

    visor.querySelector(".visor-esquema-cerrar").addEventListener("click", cerrarVisor);
  }

  return visor;
}

// Muestra la imagen en el visor modal y bloquea el scroll del body
function abrirVisor(img) {
  const visor = crearVisor();
  const imagenGrande = visor.querySelector(".visor-esquema-imagen");

  imagenGrande.src = img.currentSrc || img.src; // Usa la variante responsive si existe
  imagenGrande.alt = img.alt || "";

  visor.classList.add("activo");
  document.body.classList.add("visor-esquema-abierto");
}

// Oculta el visor y restaura el scroll normal de la página
function cerrarVisor() {
  const visor = document.getElementById("visor-esquema-movil");
  if (!visor) return;

  visor.classList.remove("activo");
  document.body.classList.remove("visor-esquema-abierto");
}

/* --- Lupa de zoom en escritorio --- */

// Activa la lupa cuadrada que sigue el cursor y muestra la zona ampliada
function iniciarLupaEscritorio(contenedor, lupa, img) {
  contenedor.addEventListener("mousemove", (evento) => {
    if (esVistaMovil()) return; // En móvil solo se usa el visor por clic

    lupa.style.display = "block";

    const rect = img.getBoundingClientRect();
    let x = evento.clientX - rect.left; // Posición del cursor respecto a la imagen
    let y = evento.clientY - rect.top;

    // Limita la lupa para que no salga por los bordes de la imagen (eje X)
    let left = x - (lupa.offsetWidth / 2);
    if (left < 0) left = 0;
    if (left > img.width - lupa.offsetWidth) left = img.width - lupa.offsetWidth;

    // Limita la lupa para que no salga por los bordes de la imagen (eje Y)
    let top = y - (lupa.offsetHeight / 2);
    if (top < 0) top = 0;
    if (top > img.height - lupa.offsetHeight) top = img.height - lupa.offsetHeight;

    lupa.style.left = left + "px";
    lupa.style.top = top + "px";

    const zoom = 2.5; // Factor de ampliación de la zona bajo la lupa
    lupa.style.backgroundImage = `url('${img.currentSrc || img.src}')`;
    lupa.style.backgroundSize = `${img.width * zoom}px ${img.height * zoom}px`;

    // Calcula el desplazamiento del fondo para centrar la zona ampliada bajo el cursor
    let bgX = (x * zoom) - (lupa.offsetWidth / 2);
    let bgY = (y * zoom) - (lupa.offsetHeight / 2);

    // Evita que el fondo ampliado muestre áreas fuera de la imagen
    if (bgX < 0) bgX = 0;
    if (bgX > (img.width * zoom) - lupa.offsetWidth) bgX = (img.width * zoom) - lupa.offsetWidth;
    if (bgY < 0) bgY = 0;
    if (bgY > (img.height * zoom) - lupa.offsetHeight) bgY = (img.height * zoom) - lupa.offsetHeight;

    lupa.style.backgroundPosition = `-${bgX}px -${bgY}px`;
  });

  contenedor.addEventListener("mouseleave", () => {
    lupa.style.display = "none"; // Oculta la lupa al salir del área de la imagen
  });
}

/* --- Visor por clic en cualquier contenedor de imagen --- */

// Marca el contenedor como tocable y abre el visor al hacer clic
function iniciarVisorImagen(contenedor, img) {
  contenedor.classList.add("imagen-zoom-tocable");

  contenedor.addEventListener("click", () => {
    abrirVisor(img);
  });
}

/* --- Filtrado de imágenes del proyecto --- */

// Excluye imágenes de cabecera, footer, logos, tarjetas, etc.
function esImagenExcluida(img) {
  return Boolean(img.closest(
    ".descarga-archivos, #header-container, #footer-container, .hero, .header-logo, .logo-link, .logo, .tarjeta-proyecto, #catalogo-proyectos"
  ));
}

// Devuelve las imágenes del main que deben tener visor al clic
function obtenerImagenesProyecto() {
  return Array.from(document.querySelectorAll("main img"))
    .filter((img) => !esImagenExcluida(img));
}

// Inicializa el visor por clic en fotos del proyecto que aún no tienen contenedor de zoom
function iniciarFotosVisor() {
  obtenerImagenesProyecto().forEach((img) => {
    if (img.closest(".imagen-zoom-contenedor")) return; // Ya gestionada por la lupa dedicada

    const contenedor = img.closest(
      "figure, .contenedor-imagen-centrada, .contenedor-imagen-vertical, .imagen-lateral-intro"
    ) || img.parentElement;

    if (!contenedor || contenedor.dataset.visorImagen === "1") return; // Evita doble inicialización

    contenedor.dataset.visorImagen = "1";
    iniciarVisorImagen(contenedor, img);
  });
}

/* --- Inicialización global --- */

let lupasIniciadas = false; // Garantiza una sola ejecución del setup

function iniciarLupasGlobales() {
  if (lupasIniciadas) return;
  lupasIniciadas = true;

  // Contenedores con lupa explícita en el HTML (.imagen-zoom-contenedor)
  document.querySelectorAll(".imagen-zoom-contenedor").forEach((contenedor) => {
    if (contenedor.dataset.lupaIniciada === "1") return;

    const lupa = contenedor.querySelector(".lupa-cuadrada");
    const img = contenedor.querySelector(".img-zoom");
    if (!img || !lupa) return;

    contenedor.dataset.lupaIniciada = "1";
    if (!esVistaMovil()) iniciarLupaEscritorio(contenedor, lupa, img); // Lupa solo en escritorio
    iniciarVisorImagen(contenedor, img); // Visor por clic en todas las vistas
  });

  iniciarFotosVisor(); // Resto de imágenes del main sin contenedor de lupa dedicado
}

// Espera a que imágenes y estilos estén cargados antes de medir dimensiones
window.addEventListener("load", iniciarLupasGlobales);

// Cierra el visor modal con la tecla Escape
document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape") cerrarVisor();
});
