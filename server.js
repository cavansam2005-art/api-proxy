const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lưu Key trên RAM
const keys = {};

function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const part = () => Array.from({length: 4}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  return `KEY-${part()}-${part()}-${part()}`;
}

// API cho Giao diện
app.post('/', (req, res) => {
  const { action, key_code, browser_uuid, file_name, mod_type, client_ip } = req.body;

  if (action === 'get_aims') {
    return res.json({
      status: 'success',
      aims: [
        { file: 'aim_dragon2.txt', name: 'Aim Drag On 2.0', icon: 'fa-bolt', desc: 'Smooth track', server: 'dhieushop.click', port: 7776 },
        { file: 'aim_chest.txt', name: 'Aim Chest', icon: 'fa-crosshairs', desc: 'Chest lock', server: 'dhieushop.click', port: 7777 }
      ]
    });
  }

  if (action === 'check_key') {
    const rec = keys[key_code];
    if (!rec) return res.json({ status: 'error', message: 'Key không tồn tại.' });
    if (rec.device_id && rec.device_id !== browser_uuid) return res.json({ status: 'error', message: 'Key đã dùng trên máy khác.' });
    
    return res.json({ 
      status: 'success', 
      activated: !!rec.ip, 
      expires_at: rec.expires_at,
      activation_data: rec.ip ? { mod: rec.mod_name, file: rec.file_name, server: rec.server_host, port: rec.server_port } : null
    });
  }

  if (action === 'add_ip') {
    const rec = keys[key_code];
    if (!rec) return res.json({ status: 'error', message: 'Key không tồn tại.' });
    
    rec.ip = client_ip; rec.device_id = browser_uuid; 
    rec.mod_name = mod_type; rec.file_name = file_name;
    rec.server_host = 'dhieushop.click'; rec.server_port = 7776;
    
    return res.json({ status: 'success', expires_at: rec.expires_at, server: rec.server_host, port: rec.server_port });
  }

  if (action === 'remove_ip') {
    if (keys[key_code]) keys[key_code].ip = null;
    return res.json({ status: 'success' });
  }

  if (action === 'check_status') {
    const rec = keys[key_code];
    if (!rec || !rec.ip) return res.json({ status: 'success', active: false });
    return res.json({ 
      status: 'success', active: true, 
      data: { mod: rec.mod_name, file: rec.file_name, server: rec.server_host, port: rec.server_port, expires_at: rec.expires_at } 
    });
  }
});

// API lấy IP
app.get('/api/whoami', (req, res) => {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);
  res.json({ ip: ip || "127.0.0.1" });
});

// Trang Admin
app.get('/admin', (req, res) => {
  res.send(`
    <body style="background:#0f172a;color:#fff;font-family:sans-serif;padding:20px;text-align:center">
      <h2>Admin - SAMM VIP IOS</h2>
      <button onclick="taoKey()" style="padding:10px 20px;background:#10b981;color:#fff;border:none;border-radius:5px;font-size:16px;font-weight:bold;margin-bottom:20px;cursor:pointer">+ Tạo Key Mới</button>
      <ul id="list" style="list-style:none;padding:0;text-align:left;max-width:600px;margin:0 auto"></ul>
      <script>
        async function load() {
          const r = await fetch('/api/admin/list'); const d = await r.json();
          document.getElementById('list').innerHTML = d.map(k => \`<li style="padding:10px;border-bottom:1px solid #333">Key: <b>\${k.key_code}</b> | IP: \${k.ip || 'Chưa dùng'}</li>\`).join('');
        }
        async function taoKey() { await fetch('/api/admin/genkey'); load(); }
        load();
      </script>
    </body>
  `);
});

app.get('/api/admin/list', (req, res) => {
  const list = Object.keys(keys).map(k => ({ key_code: k, ...keys[k] }));
  res.json(list);
});

app.get('/api/admin/genkey', (req, res) => {
  const newKey = generateKey();
  keys[newKey] = { expires_at: null, ip: null, device_id: null, mod_name: null, file_name: null, server_host: null, server_port: null };
  res.json({ ok: true, key: newKey });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('🚀 Server đang chạy!'));
