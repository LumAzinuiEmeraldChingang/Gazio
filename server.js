const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = 3000;

// Middleware
// Allow larger payloads (images as data URLs can be large)
app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));
app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '.'))); // Serve static files from root
app.use(express.static(path.join(__dirname, 'pages'))); // Serve HTML files from pages

// Simple cookie parser helper (no extra dependency)
function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (!rc) return list;
  rc.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const key = parts.shift().trim();
    const val = decodeURI(parts.join('='));
    list[key] = val;
  });
  return list;
}

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

    // Ensure users table has additional columns for profile data
    db.serialize(() => {
      db.all(`PRAGMA table_info(users)`, (err, rows) => {
        if (err) {
          console.error('Error reading users table info:', err && err.message);
          return;
        }
        const cols = (rows || []).map(r => r.name);
        const addIfMissing = (col, type) => {
          if (!cols.includes(col)) {
            db.run(`ALTER TABLE users ADD COLUMN ${col} ${type}`, (err) => {
              if (err) console.error(`Error adding column ${col}:`, err.message);
              else console.log(`Added column ${col} to users table.`);
            });
          }
        };
        addIfMissing('phone', 'TEXT');
        addIfMissing('profileImage', 'TEXT');
        addIfMissing('location', 'TEXT');
      });
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

// Edit database (stores edits from edit.html)
const editDb = new sqlite3.Database('./edit.db', (err) => {
  if (err) {
    console.error('Error opening edit database:', err.message);
  } else {
    console.log('Connected to the edit database.');
    editDb.run(`CREATE TABLE IF NOT EXISTS edits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      brand TEXT,
      quantity INTEGER,
      price INTEGER,
      phone TEXT
    )`, (err) => {
      if (err) {
        console.error('Error creating edits table:', err.message);
      } else {
        console.log('Edits table created or already exists.');
      }
    });
  }
});

// Bottles table for multiple gas bottles per user
const bottleDb = new sqlite3.Database('./edit.db', (err) => {
  if (err) {
    console.error('Error opening bottle database:', err.message);
  } else {
    bottleDb.run(`CREATE TABLE IF NOT EXISTS bottles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT NOT NULL,
      brand TEXT NOT NULL,
      quantity INTEGER,
      price INTEGER,
      phone TEXT,
      UNIQUE(user, brand)
    )`, (err) => {
      if (err) {
        console.error('Error creating bottles table:', err.message);
      } else {
        console.log('Bottles table created or already exists.');
      }
    });
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
    // set username cookie so subsequent pages can identify the user
    res.setHeader('Set-Cookie', `username=${encodeURIComponent(username)}; Path=/; Max-Age=${7 * 24 * 60 * 60}`);
    res.redirect('/home');
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
      // Login successful, set cookie and redirect to home
      res.setHeader('Set-Cookie', `username=${encodeURIComponent(username)}; Path=/; Max-Age=${7 * 24 * 60 * 60}`);
      res.redirect('/home');
    } else {
      res.redirect('/login?error=invalid');
    }
  });
});

// Return current username from cookie (used by client to display name)
app.get('/me', (req, res) => {
  const cookies = parseCookies(req);
  const username = cookies.username || null;
  res.json({ username });
});

// Return saved profile data for the logged-in user from edit.db
app.get('/profile-data', (req, res) => {
  // allow optional ?user= view to fetch public seller data, otherwise use cookie
  const queryUser = req.query && req.query.user ? String(req.query.user) : null;
  const cookies = parseCookies(req);
  const username = queryUser || cookies.username;
  if (!username) return res.json({});
  // fetch user profile fields from users table, then return bottles
  db.get(`SELECT username, email, phone, profileImage, location FROM users WHERE username = ?`, [username], (uErr, userRow) => {
    if (uErr) {
      console.error('Error reading user profile:', uErr.message);
      return res.status(500).json({});
    }
    bottleDb.all(`SELECT brand, quantity, price, phone FROM bottles WHERE user = ?`, [username], (err, rows) => {
      if (err) {
        console.error('Error reading bottles:', err.message);
        return res.status(500).json({});
      }
      const bottles = (rows || []).map(r => ({
        brand: r.brand,
        quantity: r.quantity || 0,
        price: r.price || 0,
        phone: r.phone || ''
      }));
      const profile = userRow || { username };
      res.json({ name: profile.username, email: profile.email || null, phone: profile.phone || null, profileImage: profile.profileImage || null, location: profile.location || null, bottles });
    });
  });
});

// Add other routes as needed
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'Login.html'));
});

