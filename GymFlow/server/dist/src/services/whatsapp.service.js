function getWhatsAppConfig() {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION;
    if (!accessToken || !phoneNumberId || !apiVersion) {
        throw new Error("WhatsApp is not configured. Check server environment variables.");
    }
    return { accessToken, phoneNumberId, apiVersion };
}
function normalizePhone(phone) {
    const normalized = phone.replace(/\D/g, "");
    if (normalized.length < 10 || normalized.length > 15) {
        throw new Error("Invalid WhatsApp recipient phone number.");
    }
    return normalized;
}
/**
 * Sends Meta's pre-approved hello_world test template.
 * The recipient must be added as a test recipient in Meta.
 */
export async function sendTestWhatsAppMessage(recipientPhone) {
    const { accessToken, phoneNumberId, apiVersion } = getWhatsAppConfig();
    const to = normalizePhone(recipientPhone);
    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to,
            type: "template",
            template: {
                name: "hello_world",
                language: {
                    code: "en_US",
                },
            },
        }),
    });
    const result = (await response.json());
    if (!response.ok) {
        throw new Error(result.error?.message ||
            `WhatsApp API request failed (${response.status}).`);
    }
    const messageId = result.messages?.[0]?.id;
    if (!messageId) {
        throw new Error("WhatsApp API did not return a message ID.");
    }
    return messageId;
}
/**
 * Payment message preparation.
 * Real payment template sending will be added after
 * the corresponding Meta template is approved.
 */
export async function sendPaymentConfirmation(data) {
    const formattedDate = new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(data.membershipEndDate);
    console.log("WhatsApp payment confirmation prepared:", {
        member: data.memberName,
        phone: data.phone,
        amount: data.amount,
        membershipEndDate: formattedDate,
        gym: data.gymName,
    });
}
