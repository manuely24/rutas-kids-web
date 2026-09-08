// =========================================================
// Rutas Seguras Kids - script.js
// Proyecto académico hecho con HTML, CSS y JavaScript puro
// =========================================================

// Ciudades disponibles para consultar el clima con OpenWeather.
const ciudades = {
  bucaramanga: { nombre: "Bucaramanga", latitud: 7.1193, longitud: -73.1227 },
  piedecuesta: { nombre: "Piedecuesta", latitud: 6.9879, longitud: -73.0497 },
  floridablanca: { nombre: "Floridablanca", latitud: 7.0622, longitud: -73.0864 }
};

// API key de OpenWeather (https://openweathermap.org/api)
const CLAVE_API_OPENWEATHER = "ba56f6e90ecb6adfb2299f9a0f26e989";

// Clave que usamos para guardar los datos en localStorage
const CLAVE_STORAGE = "rutasSegurasKids";

// Campos del formulario de estudiante: se reutilizan tanto para
// pedirlos con prompt() al editar, como para validar que no falten.
const CAMPOS_ESTUDIANTE = [
  { clave: "nombre", etiqueta: "Nombre completo:" },
  { clave: "edadGrado", etiqueta: "Edad o grado:" },
  { clave: "direccion", etiqueta: "Barrio o dirección:" },
  { clave: "acudiente", etiqueta: "Nombre del acudiente:" }
];

// Convierte el texto a minúsculas y quita espacios de más
function normalizarCiudad(texto) {
  return texto.trim().toLowerCase();
}

// Arreglo principal que guarda todas las rutas en memoria
let rutas = [];

// Guarda el id de la ruta que se está editando (null = se está creando una nueva)
let idRutaEditando = null;

// Referencias a los elementos del HTML principal
const formularioRuta = document.getElementById("formulario-ruta");
const inputNombreRuta = document.getElementById("input-nombre-ruta");
const inputConductor = document.getElementById("input-conductor");
const inputHora = document.getElementById("input-hora");
const inputCiudad = document.getElementById("input-ciudad");
const mensajeErrorFormulario = document.getElementById("mensaje-error-formulario");
const botonGuardarRuta = document.getElementById("boton-guardar-ruta");
const botonCancelarEdicion = document.getElementById("boton-cancelar-edicion");
const botonRestablecer = document.getElementById("boton-restablecer");
const mensajeNotificacion = document.getElementById("mensaje-notificacion");
const contenedorRutas = document.getElementById("contenedor-rutas");
const tituloFormulario = document.getElementById("titulo-formulario");
const fechaActual = document.getElementById("fecha-actual");
const resumenRutas = document.getElementById("resumen-rutas");
const resumenEstudiantes = document.getElementById("resumen-estudiantes");
const inputBuscador = document.getElementById("input-buscador");
const mensajeSinResultados = document.getElementById("mensaje-sin-resultados");

