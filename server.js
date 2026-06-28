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
  { name: 'ลุ้น', userId: 'U973b1ff69bcaf1198dcab181dc683580' },
  // มิ้นท์ยังไม่ได้แอด OA เป็นเพื่อน — ปลดคอมเมนต์บรรทัดล่างนี้ตอนแอดแล้ว
  // { name: 'มิ้นท์', userId: 'Ud55af466c22db78f1b14fc1c19265553' },
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

// ---- สร้าง Flex Message ในธีมครีม/น้ำตาล/ส้มของเว็บแอป ----
const THEME = {
  cream: '#FAF3E7',
  card: '#FFFDF9',
  brown: '#6B4226',
  brownDeep: '#4A2D19',
  terracotta: '#C76B3F',
  olive: '#7A8450',
  oliveDeep: '#5C6440',
  line: '#E8DCC8',
};

function buildItemRow(item) {
  // แถบ % สต๊อกเหลือ ใช้สีตามสถานะ
  const pct = Math.max(0, Math.min(100, item.pct));
  const barColor = pct < 50 ? THEME.terracotta : THEME.olive;
  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    margin: 'md',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: item.emoji, flex: 0, size: 'lg' },
          {
            type: 'text',
            text: item.name,
            flex: 1,
            weight: 'bold',
            size: 'sm',
            color: THEME.brownDeep,
            wrap: true,
            margin: 'sm',
          },
          {
            type: 'text',
            text: item.need + ' ' + item.unit,
            flex: 0,
            size: 'sm',
            weight: 'bold',
            color: THEME.terracotta,
            align: 'end',
          },
        ],
      },
      {
        // แถบ % สต๊อกเหลือ จำลองด้วย box ซ้อนกัน (พื้นหลังเทาอ่อน + แถบสีทับตามเปอร์เซ็นต์)
        type: 'box',
        layout: 'vertical',
        height: '6px',
        backgroundColor: THEME.line,
        cornerRadius: '3px',
        margin: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            height: '6px',
            width: pct + '%',
            backgroundColor: barColor,
            cornerRadius: '3px',
            contents: [],
          },
        ],
      },
    ],
  };
}

function buildFlexMessage(summary) {
  const { workerName, checkedAt, items, total, allGood } = summary;

  const bodyContents = [];

  // หัวข้อย่อยใน body
  bodyContents.push({
    type: 'text',
    text: allGood ? 'สต๊อกพอใช้ทั้งหมด' : 'ต้องซื้อเพิ่ม ' + items.length + ' รายการ',
    weight: 'bold',
    size: 'md',
    color: allGood ? THEME.oliveDeep : THEME.brownDeep,
  });

  if (!allGood) {
    items.forEach((item) => {
      bodyContents.push(buildItemRow(item));
    });
  } else {
    bodyContents.push({
      type: 'text',
      text: 'ไม่ต้องสั่งซื้อเพิ่มในรอบนี้',
      size: 'sm',
      color: THEME.brown,
      margin: 'md',
      wrap: true,
    });
  }

  const bubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: THEME.brownDeep,
      paddingAll: '20px',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '📦', flex: 0, size: 'xl' },
            {
              type: 'text',
              text: 'อัปเดตวัตถุดิบเรียบร้อยแล้ว!!',
              flex: 1,
              weight: 'bold',
              size: 'md',
              color: THEME.cream,
              wrap: true,
              margin: 'sm',
            },
          ],
        },
        workerName
          ? {
              type: 'text',
              text: 'เช็กโดย: ' + workerName,
              size: 'xs',
              color: THEME.cream,
              margin: 'md',
            }
          : { type: 'filler' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      backgroundColor: THEME.cream,
      contents: bodyContents,
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: THEME.card,
      paddingAll: '20px',
      borderColor: THEME.line,
      borderWidth: '1px',
      contents: [
        { type: 'separator', margin: 'none', color: THEME.line },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            { type: 'text', text: 'ยอดรวมที่ต้องซื้อ', size: 'sm', color: THEME.brown, flex: 1, gravity: 'center' },
            {
              type: 'text',
              text: allGood ? '0.00 ฿' : total.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ฿',
              size: 'lg',
              weight: 'bold',
              color: THEME.terracotta,
              align: 'end',
              flex: 1,
            },
          ],
        },
        { type: 'text', text: checkedAt, size: 'xxs', color: THEME.brown, margin: 'md', align: 'end' },
      ],
    },
  };

  return bubble;
}

