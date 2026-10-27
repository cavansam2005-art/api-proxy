const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const http = require('http');
const net = require('net');
const url = require('url');

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

// Hàm tạo Key
function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const part = () => Array.from({length: 4}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  return `KEY-${part()}-${part()}-${part()}`;
}

// ==========================================
// PHẦN 1: API CHO GIAO DIỆN WEB (FRONTEND)
// ==========================================
app.get('/api/whoami', (req, res) => {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);
  res.json({ ip: ip || "127.0.0.1" });
});

app.post('/api/activate', (req, res) => {
  const { key, ip, device_id } = req.body;
  const record = db.prepare('SELECT * FROM keys WHERE key_code = ?').get(key);
  if (!record) return res.status(404).json({ ok: false, message: "Key không tồn tại." });
  const now = Math.floor(Date.now() / 1000);
  if (record.expires_at && now > record.expires_at) return res.status(403).json({ ok: false, message: "Key đã hết hạn." });
  if (record.device_id && record.device_id !== device_id) return res.status(403).json({ ok: false, message: "Key đã dùng trên thiết bị khác." });
  
  db.prepare('UPDATE keys SET ip = ?, device_id = ? WHERE key_code = ?').run(ip, device_id, key);
  res.json({ ok: true, message: "Kích hoạt thành công!", expires_at: record.expires_at });
});

app.post('/api/status', (req, res) => {
  const { key, device_id } = req.body;
  const record = db.prepare('SELECT * FROM keys WHERE key_code = ?').get(key);
  if (!record || !record.device_id) return res.json({ state: "none" });
  if (record.device_id !== device_id) return res.json({ state: "active", device_conflict: true });
  res.json({ state: "active", expires_at: record.expires_at });
});

