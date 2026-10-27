const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Khởi tạo Database
const db = new Database('db.sqlite');
db.exec(`
  CREATE TABLE IF NOT EXISTS keys (
    key_code TEXT PRIMARY KEY,
    ip TEXT,
    device_id TEXT,
    expires_at INTEGER,
    activated_at INTEGER,
    created_at INTEGER
  )
`);

// 2. Hàm tạo Key
function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const part = () => Array.from({length: 4}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  return `KEY-${part()}-${part()}-${part()}`;
}

// ==========================================
// API CHO GIAO DIỆN (FRONTEND)
// ==========================================
app.get('/api/whoami', (req, res) => {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);
  res.json({ ip: ip || "127.0.0.1" });
});

app.post('/api/activate', (req, res) => {
  try {
    const { key, ip, device_id } = req.body;
    if (!key || !ip || !device_id) return res.status(400).json({ ok: false, message: "Thiếu dữ liệu." });

    const record = db.prepare('SELECT * FROM keys WHERE key_code = ?').get(key);
    if (!record) return res.status(404).json({ ok: false, message: "Key không tồn tại." });

    const now = Math.floor(Date.now() / 1000);
    
    if (record.expires_at && now > record.expires_at) {
      return res.status(403).json({ ok: false, message: "Key đã hết hạn sử dụng." });
    }

    if (record.device_id && record.device_id !== device_id) {
      return res.status(403).json({ ok: false, message: "Key đã được dùng trên thiết bị khác." });
    }
    
    db.prepare('UPDATE keys SET ip = ?, device_id = ? WHERE key_code = ?').run(ip, device_id, key);
    
    res.json({ 
      ok: true, 
      message: "Kích hoạt thành công!", 
      expires_at: record.expires_at, 
      expiresAt: record.expires_at ? new Date(record.expires_at * 1000).toISOString() : null
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Lỗi Server." });
  }
});

app.post('/api/status', (req, res) => {
  const { key, device_id } = req.body;
  if (!key) return res.json({ state: "none" });
  const record = db.prepare('SELECT * FROM keys WHERE key_code = ?').get(key);
  if (!record || !record.device_id) return res.json({ state: "none" });
  if (record.device_id !== device_id) return res.json({ state: "active", device_conflict: true });
  const now = Math.floor(Date.now() / 1000);
  if (record.expires_at && now > record.expires_at) return res.json({ state: "expired", message: "Key đã hết hạn" });
  res.json({ state: "active", expires_at: record.expires_at, ip_matches: record.ip === req.body.ip });
});

// ==========================================
// TRANG ADMIN QUẢN LÝ
// ==========================================
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admin - SAMM VIP IOS</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; }
        .container { max-width: 1100px; margin: 0 auto; }
        h1 { color: #38bdf8; margin-bottom: 20px; text-align: center; }
        .create-box { background: #1e293b; padding: 20px; border-radius: 10px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 15px; align-items: flex-end; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .input-group { display: flex; flex-direction: column; gap: 5px; }
        .input-group label { font-size: 13px; color: #94a3b8; font-weight: bold; }
        .input-group input { padding: 10px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 15px; width: 100px; outline: none; }
        .btn-group { display: flex; gap: 10px; flex-wrap: wrap; }
        .btn { padding: 10px 15px; background: #38bdf8; color: #0f172a; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 14px; }
        .btn:hover { background: #0ea5e9; transform: translateY(-2px); }
        .btn-green { background: #10b981; color: white; font-size: 16px; padding: 12px 25px; }
        .btn-green:hover { background: #059669; }
        table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #334155; font-size: 13px; }
        th { background: #334155; color: #e2e8f0; font-weight: 600; text-transform: uppercase; font-size: 12px; }
        .key-code { font-family: 'Courier New', monospace; font-weight: bold; color: #fbbf24; font-size: 15px; }
        .status-active { color: #34d399; font-weight: bold; }
        .status-expired { color: #ef4444; font-weight: bold; }
        .status-none { color: #94a3b8; }
        .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.5); opacity: 0; transition: 0.3s; pointer-events: none; z-index: 999; }
        .toast.show { opacity: 1; top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Quản Lý Key SAMM VIP IOS</h1>
        
        <div class="create-box">
          <div class="input-group">
            <label>Số Ngày</label>
            <input type="number" id="inputDays" value="30" min="0">
          </div>
          <div class="input-group">
            <label>Số Giờ</label>
            <input type="number" id="inputHours" value="0" min="0" max="23">
          </div>
          
          <div class="btn-group" style="margin-right: auto;">
            <button class="btn" onclick="setTime(1, 0)">1 Ngày</button>
            <button class="btn" onclick="setTime(7, 0)">7 Ngày</button>
            <button class="btn" onclick="setTime(30, 0)">30 Ngày</button>
            <button class="btn" onclick="setTime(0, 0)">Vĩnh viễn</button>
          </div>

          <button class="btn btn-green" onclick="createNewKey()">+ Tạo Key Mới</button>
        </div>

        <div style="overflow-x:auto;">
          <table>
            <thead>
              <tr>
                <th>Key Code</th>
                <th>Trạng Thái</th>
                <th>Hạn Sử Dụng</th>
                <th>IP Hiện Tại</th>
              </tr>
            </thead>
            <tbody id="keyTableBody">
              <tr><td colspan="4" style="text-align:center;">Đang tải dữ liệu...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="toast" id="toast">Tạo Key thành công!</div>

      <script>
        function setTime(days, hours) {
          document.getElementById('inputDays').value = days;
          document.getElementById('inputHours').value = hours;
        }

        async function loadKeys() {
          try {
            const res = await fetch('/api/admin/list');
            const data = await res.json();
            const tbody = document.getElementById('keyTableBody');
            
            if (data.length === 0) {
              tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">Chưa có key nào.</td></tr>';
              return;
            }

            const now = Math.floor(Date.now() / 1000);

            tbody.innerHTML = data.map(k => {
              let statusStr = '⚪ Chưa dùng';
              let statusClass = 'status-none';
              let expiresStr = 'Vĩnh viễn';

              if (k.expires_at) {
                expiresStr = new Date(k.expires_at * 1000).toLocaleString('vi-VN');
                if (now > k.expires_at) {
                  statusStr = '🔴 Hết hạn';
                  statusClass = 'status-expired';
                }
              }

              if (k.device_id && now <= (k.expires_at || Infinity)) {
                statusStr = '🟢 Đã dùng';
                statusClass = 'status-active';
              }

              return \`
                <tr>
                  <td class="key-code">\${k.key_code}</td>
                  <td class="\${statusClass}">\${statusStr}</td>
                  <td>\${expiresStr}</td>
                  <td>\${k.ip || '-'}</td>
                </tr>
              \`;
            }).join('');
          } catch (err) {
            document.getElementById('keyTableBody').innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Lỗi tải dữ liệu</td></tr>';
          }
        }

        async function createNewKey() {
          const days = document.getElementById('inputDays').value || 0;
          const hours = document.getElementById('inputHours').value || 0;
          
          try {
            const res = await fetch(\`/api/admin/genkey?days=\${days}&hours=\${hours}\`);
            if (res.ok) {
              const toastEl = document.getElementById('toast');
              toastEl.classList.add('show');
              setTimeout(() => toastEl.classList.remove('show'), 3000);
              loadKeys();
            }
          } catch (err) {
            alert('Lỗi kết nối server');
          }
        }

        loadKeys();
      </script>
    </body>
    </html>
  `);
});

app.get('/api/admin/list', (req, res) => {
  const keys = db.prepare('SELECT * FROM keys ORDER BY created_at DESC').all();
  res.json(keys);
});

app.get('/api/admin/genkey', (req, res) => {
  const days = parseInt(req.query.days) || 0;
  const hours = parseInt(req.query.hours) || 0;
  
  const newKey = generateKey();
  const now = Math.floor(Date.now() / 1000);
  
  let expiresAt = null;
  const totalSeconds = (days * 24 * 60 * 60) + (hours * 60 * 60);
  
  if (totalSeconds > 0) {
    expiresAt = now + totalSeconds;
  }

  db.prepare('INSERT INTO keys (key_code, expires_at, created_at) VALUES (?, ?, ?)').run(newKey, expiresAt, now);
  res.json({ ok: true, key: newKey });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server chạy tại cổng ${PORT}`);
});
