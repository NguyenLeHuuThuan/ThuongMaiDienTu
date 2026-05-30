const { poolPromise } = require('./config/db');

async function testSearch(searchTerm) {
  try {
    const pool = await poolPromise;
    const request = pool.request();
    let query = `
      SELECT id_User, phone, fullName, email, role, status
      FROM [User]
      WHERE 1=1
    `;
    if (searchTerm) {
      query += ` AND (fullName LIKE @search OR phone LIKE @search OR email LIKE @search)`;
      request.input('search', `%${searchTerm}%`);
    }
    const res = await request.query(query);
    console.log(`Search for "${searchTerm}":`, res.recordset.length, 'results');
    console.log(res.recordset);
  } catch (err) {
    console.error(err);
  }
}

async function run() {
  await testSearch('Châu');
  await testSearch('0923456789');
  await testSearch('customer');
  process.exit(0);
}
run();
