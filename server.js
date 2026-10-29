const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(cors());
app.use(express.json());

// Cấu hình lưu trữ file
const upload = multer({ dest: 'uploads/' });
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Cơ sở dữ liệu tạm trên RAM
const dbUsers = {
  "SAMM X MODZ": { password: "123456", role: "admin", bio: "Chào mừng bạn đến với web của chúng tôi. AE cần gì hãy liên hệ từ bot trong app nhé. Hiện tại web của chúng tôi đang cập nhật file cho ae sài an toàn bảo mật cao nhé. Chúc ae tìm file mình thích nha!", author: "VAN SAM" }
};
const dbDevices = {}; // Lưu ID thiết bị truy cập
const dbMods = []; // Lưu danh sách file mod
const dbOrders = {}; // Lưu lịch sử tải file của từng user

// 1. API Ghi nhận ID Thiết bị khi truy cập
app.post('/api/track-device', (req, res) => {
  const { device_id } = req.body;
  if (device_id) {
    dbDevices[device_id] = { last_seen: new Date().toLocaleString('vi-VN') };
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: 'No device ID' });
  }
});

// 2. API Đăng nhập
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = dbUsers[username];
  if (user && user.password === password) {
    res.json({ success: true, username: username, bio: user.bio, author: user.author, role: user.role });
  } else {
    res.json({ success: false, error: 'Sai tài khoản hoặc mật khẩu!' });
  }
});

// 3. API Đăng ký
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (dbUsers[username]) return res.json({ success: false, error: 'Tài khoản đã tồn tại!' });
  dbUsers[username] = { password: password, role: "user" };
  dbOrders[username] = [];
  res.json({ success: true, message: 'Đăng ký thành công!' });
});

// 4. API Lấy danh sách Mod
app.get('/api/mods', (req, res) => {
  res.json(dbMods);
});

// 5. API Admin Upload File Mod
app.post('/api/admin/upload', upload.single('modfile'), (req, res) => {
  const { title, author } = req.body;
  if (!req.file) return res.status(400).json({ error: 'Không có file!' });

  const newMod = {
    id: Date.now().toString(),
    title: title,
    author: author || 'VAN SAM',
    filename: req.file.originalname,
    filepath: req.file.filename,
    size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
    date: new Date().toLocaleString('vi-VN')
  };
  dbMods.unshift(newMod);
  res.json({ success: true, message: 'Upload thành công!', mod: newMod });
});

// 6. API Tải File và Lưu Đơn Hàng
app.get('/api/download/:id', (req, res) => {
  const { id } = req.params;
  const { username } = req.query;
  const mod = dbMods.find(m => m.id === id);

  if (mod) {
    if (username && dbOrders[username]) {
      dbOrders[username].unshift({ title: mod.title, date: new Date().toLocaleString('vi-VN') });
    }
    res.download(path.join(__dirname, 'uploads', mod.filepath), mod.filename);
  } else {
    res.status(404).send('File không tồn tại!');
  }
});

// 7. API Lấy Đơn Hàng của User
app.get('/api/orders/:username', (req, res) => {
  res.json(dbOrders[req.params.username] || []);
});

// 8. Trang Admin
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Admin - SAMM X MOD WEB</title>
      <style>
        body { font-family: sans-serif; background: #0a0a0c; color: #fff; padding: 20px; }
        .container { max-width: 900px; margin: 0 auto; }
        h1 { color: #25f4ee; text-align: center; }
        .box { background: #1a1a20; padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #333; }
        input, button { padding: 10px; border-radius: 8px; border: 1px solid #333; background: #000; color: #fff; margin: 5px 0; width: 100%; box-sizing: border-box; }
        button { background: #10b981; font-weight: bold; cursor: pointer; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 10px; border-bottom: 1px solid #333; text-align: left; }
        th { color: #888; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Quản Trị Server</h1>
        
        <div class="box">
          <h3>Upload File Mod Mới</h3>
          <form id="uploadForm">
            <input type="text" id="modTitle" placeholder="Tên File Mod (VD: Mod Nhân Vật Alok)" required>
            <input type="text" id="modAuthor" placeholder="Tác giả (Mặc định: VAN SAM)">
            <input type="file" id="modFile" required>
            <button type="submit">Tải Lên Server</button>
          </form>
          <p id="uploadStatus" style="color: #25f4ee;"></p>
        </div>

        <div class="box">
          <h3>Thiết bị đã truy cập (${Object.keys(dbDevices).length})</h3>
          <table>
            <tr><th>ID Thiết Bị</th><th>Lần cuối truy cập</th></tr>
            ${Object.keys(dbDevices).map(k => `<tr><td>${k}</td><td>${dbDevices[k].last_seen}</td></tr>`).join('')}
          </table>
        </div>

        <div class="box">
          <h3>Danh sách File Mod (${dbMods.length})</h3>
          <table>
            <tr><th>Tên</th><th>Dung lượng</th><th>Ngày tạo</th></tr>
            ${dbMods.map(m => `<tr><td>${m.title}</td><td>${m.size}</td><td>${m.date}</td></tr>`).join('')}
          </table>
        </div>
      </div>
      <script>
        document.getElementById('uploadForm').onsubmit = async (e) => {
          e.preventDefault();
          const formData = new FormData();
          formData.append('title', document.getElementById('modTitle').value);
          formData.append('author', document.getElementById('modAuthor').value);
          formData.append('modfile', document.getElementById('modFile').files[0]);
          
          const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.success) {
            document.getElementById('uploadStatus').innerText = 'Upload thành công!';
            setTimeout(() => location.reload(), 1000);
          } else {
            document.getElementById('uploadStatus').innerText = 'Lỗi: ' + data.error;
          }
        };
      </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('🚀 SAMM X MOD SERVER chạy thành công!'));
