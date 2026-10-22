import type { OutMessage } from './conversation';

export interface GraphConfig {
  accessToken: string;
  phoneNumberId: string;
  // Graph API version; v26.0 is what Meta's own send-message examples use.
  version?: string;
}

export function toGraphPayload(to: string, message: OutMessage): Record<string, unknown> {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to };
  switch (message.kind) {
    case 'text':
      return { ...base, type: 'text', text: { body: message.body, preview_url: false } };
    case 'buttons':
      // Meta allows up to three reply buttons.
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: message.body },
          action: {
            buttons: message.buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: b })),
          },
        },
      };
    case 'list':
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: message.body },
          action: {
            button: message.button,
            sections: [{ title: 'Options', rows: message.rows.slice(0, 10) }],
          },
        },
      };
  }
}

export async function sendMessage(config: GraphConfig, to: string, message: OutMessage): Promise<void> {
  const version = config.version ?? 'v26.0';
  const response = await fetch(
    `https://graph.facebook.com/${version}/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toGraphPayload(to, message)),
    },
  );
  if (!response.ok) {
    // Status only: the body can echo the recipient's number back.
    throw new Error(`WhatsApp send failed with HTTP ${response.status}`);
  }
}
