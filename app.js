// Isi dua nilai ini dari Supabase: Project Settings > API.
const SUPABASE_URL = "https://hoenjhydoxbumgwshpii.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_dTpDaRSrsJJJz9KczDT19A_wMdEaWu5";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);
const rupiah = (n) => new Intl.NumberFormat("id-ID", {style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n||0));
const dateTime = (v) => new Date(v).toLocaleString("id-ID",{dateStyle:"short",timeStyle:"short"});
let products = [], cart = [], sales = [];

function showMessage(id, msg, isError=true){ const el=$(id); el.textContent=msg; el.style.color=isError?"#a51f2b":"#19734b"; }
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

async function init(){
  $("todayText").textContent = new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const {data:{session}} = await db.auth.getSession();
  if(session) await enterApp(session.user);
  db.auth.onAuthStateChange(async (_event, session) => {
    if(session) await enterApp(session.user);
    else { $("appView").classList.add("hidden"); $("loginView").classList.remove("hidden"); }
  });
}
async function enterApp(user){
  $("loginView").classList.add("hidden"); $("appView").classList.remove("hidden");
  $("userEmail").textContent=user.email||"Pengguna";
  await Promise.all([loadProducts(),loadDashboard(),loadSales()]);
}
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault(); showMessage("loginMessage","Memeriksa akun...",false);
  const {error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
  showMessage("loginMessage",error?error.message:"Berhasil masuk.",!error);
});
$("logoutBtn").addEventListener("click",()=>db.auth.signOut());

function navigate(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
  $("page-"+page).classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  $("pageTitle").textContent={dashboard:"Dashboard",kasir:"Kasir / POS",produk:"Data Barang",riwayat:"Riwayat Penjualan"}[page];
  if(page==="dashboard") loadDashboard();
  if(page==="produk") renderProducts();
  if(page==="kasir") renderPicker();
  if(page==="riwayat") loadSales();
}
document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.goto)));

async function loadProducts(){
  const {data,error}=await db.from("products").select("*").eq("is_active",true).order("name");
  if(error){alert("Gagal memuat barang: "+error.message);return;}
  products=data||[]; renderProducts(); renderPicker();
}
function renderProducts(){
  $("productRows").innerHTML=products.map(p=>`<tr><td><b>${escapeHtml(p.name)}</b><br><small>${escapeHtml(p.barcode||"")}</small></td><td>${escapeHtml(p.category||"-")}</td><td>${rupiah(p.cost_price)}</td><td>${rupiah(p.sell_price)}</td><td>${p.stock} ${escapeHtml(p.unit)}</td><td>${p.min_stock}</td><td><span class="pill ${p.stock<=p.min_stock?"low":""}">${p.stock<=p.min_stock?"Menipis":"Aman"}</span></td></tr>`).join("");
}
$("productForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const payload={name:$("pName").value.trim(),barcode:$("pBarcode").value.trim()||null,category:$("pCategory").value.trim()||null,unit:$("pUnit").value.trim(),cost_price:Number($("pCost").value),sell_price:Number($("pPrice").value),stock:Number($("pStock").value),min_stock:Number($("pMinStock").value)};
  if(payload.sell_price<0||payload.cost_price<0||payload.stock<0){alert("Nilai tidak boleh negatif.");return;}
  const {error}=await db.from("products").insert(payload);
  if(error){alert("Gagal menyimpan: "+error.message);return;}
  e.target.reset(); $("pUnit").value="pcs"; $("pStock").value="0"; $("pMinStock").value="5";
  await loadProducts(); await loadDashboard(); alert("Barang berhasil disimpan.");
});

function renderPicker(){
  const q=($("productSearch").value||"").toLowerCase();
  const filtered=products.filter(p=>p.name.toLowerCase().includes(q)||(p.barcode||"").toLowerCase().includes(q));
  $("productGrid").innerHTML=filtered.map(p=>`<button class="product-tile" data-add="${p.id}" ${p.stock<=0?"disabled":""}><b>${escapeHtml(p.name)}</b><span>Stok: ${p.stock} ${escapeHtml(p.unit)}</span><strong>${rupiah(p.sell_price)}</strong></button>`).join("")||'<p class="muted">Barang tidak ditemukan.</p>';
  document.querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>addToCart(b.dataset.add)));
}
$("productSearch").addEventListener("input",renderPicker);
function addToCart(id){
  const p=products.find(x=>x.id===id); if(!p)return;
  const found=cart.find(x=>x.id===id);
  if(found){if(found.qty>=p.stock){alert("Jumlah melebihi stok.");return;}found.qty++;}
  else cart.push({id:p.id,name:p.name,price:Number(p.sell_price),cost:Number(p.cost_price),unit:p.unit,qty:1,stock:p.stock});
  renderCart();
}
function cartTotal(){return cart.reduce((s,x)=>s+x.price*x.qty,0);}
function renderCart(){
  $("cartCount").textContent=cart.reduce((s,x)=>s+x.qty,0);
  $("cartItems").innerHTML=cart.length?cart.map(x=>`<div class="cart-line"><div><b>${escapeHtml(x.name)}</b><small>${rupiah(x.price)} / ${escapeHtml(x.unit)}</small><div class="qty-controls"><button data-dec="${x.id}">−</button><b>${x.qty}</b><button data-inc="${x.id}">+</button></div></div><b>${rupiah(x.price*x.qty)}</b></div>`).join(""):'<p class="muted">Belum ada barang.</p>';
  $("cartTotal").textContent=rupiah(cartTotal()); $("checkoutBtn").disabled=!cart.length;
  document.querySelectorAll("[data-dec]").forEach(b=>b.onclick=()=>changeQty(b.dataset.dec,-1));
  document.querySelectorAll("[data-inc]").forEach(b=>b.onclick=()=>changeQty(b.dataset.inc,1));
  updateChange();
}
function changeQty(id,delta){
  const x=cart.find(x=>x.id===id),p=products.find(p=>p.id===id);if(!x)return;
  if(delta>0&&x.qty>=p.stock){alert("Jumlah melebihi stok.");return;}
  x.qty+=delta;if(x.qty<=0)cart=cart.filter(y=>y.id!==id);renderCart();
}
$("clearCart").onclick=()=>{cart=[];renderCart();};
$("amountPaid").addEventListener("input",updateChange);
function updateChange(){const total=cartTotal(),paid=Number($("amountPaid").value||0);$("changeAmount").textContent=rupiah(Math.max(0,paid-total));}

