const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const dbKeys = {};
const dbDevices = {};
let keyCounter = 1;

// ==========================================
// BẠN SỬA LINK THẬT CỦA NGƯỜI BÁN VÀO ĐÂY
// Lưu ý: Link phải là link Live hoặc link Profile của họ
// ==========================================
const tiktokLinks = {
  "link_ruong_treo_1": { 
      group: "ruong_treo", 
      created_at: "14:20:00 29/10/2026", 
      real_url: "https://www.tiktok.com/@ten_nguoi_ban/live" // Sửa link này
  },
  "link_ruong_lon_1": { 
      group: "ruong_lon", 
      created_at: "14:15:00 29/10/2026", 
      real_url: "https://www.tiktok.com/@ten_nguoi_ban/live" // Sửa link này
  },
  "link_ruong_nho_1": { 
      group: "ruong_nho", 
      created_at: "14:10:00 29/10/2026", 
      real_url: "https://www.tiktok.com/@ten_nguoi_ban/live" // Sửa link này
  },
  "link_nhan_pham_1": { 
      group: "nhan_pham", 
      created_at: "14:05:00 29/10/2026", 
      real_url: "https://www.tiktok.com/@ten_nguoi_ban/live" // Sửa link này
  },
  "link_ruong_test_1": { 
      group: "ruong_test", 
      created_at: "14:00:00 29/10/2026", 
      real_url: "https://www.tiktok.com/@ten_nguoi_ban/live" // Sửa link này
  },
  "link_tui_1": { 
      group: "tui", 
      created_at: "13:55:00 29/10/2026", 
      real_url: "https://www.tiktok.com/@ten_nguoi_ban/live" // Sửa link này
  },
  "link_tui_0xu_1": { 
      group: "tui_0xu", 
      created_at: "13:50:00 29/10/2026", 
      real_url: "https://www.tiktok.com/@ten_nguoi_ban/live" // Sửa link này
  }
};

