/* ═══════════════════════════════════════════════════════════
   FORMULARIO DE CONTACTO — Envío con EmailJS
   Validación de campos, cooldown por email, verificación
   externa del dominio y feedback visual al usuario.
   ═══════════════════════════════════════════════════════════ */

/*
 * Para activarlo:
 *  1. Crea cuenta en https://www.emailjs.com (gratis, 200 emails/mes)
 *  2. Conecta tu cuenta Gmail como "Email Service" → copia el Service ID
 *  3. Crea un "Email Template" con las variables:
 *       {{first_name}}, {{last_name}}, {{email}}, {{subject}}, {{message}}
 *     Copia el Template ID
 *  4. Ve a Account → API Keys → copia la Public Key
 *  5. Rellena las tres constantes de abajo
 */

/* ── Credenciales EmailJS ────────────────────────────────── */

const EMAILJS_PUBLIC_KEY  = "-cAEyqjdF9c3h0Aqe";
const EMAILJS_SERVICE_ID  = "service_4cd95ri";
const EMAILJS_TEMPLATE_ID = "template_ofyi5ts";

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 horas entre envíos por mismo email

/* ── Utilidades de cooldown y verificación ─────────────── */

/** Comprueba si el email aún está en periodo de espera (24 h). */
function cooldownActivo(email) {
  const key    = "adritech_msg_" + email.toLowerCase().trim();
  const ultimo = localStorage.getItem(key);
  if (!ultimo) return false;
  return (Date.now() - parseInt(ultimo, 10)) < COOLDOWN_MS;
}

/** Registra la marca de tiempo del último envío exitoso. */
function registrarEnvio(email) {
  const key = "adritech_msg_" + email.toLowerCase().trim();
  localStorage.setItem(key, Date.now().toString());
}

/** Horas restantes de cooldown para mostrar al usuario. */
function horasRestantes(email) {
  const key    = "adritech_msg_" + email.toLowerCase().trim();
  const ultimo = localStorage.getItem(key);
  if (!ultimo) return 0;
  const ms = COOLDOWN_MS - (Date.now() - parseInt(ultimo, 10));
  return Math.ceil(ms / (60 * 60 * 1000));
}

/** Valida dominio MX y rechaza correos desechables vía mailcheck.ai. */
async function verificarEmail(email) {
  try {
    const res  = await fetch(`https://api.mailcheck.ai/email/${encodeURIComponent(email)}`);
    if (!res.ok) return { valido: true };
    const data = await res.json();
    if (data.mx === false)          return { valido: false, motivo: "El dominio del correo no existe." };
    if (data.disposable === true)   return { valido: false, motivo: "No se aceptan correos temporales." };
    return { valido: true };
  } catch {
    return { valido: true }; // si falla la API dejamos pasar
  }
}

/* ── Validación visual de campos ─────────────────────────── */

const CAMPOS = [
  { id: "c-nombre",    msg: "Escribe tu nombre."           },
  { id: "c-apellidos", msg: "Escribe tus apellidos."       },
  { id: "c-email",     msg: "Introduce un correo válido."  },
  { id: "c-asunto",    msg: "Indica el asunto."            },
  { id: "c-mensaje",   msg: "Escribe tu mensaje."          },
];

/** Crea o reutiliza el span de mensaje de error bajo cada campo. */
function asegurarMensajeError(campo) {
  let span = campo.parentElement.querySelector(".contacto-campo-error-msg");
  if (!span) {
    span = document.createElement("span");
    span.className = "contacto-campo-error-msg";
    span.setAttribute("aria-live", "polite");
    campo.parentElement.appendChild(span);
  }
  return span;
}

/** Aplica clase de error y muestra el texto debajo del campo. */
function marcarError(el, texto) {
  el.classList.remove("campo-error");
  void el.offsetWidth; // reinicia animación CSS
  el.classList.add("campo-error");
  const span = asegurarMensajeError(el);
  span.textContent = texto;
}

/** Quita el estado de error del campo. */
function limpiarError(el) {
  el.classList.remove("campo-error");
  const span = el.parentElement.querySelector(".contacto-campo-error-msg");
  if (span) span.textContent = "";
}

