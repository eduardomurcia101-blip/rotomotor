require('dotenv').config();

const mysql = require('mysql2/promise');

const requiredVariables = ['DB_HOST', 'DB_NAME', 'DB_USER'];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
  throw new Error(`Faltan variables de conexión: ${missingVariables.join(', ')}. Configúralas en .env.`);
}

const connection = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = connection;
