const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const app = express();
const DEFAULT_PORT = Number(process.env.PORT || 3000);
const DB_PATH = path.join(__dirname, "cloud.db");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH);

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      vault_key_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, name),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      stored_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      encrypted_size INTEGER NOT NULL,
      salt TEXT NOT NULL,
      iv TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      folder_name TEXT NOT NULL DEFAULT 'My Secure Folder',
      folder_id INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.all("PRAGMA table_info(files)", [], (error, columns) => {
    if (error) {
      return;
    }

    const columnNames = columns.map((column) => column.name);
    if (!columnNames.includes("folder_name")) {
      db.run("ALTER TABLE files ADD COLUMN folder_name TEXT NOT NULL DEFAULT 'My Secure Folder'");
    }

    if (!columnNames.includes("folder_id")) {
      db.run("ALTER TABLE files ADD COLUMN folder_id INTEGER");
    }
  });
});

app.use(express.json({ limit: "10mb" }));
app.use(
  session({
    secret: "replace-this-with-a-long-random-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax"
    }
  })
);
app.use(express.static(path.join(__dirname, "public")));

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
  filename: (_req, file, callback) => {
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`;
    callback(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024
  }
});

function validatePassword(password) {
  return STRONG_PASSWORD_REGEX.test(password);
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    res.status(401).json({ error: "Please log in first." });
    return;
  }
  next();
}

function getUnlockedFolders(req) {
  if (!Array.isArray(req.session.unlockedFolders)) {
    req.session.unlockedFolders = [];
  }
  return req.session.unlockedFolders;
}

function unlockFolderInSession(req, folderId) {
  const unlockedFolders = getUnlockedFolders(req);
  if (!unlockedFolders.includes(folderId)) {
    unlockedFolders.push(folderId);
  }
}

function lockFolderInSession(req, folderId) {
  req.session.unlockedFolders = getUnlockedFolders(req).filter((id) => id !== folderId);
}

function isFolderUnlocked(req, folderId) {
  return getUnlockedFolders(req).includes(folderId);
}

app.post("/api/auth/signup", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!name || !email || !password) {
    res.status(400).json({ error: "Name, email and password are required." });
    return;
  }

  if (!validatePassword(password)) {
    res.status(400).json({
      error:
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
    });
    return;
  }

  try {
    const existingUser = await getQuery("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUser) {
      res.status(409).json({
        error: "This account already exists. Please login with this email or use another email."
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await runQuery(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [name, email, passwordHash]
    );

    res.json({
      success: true,
      message: "Account created successfully. Please login to continue.",
      user: {
        id: result.lastID,
        name,
        email
      }
    });
  } catch (_error) {
    res.status(500).json({ error: "Could not create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  try {
    const user = await getQuery("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email
    };
    req.session.unlockedFolders = [];

    res.json({ user: req.session.user });
  } catch (_error) {
    res.status(500).json({ error: "Could not log in." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get("/api/auth/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

app.get("/api/folders", requireAuth, async (req, res) => {
  try {
    const folders = await allQuery(
      `SELECT folders.id, folders.name, folders.created_at, COUNT(files.id) AS file_count
       FROM folders
       LEFT JOIN files ON files.folder_id = folders.id
       WHERE folders.user_id = ?
       GROUP BY folders.id
       ORDER BY folders.id DESC`,
      [req.session.user.id]
    );
    res.json({ folders });
  } catch (_error) {
    res.status(500).json({ error: "Could not load folders." });
  }
});

app.post("/api/folders", requireAuth, async (req, res) => {
  const name = String(req.body.name || "").trim();
  const vaultKey = String(req.body.vaultKey || "").trim();

  if (!name || !vaultKey) {
    res.status(400).json({ error: "Folder name and vault key are required." });
    return;
  }

  try {
    const existingFolder = await getQuery(
      "SELECT id FROM folders WHERE user_id = ? AND name = ?",
      [req.session.user.id, name]
    );

    if (existingFolder) {
      res.status(409).json({ error: "A folder with this name already exists." });
      return;
    }

    const vaultKeyHash = await bcrypt.hash(vaultKey, 10);
    const result = await runQuery(
      "INSERT INTO folders (user_id, name, vault_key_hash) VALUES (?, ?, ?)",
      [req.session.user.id, name, vaultKeyHash]
    );

    res.json({
      success: true,
      folder: {
        id: result.lastID,
        name
      }
    });
  } catch (_error) {
    res.status(500).json({ error: "Could not create folder." });
  }
});

app.post("/api/folders/:id/unlock", requireAuth, async (req, res) => {
  const folderId = Number(req.params.id);
  const vaultKey = String(req.body.vaultKey || "").trim();

  if (!folderId || !vaultKey) {
    res.status(400).json({ error: "Folder and vault key are required." });
    return;
  }

  try {
    const folder = await getQuery(
      "SELECT * FROM folders WHERE id = ? AND user_id = ?",
      [folderId, req.session.user.id]
    );

    if (!folder) {
      res.status(404).json({ error: "Folder not found." });
      return;
    }

    const isValid = await bcrypt.compare(vaultKey, folder.vault_key_hash);
    if (!isValid) {
      res.status(401).json({ error: "Incorrect vault key." });
      return;
    }

    unlockFolderInSession(req, folder.id);

    const files = await allQuery(
      `SELECT id, folder_id, original_name, mime_type, file_size, encrypted_size, created_at
       FROM files
       WHERE user_id = ? AND folder_id = ?
       ORDER BY id DESC`,
      [req.session.user.id, folder.id]
    );

    res.json({
      success: true,
      folder: {
        id: folder.id,
        name: folder.name
      },
      files
    });
  } catch (_error) {
    res.status(500).json({ error: "Could not unlock folder." });
  }
});

app.post("/api/folders/:id/lock", requireAuth, (req, res) => {
  const folderId = Number(req.params.id);
  if (folderId) {
    lockFolderInSession(req, folderId);
  }
  res.json({ success: true });
});

app.post("/api/files/upload", requireAuth, (req, res) => {
  upload.single("file")(req, res, async (uploadError) => {
    if (uploadError) {
      if (uploadError.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "File is too large. Maximum size is 200 MB." });
        return;
      }

      res.status(400).json({ error: "Could not process file upload." });
      return;
    }

    const originalName = String(req.body.originalName || "").trim();
    const mimeType = String(req.body.mimeType || "").trim();
    const fileSize = Number(req.body.fileSize || 0);
    const salt = String(req.body.salt || "").trim();
    const iv = String(req.body.iv || "").trim();
    const folderId = Number(req.body.folderId || 0);
    const vaultKey = String(req.body.vaultKey || "").trim();

    if (!req.file || !originalName || !mimeType || !fileSize || !salt || !iv || !folderId || !vaultKey) {
      res.status(400).json({ error: "Missing encrypted file details." });
      return;
    }

    try {
      const folder = await getQuery(
        "SELECT * FROM folders WHERE id = ? AND user_id = ?",
        [folderId, req.session.user.id]
      );

      if (!folder) {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        res.status(404).json({ error: "Folder not found." });
        return;
      }

      const isValid = await bcrypt.compare(vaultKey, folder.vault_key_hash);
      if (!isValid) {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        res.status(401).json({ error: "Incorrect folder vault key." });
        return;
      }

      unlockFolderInSession(req, folder.id);

      const result = await runQuery(
        `INSERT INTO files (
          user_id, stored_name, original_name, mime_type, file_size, encrypted_size, salt, iv, folder_name, folder_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.session.user.id,
          req.file.filename,
          originalName,
          mimeType,
          fileSize,
          req.file.size,
          salt,
          iv,
          folder.name,
          folder.id
        ]
      );

      res.json({ success: true, fileId: result.lastID });
    } catch (_error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: "Could not save file information." });
    }
  });
});

