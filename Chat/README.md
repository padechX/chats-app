# MySpa Social Backend (Micro-servicio)

Alma de WhatsApp y Snapchat para MySpa. Desplegable en Vercel como proyecto independiente (monorepo).

- Endpoints WhatsApp:
  - GET/POST /api/whatsapp/webhook (verificación + recepción)
  - POST /api/whatsapp/send (envío de texto)
  - GET /api/whatsapp/messages?status=pending|processed
  - POST /api/whatsapp/messages/[id]/ack (marcar procesado)
  - GET/POST /api/whatsapp/state (toggle tienda cerrada)
- Endpoints Snapchat (stubs):
  - GET /api/snapchat/metrics
  - GET /api/snapchat/stories
  - GET /api/snapchat/audience
  - POST /api/snapchat/refresh-token

Almacenamiento
- KV (Upstash/Vercel KV) si existen KV_REST_API_URL y KV_REST_API_TOKEN
- Fallback: memoria de proceso (solo dev)

Variables de entorno (Vercel)
- WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET
- KV_REST_API_URL, KV_REST_API_TOKEN (opcional para persistencia)
- WHATSAPP_GRAPH_VERSION (opcional, default v19.0)

Uso desde la app
- Define NEXT_PUBLIC_SOCIAL_BACKEND_URL en la app para que las secciones de WhatsApp/Snapchat llamen a este backend.
