
const { poolPromise } = require('./config/db');
async function run() {
  try {
    const pool = await poolPromise;
    console.log('Attempting to create SystemConfig table directly...');
    try {
      const res = await pool.request().query(`
        CREATE TABLE SystemConfig (
          config_key VARCHAR(100) PRIMARY KEY,
          config_value NVARCHAR(MAX) NOT NULL,
          category VARCHAR(50) NOT NULL,
          description NVARCHAR(255),
          is_enabled BIT NOT NULL DEFAULT 1,
          updated_at DATETIME NOT NULL DEFAULT GETDATE()
        );
      `);
      console.log('Success creating SystemConfig:', res);
    } catch (e) {
      console.error('Error creating SystemConfig:', e.message);
    }

    console.log('\nAttempting to add columns to Category directly...');
    try {
      const res = await pool.request().query(`
        ALTER TABLE Category ADD display_order INT NOT NULL DEFAULT 0;
      `);
      console.log('Success adding display_order to Category:', res);
    } catch (e) {
      console.error('Error adding display_order to Category:', e.message);
    }

    try {
      const res = await pool.request().query(`
        ALTER TABLE Category ADD is_active BIT NOT NULL DEFAULT 1;
      `);
      console.log('Success adding is_active to Category:', res);
    } catch (e) {
      console.error('Error adding is_active to Category:', e.message);
    }

    process.exit(0);
  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  }
}
run();
