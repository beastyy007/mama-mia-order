const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const ordersFile = path.join(__dirname, 'orders.json');

function getOrders() {
  if (!fs.existsSync(ordersFile)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
  } catch (e) {
    console.error('Failed to parse orders.json', e);
    return [];
  }
}

function saveOrders(orders) {
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
}

// Get all orders (for Kitchen Display System)
app.get('/api/orders', (req, res) => {
  res.json(getOrders());
});

// Create new order
app.post('/order', (req, res) => {
  const { table, items, total, customerName, customerPhone, notes } = req.body;
  if (!table || !items || items.length === 0) {
    return res.status(400).json({ status: 'error', message: 'Missing table or items' });
  }

  const orders = getOrders();
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
  saveOrders(orders);
  console.log('New order received:', newOrder);

  res.json({ status: 'ok', order: newOrder });
});

// Update order status (KDS)
app.patch('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const orders = getOrders();
  const order = orders.find(o => o.id === id);

  if (!order) {
    return res.status(404).json({ status: 'error', message: 'Order not found' });
  }

  order.status = status;
  saveOrders(orders);
  res.json({ status: 'ok', order });
});

app.listen(PORT, () => {
  console.log(`Mama Mia Artisan Kitchen server listening on http://localhost:${PORT}`);
});

