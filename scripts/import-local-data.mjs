import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL belum diatur. Tambahkan connection string Neon ke .env.local terlebih dahulu.");
}

const sql = neon(databaseUrl);
const transactions = JSON.parse(await readFile(path.join(projectRoot, "data", "transactions.json"), "utf8"));
const tariffs = JSON.parse(await readFile(path.join(projectRoot, "data", "tariffs.json"), "utf8"));

if (!Array.isArray(transactions)) throw new Error("data/transactions.json harus berisi daftar transaksi.");
const transactionIds = new Set();
const trackingCodes = new Set();
for (const transaction of transactions) {
  if (!transaction || typeof transaction.id !== "string" || typeof transaction.createdAt !== "string") {
    throw new Error("Ada transaksi dengan format yang tidak valid. Data belum diimpor.");
  }
  if (transactionIds.has(transaction.id)) throw new Error("Ada ID transaksi duplikat. Data belum diimpor.");
  if (transaction.trackingCode && trackingCodes.has(transaction.trackingCode)) {
    throw new Error("Ada kode pelacakan duplikat. Data belum diimpor.");
  }
  transactionIds.add(transaction.id);
  if (transaction.trackingCode) trackingCodes.add(transaction.trackingCode);
}
if (!tariffs || !Array.isArray(tariffs.services) || !Number.isInteger(tariffs.expressFee)) {
  throw new Error("data/tariffs.json tidak berisi konfigurasi tarif yang valid. Data belum diimpor.");
}

await sql`
  CREATE TABLE IF NOT EXISTS laundry_transactions (
    id TEXT PRIMARY KEY,
    tracking_code TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL,
    data JSONB NOT NULL
  )
`;
await sql`CREATE INDEX IF NOT EXISTS laundry_transactions_created_at_idx ON laundry_transactions (created_at DESC)`;
await sql`
  CREATE TABLE IF NOT EXISTS laundry_settings (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    tariffs JSONB NOT NULL
  )
`;

const [transactionCount] = await sql`SELECT COUNT(*)::int AS count FROM laundry_transactions`;
const [settingsCount] = await sql`SELECT COUNT(*)::int AS count FROM laundry_settings`;
if (transactionCount.count > 0 || settingsCount.count > 0) {
  throw new Error("Database Neon tidak kosong. Impor dibatalkan agar data yang sudah ada tidak tertimpa.");
}

const statements = transactions.map((transaction) => sql`
  INSERT INTO laundry_transactions (id, tracking_code, created_at, data)
  VALUES (${transaction.id}, ${transaction.trackingCode ?? null}, ${transaction.createdAt}, ${JSON.stringify(transaction)}::jsonb)
`);
statements.push(sql`
  INSERT INTO laundry_settings (id, tariffs) VALUES (1, ${JSON.stringify(tariffs)}::jsonb)
`);
await sql.transaction(statements);

console.log(`Berhasil mengimpor ${transactions.length} transaksi dan konfigurasi tarif ke Neon.`);