// =========================================================
// WEB COMPONENT: <route-card>
// Muestra la información de una ruta y permite agregar,
// editar y eliminar sus estudiantes. Usa Shadow DOM para que
// su estilo no se mezcle con el resto de la página.
// =========================================================
class RouteCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    const plantilla = document.getElementById("plantilla-route-card");
    this.shadowRoot.appendChild(plantilla.content.cloneNode(true));
  }

  // Se usa desde script.js para pasarle los datos: elemento.ruta = miRuta;
  set ruta(datosRuta) {
    this._ruta = datosRuta;
    this.renderizar();
  }

  get ruta() {
    return this._ruta;
  }

  renderizar() {
    const ruta = this._ruta;
    const raiz = this.shadowRoot;

    raiz.querySelector(".nombre-ruta").textContent = ruta.nombre;
    raiz.querySelector(".conductor").textContent = ruta.conductor;
    raiz.querySelector(".hora").textContent = ruta.hora;
    raiz.querySelector(".ciudad").textContent = ruta.ciudad;
    raiz.querySelector(".contador-estudiantes").textContent =
      ruta.estudiantes.length + " estudiante(s)";

    this.renderizarEstudiantes();
    this.conectarEventos();
    this.actualizarClima();
  }

  renderizarEstudiantes() {
    const lista = this.shadowRoot.querySelector(".lista-estudiantes");

    if (this._ruta.estudiantes.length === 0) {
      lista.innerHTML = `<li class="texto-vacio">No hay estudiantes asignados todavía</li>`;
      return;
    }

    lista.innerHTML = this._ruta.estudiantes
      .map(
        (estudiante) => `
      <li class="estudiante">
        <div class="datos-estudiante">
          <strong>${estudiante.nombre}</strong> - ${estudiante.edadGrado}<br>
          <small>${estudiante.direccion} | Acudiente: ${estudiante.acudiente}</small>
        </div>
        <div class="botones-estudiante">
          <button type="button" class="boton-editar-estudiante" data-id="${estudiante.id}">Editar</button>
          <button type="button" class="boton-eliminar-estudiante" data-id="${estudiante.id}">Eliminar</button>
        </div>
      </li>`
      )
      .join("");
  }

  // Consulta el clima de la ciudad de esta ruta y lo muestra
  async actualizarClima() {
    const parrafoClima = this.shadowRoot.querySelector(".clima");
    parrafoClima.textContent = "Consultando clima...";
    parrafoClima.textContent = await obtenerClima(this._ruta.ciudad);
  }

  // Dispara un CustomEvent que sube (bubbles) fuera del shadow DOM
  emitir(nombreEvento, detalle) {
    this.dispatchEvent(
      new CustomEvent(nombreEvento, { detail: detalle, bubbles: true, composed: true })
    );
  }

  // Conecta los botones y formularios de la tarjeta con sus funciones.
  // Se vuelve a llamar en cada render para que los botones de
  // estudiantes (que se recrean) queden funcionando.
  conectarEventos() {
    const raiz = this.shadowRoot;

    raiz.querySelector(".boton-eliminar-ruta").onclick = () => {
      if (confirm("¿Seguro que deseas eliminar esta ruta?")) {
        this.emitir("route-delete", { id: this._ruta.id });
      }
    };

    raiz.querySelector(".boton-editar-ruta").onclick = () => {
      this.emitir("route-edit", { id: this._ruta.id });
    };

    const formularioEstudiante = raiz.querySelector(".formulario-estudiante");
    formularioEstudiante.onsubmit = (evento) => {
      evento.preventDefault();

      const datos = {
        nombre: raiz.querySelector(".input-nombre-estudiante").value.trim(),
        edadGrado: raiz.querySelector(".input-edad-estudiante").value.trim(),
        direccion: raiz.querySelector(".input-direccion-estudiante").value.trim(),
        acudiente: raiz.querySelector(".input-acudiente-estudiante").value.trim()
      };
      const mensajeError = raiz.querySelector(".mensaje-error-estudiante");

      if (Object.values(datos).some((valor) => valor === "")) {
        mensajeError.textContent = "Todos los campos del estudiante son obligatorios";
        return;
      }

      mensajeError.textContent = "";
      this.emitir("student-add", {
        idRuta: this._ruta.id,
        estudiante: { id: Date.now().toString(), ...datos }
      });
      formularioEstudiante.reset();
    };

    raiz.querySelectorAll(".boton-eliminar-estudiante").forEach((boton) => {
      boton.onclick = () => {
        if (confirm("¿Seguro que deseas eliminar este estudiante?")) {
          this.emitir("student-delete", { idRuta: this._ruta.id, idEstudiante: boton.dataset.id });
        }
      };
    });

    // Botones "Editar" de cada estudiante (usa prompt para mantenerlo simple)
    raiz.querySelectorAll(".boton-editar-estudiante").forEach((boton) => {
      boton.onclick = () => {
        const estudiante = this._ruta.estudiantes.find((e) => e.id === boton.dataset.id);
        if (!estudiante) return;

        const actualizado = { id: estudiante.id };
        for (const campo of CAMPOS_ESTUDIANTE) {
          const valor = prompt(campo.etiqueta, estudiante[campo.clave]);
          if (valor === null) return; // el usuario canceló la edición
          actualizado[campo.clave] = valor.trim();
        }

        if (CAMPOS_ESTUDIANTE.some((campo) => actualizado[campo.clave] === "")) {
          alert("Todos los campos son obligatorios, no se guardaron los cambios");
          return;
        }

        this.emitir("student-edit", { idRuta: this._ruta.id, estudiante: actualizado });
      };
    });
  }
}

// Registramos el componente para poder usar <route-card> en el HTML
customElements.define("route-card", RouteCard);

// =========================================================
// ALMACENAMIENTO CON localStorage
// =========================================================

