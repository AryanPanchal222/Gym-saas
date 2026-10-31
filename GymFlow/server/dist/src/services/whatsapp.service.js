function formatDate(date) {
    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
}
/**
 * WhatsApp notification foundation.
 *
 * For now this only prepares/logs the message.
 * The actual WhatsApp Business API provider will be connected later.
 */
export async function sendPaymentConfirmation(data) {
    const message = [
        `Hi ${data.memberName}! 👋`,
        "",
        `Your membership renewal payment of ₹${data.amount} has been received successfully. ✅`,
        "",
        `Your membership is now active until ${formatDate(data.membershipEndDate)}.`,
        "",
        `Thank you for choosing ${data.gymName}! 💪`,
        "",
        "— GymFlow",
    ].join("\n");
    console.log("📱 WhatsApp payment confirmation prepared");
    console.log(`Recipient: ${data.phone}`);
    console.log("Message:");
    console.log(message);
    // TODO:
    // Connect a WhatsApp Business API provider here.
    //
    // Example future flow:
    // await whatsappProvider.sendTemplateMessage(...)
}
