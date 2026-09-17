"use client";

import { useState, useTransition } from "react";
import { revealDeliveryInfoAction } from "./actions";
import type { OpsOrder } from "./core-api";

export function OrdersPanel({ orders }: { orders: OpsOrder[] }): JSX.Element {
  const [revealed, setRevealed] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [isPending, startTransition] = useTransition();

  function reveal(orderId: number, relayToken: string) {
    startTransition(() => {
      void (async () => {
        const result = await revealDeliveryInfoAction(relayToken);
        if (result.ok) {
          setRevealed((prev) => ({
            ...prev,
            [orderId]: result.zoneHint ? `${result.address} (${result.zoneHint})` : result.address,
          }));
          setErrors((prev) => {
            const next = { ...prev };
            delete next[orderId];
            return next;
          });
        } else {
          setErrors((prev) => ({ ...prev, [orderId]: result.message }));
        }
      })();
    });
  }

  if (orders.length === 0) return <p className="empty">No orders yet.</p>;

  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Organization</th>
            <th>Qty</th>
            <th>Status</th>
            <th>Delivery info</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.name_en}</td>
              <td className="muted small">{o.organization_name}</td>
              <td className="num">{o.quantity}</td>
              <td className="small">{o.status}</td>
              <td className="small">
                {revealed[o.id] ? (
                  <span>{revealed[o.id]}</span>
                ) : (
                  <button
                    type="button"
                    className="linkBtn"
                    disabled={isPending}
                    onClick={() => reveal(o.id, o.relay_token)}
                  >
                    Reveal delivery info
                  </button>
                )}
                {errors[o.id] && <div className="errorBanner small">{errors[o.id]}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
