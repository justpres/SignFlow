interface TelegramParams {
  contractTitle: string;
  clientName: string;
  signedAt: string;
  contractId: string;
}

export async function sendContractSignedTelegram({
  contractTitle,
  clientName,
  signedAt,
  contractId,
}: TelegramParams): Promise<{ success: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.info('[Telegram Notification Mock] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured. Simulated Telegram message:', {
      contractTitle,
      clientName,
      signedAt,
      contractId,
    });
    return { success: true };
  }

  const text = `CONTRACT SIGNED\n\nClient: ${clientName}\nContract: ${contractTitle}\nSigned: ${signedAt}\nContract ID: ${contractId}`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: errText };
    }
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Failed to send Telegram notification:', err);
    return { success: false, error: message };
  }
}
