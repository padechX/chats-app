# MySpa Social Backend (Render)

Backend mini para WhatsApp Cloud API. Está pensado para correr en **Render** como servicio Node (siempre encendido).

## Qué tiene que haber en el repo (carpeta `Chat/`)

- `server.js`
- `package.json`
- `README.md` (esto)

Con eso Render hace `npm install` y `npm start` y listo.

## Endpoints

- `GET /api/health` (o `GET /api/whatsapp/health`)
- `GET|POST /api/whatsapp/webhooks` (también vale `/api/whatsapp/webhook`)
- `POST /api/whatsapp/send`
- `GET /api/whatsapp/messages?status=pending|processed`
- `POST /api/whatsapp/messages/<id>/ack`
- `GET /api/whatsapp/media/<mediaId>` (descarga binario)
- `POST /api/whatsapp/media/upload` (sube base64 y devuelve `id`)

Notas rápidas:

- La “bandeja” de mensajes es **en memoria** (si Render reinicia, se vacía).
- Para multimedia entrante, en `messages` te llega `media: { id, type, mime_type, filename, caption... }` y con ese `id` llamas a `/media/<id>`.

## Variables de entorno (Render)

Pon estas en el panel de Render (Environment):

- `WHATSAPP_TOKEN`
  - Token de WhatsApp Cloud API (permanente si puedes). Si lo cambias, el envío/descarga de media deja de funcionar.
- `WHATSAPP_PHONE_NUMBER_ID`
  - El Phone Number ID de tu número de WhatsApp Cloud.
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
  - Un texto cualquiera (tipo `myspa-verify-123`) y el mismo lo pones en Meta cuando configuras el webhook.
- `WHATSAPP_APP_SECRET` (opcional pero recomendado)
  - App Secret de Meta. Si lo pones, el webhook valida la firma `x-hub-signature-256`.
- `WHATSAPP_GRAPH_VERSION` (opcional)
  - Ej: `v24.0`.

No hace falta configurar `PORT`. Render lo pone solo.

## Qué URL poner en Meta (webhook)

En Meta (WhatsApp -> Configuration -> Webhooks), la URL te queda:

`https://TU-SERVICIO.onrender.com/api/whatsapp/webhooks`

Y el verify token es el valor de `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
