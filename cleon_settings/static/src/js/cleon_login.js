/* ================================================================
   CleonHR Login interactions
   ================================================================ */

(function () {
  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(function () {
    var eyeBtn = document.querySelector('[data-cleonhr-toggle-pwd]');
    if (eyeBtn) {
      eyeBtn.addEventListener('click', function () {
        var id = eyeBtn.getAttribute('data-cleonhr-toggle-pwd') || 'password';
        var input = document.getElementById(id);
        if (!input) return;
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        eyeBtn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    }

    // Temporarily disabled — Use Default Credentials
    // var defaultBtn = document.querySelector('[data-cleonhr-default-creds]');
    // if (defaultBtn) {
    //   defaultBtn.addEventListener('click', function () {
    //     var login = document.getElementById('login');
    //     var password = document.getElementById('password');
    //     if (login) login.value = 'admin';
    //     if (password) {
    //       password.type = 'password';
    //       password.value = 'admin';
    //     }
    //     if (login) login.focus();
    //   });
    // }
  });
})();
