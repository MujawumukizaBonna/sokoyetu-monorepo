const crypto = require('crypto');
const config = require('../config/pawapay');

const buildUrl = (path) => `${config.baseUrl}${path}`;

const createError = (message, status = 500, details = null) => {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
};

const requestJson = async (path, options = {}) => {
  if (!config.apiToken) {
    throw createError('pawaPay is not configured on the backend', 503);
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw createError('pawaPay request failed', response.status, payload);
  }

  return payload;
};

const createDepositId = () => crypto.randomUUID();

const normalizePaymentStatus = (status) => {
  switch (String(status || '').toUpperCase()) {
    case 'ACCEPTED':
    case 'SUBMITTED':
    case 'PROCESSING':
      return 'processing';
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
    case 'REJECTED':
      return 'failed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'pending';
  }
};

const initiateDeposit = async ({
  depositId,
  amount,
  currency,
  phoneNumber,
  provider,
  clientReferenceId,
  customerMessage,
  metadata,
  country,
}) => {
  const payload = {
    depositId,
    amount: String(amount),
    currency,
    payer: {
      type: 'MMO',
      accountDetails: {
        phoneNumber,
        provider,
      },
    },
  };

  if (clientReferenceId) payload.clientReferenceId = clientReferenceId;
  if (customerMessage) payload.customerMessage = customerMessage;
  if (metadata) payload.metadata = metadata;
  if (country) payload.country = country;

  return requestJson('/v2/deposits', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

const checkDepositStatus = async (depositId) =>
  requestJson(`/v2/deposits/${depositId}`, { method: 'GET' });

const getActiveConfiguration = async ({ country, operationType = 'DEPOSIT' } = {}) => {
  const params = new URLSearchParams();
  if (country) params.set('country', country);
  if (operationType) params.set('operationType', operationType);
  const query = params.toString();
  return requestJson(`/v2/active-conf${query ? `?${query}` : ''}`, { method: 'GET' });
};

const getAvailability = async ({ country, operationType = 'DEPOSIT' } = {}) => {
  const params = new URLSearchParams();
  if (country) params.set('country', country);
  if (operationType) params.set('operationType', operationType);
  const query = params.toString();
  return requestJson(`/v2/availability${query ? `?${query}` : ''}`, { method: 'GET' });
};

const predictProvider = async ({ phoneNumber }) =>
  requestJson('/v2/predict-provider', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber }),
  });

const createPaymentPageSession = async ({ depositId, returnUrl, amount, currency, phoneNumber, country, reason, metadata, customerMessage }) => {
  const payload = { depositId, returnUrl };
  if (amount !== undefined && amount !== null) {
    payload.amountDetails = { amount: String(amount), currency };
  }
  if (phoneNumber) payload.phoneNumber = phoneNumber;
  if (country) payload.country = country;
  if (reason) payload.reason = reason;
  if (metadata) payload.metadata = metadata;
  if (customerMessage) payload.customerMessage = customerMessage;

  return requestJson('/v2/paymentpage', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

module.exports = {
  createDepositId,
  initiateDeposit,
  checkDepositStatus,
  getActiveConfiguration,
  getAvailability,
  predictProvider,
  createPaymentPageSession,
  normalizePaymentStatus,
};
