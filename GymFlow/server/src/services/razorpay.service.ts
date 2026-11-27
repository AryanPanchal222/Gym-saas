import crypto from "node:crypto";
import Razorpay from "razorpay";

let client: Razorpay | null = null;

export function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_NOT_CONFIGURED");
  }

  client ??= new Razorpay({ key_id: keyId, key_secret: keySecret });
  return client;
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_NOT_CONFIGURED");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const actual = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, actual);
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_NOT_CONFIGURED");

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const actual = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, actual);
}
