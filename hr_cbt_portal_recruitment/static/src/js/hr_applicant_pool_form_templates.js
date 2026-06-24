document.addEventListener('DOMContentLoaded', function () {
    // Set current date in the hidden applied_date field
    const today = new Date().toISOString().split('T')[0];
    const appliedDateField = document.querySelector('input[name="applied_date"]');
    if (appliedDateField) {
        appliedDateField.value = today;
    }

    // Form submission handler
    const form = document.getElementById('applicationForm');
    const submitBtn = document.getElementById('submitBtn');

    if (form && submitBtn) {
        form.addEventListener('submit', function (e) {
            // Optionally disable button and show spinner while submitting
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Submitting...';
        });
    }
});
