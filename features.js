// ============= TOAST NOTIFICATIONS =============
window.DeviationToast = {
    show(message, type = 'info', duration = 3000) {
        const container = this.getContainer();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => toast.remove(), duration);
    },
    getContainer() {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }
};

// ============= THEME MANAGEMENT =============
window.DeviationTheme = {
    THEME_KEY: 'deviation_theme_v1',
    init() {
        const saved = localStorage.getItem(this.THEME_KEY) || 'dark';
        this.set(saved);
    },
    set(theme) {
        const html = document.documentElement;
        if (theme === 'light') {
            html.classList.add('light-theme');
        } else {
            html.classList.remove('light-theme');
        }
        localStorage.setItem(this.THEME_KEY, theme);
    },
    toggle() {
        const current = localStorage.getItem(this.THEME_KEY) || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        this.set(next);
        return next;
    },
    getCurrent() {
        return localStorage.getItem(this.THEME_KEY) || 'dark';
    }
};

// ============= SEARCH HIGHLIGHTING =============
window.DeviationSearch = {
    highlight(text, query) {
        if (!query || !text) return text;
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escaped})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    },
    searchProducts(products, query) {
        if (!query) return products;
        const q = query.toLowerCase();
        return products.filter(p => 
            (p.name && p.name.toLowerCase().includes(q)) ||
            (p.type && p.type.toLowerCase().includes(q)) ||
            (p.generalTrait && p.generalTrait.toLowerCase().includes(q)) ||
            (p.deviatedTrait && p.deviatedTrait.toLowerCase().includes(q))
        );
    }
};

// ============= SORTING =============
window.DeviationSort = {
    byPrice(products, order = 'asc') {
        return [...products].sort((a, b) => {
            const priceA = Number(a.price) || 0;
            const priceB = Number(b.price) || 0;
            return order === 'asc' ? priceA - priceB : priceB - priceA;
        });
    },
    byName(products, order = 'asc') {
        return [...products].sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return order === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
    },
    byStock(products, order = 'desc') {
        return [...products].sort((a, b) => {
            const stockA = Number(a.stock) || 0;
            const stockB = Number(b.stock) || 0;
            return order === 'desc' ? stockB - stockA : stockA - stockB;
        });
    },
    bySales(products, order = 'desc') {
        return [...products].sort((a, b) => {
            const solA = Number(a.sold) || 0;
            const solB = Number(b.sold) || 0;
            return order === 'desc' ? solB - solA : solA - solB;
        });
    }
};

// ============= CSV IMPORT =============
window.DeviationCSV = {
    parseCSV(text) {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const products = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length < 2) continue;
            
            const product = {};
            headers.forEach((header, idx) => {
                if (idx < values.length) {
                    const value = values[idx];
                    if (['stock', 'price', 'sold', 'id'].includes(header)) {
                        product[header] = Number(value) || 0;
                    } else {
                        product[header] = value;
                    }
                }
            });
            
            if (product.name) {
                product.id = product.id || Date.now() + Math.random();
                products.push(product);
            }
        }
        
        return products;
    },
    async importFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const products = this.parseCSV(e.target.result);
                    resolve(products);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    },
    mergeInventory(existing, imported) {
        const merged = [...existing];
        imported.forEach(newProduct => {
            const existing = merged.find(p => p.id === newProduct.id);
            if (existing) {
                Object.assign(existing, newProduct);
            } else {
                merged.push(newProduct);
            }
        });
        return merged;
    }
};

// ============= WISHLIST UI =============
window.DeviationWishlistUI = {
    renderButton(productId, inWishlist = false) {
        const icon = inWishlist ? '❤️' : '🤍';
        return `<button class="wishlist-btn ${inWishlist ? 'active' : ''}" data-product-id="${productId}" title="Add to Wishlist">${icon}</button>`;
    },
    attachListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('wishlist-btn')) {
                const productId = Number(e.target.getAttribute('data-product-id'));
                const isAdded = window.DeviationCart.toggleWishlist(productId);
                e.target.classList.toggle('active', isAdded);
                e.target.textContent = isAdded ? '❤️' : '🤍';
                const product = window.DeviationCart.getProduct(productId);
                const message = isAdded ? `Added to wishlist` : `Removed from wishlist`;
                window.DeviationToast.show(message, isAdded ? 'success' : 'info');
            }
        });
    }
};

