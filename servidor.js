const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual
} = require('node:crypto');
const { promisify } = require('node:util');
const database = require('./conexion');

const rootDirectory = __dirname;
const productAssetsDirectory = path.resolve(rootDirectory, 'assets', 'productos');
const allowedRootFiles = new Set(['index.html', 'productos.html', 'index.css', 'tienda.js', 'admin.html', 'admin.js']);
const sessionCookieName = 'rutamotor_admin';
const sessionDurationMs = 8 * 60 * 60 * 1000;
const loginWindowMs = 15 * 60 * 1000;
const maxLoginAttempts = 5;
const maxStock = 2_147_483_647;
const adminSessions = new Map();
const loginAttempts = new Map();
const secureCookie = process.env.NODE_ENV === 'production' ? '; Secure' : '';
const scryptAsync = promisify(scrypt);
const adminPasswordColumn = `\`contrase\u00f1a_admin\``;
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(data));
}

function hashValue(value) {
  return createHash('sha256').update(value).digest();
}

function safeEqual(left, right) {
  return timingSafeEqual(hashValue(left), hashValue(right));
}

function getCookies(request) {
  const cookies = new Map();
  for (const part of (request.headers.cookie || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator > 0) {
      cookies.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
    }
  }
  return cookies;
}

function getSession(request) {
  const sessionId = getCookies(request).get(sessionCookieName);
  if (!sessionId) return null;

  const session = adminSessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(sessionId);
    return null;
  }
  return { sessionId, session };
}

function requestHasSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin || !request.headers.host) return false;

  try {
    const parsedOrigin = new URL(origin);
    const expectedProtocol = request.socket.encrypted ? 'https:' : 'http:';
    return parsedOrigin.host === request.headers.host && parsedOrigin.protocol === expectedProtocol;
  } catch {
    return false;
  }
}

function getLoginAttemptState(request) {
  const now = Date.now();
  const address = request.socket.remoteAddress || 'unknown';
  let state = loginAttempts.get(address);

  if (!state || state.resetAt <= now) {
    state = { count: 0, resetAt: now + loginWindowMs };
    loginAttempts.set(address, state);
  }

  return { address, state };
}

function setSessionCookie(response, sessionId) {
  response.setHeader(
    'Set-Cookie',
    `${sessionCookieName}=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionDurationMs / 1000}${secureCookie}`
  );
}

function clearSessionCookie(response) {
  response.setHeader(
    'Set-Cookie',
    `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureCookie}`
  );
}

function unauthorized(response) {
  sendJson(response, 401, { error: 'Inicia sesión para continuar.' });
}

async function getAdminAccounts(username) {
  const [accounts] = await database.execute(
    `SELECT id_admin, nombre_admin, ${adminPasswordColumn} AS stored_password
     FROM admin
     WHERE nombre_admin = ?
     LIMIT 2`,
    [username]
  );
  return accounts;
}

async function verifyAdminPassword(password, storedPassword, accountId) {
  const scryptMatch = storedPassword.match(/^scrypt\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/);
  if (scryptMatch) {
    const salt = Buffer.from(scryptMatch[1], 'base64url');
    const expectedHash = Buffer.from(scryptMatch[2], 'base64url');
    if (salt.length !== 16 || expectedHash.length !== 64) return false;

    const actualHash = await scryptAsync(password, salt, expectedHash.length, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024
    });
    return timingSafeEqual(actualHash, expectedHash);
  }

  if (storedPassword.startsWith('$') || /^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})$/i.test(storedPassword)) {
    console.error('La cuenta administrativa usa un formato de contraseña no compatible; no se puede validar con seguridad.');
    return false;
  }

  if (!safeEqual(password, storedPassword)) return false;

  const salt = randomBytes(16);
  const passwordHash = await scryptAsync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });
  const encodedHash = `scrypt$${salt.toString('base64url')}$${passwordHash.toString('base64url')}`;
  const [result] = await database.execute(
    `UPDATE admin
     SET ${adminPasswordColumn} = ?
     WHERE id_admin = ? AND BINARY ${adminPasswordColumn} = BINARY ?`,
    [encodedHash, accountId, storedPassword]
  );

  if (result.affectedRows === 1) return true;

  const [accounts] = await database.execute(
    `SELECT ${adminPasswordColumn} AS stored_password
     FROM admin
     WHERE id_admin = ?`,
    [accountId]
  );
  if (accounts.length !== 1) return false;
  const migratedMatch = accounts[0].stored_password.match(/^scrypt\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/);
  if (!migratedMatch) return false;

  const migratedSalt = Buffer.from(migratedMatch[1], 'base64url');
  const migratedHash = Buffer.from(migratedMatch[2], 'base64url');
  if (migratedSalt.length !== 16 || migratedHash.length !== 64) return false;
  const actualHash = await scryptAsync(password, migratedSalt, migratedHash.length, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });
  return timingSafeEqual(actualHash, migratedHash);
}

