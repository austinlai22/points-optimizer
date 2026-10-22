// POST/GET /api/whatsapp — Meta WhatsApp Cloud API webhook.
import { waitUntil } from '@vercel/functions';
import { storeFromEnv } from '../store';
import { sendMessage } from '../whatsapp/graph';
import { createWhatsAppHandler } from '../whatsapp/handler';

const env = process.env;

export default createWhatsAppHandler({
  verifyToken: env.WHATSAPP_VERIFY_TOKEN ?? '',
  appSecret: env.WHATSAPP_APP_SECRET ?? '',
  store: storeFromEnv(env),
  appUrl: env.PUBLIC_APP_URL ?? 'https://pointcompass.vercel.app',
  send: (to, message) =>
    sendMessage(
      {
        accessToken: env.WHATSAPP_TOKEN ?? '',
        phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID ?? '',
        version: env.WHATSAPP_GRAPH_VERSION,
      },
      to,
      message,
    ),
  waitUntil,
});
