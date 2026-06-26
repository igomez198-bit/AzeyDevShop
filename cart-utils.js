window.DeviationCart = {
    CART_KEY: 'deviation_cart_v1',
    INVENTORY_KEY: 'deviation_inventory_v1',
    WISHLIST_KEY: 'deviation_wishlist_v1',
    POPULAR_KEY: 'deviation_popular_v1',
    SALES_KEY: 'deviation_sales_v1',
    CATEGORIES_KEY: 'deviation_categories_v1',
    CURRENCY: 'PHP',

    get products() {
        const liveProducts = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : null;
        const liveReady = window.PRODUCTS_LOADED === true;
        const stored = this.loadInventory();

        if (liveReady) {
            if (Array.isArray(liveProducts) && liveProducts.length) {
                return liveProducts;
            }
            if (Array.isArray(stored) && stored.length) {
                return stored;
            }
            return liveProducts || [];
        }

        if (Array.isArray(liveProducts) && liveProducts.length) return liveProducts;
        return Array.isArray(stored) && stored.length ? stored : [];
    },

    loadInventory() {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        try {
            const raw = window.localStorage.getItem(this.INVENTORY_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            return Array.isArray(parsed) ? parsed : null;
        } catch (error) {
            return null;
        }
    },

    saveInventory(products) {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            window.localStorage.setItem(this.INVENTORY_KEY, JSON.stringify(products));
        } catch (error) {
            // ignore storage errors
        }
    },

    syncInventory() {
        const liveProducts = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : null;
        const liveReady = window.PRODUCTS_LOADED === true;
        const stored = this.loadInventory();
        let products = [];

        if (liveReady) {
            if (Array.isArray(liveProducts) && liveProducts.length) {
                products = liveProducts;
            } else if (Array.isArray(stored) && stored.length) {
                products = stored;
            } else {
                products = liveProducts || [];
            }
        } else {
            products = liveProducts && liveProducts.length ? liveProducts : (Array.isArray(stored) && stored.length ? stored : []);
        }

        if (Array.isArray(products)) {
            window.PRODUCTS = products;
            this.saveInventory(products);
            return products;
        }
        return [];
    },

    recordSale(productId, quantity = 1) {
        const inventory = this.loadInventory();
        const products = inventory || (Array.isArray(window.PRODUCTS) ? [...window.PRODUCTS] : []);
        const product = products.find(p => p.id === productId);
        if (!product) return { ok: false, message: 'Product not found.' };
        const sellQty = Math.min(quantity, Number(product.stock) || 0);
        if (sellQty <= 0) {
            return { ok: false, message: `${product.name || 'Item'} is out of stock.` };
        }
        product.stock = Math.max(0, Number(product.stock) - sellQty);
        product.sold = (Number(product.sold) || 0) + sellQty;
        // Automatically update status based on stock
        if (product.stock <= 0) {
            product.status = 'Out of Stock';
        } else if (product.status === 'Out of Stock') {
            product.status = 'In Stock';
        }
        this.saveInventory(products);
        window.PRODUCTS = products;
        return { ok: true, product };
    },

    getProduct(id) {
        return this.products.find(p => p.id === id);
    },

    formatPrice(value) {
        const amount = Number(value) || 0;
        return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    getFeaturedProducts(limit = 3) {
        return [...this.products]
            .sort((a, b) => Number(b.stock) - Number(a.stock))
            .slice(0, limit);
    },

    renderProductImage(product, className = 'deviation-pic') {
        const thumb = product && (product.imageThumb || product.image_thumb || product.imageUrl || product.image_url) ? String(product.imageThumb || product.image_thumb || product.imageUrl || product.image_url).trim() : '';
        const image = product && (product.image || product.imageUrl || product.image_url || product.image_thumb || product.imageThumb) ? String(product.image || product.imageUrl || product.image_url || product.image_thumb || product.imageThumb).trim() : '';
        const src = thumb || image;
        const resolvedSrc = this.resolveProductImageUrl(src);
        const resolvedLink = this.resolveProductImageUrl(image || src);
        if (resolvedSrc) {
            return `<a href="${this.escapeHtml(resolvedLink)}" class="${className} product-image-link" target="_blank" rel="noopener noreferrer"><img src="${this.escapeHtml(resolvedSrc)}" alt="${this.escapeHtml(product.name || 'Deviation')}"></a>`;
        }
        return `<div class="${className} product-image-placeholder"><span class="product-image-placeholder">🖼️</span></div>`;
    },

    resolveProductImageUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (raw.startsWith('data:')) return raw;
        if (raw.startsWith('//')) return raw;
        if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw)) return raw;
        if (raw.startsWith('images/') || raw.startsWith('./images/') || raw.startsWith('../images/') || raw.startsWith('/images/')) {
            return raw;
        }
        if (raw.includes('/')) {
            return raw;
        }
        return `images/${raw}`;
    },

    escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    getCartQty(productId, cart) {
        const item = cart.find(line => line.id === productId);
        return item ? item.qty : 0;
    },

    getRemainingStock(productId, cart) {
        const product = this.getProduct(productId);
        if (!product) return 0;
        if (product.status === 'Out of Stock' || product.stock <= 0) return 0;
        return Math.max(0, product.stock - this.getCartQty(productId, cart));
    },

    canAdd(productId, cart, amount = 1) {
        return this.getRemainingStock(productId, cart) >= amount;
    },

    stockStatus(productId, cart) {
        const product = this.getProduct(productId);
        if (!product) {
            return { label: 'Unavailable', canAdd: false, remaining: 0, inCart: 0, stock: 0 };
        }

        const inCart = this.getCartQty(productId, cart);
        const remaining = this.getRemainingStock(productId, cart);

        if (product.stock <= 0 || product.status === 'Out of Stock') {
            return { label: 'Out of Stock', canAdd: false, remaining: 0, inCart, stock: product.stock };
        }

        if (remaining <= 0) {
            return { label: inCart > 0 ? 'Max in Cart' : 'Out of Stock', canAdd: false, remaining: 0, inCart, stock: product.stock };
        }

        return {
            label: `${remaining} left`,
            canAdd: true,
            remaining,
            inCart,
            stock: product.stock
        };
    },

    clampCartToStock(cart) {
        return cart
            .map(item => {
                const product = this.getProduct(item.id);
                if (!product) return null;
                const qty = Math.min(item.qty, product.stock);
                if (qty <= 0) return null;
                return { ...item, qty };
            })
            .filter(Boolean);
    },

    addToCart(productId, cart) {
        const product = this.getProduct(productId);
        if (!product) return { ok: false, message: 'Product not found.' };

        if (!this.canAdd(productId, cart, 1)) {
            const status = this.stockStatus(productId, cart);
            if (product.stock <= 0) {
                return { ok: false, message: `${product.name} is out of stock.` };
            }
            if (status.inCart >= product.stock) {
                return { ok: false, message: `You already have the maximum (${product.stock}) for ${product.name}.` };
            }
            return { ok: false, message: `Only ${product.stock} available for ${product.name}.` };
        }

        const existing = cart.find(line => line.id === productId);
        if (existing) {
            existing.qty += 1;
        } else {
            cart.push({ id: product.id, name: product.name, price: product.price, qty: 1 });
        }

        return { ok: true };
    },

    changeQty(index, delta, cart) {
        const item = cart[index];
        if (!item) return { ok: false, message: 'Item not found in cart.' };

        if (delta > 0) {
            if (!this.canAdd(item.id, cart, 1)) {
                const product = this.getProduct(item.id);
                return {
                    ok: false,
                    message: product
                        ? `Only ${product.stock} in stock for ${product.name}.`
                        : 'Cannot increase quantity.'
                };
            }
        }

        item.qty += delta;
        if (item.qty <= 0) {
            cart.splice(index, 1);
        }

        return { ok: true };
    },

    // Wishlist
    getWishlist() {
        try {
            return JSON.parse(localStorage.getItem(this.WISHLIST_KEY) || '[]');
        } catch (e) {
            return [];
        }
    },
    saveWishlist(list) {
        localStorage.setItem(this.WISHLIST_KEY, JSON.stringify(list));
    },
    toggleWishlist(productId) {
        const list = this.getWishlist();
        const idx = list.indexOf(productId);
        if (idx >= 0) list.splice(idx, 1);
        else list.push(productId);
        this.saveWishlist(list);
        return idx < 0;
    },
    isInWishlist(productId) {
        return this.getWishlist().includes(productId);
    },

    // Popular tracking
    trackPopular(productId) {
        try {
            const popular = JSON.parse(localStorage.getItem(this.POPULAR_KEY) || '{}');
            popular[productId] = (popular[productId] || 0) + 1;
            localStorage.setItem(this.POPULAR_KEY, JSON.stringify(popular));
        } catch (e) {}
    },
    getPopularProducts(limit = 5) {
        try {
            const popular = JSON.parse(localStorage.getItem(this.POPULAR_KEY) || '{}');
            return Object.entries(popular)
                .sort((a, b) => b[1] - a[1])
                .slice(0, limit)
                .map(([id]) => this.getProduct(Number(id)))
                .filter(Boolean);
        } catch (e) {
            return [];
        }
    },

    // Sales stats
    getSalesStats() {
        try {
            const stats = JSON.parse(localStorage.getItem(this.SALES_KEY) || '{}');
            return {
                totalRevenue: stats.totalRevenue || 0,
                totalSold: stats.totalSold || 0,
                totalOrders: stats.totalOrders || 0
            };
        } catch (e) {
            return { totalRevenue: 0, totalSold: 0, totalOrders: 0 };
        }
    },
    recordSaleStats(totalPrice, itemCount) {
        try {
            const stats = JSON.parse(localStorage.getItem(this.SALES_KEY) || '{}');
            stats.totalRevenue = (stats.totalRevenue || 0) + totalPrice;
            stats.totalSold = (stats.totalSold || 0) + itemCount;
            stats.totalOrders = (stats.totalOrders || 0) + 1;
            localStorage.setItem(this.SALES_KEY, JSON.stringify(stats));
        } catch (e) {}
    },

    // Categories
    getCategories() {
        try {
            const raw = localStorage.getItem(this.CATEGORIES_KEY);
            return raw ? JSON.parse(raw) : ['Starfall', 'Variant', 'Lunar', 'Chaos', 'Normal'];
        } catch (e) {
            return ['Starfall', 'Variant', 'Lunar', 'Chaos', 'Normal'];
        }
    },
    saveCategories(categories) {
        localStorage.setItem(this.CATEGORIES_KEY, JSON.stringify(categories));
    }
};
