/* ═══════════════════════════════════════════════════════════
   DATOS DEL CATÁLOGO DE PROYECTOS
   Array global consumido por js/catalogo-proyectos.js.
   Cada entrada define enlace, título, descripción, imagen
   y etiquetas opcionales para el grid de proyectos.
   ═══════════════════════════════════════════════════════════ */

const PROYECTOS_CATALOGO = [
  {
    href: "PCB_ADC_3304_RASPBERRY_PI.html",
    titulo: "PCB ADC 3304 – Raspberry Pi",
    descripcion: "Diseño de PCB para interfaz entre el conversor analógico-digital MCP3304 y Raspberry Pi. Captura de señales con alta resolución y comunicación SPI.",
    imagen: "img/proyectos/PCB_ADC_3304_RASPBERRY_PI/ADC3304_RASPBERRY_PI_4.webp",
    etiquetas: ["PCB", "Raspberry Pi", "SPI"]
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
    descripcion: "Deshumidificador doméstico construido desde cero con PCB personalizada, ESP32, pantalla TFT y control automático de humedad vía Wi-Fi.",
    imagen: "img/proyectos/DESHUMIDIFICADOR DIY/PCB_top_montada.webp",
    etiquetas: ["ESP32", "PCB", "TFT"]
  }
];
