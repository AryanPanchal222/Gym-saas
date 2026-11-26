import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const uploadDirectory = path.resolve(process.cwd(), "uploads", "logos");
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});

export const logoUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.mimetype)),
});
