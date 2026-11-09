# Ruta Motor: guía sencilla del proyecto

Ruta Motor es una tienda de demostración de repuestos y accesorios para vehículos. Permite consultar productos y precios, preparar un carrito, confirmar una compra de prueba y administrar las existencias.

Esta guía explica qué contiene el proyecto, cómo ponerlo en marcha y qué hace cada parte. No necesitas saber programar para seguir los pasos.

## Antes de comenzar

El proyecto utiliza dos programas distintos:

- **MySQL o MariaDB** guarda los productos, precios, existencias y cuentas de administración. Puedes iniciarlo desde el panel de XAMPP y consultar los datos con phpMyAdmin.
- **Node.js** pone en marcha la tienda y conecta las páginas con la base de datos. No necesitas dejar abierto Visual Studio Code para ejecutarlo.

En pocas palabras: el navegador muestra la tienda, Node.js atiende las solicitudes y MySQL conserva los datos.

## Cómo abrir la tienda en tu computador

### Primera vez

1. Instala Node.js versión 20.6 o posterior.
2. Abre XAMPP e inicia **MySQL**. No hace falta iniciar Apache para esta aplicación.
3. Abre PowerShell y entra a la carpeta del proyecto:

   ```powershell
   cd "C:\Users\damia\Downloads\proyecto-Paula"
   ```

4. Instala las piezas de Node.js que el proyecto necesita:

   ```powershell
   npm install
   ```

5. Revisa el archivo `.env` que ya está en la carpeta. Ahí están el servidor y el nombre de la base MySQL, el usuario y el puerto. Si en otra computadora no existe, crea un archivo llamado `.env` con estos datos y ajústalos según XAMPP:

   ```text
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=rutamotor
   DB_USER=root
   DB_PASSWORD=
   PORT=3000
   ```

   Si configuraste una contraseña para MySQL, escríbela después de `DB_PASSWORD=`. Si no tiene, deja el valor vacío. No compartas el archivo `.env`: puede contener contraseñas y está excluido de Git.

6. Confirma en phpMyAdmin que la base se llame `rutamotor` y tenga las tablas `productos` y `admin`. Este proyecto espera estas columnas:

   - En `productos`: `id`, `nombre`, `descripcion`, `categoria`, `precio_cop` y `stock`. La columna `created_at` puede existir, pero no es necesaria para mostrar el catálogo.
   - En `admin`: `id_admin`, `nombre_admin` y `contraseña_admin`.

   El proyecto se conecta a tus tablas existentes; no crea la base ni las tablas automáticamente.

### Cada vez que quieras usar la tienda

1. Inicia MySQL desde XAMPP.
2. Abre PowerShell, entra a la carpeta y ejecuta:

   ```powershell
   cd "C:\Users\damia\Downloads\proyecto-Paula"
   npm start
   ```

3. Deja abierta esa ventana. Cuando aparezca un mensaje indicando que Ruta Motor está disponible, abre esta dirección en tu navegador:

   **http://localhost:3000**

4. Para cerrar la aplicación, vuelve a PowerShell y presiona `Ctrl+C`.

La dirección `http://127.0.0.1:3000/api/health` permite comprobar que el servidor encuentra MySQL y cuántos productos hay. La dirección `http://localhost:3000/admin` abre el acceso al panel.

## Archivos y carpetas

| Archivo o carpeta | Qué contiene y para qué sirve |
| --- | --- |
| `index.html` | La portada: presenta la tienda, las categorías y algunos productos destacados. |
| `productos.html` | El catálogo completo, con búsqueda y botones para filtrar por categoría. |
| `index.css` | Los colores, tamaños y distribución de la tienda, el carrito y el panel. Se comparte entre las páginas. |
| `tienda.js` | Carga los productos de la base, actualiza el carrito y muestra el recibo al comprar. |
| `servidor.js` | Enciende la aplicación, atiende las páginas y comunica la tienda con MySQL. También valida compras y protege las acciones del administrador. |
| `conexion.js` | Lee la configuración local y abre la conexión con MySQL/MariaDB. |
| `admin.html` | La página para iniciar sesión y gestionar el inventario. |
| `admin.js` | Carga los productos del panel y guarda los cambios de existencias. |
| `package.json` | Indica a Node.js qué necesita el proyecto y cómo se inicia con `npm start`. |
| `package-lock.json` | Mantiene anotadas las versiones exactas de las dependencias instaladas. No hace falta editarlo a mano. |
| `.env` | Configuración privada de la conexión a MySQL en este computador. No se debe compartir ni subir a Git. |
| `.gitignore` | Indica a Git que no incluya `.env` ni las dependencias instaladas. |
| `assets/productos/` | Las fotografías de los productos y una imagen de respaldo para los que no tienen foto. |
| `node_modules/` | Programas auxiliares que se descargan con `npm install`. No se modifica manualmente ni se comparte. |

## Productos, categorías, precios y fotos

La información principal de cada producto se consulta directamente en la tabla `productos` de MySQL:

- `nombre`: el nombre que se muestra en la tienda.
- `descripcion`: una breve explicación.
- `categoria`: el grupo al que pertenece.
- `precio_cop`: el precio en pesos colombianos, guardado como un número entero. Por ejemplo, `249900` se muestra como `$249.900`.
- `stock`: las unidades disponibles.

