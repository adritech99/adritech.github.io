fetch("header.html")
  .then(function (response) {
    return response.text();
  })
  .then(function (data) {
    document.getElementById("header-container").innerHTML = data;
    iniciarReloj();
    ajustarPosicionTexto();  // <<-- mover aquí
  });

function ajustarPosicionTexto() {
  const texto = document.getElementById('titulo-texto');
  if (!texto) return;

  const contenedor = texto.parentElement;

  const estilos = getComputedStyle(texto);
  const lineHeight = parseFloat(estilos.lineHeight);
  const alturaTexto = texto.getBoundingClientRect().height;

  const numLineas = Math.round(alturaTexto / lineHeight);

  if (numLineas === 1) {
    contenedor.style.top = '20px';
  } else if (numLineas === 2) {
    contenedor.style.top = '-8px';
  } else {
    contenedor.style.top = '10px';
  }
}

window.addEventListener('resize', ajustarPosicionTexto);

// reloj...
function iniciarReloj() {
  var contenedor = document.getElementById("fecha-hora");

  function actualizarFechaHora() {
    var ahora = new Date();
    var opcionesFecha = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    };

    var fecha = ahora.toLocaleDateString("es-ES", opcionesFecha);

    fecha = fecha.split(" ").map(function(palabra) {
      if (palabra.toLowerCase() === "de") return "de";
      return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    }).join(" ");

    var hora = ahora.toLocaleTimeString("es-ES");
    contenedor.textContent = fecha + " | " + hora;
  }

  actualizarFechaHora();
  setInterval(actualizarFechaHora, 1000);
}

