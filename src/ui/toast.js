// Toast notification service
let toastTimeout = null;

export function showToast(message, duration = 3000) {
  let existing = document.getElementById('rm-global-toast');
  if (!existing) {
    existing = document.createElement('div');
    existing.id = 'rm-global-toast';
    existing.className = 'rm-toast';
    document.body.appendChild(existing);
  }

  existing.textContent = message;
  existing.style.display = 'block';

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    existing.style.display = 'none';
  }, duration);
}

