function createAlertDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'app-alert';
  dialog.dataset.component = 'alert-dialog';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-label', '알림');
  dialog.setAttribute('aria-describedby', 'app-alert-message');
  dialog.innerHTML = `
    <p class="app-alert__message" id="app-alert-message" data-field="alert-message"></p>
    <div class="app-alert__actions" data-field="alert-actions">
      <button class="app-alert__button app-alert__button--cancel" type="button" data-action="cancel-alert"></button>
      <button class="app-alert__button app-alert__button--confirm" type="button" data-action="confirm-alert"></button>
    </div>
  `;
  dialog.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'confirm-alert') dialog.close('confirm');
    if (action === 'cancel-alert') dialog.close('cancel');
  });
  document.body.append(dialog);
  return dialog;
}

export function showAlert({ message, confirmLabel = '확인', cancelLabel = null, danger = false }) {
  const dialog = document.querySelector('[data-component="alert-dialog"]') ?? createAlertDialog();
  if (dialog.open) return Promise.resolve(false);

  const cancelButton = dialog.querySelector('[data-action="cancel-alert"]');
  const confirmButton = dialog.querySelector('[data-action="confirm-alert"]');
  dialog.querySelector('[data-field="alert-message"]').textContent = message;
  dialog.querySelector('[data-field="alert-actions"]').dataset.state = cancelLabel ? 'confirm' : 'notice';
  cancelButton.textContent = cancelLabel ?? '';
  cancelButton.hidden = !cancelLabel;
  confirmButton.textContent = confirmLabel;
  confirmButton.dataset.state = danger ? 'danger' : 'default';
  dialog.returnValue = '';

  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    dialog.showModal();
    (cancelLabel ? cancelButton : confirmButton).focus();
  });
}
