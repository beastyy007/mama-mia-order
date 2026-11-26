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
const callsFile = path.join(__dirname, 'calls.json');
const cloudConfigFile = path.join(__dirname, 'cloud-config.json');

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
  } catch (e) { console.error('getBlobId error:', e.message); }
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
      const res = await fetch('https://jsonblob.com/api/jsonBlob/' + blobId);
      if (res.ok) return await res.json();
    } catch(e) { console.error('getCloudData error:', e.message); }
  }
  return localData;
}

async function saveCloudData(key, data, fallbackLocalFile) {
  fs.writeFileSync(fallbackLocalFile, JSON.stringify(data, null, 2));
  const blobId = await getBlobId(key, data);
  if (blobId) {
    try {
      await fetch('https://jsonblob.com/api/jsonBlob/' + blobId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch(e) { console.error('saveCloudData error:', e.message); }
  }
}

const getMenu    = () => getCloudData('menu_blob_id',   menuFile);
const saveMenu   = m  => saveCloudData('menu_blob_id',   m, menuFile);
const getOrders  = () => getCloudData('orders_blob_id', ordersFile);
const saveOrders = o  => saveCloudData('orders_blob_id', o, ordersFile);
const getCalls   = () => getCloudData('calls_blob_id',  callsFile);
const saveCalls  = c  => saveCloudData('calls_blob_id',  c, callsFile);

// MENU APIs
app.get('/api/menu', async (req, res) => { res.json(await getMenu()); });
app.put('/api/menu', async (req, res) => {
  const menu = req.body;
  if (!Array.isArray(menu)) return res.status(400).json({ status: 'error', message: 'Menu must be an array' });
  await saveMenu(menu);
  res.json({ status: 'ok', menu });
});

// ORDER APIs
app.get('/api/orders', async (req, res) => { res.json(await getOrders()); });
app.post('/order', async (req, res) => {
  const { table, items, total, customerName, customerPhone, notes } = req.body;
  if (!table || !items || items.length === 0) return res.status(400).json({ status: 'error', message: 'Missing table or items' });
  const orders = await getOrders();
  const newOrder = {
    id: 'ORD-' + Date.now().toString().slice(-6),
    table, customerName: customerName || 'Guest', customerPhone: customerPhone || '',
    notes: notes || '', items, total, status: 'Pending',
    timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  };
  orders.unshift(newOrder);
  await saveOrders(orders);
  res.json({ status: 'ok', order: newOrder });
});
app.patch('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params; const { status } = req.body;
  const orders = await getOrders();
  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ status: 'error', message: 'Order not found' });
  order.status = status; await saveOrders(orders);
  res.json({ status: 'ok', order });
});
app.delete('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  let orders = await getOrders();
  const before = orders.length;
  orders = orders.filter(o => o.id !== id);
  if (orders.length === before) return res.status(404).json({ status: 'error', message: 'Order not found' });
  await saveOrders(orders);
  res.json({ status: 'ok', message: 'Order deleted successfully' });
});

// CALL TO TABLE APIs
app.get('/api/calls', async (req, res) => { res.json(await getCalls()); });
app.post('/api/calls', async (req, res) => {
  const { table, reason } = req.body;
  if (!table) return res.status(400).json({ status: 'error', message: 'Table is required' });
  const calls = await getCalls();
  const newCall = {
    id: 'CALL-' + Date.now().toString().slice(-6),
    table, reason: reason || 'Assistance requested',
    timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
  };
  calls.unshift(newCall);
  await saveCalls(calls);
  res.json({ status: 'ok', call: newCall });
});
app.delete('/api/calls/:id', async (req, res) => {
  const { id } = req.params;
  let calls = await getCalls();
  calls = calls.filter(c => c.id !== id);
  await saveCalls(calls);
  res.json({ status: 'ok' });
});

// MONTHLY REPORT
function orderDate(order) {
  if (!order.timestamp) return null;
  const d = new Date(order.timestamp);
  if (!isNaN(d.getTime())) return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
  const m = String(order.timestamp).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) };
}
app.get('/api/reports/monthly', async (req, res) => {
  const matched = /^(\d{4})-(\d{2})$/.exec(req.query.month || '');
  if (!matched) return res.status(400).json({ status: 'error', message: 'Month must use YYYY-MM format' });
  const year = Number(matched[1]), monthNum = Number(matched[2]);
  const allOrders = await getOrders();
  const orders = allOrders.filter(o => { const d = orderDate(o); return d && d.year === year && d.month === monthNum; });
  const itemMap = new Map();
  orders.forEach(o => (o.items || []).forEach(item => {
    const qty = Number(item.qty) || 0, price = Number(item.price) || 0;
    const cur = itemMap.get(item.name) || { name: item.name, quantity: 0, revenue: 0 };
    cur.quantity += qty; cur.revenue += price * qty; itemMap.set(item.name, cur);
  }));
  const totalSales = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  res.json({
    month: req.query.month, orders,
    summary: { orderCount: orders.length,
      completedCount: orders.filter(o => o.status === 'Completed').length,
      pendingCount: orders.filter(o => o.status !== 'Completed').length,
      totalSales, averageOrderValue: orders.length ? Math.round((totalSales / orders.length) * 100) / 100 : 0,
      itemCount: [...itemMap.values()].reduce((s, i) => s + i.quantity, 0) },
    items: [...itemMap.values()].sort((a, b) => b.revenue - a.revenue)
  });
});

app.listen(PORT, () => { console.log('Mama Mia server running on http://localhost:' + PORT); });
