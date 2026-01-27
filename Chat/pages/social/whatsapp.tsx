// o cualquier componente que use social/whatsapp

useEffect(() => {
  const bridgeUrl = localStorage.getItem('socialBackendUrl') || 'http://127.0.0.1:3000';
  
  // Test health
  fetch(`${bridgeUrl}/api/whatsapp/health`)
    .then(r => r.json())
    .then(data => console.log('WhatsApp Health:', data))
    .catch(e => console.error('Bridge error:', e));
}, []);
