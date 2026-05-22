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
      SELECT o.id_Order,
             (SELECT ofood.quantity, f.name, ofood.unit_Price as price FROM Order_Food ofood JOIN Food f ON ofood.id_Food = f.id_Food WHERE ofood.id_Order = o.id_Order FOR JSON PATH) as items_json
      FROM [Order] o
      WHERE o.id_Order = 1
    `);
    console.log("Raw output:");
    console.dir(result.recordset, { depth: null });
    
    const orders = result.recordset.map(row => {
      try { row.items = JSON.parse(row.items_json); } catch(e) { row.items = []; console.error('Parse error:', e); }
      return row;
    });
    console.log("Parsed output:");
    console.dir(orders, { depth: null });

    sql.close();
  } catch (err) {
    console.error(err);
  }
}

test();
