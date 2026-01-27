export const useBridge = () => {
  const [bridgeUrl] = useState(() => {
    return localStorage.getItem('socialBackendUrl') || 'http://127.0.0.1:3000';
  });

  const fetch = async (path: string, options?: RequestInit) => {
    const response = await window.fetch(`${bridgeUrl}${path}`, options);
    return response.json();
  };

  return { bridgeUrl, fetch };
};

// Uso en componente:
// const { fetch } = useBridge();
// const config = await fetch('/api/bridge/config');
