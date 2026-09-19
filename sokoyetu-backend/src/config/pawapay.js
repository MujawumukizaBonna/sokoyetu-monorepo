require('dotenv').config();

const normalizeBaseUrl = (value) => {
  const base = (value || 'https://api.sandbox.pawapay.io').trim();
  return base.endsWith('/') ? base.slice(0, -1) : base;
};

module.exports = {
  baseUrl: normalizeBaseUrl(process.env.PAWAPAY_BASE_URL),
  apiToken: process.env.PAWAPAY_API_TOKEN || '',
  callbackUrl: process.env.PAWAPAY_CALLBACK_URL || '',
  signedRequestsEnabled: process.env.PAWAPAY_SIGNED_REQUESTS_ENABLED === 'true',
  signedCallbacksEnabled: process.env.PAWAPAY_SIGNED_CALLBACKS_ENABLED === 'true',
  publicKeyId: process.env.PAWAPAY_PUBLIC_KEY_ID || '',
  defaultCountry: process.env.PAWAPAY_DEFAULT_COUNTRY || 'RWA',
  defaultCurrency: process.env.PAWAPAY_DEFAULT_CURRENCY || 'RWF',
};