function guardarRutas() {
  localStorage.setItem(CLAVE_STORAGE, JSON.stringify(rutas));
}

function cargarRutas() {
  const datosGuardados = localStorage.getItem(CLAVE_STORAGE);
  rutas = datosGuardados ? JSON.parse(datosGuardados) : obtenerDatosIniciales();
  if (!datosGuardados) guardarRutas();
}

// Datos de ejemplo que se usan la primera vez o al restablecer.
// Se ampliaron a 3 rutas y 6 estudiantes para el filtro (ver "Adiccion Quiz").
function obtenerDatosIniciales() {
  return [
    {
      id: "ruta-norte",
      nombre: "Ruta Norte",
      conductor: "Carlos Gómez",
      hora: "6:30 AM",
      ciudad: "Bucaramanga",
      estudiantes: [
        {
          id: "estudiante-1",
          nombre: "Juan Pérez",
          edadGrado: "8 años",
          direccion: "Barrio El Prado",
          acudiente: "María Pérez"
        },
        {
          id: "estudiante-2",
          nombre: "Valentina Ríos",
          edadGrado: "3° primaria",
          direccion: "Barrio Cabecera",
          acudiente: "Jorge Ríos"
        }
      ]
    },
    {
      id: "ruta-sur",
      nombre: "Ruta Sur",
      conductor: "Ana Torres",
      hora: "6:45 AM",
      ciudad: "Floridablanca",
      estudiantes: [
        {
          id: "estudiante-3",
          nombre: "Samuel Ortiz",
          edadGrado: "9 años",
          direccion: "Barrio Caldas",
          acudiente: "Luisa Ortiz"
        },
        {
          id: "estudiante-4",
          nombre: "Camila Suárez",
          edadGrado: "4° primaria",
          direccion: "Barrio Lagos",
          acudiente: "Pedro Suárez"
        }
      ]
    },
    {
      id: "ruta-centro",
      nombre: "Ruta Centro",
      conductor: "Luis Martínez",
      hora: "7:00 AM",
      ciudad: "Piedecuesta",
      estudiantes: [
        {
          id: "estudiante-5",
          nombre: "Estudiante Ejemplo",
          edadGrado: "8 años",
          direccion: "Barrio San Francisco",
          acudiente: "Diana Gómez"
        },
        {
          id: "estudiante-6",
          nombre: "Mateo Gómez",
          edadGrado: "2° primaria",
          direccion: "Barrio Centro",
          acudiente: "Sandra Gómez"
        }
      ]
    }
  ];
}

// Guarda en localStorage, vuelve a dibujar todo y avisa al usuario.
// Reúne en un solo lugar los tres pasos que se repetían en cada
// operación (crear, editar, eliminar rutas o estudiantes).
function persistirCambios(mensaje) {
  guardarRutas();
  renderizarRutas();
  mostrarNotificacion(mensaje);
}

// =========================================================
// FUNCIÓN DEL CLIMA (API de OpenWeather, requiere API key)
// =========================================================

