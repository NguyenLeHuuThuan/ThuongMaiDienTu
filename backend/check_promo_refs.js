const { poolPromise } = require('./config/db');

async function run() {
  try {
    const pool = await poolPromise;
    console.log('--- 1. Querying Promotion table list ---');
    const promos = await pool.request().query('SELECT * FROM Promotion');
    console.log('Promotions in DB:', promos.recordset);

    console.log('\n--- 2. Checking foreign key references to Promotion ---');
    const fkRefs = await pool.request().query(`
      SELECT 
          fk.name AS FK_name,
          tp.name AS Parent_table,
          cp.name AS Parent_column,
          tr.name AS Referenced_table,
          cr.name AS Referenced_column
      FROM 
          sys.foreign_keys fk
      INNER JOIN 
          sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      INNER JOIN 
          sys.tables tp ON fkc.parent_object_id = tp.object_id
      INNER JOIN 
          sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
      INNER JOIN 
          sys.tables tr ON fkc.referenced_object_id = tr.object_id
      INNER JOIN 
          sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
      WHERE 
          tr.name = 'Promotion'
    `);
    console.log('FKs referencing Promotion:', fkRefs.recordset);

    console.log('\n--- 3. Checking reference counts for each Promotion ---');
    for (const p of promos.recordset) {
      console.log(`Checking Promo ID: ${p.id_Promo} (${p.code})`);
      for (const fk of fkRefs.recordset) {
        const refCount = await pool.request()
          .input('id', p.id_Promo)
          .query(`SELECT COUNT(*) AS count FROM [${fk.Parent_table}] WHERE [${fk.Parent_column}] = @id`);
        console.log(`  - Table [${fk.Parent_table}].[${fk.Parent_column}]: ${refCount.recordset[0].count} rows`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
