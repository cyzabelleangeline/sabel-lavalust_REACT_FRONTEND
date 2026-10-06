import { useEffect, useMemo, useState } from 'react'

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const EMPTY = { product_name: '', description: '', price: '', quantity: '' }
const read = (key, fallback = '') => {
  const value = localStorage.getItem(key)
  if (value === null) return fallback
  try { return JSON.parse(value) } catch { return value }
}

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const raw = await response.text()
  let data
  try { data = raw ? JSON.parse(raw) : {} } catch {
    throw new Error(`The API returned an unexpected page (HTTP ${response.status}). Check the LavaLust API URL and server logs.`)
  }
  if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status}).`)
  return data
}

export default function App() {
  const [token, setToken] = useState(() => read('ll_token'))
  const [user, setUser] = useState(() => read('ll_user', null))
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [login, setLogin] = useState({ identifier: '', password: '' })
  const [signup, setSignup] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const visible = useMemo(() => products.filter(product =>
    `${product.product_name} ${product.description || ''}`.toLowerCase().includes(query.toLowerCase())
  ), [products, query])
  const totalValue = products.reduce((sum, product) => sum + Number(product.price || 0) * Number(product.quantity || 0), 0)
  const lowStock = products.filter(product => Number(product.quantity) < 5).length

  async function loadProducts(activeToken = token) {
    const data = await request('/api/products', { token: activeToken })
    setProducts(data.products || [])
  }

  useEffect(() => {
    if (token) loadProducts().catch(() => {
      ;['ll_token', 'll_refresh', 'll_user'].forEach(key => localStorage.removeItem(key))
      setToken(''); setUser(null)
    })
  }, [])

  async function submitLogin(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const data = await request('/api/login', { method: 'POST', body: { identifier: login.identifier, password: login.password } })
      const access = data.token || data.access_token
      localStorage.setItem('ll_token', access)
      localStorage.setItem('ll_refresh', data.refresh_token || '')
      localStorage.setItem('ll_user', JSON.stringify(data.user))
      setToken(access); setUser(data.user); await loadProducts(access)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function submitSignup(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    if (signup.password !== signup.confirmPassword) { setError('Passwords do not match.'); setBusy(false); return }
    try {
      const data = await request('/api/register', { method: 'POST', body: { username: signup.username, email: signup.email, password: signup.password } })
      setLogin({ identifier: signup.email, password: '' }); setAuthMode('login')
      setNotice(data.message || 'Account created. Sign in to continue.')
    } catch (err) {
      if (/already registered/i.test(err.message)) {
        setLogin({ identifier: signup.email, password: '' })
        setAuthMode('login')
        setNotice('An account already uses this username or email. Sign in to continue.')
      } else {
        setError(err.message)
      }
    } finally { setBusy(false) }
  }

  async function saveProduct(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    const body = { ...form, price: Number(form.price), quantity: Number(form.quantity) }
    try {
      await request(editing ? `/api/products/${editing}` : '/api/products', { token, method: editing ? 'PUT' : 'POST', body })
      setNotice(editing ? 'Product details saved.' : 'Product added to your catalog.')
      setForm(EMPTY); setEditing(null); await loadProducts()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  function startEdit(product) {
    setEditing(product.id)
    setForm({ product_name: product.product_name || '', description: product.description || '', price: product.price ?? '', quantity: product.quantity ?? '' })
    document.querySelector('#product-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function removeProduct(product) {
    if (!window.confirm(`Remove “${product.product_name}” from the catalog?`)) return
    setError(''); setNotice('')
    try { await request(`/api/products/${product.id}`, { token, method: 'DELETE' }); setNotice('Product removed.'); await loadProducts() }
    catch (err) { setError(err.message) }
  }

  function signOut() {
    if (!window.confirm('Are you sure you want to sign out?')) return
    const refresh = read('ll_refresh')
    request('/api/logout', { token, method: 'POST', body: { refresh_token: refresh } }).catch(() => {})
    ;['ll_token', 'll_refresh', 'll_user'].forEach(key => localStorage.removeItem(key))
    setToken(''); setUser(null); setProducts([]); setForm(EMPTY); setEditing(null); setNotice('You are signed out.')
  }

  if (!token) return <main className="auth-screen">
    <section className="auth-art"><div className="art-copy"><span className="kicker">THE INVENTORY DESK</span><h1>Make room<br />for what’s next.</h1><p>A clear view of your products, stock and daily operations.</p></div><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-sun"/></section>
    <section className="auth-side"><div className="auth-box"><span className="kicker">{authMode === 'login' ? 'YOUR WORKSPACE AWAITS' : 'GET STARTED'}</span><h2>{authMode === 'login' ? 'Welcome back' : 'Create an account'}</h2><p className="auth-intro">{authMode === 'login' ? 'Sign in to continue to your inventory.' : 'Set up your account to manage products.'}</p>
      {error && <div className="message error">{error}</div>}{notice && <div className="message success">{notice}</div>}
      {authMode === 'login' ? <form className="form-stack" onSubmit={submitLogin}><label>Email or username<input autoComplete="username" value={login.identifier} onChange={event => setLogin({ ...login, identifier: event.target.value })} required /></label><label>Password<input type="password" autoComplete="current-password" value={login.password} onChange={event => setLogin({ ...login, password: event.target.value })} required /></label><button className="button-dark" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <span>↗</span></button></form> : <form className="form-stack" onSubmit={submitSignup}><label>Username<input autoComplete="username" minLength="3" maxLength="100" value={signup.username} onChange={event => setSignup({ ...signup, username: event.target.value })} required /></label><label>Email<input type="email" autoComplete="email" value={signup.email} onChange={event => setSignup({ ...signup, email: event.target.value })} required /></label><label>Password<input type="password" autoComplete="new-password" minLength="8" maxLength="72" value={signup.password} onChange={event => setSignup({ ...signup, password: event.target.value })} required /></label><label>Confirm password<input type="password" autoComplete="new-password" minLength="8" value={signup.confirmPassword} onChange={event => setSignup({ ...signup, confirmPassword: event.target.value })} required /></label><button className="button-dark" disabled={busy}>{busy ? 'Creating account…' : 'Create account'} <span>↗</span></button></form>}
      <p className="auth-toggle">{authMode === 'login' ? 'New to Lava / Stock?' : 'Already have an account?'} <button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setError(''); setNotice('') }}>{authMode === 'login' ? 'Create account' : 'Sign in'}</button></p>
    </div></section>
  </main>

  return <div className="workspace">
    <aside className="rail"><div className="rail-label">WORKSPACE</div><a className="rail-link selected" href="#catalog"><span>▦</span> Catalog</a><a className="rail-link" href="#product-editor"><span>＋</span> Add product</a><div className="rail-bottom"><div className="avatar">{(user?.username || 'U').slice(0, 1).toUpperCase()}</div><div className="profile"><strong>{user?.username || 'User'}</strong><span>{user?.role || 'Account'}</span></div><button className="signout" onClick={signOut} title="Sign out" aria-label="Sign out">↗</button></div></aside>
    <main className="dashboard" id="top"><header className="topline"><div><span className="kicker">INVENTORY / OVERVIEW</span><h1>Your products</h1></div><div className="date-chip"><span className="live-dot"/> LIVE CATALOG <span className="top-divider"/> {new Date().toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' })}</div></header>
      {(error || notice) && <div className={`message ${error ? 'error' : 'success'}`}>{error || notice}<button aria-label="Dismiss message" onClick={() => { setError(''); setNotice('') }}>×</button></div>}
      <section className="metrics"><article className="metric metric-dark"><span>01 / ITEMS LISTED</span><strong>{products.length.toString().padStart(2, '0')}</strong><small>Products in your catalog</small><i>↗</i></article><article className="metric metric-accent"><span>02 / STOCK VALUE</span><strong>₱{totalValue.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</strong><small>Based on current quantities</small><i>₱</i></article><article className="metric metric-light"><span>03 / NEEDS ATTENTION</span><strong>{lowStock.toString().padStart(2, '0')}</strong><small>Items with fewer than 5 units</small><i>!</i></article></section>
      <section className="work-grid"><article className="editor" id="product-editor"><div className="section-head"><div><span className="kicker">{editing ? 'EDIT ENTRY' : 'NEW ENTRY'}</span><h2>{editing ? 'Update product' : 'Add to catalog'}</h2></div>{editing && <button className="cancel" onClick={() => { setEditing(null); setForm(EMPTY) }}>Cancel</button>}</div><form className="form-stack" onSubmit={saveProduct}><label>Product name<input maxLength="100" placeholder="e.g. Studio lamp" value={form.product_name} onChange={event => setForm({ ...form, product_name: event.target.value })} required /></label><label>Description <em>OPTIONAL</em><textarea rows="3" placeholder="A few details about this product" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })}/></label><div className="pair"><label>Price <span className="currency">₱</span><input type="number" min="0" step="0.01" placeholder="0.00" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} required /></label><label>Quantity<input type="number" min="0" step="1" placeholder="0" value={form.quantity} onChange={event => setForm({ ...form, quantity: event.target.value })} required /></label></div><button className="button-dark" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add product'} <span>↗</span></button></form><div className="editor-note"><span>↳</span> Changes are saved securely through your LavaLust API.</div></article>
        <article className="catalog" id="catalog"><div className="catalog-head"><div><span className="kicker">YOUR INVENTORY</span><h2>Catalog <span className="catalog-count">{visible.length}</span></h2></div><label className="search"><span>⌕</span><input aria-label="Search catalog" placeholder="Find a product" value={query} onChange={event => setQuery(event.target.value)} /></label></div><div className="product-list">{visible.map((product, index) => <div className="product-row" key={product.id}><span className="row-index">{String(index + 1).padStart(2, '0')}</span><div className="product-copy"><strong>{product.product_name}</strong><span>{product.description || 'No description provided'}</span></div><div className="row-price">₱{Number(product.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div><span className={`stock-tag ${Number(product.quantity) === 0 ? 'empty-stock' : Number(product.quantity) < 5 ? 'low-stock' : ''}`}><i/>{product.quantity} IN STOCK</span><div className="row-actions"><button onClick={() => startEdit(product)}>Edit</button><button onClick={() => removeProduct(product)}>Remove</button></div></div>)}{!visible.length && <div className="empty-state"><span>∅</span><strong>{query ? 'No matches found' : 'Your catalog is waiting'}</strong><p>{query ? 'Try a different product name.' : 'Add an item with the form to get started.'}</p></div>}</div><footer className="catalog-foot"><span>SHOWING {visible.length} OF {products.length} PRODUCTS</span><span>POWERED BY LAVALUST <b>◆</b></span></footer></article></section>
    </main>
  </div>
}
