require('dotenv').config();
const { poolPromise } = require('./config/db');

async function test() {
  try {
    const pool = await poolPromise;
    const res = await pool.request().query("SELECT id_Order, order_Code, id_Restaurant, order_Status, id_Driver FROM [Order] WHERE order_Code LIKE '%688%' OR id_Order = 688");
    console.log(res.recordset);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}

test();
