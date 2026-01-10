const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.'))); // Serve static files from root
app.use(express.static(path.join(__dirname, 'pages'))); // Serve HTML files from pages

// Database setup
const db = new sqlite3.Database('./users.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )`, (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
      } else {
        console.log('Users table created or already exists.');
      }
    });
  }
});

// Image database
const imageDb = new sqlite3.Database('./image.db', (err) => {
  if (err) {
    console.error('Error opening image database:', err.message);
  } else {
    console.log('Connected to the image database.');
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'welcome.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'home.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'about.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'Sign-up.html'));
});

app.post('/signup', (req, res) => {
  const { username, email, password, 'confirm-password': confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).send('Passwords do not match');
  }

  db.run(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`, [username, email, password], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).send('Username or email already exists');
      }
      return res.status(500).send('Error saving user');
    }
    res.redirect('/login');
  });
});

// Login route
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, row) => {
    if (err) {
      return res.status(500).send('Error checking user');
    }
    if (row) {
      // Login successful, redirect to home
      res.redirect('/home');
    } else {
      res.redirect('/login?error=invalid');
    }
  });
});

// Add other routes as needed
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'Login.html'));
});

// And so on for other pages

app.get('/image/:name', (req, res) => {
  const name = req.params.name;
  imageDb.get(`SELECT data FROM images WHERE name = ?`, [name], (err, row) => {
    if (err) {
      return res.status(500).send('Error fetching image');
    }
    if (row) {
      res.setHeader('Content-Type', 'image/jpeg'); // Assuming JPEG
      res.send(row.data);
    } else {
      res.status(404).send('Image not found');
    }
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});