document.addEventListener("DOMContentLoaded", () => {
    const indice = document.querySelector(".indice-lateral");
    const hero = document.querySelector(".hero");
  
    if (!indice || !hero) return;
  
    const OFFSET = 20;
  
    function ajustarIndice() {
        const heroRect = hero.getBoundingClientRect();
        const scrollActual = window.scrollY;
        
        // Calculamos la posición real
        let posicionFinal;
        if (heroRect.bottom > OFFSET) {
            posicionFinal = heroRect.bottom + OFFSET;
        } else {
            posicionFinal = OFFSET;
        }

        // Aplicamos el top
        indice.style.top = posicionFinal + "px";
        
        // 3. SOLO AHORA lo hacemos aparecer
        indice.classList.add("visible");
    }
  
    // Escuchamos eventos
    window.addEventListener("scroll", ajustarIndice);
    window.addEventListener("resize", ajustarIndice);
  
    // Usamos setTimeout(0) o requestAnimationFrame para forzar que 
    // el navegador aplique el estilo antes de mostrarlo
    setTimeout(ajustarIndice, 50);
});

document.addEventListener("DOMContentLoaded", () => {
    // 1. Seleccionamos todos los h3 que tienen un ID (tus secciones)
    const secciones = document.querySelectorAll('main h3[id]');
    const enlacesIndice = document.querySelectorAll('.indice-lateral a');
  
    // 2. Configuración del "Vigilante" (Observer)
    const opciones = {
      root: null, // relativo al viewport (pantalla)
      rootMargin: '-20% 0px -70% 0px', // El resaltado cambia cuando el título está en la parte superior
      threshold: 0
    };
  
    const vigilante = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        // Si la sección entra en el área definida
        if (entry.isIntersecting) {
          const idSeccion = entry.target.getAttribute('id');
          
          // Quitamos la clase activa de todos los enlaces
          enlacesIndice.forEach(enlace => {
            enlace.classList.remove('seccion-activa');
            
            // Si el href del enlace coincide con el ID de la sección, lo activamos
            if (enlace.getAttribute('href') === `#${idSeccion}`) {
              enlace.classList.add('seccion-activa');
            }
          });
        }
      });
    }, opciones);
  
    // 3. Empezamos a vigilar cada h3
    secciones.forEach(seccion => vigilante.observe(seccion));
  });