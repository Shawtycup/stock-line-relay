// server.js
// เซิร์ฟเวอร์ตัวกลาง รับสรุปสต๊อกจากเว็บแอป แล้วส่งเข้า LINE ให้ owner ทั้งสองคนพร้อมกัน
// Channel Access Token อ่านจาก Environment Variable เท่านั้น ไม่ฝังในโค้ด

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// รายชื่อ Owner ที่จะส่งสรุปให้ (User ID จาก LINE)
const OWNERS = [
  { name: 'ลุ้น', userId: 'U98fd362e047d7f969e0f0803639677fa' },
  { name: 'มิ้นท์', userId: 'Ud55af466c22db78f1b14fc1c19265553' },
];

// อนุญาตให้เรียกได้จากโดเมนเว็บแอปของคุณเท่านั้น (ใส่โดเมนจริงตอน deploy ถ้าต้องการเข้มงวดขึ้น)
// const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

app.get('/', (req, res) => {
  res.send('LINE stock-summary relay is running.');
});

// healthcheck
app.get('/health', (req, res) => {
  res.json({ ok: true, tokenConfigured: Boolean(CHANNEL_ACCESS_TOKEN) });
});

app.post('/send-summary', async (req, res) => {
  try {
    if (!CHANNEL_ACCESS_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: 'ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN บนเซิร์ฟเวอร์ (ตั้งใน Environment Variables ของ Render)',
      });
    }

    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ ok: false, error: 'ไม่พบข้อความสรุปที่จะส่ง (message)' });
    }

    // ส่งให้ owner ทุกคนพร้อมกัน
    const results = await Promise.all(
      OWNERS.map(async (owner) => {
        try {
          const resp = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
              to: owner.userId,
              messages: [{ type: 'text', text: message }],
            }),
          });

          if (!resp.ok) {
            const errText = await resp.text();
            return { owner: owner.name, ok: false, status: resp.status, error: errText };
          }
          return { owner: owner.name, ok: true };
        } catch (err) {
          return { owner: owner.name, ok: false, error: String(err) };
        }
      })
    );

    const allOk = results.every((r) => r.ok);
    res.status(allOk ? 200 : 207).json({ ok: allOk, results });
  } catch (err) {
    console.error('send-summary error:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LINE relay server listening on port ${PORT}`);
  console.log(`Token configured: ${Boolean(CHANNEL_ACCESS_TOKEN)}`);
});
