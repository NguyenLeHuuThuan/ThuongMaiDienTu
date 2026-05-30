const { poolPromise } = require('./config/db');

async function run() {
  try {
    const pool = await poolPromise;
    const res = await pool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE COLUMN_NAME LIKE '%Promo%' OR COLUMN_NAME LIKE '%khuyenmai%'
    `);
    console.log('Tables with Promo/KhuyenMai columns:', res.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
