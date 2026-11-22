const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const ordersFile = path.join(__dirname, 'orders.json');
const menuFile = path.join(__dirname, 'menu.json');

function getMenu() {
  if (!fs.existsSync(menuFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(menuFile, 'utf8'));
  } catch (e) {
    console.error('Failed to parse menu.json', e);
    return [];
  }
}

function saveMenu(menu) {
  fs.writeFileSync(menuFile, JSON.stringify(menu, null, 2));
}

// Automatic Cloud Sync via jsonblob.com (Zero setup required by user)
async function getBlobId(key, initialData) {
  let config = {};
  if (fs.existsSync(cloudConfigFile)) {
    try { config = JSON.parse(fs.readFileSync(cloudConfigFile, 'utf8')); } catch(e){}
  }
  if (config[key]) return config[key];

  try {
    const res = await fetch('https://jsonblob.com/api/jsonBlob', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(initialData)
    });
    const location = res.headers.get('location');
    if (location) {
      const blobId = location.split('/').pop();
      config[key] = blobId;
      fs.writeFileSync(cloudConfigFile, JSON.stringify(config, null, 2));
      return blobId;
    }
  } catch (e) {
    console.error('Failed to create cloud blob for ' + key, e);
  }
  return null;
}

async function getCloudData(key, fallbackLocalFile) {
  let localData = [];
  if (fs.existsSync(fallbackLocalFile)) {
    try { localData = JSON.parse(fs.readFileSync(fallbackLocalFile, 'utf8')); } catch(e){}
  }

  const blobId = await getBlobId(key, localData);
  if (blobId) {
    try {
      const res = await fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`);
      if (res.ok) {
        const cloudData = await res.json();
        return cloudData;
      }
    } catch(e) {
      console.error('Failed to fetch from cloud blob ' + key, e);
    }
  }
  return localData;
}

async function saveCloudData(key, data, fallbackLocalFile) {
  fs.writeFileSync(fallbackLocalFile, JSON.stringify(data, null, 2));
  const blobId = await getBlobId(key, data);
  if (blobId) {
    try {
      await fetch(`https://jsonblob.com/api/jsonBlob/${blobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch(e) {
      console.error('Failed to update cloud blob ' + key, e);
    }
  }
}

async function getMenu() {
  return await getCloudData('menu_blob_id', menuFile);
}

// Menu for customer ordering and admin management
app.get('/api/menu', (req, res) => {
  res.json(getMenu());
});

app.put('/api/menu', (req, res) => {
  const menu = req.body;
  if (!Array.isArray(menu)) return res.status(400).json({ status: 'error', message: 'Menu must be an array' });
  if (menu.some(category => !category.category || !Array.isArray(category.items))) {
    return res.status(400).json({ status: 'error', message: 'Invalid menu structure' });
  }
  saveMenu(menu);
  res.json({ status: 'ok', menu });
});

// Get all orders (for Kitchen Display System)
app.get('/api/orders', async (req, res) => {
  res.json(await getOrders());
});

// Create new order
app.post('/order', async (req, res) => {
  const { table, items, total, customerName, customerPhone, notes } = req.body;
  if (!table || !items || items.length === 0) {
    return res.status(400).json({ status: 'error', message: 'Missing table or items' });
  }

  const orders = await getOrders();
  const newOrder = {
    id: 'ORD-' + Date.now().toString().slice(-6),
    table,
    customerName: customerName || 'Guest',
    customerPhone: customerPhone || '',
    notes: notes || '',
    items,
    total,
    status: 'Pending', // Pending -> Preparing -> Completed
    timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  };

  orders.unshift(newOrder); // newest first
  await saveOrders(orders);
  console.log('New order received:', newOrder);

  res.json({ status: 'ok', order: newOrder });
});

// Update order status (KDS)
app.patch('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const orders = await getOrders();
  const order = orders.find(o => o.id === id);

  if (!order) {
    return res.status(404).json({ status: 'error', message: 'Order not found' });
  }

  order.status = status;
  await saveOrders(orders);
  res.json({ status: 'ok', order });
});