// Webhook สำหรับตรวจสอบ User ID ที่ถูกต้อง — ตั้ง URL นี้ใน LINE Developers Console
// (Messaging API > Webhook settings > Webhook URL = https://your-app.onrender.com/webhook)
// พิมพ์อะไรในแชท OA แล้วมาดู Render Logs จะเห็น userId ที่ถูกต้อง 100%
app.post('/webhook', (req, res) => {
  try {
    const events = req.body.events || [];
    events.forEach((event) => {
      console.log('[webhook] >>> userId:', event.source && event.source.userId, '| type:', event.type, '| text:', event.message && event.message.text);
    });
  } catch (err) {
    console.log('[webhook] parse error:', String(err));
  }
  res.status(200).send('OK');
});

app.post('/send-summary', async (req, res) => {
  console.log('[send-summary] Request received at', new Date().toISOString());
  try {
    if (!CHANNEL_ACCESS_TOKEN) {
      console.log('[send-summary] ERROR: No token configured');
      return res.status(500).json({
        ok: false,
        error: 'ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN บนเซิร์ฟเวอร์ (ตั้งใน Environment Variables ของ Render)',
      });
    }

    const { summary, message } = req.body;

    let lineMessage;
    if (summary && typeof summary === 'object') {
      // โหมดใหม่: สร้าง Flex Message จาก structured data
      try {
        const flexContents = buildFlexMessage(summary);
        const altText = message || 'สรุปสต๊อกวัตถุดิบ';
        lineMessage = { type: 'flex', altText: altText.slice(0, 400), contents: flexContents };
      } catch (err) {
        console.log('[send-summary] Flex build error, falling back to text:', String(err));
        lineMessage = { type: 'text', text: message || 'สรุปสต๊อกวัตถุดิบ' };
      }
    } else if (message && typeof message === 'string' && message.trim()) {
      // โหมดเดิม: plain text (เผื่อความเข้ากันได้กับเวอร์ชันเก่า)
      lineMessage = { type: 'text', text: message };
    } else {
      console.log('[send-summary] ERROR: No summary or message in body');
      return res.status(400).json({ ok: false, error: 'ไม่พบข้อมูลสรุปที่จะส่ง (summary หรือ message)' });
    }

    console.log('[send-summary] Sending to', OWNERS.length, 'owners. Type:', lineMessage.type);

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
              messages: [lineMessage],
            }),
          });

          if (!resp.ok) {
            const errText = await resp.text();
            console.log('[send-summary] FAILED for', owner.name, '- status:', resp.status, '- body:', errText);
            return { owner: owner.name, ok: false, status: resp.status, error: errText };
          }
          console.log('[send-summary] SUCCESS for', owner.name);
          return { owner: owner.name, ok: true };
        } catch (err) {
          console.log('[send-summary] EXCEPTION for', owner.name, '-', String(err));
          return { owner: owner.name, ok: false, error: String(err) };
        }
      })
    );

    const allOk = results.every((r) => r.ok);
    console.log('[send-summary] Done. allOk:', allOk);
    res.status(allOk ? 200 : 207).json({ ok: allOk, results });
  } catch (err) {
    console.error('[send-summary] UNCAUGHT ERROR:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LINE relay server listening on port ${PORT}`);
  console.log(`Token configured: ${Boolean(CHANNEL_ACCESS_TOKEN)}`);
});
