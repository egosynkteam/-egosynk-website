import type { Metadata } from "next";
import { OrderConfirmation } from "@/components/order-confirmation";

// Shows one customer's order and address: never indexed.
export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

export default function OrderConfirmationPage() {
  return <OrderConfirmation />;
}
