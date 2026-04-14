import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.join(__dirname, '..', 'data.db')

let dbInstance: Database | null = null

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance

  dbInstance = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  })

  await initDb(dbInstance)
  return dbInstance
}

async function initDb(db: Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      dom_selectors_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      cookie_json TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      last_used_at DATETIME,
      FOREIGN KEY (site_id) REFERENCES sites(id)
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      key TEXT PRIMARY KEY,
      total_calls INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );
  `)
}