async function readJsonBody(request) {
  const chunks = [];
  let length = 0;

  for await (const chunk of request) {
    length += chunk.length;
    if (length > 16 * 1024) {
      const error = new Error('La solicitud es demasiado grande.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('El cuerpo de la solicitud debe ser JSON válido.');
    error.statusCode = 400;
    throw error;
  }
}

async function createPurchase(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    const error = new Error('El carrito debe contener entre 1 y 50 productos.');
    error.statusCode = 400;
    throw error;
  }

  const seenIds = new Set();
  for (const item of items) {
    if (
      !item ||
      !Number.isSafeInteger(item.id) ||
      item.id <= 0 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0 ||
      seenIds.has(item.id)
    ) {
      const error = new Error('Los productos o cantidades del carrito no son válidos.');
      error.statusCode = 400;
      throw error;
    }
    seenIds.add(item.id);
  }

  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();

    const ids = items.map((item) => item.id).sort((left, right) => left - right);
    const placeholders = ids.map(() => '?').join(', ');
    const [products] = await connection.query(
      `SELECT id, nombre, precio_cop, stock FROM productos WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
      ids
    );
    const productById = new Map(products.map((product) => [Number(product.id), product]));

    if (productById.size !== items.length) {
      const error = new Error('Uno o más productos ya no están disponibles.');
      error.statusCode = 404;
      throw error;
    }

    const receiptItems = items.map((item) => {
      const product = productById.get(item.id);
      if (Number(product.stock) < item.quantity) {
        const error = new Error(`No hay suficientes unidades de "${product.nombre}".`);
        error.statusCode = 409;
        throw error;
      }
      return {
        id: Number(product.id),
        nombre: product.nombre,
        precio_cop: Number(product.precio_cop),
        cantidad: item.quantity,
        subtotal_cop: Number(product.precio_cop) * item.quantity
      };
    });

    for (const item of items) {
      const [result] = await connection.execute(
        'UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [item.quantity, item.id, item.quantity]
      );
      if (result.affectedRows !== 1) {
        const error = new Error('El inventario cambió durante la compra. Actualiza el carrito e inténtalo de nuevo.');
        error.statusCode = 409;
        throw error;
      }
    }

    const [updatedProducts] = await connection.query(
      `SELECT id, stock FROM productos WHERE id IN (${placeholders}) ORDER BY id`,
      ids
    );
    await connection.commit();
    return {
      numero: randomUUID(),
      fecha: new Date().toISOString(),
      productos: receiptItems,
      inventario: updatedProducts.map((product) => ({
        id: Number(product.id),
        stock: Number(product.stock)
      })),
      total_cop: receiptItems.reduce((total, item) => total + item.subtotal_cop, 0)
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const server = http.createServer(async (request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch (error) {
    sendJson(response, 400, { error: 'Ruta no válida' });
    return;
  }

  if (pathname === '/api/compras') {
    if (request.method !== 'POST') {
      response.writeHead(405, { Allow: 'POST' });
      response.end('Método no permitido');
      return;
    }

    try {
      const body = await readJsonBody(request);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        const error = new Error('El cuerpo de la solicitud debe ser un objeto JSON.');
        error.statusCode = 400;
        throw error;
      }
      const receipt = await createPurchase(body.items);
      sendJson(response, 201, receipt);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      if (statusCode === 500) {
        console.error('Error procesando la compra:', error.message);
      }
      sendJson(response, statusCode, {
        error: statusCode === 500 ? 'No se pudo completar la compra. Inténtalo de nuevo.' : error.message
      });
    }
    return;
  }

  if (pathname === '/api/admin/session') {
    if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET' });
      response.end('Método no permitido');
      return;
    }
    try {
      const [[result]] = await database.query('SELECT COUNT(*) AS account_count FROM admin');
      sendJson(response, 200, {
        configured: Number(result.account_count) > 0,
        authenticated: Boolean(getSession(request))
      });
    } catch (error) {
      console.error('Error verificando las cuentas administrativas:', error.message);
      sendJson(response, 500, { error: 'No se pudo verificar la configuración administrativa.' });
    }
    return;
  }

  if (pathname === '/api/admin/login') {
    if (request.method !== 'POST') {
      response.writeHead(405, { Allow: 'POST' });
      response.end('Método no permitido');
      return;
    }
    if (!requestHasSameOrigin(request)) {
      sendJson(response, 403, { error: 'Solicitud de origen no permitido.' });
      return;
    }
    const { address, state } = getLoginAttemptState(request);
    if (state.count >= maxLoginAttempts) {
      sendJson(response, 429, { error: 'Demasiados intentos. Espera 15 minutos antes de volver a intentar.' });
      return;
    }

    try {
      const body = await readJsonBody(request);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        sendJson(response, 400, { error: 'Los datos de acceso no son válidos.' });
        return;
      }

      const username = typeof body.username === 'string' ? body.username : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (!username || !password) {
        sendJson(response, 401, { error: 'Usuario o contraseña incorrectos.' });
        return;
      }

      const accounts = await getAdminAccounts(username);
      const isValid = accounts.length === 1 &&
        await verifyAdminPassword(password, String(accounts[0].stored_password), Number(accounts[0].id_admin));
      if (!isValid) {
        state.count += 1;
        loginAttempts.set(address, state);
        sendJson(response, 401, { error: 'Usuario o contraseña incorrectos.' });
        return;
      }

      loginAttempts.delete(address);
      const sessionId = randomBytes(32).toString('base64url');
      adminSessions.set(sessionId, { expiresAt: Date.now() + sessionDurationMs });
      setSessionCookie(response, sessionId);
      sendJson(response, 200, { authenticated: true });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      if (statusCode === 500) console.error('Error iniciando sesión administrativa:', error.message);
      sendJson(response, statusCode, {
        error: statusCode === 500 ? 'No se pudo iniciar sesión.' : error.message
      });
    }
    return;
  }

  if (pathname === '/api/admin/logout') {
    if (request.method !== 'POST') {
      response.writeHead(405, { Allow: 'POST' });
      response.end('Método no permitido');
      return;
    }
    if (!requestHasSameOrigin(request)) {
      sendJson(response, 403, { error: 'Solicitud de origen no permitido.' });
      return;
    }
    const currentSession = getSession(request);
    if (currentSession) adminSessions.delete(currentSession.sessionId);
    clearSessionCookie(response);
    sendJson(response, 200, { authenticated: false });
    return;
  }

  if (pathname === '/api/admin/productos') {
    if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET' });
      response.end('Método no permitido');
      return;
    }
    if (!getSession(request)) {
      unauthorized(response);
      return;
    }

    try {
      const [products] = await database.query(`
        SELECT id, nombre, categoria, stock
        FROM productos
        ORDER BY categoria, nombre
      `);
      sendJson(response, 200, products);
    } catch (error) {
      console.error('Error consultando inventario administrativo:', error.message);
      sendJson(response, 500, { error: 'No se pudo cargar el inventario.' });
    }
    return;
  }

  const stockUpdateMatch = pathname.match(/^\/api\/admin\/productos\/(\d+)\/stock$/);
  if (stockUpdateMatch) {
    if (request.method !== 'PATCH') {
      response.writeHead(405, { Allow: 'PATCH' });
      response.end('Método no permitido');
      return;
    }
    if (!getSession(request)) {
      unauthorized(response);
      return;
    }
    if (!requestHasSameOrigin(request)) {
      sendJson(response, 403, { error: 'Solicitud de origen no permitido.' });
      return;
    }

    try {
      const productId = Number(stockUpdateMatch[1]);
      if (!Number.isSafeInteger(productId) || productId <= 0) {
        sendJson(response, 400, { error: 'El identificador del producto no es válido.' });
        return;
      }
      const body = await readJsonBody(request);
      if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        !Number.isSafeInteger(body.stock) ||
        body.stock < 0 ||
        body.stock > maxStock
      ) {
        sendJson(response, 400, { error: 'El stock debe ser un número entero entre 0 y 2.147.483.647.' });
        return;
      }

      const [result] = await database.execute(
        'UPDATE productos SET stock = ? WHERE id = ?',
        [body.stock, productId]
      );
      if (result.affectedRows === 0) {
        const [products] = await database.execute('SELECT id FROM productos WHERE id = ?', [productId]);
        if (products.length === 0) {
          sendJson(response, 404, { error: 'No se encontró el producto.' });
          return;
        }
      }

      const [products] = await database.execute(
        'SELECT id, nombre, categoria, stock FROM productos WHERE id = ?',
        [productId]
      );
      sendJson(response, 200, products[0]);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      if (statusCode === 500) console.error('Error actualizando el inventario:', error.message);
      sendJson(response, statusCode, {
        error: statusCode === 500 ? 'No se pudo actualizar el stock.' : error.message
      });
    }
    return;
  }

  if (request.method !== 'GET') {
    response.writeHead(405, { Allow: 'GET' });
    response.end('Método no permitido');
    return;
  }

  if (pathname === '/api/productos') {
    try {
      const [products] = await database.query(`
        SELECT id, nombre, descripcion, categoria, precio_cop, stock
        FROM productos
        ORDER BY id
      `);
      sendJson(response, 200, products);
    } catch (error) {
      console.error('Error consultando productos:', error.message);
      sendJson(response, 500, { error: 'No se pudieron consultar los productos en la base de datos.' });
    }
    return;
  }

  if (pathname === '/api/health') {
    try {
      const [rows] = await database.query(`
        SELECT DATABASE() AS database_name,
               VERSION() AS server_version,
               (SELECT COUNT(*) FROM productos) AS product_count
      `);
      sendJson(response, 200, { ok: true, ...rows[0] });
    } catch (error) {
      console.error('Error verificando la conexión:', error.message);
      sendJson(response, 500, { ok: false, error: 'No se pudo verificar la conexión con la base de datos.' });
    }
    return;
  }

  if (pathname === '/admin') {
    response.writeHead(302, { Location: '/admin.html' });
    response.end();
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const isAllowedRootFile = !relativePath.includes(path.sep) && allowedRootFiles.has(relativePath);
  const isProductAsset = pathname.startsWith('/assets/productos/');
  if (!isAllowedRootFile && !isProductAsset) {
    response.writeHead(404);
    response.end('No encontrado');
    return;
  }

  const filePath = path.resolve(rootDirectory, relativePath);
  if (isProductAsset && !filePath.startsWith(`${productAssetsDirectory}${path.sep}`)) {
    response.writeHead(404);
    response.end('No encontrado');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT' || error.code === 'EISDIR') {
        response.writeHead(404);
        response.end('No encontrado');
        return;
      }

      console.error(`Error al leer ${filePath}:`, error.message);
      response.writeHead(500);
      response.end('Error interno del servidor');
      return;
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
    });
    response.end(content);
  });
});

async function startServer() {
  await database.query('SELECT 1');
  const port = Number(process.env.PORT || 3000);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Conexión a MySQL correcta; Ruta Motor disponible en el puerto ${port}`);
  });
}

if (require.main === module) {
  startServer().catch(async (error) => {
    console.error('No se pudo iniciar el servidor o conectar a MySQL:', error.message);
    await database.end();
    process.exitCode = 1;
  });
}

module.exports = server;
