import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { api } from "./api";
import "./styles.css";

const emptyProduct = { name: "", sku: "", price: "", quantity_in_stock: "" };
const emptyCustomer = { full_name: "", email: "", phone_number: "" };
const emptyOrderItem = { product_id: "", quantity: "" };
const emptyOrder = { customer_id: "", items: [emptyOrderItem] };

function money(value) {
  return Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [dashboard, productRows, customerRows, orderRows] = await Promise.all([
        api.dashboard(),
        api.getProducts(),
        api.getCustomers(),
        api.getOrders(),
      ]);
      setSummary(dashboard);
      setProducts(productRows);
      setCustomers(customerRows);
      setOrders(orderRows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function runAction(action, successMessage) {
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(term));
  }, [products, query]);

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <Boxes size={28} />
          <div>
            <strong>StockFlow</strong>
            <span>Inventory & Orders</span>
          </div>
        </div>
        <nav className="nav">
          <TabButton id="dashboard" activeTab={activeTab} setActiveTab={setActiveTab} icon={<LayoutDashboard />} label="Dashboard" />
          <TabButton id="products" activeTab={activeTab} setActiveTab={setActiveTab} icon={<Boxes />} label="Products" />
          <TabButton id="customers" activeTab={activeTab} setActiveTab={setActiveTab} icon={<Users />} label="Customers" />
          <TabButton id="orders" activeTab={activeTab} setActiveTab={setActiveTab} icon={<ClipboardList />} label="Orders" />
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Operations Console</p>
            <h1>{activeTab[0].toUpperCase() + activeTab.slice(1)}</h1>
          </div>
          <button className="iconText" onClick={loadData} title="Refresh data">
            <RefreshCcw size={18} /> Refresh
          </button>
        </header>

        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}
        {loading && <div className="alert neutral">Loading latest data...</div>}

        {activeTab === "dashboard" && <Dashboard summary={summary} products={products} orders={orders} />}
        {activeTab === "products" && (
          <Products
            products={filteredProducts}
            query={query}
            setQuery={setQuery}
            runAction={runAction}
          />
        )}
        {activeTab === "customers" && <Customers customers={customers} runAction={runAction} />}
        {activeTab === "orders" && (
          <Orders products={products} customers={customers} orders={orders} runAction={runAction} />
        )}
      </main>
    </div>
  );
}

function TabButton({ id, activeTab, setActiveTab, icon, label }) {
  return (
    <button className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>
      {React.cloneElement(icon, { size: 18 })}
      {label}
    </button>
  );
}

