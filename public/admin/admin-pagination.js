/**
 * admin-pagination.js
 * Reusable client-side pagination for admin table pages.
 *
 * Usage:
 *   const pager = new AdminPagination({
 *       containerId: 'pagination-bar',  // id of the pagination bar div
 *       perPageOptions: [10, 25, 50, 100],
 *       defaultPerPage: 10,
 *       onPageChange: (page, perPage) => { ... render the slice ... }
 *   });
 *   // After data loads or filters change:
 *   pager.setTotal(filteredData.length);
 *   pager.goToPage(1);
 */
class AdminPagination {
    constructor({ containerId, perPageOptions = [10, 25, 50, 100], defaultPerPage = 10, onPageChange }) {
        this.container = document.getElementById(containerId);
        this.perPageOptions = perPageOptions;
        this.perPage = defaultPerPage;
        this.currentPage = 1;
        this.totalItems = 0;
        this.onPageChange = onPageChange;
        this._buildUI();
    }

    _buildUI() {
        this.container.innerHTML = '';
        this.container.className = 'pagination-bar';

        // Per-page selector
        const perPageDiv = document.createElement('div');
        perPageDiv.className = 'pg-per-page';
        perPageDiv.innerHTML = '<span>Show</span>';
        const sel = document.createElement('select');
        sel.id = this.container.id + '-select';
        this.perPageOptions.forEach(n => {
            const opt = document.createElement('option');
            opt.value = n;
            opt.textContent = n;
            if (n === this.perPage) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', () => {
            this.perPage = parseInt(sel.value, 10);
            this.goToPage(1);
        });
        perPageDiv.appendChild(sel);
        perPageDiv.innerHTML += '<span>per page</span>';
        // Re-attach listener after innerHTML
        const realSel = perPageDiv.querySelector('select');
        realSel.addEventListener('change', () => {
            this.perPage = parseInt(realSel.value, 10);
            this.goToPage(1);
        });
        this.container.appendChild(perPageDiv);

        // Info text
        const info = document.createElement('span');
        info.className = 'pg-info';
        info.id = this.container.id + '-info';
        this.container.appendChild(info);

        // Buttons
        const btnsDiv = document.createElement('div');
        btnsDiv.className = 'pg-buttons';
        btnsDiv.id = this.container.id + '-buttons';
        this.container.appendChild(btnsDiv);
    }

    get totalPages() {
        return Math.max(1, Math.ceil(this.totalItems / this.perPage));
    }

    setTotal(n) {
        this.totalItems = n;
    }

    goToPage(page) {
        this.currentPage = Math.max(1, Math.min(page, this.totalPages));
        this._render();
        if (this.onPageChange) {
            this.onPageChange(this.currentPage, this.perPage);
        }
    }

    getSlice(data) {
        const start = (this.currentPage - 1) * this.perPage;
        return data.slice(start, start + this.perPage);
    }

    _render() {
        const tp = this.totalPages;
        const cp = this.currentPage;
        const start = (cp - 1) * this.perPage + 1;
        const end = Math.min(cp * this.perPage, this.totalItems);

        // Info
        const info = document.getElementById(this.container.id + '-info');
        if (this.totalItems === 0) {
            info.textContent = '0 items';
        } else {
            info.textContent = `${start}–${end} of ${this.totalItems}`;
        }

        // Buttons
        const btnsDiv = document.getElementById(this.container.id + '-buttons');
        btnsDiv.innerHTML = '';

        // Prev
        const prevBtn = this._createBtn('‹', cp <= 1, () => this.goToPage(cp - 1));
        btnsDiv.appendChild(prevBtn);

        // Page numbers (show max 5 centered around current)
        const maxVisible = 5;
        let startPage = Math.max(1, cp - Math.floor(maxVisible / 2));
        let endPage = Math.min(tp, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
            btnsDiv.appendChild(this._createBtn('1', false, () => this.goToPage(1)));
            if (startPage > 2) btnsDiv.appendChild(this._createEllipsis());
        }

        for (let i = startPage; i <= endPage; i++) {
            const btn = this._createBtn(i.toString(), false, () => this.goToPage(i));
            if (i === cp) btn.classList.add('pg-active');
            btnsDiv.appendChild(btn);
        }

        if (endPage < tp) {
            if (endPage < tp - 1) btnsDiv.appendChild(this._createEllipsis());
            btnsDiv.appendChild(this._createBtn(tp.toString(), false, () => this.goToPage(tp)));
        }

        // Next
        const nextBtn = this._createBtn('›', cp >= tp, () => this.goToPage(cp + 1));
        btnsDiv.appendChild(nextBtn);
    }

    _createBtn(text, disabled, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pg-btn';
        btn.textContent = text;
        btn.disabled = disabled;
        if (!disabled) btn.addEventListener('click', onClick);
        return btn;
    }

    _createEllipsis() {
        const span = document.createElement('span');
        span.style.cssText = 'padding:0 4px;color:var(--text-secondary);font-weight:600;';
        span.textContent = '…';
        return span;
    }
}
