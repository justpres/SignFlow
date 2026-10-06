interface EmailParams {
  to: string;
  contractTitle: string;
  clientName: string;
  signedAt: string;
  contractId: string;
  dashboardUrl: string;
}

export async function sendContractSignedEmail({
  to,
  contractTitle,
  clientName,
  signedAt,
  contractId,
  dashboardUrl,
}: EmailParams): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info('[Email Notification Mock] RESEND_API_KEY not configured. Simulated email dispatch:', {
      to,
      subject: `Contract Signed: ${contractTitle}`,
      clientName,
      signedAt,
      contractId,
    });
    return { success: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'SignFlow <notifications@signflow.app>',
        to: [to],
        subject: `Contract Signed: ${contractTitle}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #000; background: #fff; border: 1px solid #e5e5e5;">
            <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 8px;">Contract Signed</h2>
            <p style="font-size: 14px; line-height: 1.5; color: #333;">The client has successfully signed and finalized the agreement.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 140px; color: #555;">Contract:</td>
                <td style="padding: 8px 0;">${contractTitle}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Signer:</td>
                <td style="padding: 8px 0;">${clientName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Signed At:</td>
                <td style="padding: 8px 0;">${signedAt}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Contract ID:</td>
                <td style="padding: 8px 0;"><code>${contractId}</code></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Status:</td>
                <td style="padding: 8px 0; font-weight: bold;">SIGNED & FINALIZED</td>
              </tr>
            </table>

            <div style="margin-top: 24px;">
              <a href="${dashboardUrl}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 10px 20px; font-weight: bold; font-size: 14px;">View Contract in Dashboard</a>
            </div>

            <p style="margin-top: 32px; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 12px;">SignFlow Automated Document System</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: errText };
    }
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Failed to send email notification:', err);
    return { success: false, error: message };
  }
}
