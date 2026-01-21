const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./edit.db', (err) => {
  if (err) { console.error('open error', err); process.exit(1); }
});

db.all('SELECT * FROM edits', [], (err, rows) => {
  if (err) {
    console.error('query error', err);
    process.exit(1);
  }
  console.log('edits rows:', JSON.stringify(rows, null, 2));
  db.close();
});
