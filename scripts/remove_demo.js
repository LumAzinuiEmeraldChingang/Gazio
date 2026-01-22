const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./users.db');

db.serialize(() => {
  db.run('DELETE FROM users WHERE username = ?', ['demo'], function(err) {
    if (err) {
      console.error('Error deleting demo user:', err.message);
      process.exit(1);
    }
    console.log('Deleted demo user rows:', this.changes);
    db.close();
  });
});
