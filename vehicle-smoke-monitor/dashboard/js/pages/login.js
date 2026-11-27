import { CONFIG } from '../config.js';
import { login } from '../api/auth.js';
import { isAuthenticated } from '../utils/auth-guard.js';
import { $, brandHtml, icon } from '../utils/dom.js';

if (isAuthenticated()) window.location.replace(CONFIG.HOME_URL);

$('#brand').innerHTML = brandHtml();
$('#pinToggle').innerHTML = icon('eye');
$('#demoNote').hidden = !CONFIG.DEMO_MODE;

const form = $('#loginForm');
const nameInput = $('#officerName');
const pinInput = $('#pin');
const submitBtn = $('#submitBtn');
const formAlert = $('#formAlert');

function setFieldError(input, errorEl, message) {
  errorEl.textContent = message || '';
  errorEl.hidden = !message;
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function showAlert(message) {
  formAlert.textContent = message;
  formAlert.hidden = !message;
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle('is-loading', isLoading);
  $('#submitLabel').textContent = isLoading ? 'Signing in...' : 'Sign In';
}

$('#pinToggle').addEventListener('click', () => {
  const show = pinInput.type === 'password';
  pinInput.type = show ? 'text' : 'password';
  $('#pinToggle').innerHTML = icon(show ? 'eyeOff' : 'eye');
  $('#pinToggle').setAttribute('aria-label', show ? 'Hide PIN' : 'Show PIN');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showAlert('');

  const name = nameInput.value.trim();
  const pin = pinInput.value;

  setFieldError(nameInput, $('#officerNameError'), name ? '' : 'Enter your officer name.');
  setFieldError(pinInput, $('#pinError'), pin ? '' : 'Enter your access PIN.');
  if (!name || !pin) return;

  setLoading(true);
  try {
    await login(name, pin);
    window.location.replace(CONFIG.HOME_URL);
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      showAlert('Invalid officer name or access PIN.');
    } else if (err.isNetworkError) {
      showAlert('Cannot reach the server. Check that the backend is running.');
    } else {
      showAlert(err.message || 'Sign in failed. Please try again.');
    }
    setLoading(false);
  }
});