function mostrarModalProductoCatalogo(producto) {

    if (!producto) {
        return;
    }

    const modalContenido =
        document.querySelector(
            "#modalProducto .modal-content"
        );

    const disponibilidad =
        obtenerDisponibilidadProducto(producto);

    const precio =
        formatearPrecio(producto.precio);

    const enlaceWhatsApp =
        crearEnlaceWhatsAppConsulta(producto);

    modalContenido.innerHTML = `
        <div class="modal-header">

            <h2
                class="modal-title"
                id="tituloModalProducto"
            >
                ${producto.nombre}
            </h2>

            <button
                type="button"
                class="btn-close"
                data-bs-dismiss="modal"
                aria-label="${t('producto.cerrar')}"
            ></button>

        </div>

        <div class="modal-body">

            <div class="modal-producto-detalle">

                <div class="modal-producto-imagen">

                    <img
                        src="${producto.imagen}"
                        alt="${producto.nombre}"
                    >

                </div>

                <div class="modal-producto-informacion">

                    <p>
                        ${producto.marca || t('producto.sinMarca')} ·
                        ${producto.categoria}
                    </p>

                    <p>
                        ${
                            producto.presentacion ||
                            t('producto.presentacionConsultar')
                        }
                    </p>

                    <p class="modal-producto-descripcion">
                        ${
                            producto.descripcion ||
                            t('producto.descripcionNoDisponible')
                        }
                    </p>

                    <div class="modal-producto-precio-estado">

                        <span class="modal-producto-precio">
                            ${precio}
                        </span>

                        <span class="estado-producto ${disponibilidad.clase}">
                            ${disponibilidad.texto}
                        </span>

                    </div>

                    <div class="modal-producto-acciones">

                        <a
                            href="${enlaceWhatsApp}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="modal-producto-whatsapp"
                        >
                            <i class="fa-brands fa-whatsapp"></i>
                            ${t('producto.consultarWhatsApp')}
                        </a>

                        <button
                            type="button"
                            class="modal-producto-cerrar"
                            data-bs-dismiss="modal"
                        >
                            ${t('producto.cerrar')}
                        </button>

                    </div>

                </div>

            </div>

        </div>
    `;

    const modalProducto =
        bootstrap.Modal.getOrCreateInstance(
            document.getElementById(
                "modalProducto"
            )
        );

    modalProducto.show();

}