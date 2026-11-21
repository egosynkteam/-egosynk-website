import type { Metadata } from "next";
import { Account } from "@/components/account";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default function AccountPage() {
  return <Account />;
}
