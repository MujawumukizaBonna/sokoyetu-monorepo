const crypto = require('crypto');
const config = require('../config/pawapay');

let publicKeyCache = {
  fetchedAt: 0,
  keys: [],
};

const PUBLIC_KEY_TTL_MS = 10 * 60 * 1000;

const createError = (message, status = 403) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const requestJson = async (path) => {
  if (!config.apiToken) {
    throw createError('pawaPay is not configured on the backend', 503);
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
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
    throw createError('Unable to load pawaPay public keys', response.status);
  }

  return payload;
};

const getPublicKeys = async () => {
  const now = Date.now();
  if (publicKeyCache.keys.length && now - publicKeyCache.fetchedAt < PUBLIC_KEY_TTL_MS) {
    return publicKeyCache.keys;
  }

  const keys = await requestJson('/v2/public-key/http');
  publicKeyCache = {
    fetchedAt: now,
    keys: Array.isArray(keys) ? keys : [],
  };
  return publicKeyCache.keys;
};

const parseDigestHeader = (header) => {
  if (!header) return null;
  const match = String(header).match(/^(sha-256|sha-512)=:([A-Za-z0-9+/=]+):$/i);
  if (!match) return null;
  return {
    algorithm: match[1].toLowerCase(),
    value: match[2],
  };
};

const computeDigest = (body, algorithm) => {
  const hash = crypto.createHash(algorithm);
  hash.update(body || '', 'utf8');
  return hash.digest('base64');
};

const parseSignatureInput = (header) => {
  if (!header) return null;
  const firstEq = header.indexOf('=');
  if (firstEq < 1) return null;

  const label = header.slice(0, firstEq).trim();
  const remainder = header.slice(firstEq + 1).trim();
  if (!remainder.startsWith('(')) return null;

  const closeParen = remainder.indexOf(')');
  if (closeParen < 0) return null;

  const componentsRaw = remainder.slice(1, closeParen).trim();
  const paramsRaw = remainder.slice(closeParen + 1).trim();
  const components = componentsRaw
    .split(/\s+/)
    .map((item) => item.replace(/^"|"$/g, ''))
    .filter(Boolean);

  const params = {};
  paramsRaw
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const idx = part.indexOf('=');
      if (idx > 0) {
        const key = part.slice(0, idx).trim();
        const rawValue = part.slice(idx + 1).trim();
        params[key] = rawValue.replace(/^"|"$/g, '');
      }
    });

  return { label, components, params };
};

const getHeader = (req, name) => req.get(name) || req.get(name.toLowerCase()) || '';

const buildSignatureBase = (req, parsedInput) => {
  const lines = [];
  for (const component of parsedInput.components) {
    if (component === '@method') {
      lines.push(`"@method": ${String(req.method || '').toUpperCase()}`);
    } else if (component === '@authority') {
      lines.push(`"@authority": ${getHeader(req, 'host')}`);
    } else if (component === '@path') {
      lines.push(`"@path": ${req.path}`);
    } else {
      lines.push(`"${component}": ${getHeader(req, component)}`);
    }
  }

  const quotedComponents = parsedInput.components.map((item) => `"${item}"`).join(' ');
  const signatureParams = `(${quotedComponents});alg="${parsedInput.params.alg}";keyid="${parsedInput.params.keyid}"`
    + `${parsedInput.params.created ? `;created=${parsedInput.params.created}` : ''}`
    + `${parsedInput.params.expires ? `;expires=${parsedInput.params.expires}` : ''}`;

  lines.push(`"@signature-params": ${signatureParams}`);
  return lines.join('\n');
};

const verifyWithPublicKey = (alg, publicKey, signatureBase, signature) => {
  const algo = String(alg || '').toLowerCase();
  if (algo === 'ecdsa-p256-sha256') {
    return crypto.verify('sha256', Buffer.from(signatureBase, 'utf8'), publicKey, signature);
  }
  if (algo === 'ecdsa-p384-sha384') {
    return crypto.verify('sha384', Buffer.from(signatureBase, 'utf8'), publicKey, signature);
  }
  if (algo === 'rsa-v1_5-sha256') {
    return crypto.verify('sha256', Buffer.from(signatureBase, 'utf8'), publicKey, signature);
  }
  if (algo === 'rsa-pss-sha512') {
    return crypto.verify('sha512', Buffer.from(signatureBase, 'utf8'), {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: 64,
    }, signature);
  }
  throw createError(`Unsupported signature algorithm: ${alg}`, 403);
};

const verifyCallbackSignature = async (req) => {
  const signature = getHeader(req, 'signature');
  const signatureInput = getHeader(req, 'signature-input');
  const signatureDate = getHeader(req, 'signature-date');
  const contentDigest = getHeader(req, 'content-digest');
  const contentType = getHeader(req, 'content-type');
  const body = req.rawBody || JSON.stringify(req.body || {});

  const hasSignatureHeaders = Boolean(signature || signatureInput || signatureDate || contentDigest);
  if (!config.signedCallbacksEnabled && !hasSignatureHeaders) {
    return { verified: false, skipped: true };
  }

  if (!signature || !signatureInput || !signatureDate || !contentDigest || !contentType) {
    throw createError('Missing pawaPay signature headers');
  }

  const digest = parseDigestHeader(contentDigest);
  if (!digest) {
    throw createError('Invalid Content-Digest header');
  }

  const computedDigest = computeDigest(body, digest.algorithm);
  if (computedDigest.length !== digest.value.length ||
      !crypto.timingSafeEqual(Buffer.from(computedDigest), Buffer.from(digest.value))) {
    throw createError('Callback body digest verification failed');
  }

  const parsedInput = parseSignatureInput(signatureInput);
  if (!parsedInput || !parsedInput.params.keyid || !parsedInput.params.alg) {
    throw createError('Invalid Signature-Input header');
  }

  const keys = await getPublicKeys();
  const matchedKey = keys.find((item) => item.id === parsedInput.params.keyid);
  if (!matchedKey) {
    throw createError('pawaPay public key not found');
  }

  const signatureBase = buildSignatureBase(req, parsedInput);
  const encodedSignature = String(signature).replace(/^sig-pp=:|:$/g, '');
  const signatureBuffer = Buffer.from(encodedSignature, 'base64');
  const publicKey = crypto.createPublicKey(matchedKey.key);
  const verified = verifyWithPublicKey(parsedInput.params.alg, publicKey, signatureBase, signatureBuffer);

  if (!verified) {
    throw createError('pawaPay callback signature verification failed');
  }

  return { verified: true, keyId: parsedInput.params.keyid };
};

module.exports = {
  verifyCallbackSignature,
};
