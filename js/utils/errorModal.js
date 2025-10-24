// Utility for displaying server error modals

let errorModalInstance = null;

export function showServerErrorModal(message = 'Server not responding', onRetry = null) {
  // Remove existing modal if any
  if (errorModalInstance) {
    errorModalInstance.remove();
  }

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'error-modal-overlay';
  modal.innerHTML = `
    <div class="error-modal-content">
      <div class="error-modal-icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <div class="error-modal-body">
        <h3>Connection Error</h3>
        <p>${escapeHtml(message)}</p>
        <p class="error-modal-hint">Please check your internet connection and try again.</p>
      </div>
      <div class="error-modal-actions">
        ${onRetry ? '<button class="btn-primary" id="error-modal-retry">Retry</button>' : ''}
        <button class="btn-secondary" id="error-modal-close">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  errorModalInstance = modal;

  // Bind close handler
  const closeBtn = modal.querySelector('#error-modal-close');
  closeBtn?.addEventListener('click', () => {
    closeServerErrorModal();
  });

  // Bind retry handler
  if (onRetry) {
    const retryBtn = modal.querySelector('#error-modal-retry');
    retryBtn?.addEventListener('click', async () => {
      retryBtn.disabled = true;
      retryBtn.textContent = 'Retrying...';
      try {
        await onRetry();
        closeServerErrorModal();
      } catch (err) {
        retryBtn.disabled = false;
        retryBtn.textContent = 'Retry';
      }
    });
  }

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeServerErrorModal();
    }
  });
}

export function closeServerErrorModal() {
  if (errorModalInstance) {
    errorModalInstance.remove();
    errorModalInstance = null;
  }
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}
