const form = document.querySelector('#claim-form');
const dropZone = document.querySelector('#drop-zone');
const fileInput = document.querySelector('#claim_file');
const fileName = document.querySelector('#file-name');
const fileSize = document.querySelector('#file-size');
const statusEl = document.querySelector('#status');
const statusText = document.querySelector('#status-text');
const submitBtn = document.querySelector('#submit-btn');
const successModal = document.querySelector('#success-modal');
const successClose = document.querySelector('#success-close');

const formatBytes = (bytes) => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const updateFileMeta = (files) => {
  if (!files || files.length === 0) {
    fileName.textContent = 'No photos selected';
    fileSize.textContent = '—';
    return;
  }
  if (files.length === 1) {
    fileName.textContent = files[0].name;
    fileSize.textContent = formatBytes(files[0].size);
  } else {
    const totalSize = Array.from(files).reduce((sum, f) => sum + f.size, 0);
    fileName.textContent = `${files.length} photos selected`;
    fileSize.textContent = formatBytes(totalSize);
  }
};

const setStatus = (type, message) => {
  statusEl.dataset.type = type;
  statusText.textContent = message;
};

const showSuccessModal = () => {
  successModal.classList.add('is-visible');
  successModal.setAttribute('aria-hidden', 'false');
};

const hideSuccessModal = () => {
  successModal.classList.remove('is-visible');
  successModal.setAttribute('aria-hidden', 'true');
};

const syncInputFiles = (fileList) => {
  const dataTransfer = new DataTransfer();
  Array.from(fileList).forEach((f) => dataTransfer.items.add(f));
  fileInput.files = dataTransfer.files;
};

fileInput.addEventListener('change', () => {
  updateFileMeta(fileInput.files);
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('is-dragover');
  });
});

['dragleave', 'dragend', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, () => {
    dropZone.classList.remove('is-dragover');
  });
});

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    syncInputFiles(files);
    updateFileMeta(files);
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('', '');
  hideSuccessModal();

  const files = fileInput.files;

  if (!files || files.length === 0) {
    setStatus('error', 'Please attach at least one evidence photo before submitting.');
    return;
  }

  submitBtn.disabled = true;
  form.classList.add('is-loading');
  setStatus('info', 'Uploading photos and submitting your claim...');

  try {
    const formData = new FormData(form);
    formData.delete('claim_file');
    Array.from(files).forEach((f) => formData.append('claim_file', f));

    const response = await fetch('/api/submit', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data?.message || 'An error occurred while submitting your claim.');
    }

    setStatus('success', 'Claim submitted successfully! Our claims team will be in touch shortly.');
    form.reset();
    updateFileMeta(null);
    showSuccessModal();
  } catch (error) {
    setStatus('error', error instanceof Error ? error.message : 'An unexpected error occurred.');
  } finally {
    submitBtn.disabled = false;
    form.classList.remove('is-loading');
  }
});

successClose.addEventListener('click', () => {
  hideSuccessModal();
  setStatus('', '');
});
