import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon, neonConfig } from '@neondatabase/serverless';
import * as schema from '../shared/schema';
import ws from 'ws';

// Required for Neon serverless
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

// Create a Neon client
const sql = neon(process.env.DATABASE_URL!);
// @ts-ignore - type issue with drizzle neon
export const db = drizzle(sql);

// Setup database connection
export async function setupDatabase() {
  try {
    // Create the necessary tables if they don't exist
    console.log('[Database] Setting up database...');
    
    // Execute each table creation separately
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      )
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        amount DOUBLE PRECISION NOT NULL,
        type TEXT NOT NULL,
        remarks TEXT,
        date TIMESTAMP NOT NULL DEFAULT NOW(),
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        google_sheets_sync BOOLEAN DEFAULT FALSE
      )
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    
    console.log('[Database] Setup completed successfully');
  } catch (error) {
    console.error('[Database] Setup error:', error);
    throw error;
  }
}