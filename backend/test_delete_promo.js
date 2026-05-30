const { poolPromise } = require('./config/db');

async function testDelete(id) {
  try {
    const pool = await poolPromise;
    console.log(`--- Testing deletion logic for Promo ID ${id} ---`);
    
    // Check if referenced
    const refCheck = await pool.request()
      .input('id', id)
      .query('SELECT COUNT(*) AS count FROM Order_Promotion WHERE id_Promo = @id');
    const refCount = refCheck.recordset[0].count;
    console.log(`Reference count in Order_Promotion: ${refCount}`);

    if (refCount > 0) {
      console.log('Attempting soft-deactivation SQL...');
      const res = await pool.request()
        .input('id', id)
        .query(`
          UPDATE Promotion 
          SET end_Date = DATEADD(day, -1, GETDATE()), usage_Limit = used_Count 
          WHERE id_Promo = @id
        `);
      console.log('Soft-deactivation SQL success:', res.rowsAffected);
    } else {
      console.log('Attempting hard delete SQL (within a rolled-back transaction to avoid modifying database)...');
      const mssql = require('mssql');
      const transaction = new mssql.Transaction(pool);
      await transaction.begin();
      try {
        const res = await transaction.request()
          .input('id', id)
          .query('DELETE FROM Promotion WHERE id_Promo = @id');
        console.log('Hard delete SQL success:', res.rowsAffected);
        await transaction.rollback();
        console.log('Transaction rolled back safely.');
      } catch (err) {
        await transaction.rollback();
        console.error('Hard delete SQL failed:', err.message);
      }
    }
  } catch (err) {
    console.error('Test failed:', err);
  }
}

async function run() {
  await testDelete(4); // BUNBO150K
  await testDelete(1); // FREESHIP50
  process.exit(0);
}
run();
