const { poolPromise } = require('./config/db');
poolPromise.then(pool => {
  return pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Restaurant'");
}).then(r => {
  console.log('Restaurant columns:', r.recordset);
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
