import nodemailer from "nodemailer";

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
}

async function send(to: string, subject: string, html: string, replyTo?: string | null) {
  const transporter = getTransporter();
  if (!transporter) return false;
  await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, replyTo: replyTo || undefined, to, subject, html });
  return true;
}

export function invitationEmail(to: string, name: string, url: string) {
  return send(to, "Your GymFlow invitation", `<div style="font-family:Arial,sans-serif;max-width:560px"><h1>Welcome to GymFlow</h1><p>Hi ${name}, your gym workspace is ready.</p><p><a href="${url}" style="background:#6d63ff;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Activate your account</a></p><p>This link expires in 48 hours.</p></div>`);
}

export function passwordResetEmail(to: string, name: string, url: string) {
  return send(to, "Reset your GymFlow password", `<div style="font-family:Arial,sans-serif;max-width:560px"><h1>Password reset</h1><p>Hi ${name}, use the button below to choose a new password.</p><p><a href="${url}" style="background:#6d63ff;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Reset password</a></p><p>This link expires in 30 minutes.</p></div>`);
}

export function renewalReminderEmail(to: string, name: string, gymName: string, planName: string, endDate: string, invoiceNumber: string, amount: string) {
  return send(to, `Renewal reminder from ${gymName}`, `<div style="font-family:Arial,sans-serif;max-width:560px;color:#202b3f"><h1>${gymName}</h1><p>Hi ${name}, your <strong>${planName}</strong> membership is due for renewal on <strong>${endDate}</strong>.</p><p>Amount due: <strong>${amount}</strong><br/>Invoice: <strong>${invoiceNumber}</strong></p><p>Please contact your gym to complete payment and keep your membership active.</p><p style="color:#718096;font-size:13px">This is an automated reminder from GymFlow.</p></div>`);
}

export function invoiceIssuedEmail(to: string, name: string, gymName: string, gymEmail: string | null, invoiceNumber: string, amount: string, dueDate: string, kind: string) {
  return send(to, `${kind === "INITIAL" ? "Your membership invoice" : "Your renewal invoice"} from ${gymName}`, `<div style="font-family:Arial,sans-serif;max-width:560px;color:#202b3f"><h1>${gymName}</h1><p>Hi ${name}, your ${kind === "INITIAL" ? "membership" : "renewal"} invoice has been created.</p><div style="padding:16px;background:#f5f4ff;border-radius:10px"><p style="margin:0"><strong>Invoice:</strong> ${invoiceNumber}<br/><strong>Amount:</strong> ${amount}<br/><strong>Due date:</strong> ${dueDate}</p></div><p>Please contact ${gymName} to complete your payment.</p><p style="color:#718096;font-size:13px">Reply to this email or contact ${gymEmail || "your gym"} for help.</p></div>`, gymEmail);
}

export function paymentReceiptEmail(to: string, name: string, gymName: string, gymEmail: string | null, invoiceNumber: string, amount: string, paidAt: string) {
  return send(to, `Payment receipt from ${gymName}`, `<div style="font-family:Arial,sans-serif;max-width:560px;color:#202b3f"><h1>Payment received</h1><p>Hi ${name}, ${gymName} has recorded your payment successfully.</p><div style="padding:16px;background:#eaf8ef;border-radius:10px"><p style="margin:0"><strong>Invoice:</strong> ${invoiceNumber}<br/><strong>Amount paid:</strong> ${amount}<br/><strong>Paid on:</strong> ${paidAt}</p></div><p>Thank you for being a member of ${gymName}.</p><p style="color:#718096;font-size:13px">Contact ${gymEmail || "your gym"} if you have any questions.</p></div>`, gymEmail);
}
