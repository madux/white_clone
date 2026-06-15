const INITIAL_VENDORS = [
    { id: 1, name: "TechRecruit Solutions", email: "contact@techrecruit.com", phone: "+1 234 567 8901", website: "https://techrecruit.com", specializations: ["IT", "Software Engineering"], status: "Active", notes: "Preferred vendor for technical roles" },
    { id: 2, name: "Healthcare Connect Agency", email: "info@healthcareconnect.com", phone: "+1 234 567 8902", website: "https://healthcareconnect.com", specializations: ["Healthcare", "Medical"], status: "Active", notes: "" },
    { id: 3, name: "SalesForce Staffing", email: "hello@salesforcestaffing.com", phone: "+1 234 567 8903", website: "https://salesforcestaffing.com", specializations: ["Sales", "Marketing"], status: "Active", notes: "" },
    { id: 4, name: "Finance & Accounting Pros", email: "team@financepros.com", phone: "+1 234 567 8904", website: "", specializations: ["Finance", "Accounting", "Audit"], status: "Inactive", notes: "On hold since Q2" },
    { id: 5, name: "Global HR Partners", email: "contact@globalhrp.com", phone: "+1 234 567 8905", website: "https://globalhrp.com", specializations: ["HR", "Administration"], status: "Active", notes: "" },
    { id: 6, name: "Executive Search Elite", email: "search@executiveelite.com", phone: "+1 234 567 8906", website: "https://executiveelite.com", specializations: ["Executive", "C-Suite"], status: "Active", notes: "Premium executive search firm" },
];

let vendors = [...INITIAL_VENDORS];

const elements = {
    tableBody: document.getElementById('vn-table-body'),
    emptyState: document.getElementById('vn-empty-state'),
    searchBar: document.getElementById('vn-search-bar'),
    countTotal: document.getElementById('vn-count-total'),
    countActive: document.getElementById('vn-count-active'),
    openModalBtn: document.getElementById('vn-open-modal-btn')
};

function renderVendors(filterText) {
    if (filterText === undefined) filterText = '';
    elements.tableBody.innerHTML = '';

    const filteredVendors = vendors.filter(function(v) {
        return v.name.toLowerCase().indexOf(filterText.toLowerCase()) !== -1 ||
            v.specializations.some(function(tag) {
                return tag.toLowerCase().indexOf(filterText.toLowerCase()) !== -1;
            });
    });

    if (filteredVendors.length === 0) {
        elements.emptyState.style.display = 'block';
    } else {
        elements.emptyState.style.display = 'none';
    }

    filteredVendors.forEach(function(vendor) {
        var tr = document.createElement('tr');

        var specsHTML = vendor.specializations.map(function(tag) {
            return '<span class="vn-inline-tag">' + tag + '</span>';
        }).join('');

        var statusBadgeClass = vendor.status === 'Active' ? 'vn-badge-active' : 'vn-badge-inactive';

        tr.innerHTML =
            '<td>' +
                '<div style="font-weight: 600;">' + vendor.name + '</div>' +
                '<div class="vn-text-secondary">' + (vendor.website || 'No website') + '</div>' +
            '</td>' +
            '<td>' +
                '<div>' + (vendor.email || '-') + '</div>' +
                '<div class="vn-text-secondary">' + (vendor.phone || '-') + '</div>' +
            '</td>' +
            '<td>' + (specsHTML || '<span class="vn-text-secondary">None</span>') + '</td>' +
            '<td style="font-weight: 600; color: #1e293b;">0</td>' +
            '<td>' +
                '<span class="vn-badge-pill ' + statusBadgeClass + '">' + vendor.status + '</span>' +
            '</td>' +
            '<td>' +
                '<div class="vn-action-btn-row">' +
                    '<button class="vn-row-delete-btn" onclick="deleteVendor(' + vendor.id + ')" title="Delete Vendor">' +
                        '<i class="fa-solid fa-trash-can"></i>' +
                    '</button>' +
                '</div>' +
            '</td>';

        elements.tableBody.appendChild(tr);
    });

    updateMetrics();
}

function updateMetrics() {
    elements.countTotal.textContent = vendors.length;
    elements.countActive.textContent = vendors.filter(function(v) { return v.status === 'Active'; }).length;
}

function deleteVendor(id) {
    vendors = vendors.filter(function(vendor) { return vendor.id !== id; });
    renderVendors(elements.searchBar.value);
}

elements.openModalBtn.addEventListener('click', function() {
    if (window.openAddVendorModal) window.openAddVendorModal();
});

elements.searchBar.addEventListener('input', function(e) {
    renderVendors(e.target.value);
});

renderVendors();
