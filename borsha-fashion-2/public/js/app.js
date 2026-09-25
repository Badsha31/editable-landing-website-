(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const api = (url, options = {}) => fetch(url, options).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  });

  const els = {
    productList: $('productGrid'),
    categoryFilter: $('category-filters'),
    cartCount: $('cartCount'),
    cartModal: $('cartModal'),
    cartItems: $('cartItems'),
    cartTotal: $('cartTotalAmount'),
    checkoutForm: $('checkoutForm'),
    checkoutModal: $('checkoutModal'),
    successModal: $('successModal')
  };

  let cart = loadCart();
  let products = [];

  function loadCart() {
    try {
      const value = JSON.parse(localStorage.getItem('borsha_cart') || '[]');
      return Array.isArray(value) ? value.filter(item => item && Number.isInteger(item.id) && item.qty > 0) : [];
    } catch {
      return [];
    }
  }

  function saveCart() {
    localStorage.setItem('borsha_cart', JSON.stringify(cart));
  }

  function formatPrice(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : '$0.00';
  }

  function updateCartCount() {
    els.cartCount.textContent = String(cart.reduce((sum, item) => sum + item.qty, 0));
  }

  function showModal(modal) {
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
  }

  function hideModal(modal) {
    if (!modal) return;
    modal.style.display = 'none';
    if (![els.cartModal, els.checkoutModal, els.successModal].some(m => m?.style.display === 'flex')) {
      document.body.classList.remove('modal-open');
    }
  }

  function renderProducts(list) {
    els.productList.replaceChildren();
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No products found in this category.';
      els.productList.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const product of list) {
      const card = document.createElement('article');
      card.className = 'product-card';

      const image = document.createElement('img');
      image.className = 'product-img';
      image.src = product.image || '';
      image.alt = product.name;
      image.loading = 'lazy';
      image.onerror = () => {
        image.onerror = null;
        image.removeAttribute('src');
        image.alt = `${product.name} image unavailable`;
      };

      const info = document.createElement('div');
      info.className = 'product-info';

      const category = document.createElement('div');
      category.className = 'product-category';
      category.textContent = product.category || 'Collection';

      const title = document.createElement('h3');
      title.className = 'product-title';
      title.textContent = product.name;

      const description = document.createElement('p');
      description.className = 'product-description';
      description.textContent = product.description || '';

      const price = document.createElement('div');
      price.className = 'product-price';
      price.textContent = formatPrice(product.price);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'add-to-cart';
      button.textContent = 'Add to Cart';
      button.addEventListener('click', () => addToCart(product));

      info.append(category, title, description, price, button);
      card.append(image, info);
      fragment.appendChild(card);
    }
    els.productList.appendChild(fragment);
  }

  async function fetchProducts(category = 'All') {
    try {
      const data = await api(`/api/products?category=${encodeURIComponent(category)}`);
      products = Array.isArray(data.products) ? data.products : [];
      renderProducts(products);
    } catch (error) {
      console.error(error);
      els.productList.replaceChildren();
      const message = document.createElement('p');
      message.className = 'empty-state';
      message.textContent = 'Unable to load products. Please try again.';
      els.productList.appendChild(message);
    }
  }

  function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) existing.qty += 1;
    else cart.push({ id: product.id, qty: 1 });
    saveCart();
    updateCartCount();
    showToast('Item added to cart');
  }

  function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    saveCart();
    updateCartCount();
    renderCartItems();
  }

  function changeQuantity(id, delta) {
    const item = cart.find(entry => entry.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) removeFromCart(id);
    else {
      saveCart();
      updateCartCount();
      renderCartItems();
    }
  }

  function renderCartItems() {
    els.cartItems.replaceChildren();
    if (!cart.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Your cart is empty.';
      els.cartItems.appendChild(empty);
      els.cartTotal.textContent = '$0.00';
      return;
    }

    let total = 0;
    for (const item of cart) {
      const product = products.find(p => p.id === item.id);
      if (!product) continue;
      total += Number(product.price) * item.qty;

      const row = document.createElement('div');
      row.className = 'cart-item-row';

      const details = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = product.name;
      const meta = document.createElement('span');
      meta.textContent = `${formatPrice(product.price)} × ${item.qty}`;
      details.append(title, document.createElement('br'), meta);

      const controls = document.createElement('div');
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.textContent = '−';
      minus.addEventListener('click', () => changeQuantity(item.id, -1));
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '+';
      plus.addEventListener('click', () => changeQuantity(item.id, 1));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn-remove';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => removeFromCart(item.id));
      controls.append(minus, document.createTextNode(` ${item.qty} `), plus, document.createTextNode(' '), remove);

      row.append(details, controls);
      els.cartItems.appendChild(row);
    }
    els.cartTotal.textContent = formatPrice(total);
  }

  function cartTotal() {
    return cart.reduce((sum, item) => {
      const product = products.find(p => p.id === item.id);
      return product ? sum + Number(product.price) * item.qty : sum;
    }, 0);
  }

  window.openCart = () => {
    renderCartItems();
    showModal(els.cartModal);
  };

  window.closeCart = () => hideModal(els.cartModal);

  window.openCheckout = () => {
    if (!cart.length) {
      showToast('Your cart is empty');
      return;
    }
    hideModal(els.cartModal);
    showModal(els.checkoutModal);
  };

  window.closeCheckout = () => hideModal(els.checkoutModal);
  window.closeSuccess = () => hideModal(els.successModal);

  function showToast(message) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3000);
  }

  async function submitOrder(event) {
    event.preventDefault();
    const form = new FormData(els.checkoutForm);
    const payload = {
      customer_name: String(form.get('customer_name') || '').trim(),
      email: String(form.get('email') || '').trim(),
      address: String(form.get('address') || '').trim(),
      items: cart.map(item => ({ id: item.id, qty: item.qty }))
    };

    const submit = els.checkoutForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const data = await api('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!data.success) throw new Error(data.error || 'Order failed');
      cart = [];
      saveCart();
      updateCartCount();
      els.checkoutForm.reset();
      hideModal(els.checkoutModal);
      const id = $('order-id');
      if (id) id.textContent = `Order #${data.orderId}`;
      showModal(els.successModal);
    } catch (error) {
      console.error(error);
      alert(`Order failed: ${error.message}`);
    } finally {
      submit.disabled = false;
    }
  }

  function setupFilters() {
    const filter = els.categoryFilter;
    if (!filter) return;
    filter.addEventListener('click', event => {
      const button = event.target.closest('button[data-category]');
      if (!button) return;
      filter.querySelectorAll('button').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      fetchProducts(button.dataset.category || 'All');
    });
  }

  function setupModalBehavior() {
    document.querySelectorAll('[data-close]').forEach(button => {
      button.addEventListener('click', () => hideModal(button.closest('.modal')));
    });
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', event => {
        if (event.target === modal) hideModal(modal);
      });
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') document.querySelectorAll('.modal').forEach(hideModal);
    });
  }

  async function init() {
    updateCartCount();
    setupFilters();
    setupModalBehavior();
    els.checkoutForm?.addEventListener('submit', submitOrder);
    await fetchProducts();
  }

  init().catch(error => console.error('App initialization failed:', error));
})();