// Delete / Cancel order
app.delete('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  let orders = getOrders();
  const initialLen = orders.length;
  orders = orders.filter(o => o.id !== id);
  if (orders.length === initialLen) {
    return res.status(404).json({ status: 'error', message: 'Order not found' });
  }
  saveOrders(orders);
  res.json({ status: 'ok', message: 'Order deleted/cancelled successfully' });
});

function orderDate(order) {
  if (!order.timestamp) return null;
  const d = new Date(order.timestamp);
  if (!isNaN(d.getTime())) {
    return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
  }
  const match = String(order.timestamp || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return { day: Number(day), month: Number(month), year: Number(year) };
}

function buildMonthlyReport(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(month || '');
  if (!match) return null;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) return null;

  const orders = getOrders().filter(order => {
    const date = orderDate(order);
    return date && date.year === year && date.month === monthNumber;
  });
  const itemMap = new Map();
  orders.forEach(order => (order.items || []).forEach(item => {
    const quantity = Number(item.qty) || 0;
    const price = Number(item.price) || 0;
    const current = itemMap.get(item.name) || { name: item.name, quantity: 0, revenue: 0 };
    current.quantity += quantity;
    current.revenue += price * quantity;
    itemMap.set(item.name, current);
  }));
  const completed = orders.filter(order => order.status === 'Completed');
  const totalSales = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  return {
    month,
    orders,
    summary: {
      orderCount: orders.length,
      completedCount: completed.length,
      pendingCount: orders.filter(order => order.status !== 'Completed').length,
      totalSales,
      averageOrderValue: orders.length ? Math.round((totalSales / orders.length) * 100) / 100 : 0,
      itemCount: [...itemMap.values()].reduce((sum, item) => sum + item.quantity, 0)
    },
    items: [...itemMap.values()].sort((a, b) => b.revenue - a.revenue)
  };
}

function pdfText(value) {
  return String(value).split(String.fromCharCode(92)).join(String.fromCharCode(92, 92)).split('(').join('\\(').split(')').join('\\)').replace(/[^\x20-\x7E]/g, '?');
}

