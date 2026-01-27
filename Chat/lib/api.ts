// o lib/services/bridge.ts

export const getBridgeUrl = () => {
  return localStorage.getItem('socialBackendUrl') || 'http://127.0.0.1:3000';
};

export const fetchFromBridge = async (path: string, options?: RequestInit) => {
  const bridgeUrl = getBridgeUrl();
  const fullUrl = `${bridgeUrl}${path}`;
  return fetch(fullUrl, options).then(r => r.json());
};

// Uso:
const config = await fetchFromBridge('/api/bridge/config');
const whatsappHealth = await fetchFromBridge('/api/whatsapp/health');
