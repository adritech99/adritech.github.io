/* ═══════════════════════════════════════════════════════════
   VISOR DE CÓDIGO — Carga y resaltado estilo VS Code
   Lee archivos fuente vía fetch, aplica Prism y personaliza
   tokens con clases propias (vsc-control, vsc-type, etc.).
   ═══════════════════════════════════════════════════════════ */

/** Inicializa todos los contenedores con atributo data-ruta. */
async function inicializarVisoresCodigo() {
    const visores = document.querySelectorAll('[data-ruta]');

    /* ── Tipos personalizados del proyecto Pistacho ─────── */

    // Identificadores propios del firmware que Prism no reconoce como tipos
    const tiposPistacho = [
        'TFT_eSPI',
        'XPT2046_Touchscreen',
        'SensirionI2cSht4x',
        'Calib',
        'P',
        'TS_Point',
        'lv_color_t',
        'lv_disp_draw_buf_t',
        'lv_disp_drv_t',
        'lv_area_t',
        'lv_indev_drv_t',
        'lv_indev_data_t',
        'SemaphoreHandle_t',
        'TaskHandle_t',
        'TickType_t'
    ];

    /**
     * Envuelve tipos Pistacho en <span class="token vsc-pistacho">.
     * Recorre nodos de texto sin tocar tokens ya generados por Prism.
     */
    function resaltarTiposPistacho(codeElement) {
        const patron = new RegExp(`\\b(${tiposPistacho.join('|')})\\b`, 'g');
        const walker = document.createTreeWalker(codeElement, NodeFilter.SHOW_TEXT);
        const nodos = [];

        while (walker.nextNode()) {
            const nodo = walker.currentNode;
            if (!patron.test(nodo.textContent)) continue;
            if (nodo.parentElement.closest('.token')) continue; // ya resaltado
            nodos.push(nodo);
            patron.lastIndex = 0; // reset del regex global
        }

        nodos.forEach(nodo => {
            const fragmento = document.createDocumentFragment();
            const partes = nodo.textContent.split(patron);

            partes.forEach(parte => {
                if (tiposPistacho.includes(parte)) {
                    const span = document.createElement('span');
                    span.className = 'token vsc-pistacho';
                    span.textContent = parte;
                    fragmento.appendChild(span);
                } else if (parte) {
                    fragmento.appendChild(document.createTextNode(parte));
                }
            });

            nodo.parentNode.replaceChild(fragmento, nodo);
        });
    }

    /* ── Carga y renderizado de cada visor ──────────────── */

    for (const visor of visores) {
        const ruta = visor.getAttribute('data-ruta');
        const nombreArchivo = ruta.split('/').pop();

        // Estructura visual tipo ventana de editor (puntos rojo/amarillo/verde)
        visor.innerHTML = `
        <div class="vsc-header">
            <div class="vsc-dots">
                <span class="dot red"></span>
                <span class="dot yellow"></span>
                <span class="dot green"></span>
            </div>

        </div>
        <pre class="line-numbers"><code class="language-cpp">Cargando código...</code></pre>
        `;

        const codeElement = visor.querySelector('code');

        try {
            const respuesta = await fetch(ruta);
            if (!respuesta.ok) throw new Error("404");
            let texto = await respuesta.text();

            // Insertamos el texto plano antes del resaltado
            codeElement.textContent = texto;

            // Aplicamos el resaltado de Prism
            if (window.Prism) {
                Prism.highlightElement(codeElement);

                // Corregimos clases de token después de Prism (no conoce nuestro esquema VS Code)
                setTimeout(() => {
                    const tokens = codeElement.querySelectorAll('.token');
                    tokens.forEach(token => {
                        const word = token.textContent.trim();

                        // Estructuras de control → verde (vsc-control)
                        if (['if', 'else', 'while', 'for', 'return', 'switch', 'case', 'break'].includes(word)) {
                            token.className = 'token vsc-control';
                        }

                        // Modificadores → rosa (vsc-rosa-custom)
                        if (['const', 'static', 'constexpr'].includes(word)) {
                            token.className = 'token vsc-rosa-custom';
                        }
                        // Tipos primitivos → azul (vsc-type)
                        if (['int', 'byte', 'bool', 'float', 'void', 'char', 'long', 'uint8_t', 'uint16_t', 'uint32_t'].includes(word)) {
                            token.className = 'token vsc-type';
                        }
                    });

                    resaltarTiposPistacho(codeElement);
                }, 50);
            }
        } catch (err) {
            codeElement.textContent = `Error: No se pudo cargar el archivo en ${ruta}`;
        }
    }
}

document.addEventListener('DOMContentLoaded', inicializarVisoresCodigo);
