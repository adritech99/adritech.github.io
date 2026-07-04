/* ═══════════════════════════════════════════════════════════
   VISOR DE CÓDIGO — Carga y resaltado estilo VS Code
   Lee archivos .py y .cpp (u otros) vía fetch, aplica Prism y
   personaliza tokens con clases propias (vsc-control, vsc-type, etc.).
   ═══════════════════════════════════════════════════════════ */

const PRISM_COMPONENTES = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components';

const PALABRAS_CONTROL_CPP = ['if', 'else', 'while', 'for', 'return', 'switch', 'case', 'break'];
const PALABRAS_CONTROL_PYTHON = [
    'if', 'elif', 'else', 'while', 'for', 'return', 'def', 'class', 'import', 'from',
    'with', 'try', 'except', 'finally', 'raise', 'pass', 'break', 'continue', 'in',
    'and', 'or', 'not', 'lambda', 'yield', 'async', 'await'
];
const MODIFICADORES_CPP = ['const', 'static', 'constexpr'];
const TIPOS_CPP = ['int', 'byte', 'bool', 'float', 'void', 'char', 'long', 'uint8_t', 'uint16_t', 'uint32_t'];

const TIPOS_PISTACHO = [
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

/** Detecta el lenguaje Prism según la extensión del archivo. */
function inferirLenguajeDesdeRuta(ruta) {
    const extension = ruta.split('.').pop().toLowerCase();

    if (extension === 'py') return 'python';
    if (['cpp', 'cc', 'cxx', 'h', 'hpp', 'hxx', 'c'].includes(extension)) return 'cpp';

    return 'cpp';
}

/** Carga un script de Prism solo si hace falta. */
function cargarScriptPrism(url) {
    if (document.querySelector(`script[src="${url}"]`)) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
        document.head.appendChild(script);
    });
}

/** Asegura que Prism tenga el gramático del lenguaje pedido. */
async function asegurarPrismLenguaje(lenguaje) {
    if (!window.Prism) return;

    if (lenguaje === 'python' && !Prism.languages.python) {
        await cargarScriptPrism(`${PRISM_COMPONENTES}/prism-python.min.js`);
    }

    if (lenguaje === 'cpp') {
        if (!Prism.languages.c) {
            await cargarScriptPrism(`${PRISM_COMPONENTES}/prism-c.min.js`);
        }
        if (!Prism.languages.cpp) {
            await cargarScriptPrism(`${PRISM_COMPONENTES}/prism-cpp.min.js`);
        }

        Prism.languages.cpp['custom-types'] = {
            pattern: /\b(?:SemaphoreHandle_t|TaskHandle_t)\b/,
            alias: 'class-name'
        };
    }
}

/** Envuelve tipos Pistacho en <span class="token vsc-pistacho">. */
function resaltarTiposPistacho(codeElement) {
    const patron = new RegExp(`\\b(${TIPOS_PISTACHO.join('|')})\\b`, 'g');
    const walker = document.createTreeWalker(codeElement, NodeFilter.SHOW_TEXT);
    const nodos = [];

    while (walker.nextNode()) {
        const nodo = walker.currentNode;
        if (!patron.test(nodo.textContent)) continue;
        if (nodo.parentElement.closest('.token')) continue;
        nodos.push(nodo);
        patron.lastIndex = 0;
    }

    nodos.forEach(nodo => {
        const fragmento = document.createDocumentFragment();
        const partes = nodo.textContent.split(patron);

        partes.forEach(parte => {
            if (TIPOS_PISTACHO.includes(parte)) {
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

/** Aplica colores VS Code según el lenguaje del archivo. */
function aplicarEstiloTokens(codeElement, lenguaje) {
    const palabrasControl = lenguaje === 'python' ? PALABRAS_CONTROL_PYTHON : PALABRAS_CONTROL_CPP;

    codeElement.querySelectorAll('.token').forEach(token => {
        const word = token.textContent.trim();

        if (palabrasControl.includes(word)) {
            token.className = 'token vsc-control';
        }

        if (lenguaje === 'cpp' && MODIFICADORES_CPP.includes(word)) {
            token.className = 'token vsc-rosa-custom';
        }

        if (lenguaje === 'cpp' && TIPOS_CPP.includes(word)) {
            token.className = 'token vsc-type';
        }
    });

    if (lenguaje === 'cpp') {
        resaltarTiposPistacho(codeElement);
    }
}

/** Inicializa todos los contenedores con atributo data-ruta. */
async function inicializarVisoresCodigo() {
    const visores = document.querySelectorAll('[data-ruta]');

    for (const visor of visores) {
        const ruta = visor.getAttribute('data-ruta');
        const lenguaje = visor.getAttribute('data-lenguaje') || inferirLenguajeDesdeRuta(ruta);

        visor.innerHTML = `
        <div class="vsc-header">
            <div class="vsc-dots">
                <span class="dot red"></span>
                <span class="dot yellow"></span>
                <span class="dot green"></span>
            </div>
        </div>
        <pre class="line-numbers"><code class="language-${lenguaje}">Cargando código...</code></pre>
        `;

        const codeElement = visor.querySelector('code');

        try {
            const respuesta = await fetch(ruta);
            if (!respuesta.ok) throw new Error('404');

            const texto = await respuesta.text();
            codeElement.textContent = texto;

            if (window.Prism) {
                await asegurarPrismLenguaje(lenguaje);
                Prism.highlightElement(codeElement);

                setTimeout(() => aplicarEstiloTokens(codeElement, lenguaje), 50);
            }
        } catch (err) {
            codeElement.textContent = `Error: No se pudo cargar el archivo en ${ruta}`;
        }
    }
}

document.addEventListener('DOMContentLoaded', inicializarVisoresCodigo);
