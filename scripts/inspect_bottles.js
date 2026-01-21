const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./edit.db');

db.all("SELECT user, brand, quantity, price FROM bottles ORDER BY id DESC LIMIT 10", [], (err, rows) => {
  if (err) {
    console.error('ERR', err.message);
    process.exit(1);
  }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
