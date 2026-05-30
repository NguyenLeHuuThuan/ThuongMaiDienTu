const { poolPromise } = require('./config/db');

async function checkCols() {
  try {
    const pool = await poolPromise;
    const res = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'User'
    `);
    console.log('User Columns:', res.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkCols();
