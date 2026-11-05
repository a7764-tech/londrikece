import { neon } from "@neondatabase/serverless";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TariffConfig, Transaction } from "./types";

const dataDir = path.join(process.cwd(), "data");
const transactionsPath = path.join(dataDir, "transactions.json");
const tariffsPath = path.join(dataDir, "tariffs.json");

const defaultTariffs: TariffConfig = {
  // Nilai ilustrasi sementara dari contoh pada mockup PRD; silakan sesuaikan sebelum dipakai operasional.
  services: [
    { id: "cuci-setrika", name: "Cuci Kering Setrika", pricePerKg: 10000 },
    { id: "cuci-kering", name: "Cuci Kering Saja", pricePerKg: 7000 },
    { id: "setrika", name: "Setrika Saja", pricePerKg: 7000 },
  ],
  expressFee: 5000,
};

type NeonClient = ReturnType<typeof neon<false, false>>;
let neonClient: NeonClient | undefined;
let schemaReady: Promise<void> | undefined;

function getNeonClient() {
  if (!process.env.DATABASE_URL) {
    if (process.env.VERCEL) throw new Error("DATABASE_URL wajib diatur untuk deployment Vercel.");
    return null;
  }
  neonClient ??= neon(process.env.DATABASE_URL);
  return neonClient;
}

async function ensureSchema(sql: NeonClient) {
  schemaReady ??= (async () => {
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
  })();
  try {
    await schemaReady;
  } catch (error) {
    schemaReady = undefined;
    throw error;
  }
}

async function ensureData() {
  await mkdir(dataDir, { recursive: true });
  try { await readFile(transactionsPath, "utf8"); } catch { await writeFile(transactionsPath, "[]", "utf8"); }
  try { await readFile(tariffsPath, "utf8"); } catch { await writeFile(tariffsPath, JSON.stringify(defaultTariffs, null, 2), "utf8"); }
}

function parseJson<T>(value: T | string): T {
  return typeof value === "string" ? JSON.parse(value) as T : value;
}

export async function getTransactions(): Promise<Transaction[]> {
  const sql = getNeonClient();
  if (sql) {
    await ensureSchema(sql);
    const rows = await sql`SELECT data FROM laundry_transactions ORDER BY created_at DESC`;
    return rows.map((row) => parseJson<Transaction>(row.data as Transaction | string));
  }
  await ensureData();
  return JSON.parse(await readFile(transactionsPath, "utf8")) as Transaction[];
}

export async function getTransactionById(id: string): Promise<Transaction | undefined> {
  const sql = getNeonClient();
  if (sql) {
    await ensureSchema(sql);
    const [row] = await sql`SELECT data FROM laundry_transactions WHERE id = ${id}`;
    return row ? parseJson<Transaction>(row.data as Transaction | string) : undefined;
  }
  return (await getTransactions()).find((item) => item.id === id);
}

export async function getTransactionByTrackingCode(code: string): Promise<Transaction | undefined> {
  const sql = getNeonClient();
  if (sql) {
    await ensureSchema(sql);
    const [row] = await sql`SELECT data FROM laundry_transactions WHERE tracking_code = ${code}`;
    return row ? parseJson<Transaction>(row.data as Transaction | string) : undefined;
  }
  return (await getTransactions()).find((item) => item.trackingCode === code);
}

export async function insertTransaction(transaction: Transaction): Promise<boolean> {
  const sql = getNeonClient();
  if (sql) {
    await ensureSchema(sql);
    const rows = await sql`
      INSERT INTO laundry_transactions (id, tracking_code, created_at, data)
      VALUES (${transaction.id}, ${transaction.trackingCode ?? null}, ${transaction.createdAt}, ${JSON.stringify(transaction)}::jsonb)
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    return rows.length > 0;
  }
  const items = await getTransactions();
  if (items.some((item) => item.trackingCode === transaction.trackingCode || item.id === transaction.id)) return false;
  items.unshift(transaction);
  await writeFile(transactionsPath, JSON.stringify(items, null, 2), "utf8");
  return true;
}

export async function saveTransaction(transaction: Transaction) {
  const sql = getNeonClient();
  if (sql) {
    await ensureSchema(sql);
    await sql`
      INSERT INTO laundry_transactions (id, tracking_code, created_at, data)
      VALUES (${transaction.id}, ${transaction.trackingCode ?? null}, ${transaction.createdAt}, ${JSON.stringify(transaction)}::jsonb)
      ON CONFLICT (id) DO UPDATE
      SET tracking_code = EXCLUDED.tracking_code,
          created_at = EXCLUDED.created_at,
          data = EXCLUDED.data
    `;
    return;
  }
  const items = await getTransactions();
  const index = items.findIndex((item) => item.id === transaction.id);
  if (index < 0) throw new Error("Transaksi tidak ditemukan.");
  items[index] = transaction;
  await writeFile(transactionsPath, JSON.stringify(items, null, 2), "utf8");
}

export async function getTariffs(): Promise<TariffConfig> {
  const sql = getNeonClient();
  if (sql) {
    await ensureSchema(sql);
    const [row] = await sql`SELECT tariffs FROM laundry_settings WHERE id = 1`;
    if (row) return parseJson<TariffConfig>(row.tariffs as TariffConfig | string);
    await sql`INSERT INTO laundry_settings (id, tariffs) VALUES (1, ${JSON.stringify(defaultTariffs)}::jsonb) ON CONFLICT (id) DO NOTHING`;
    const [initialized] = await sql`SELECT tariffs FROM laundry_settings WHERE id = 1`;
    if (!initialized) throw new Error("Konfigurasi tarif belum dapat dimuat dari database.");
    return parseJson<TariffConfig>(initialized.tariffs as TariffConfig | string);
  }
  await ensureData();
  return JSON.parse(await readFile(tariffsPath, "utf8")) as TariffConfig;
}

export async function saveTariffs(tariffs: TariffConfig) {
  const sql = getNeonClient();
  if (sql) {
    await ensureSchema(sql);
    await sql`
      INSERT INTO laundry_settings (id, tariffs) VALUES (1, ${JSON.stringify(tariffs)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET tariffs = EXCLUDED.tariffs
    `;
    return;
  }
  await ensureData();
  await writeFile(tariffsPath, JSON.stringify(tariffs, null, 2), "utf8");
}