function generateKey() {
  let result = 'VIP';
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

// 1. API Check Auth
app.get('/api/check-auth', (req, res) => {
  const { device_id } = req.query;
  if (!device_id) return res.status(400).json({ error: 'Thiếu device_id' });

  const authData = dbDevices[device_id];
  if (authData) {
    res.json({
      authorized: true,
      device_tail: device_id.slice(-4),
      key_tail: authData.key ? authData.key.slice(-4) : 'ADMIN',
      expires_at: authData.expires_at
    });
  } else {
    res.json({ authorized: false });
  }
});

// 2. API Kích hoạt Key
app.post('/api/activate-key', (req, res) => {
  const { key, device_id } = req.body;
  if (!key || !device_id) return res.status(400).json({ error: 'Thiếu thông tin' });

  const keyData = dbKeys[key];
  if (!keyData) return res.json({ success: false, error: 'Mã Key không chính xác!' });

  const now = Math.floor(Date.now() / 1000);
  if (keyData.expires_at && now > keyData.expires_at) {
    return res.json({ success: false, error: 'Mã Key đã hết hạn!' });
  }

  dbDevices[device_id] = {
    key: key,
    expires_at: keyData.expires_at
  };

  res.json({ success: true, message: 'Kích hoạt thành công!' });
});

// 3. API Lấy danh sách link
app.post('/api/v2/feed/stream', (req, res) => {
  const { device_id } = req.body;
  if (!dbDevices[device_id]) {
    return res.status(403).json({ error: 'Chưa kích hoạt' });
  }

  const groupCounts = {};
  for (const key in tiktokLinks) {
    const group = tiktokLinks[key].group;
    groupCounts[group] = (groupCounts[group] || 0) + 1;
  }

  res.json({
    success: true,
    groupCounts: groupCounts,
    links: tiktokLinks
  });
});

// 4. API Chuyển hướng (Đã sửa để trả về link thật)
app.post('/api/v2/feed/claim-link', (req, res) => {
  const { shop_id } = req.body;
  const linkData = tiktokLinks[shop_id];
  
  if (linkData && linkData.real_url) {
    res.json({ url: linkData.real_url }); // Trả về link thật
  } else {
    res.status(404).json({ error: 'Không tìm thấy link' });
  }
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
      <title>Admin - ShopLink</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; background: #0a0a0c; color: #fff; padding: 20px; }
        .container { max-width: 900px; margin: 0 auto; }
        h1 { color: #25f4ee; text-align: center; }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
        .tab-btn { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #333; background: #121216; color: #888; cursor: pointer; font-weight: bold; }
        .tab-btn.active { background: #fe2c55; color: #fff; border-color: #fe2c55; }
        .create-box { background: #121216; padding: 20px; border-radius: 12px; display: none; gap: 15px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 20px; border: 1px solid #fe2c55; }
        .create-box.active { display: flex; }
        .input-group { display: flex; flex-direction: column; gap: 5px; }
        .input-group label { font-size: 13px; color: #94a3b8; }
        .input-group input { padding: 10px; border-radius: 8px; border: 1px solid #333; background: #0a0a0c; color: #fff; width: 150px; outline: none; }
        .btn { padding: 10px 15px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; }
        .btn-green { background: #10b981; color: #fff; font-size: 15px; padding: 12px 24px;}
        .btn-copy { background: #25f4ee; color: #000; }
        table { width: 100%; border-collapse: collapse; background: #121216; border-radius: 10px; overflow: hidden; border: 1px solid #333; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #333; font-size: 13px; }
        th { background: #1a1a20; color: #94a3b8; }
        .key-code { font-family: monospace; color: #ff7a00; font-weight: 700; font-size: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Quản Lý ShopLink</h1>
        
        <div class="tabs">
          <button class="tab-btn active" onclick="switchTab('key')">Tạo Key</button>
          <button class="tab-btn" onclick="switchTab('device')">Cấp Quyền Thiết Bị</button>
        </div>

        <div id="tab-key" class="create-box active">
          <div class="input-group"><label>Ngày</label><input type="number" id="inputDays" value="30"></div>
          <div class="input-group"><label>Giờ</label><input type="number" id="inputHours" value="0"></div>
          <div class="input-group"><label>Số lượng</label><input type="number" id="inputQty" value="1"></div>
          <button class="btn btn-green" onclick="createNewKey()">+ Tạo Key</button>
        </div>

        <div id="tab-device" class="create-box">
          <div class="input-group" style="flex:1;">
            <label>Nhập ID Thiết Bị</label>
            <input type="text" id="inputDeviceId" placeholder="device_..." style="width:100%;">
          </div>
          <div class="input-group"><label>Ngày</label><input type="number" id="inputDevDays" value="30"></div>
          <button class="btn btn-green" onclick="addDevice()">+ Cấp Quyền</button>
        </div>

        <table>
          <thead><tr><th>ID</th><th>Key Code / Thiết bị</th><th>Hạn Sử Dụng</th><th>Hành động</th></tr></thead>
          <tbody id="dataTableBody"><tr><td colspan="4" style="text-align:center;">Đang tải...</td></tr></tbody>
        </table>
      </div>
      <script>
        let currentTab = 'key';
        function switchTab(tab) {
          currentTab = tab;
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.create-box').forEach(b => b.classList.remove('active'));
          event.target.classList.add('active');
          document.getElementById('tab-' + tab).classList.add('active');
          loadData();
        }

        async function loadData() {
          const tbody = document.getElementById('dataTableBody');
          if (currentTab === 'key') {
            const res = await fetch('/api/admin/list');
            const data = await res.json();
            if (data.length === 0) return tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Chưa có key.</td></tr>';
            tbody.innerHTML = data.map(k => {
              let e = 'Vĩnh viễn';
              if (k.expires_at) { e = new Date(k.expires_at * 1000).toLocaleString('vi-VN'); }
              return \`<tr><td>#\${k.id}</td><td class="key-code">\${k.key_code}</td><td>\${e}</td><td><button class="btn btn-copy" onclick="copyText('\${k.key_code}', this)">Sao chép</button></td></tr>\`;
            }).join('');
          } else {
            const res = await fetch('/api/admin/devices');
            const data = await res.json();
            if (data.length === 0) return tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Chưa cấp quyền thiết bị nào.</td></tr>';
            tbody.innerHTML = data.map(d => {
              let e = 'Vĩnh viễn';
              if (d.expires_at) { e = new Date(d.expires_at * 1000).toLocaleString('vi-VN'); }
              return \`<tr><td>Device</td><td class="key-code" style="font-size:12px;">\${d.device_id}</td><td>\${e}</td><td><button class="btn btn-copy" onclick="copyText('\${d.device_id}', this)">Sao chép</button></td></tr>\`;
            }).join('');
          }
        }

        async function createNewKey() {
          const d = document.getElementById('inputDays').value || 0;
          const h = document.getElementById('inputHours').value || 0;
          const q = document.getElementById('inputQty').value || 1;
          await fetch(\`/api/admin/genkey?days=\${d}&hours=\${h}&qty=\${q}\`);
          loadData();
        }

        async function addDevice() {
          const devId = document.getElementById('inputDeviceId').value.trim();
          const d = document.getElementById('inputDevDays').value || 30;
          if (!devId) return alert('Vui lòng nhập ID thiết bị!');
          await fetch('/api/admin/add-device', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ device_id: devId, days: parseInt(d) }) });
          document.getElementById('inputDeviceId').value = '';
          loadData();
        }

        function copyText(text, btn) {
          navigator.clipboard.writeText(text).then(() => {
            btn.innerText = 'Đã chép!';
            btn.style.background = '#10b981'; btn.style.color = '#fff';
            setTimeout(() => { btn.innerText = 'Sao chép'; btn.style.background = '#25f4ee'; btn.style.color = '#000'; }, 1500);
          });
        }
        loadData();
      </script>
    </body>
    </html>
  `);
});

// API Admin
app.get('/api/admin/list', (req, res) => {
  const list = Object.keys(dbKeys).map(k => ({ key_code: k, ...dbKeys[k] }));
  list.sort((a, b) => b.id - a.id);
  res.json(list);
});

app.get('/api/admin/devices', (req, res) => {
  const list = Object.keys(dbDevices).map(k => ({ device_id: k, ...dbDevices[k] }));
  res.json(list);
});

app.post('/api/admin/add-device', (req, res) => {
  const { device_id, days } = req.body;
  const now = Math.floor(Date.now() / 1000);
  const exp = days > 0 ? now + (days * 24 * 60 * 60) : null;
  dbDevices[device_id] = { key: null, expires_at: exp };
  res.json({ ok: true });
});

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
    dbKeys[newKey] = { id: keyCounter++, expires_at: exp, created_at: now };
    generatedKeys.push(newKey);
  }
  res.json({ ok: true, count: generatedKeys.length, keys: generatedKeys });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('🚀 ShopLink Server chạy thành công!'));
