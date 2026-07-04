/* ==========================================================================
   FOOTER — Carga dinámica del pie de página
   Obtiene el HTML del footer desde un archivo externo e inyecta el año actual.
   ========================================================================== */

// Solicita el contenido de footer.html y lo inserta en el contenedor de la página
fetch("footer.html")
  .then(response => response.text()) // Convierte la respuesta HTTP en texto HTML
  .then(data => {
    // Inserta el HTML recibido dentro del elemento reservado para el footer
    document.getElementById("footer-container").innerHTML = data;

    // Actualiza el año de copyright con el año en curso, si existe el span correspondiente
    const yearSpan = document.getElementById("year");
    if (yearSpan) {
      yearSpan.textContent = new Date().getFullYear(); // Año actual del sistema
    }
  });
