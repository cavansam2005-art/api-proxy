const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/whoami', (req, res) => {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);
  res.json({ ip: ip || "127.0.0.1" });
});

app.post('/submit', (req, res) => {
  res.json({ message: 'Kích hoạt thành công!', expires_at: Math.floor(Date.now()/1000) + 86400, duration: '1 Ngày', aims: [], vip_gamevars: [] });
});

app.get('/admin', (req, res) => {
  res.send('<h1 style="color:white;background:black;text-align:center;padding:50px;">SERVER ĐANG HOẠT ĐỘNG TỐT!</h1>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('🚀 Server đang chạy!'));
