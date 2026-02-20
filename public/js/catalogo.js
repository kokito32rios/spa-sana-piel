// Variables globales
let fotosArray = [];
let indiceActual = 0;

// =============================================
// OBTENER PARÁMETRO DE URL
// =============================================
function obtenerServicioURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('servicio');
}

// =============================================
// CARGAR FOTOS
// =============================================
async function cargarFotos() {
    const loader = document.getElementById('loader');
    const grid = document.getElementById('grid-fotos');
    const sinFotos = document.getElementById('sin-fotos');
    
    try {
        // Construir URL con filtro si viene del index
        const servicioId = obtenerServicioURL();
        let url = '/api/catalogo';
        if (servicioId) {
            url += `?servicio=${servicioId}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        loader.classList.add('hidden');
        
        if (data.success && data.catalogo && data.catalogo.length > 0) {
            // Aplanar todas las imágenes en un solo array
            fotosArray = [];
            data.catalogo.forEach(servicio => {
                servicio.imagenes.forEach(img => {
                    fotosArray.push({
                        url: img.url_imagen,
                        servicio: servicio.nombre_servicio,
                        descripcion: img.descripcion
                    });
                });
            });
            
            renderizarGrid();
            grid.classList.remove('hidden');
        } else {
            sinFotos.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error('Error al cargar fotos:', error);
        loader.classList.add('hidden');
        sinFotos.classList.remove('hidden');
    }
}

// =============================================
// RENDERIZAR GRID
// =============================================
function renderizarGrid() {
    const grid = document.getElementById('grid-fotos');
    
    grid.innerHTML = fotosArray.map((foto, index) => `
        <div class="foto-item" onclick="abrirLightbox(${index})">
            <img src="${foto.url}" 
                 alt="${foto.servicio}"
                 loading="lazy"
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'500\\' height=\\'500\\'%3E%3Crect fill=\\'%23e7b2a4\\' width=\\'500\\' height=\\'500\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'120\\' fill=\\'white\\'%3E💅%3C/text%3E%3C/svg%3E'">
        </div>
    `).join('');
}

// =============================================
// ABRIR LIGHTBOX
// =============================================
function abrirLightbox(index) {
    indiceActual = index;
    mostrarFoto(index);
    document.getElementById('lightbox').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// =============================================
// CERRAR LIGHTBOX
// =============================================
function cerrarLightbox() {
    document.getElementById('lightbox').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// =============================================
// MOSTRAR FOTO EN LIGHTBOX
// =============================================
function mostrarFoto(index) {
    const foto = fotosArray[index];
    document.getElementById('lightbox-imagen').src = foto.url;
    
    // Controlar botones de navegación
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    
    btnPrev.disabled = index === 0;
    btnNext.disabled = index === fotosArray.length - 1;
}

// =============================================
// NAVEGAR ENTRE FOTOS
// =============================================
function navegarFoto(direccion) {
    indiceActual += direccion;
    
    if (indiceActual >= 0 && indiceActual < fotosArray.length) {
        mostrarFoto(indiceActual);
    }
}

// =============================================
// TECLADO
// =============================================
document.addEventListener('keydown', (e) => {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox.classList.contains('hidden')) {
        switch(e.key) {
            case 'Escape':
                cerrarLightbox();
                break;
            case 'ArrowLeft':
                if (indiceActual > 0) navegarFoto(-1);
                break;
            case 'ArrowRight':
                if (indiceActual < fotosArray.length - 1) navegarFoto(1);
                break;
        }
    }
});

// =============================================
// CERRAR LIGHTBOX AL HACER CLICK FUERA
// =============================================
document.addEventListener('click', (e) => {
    const lightbox = document.getElementById('lightbox');
    if (e.target === lightbox) {
        cerrarLightbox();
    }
});

// =============================================
// INICIALIZAR
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    cargarFotos();
});