app.get("/api/files/:id/download", requireAuth, async (req, res) => {
  try {
    const file = await getQuery(
      "SELECT * FROM files WHERE id = ? AND user_id = ?",
      [req.params.id, req.session.user.id]
    );

    if (!file) {
      res.status(404).json({ error: "File not found." });
      return;
    }

    if (!file.folder_id || !isFolderUnlocked(req, file.folder_id)) {
      res.status(403).json({ error: "Unlock the folder first." });
      return;
    }

    const fullPath = path.join(UPLOAD_DIR, file.stored_name);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: "Stored file not found." });
      return;
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("X-Original-Name", encodeURIComponent(file.original_name));
    res.setHeader("X-Original-Mime", file.mime_type);
    res.setHeader("X-File-Salt", file.salt);
    res.setHeader("X-File-Iv", file.iv);
    res.sendFile(fullPath);
  } catch (_error) {
    res.status(500).json({ error: "Could not download file." });
  }
});

app.delete("/api/files/:id", requireAuth, async (req, res) => {
  try {
    const file = await getQuery(
      "SELECT * FROM files WHERE id = ? AND user_id = ?",
      [req.params.id, req.session.user.id]
    );

    if (!file) {
      res.status(404).json({ error: "File not found." });
      return;
    }

    if (!file.folder_id || !isFolderUnlocked(req, file.folder_id)) {
      res.status(403).json({ error: "Unlock the folder first." });
      return;
    }

    const fullPath = path.join(UPLOAD_DIR, file.stored_name);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    await runQuery("DELETE FROM files WHERE id = ? AND user_id = ?", [
      req.params.id,
      req.session.user.id
    ]);

    res.json({ success: true });
  } catch (_error) {
    res.status(500).json({ error: "Could not delete file." });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Secure cloud storage app running on http://localhost:${port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      const nextPort = port + 1;
      console.log(`Port ${port} is busy. Trying http://localhost:${nextPort} instead...`);
      startServer(nextPort);
      return;
    }

    throw error;
  });
}

startServer(DEFAULT_PORT);
