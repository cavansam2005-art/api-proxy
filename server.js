const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json());
const db = new Database('db.sqlite');

// Tạo bảng
db.exec(`CREATE TABLE IF NOT EXISTS keys (key_code TEXT PRIMARY KEY, ip TEXT, device_id TEXT, expires_at INTEGER)`);

// 1. API Lấy IP
app.get('/api/whoami', (req, res) => {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);
  res.json({ ip: ip || "127.0.0.1" });
});

// 2. API Active
app.post('/api/activate', (req, res) => {
  const { key, ip, device_id } = req.body;
  const row = db.prepare('SELECT * FROM keys WHERE key_code = ?').get(key);
  if (!row) return res.status(404).json({ ok: false, message: "Key không tồn tại." });
  const now = Math.floor(Date.now() / 1000);
  if (row.device_id && row.device_id !== device_id) return res.status(403).json({ ok: false, message: "Key đã dùng trên máy khác." });
  if (row.expires_at && now > row.expires_at) return res.status(403).json({ ok: false, message: "Key đã hết hạn." });
  
  db.prepare('UPDATE keys SET ip = ? WHERE key_code = ?').run(ip, key);
  res.json({ ok: true, message: "Kích hoạt thành công!", expires_at: row.expires_at });
});

// 3. API Status
app.post('/api/status', (req, res) => {
  const { key, device_id } = req.body;
  const row = db.prepare('SELECT * FROM keys WHERE key_code = ?').get(key);
  if (!row || !row.device_id) return res.json({ state: "none" });
  if (row.device_id !== device_id) return res.json({ state: "active", device_conflict: true });
  res.json({ state: "active", expires_at: row.expires_at });
});

// 4. TRANG ADMIN SIÊU GỌN
app.get('/admin', (req, res) => {
  res.send(`
    <body style="background:#111;color:#fff;font-family:sans-serif;padding:20px;text-align:center">
      <h2>Trang Quản Lý Admin</h2>
      <button onclick="taoKey()" style="padding:10px 20px;background:#0f0;color:#000;font-weight:bold;border:none;border-radius:5px;font-size:16px">+ Tạo Key Mới</button>
      <ul id="list" style="list-style:none;padding:0;margin-top:20px;text-align:left"></ul>
      <script>
        async function load() {
          const r = await fetch('/api/admin/list');
          const d = await r.json();
          document.getElementById('list').innerHTML = d.map(k => \`<li style="padding:10px;border-bottom:1px solid #333">Key: <b>\${k.key_code}</b> | IP: \${k.ip || 'Chưa dùng'}</li>\`).join('');
        }
        async function taoKey() { await fetch('/api/admin/genkey'); load(); }
        load();
      </script>
    </body>
  `);
});

// 5. API Tạo Key
app.get('/api/admin/list', (req, res) => res.json(db.prepare('SELECT * FROM keys').all()));
app.get('/api/admin/genkey', (req, res) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const p = () => Array.from({length: 4}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  const newKey = `KEY-\${p()}-\${p()}-\${p()}`;
  db.prepare('INSERT INTO keys (key_code) VALUES (?)').run(newKey);
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, '0.0.0.0');
