const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '123',
  server: process.env.DB_SERVER || 'DESKTOP-M4V955C\\MSSQLSERVER04',
  database: process.env.DB_DATABASE || 'QuanLyMonAnTaiNha',
  options: {
    encrypt: false, // set to true if you're on Windows Azure
    trustServerCertificate: true,
    enableArithAbort: true,
    useUTC: false // Đọc thời gian đúng theo Local Time của Database
  }
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('Connected to SQL Server');
    return pool;
  })
  .catch(err => {
    console.error('Database Connection Failed! Bad Config: ', err);
    process.exit(1);
  });

module.exports = {
  sql,
  poolPromise
};