/** Valida todos los campos obligatorios; devuelve true si todo es correcto. */
function validarCampos(nombre, apellidos, email, asunto, mensaje) {
  let ok = true;

  const elNombre    = document.getElementById("c-nombre");
  const elApellidos = document.getElementById("c-apellidos");
  const elEmail     = document.getElementById("c-email");
  const elAsunto    = document.getElementById("c-asunto");
  const elMensaje   = document.getElementById("c-mensaje");

  if (!nombre)    { marcarError(elNombre,    "Escribe tu nombre.");           ok = false; }
  else              limpiarError(elNombre);

  if (!apellidos) { marcarError(elApellidos, "Escribe tus apellidos.");       ok = false; }
  else              limpiarError(elApellidos);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    marcarError(elEmail, "Introduce un correo válido.");
    ok = false;
  } else {
    limpiarError(elEmail);
  }

  if (!asunto)  { marcarError(elAsunto,  "Indica el asunto.");  ok = false; }
  else            limpiarError(elAsunto);

  if (!mensaje) { marcarError(elMensaje, "Escribe tu mensaje."); ok = false; }
  else            limpiarError(elMensaje);

  return ok;
}

/* ── Inicialización y envío del formulario ─────────────── */

(function () {
  const form   = document.getElementById("contacto-form");
  const estado = document.getElementById("contacto-estado");
  const boton  = document.getElementById("contacto-boton");

  if (!form) return;

  emailjs.init(EMAILJS_PUBLIC_KEY);

  // Quitar error visual al editar cualquier campo
  CAMPOS.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", () => limpiarError(el));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre    = document.getElementById("c-nombre").value.trim();
    const apellidos = document.getElementById("c-apellidos").value.trim();
    const email     = document.getElementById("c-email").value.trim();
    const asunto    = document.getElementById("c-asunto").value.trim();
    const mensaje   = document.getElementById("c-mensaje").value.trim();

    // 1 — Validación de campos obligatorios
    if (!validarCampos(nombre, apellidos, email, asunto, mensaje)) return;

    // 2 — Cooldown 24 h por dirección de correo
    if (cooldownActivo(email)) {
      const h = horasRestantes(email);
      marcarError(
        document.getElementById("c-email"),
        `Ya enviaste un mensaje con este correo. Espera ${h} h antes de volver a escribir.`
      );
      return;
    }

    // 3 — Verificar que el dominio del email existe
    boton.disabled = true;
    boton.classList.add("enviando");
    estado.textContent = "Verificando correo…";
    estado.className   = "contacto-estado";

    const { valido, motivo } = await verificarEmail(email);
    if (!valido) {
      marcarError(document.getElementById("c-email"), motivo);
      estado.textContent = "";
      boton.disabled = false;
      boton.classList.remove("enviando");
      return;
    }

    // 4 — Enviar mensaje vía EmailJS
    estado.textContent = "Enviando…";

    const nombreCompleto = `${nombre} ${apellidos}`.trim();
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreCompleto)}&background=008080&color=ffffff&size=128&bold=true&rounded=true`;
    const fechaEnvio = new Date().toLocaleString("es-ES", {
      weekday: "long", year: "numeric", month: "long",
      day: "numeric", hour: "2-digit", minute: "2-digit"
    });

    const datos = {
      first_name:  nombre,
      last_name:   apellidos,
      name:        nombreCompleto,
      email,
      subject:     asunto,
      title:       asunto,
      message:     mensaje,
      avatar_url:  avatarUrl,
      fecha_envio: fechaEnvio,
    };

    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, datos);
      registrarEnvio(email);
      form.reset();

      // Transición: ocultar formulario y mostrar pantalla de éxito
      form.classList.add("ocultando");
      setTimeout(() => {
        form.style.visibility = "hidden";
        const exito = document.getElementById("contacto-exito");
        if (exito) {
          exito.removeAttribute("aria-hidden");
          exito.classList.add("visible");
        }
      }, 420);

    } catch (err) {
      console.error("EmailJS error:", err);
      estado.textContent = "✗ No se pudo enviar. Inténtalo de nuevo o escríbeme directamente.";
      estado.className   = "contacto-estado error";
      boton.disabled     = false;
      boton.classList.remove("enviando");
    }
  });
})();
