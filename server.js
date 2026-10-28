const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dbKeys = {};
let keyCounter = 1;

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
  record.device_name = device_name;
  res.json({ ok: true, message: 'Kích hoạt thành công!', expires_at: record.expires_at });
});

// API trả về danh sách Key
app.get('/api/admin/list', (req, res) => {
  const list = Object.keys(dbKeys).map(k => ({ key_code: k, ...dbKeys[k] }));
  list.sort((a, b) => b.id - a.id);
  res.json(list);
});

// API tạo Key
app.get('/api/admin/genkey', (req, res) => {
  const days = parseInt(req.query.days) || 0; 
  const hours = parseInt(req.query.hours) || 0;
  const qty = parseInt(req.query.qty) || 1;
  
  const now = Math.floor(Date.now() / 1000); 
  const total = (days * 24 * 60 * 60) + (hours * 60 * 60);
  const exp = total > 0 ? now + total : null;
  
  let generatedKeys = [];
  for (let i = 0; i < qty; i++) {
    const newKey = generateKey();
    dbKeys[newKey] = { id: keyCounter++, expires_at: exp, created_at: now, device_name: null };
    generatedKeys.push(newKey);
  }
  res.json({ ok: true, count: generatedKeys.length, keys: generatedKeys });
});

// Phục vụ file admin.html khi vào đường dẫn /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('🚀 Server chạy thành công!'));
