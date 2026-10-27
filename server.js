const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lưu trữ Key bằng RAM (Tránh hoàn toàn lỗi thư viện trên Render)
const dbKeys = {};

function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const part = () => Array.from({length: 4}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  return `KEY-${part()}-${part()}-${part()}`;
}

// ==========================================
// API CHO GIAO DIỆN
// ==========================================
app.post('/', (req, res) => {
  const { action, key_code, browser_uuid, file_name, mod_type, client_ip } = req.body;

  if (action === 'get_aims') {
    return res.json({
      status: 'success',
      aims: [
        { file: 'aim_dragon2.txt', name: 'Aim Drag On 2.0', icon: 'fa-bolt', desc: 'Smooth track', server: 'dhieushop.click', port: 7776 },
        { file: 'aim_chest.txt', name: 'Aim Chest', icon: 'fa-crosshairs', desc: 'Chest lock', server: 'dhieushop.click', port: 7777 },
        { file: 'aim_neck_dragon2.txt', name: 'Aim Neck Drag 2.0', icon: 'fa-user-ninja', desc: 'Neck lock', server: 'dhieushop.click', port: 7778 },
        { file: 'aim_magic_bullet.txt', name: 'Magic Bullet', icon: 'fa-wand-magic-sparkles', desc: 'Hit assist', server: 'dhieushop.click', port: 7779 }
      ]
    });
  }

  if (action === 'check_key') {
    const record = dbKeys[key_code];
    if (!record) return res.json({ status: 'error', message: 'Key không tồn tại.' });
    
    const now = Math.floor(Date.now() / 1000);
    if (record.expires_at && now > record.expires_at) return res.json({ status: 'error', message: 'Key đã hết hạn.' });
    if (record.device_id && record.device_id !== browser_uuid) return res.json({ status: 'error', message: 'Key đã dùng trên thiết bị khác.' });

    if (record.ip) {
      return res.json({
        status: 'success', activated: true, expires_at: record.expires_at,
        activation_data: { mod: record.mod_name, file: record.file_name, server: record.server_host, port: record.server_port }
      });
    }
    return res.json({ status: 'success', activated: false, expires_at: record.expires_at });
  }

  if (action === 'add_ip') {
    const record = dbKeys[key_code];
    if (!record) return res.json({ status: 'error', message: 'Key không tồn tại.' });

    let server = 'dhieushop.click';
    let port = 7776;
    if (file_name === 'aim_chest.txt') port = 7777;
    if (file_name === 'aim_neck_dragon2.txt') port = 7778;
    if (file_name === 'aim_magic_bullet.txt') port = 7779;

    record.ip = client_ip;
    record.device_id = browser_uuid;
    record.activated_at = Math.floor(Date.now() / 1000);
    record.mod_name = mod_type;
    record.file_name = file_name;
    record.server_host = server;
    record.server_port = port;

    return res.json({ status: 'success', expires_at: record.expires_at, server: server, port: port });
  }

  if (action === 'remove_ip') {
    if (dbKeys[key_code]) {
      dbKeys[key_code].ip = null;
      dbKeys[key_code].mod_name = null;
      dbKeys[key_code].file_name = null;
    }
    return res.json({ status: 'success' });
  }

  if (action === 'check_status') {
    const record = dbKeys[key_code];
    if (!record || !record.ip) return res.json({ status: 'success', active: false });
    const now = Math.floor(Date.now() / 1000);
    if (record.expires_at && now > record.expires_at) return res.json({ status: 'success', active: false, expired: true });
    
    return res.json({
      status: 'success', active: true,
      data: { mod: record.mod_name, file: record.file_name, server: record.server_host, port: record.server_port, expires_at: record.expires_at }
    });
  }
});

app.get('/api/whoami', (req, res) => {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);
  res.json({ ip: ip || "127.0.0.1" });
});

// ==========================================
// TRANG ADMIN
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
        .status-active { color: #34d399; font-weight: bold; }
        .status-expired { color: #ef4444; font-weight: bold; }
        .status-none { color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Quản Lý Key SAMM VIP IOS</h1>
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
            <thead><tr><th>Key Code</th><th>Trạng Thái</th><th>Hạn Sử Dụng</th><th>IP</th></tr></thead>
            <tbody id="keyTableBody"><tr><td colspan="4" style="text-align:center;">Đang tải...</td></tr></tbody>
          </table>
        </div>
      </div>
      <script>
        function setTime(d, h) { document.getElementById('inputDays').value = d; document.getElementById('inputHours').value = h; }
        async function loadKeys() {
          try {
            const res = await fetch('/api/admin/list'); const data = await res.json();
            const tbody = document.getElementById('keyTableBody');
            if (data.length === 0) return tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Chưa có key.</td></tr>';
            const now = Math.floor(Date.now() / 1000);
            tbody.innerHTML = data.map(k => {
              let s = '⚪ Chưa dùng', c = 'status-none', e = 'Vĩnh viễn';
              if (k.expires_at) { e = new Date(k.expires_at * 1000).toLocaleString('vi-VN'); if (now > k.expires_at) { s = '🔴 Hết hạn'; c = 'status-expired'; } }
              if (k.ip && now <= (k.expires_at || Infinity)) { s = '🟢 Đã dùng'; c = 'status-active'; }
              return `<tr><td class="key-code">${k.key_code}</td><td class="${c}">${s}</td><td>${e}</td><td>${k.ip || '-'}</td></tr>`;
            }).join('');
          } catch(e) { document.getElementById('keyTableBody').innerHTML = '<tr><td colspan="4">Lỗi.</td></tr>'; }
        }
        async function createNewKey() {
          const d = document.getElementById('inputDays').value || 0, h = document.getElementById('inputHours').value || 0;
          try { await fetch(`/api/admin/genkey?days=${d}&hours=${h}`); loadKeys(); } catch(e) { alert('Lỗi'); }
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
  const days = parseInt(req.query.days) || 0; const hours = parseInt(req.query.hours) || 0;
  const now = Math.floor(Date.now() / 1000); const total = (days*24*60*60)+(hours*60*60);
  const exp = total > 0 ? now + total : null;
  const newKey = generateKey();
  
  dbKeys[newKey] = {
    expires_at: exp,
    activated_at: null,
    created_at: now,
    ip: null,
    device_id: null,
    mod_name: null,
    file_name: null,
    server_host: null,
    server_port: null
  };
  
  res.json({ ok: true, key: newKey });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server chạy cổng ${PORT}`));