function createMonthlyPdf(report) {
  const monthName = new Date(`${report.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const esc = value => pdfText(value);
  const money = value => `Rs ${Number(value || 0).toFixed(2)}`;
  const summary = report.summary;
  const pages = [];
  const pageHeight = 792;
  const left = 42;
  const addPage = () => { const page = []; pages.push(page); return page; };
  let page = addPage();
  let y = 750;
  const text = (value, x, size = 10, color = '0.16 0.12 0.08') => { page.push(`${color} rg BT /F1 ${size} Tf ${x} ${y} Td (${esc(value)}) Tj ET`); };
  const line = (x1, x2, yy, color = '0.82 0.76 0.66', width = 0.7) => page.push(`${color} RG ${width} w ${x1} ${yy} m ${x2} ${yy} l S`);
  const rect = (x, yy, w, h, fill, stroke = fill) => page.push(`${fill} rg ${x} ${yy} ${w} ${h} re f ${stroke} RG ${x} ${yy} ${w} ${h} re S`);
  const nextPage = () => { page = addPage(); y = 750; };
  const ensure = height => { if (y - height < 45) nextPage(); };

  rect(0, 0, 612, pageHeight, '1 0.98 0.94', '1 0.98 0.94');
  rect(0, 700, 612, 92, '0.25 0.10 0.04', '0.25 0.10 0.04');
  text('MAMA MIA', left, 25, '1 0.78 0.18'); y -= 29;
  text('ARTISAN KITCHEN', left, 10, '1 1 1'); y = 748;
  text('MONTHLY SALES REPORT', 370, 14, '1 1 1'); y -= 19;
  text(monthName, 370, 11, '1 0.82 0.45'); y = 675;
  text('Sales overview', left, 15, '0.25 0.10 0.04'); y -= 22;
  const cards = [['TOTAL SALES', money(summary.totalSales)], ['ORDERS', summary.orderCount], ['COMPLETED', summary.completedCount], ['ITEMS SOLD', summary.itemCount]];
  cards.forEach((card, index) => { const x = left + index * 132; rect(x, y - 45, 120, 45, '1 0.93 0.72', '0.88 0.68 0.25'); text(card[0], x + 8, 8, '0.35 0.22 0.08'); y -= 17; text(card[1], x + 8, 14, '0.25 0.10 0.04'); y += 17; });
  y -= 70; text(`Average order value: ${money(summary.averageOrderValue)}    Pending / other: ${summary.pendingCount}`, left, 10, '0.35 0.25 0.15'); y -= 28;

  const tableHeader = (title, columns) => { ensure(35); text(title, left, 14, '0.25 0.10 0.04'); y -= 18; rect(left, y - 18, 528, 20, '0.25 0.10 0.04', '0.25 0.10 0.04'); y -= 14; columns.forEach(column => text(column[0], column[1], 9, '1 1 1')); y -= 16; };
  tableHeader('Item-wise sales', [['Item', left + 8], ['Qty', 430], ['Revenue', 482]]);
  report.items.forEach((item, index) => { ensure(20); if (index % 2 === 0) rect(left, y - 13, 528, 17, '1 0.96 0.88', '1 0.96 0.88'); text(String(item.name).slice(0, 48), left + 8, 9); text(item.quantity, 435, 9); text(money(item.revenue), 480, 9); y -= 17; });
  y -= 18;
  tableHeader('Order details', [['Order ID', left + 8], ['Date', 130], ['Table', 275], ['Status', 335], ['Total', 480]]);
  report.orders.forEach((order, index) => { ensure(20); if (index % 2 === 0) rect(left, y - 13, 528, 17, '1 0.96 0.88', '1 0.96 0.88'); text(String(order.id), left + 8, 8); text(String(order.timestamp || '').slice(0, 10), 130, 8); text(order.table || '-', 280, 8); text(String(order.status || '').slice(0, 13), 335, 8); text(money(order.total), 480, 8); y -= 17; });
  pages.forEach((pageLines, index) => { pageLines.push(`0.45 0.35 0.25 rg BT /F1 8 Tf 42 25 Td (Mama Mia Artisan Kitchen  |  Page ${index + 1} of ${pages.length}) Tj ET`); });

  const objects = []; const add = body => { objects.push(body); return objects.length; };
  const catalog = add(null); const pagesObject = add(null); const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); const pageRefs = [];
  pages.forEach(pageLines => { const stream = ['q', ...pageLines, 'Q'].join('\n'); const content = add(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`); const pageObject = add(`<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`); pageRefs.push(`${pageObject} 0 R`); });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObject} 0 R >>`; objects[pagesObject - 1] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageRefs.length} >>`;
  let pdf = '%PDF-1.4\n'; const offsets = [0]; objects.forEach((object, index) => { offsets[index + 1] = Buffer.byteLength(pdf, 'utf8'); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }); const xref = Buffer.byteLength(pdf, 'utf8'); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`; offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; }); pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`; return Buffer.from(pdf, 'utf8');
}

app.get('/api/reports/monthly', (req, res) => {
  const report = buildMonthlyReport(req.query.month);
  if (!report) return res.status(400).json({ status: 'error', message: 'Month must use YYYY-MM format' });
  res.json(report);
});

app.get('/api/reports/monthly.pdf', (req, res) => {
  const report = buildMonthlyReport(req.query.month);
  if (!report) return res.status(400).send('Month must use YYYY-MM format');
  res.type('application/pdf');
  res.set('Content-Disposition', `attachment; filename="mama-mia-report-${report.month}.pdf"`);
  res.send(createMonthlyPdf(report));
});

app.listen(PORT, () => {
  console.log(`Mama Mia Artisan Kitchen server listening on http://localhost:${PORT}`);
});

