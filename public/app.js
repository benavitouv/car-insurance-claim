const form = document.querySelector('#claim-form');
const statusEl = document.querySelector('#status');
const statusText = document.querySelector('#status-text');
const submitBtn = document.querySelector('#submit-btn');
const successModal = document.querySelector('#success-modal');
const successClose = document.querySelector('#success-close');

const policyFileInput = document.querySelector('#policy_file');
const evidenceFileInput = document.querySelector('#claim_file');

const formatBytes = (bytes) => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const setupDropZone = (dropZone, fileInput, fileNameEl, fileSizeEl, { multiple = false, emptyText = 'No file selected' } = {}) => {
  const updateMeta = (files) => {
    if (!files || files.length === 0) {
      fileNameEl.textContent = emptyText;
      fileSizeEl.textContent = '—';
      return;
    }
    if (files.length === 1) {
      fileNameEl.textContent = files[0].name;
      fileSizeEl.textContent = formatBytes(files[0].size);
    } else {
      const totalSize = Array.from(files).reduce((sum, f) => sum + f.size, 0);
      fileNameEl.textContent = `${files.length} photos selected`;
      fileSizeEl.textContent = formatBytes(totalSize);
    }
  };

  fileInput.addEventListener('change', () => updateMeta(fileInput.files));

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
    const dropped = event.dataTransfer?.files;
    if (dropped && dropped.length > 0) {
      const dataTransfer = new DataTransfer();
      if (multiple) {
        Array.from(dropped).forEach((f) => dataTransfer.items.add(f));
      } else {
        dataTransfer.items.add(dropped[0]);
      }
      fileInput.files = dataTransfer.files;
      updateMeta(fileInput.files);
    }
  });

  return updateMeta;
};

const updatePolicyMeta = setupDropZone(
  document.querySelector('#drop-zone-policy'),
  policyFileInput,
  document.querySelector('#policy-file-name'),
  document.querySelector('#policy-file-size'),
  { multiple: false, emptyText: 'No file selected' }
);

const updateEvidenceMeta = setupDropZone(
  document.querySelector('#drop-zone-evidence'),
  evidenceFileInput,
  document.querySelector('#evidence-file-name'),
  document.querySelector('#evidence-file-size'),
  { multiple: true, emptyText: 'No photos selected' }
);

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

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('', '');
  hideSuccessModal();

  const policyFiles = policyFileInput.files;
  const evidenceFiles = evidenceFileInput.files;

  if (!policyFiles || policyFiles.length === 0) {
    setStatus('error', 'Please attach your policy certificate before submitting.');
    return;
  }

  if (!evidenceFiles || evidenceFiles.length === 0) {
    setStatus('error', 'Please attach at least one evidence photo before submitting.');
    return;
  }

  submitBtn.disabled = true;
  form.classList.add('is-loading');
  setStatus('info', 'Uploading files and submitting your claim...');

  try {
    const formData = new FormData(form);
    formData.delete('claim_file');
    Array.from(evidenceFiles).forEach((f) => formData.append('claim_file', f));

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
    updatePolicyMeta(null);
    updateEvidenceMeta(null);
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
