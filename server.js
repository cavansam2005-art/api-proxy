const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Lưu Key trên RAM
const dbKeys = {};

// Hàm tạo Key
function generateKey() {
  let result = 'KEY';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < 3; i++) {
    let part = '';
    for (let j = 0; j < 4; j++) {
      part += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    result += '-' + part;
  }
  return result;
}

// 1. API lấy IP
app.get('/api/whoami', (req, res) => {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);
  res.json({ ip: ip || "127.0.0.1" });
});

// 2. API Kích hoạt
app.post('/api/activate', (req, res) => {
  const key = req.body.key;
  const ip = req.body.ip;
  const device_id = req.body.device_id;

  if (!dbKeys[key]) {
    return res.json({ ok: false, message: 'Key không tồn tại.' });
  }

  const record = dbKeys[key];
  const now = Math.floor(Date.now() / 1000);
  
  if (record.expires_at && now > record.expires_at) {
    return res.json({ ok: false, message: 'Key đã hết hạn.' });
  }

  record.ip = ip;
  record.device_id = device_id;

  res.json({
    ok: true,
    message: 'Kích hoạt thành công!',
    expires_at: record.expires_at
  });
});

// 3. API Check Status
app.post('/api/status', (req, res) => {
  const key = req.body.key;
  const device_id = req.body.device_id;
  const record = dbKeys[key];

  if (!record || !record.device_id) return res.json({ state: "none" });
  if (record.device_id !== device_id) return res.json({ state: "active", device_conflict: true });
  
  res.json({ state: "active", expires_at: record.expires_at, ip_matches: true });
});

// 4. TRANG ADMIN TẠO KEY
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admin - Tạo Key</title>
      <style>
        body { font-family: sans-serif; background: #0f172a; color: #fff; padding: 20px; }
        h1 { color: #38bdf8; text-align: center; }
        .box { background: #1e293b; padding: 20px; border-radius: 10px; max-width: 600px; margin: 0 auto; text-align: center; }
        button { padding: 15px 30px; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 18px; font-weight: bold; cursor: pointer; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; background: #1e293b; margin-top: 20px; }
        th, td { padding: 12px; border-bottom: 1px solid #334155; text-align: left; font-size: 14px; }
        .key { color: #fbbf24; font-weight: bold; font-family: monospace; }
      </style>
    </head>
    <body>
      <h1>Quản Lý Key</h1>
      <div class="box">
        <p>Bấm nút bên dưới để tạo 1 Key ngẫu nhiên</p>
        <button onclick="taoKey()">+ Tạo Key Mới</button>
        <table>
          <thead><tr><th>Key Code</th><th>Trạng Thái</th><th>IP</th></tr></thead>
          <tbody id="data"></tbody>
        </table>
      </div>
      <script>
        async function load() {
          const r = await fetch('/api/admin/list');
          const d = await r.json();
          document.getElementById('data').innerHTML = d.map(k => \`
            <tr>
              <td class="key">\${k.key_code}</td>
              <td>\${k.device_id ? '🟢 Đã dùng' : '⚪ Chưa dùng'}</td>
              <td>\${k.ip || '-'}</td>
            </tr>
          \`).join('');
        }
        async function taoKey() {
          await fetch('/api/admin/genkey');
          load();
        }
        load();
      </script>
    </body>
    </html>
  `);
});

app.get('/api/admin/list', (req, res) => {
  const arr = [];
  for (let k in dbKeys) {
    arr.push({ key_code: k, ip: dbKeys[k].ip, device_id: dbKeys[k].device_id });
  }
  res.json(arr);
});

app.get('/api/admin/genkey', (req, res) => {
  const newKey = generateKey();
  dbKeys[newKey] = { expires_at: null, ip: null, device_id: null };
  res.json({ ok: true, key: newKey });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('Server đang chạy!'));
