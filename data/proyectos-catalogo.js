/* ═══════════════════════════════════════════════════════════
   DATOS DEL CATÁLOGO DE PROYECTOS
   Array global consumido por js/catalogo-proyectos.js.
   Cada entrada define enlace, título, descripción, imagen
   y etiquetas opcionales para el grid de proyectos.

   Al subir el sitio (_sync/iniciar.bat), las meta og:* y twitter:*
   de cada .html se generan automáticamente desde aquí.
   ═══════════════════════════════════════════════════════════ */

const PROYECTOS_CATALOGO = [
  {
    href: "PCB_ADC_3304_RASPBERRY_PI.html",
    titulo: "PCB ADC 3304 – Raspberry Pi",
    descripcion: "Diseño de PCB para interfaz entre el conversor analógico-digital MCP3304 y Raspberry Pi. Captura de señales con alta resolución y comunicación SPI.",
    imagen: "img/proyectos/PCB_ADC_3304_RASPBERRY_PI/ADC3304_RASPBERRY_PI_4.webp",
    etiquetas: ["Raspberry Pi", "MCP3304", "SPI", "PCB", "Python", "ADC", "Pantalla OLED", "SSD1306", "THT", "ATX"]
  },
  {
    href: "BASE_DE_DATOS_LABVIEW.html",
    titulo: "Base de datos / LabVIEW",
    descripcion: "Sistema de adquisición de datos con LabVIEW conectado a base de datos SQL para registro, visualización y análisis histórico de variables de proceso.",
    imagen: "img/proyectos/DESHUMIDIFICADOR DIY/PCB_top_montada.webp",
    etiquetas: ["LabVIEW", "SQL", "DAQ"]
  },
  {
    href: "AUTOMATIZACION_DE_CINTA_TRANSPORTADORA.html",
    titulo: "Automatización cinta transportadora",
    descripcion: "Control automático de cinta transportadora industrial con clasificación de piezas por visión artificial y comunicación IoT en tiempo real.",
    imagen: "img/proyectos/DESHUMIDIFICADOR DIY/PCB_top_montada.webp",
    etiquetas: ["IoT", "Arduino", "Visión artificial"]
  },
  {
    href: "DESHUMIDIFICADOR_DIY.html",
    titulo: "Deshumidificador DIY",
    descripcion: "Reconstrucción integral de un deshumidificador mediante una electrónica propia basada en ESP32, incorporando control inteligente, pantalla táctil TFT, firmware personalizado y nuevas funciones de seguridad y monitorización.",
    imagen: "img/proyectos/DESHUMIDIFICADOR DIY/Tarjeta_proyecto_deshumidificador.webp",
    etiquetas: ["ESP32", "PCB", "Pantalla TFT", "ILI9341", "SHT45", "SSR", "MOSFECT", "Proteus", "EEZ Studio", "PlatformIO", "SMD", "THT"]
  }
];
