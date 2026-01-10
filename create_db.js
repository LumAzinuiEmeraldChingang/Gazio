const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Path to the images folder
const imagesDir = path.join(__dirname, 'images');

// Create database
const db = new sqlite3.Database('image.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the SQLite database.');
});

// Serialize to ensure order
db.serialize(() => {
  // Create table
  db.run(`CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    data BLOB NOT NULL
  )`, (err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.log('Table created or already exists.');
    }
  });

  // Read images and insert
  fs.readdir(imagesDir, (err, files) => {
    if (err) {
      console.error('Error reading images directory:', err);
      return;
    }

    files.forEach(file => {
      const filePath = path.join(imagesDir, file);
      fs.readFile(filePath, (err, data) => {
        if (err) {
          console.error('Error reading file:', file, err);
          return;
        }

        // Insert into database
        db.run(`INSERT INTO images (name, data) VALUES (?, ?)`, [file, data], function(err) {
          if (err) {
            console.error('Error inserting image:', file, err);
          } else {
            console.log('Inserted:', file);
          }
        });
      });
    });
  });
});

// Close database after operations
setTimeout(() => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
  });
}, 2000); // Wait a bit for all inserts to complete