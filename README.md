# Catálogo Día del Niño — editable

Este proyecto conserva el diseño y la lógica del archivo JSX proporcionado, preparado para ejecutarse como una aplicación React + Vite.

## Ejecutar

1. Instalar Node.js.
2. Abrir una terminal dentro de esta carpeta.
3. Ejecutar:
   npm install
   npm run dev

4. Abrir la dirección que indique Vite (normalmente http://localhost:5173).

## Editar productos e imágenes

El catálogo ya permite:
- Agregar y editar juguetes.
- Subir varias imágenes por producto.
- Elegir una imagen principal.
- Eliminar imágenes.
- Cambiar precio, categoría, descripción y disponibilidad.
- Marcar productos como nuevos o destacados.
- Configurar nombre del negocio, WhatsApp y PIN.

Los datos se guardan en localStorage del navegador para que el proyecto funcione sin depender de una plataforma externa.

## Dónde editar

- `src/App.jsx`: diseño, textos, categorías, productos iniciales y toda la lógica.
- `index.html`: título y estructura base.
- `vite.config.js`: configuración de Vite.

Para agregar imágenes fijas al diseño, se pueden colocar en `public/` y referenciarlas desde el JSX, por ejemplo `/mi-imagen.png`.


## Diseño responsive

La interfaz está preparada para adaptarse automáticamente a:
- Celulares pequeños y grandes: catálogo en 2 columnas.
- Tablets: catálogo en 3 columnas.
- Notebooks y computadoras: catálogo en 4 columnas.
- Pantallas grandes: hasta 5 columnas.
- Paneles y ventanas adaptados a pantallas grandes y pequeñas.
- Botón de WhatsApp flotante en escritorio y adaptable en móvil.
