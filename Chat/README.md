# MySpa Social Backend (Render)

Backend para WhatsApp. Está pensado para correr en **Render** como servicio Node (siempre encendido).

## Qué tiene que haber en el repo de Github(carpeta `Chat/`)

- `server.js`
- `package.json`
- `README.md` (esto)

## En CloudFlare Workers Creas una cuenta gratuita

**Luego**: 
1 - Clic en el boton de Github para conectar el repo. na vez conectado, le cliqueas nuevamente en el icono de github

> | ![alt text](image.png) |
> | :--: |

> | ![alt text](image-1.png) |
> | :--: |

2 - Selecciono el Repo de Github (en caso que hayas dado acceso a todos los repositorios) y clic a siguiente

> | ![alt text](image-3.png) |
> | :--: |





6 - Luego entramos en **Environment Variables** y creamos las variables de entorno

> | ![alt text](image-9.png) |
> | :--: |


- **WHATSAPP_TOKEN**
  - Token de WhatsApp Cloud API (permanente si puedes). Si lo cambias, el envío/descarga de media deja de funcionar.
- **WHATSAPP_PHONE_NUMBER_ID**
  - El Phone Number ID de tu número de WhatsApp Cloud.
- **WHATSAPP_WEBHOOK_VERIFY_TOKEN**
  - Un texto cualquiera (tipo `myspa-verify-123`) y el mismo lo pones en Meta cuando configuras el webhook.
- **WHATSAPP_APP_SECRET** (opcional pero recomendado)
  - App Secret de Meta. Si lo pones, el webhook valida la firma `x-hub-signature-256`.
- **WHATSAPP_GRAPH_VERSION** (opcional)
  - Ej: `v24.0`.


## Qué URL poner en Meta (webhook)

En Meta (WhatsApp -> Configuration -> Webhooks), la URL te queda:

`https://"URL de Render".onrender.com/api/whatsapp/webhooks`

Y el verify token es el valor de **WHATSAPP_WEBHOOK_VERIFY_TOKEN**.


## Luego mas abajo pinchas en Deploy Web Service
> | ![alt text](image-2.png) |
> | :--: |
