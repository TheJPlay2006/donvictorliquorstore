# Ejemplo de importación masiva de productos

Este folder trae todo lo necesario para probar **Productos → Importar productos**
en el panel admin, de punta a punta.

## Archivos

- `productos-import-ejemplo.csv` — 5 productos de ejemplo (usa categorías reales
  del catálogo semilla: *Whisky y bourbon*, *Vodka*, *Licores, cremas y
  aperitivos*, *Cervezas*, *Ron*).
- `imagenes/` — 3 imágenes reales (JPEG/PNG) que corresponden a algunas de esas
  filas.
- `imagenes.zip` — las mismas imágenes ya comprimidas, listas para subir tal
  cual en el paso 3 del importador.

## Qué demuestra cada fila del CSV

| Código      | Columna `imagen`   | Qué prueba                                            |
|-------------|--------------------|--------------------------------------------------------|
| JW-BLACK-750| `JW-BLACK-750.jpg` | Imagen indicada explícitamente, se encuentra en el ZIP |
| ABS-750     | `ABS-750.png`      | Igual que arriba, con PNG                              |
| BAI-750     | (vacío)            | Sin imagen en el ZIP → advertencia, se importa igual   |
| COR-6PACK   | (vacío)            | Sin valor en `imagen`, pero existe `COR-6PACK.jpg` en el ZIP → se usa automáticamente por código |
| CEN-RES-12  | (vacío)            | Sin imagen en absoluto → se importa sin imagen         |

La fila `BAI-750` y `COR-6PACK` también prueban la normalización de
booleanos con valores no estándar (`Sí`, `1`, `no`, `si`, etc.).

## Cómo probarlo

1. Entrá a `productos.html` → **Importar productos**.
2. Paso 2: seleccioná `productos-import-ejemplo.csv`.
3. Paso 3: seleccioná `imagenes.zip` (deberías ver "3 imágenes encontradas").
4. Elegí "Solo crear productos nuevos" (son productos nuevos, no deberían
   chocar con ningún código existente).
5. **Validar archivo** → revisá la vista previa (4 válidas/advertencia, 0
   errores, 0 existentes).
6. **Importar 5 productos** → mirá el resumen final.
7. Entrá al catálogo público y confirmá que los 5 productos aparecen con sus
   imágenes correspondientes.

## Si preferís armar tu propio ZIP

Si modificás las imágenes o agregás las tuyas:

```bash
cd imagenes
zip -r ../imagenes.zip .
```

(o seleccioná todos los archivos dentro de la carpeta `imagenes/` y comprimirlos
como ZIP desde el explorador de archivos de tu sistema operativo — Windows,
macOS y la mayoría de gestores de archivos en Linux tienen esa opción con clic
derecho → "Comprimir"/"Enviar a → Carpeta comprimida").
