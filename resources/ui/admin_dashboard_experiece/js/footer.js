function renderFooter() {
  const roots = document.querySelectorAll('.footer-root');
  const html = '<footer class="footer">' +
    '<div>© 2026 CLEON HR Management System</div>' +
    '<div class="footer-links">' +
      '<a href="#">PRIVACY POLICY</a>' +
      '<a href="#">TERMS OF SERVICE</a>' +
      '<a href="#">SECURITY</a>' +
    '</div>' +
    '<div class="system-status"><span class="status-dot"></span>SYSTEM ONLINE · CLUSTER NY-1</div>' +
  '</footer>';
  roots.forEach(function(root) {
    root.innerHTML = html;
  });
}