Usa uno de estos valores en `categoria` para que funcionen los filtros:

| Nombre en la tienda | Valor que se guarda en la base |
| --- | --- |
| Baterías | `baterias` |
| Motor y filtros | `motor-filtros` |
| Llantas y ruedas | `llantas-ruedas` |
| Iluminación | `iluminacion` |

### Agregar o cambiar productos

Puedes editar la tabla `productos` desde phpMyAdmin. Agrega o cambia el nombre, la descripción, la categoría, el precio y el stock. No necesitas duplicar tarjetas en los archivos HTML: la tienda construye el catálogo con lo que lee de la base.

Las imágenes se guardan como archivos en `assets/productos/`, no dentro de MySQL. El sitio conserva las fotos asociadas con los productos que ya conocía. Si agregas un producto nuevo y todavía no se le ha asignado una foto, mostrará la imagen de respaldo. Cambiar el nombre de un producto puede hacer que deje de coincidir con la foto que ya tenía.

## Cómo funciona el carrito y la compra

1. Al abrir la portada o el catálogo, la tienda pide a MySQL la lista actual de productos.
2. Al presionar **Agregar**, el producto se guarda en el carrito de ese navegador. Puedes cambiar la cantidad o quitar productos antes de confirmar.
3. Al presionar **Confirmar compra**, el servidor consulta los precios y las existencias vigentes en la base. No confía únicamente en lo que muestra el navegador.
4. Si hay stock suficiente, descuenta las unidades en MySQL y muestra solamente el recibo.
5. Si ya no hay stock suficiente, cancela la compra sin descontar parcialmente los productos y muestra un aviso.

La portada, el catálogo y el panel vuelven a consultar las existencias cada cierto tiempo y al regresar a la pestaña. También se avisan entre sí cuando el cambio viene de otra página abierta. Por eso deberían reflejar una compra o ajuste de stock sin tener que cerrar toda la tienda; si el cambio no aparece enseguida, espera unos segundos o recarga la página.

**Importante:** es una compra de demostración. El recibo no se guarda en una tabla de pedidos y no se cobra dinero ni se procesa ningún pago.

## Panel de administración: cambiar existencias

Al final de la portada y del catálogo hay un enlace discreto llamado **Administración**. También puedes abrir directamente:

**http://localhost:3000/admin**

Inicia sesión con la cuenta guardada en la tabla `admin`. Después podrás buscar productos y cambiar únicamente su cantidad disponible:

1. Escribe la nueva cantidad en la fila del producto.
2. Presiona **Guardar**.
3. El panel confirma el cambio y muestra el stock actualizado desde la base de datos.

El panel no permite cambiar desde ahí el precio, el nombre ni la descripción. Para actualizar esos datos, usa phpMyAdmin.

Las contraseñas se validan en el servidor, no en la página del navegador. Si una contraseña antigua está guardada como texto normal, el primer inicio de sesión correcto la convierte a un formato protegido. Conviene usar una contraseña larga y difícil de adivinar.

## Qué se puede y qué no se puede hacer

**El proyecto sí permite:**

- Mostrar los productos que ya están guardados en MySQL.
- Buscar productos y filtrar el catálogo por categoría.
- Preparar un carrito y emitir un recibo de demostración.
- Descontar del stock las unidades compradas.
- Iniciar sesión en un panel que permite ajustar el stock.
- Compartir los cambios recientes de existencias entre páginas abiertas.

**Todavía no permite:**

- Cobrar una compra con tarjeta u otro medio de pago.
- Guardar un historial de compras para consultarlo después.
- Administrar desde el panel los precios, las descripciones o los productos.
- Usar el carrito entre computadores o navegadores distintos.

De forma predeterminada, el servidor escucha en el propio computador (`127.0.0.1`). Eso sirve para probar la tienda localmente. **No la publiques abiertamente en Internet todavía:** la compra de demostración puede descontar el stock sin confirmar un pago. Si vas a compartirla con otras personas, primero hay que proteger ese proceso y configurar correctamente el servidor y la base de datos.

## Si algo no funciona

- **El navegador no abre la tienda:** comprueba que la ventana de PowerShell siga ejecutando `npm start` y que hayas abierto `http://localhost:3000`.
- **El servidor dice que no puede conectarse a MySQL:** confirma que MySQL esté iniciado en XAMPP y revisa `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` en `.env`.
- **Aparece una lista vacía o falta un producto:** revisa en phpMyAdmin la tabla `productos` y verifica que sus columnas tengan los nombres indicados en esta guía.
- **No puedes entrar al panel:** verifica que el usuario y la contraseña estén en la tabla `admin` y que el nombre de las columnas sea `nombre_admin` y `contraseña_admin`.
- **No aparece una fotografía:** revisa que el archivo esté en `assets/productos/` y que corresponda al producto; de lo contrario, se mostrará la imagen de respaldo.
- **El stock aún parece igual:** espera unos segundos o recarga la página. El panel muestra el stock actual de la base junto al campo que puedes editar.