function Dashboard({ summary, products, orders }) {
  const lowStock = products.filter((product) => product.quantity_in_stock <= 5);
  return (
    <section className="stack">
      <div className="metricGrid">
        <Metric label="Products" value={summary?.total_products ?? 0} />
        <Metric label="Customers" value={summary?.total_customers ?? 0} />
        <Metric label="Orders" value={summary?.total_orders ?? 0} />
        <Metric label="Low Stock" value={summary?.low_stock_products ?? 0} />
      </div>
      <div className="contentGrid">
        <section className="panel">
          <h2>Low Stock Products</h2>
          <Table
            headers={["Product", "SKU", "Stock"]}
            rows={lowStock.map((product) => [product.name, product.sku, product.quantity_in_stock])}
            empty="No low stock products."
          />
        </section>
        <section className="panel">
          <h2>Recent Orders</h2>
          <Table
            headers={["Customer", "Items", "Total"]}
            rows={orders.slice(0, 5).map((order) => [order.customer_name, order.items.length, money(order.total_amount)])}
            empty="No orders yet."
          />
        </section>
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Products({ products, query, setQuery, runAction }) {
  const [form, setForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState(null);

  function submit(event) {
    event.preventDefault();
    const payload = {
      name: form.name,
      sku: form.sku,
      price: Number(form.price),
      quantity_in_stock: Number(form.quantity_in_stock),
    };
    runAction(
      async () => {
        if (editingId) {
          await api.updateProduct(editingId, payload);
        } else {
          await api.createProduct(payload);
        }
        setForm(emptyProduct);
        setEditingId(null);
      },
      editingId ? "Product updated." : "Product added."
    );
  }

  return (
    <section className="stack">
      <FormPanel title={editingId ? "Update Product" : "Add Product"} onSubmit={submit}>
        <Input label="Product name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
        <Input label="SKU/code" value={form.sku} onChange={(value) => setForm({ ...form, sku: value })} required />
        <Input label="Price" type="number" min="0" step="0.01" value={form.price} onChange={(value) => setForm({ ...form, price: value })} required />
        <Input label="Quantity" type="number" min="0" value={form.quantity_in_stock} onChange={(value) => setForm({ ...form, quantity_in_stock: value })} required />
        <button className="primary" type="submit"><Plus size={18} /> {editingId ? "Save" : "Add"}</button>
      </FormPanel>
      <section className="panel">
        <div className="panelHead">
          <h2>Product List</h2>
          <label className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" /></label>
        </div>
        <div className="cards">
          {products.map((product) => (
            <article className="card" key={product.id}>
              <div>
                <strong>{product.name}</strong>
                <span>{product.sku}</span>
              </div>
              <p>{money(product.price)}</p>
              <p>Stock: {product.quantity_in_stock}</p>
              <div className="actions">
                <button title="Edit product" onClick={() => { setEditingId(product.id); setForm(product); }}><Pencil size={16} /></button>
                <button title="Delete product" onClick={() => runAction(() => api.deleteProduct(product.id), "Product deleted.")}><Trash2 size={16} /></button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function Customers({ customers, runAction }) {
  const [form, setForm] = useState(emptyCustomer);

  function submit(event) {
    event.preventDefault();
    runAction(async () => {
      await api.createCustomer(form);
      setForm(emptyCustomer);
    }, "Customer added.");
  }

  return (
    <section className="stack">
      <FormPanel title="Add Customer" onSubmit={submit}>
        <Input label="Full name" value={form.full_name} onChange={(value) => setForm({ ...form, full_name: value })} required />
        <Input label="Email address" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} required />
        <Input label="Phone number" value={form.phone_number} onChange={(value) => setForm({ ...form, phone_number: value })} required />
        <button className="primary" type="submit"><Plus size={18} /> Add</button>
      </FormPanel>
      <section className="panel">
        <h2>Customer List</h2>
        <Table
          headers={["Name", "Email", "Phone", ""]}
          rows={customers.map((customer) => [
            customer.full_name,
            customer.email,
            customer.phone_number,
            <button title="Delete customer" onClick={() => runAction(() => api.deleteCustomer(customer.id), "Customer deleted.")}><Trash2 size={16} /></button>,
          ])}
          empty="No customers yet."
        />
      </section>
    </section>
  );
}

function Orders({ products, customers, orders, runAction }) {
  const [form, setForm] = useState(emptyOrder);

  function updateItem(index, field, value) {
    setForm({
      ...form,
      items: form.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    });
  }

  function submit(event) {
    event.preventDefault();
    runAction(async () => {
      await api.createOrder({
        customer_id: Number(form.customer_id),
        items: form.items.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
        })),
      });
      setForm(emptyOrder);
    }, "Order created and inventory updated.");
  }

  return (
    <section className="stack">
      <FormPanel title="Create Order" onSubmit={submit}>
        <label>
          Customer
          <select value={form.customer_id} onChange={(event) => setForm({ ...form, customer_id: event.target.value })} required>
            <option value="">Select customer</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name}</option>)}
          </select>
        </label>
        <div className="lineItems">
          {form.items.map((item, index) => (
            <div className="lineItem" key={index}>
              <label>
                Product
                <select value={item.product_id} onChange={(event) => updateItem(index, "product_id", event.target.value)} required>
                  <option value="">Select product</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.quantity_in_stock} in stock)</option>)}
                </select>
              </label>
              <Input label="Quantity" type="number" min="1" value={item.quantity} onChange={(value) => updateItem(index, "quantity", value)} required />
              <button
                className="removeLine"
                type="button"
                title="Remove line item"
                disabled={form.items.length === 1}
                onClick={() => setForm({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) })}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button className="secondary" type="button" onClick={() => setForm({ ...form, items: [...form.items, emptyOrderItem] })}>
            <Plus size={18} /> Add item
          </button>
        </div>
        <button className="primary" type="submit"><Plus size={18} /> Create</button>
      </FormPanel>
      <section className="panel">
        <h2>Orders</h2>
        <div className="orderList">
          {orders.map((order) => (
            <article className="order" key={order.id}>
              <div>
                <strong>Order #{order.id}</strong>
                <span>{order.customer_name} · {new Date(order.created_at).toLocaleString()}</span>
              </div>
              <ul>
                {order.items.map((item) => (
                  <li key={item.id}>{item.product_name} x {item.quantity} = {money(item.line_total)}</li>
                ))}
              </ul>
              <div className="orderTotal">
                <strong>{money(order.total_amount)}</strong>
                <button title="Delete order" onClick={() => runAction(() => api.deleteOrder(order.id), "Order deleted.")}><Trash2 size={16} /></button>
              </div>
            </article>
          ))}
          {!orders.length && <p className="empty">No orders yet.</p>}
        </div>
      </section>
    </section>
  );
}

function FormPanel({ title, onSubmit, children }) {
  return (
    <form className="panel formGrid" onSubmit={onSubmit}>
      <h2>{title}</h2>
      {children}
    </form>
  );
}

function Input({ label, value, onChange, ...props }) {
  return (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
  );
}

function Table({ headers, rows, empty }) {
  if (!rows.length) {
    return <p className="empty">{empty}</p>;
  }

  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
