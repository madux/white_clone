document.addEventListener('DOMContentLoaded', () => {
  const inviteBackdrop = document.getElementById('modalInviteMemberBackdrop');

  function openInviteModal() {
    if (inviteBackdrop) inviteBackdrop.style.display = 'flex';
  }

  function closeInviteModal() {
    if (inviteBackdrop) inviteBackdrop.style.display = 'none';
  }

  document.querySelectorAll('.btn-invite-member').forEach(btn => {
    btn.addEventListener('click', openInviteModal);
  });

  document.querySelectorAll('#btnCloseInviteModal, #btnCancelInviteModal, #btnSubmitInviteMember').forEach(el => {
    if (el) el.addEventListener('click', closeInviteModal);
  });

  if (inviteBackdrop) {
    inviteBackdrop.addEventListener('click', function(e) {
      if (e.target === inviteBackdrop) closeInviteModal();
    });
  }
});