// Persist user settings (update fields provided). Uses cookie to identify current user.
app.put('/api/settings', (req, res) => {
  const cookies = parseCookies(req);
  const currentUser = cookies.username;
  if (!currentUser) return res.status(400).json({ message: 'Not authenticated' });

  const { username, email, password, location, profileImage, phone } = req.body || {};

  const updates = [];
  const params = [];
  if (username) { updates.push('username = ?'); params.push(String(username)); }
  if (email) { updates.push('email = ?'); params.push(String(email)); }
  if (password) { updates.push('password = ?'); params.push(String(password)); }
  if (phone) { updates.push('phone = ?'); params.push(String(phone)); }
  if (profileImage) { updates.push('profileImage = ?'); params.push(String(profileImage)); }
  if (location) { updates.push('location = ?'); params.push(String(location)); }

  if (updates.length === 0) return res.json({ message: 'No changes provided' });

  params.push(currentUser);
  const sql = `UPDATE users SET ${updates.join(', ')} WHERE username = ?`;
  db.run(sql, params, function(err) {
    if (err) {
      console.error('Error updating settings:', err.message);
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ message: 'Username or email already exists' });
      }
      return res.status(500).json({ message: 'Error saving settings' });
    }
    // If username changed, update cookie so session continues under new name
    if (username) {
      res.setHeader('Set-Cookie', `username=${encodeURIComponent(username)}; Path=/; Max-Age=${7 * 24 * 60 * 60}`);
    }
    return res.json({ message: 'Settings saved' });
  });
});

// Save edits from edit.html into edit.db (insert or update)
app.post('/save-edit', (req, res) => {
  const { name: bodyName, brand, quantity, price, phone } = req.body;
  const cookies = parseCookies(req);
  const name = bodyName || cookies.username;
  if (!name) return res.status(400).send('Name is required');

  const sql = `INSERT INTO edits (name, brand, quantity, price, phone)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      brand = excluded.brand,
      quantity = excluded.quantity,
      price = excluded.price,
      phone = excluded.phone`;

  editDb.run(sql, [name, brand, quantity || null, price || null, phone || null], function(err) {
    if (err) {
      console.error('Error saving edit:', err.message);
      return res.status(500).send('Error saving edit');
    }
    return res.json({ success: true, id: this.lastID });
  });
});

// Add a new bottle for the logged-in user. Reject if the same brand already exists for that user.
app.post('/add-bottle', (req, res) => {
  const { brand, quantity, price, phone } = req.body;
  const cookies = parseCookies(req);
  const user = cookies.username;
  if (!user) return res.status(400).json({ error: 'Not authenticated' });
  if (!brand || !brand.trim()) return res.status(400).json({ error: 'Brand is required' });

  bottleDb.run(`INSERT INTO bottles (user, brand, quantity, price, phone) VALUES (?, ?, ?, ?, ?)`,
    [user, brand.trim(), quantity || null, price || null, phone || null], function(err) {
      if (err) {
        if (err.message && err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Brand already exists' });
        }
        console.error('Error adding bottle:', err.message);
        return res.status(500).json({ error: 'Error adding bottle' });
      }
      return res.json({ success: true, id: this.lastID });
    });
});

// Update an existing bottle for the logged-in user
app.post('/update-bottle', (req, res) => {
  const { brand, quantity, price, phone } = req.body;
  const cookies = parseCookies(req);
  const user = cookies.username;
  if (!user) return res.status(400).json({ error: 'Not authenticated' });
  if (!brand || !brand.trim()) return res.status(400).json({ error: 'Brand is required' });

  const sql = `UPDATE bottles SET quantity = ?, price = ?, phone = ? WHERE user = ? AND lower(brand) = lower(?)`;
  bottleDb.run(sql, [quantity || null, price || null, phone || null, user, brand.trim()], function(err) {
    if (err) {
      console.error('Error updating bottle:', err.message);
      return res.status(500).json({ error: 'Error updating bottle' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Bottle not found' });
    }
    return res.json({ success: true });
  });
});

// Delete an existing bottle for the logged-in user
app.post('/delete-bottle', (req, res) => {
  const { brand } = req.body;
  const cookies = parseCookies(req);
  const user = cookies.username;
  if (!user) return res.status(400).json({ error: 'Not authenticated' });
  if (!brand || !brand.trim()) return res.status(400).json({ error: 'Brand is required' });

  const sql = `DELETE FROM bottles WHERE user = ? AND lower(brand) = lower(?)`;
  bottleDb.run(sql, [user, brand.trim()], function(err) {
    if (err) {
      console.error('Error deleting bottle:', err.message);
      return res.status(500).json({ error: 'Error deleting bottle' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Bottle not found' });
    }
    return res.json({ success: true });
  });
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