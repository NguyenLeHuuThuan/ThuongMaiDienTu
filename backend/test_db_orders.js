const sql = require('mssql');

const config = {
  user: 'sa',
  password: 'congkiet28102005',
  server: 'localhost\\SQLEXPRESS',
  database: 'ThuongMaiDienTu',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    useUTC: false
  }
};

async function test() {
  try {
    let pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT o.id_Order, o.order_Code, o.order_Status, 
             (SELECT COUNT(*) FROM Order_Food ofood WHERE ofood.id_Order = o.id_Order) as item_count
      FROM [Order] o
      ORDER BY o.id_Order DESC
    `);
    console.log(result.recordset);
    sql.close();
  } catch (err) {
    console.error(err);
  }
}

test();
