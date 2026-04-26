from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db import get_conn
from routers.auth import get_current_user, UserOut


router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class WatchlistItemIn(BaseModel):
    ticker: str
    type: str = Field(pattern="^(stock|option)$")
    label: str
    quantity: float = Field(gt=0)
    strike: float | None = None
    optType: str | None = Field(default=None, pattern="^(call|put)$")
    expiration: str | None = None
    iv: float | None = None


class WatchlistItemOut(WatchlistItemIn):
    id: str


class WatchlistItemPatch(BaseModel):
    quantity: float | None = Field(default=None, gt=0)
    label: str | None = None
    iv: float | None = None


@router.get("", response_model=list[WatchlistItemOut])
def list_items(user: UserOut = Depends(get_current_user)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, ticker, type, label, quantity, strike, "optType", expiration, iv
                FROM watchlist_items
                WHERE user_id = %s
                ORDER BY id ASC
                """,
                (user.id,),
            )
            rows = cur.fetchall()
        return [
            WatchlistItemOut(
                id=str(r["id"]),
                ticker=r["ticker"],
                type=r["type"],
                label=r["label"],
                quantity=float(r["quantity"]),
                strike=r["strike"],
                optType=r["optType"],
                expiration=r["expiration"],
                iv=r["iv"],
            )
            for r in rows
        ]
    finally:
        conn.close()


@router.post("", response_model=WatchlistItemOut)
def add_item(item: WatchlistItemIn, user: UserOut = Depends(get_current_user)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO watchlist_items
                  (user_id, ticker, type, label, quantity, strike, "optType", expiration, iv, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
                """,
                (
                    user.id,
                    item.ticker.upper(),
                    item.type,
                    item.label,
                    float(item.quantity),
                    item.strike,
                    item.optType,
                    item.expiration,
                    item.iv,
                ),
            )
            new_id = str(cur.fetchone()["id"])
        conn.commit()
        return WatchlistItemOut(id=new_id, **item.model_dump())
    finally:
        conn.close()


@router.patch("/{item_id}", response_model=WatchlistItemOut)
def patch_item(item_id: str, patch: WatchlistItemPatch, user: UserOut = Depends(get_current_user)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, ticker, type, label, quantity, strike, "optType", expiration, iv
                FROM watchlist_items
                WHERE id = %s AND user_id = %s
                """,
                (item_id, user.id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Item not found")

            next_label = patch.label if patch.label is not None else row["label"]
            next_qty = float(patch.quantity) if patch.quantity is not None else float(row["quantity"])
            next_iv = patch.iv if patch.iv is not None else row["iv"]

            cur.execute(
                """
                UPDATE watchlist_items
                SET label = %s, quantity = %s, iv = %s, updated_at = NOW()
                WHERE id = %s AND user_id = %s
                """,
                (next_label, next_qty, next_iv, item_id, user.id),
            )
        conn.commit()

        return WatchlistItemOut(
            id=str(row["id"]),
            ticker=row["ticker"],
            type=row["type"],
            label=next_label,
            quantity=next_qty,
            strike=row["strike"],
            optType=row["optType"],
            expiration=row["expiration"],
            iv=next_iv,
        )
    finally:
        conn.close()


@router.delete("/{item_id}")
def delete_item(item_id: str, user: UserOut = Depends(get_current_user)):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM watchlist_items WHERE id = %s AND user_id = %s",
                (item_id, user.id),
            )
            deleted = cur.rowcount
        conn.commit()
        if deleted == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        return {"status": "ok"}
    finally:
        conn.close()
