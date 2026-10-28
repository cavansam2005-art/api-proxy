const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lưu Key trên RAM (kèm ID)
const dbKeys = {};
let keyCounter = 1; // Bộ đếm ID tự động

// Hàm tạo Key ngẫu nhiên
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

  res.json({
    ok: true,
    message: 'Kích hoạt thành công!',
    expires_at: record.expires_at 
  });
});

// ==========================================
// TRANG ADMIN (GIAO DIỆN NÂNG CẤP)
// ==========================================
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admin Dashboard - Quản Lý Key</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg: #0f172a;
          --card: #1e293b;
          --border: #334155;
          --primary: #38bdf8;
          --success: #10b981;
          --danger: #ef4444;
          --text: #f8fafc;
          --text-muted: #94a3b8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body { background: var(--bg); color: var(--text); padding: 20px; display: flex; justify-content: center; }
        
        .container { width: 100%; max-width: 1000px; }
        h1 { font-size: 24px; font-weight: 700; margin-bottom: 20px; text-align: center; color: var(--primary); }

        /* Form tạo key */
        .create-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 12px; padding: 20px; margin-bottom: 25px;
          display: flex; flex-wrap: wrap; gap: 15px; align-items: flex-end;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .input-group { display: flex; flex-direction: column; gap: 6px; }
        .input-group label { font-size: 13px; font-weight: 500; color: var(--text-muted); }
        .input-group input {
          background: #0f172a; border: 1px solid var(--border); color: #fff;
          padding: 10px 12px; border-radius: 8px; font-size: 15px; width: 100px; outline: none; transition: 0.2s;
        }
        .input-group input:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2); }

        .btn-group { display: flex; gap: 10px; flex-wrap: wrap; }
        .btn {
          padding: 10px 16px; border: none; border-radius: 8px;
          font-size: 14px; font-weight: 600; cursor: pointer; transition: 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .btn:active { transform: scale(0.96); }
        .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text); }
        .btn-outline:hover { background: rgba(255,255,255,0.05); }
        .btn-primary { background: var(--success); color: #fff; font-size: 15px; padding: 12px 24px; }
        .btn-primary:hover { background: #059669; }
        .btn-copy-all { background: var(--primary); color: #fff; }
        .btn-copy-all:hover { background: #0284c7; }

        /* Bảng dữ liệu */
        .table-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 12px; overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .table-header { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid var(--border); }
        table { width: 100%; border-collapse: collapse; text-align: left; }
        th, td { padding: 15px; border-bottom: 1px solid var(--border); font-size: 14px; }
        th { background: rgba(255,255,255,0.02); color: var(--text-muted); font-weight: 600; }
        tr:last-child td { border-bottom: none; }
        
        .key-code { font-family: monospace; font-weight: 700; color: #fbbf24; font-size: 15px; }
        .id-badge { background: var(--border); color: var(--text); padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; }
        
        .status { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-block; }
        .status.active { background: rgba(16, 185, 129, 0.15); color: var(--success); }
        .status.expired { background: rgba(239, 68, 68, 0.15); color: var(--danger); }
        .status.never { background: rgba(148, 163, 184, 0.15); color: var(--text-muted); }

        /* Nút Copy nhỏ */
        .btn-copy { background: var(--border); color: var(--text); border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: 0.2s; }
        .btn-copy:active { background: var(--primary); color: #000; }

        @media (max-width: 600px) {
          .create-card { flex-direction: column; align-items: stretch; }
          .input-group input { width: 100%; }
          .btn-group { flex-direction: column; }
          .btn { width: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Quản Lý Key Hệ Thống</h1>
        
        <!-- Form tạo Key -->
        <div class="create-card">
          <div class="input-group">
            <label>Thời hạn (Ngày)</label>
            <input type="number" id="inputDays" value="30" min="0">
          </div>
          <div class="input-group">
            <label>Thời hạn (Giờ)</label>
            <input type="number" id="inputHours" value="0" min="0" max="23">
          </div>
          <div class="input-group">
            <label>Số lượng Key cần tạo</label>
            <input type="number" id="inputQty" value="1" min="1" max="100" style="border-color: var(--success);">
          </div>
          
          <div class="btn-group" style="margin-right: auto;">
            <button class="btn btn-outline" onclick="setTime(1, 0)">1 Ngày</button>
            <button class="btn btn-outline" onclick="setTime(7, 0)">7 Ngày</button>
            <button class="btn btn-outline" onclick="setTime(30, 0)">30 Ngày</button>
            <button class="btn btn-outline" onclick="setTime(0, 0)">Vĩnh viễn</button>
          </div>

          <button class="btn btn-primary" onclick="createNewKey()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Tạo Key
          </button>
        </div>

        <!-- Bảng hiển thị Key -->
        <div class="table-card">
          <div class="table-header">
            <div style="font-weight: 600; font-size: 16px;">Danh sách Key</div>
            <button class="btn btn-copy-all" onclick="copyAllKeys()">📋 Sao chép tất cả</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Key Code</th>
                <th>Trạng Thái</th>
                <th>Hạn Sử Dụng</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody id="keyTableBody">
              <tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Đang tải dữ liệu...</td></tr>
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
            
            if (data.length === 0) return tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Chưa có Key nào được tạo.</td></tr>';
            
            const now = Math.floor(Date.now() / 1000);
            
            tbody.innerHTML = data.map(k => {
              let expiresStr = 'Vĩnh viễn';
              let statusHtml = '<span class="status never">Chưa dùng</span>';
              
              if (k.expires_at) { 
                expiresStr = new Date(k.expires_at * 1000).toLocaleString('vi-VN'); 
                if (now > k.expires_at) { 
                  statusHtml = '<span class="status expired">Hết hạn</span>'; 
                } else {
                  statusHtml = '<span class="status active">Đang chạy</span>';
                }
              } else {
                statusHtml = '<span class="status active">Vĩnh viễn</span>';
              }

              return \`
                <tr>
                  <td><span class="id-badge">#\${k.id}</span></td>
                  <td class="key-code">\${k.key_code}</td>
                  <td>\${statusHtml}</td>
                  <td style="color:var(--text-muted);">\${expiresStr}</td>
                  <td><button class="btn-copy" onclick="copyKey('\${k.key_code}', this)">Sao chép</button></td>
                </tr>
              \`;
            }).join('');
          } catch(e) { 
            document.getElementById('keyTableBody').innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Lỗi tải dữ liệu</td></tr>'; 
          }
        }

        async function createNewKey() {
          const d = parseInt(document.getElementById('inputDays').value) || 0;
          const h = parseInt(document.getElementById('inputHours').value) || 0;
          const qty = parseInt(document.getElementById('inputQty').value) || 1;

          if(qty < 1 || qty > 100) return alert('Số lượng Key phải từ 1 đến 100.');

          try { 
            await fetch(\`/api/admin/genkey?days=\${d}&hours=\${h}&qty=\${qty}\`); 
            loadKeys(); 
          } catch(e) { alert('Lỗi khi tạo Key'); }
        }

        // Hàm copy 1 key
        function copyKey(text, btn) {
          navigator.clipboard.writeText(text).then(() => {
            const oldText = btn.innerText;
            btn.innerText = 'Đã chép!';
            btn.style.background = 'var(--success)';
            btn.style.color = '#fff';
            setTimeout(() => {
              btn.innerText = oldText;
              btn.style.background = '';
              btn.style.color = '';
            }, 1500);
          }).catch(() => alert('Lỗi khi sao chép!'));
        }

        // Hàm copy tất cả key
        async function copyAllKeys() {
          try {
            const res = await fetch('/api/admin/list'); 
            const data = await res.json();
            if (data.length === 0) return alert('Chưa có Key nào để sao chép!');
            
            const allKeys = data.map(k => k.key_code).join('\\n');
            
            navigator.clipboard.writeText(allKeys).then(() => {
              alert(\`Đã sao chép toàn bộ \${data.length} Key vào bộ nhớ tạm!\`);
            }).catch(() => alert('Lỗi khi sao chép!'));
          } catch(e) { alert('Lỗi tải dữ liệu!'); }
        }

        loadKeys();
      </script>
    </body>
    </html>
  `);
});

app.get('/api/admin/list', (req, res) => {
  const list = Object.keys(dbKeys).map(k => ({ key_code: k, ...dbKeys[k] }));
  list.sort((a, b) => b.id - a.id);
  res.json(list);
});

// Cập nhật API tạo Key để hỗ trợ tạo hàng loạt (qty)
app.get('/api/admin/genkey', (req, res) => {
  const days = parseInt(req.query.days) || 0; 
  const hours = parseInt(req.query.hours) || 0;
  const qty = parseInt(req.query.qty) || 1; // Số lượng key muốn tạo
  
  const now = Math.floor(Date.now() / 1000); 
  const total = (days * 24 * 60 * 60) + (hours * 60 * 60);
  const exp = total > 0 ? now + total : null;
  
  let generatedKeys = [];

  for (let i = 0; i < qty; i++) {
    const newKey = generateKey();
    dbKeys[newKey] = { 
      id: keyCounter++, 
      expires_at: exp, 
      created_at: now, 
      device_name: null 
    };
    generatedKeys.push(newKey);
  }
  
  res.json({ ok: true, count: generatedKeys.length, keys: generatedKeys });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('🚀 Server chạy thành công!'));
