const express = require('express');
const cors = require('cors');
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

// ==========================================
// TRANG ADMIN (GỘP CHUNG VÀO SERVER)
// ==========================================
app.get('/admin', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background: #0f172a; color: #fff; padding: 20px; }
    .container { max-width: 1000px; margin: 0 auto; }
    h1 { color: #38bdf8; text-align: center; }
    .create-card { background: #1e293b; padding: 20px; border-radius: 12px; display: flex; gap: 15px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 20px; }
    .input-group { display: flex; flex-direction: column; gap: 5px; }
    .input-group label { font-size: 13px; color: #94a3b8; }
    .input-group input { padding: 10px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #fff; width: 100px; outline: none; }
    .btn-group { display: flex; gap: 10px; flex-wrap: wrap; }
    .btn { padding: 10px 15px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: 0.2s;}
    .btn:active { transform: scale(0.96); }
    .btn-outline { background: transparent; border: 1px solid #334155; color: #fff; }
    .btn-primary { background: #10b981; color: #fff; font-size: 15px; padding: 12px 24px;}
    .btn-copy { background: #38bdf8; color: #fff; }
    .table-card { background: #1e293b; border-radius: 12px; overflow: hidden; }
    .table-header { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #334155; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 15px; border-bottom: 1px solid #334155; text-align: left; font-size: 14px; }
    th { color: #94a3b8; background: rgba(255,255,255,0.02); }
    .key-code { font-family: monospace; color: #fbbf24; font-weight: 700; font-size: 15px; }
    .id-badge { background: #334155; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; }
    @media(max-width: 600px) { 
      .create-card { flex-direction: column; align-items: stretch; } 
      .input-group input { width: 100%; } 
      .btn-group { flex-direction: column; width: 100%; } 
      .btn { width: 100%; } 
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Quản Lý Key Hệ Thống</h1>
    <div class="create-card">
      <div class="input-group"><label>Ngày</label><input type="number" id="inputDays" value="30"></div>
      <div class="input-group"><label>Giờ</label><input type="number" id="inputHours" value="0"></div>
      <div class="input-group"><label>Số lượng</label><input type="number" id="inputQty" value="1" style="border-color: #10b981;"></div>
      <div class="btn-group" style="margin-right: auto;">
        <button class="btn btn-outline" onclick="setTime(1,0)">1 Ngày</button>
        <button class="btn btn-outline" onclick="setTime(7,0)">7 Ngày</button>
        <button class="btn btn-outline" onclick="setTime(30,0)">30 Ngày</button>
        <button class="btn btn-outline" onclick="setTime(0,0)">Vĩnh viễn</button>
      </div>
      <button class="btn btn-primary" onclick="createNewKey()">+ Tạo Key</button>
    </div>

    <div class="table-card">
      <div class="table-header">
        <div style="font-weight:600;">Danh sách Key</div>
        <button class="btn btn-copy" onclick="copyAllKeys()">📋 Sao chép tất cả</button>
      </div>
      <table>
        <thead><tr><th>ID</th><th>Key Code</th><th>Hạn Sử Dụng</th><th>Hành động</th></tr></thead>
        <tbody id="keyTableBody">
          <tr><td colspan="4" style="text-align:center;">Đang tải dữ liệu...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <script>
    function setTime(d, h) { 
      document.getElementById('inputDays').value = d; 
      document.getElementById('inputHours').value = h; 
    }

    async function loadKeys() {
      try {
        const res = await fetch('/api/admin/list'); 
        const data = await res.json();
        const tbody = document.getElementById('keyTableBody');
        
        if (data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">Chưa có Key nào được tạo.</td></tr>';
          return;
        }
        
        const now = Math.floor(Date.now() / 1000);
        
        tbody.innerHTML = data.map(k => {
          let expiresStr = 'Vĩnh viễn';
          if (k.expires_at) { 
            expiresStr = new Date(k.expires_at * 1000).toLocaleString('vi-VN'); 
          }
          return '<tr>' +
            '<td><span class="id-badge">#' + k.id + '</span></td>' +
            '<td class="key-code">' + k.key_code + '</td>' +
            '<td>' + expiresStr + '</td>' +
            '<td><button class="btn btn-outline" onclick="copyKey(\\'' + k.key_code + '\\', this)">Sao chép</button></td>' +
          '</tr>';
        }).join('');
      } catch(e) { 
        document.getElementById('keyTableBody').innerHTML = '<tr><td colspan="4" style="color:red; text-align:center;">Lỗi tải dữ liệu</td></tr>'; 
      }
    }

    async function createNewKey() {
      const d = parseInt(document.getElementById('inputDays').value) || 0;
      const h = parseInt(document.getElementById('inputHours').value) || 0;
      const q = parseInt(document.getElementById('inputQty').value) || 1;

      if(q < 1 || q > 100) return alert('Số lượng Key phải từ 1 đến 100.');

      try { 
        await fetch('/api/admin/genkey?days=' + d + '&hours=' + h + '&qty=' + q); 
        loadKeys(); 
      } catch(e) { alert('Lỗi khi tạo Key'); }
    }

    // Hàm copy 1 key (Đã tối ưu cho điện thoại)
    function copyKey(text, btn) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed"; textArea.style.left = "-9999px"; textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus(); textArea.select();
        textArea.setSelectionRange(0, 99999); // Fix cho iOS
        document.execCommand('copy');
        textArea.remove();

        const oldText = btn.innerText;
        btn.innerText = 'Đã chép!';
        btn.style.background = '#10b981'; btn.style.color = '#fff'; btn.style.borderColor = '#10b981';
        setTimeout(() => {
          btn.innerText = oldText;
          btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = '';
        }, 1500);
      } catch (err) { alert('Lỗi khi sao chép!'); }
    }

    // Hàm copy tất cả (Đã tối ưu cho điện thoại)
    async function copyAllKeys() {
      try {
        const res = await fetch('/api/admin/list'); 
        const data = await res.json();
        if (data.length === 0) return alert('Chưa có Key nào để sao chép!');
        
        // Nối các Key bằng dấu xuống dòng
        const allKeys = data.map(k => k.key_code).join('\\n');
        
        const textArea = document.createElement("textarea");
        textArea.value = allKeys;
        textArea.style.position = "fixed"; textArea.style.left = "-9999px"; textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus(); 
        textArea.select();
        textArea.setSelectionRange(0, 99999); // Fix cho iOS
        document.execCommand('copy');
        textArea.remove();

        alert('Đã sao chép toàn bộ ' + data.length + ' Key vào bộ nhớ tạm! Hãy dán ra để kiểm tra.');
      } catch(e) { alert('Lỗi tải dữ liệu!'); }
    }

    loadKeys();
  </script>
</body>
</html>`;
  res.send(html);
});

// ==========================================
// API LẤY DANH SÁCH & TẠO KEY
// ==========================================
app.get('/api/admin/list', (req, res) => {
  const list = Object.keys(dbKeys).map(k => ({ key_code: k, ...dbKeys[k] }));
  list.sort((a, b) => b.id - a.id);
  res.json(list);
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
    dbKeys[newKey] = { id: keyCounter++, expires_at: exp, created_at: now, device_name: null };
    generatedKeys.push(newKey);
  }
  res.json({ ok: true, count: generatedKeys.length, keys: generatedKeys });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('🚀 Server chạy thành công!'));