// ============= PRODUCT COMPARISON =============
window.DeviationComparison = {
    selectedProducts: [],
    MAX_COMPARE: 3,
    toggleProduct(productId) {
        const idx = this.selectedProducts.indexOf(productId);
        if (idx >= 0) {
            this.selectedProducts.splice(idx, 1);
        } else {
            if (this.selectedProducts.length >= this.MAX_COMPARE) {
                window.DeviationToast.show(`Max ${this.MAX_COMPARE} products can be compared`, 'warning');
                return false;
            }
            this.selectedProducts.push(productId);
        }
        return true;
    },
    isSelected(productId) {
        return this.selectedProducts.includes(productId);
    },
    renderComparison() {
        if (this.selectedProducts.length === 0) {
            return '<p>No products selected for comparison</p>';
        }
        
        const products = this.selectedProducts
            .map(id => window.DeviationCart.getProduct(id))
            .filter(Boolean);
        
        let html = '<table class="comparison-table"><thead><tr><th>Trait</th>';
        products.forEach(p => {
            html += `<th>${window.DeviationCart.escapeHtml(p.name)}</th>`;
        });
        html += '</tr></thead><tbody>';
        
        const traits = ['generalTrait', 'combatTerriCraft', 'deviatedTrait', 'scpTrait'];
        traits.forEach(trait => {
            html += '<tr><td>';
            const traitLabel = trait.replace(/([A-Z])/g, ' $1').trim();
            html += traitLabel;
            html += '</td>';
            products.forEach(p => {
                const value = p[trait] || 'N/A';
                html += `<td>${window.DeviationCart.escapeHtml(value)}</td>`;
            });
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        return html;
    },
    showModal() {
        let modal = document.getElementById('comparison-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'comparison-modal';
            modal.className = 'comparison-modal';
            modal.innerHTML = `
                <div class="comparison-content">
                    <button class="modal-close-btn">✕</button>
                    <h2>Product Comparison</h2>
                    <div id="comparison-table-container"></div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelector('.modal-close-btn').addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }
        modal.querySelector('#comparison-table-container').innerHTML = this.renderComparison();
        modal.classList.add('active');
    }
};

// ============= DASHBOARD STATS =============
window.DeviationDashboard = {
    renderStats() {
        const stats = window.DeviationCart.getSalesStats();
        return `
            <div class="sales-dashboard">
                <div class="stat-card">
                    <div class="stat-label">Total Revenue</div>
                    <div class="stat-value">${window.DeviationCart.formatPrice(stats.totalRevenue)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Items Sold</div>
                    <div class="stat-value">${stats.totalSold}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Orders</div>
                    <div class="stat-value">${stats.totalOrders}</div>
                </div>
            </div>
        `;
    },
    renderBestSellers() {
        const products = window.DeviationCart.products;
        const sorted = [...products]
            .sort((a, b) => (Number(b.sold) || 0) - (Number(a.sold) || 0))
            .slice(0, 5);
        
        let html = '<div class="best-sellers-section"><h3>Best Sellers</h3><ul class="best-sellers-list">';
        sorted.forEach((p, idx) => {
            const sold = Number(p.sold) || 0;
            if (sold > 0) {
                html += `
                    <li>
                        <div>
                            <span class="bestseller-rank">${idx + 1}</span>
                            <span>${window.DeviationCart.escapeHtml(p.name)}</span>
                        </div>
                        <div>${sold} sold</div>
                    </li>
                `;
            }
        });
        html += '</ul></div>';
        return html;
    }
};

// ============= CATEGORIES MANAGER =============
window.DeviationCategoriesUI = {
    render() {
        const categories = window.DeviationCart.getCategories();
        let html = `
            <div class="categories-section">
                <h3>Manage Categories</h3>
                <div class="category-input-group">
                    <input type="text" id="category-input" placeholder="Enter category name">
                    <button id="add-category-btn">Add Category</button>
                </div>
                <div class="category-list">
        `;
        
        categories.forEach(cat => {
            html += `
                <div class="category-tag">
                    <span>${window.DeviationCart.escapeHtml(cat)}</span>
                    <button class="remove-category-btn" data-category="${window.DeviationCart.escapeHtml(cat)}">×</button>
                </div>
            `;
        });
        
        html += '</div></div>';
        return html;
    },
    attachListeners(container) {
        container.addEventListener('click', (e) => {
            if (e.target.id === 'add-category-btn') {
                const input = container.querySelector('#category-input');
                const cat = input.value.trim();
                if (cat) {
                    const cats = window.DeviationCart.getCategories();
                    if (!cats.includes(cat)) {
                        cats.push(cat);
                        window.DeviationCart.saveCategories(cats);
                        window.DeviationToast.show('Category added', 'success');
                        input.value = '';
                        container.innerHTML = this.render();
                        this.attachListeners(container);
                    }
                }
            }
            if (e.target.classList.contains('remove-category-btn')) {
                const cat = e.target.getAttribute('data-category');
                const cats = window.DeviationCart.getCategories();
                const idx = cats.indexOf(cat);
                if (idx >= 0) {
                    cats.splice(idx, 1);
                    window.DeviationCart.saveCategories(cats);
                    window.DeviationToast.show('Category removed', 'success');
                    container.innerHTML = this.render();
                    this.attachListeners(container);
                }
            }
        });
    }
};

// Initialize theme on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.DeviationTheme.init();
        window.DeviationWishlistUI.attachListeners();
    });
} else {
    window.DeviationTheme.init();
    window.DeviationWishlistUI.attachListeners();
}
