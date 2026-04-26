from __future__ import annotations

import os
import psycopg2
import psycopg2.extras

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/aaronterminal",
)


def get_conn() -> psycopg2.extensions.connection:
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def init_db() -> None:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                  id            BIGSERIAL PRIMARY KEY,
                  username      TEXT NOT NULL UNIQUE,
                  email         TEXT NOT NULL UNIQUE,
                  password_hash TEXT NOT NULL,
                  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS watchlist_items (
                  id           BIGSERIAL PRIMARY KEY,
                  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                  ticker       TEXT NOT NULL,
                  type         TEXT NOT NULL,           -- 'stock' | 'option'
                  label        TEXT NOT NULL,
                  quantity     DOUBLE PRECISION NOT NULL,
                  strike       DOUBLE PRECISION,
                  "optType"    TEXT,                    -- 'call' | 'put'
                  expiration   TEXT,
                  iv           DOUBLE PRECISION,
                  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist_items(user_id)"
            )
        conn.commit()
    finally:
        conn.close()
