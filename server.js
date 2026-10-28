const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lưu Key trên RAM
const dbKeys = {};

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

app.get('/api/whoami', (req, res) => {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);
  res.json({ ip: ip || "127.0.0.1" });
});

// API Kích hoạt (Trả về thời gian hết hạn)
app.post('/api/activate', (req, res) => {
  const { key, device_name } = req.body;

  if (!dbKeys[key]) {
    return res.json({ ok: false, message: 'Key không tồn tại.' });
  }

  const record = dbKeys[key];
  const now = Math.floor(Date.now() / 1000);
  
  if (record.expires_at && now > record.expires_at) {
    return res.json({ ok: false, message: 'Key đã hết hạn sử dụng.' });
  }

  // Cập nhật tên thiết bị
  record.device_name = device_name;

  res.json({
    ok: true,
    message: 'Kích hoạt thành công!',
    expires_at: record.expires_at // Trả về thời gian hết hạn (hoặc null nếu vĩnh viễn)
  });
});

// TRANG ADMIN
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admin - Tạo Key</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; }
        .container { max-width: 1100px; margin: 0 auto; }
        h1 { color: #38bdf8; text-align: center; margin-bottom: 20px; }
        .create-box { background: #1e293b; padding: 20px; border-radius: 10px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 15px; align-items: flex-end; }
        .input-group { display: flex; flex-direction: column; gap: 5px; }
        .input-group label { font-size: 13px; color: #94a3b8; font-weight: bold; }
        .input-group input { padding: 10px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; width: 100px; outline: none; }
        .btn-group { display: flex; gap: 10px; flex-wrap: wrap; }
        .btn { padding: 10px 15px; background: #38bdf8; color: #0f172a; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px; }
        .btn-green { background: #10b981; color: white; font-size: 16px; padding: 12px 25px; }
        table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 10px; overflow: hidden; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #334155; font-size: 13px; }
        th { background: #334155; color: #e2e8f0; }
        .key-code { font-family: monospace; font-weight: bold; color: #fbbf24; font-size: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Quản Lý Key Độ Nhạy</h1>
        <div class="create-box">
          <div class="input-group"><label>Ngày</label><input type="number" id="inputDays" value="30" min="0"></div>
          <div class="input-group"><label>Giờ</label><input type="number" id="inputHours" value="0" min="0" max="23"></div>
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
            <thead><tr><th>Key Code</th><th>Hạn Sử Dụng</th></tr></thead>
            <tbody id="keyTableBody"><tr><td colspan="2" style="text-align:center;">Đang tải...</td></tr></tbody>
          </table>
        </div>
      </div>
      <script>
        function setTime(d, h) { document.getElementById('inputDays').value = d; document.getElementById('inputHours').value = h; }
        async function loadKeys() {
          try {
            const res = await fetch('/api/admin/list'); const data = await res.json();
            const tbody = document.getElementById('keyTableBody');
            if (data.length === 0) return tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Chưa có key.</td></tr>';
            const now = Math.floor(Date.now() / 1000);
            tbody.innerHTML = data.map(k => {
              let e = 'Vĩnh viễn';
              if (k.expires_at) { e = new Date(k.expires_at * 1000).toLocaleString('vi-VN'); }
              return \`<tr><td class="key-code">\${k.key_code}</td><td>\${e}</td></tr>\`;
            }).join('');
          } catch(e) { document.getElementById('keyTableBody').innerHTML = '<tr><td colspan="2">Lỗi.</td></tr>'; }
        }
        async function createNewKey() {
          const d = document.getElementById('inputDays').value || 0, h = document.getElementById('inputHours').value || 0;
          try { await fetch(\`/api/admin/genkey?days=\${d}&hours=\${h}\`); loadKeys(); } catch(e) { alert('Lỗi'); }
        }
        loadKeys();
      </script>
    </body>
    </html>
  `);
});

app.get('/api/admin/list', (req, res) => {
  const list = Object.keys(dbKeys).map(k => ({ key_code: k, ...dbKeys[k] }));
  list.sort((a, b) => b.created_at - a.created_at);
  res.json(list);
});

app.get('/api/admin/genkey', (req, res) => {
  const days = parseInt(req.query.days) || 0; 
  const hours = parseInt(req.query.hours) || 0;
  const now = Math.floor(Date.now() / 1000); 
  const total = (days * 24 * 60 * 60) + (hours * 60 * 60);
  const exp = total > 0 ? now + total : null;
  const newKey = generateKey();
  
  dbKeys[newKey] = { expires_at: exp, created_at: now, device_name: null };
  res.json({ ok: true, key: newKey });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('🚀 Server chạy thành công!'));
