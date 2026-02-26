const form = document.querySelector('#claim-form');
const statusEl = document.querySelector('#status');
const statusText = document.querySelector('#status-text');
const submitBtn = document.querySelector('#submit-btn');
const processingModal = document.querySelector('#processing-modal');
const errorModal = document.querySelector('#error-modal');
const errorMessage = document.querySelector('#error-message');
const errorClose = document.querySelector('#error-close');
const successModal = document.querySelector('#success-modal');
const successClose = document.querySelector('#success-close');

const policyFileInput = document.querySelector('#policy_file');
const evidenceFileInput = document.querySelector('#claim_file');
const evidencePreviewsEl = document.querySelector('#evidence-previews');

const formatBytes = (bytes) => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

// ── Policy drop zone (single file, simple) ───────────────────────────────────

const setupDropZone = (dropZone, fileInput, fileNameEl, fileSizeEl, { multiple = false, emptyText = 'No file selected', onFilesChange = null } = {}) => {
  const updateMeta = (files) => {
    if (!files || files.length === 0) {
      fileNameEl.textContent = emptyText;
      fileSizeEl.textContent = '—';
    } else if (files.length === 1) {
      fileNameEl.textContent = files[0].name;
      fileSizeEl.textContent = formatBytes(files[0].size);
    } else {
      const totalSize = Array.from(files).reduce((sum, f) => sum + f.size, 0);
      fileNameEl.textContent = `${files.length} photos selected`;
      fileSizeEl.textContent = formatBytes(totalSize);
    }
    if (onFilesChange) onFilesChange(files);
  };

  fileInput.addEventListener('change', () => updateMeta(fileInput.files));

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add('is-dragover');
    });
  });

  ['dragleave', 'dragend', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('is-dragover'));
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

// ── Evidence drop zone (accumulative, with remove-per-photo) ─────────────────

let evidenceFiles = [];
let evidenceObjectURLs = [];

const syncEvidenceInput = () => {
  const dataTransfer = new DataTransfer();
  evidenceFiles.forEach((f) => dataTransfer.items.add(f));
  evidenceFileInput.files = dataTransfer.files;
};

const updateEvidenceMeta = () => {
  const fileNameEl = document.querySelector('#evidence-file-name');
  const fileSizeEl = document.querySelector('#evidence-file-size');
  if (evidenceFiles.length === 0) {
    fileNameEl.textContent = 'No photos selected';
    fileSizeEl.textContent = '—';
  } else if (evidenceFiles.length === 1) {
    fileNameEl.textContent = evidenceFiles[0].name;
    fileSizeEl.textContent = formatBytes(evidenceFiles[0].size);
  } else {
    const totalSize = evidenceFiles.reduce((sum, f) => sum + f.size, 0);
    fileNameEl.textContent = `${evidenceFiles.length} photos selected`;
    fileSizeEl.textContent = formatBytes(totalSize);
  }
};

const renderEvidencePreviews = () => {
  evidenceObjectURLs.forEach((url) => URL.revokeObjectURL(url));
  evidenceObjectURLs = [];
  evidencePreviewsEl.innerHTML = '';
  evidenceFiles.forEach((file, index) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    evidenceObjectURLs.push(url);
    const item = document.createElement('div');
    item.className = 'preview-item';
    const img = document.createElement('img');
    img.src = url;
    img.alt = file.name;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preview-remove';
    btn.setAttribute('aria-label', `Remove ${file.name}`);
    btn.textContent = '×';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      evidenceFiles.splice(index, 1);
      syncEvidenceInput();
      updateEvidenceMeta();
      renderEvidencePreviews();
    });
    item.appendChild(img);
    item.appendChild(btn);
    evidencePreviewsEl.appendChild(item);
  });
};

const addEvidenceFiles = (newFiles) => {
  Array.from(newFiles).forEach((f) => {
    const isDup = evidenceFiles.some(
      (ef) => ef.name === f.name && ef.size === f.size && ef.lastModified === f.lastModified
    );
    if (!isDup) evidenceFiles.push(f);
  });
  syncEvidenceInput();
  updateEvidenceMeta();
  renderEvidencePreviews();
};

const clearEvidenceFiles = () => {
  evidenceFiles = [];
  syncEvidenceInput();
  updateEvidenceMeta();
  renderEvidencePreviews();
};

// Accumulate on native file picker selection
evidenceFileInput.addEventListener('change', () => {
  if (evidenceFileInput.files.length > 0) addEvidenceFiles(evidenceFileInput.files);
});

const evidenceDropZone = document.querySelector('#drop-zone-evidence');

['dragenter', 'dragover'].forEach((eventName) => {
  evidenceDropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    evidenceDropZone.classList.add('is-dragover');
  });
});

['dragleave', 'dragend', 'drop'].forEach((eventName) => {
  evidenceDropZone.addEventListener(eventName, () => evidenceDropZone.classList.remove('is-dragover'));
});

evidenceDropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  const dropped = event.dataTransfer?.files;
  if (dropped && dropped.length > 0) addEvidenceFiles(dropped);
});

// ── Status & modal ────────────────────────────────────────────────────────────

const setStatus = (type, message) => {
  statusEl.dataset.type = type;
  statusText.textContent = message;
};

const showModal = (el) => { el.classList.add('is-visible'); el.setAttribute('aria-hidden', 'false'); };
const hideModal = (el) => { el.classList.remove('is-visible'); el.setAttribute('aria-hidden', 'true'); };

const showSuccessModal = () => showModal(successModal);
const hideSuccessModal = () => hideModal(successModal);

// ── Submit ────────────────────────────────────────────────────────────────────

const MOCK_CASE_ID = 'INS-435351';
const caseIdDisplay = document.querySelector('#case-id-display');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('', '');

  if (!policyFileInput.files || policyFileInput.files.length === 0) {
    setStatus('error', 'Please attach your policy certificate before submitting.');
    return;
  }

  if (evidenceFiles.length === 0) {
    setStatus('error', 'Please attach at least one evidence photo before submitting.');
    return;
  }

  submitBtn.disabled = true;
  form.classList.add('is-loading');
  showModal(processingModal);

  await new Promise((resolve) => setTimeout(resolve, 15000));

  hideModal(processingModal);
  submitBtn.disabled = false;
  form.classList.remove('is-loading');

  const emailValue = (form.querySelector('[name="email"]')?.value || '').trim();
  const hasDot = emailValue.split('@')[0].includes('.');

  if (hasDot) {
    errorMessage.textContent =
      'Our records indicate the vehicle was struck from behind, but only a front-facing photo was provided. Please attach the correct evidence and resubmit.';
    showModal(errorModal);
  } else {
    caseIdDisplay.textContent = MOCK_CASE_ID;
    form.reset();
    updatePolicyMeta(null);
    clearEvidenceFiles();
    showSuccessModal();
  }
});

errorClose.addEventListener('click', () => hideModal(errorModal));
successClose.addEventListener('click', () => hideSuccessModal());
