/* ==========================================================================
   PROTECCIÓN DE COPIA — Restricción de copia y selección en la página
   Bloquea copiar, cortar, menú contextual y atajos de teclado fuera de
   campos editables (inputs, textareas, contenteditable).
   ========================================================================== */

(function() {

  /* --- Detección de campos editables --- */

  // Comprueba si el elemento clicado/pertenece a un campo donde sí se permite copiar
  function esCampoEditable(elemento) {
    if (!elemento || !elemento.closest) return false;
    return Boolean(elemento.closest("input, textarea, [contenteditable='true']"));
  }

  /* --- Bloqueo de eventos del ratón --- */

  // Cancela el evento salvo que el origen sea un campo editable
  function bloquearSiNoEsEditable(evento) {
    if (esCampoEditable(evento.target)) return; // Permite la acción en formularios
    evento.preventDefault(); // Impide copiar, cortar, menú contextual o selección
  }

  // Registra los bloqueos a nivel de documento
  document.addEventListener("copy", bloquearSiNoEsEditable);
  document.addEventListener("cut", bloquearSiNoEsEditable);
  document.addEventListener("contextmenu", bloquearSiNoEsEditable); // Clic derecho
  document.addEventListener("selectstart", bloquearSiNoEsEditable); // Inicio de selección de texto

  /* --- Bloqueo de atajos de teclado (Ctrl/Cmd + tecla) --- */

  document.addEventListener("keydown", (evento) => {
    if (esCampoEditable(evento.target)) return; // No interferir con campos de entrada

    const tecla = evento.key.toLowerCase();
    const conModificador = evento.ctrlKey || evento.metaKey; // Ctrl en Windows/Linux, Cmd en Mac

    // Bloquea: copiar (c), cortar (x), seleccionar todo (a), ver código (u), guardar (s), imprimir (p)
    if (conModificador && ["c", "x", "a", "u", "s", "p"].includes(tecla)) {
      evento.preventDefault();
    }
  });
})();