// Consulta el clima actual de una ciudad usando fetch y async/await
async function obtenerClima(ciudad) {
  const coordenadas = ciudades[normalizarCiudad(ciudad)];
  if (!coordenadas) return "No hay coordenadas disponibles para esta ciudad";

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coordenadas.latitud}&lon=${coordenadas.longitud}&appid=${CLAVE_API_OPENWEATHER}&units=metric&lang=es`;
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error("La respuesta del servidor no fue válida");

    const datos = await respuesta.json();
    return `Clima en ${coordenadas.nombre}: ${datos.main.temp}°C`;
  } catch (error) {
    return "No se pudo consultar el clima";
  }
}

// =========================================================
// RENDERIZADO PRINCIPAL DE LAS TARJETAS
// =========================================================

// Dibuja en pantalla una lista de rutas (puede ser todas o una lista filtrada)
function dibujarTarjetas(listaRutas) {
  contenedorRutas.innerHTML = "";

  listaRutas.forEach((ruta) => {
    const tarjeta = document.createElement("route-card");
    tarjeta.ruta = ruta;
    contenedorRutas.appendChild(tarjeta);
  });

  mensajeSinResultados.classList.toggle("oculto", listaRutas.length > 0);
}

// Revisa el texto del buscador y dibuja solo las rutas que coincidan
function aplicarFiltro() {
  const texto = inputBuscador.value.trim().toLowerCase();

  const rutasFiltradas = texto
    ? rutas.filter(
        (ruta) => ruta.nombre.toLowerCase().includes(texto) || ruta.ciudad.toLowerCase().includes(texto)
      )
    : rutas;

  dibujarTarjetas(rutasFiltradas);
}

// Actualiza las pastillas con el total de rutas y de estudiantes
function actualizarResumen() {
  const totalEstudiantes = rutas.reduce((total, ruta) => total + ruta.estudiantes.length, 0);
  resumenRutas.textContent = `📋 Rutas: ${rutas.length}`;
  resumenEstudiantes.textContent = `🎒 Estudiantes: ${totalEstudiantes}`;
}

// Muestra la fecha de hoy en el encabezado
function mostrarFechaActual() {
  const opciones = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  fechaActual.textContent = "📅 " + new Date().toLocaleDateString("es-CO", opciones);
}

// Vuelve a dibujar todas las tarjetas y actualiza el resumen.
// Respeta el texto que haya en el buscador en ese momento.
function renderizarRutas() {
  aplicarFiltro();
  actualizarResumen();
  mostrarEstudiantesFiltrados(); // función definida en la sección "Adiccion Quiz" al final
}

inputBuscador.addEventListener("input", aplicarFiltro);

// Muestra un mensaje de éxito temporal en la parte de arriba de las rutas
function mostrarNotificacion(texto) {
  mensajeNotificacion.textContent = texto;
  mensajeNotificacion.classList.remove("oculto");
  setTimeout(() => mensajeNotificacion.classList.add("oculto"), 2500);
}

// =========================================================
// VALIDACIÓN Y EVENTOS DEL FORMULARIO PRINCIPAL (crear/editar ruta)
// =========================================================

function validarFormularioRuta(nombre, conductor, hora, ciudad) {
  return nombre === "" || conductor === "" || hora === "" || ciudad === ""
    ? "Todos los campos son obligatorios"
    : "";
}

formularioRuta.addEventListener("submit", (evento) => {
  evento.preventDefault();

  const nombre = inputNombreRuta.value.trim();
  const conductor = inputConductor.value.trim();
  const hora = inputHora.value.trim();
  const ciudad = inputCiudad.value.trim();

  const error = validarFormularioRuta(nombre, conductor, hora, ciudad);
  if (error !== "") {
    mensajeErrorFormulario.textContent = error;
    return;
  }
  mensajeErrorFormulario.textContent = "";

  let mensaje;
  if (idRutaEditando === null) {
    rutas.push({ id: Date.now().toString(), nombre, conductor, hora, ciudad, estudiantes: [] });
    mensaje = "Ruta creada correctamente";
  } else {
    const ruta = rutas.find((r) => r.id === idRutaEditando);
    if (ruta) Object.assign(ruta, { nombre, conductor, hora, ciudad });
    mensaje = "Ruta actualizada correctamente";
    salirModoEdicion();
  }

  persistirCambios(mensaje);
  formularioRuta.reset();
});

// Prepara el formulario principal para editar una ruta existente
function entrarModoEdicion(idRuta) {
  const ruta = rutas.find((r) => r.id === idRuta);
  if (!ruta) return;

  idRutaEditando = idRuta;
  inputNombreRuta.value = ruta.nombre;
  inputConductor.value = ruta.conductor;
  inputHora.value = ruta.hora;
  inputCiudad.value = ruta.ciudad;

  tituloFormulario.textContent = "Editar ruta";
  botonGuardarRuta.textContent = "Guardar cambios";
  botonCancelarEdicion.classList.remove("oculto");

  document.getElementById("seccion-crear-ruta").scrollIntoView({ behavior: "smooth" });
}

// Vuelve el formulario principal a su modo normal de "crear ruta"
function salirModoEdicion() {
  idRutaEditando = null;
  tituloFormulario.textContent = "Crear nueva ruta";
  botonGuardarRuta.textContent = "Guardar ruta";
  botonCancelarEdicion.classList.add("oculto");
  formularioRuta.reset();
}

botonCancelarEdicion.addEventListener("click", salirModoEdicion);

// =========================================================
// BOTÓN "RESTABLECER DATOS DE EJEMPLO"
// =========================================================

botonRestablecer.addEventListener("click", () => {
  const confirmar = confirm(
    "Esto borrará los datos actuales y los reemplazará con los datos de ejemplo. ¿Deseas continuar?"
  );
  if (!confirmar) return;

  rutas = obtenerDatosIniciales();
  persistirCambios("Datos de ejemplo restablecidos");
});

// =========================================================
// ESCUCHA DE LOS EVENTOS PERSONALIZADOS (CustomEvent)
// Estos eventos vienen desde el Web Component <route-card>
// y suben (bubbles) hasta el contenedor de rutas.
// =========================================================

contenedorRutas.addEventListener("route-delete", (evento) => {
  rutas = rutas.filter((r) => r.id !== evento.detail.id);
  persistirCambios("Ruta eliminada");
});

contenedorRutas.addEventListener("route-edit", (evento) => entrarModoEdicion(evento.detail.id));

contenedorRutas.addEventListener("student-add", (evento) => {
  const { idRuta, estudiante } = evento.detail;
  const ruta = rutas.find((r) => r.id === idRuta);
  if (!ruta) return;

  ruta.estudiantes.push(estudiante);
  persistirCambios("Estudiante agregado");
});

contenedorRutas.addEventListener("student-delete", (evento) => {
  const { idRuta, idEstudiante } = evento.detail;
  const ruta = rutas.find((r) => r.id === idRuta);
  if (!ruta) return;

  ruta.estudiantes = ruta.estudiantes.filter((e) => e.id !== idEstudiante);
  persistirCambios("Estudiante eliminado");
});

contenedorRutas.addEventListener("student-edit", (evento) => {
  const { idRuta, estudiante } = evento.detail;
  const ruta = rutas.find((r) => r.id === idRuta);
  if (!ruta) return;

  const indice = ruta.estudiantes.findIndex((e) => e.id === estudiante.id);
  if (indice === -1) return;

  ruta.estudiantes[indice] = estudiante;
  persistirCambios("Estudiante actualizado");
});

// =========================================================
// Adiccion Quiz
// Todo lo nuevo para el filtro de estudiantes por ruta
// =========================================================

const selectFiltroRuta = document.getElementById("select-filtro-ruta");
const listaEstudiantesFiltrados = document.getElementById("lista-estudiantes-filtrados");
const mensajeSinEstudiantes = document.getElementById("mensaje-sin-estudiantes");

// Junta en una sola lista todos los estudiantes de todas las rutas,
// guardando junto a cada uno el nombre de su ruta.
function obtenerTodosLosEstudiantes() {
  const listaCompleta = [];

  rutas.forEach((ruta) => {
    ruta.estudiantes.forEach((estudiante) => {
      listaCompleta.push({ nombre: estudiante.nombre, ruta: ruta.nombre });
    });
  });

  return listaCompleta;
}

// Devuelve la clase CSS que le da color a la etiqueta según la ruta
function obtenerClaseColorRuta(nombreRuta) {
  if (nombreRuta === "Ruta Norte") return "etiqueta-ruta-norte";
  if (nombreRuta === "Ruta Sur") return "etiqueta-ruta-sur";
  if (nombreRuta === "Ruta Centro") return "etiqueta-ruta-centro";
  return "etiqueta-ruta-otra";
}

// Dibuja la lista de estudiantes según la ruta elegida en el select
function mostrarEstudiantesFiltrados() {
  const rutaSeleccionada = selectFiltroRuta.value;
  const todosLosEstudiantes = obtenerTodosLosEstudiantes();

  const estudiantesAMostrar =
    rutaSeleccionada === "todas"
      ? todosLosEstudiantes
      : todosLosEstudiantes.filter((estudiante) => estudiante.ruta === rutaSeleccionada);

  listaEstudiantesFiltrados.innerHTML = "";
  mensajeSinEstudiantes.classList.toggle("oculto", estudiantesAMostrar.length > 0);

  estudiantesAMostrar.forEach((estudiante) => {
    const claseColor = obtenerClaseColorRuta(estudiante.ruta);
    const item = document.createElement("li");
    item.className = "item-estudiante-filtrado";
    item.innerHTML = `
      <span>${estudiante.nombre}</span>
      <span class="etiqueta-ruta ${claseColor}">${estudiante.ruta}</span>
    `;
    listaEstudiantesFiltrados.appendChild(item);
  });
}

selectFiltroRuta.addEventListener("change", mostrarEstudiantesFiltrados);

// =========================================================
// INICIO DE LA APLICACIÓN
// =========================================================

mostrarFechaActual();
cargarRutas();
renderizarRutas();