$("checkoutBtn").addEventListener("click",async()=>{
  if(!cart.length)return;
  const total=cartTotal(),paid=Number($("amountPaid").value||0);
  if(paid<total){showMessage("checkoutMessage","Jumlah dibayar kurang dari total.");return;}
  $("checkoutBtn").disabled=true;showMessage("checkoutMessage","Menyimpan transaksi...",false);
  const items=cart.map(x=>({product_id:x.id,qty:x.qty}));
  const {data,error}=await db.rpc("checkout_sale",{p_items:items,p_payment_method:$("paymentMethod").value,p_amount_paid:paid});
  $("checkoutBtn").disabled=false;
  if(error){showMessage("checkoutMessage","Transaksi gagal: "+error.message);return;}
  const sale=data;
  const soldItems=cart.map(x=>({...x}));
  cart=[];$("amountPaid").value="";renderCart();
  await Promise.all([loadProducts(),loadDashboard(),loadSales()]);
  showMessage("checkoutMessage","Transaksi berhasil: "+sale.invoice_no,false);
  printReceipt(sale,soldItems);
});

function printReceipt(sale,items){
  const html=`<h2>TOKO MERAH PUTIH</h2><div class="center">Terima kasih telah berbelanja</div><hr><div>No: ${escapeHtml(sale.invoice_no)}</div><div>${dateTime(sale.created_at)}</div><div>Bayar: ${escapeHtml(sale.payment_method.toUpperCase())}</div><hr><table>${items.map(x=>`<tr><td colspan="2">${escapeHtml(x.name)}</td></tr><tr><td>${x.qty} x ${rupiah(x.price)}</td><td class="right">${rupiah(x.qty*x.price)}</td></tr>`).join("")}</table><hr><table><tr><td><b>TOTAL</b></td><td class="right"><b>${rupiah(sale.total)}</b></td></tr><tr><td>Dibayar</td><td class="right">${rupiah(sale.amount_paid)}</td></tr><tr><td>Kembalian</td><td class="right">${rupiah(sale.change_amount)}</td></tr></table><hr><div class="center">Simpan struk ini sebagai bukti transaksi.</div>`;
  $("receiptArea").innerHTML=html;window.print();
}

async function loadDashboard(){
  const start=new Date();start.setHours(0,0,0,0);
  const {data:todayRows}=await db.from("sales").select("total").gte("created_at",start.toISOString());
  $("statRevenue").textContent=rupiah((todayRows||[]).reduce((s,x)=>s+Number(x.total),0));
  $("statTransactions").textContent=(todayRows||[]).length;
  $("statProducts").textContent=products.length;
  const low=products.filter(p=>Number(p.stock)<=Number(p.min_stock));
  $("statLowStock").textContent=low.length;
  $("lowStockRows").innerHTML=low.map(p=>`<tr><td>${escapeHtml(p.name)}</td><td>${p.stock} ${escapeHtml(p.unit)}</td><td>${p.min_stock}</td><td><span class="pill low">Restock</span></td></tr>`).join("")||'<tr><td colspan="4" class="muted">Tidak ada stok menipis.</td></tr>';
}
async function loadSales(){
  const {data,error}=await db.from("sales").select("*").order("created_at",{ascending:false}).limit(100);
  if(error){console.error(error);return;}sales=data||[];
  $("salesRows").innerHTML=sales.map(s=>`<tr><td><b>${escapeHtml(s.invoice_no)}</b></td><td>${dateTime(s.created_at)}</td><td>${escapeHtml(s.payment_method.toUpperCase())}</td><td>${rupiah(s.total)}</td><td>${rupiah(s.amount_paid)}</td><td>${rupiah(s.change_amount)}</td><td><button class="text-btn" data-reprint="${s.id}">Cetak ulang</button></td></tr>`).join("")||'<tr><td colspan="7" class="muted">Belum ada transaksi.</td></tr>';
  document.querySelectorAll("[data-reprint]").forEach(b=>b.onclick=()=>reprint(b.dataset.reprint));
}
async function reprint(id){
  const {data:sale,error}=await db.from("sales").select("*").eq("id",id).single();
  if(error){alert(error.message);return;}
  const {data:items, error:e2}=await db.from("sale_items").select("product_name,qty,unit_price").eq("sale_id",id);
  if(e2){alert(e2.message);return;}
  printReceipt(sale,items.map(x=>({name:x.product_name,qty:x.qty,price:Number(x.unit_price)})));
}
$("refreshSales").onclick=loadSales;
init();