// ==========================================
// PHẦN 2: TRANG ADMIN QUẢN LÝ
// ==========================================
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admin - Quản Lý Key</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; }
        .container { max-width: 1100px; margin: 0 auto; }
        h1 { color: #38bdf8; text-align: center; margin-bottom: 20px; }
        .create-box { background: #1e293b; padding: 20px; border-radius: 10px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 15px; align-items: flex-end; }
        .input-group { display: flex; flex-direction: column; gap: 5px; }
        .input-group label { font-size: 13px; color: #94a3b8; font-weight: bold; }
        .input-group input { padding: 10px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; width: 100px; }
        .btn-group { display: flex; gap: 10px; flex-wrap: wrap; }
        .btn { padding: 10px 15px; background: #38bdf8; color: #0f172a; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
        .btn-green { background: #10b981; color: white; font-size: 16px; padding: 12px 25px; }
        table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 10px; overflow: hidden; }
        th, td { padding: 12px; border-bottom: 1px solid #334155; font-size: 13px; text-align: left; }
        th { background: #334155; }
        .key-code { color: #fbbf24; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Quản Lý Key Proxy</h1>
        <div class="create-box">
          <div class="input-group"><label>Ngày</label><input type="number" id="d" value="30" min="0"></div>
          <div class="input-group"><label>Giờ</label><input type="number" id="h" value="0" min="0" max="23"></div>
          <div class="btn-group">
            <button class="btn" onclick="setT(1,0)">1 Ngày</button>
            <button class="btn" onclick="setT(7,0)">7 Ngày</button>
            <button class="btn" onclick="setT(30,0)">30 Ngày</button>
            <button class="btn" onclick="setT(0,0)">Vĩnh viễn</button>
          </div>
          <button class="btn btn-green" onclick="taoKey()">+ Tạo Key</button>
        </div>
        <table>
          <thead><tr><th>Key</th><th>Hạn</th><th>IP</th></tr></thead>
          <tbody id="tb"></tbody>
        </table>
      </div>
      <script>
        function setT(d,h){document.getElementById('d').value=d;document.getElementById('h').value=h;}
        async function load(){
          const r = await fetch('/api/admin/list'); const d = await r.json();
          document.getElementById('tb').innerHTML = d.map(k => `<tr><td class="key-code">${k.key_code}</td><td>${k.expires_at ? new Date(k.expires_at*1000).toLocaleString('vi-VN') : 'Vĩnh viễn'}</td><td>${k.ip || '-'}</td></tr>`).join('');
        }
        async function taoKey(){ await fetch('/api/admin/genkey?days='+document.getElementById('d').value+'&hours='+document.getElementById('h').value); load(); }
        load();
      </script>
    </body>
    </html>
  `);
});

app.get('/api/admin/list', (req, res) => res.json(db.prepare('SELECT * FROM keys ORDER BY created_at DESC').all()));
app.get('/api/admin/genkey', (req, res) => {
  const days = parseInt(req.query.days) || 0; const hours = parseInt(req.query.hours) || 0;
  const now = Math.floor(Date.now() / 1000); const total = (days*24*60*60)+(hours*60*60);
  const exp = total > 0 ? now + total : null;
  const newKey = generateKey();
  db.prepare('INSERT INTO keys (key_code, expires_at, created_at) VALUES (?, ?, ?)').run(newKey, exp, now);
  res.json({ ok: true, key: newKey });
});

// ==========================================
// PHẦN 3: PROXY SERVER HOÀN CHỈNH (CHẶN IP NẾU CHƯA ACTIVE)
// ==========================================
// Hàm kiểm tra xem IP này có Key hợp lệ không
function checkIpValid(clientIp) {
  const now = Math.floor(Date.now() / 1000);
  const record = db.prepare('SELECT * FROM keys WHERE ip = ? AND (expires_at IS NULL OR expires_at > ?)').get(clientIp, now);
  return !!record;
}

// Tạo HTTP Proxy Server
const proxyServer = http.createServer((req, res) => {
  // Lấy IP của client kết nối tới
  let clientIp = req.socket.remoteAddress;
  if (clientIp.startsWith('::ffff:')) clientIp = clientIp.substring(7);

  // Nếu là truy cập trang Admin/API thì cho qua (để bạn quản lý)
  if (req.url.startsWith('/admin') || req.url.startsWith('/api')) {
    app(req, res);
    return;
  }

  // KIỂM TRA: Nếu IP chưa có key active -> Chặn
  if (!checkIpValid(clientIp)) {
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1 style="color:red; text-align:center; margin-top:20%">IP chưa được cấp quyền!</h1><p style="text-align:center">Vui lòng truy cập trang web để Active Key.</p>');
    return;
  }

  // Nếu IP hợp lệ, tiến hành chuyển tiếp (Proxy)
  const parsedUrl = url.parse(req.url);
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 80,
    path: parsedUrl.path,
    method: req.method,
    headers: req.headers
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  req.pipe(proxyReq, { end: true });
  
  proxyReq.on('error', (err) => {
    res.writeHead(500); res.end('Lỗi kết nối Proxy.');
  });
});

// Hỗ trợ HTTPS Proxy (Dùng cho các trang web bảo mật)
proxyServer.on('connect', (req, clientSocket, head) => {
  let clientIp = clientSocket.remoteAddress;
  if (clientIp.startsWith('::ffff:')) clientIp = clientIp.substring(7);

  // Kiểm tra IP
  if (!checkIpValid(clientIp)) {
    clientSocket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    clientSocket.write('<h1 style="color:red; text-align:center; margin-top:20%">IP chưa được cấp quyền!</h1>');
    clientSocket.end();
    return;
  }

  // Nếu hợp lệ, mở cổng kết nối HTTPS
  const [host, port] = req.url.split(':');
  const serverSocket = net.connect(port || 443, host, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.on('error', () => clientSocket.end());
});

// Chạy Server
const PORT = process.env.PORT || 3000;
// Lưu ý: Chạy cả Express (app) và Proxy trên cùng 1 cổng
proxyServer.on('request', app); 

proxyServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server Proxy + Admin đang chạy tại cổng ${PORT}`);
});
