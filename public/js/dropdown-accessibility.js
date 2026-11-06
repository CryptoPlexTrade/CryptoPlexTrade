(() => {
    const wrapperSelector = '.csd-wrapper, .asset-select-wrap, #miner-fee-group, #miner-select-wrap';
    const triggerSelector = '.csd-trigger, .asset-select-trigger, #miner-trigger';
    const optionSelector = '.csd-option, .asset-option';

    function getParts(wrapper) {
        return {
            trigger: wrapper.querySelector(triggerSelector),
            dropdown: wrapper.querySelector('.csd-dropdown, .asset-select-dropdown, #miner-dropdown')
        };
    }

    function isOpen(wrapper) {
        const { dropdown } = getParts(wrapper);
        return wrapper.classList.contains('csd-open') || wrapper.classList.contains('open') || Boolean(dropdown?.classList.contains('open'));
    }

    function syncAccessibility(wrapper) {
        const { trigger, dropdown } = getParts(wrapper);
        if (!trigger || !dropdown) return;
        if (!dropdown.id) dropdown.id = `menu-${Math.random().toString(36).slice(2, 10)}`;
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-controls', dropdown.id);
        trigger.setAttribute('aria-expanded', String(isOpen(wrapper)));
        dropdown.setAttribute('role', 'listbox');
        wrapper.querySelectorAll(optionSelector).forEach(option => {
            option.setAttribute('role', 'option');
            option.tabIndex = -1;
            option.setAttribute('aria-selected', String(option.classList.contains('csd-active') || option.classList.contains('selected')));
        });
    }

    function closeMenu(wrapper) {
        wrapper.classList.remove('csd-open', 'open');
        wrapper.querySelectorAll('.csd-dropdown, .asset-select-dropdown, #miner-dropdown').forEach(dropdown => dropdown.classList.remove('open'));
        if (wrapper.id === 'miner-select-wrap' || wrapper.id === 'miner-fee-group') {
            document.getElementById('miner-fee-group')?.classList.remove('open');
        }
        syncAccessibility(wrapper);
    }

    function positionMenu(wrapper) {
        if (!wrapper.classList.contains('csd-wrapper')) return;
        const { trigger, dropdown } = getParts(wrapper);
        if (!trigger || !dropdown || !isOpen(wrapper)) return;

        const rect = trigger.getBoundingClientRect();
        const margin = 8;
        const width = Math.min(Math.max(rect.width, 180), window.innerWidth - margin * 2);
        const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
        const below = Math.max(0, window.innerHeight - rect.bottom - margin);
        const above = Math.max(0, rect.top - margin);
        const naturalHeight = Math.min(260, dropdown.scrollHeight || 260);
        const openBelow = below >= Math.min(naturalHeight, 120) || below >= above;
        const available = openBelow ? below : above;

        dropdown.style.left = `${left}px`;
        dropdown.style.width = `${width}px`;
        dropdown.style.maxHeight = `${Math.max(80, Math.min(260, available))}px`;
        dropdown.style.top = openBelow ? `${rect.bottom + 6}px` : 'auto';
        dropdown.style.bottom = openBelow ? 'auto' : `${window.innerHeight - rect.top + 6}px`;
    }

    function initialize(root = document) {
        root.querySelectorAll?.(wrapperSelector).forEach(syncAccessibility);
    }

    function focusOption(wrapper, direction = 1, edge = '') {
        const options = [...wrapper.querySelectorAll(optionSelector)];
        if (!options.length) return;
        const currentIndex = options.indexOf(document.activeElement);
        const nextIndex = edge === 'first' ? 0 : edge === 'last' ? options.length - 1 : (currentIndex + direction + options.length) % options.length;
        options[nextIndex].focus();
    }

    initialize();
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const wrapper = node.closest?.(wrapperSelector);
            if (wrapper) syncAccessibility(wrapper);
            if (node.matches?.(wrapperSelector)) syncAccessibility(node);
            initialize(node);
        }
    }))).observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener('click', event => {
        const clickedOption = event.target.closest?.(optionSelector);
        const optionWrapper = clickedOption?.closest(wrapperSelector);
        requestAnimationFrame(() => {
            document.querySelectorAll(wrapperSelector).forEach(wrapper => {
                syncAccessibility(wrapper);
                positionMenu(wrapper);
            });
            if (optionWrapper && !isOpen(optionWrapper) && clickedOption === document.activeElement) {
                getParts(optionWrapper).trigger?.focus();
            }
        });
    }, true);

    document.addEventListener('keydown', event => {
        const trigger = event.target.closest?.(triggerSelector);
        const option = event.target.closest?.(optionSelector);
        const wrapper = event.target.closest?.(wrapperSelector);

        if (trigger && wrapper) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeMenu(wrapper);
                trigger.focus();
                return;
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                if (!isOpen(wrapper)) trigger.click();
                syncAccessibility(wrapper);
                positionMenu(wrapper);
                focusOption(wrapper, event.key === 'ArrowDown' ? 1 : -1, event.key === 'ArrowDown' ? 'first' : 'last');
                return;
            }
            if ((event.key === 'Enter' || event.key === ' ') && trigger.matches('.csd-trigger')) {
                requestAnimationFrame(() => {
                    if (isOpen(wrapper)) focusOption(wrapper, 1, 'first');
                });
            }
            return;
        }

        if (!option || !wrapper) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            const { trigger: menuTrigger } = getParts(wrapper);
            closeMenu(wrapper);
            menuTrigger?.focus();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            focusOption(wrapper, event.key === 'ArrowDown' ? 1 : -1);
        } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            focusOption(wrapper, 1, event.key === 'Home' ? 'first' : 'last');
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            option.click();
            requestAnimationFrame(() => getParts(wrapper).trigger?.focus());
        }
    });

    window.addEventListener('resize', () => document.querySelectorAll(wrapperSelector).forEach(positionMenu));
    window.addEventListener('scroll', () => document.querySelectorAll(wrapperSelector).forEach(positionMenu), true);
})();