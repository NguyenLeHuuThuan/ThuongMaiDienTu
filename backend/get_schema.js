const { poolPromise } = require('./config/db');

async function getSchema() {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Driver'
        `);
        console.log(result.recordset);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

getSchema();
