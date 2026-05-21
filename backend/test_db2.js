const sql = require('mssql');

const config = {
  user: 'sa',
  password: 'congkiet28102005',
  server: 'DESKTOP-A45O3KR\\CONGKIET',
  database: 'QuanLyMonAnTaiNha',
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
        SELECT top 5 o.id_Order, o.accepted_At, 
               ISNULL((SELECT SUM(ISNULL(f.prep_Time, 15) * ofood.quantity) FROM Order_Food ofood JOIN Food f ON ofood.id_Food = f.id_Food WHERE ofood.id_Order = o.id_Order), 0) as total_prep_time,
               DATEADD(minute, ISNULL((SELECT SUM(ISNULL(f.prep_Time, 15) * ofood.quantity) FROM Order_Food ofood JOIN Food f ON ofood.id_Food = f.id_Food WHERE ofood.id_Order = o.id_Order), 0), o.accepted_At) as expected_Completion_Time
        FROM [Order] o
        WHERE o.accepted_At IS NOT NULL
        ORDER BY o.accepted_At DESC
    `);
    console.log(result.recordset);
    sql.close();
  } catch (err) {
    console.error(err);
  }
}

test();
