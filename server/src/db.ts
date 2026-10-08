import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  pgTable,
  serial,
  text,
  timestamp
} from 'drizzle-orm/pg-core';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  passwordFingerprint: text('password_fingerprint').notNull().unique(),
  createdAt: timestamp('created_at')
    .defaultNow()
    .notNull(),
  lastLogin: timestamp('last_login')
});

export const db = drizzle(pool);