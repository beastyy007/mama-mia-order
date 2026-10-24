# Mama Mia Artisan Kitchen - Online Ordering

This is a full‑stack prototype for QR‑code based ordering.

## Project structure
```
restaurant-order-app/
├─ server.js            # Node/Express backend
├─ package.json         # npm dependencies
├─ public/
│   ├─ index.html       # Main page (Tailwind CDN)
│   ├─ app.js           # Front‑end logic (menu, cart, order)
│   ├─ menuData.js      # Menu items as JSON
│   └─ style.css        # Optional extra styles
└─ README.md            # Setup & run instructions
```

## How to run
1. Install Node.js (>=14).
2. Open a terminal in `restaurant-order-app` folder.
3. Run `npm install`.
4. Run `node server.js` (or `npm start`).
5. Open a browser at `http://localhost:3000/?table=1` (change the table value as needed).

The page will detect the `table` query‑parameter, display the categorized menu, allow the user to add items to a cart, and submit the order.

When an order is placed the backend receives a JSON payload and saves it to `orders.json` (for demo) and logs it to the console. You can replace the saving logic with a real KDS, database, or WhatsApp integration.

---

### What’s next?
- Deploy to a cloud service (e.g., Vercel, Railway, Render) – only the `server.js` part needs a Node environment.
- Hook the order endpoint to Firebase Functions / Firestore for real‑time updates.
- Add authentication if you need staff‑only order views.
- Replace the console‑log / file‑write with a Twilio WhatsApp API call for WhatsApp notifications.

---

Feel free to customize the design, add images, or integrate a payment gateway.
