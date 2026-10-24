import { menuData } from './menuData.js';
let c=JSON.parse(localStorage.getItem('m_cart'))||[],t=localStorage.getItem('m_tbl')||null;
document.addEventListener('DOMContentLoaded',()=>{init();renTabs();renMenu();updCart();setupBtns();});
function init(){
const p=new URLSearchParams(window.location.search).get('table');
if(p&&p>=1&&p<=6){t=p;localStorage.setItem('m_tbl',t);}
updTbl();if(!t)openTbl();
}
function setupBtns(){
const cont=document.getElementById('table-buttons');if(!cont)return;
let h='';for(let i=1;i<=6;i++)h+=`<button onclick="setTbl(${i})" class="py-3 rounded-xl border font-bold text-base ${t==i?'bg-amber-600 text-white':'bg-stone-50'}">Table ${i}</button>`;
cont.innerHTML=h;
}
window.setTbl=n=>{t=n;localStorage.setItem('m_tbl',n);updTbl();setupBtns();setTimeout(closeTbl,300);};
function updTbl(){const e=document.getElementById('current-table-text');if(e)e.textContent=t?`Table #${t}`:`Select Table`;}
window.openTbl=()=>document.getElementById('table-modal')?.classList.remove('hidden');
window.closeTbl=()=>{if(!t){alert('Select table!');return;}document.getElementById('table-modal')?.classList.add('hidden');}
function renTabs(){
const catContainer=document.getElementById('category-tabs');if(!catContainer)return;
let h=`<button onclick="fCat('ALL')" class="cat-tab px-4 py-2 rounded-full text-xs bg-stone-900 text-white font-semibold" data-cat="ALL">All</button>`;
menuData.forEach(cat=>{h+=`<button onclick="fCat('${cat.category}')" class="cat-tab px-4 py-2 rounded-full text-xs bg-stone-200 text-stone-700 font-semibold" data-cat="${cat.category}">${cat.category}</button>`;});
catContainer.innerHTML=h;
}
window.fCat=cat=>{document.querySelectorAll('.cat-tab').forEach(b=>b.className=`cat-tab px-4 py-2 rounded-full text-xs font-semibold ${b.dataset.cat===cat?'bg-stone-950 text-white shadow':'bg-stone-200 text-stone-700'}`);document.querySelectorAll('.menu-sec').forEach(s=>s.style.display=(cat==='ALL'||s.dataset.category===cat)?'block':'none');}
function renMenu(){
const cont=document.getElementById('menu-container');if(!cont)return;
let h='';menuData.forEach(cat=>{h+=`<div class="menu-sec space-y-3" data-category="${cat.category}"><div class="border-b pb-2 flex justify-between items-center"><h3 class="font-bold font-serif text-stone-900 text-lg">${cat.category}</h3></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
cat.items.forEach(item=>{const ci=c.find(x=>x.name==item.name),q=ci?ci.qty:0,sn=item.name.replace(/'/g,"\\'");h+=`<div class="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 flex flex-col justify-between"><div><h4 class="font-bold text-stone-900 text-sm mb-1">${item.name}</h4><p class="text-xs text-stone-500 mb-3">${item.description}</p></div><div class="flex justify-between items-center pt-2 border-t"><span class="text-amber-700 font-bold">₹${item.price}</span>${q===0?`<button onclick="add('${sn}',${item.price})" class="bg-stone-900 hover:bg-stone-800 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow flex items-center gap-1"><i class="fa-solid fa-plus text-[10px]"></i> Add</button>`:`<div class="flex items-center space-x-2 bg-stone-100 rounded-xl p-1 border border-stone-200"><button onclick="upd('${sn}',-1)" class="w-7 h-7 bg-white rounded-lg shadow text-stone-700 flex items-center justify-center font-bold text-xs"><i class="fa-solid fa-minus"></i></button><span class="w-6 text-center font-bold text-xs">${q}</span><button onclick="upd('${sn}',1)" class="w-7 h-7 bg-amber-600 rounded-lg shadow text-white flex items-center justify-center font-bold text-xs"><i class="fa-solid fa-plus"></i></button></div>`}</div></div>`});h+=`</div></div>`;});cont.innerHTML=h;
}
window.add=(n,p)=>{const x=c.find(x=>x.name==n);if(x)x.qty++;else c.push({name:n,price:p,qty:1});save();};
window.upd=(n,d)=>{const i=c.findIndex(x=>x.name==n);if(i!=-1){c[i].qty+=d;if(c[i].qty<=0)c.splice(i,1);}save();};
function save(){localStorage.setItem('m_cart',JSON.stringify(c));renMenu();updCart();}

function updCart(){
const tQty=c.reduce((s,x)=>s+x.qty,0),sub=c.reduce((s,x)=>s+(x.price*x.qty),0),tax=Math.round(sub*0.05),g=sub+tax;
document.getElementById('cart-count-badge').textContent=tQty;document.getElementById('cart-bar-total').textContent=`₹${g}`;
document.getElementById('cart-bar').classList.toggle('translate-y-full',tQty===0);
document.getElementById('cart-subtotal').textContent=`₹${sub}`;document.getElementById('cart-tax').textContent=`₹${tax}`;document.getElementById('cart-grand-total').textContent=`₹${g}`;
const cont=document.getElementById('cart-items-container');if(!cont)return;
if(c.length===0){cont.innerHTML=`<p class="text-center">Empty</p>`;return;}
let h='';c.forEach(i=>{const sn=i.name.replace(/'/g,"\\'");h+=`<div class="flex justify-between items-center bg-stone-50 p-2 rounded">${i.name} (${i.qty}) <button onclick="upd('${sn}',-1)" class="px-2 bg-stone-200">-</button></div>`;});cont.innerHTML=h;
}
window.toggleCartDrawer = function() {
    const drawer = document.getElementById('cart-drawer');
    if (drawer) {
        drawer.classList.toggle('hidden');
    }
};

window.placeOrder = async function(type) {
    if (!t) { alert('Please select a table number first!'); openTbl(); return; }
    if (c.length === 0) { alert('Your cart is empty!'); return; }

    const name = document.getElementById('cust-name')?.value.trim();
    const phone = document.getElementById('cust-phone')?.value.trim();
    const notes = document.getElementById('cust-notes')?.value.trim() || '';

    if (!name) {
        alert('Please enter your name to place the order.');
        document.getElementById('cust-name')?.focus();
        return;
    }
    if (!phone || phone.length < 10) {
        alert('Please enter a valid 10-digit phone number.');
        document.getElementById('cust-phone')?.focus();
        return;
    }
    const sub = c.reduce((s, x) => s + (x.price * x.qty), 0);
    const tax = Math.round(sub * 0.05);
    const total = sub + tax;

    const orderData = {
        table: t,
        customerName: name,
        customerPhone: phone,
        notes,
        items: c,
        subtotal: sub,
        tax,
        total,
        timestamp: new Date().toISOString()
    };

    if (type === 'whatsapp') {
        let msg = `*🍕 New Order - Mama Mia Artisan Kitchen*%0A`;
        msg += `📍 *Table:* #${t}%0A`;
        msg += `👤 *Customer:* ${name} ${phone ? '(' + phone + ')' : ''}%0A`;
        if (notes) msg += `📝 *Notes:* ${notes}%0A`;
        msg += `-------------------%0A`;
        c.forEach(i => { msg += `• ${i.name} x${i.qty} = ₹${i.price * i.qty}%0A`; });
        msg += `-------------------%0A`;
        msg += `*Subtotal:* ₹${sub}%0A*GST (5%):* ₹${tax}%0A*Grand Total:* ₹${total}%0A`;
        msg += `_Sent via QR Ordering_`;
        window.open(`https://wa.me/918799106267?text=${msg}`, '_blank');
        return;
    }

    try {
        const res = await fetch('/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        const result = await res.json();
        if (res.ok) {
            toggleCartDrawer();
            const modal = document.getElementById('success-modal');
            const msgEl = document.getElementById('success-message');
            const idEl = document.getElementById('success-order-id');
            if (msgEl) msgEl.textContent = `Order sent for Table #${t}!`;
            if (idEl) idEl.textContent = `Order ID: #${result.order?.id || 'N/A'}`;
            if (modal) modal.classList.remove('hidden');
            c = [];
            localStorage.removeItem('m_cart');
            renMenu();
            updCart();
        } else {
            alert('Failed to place order: ' + (result.message || 'Server error'));
        }
    } catch (e) {
        console.error(e);
        alert('Network error while placing order.');
    }
};

window.closeSuccessModal = function() {
    const modal = document.getElementById('success-modal');
    if (modal) modal.classList.add('hidden');
};
