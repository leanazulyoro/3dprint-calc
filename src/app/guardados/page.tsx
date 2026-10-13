import type { Metadata } from "next";
import { SavedQuotesPage } from "@/components/SavedQuotesPage";

export const metadata: Metadata = {
  title: "Presupuestos guardados",
};

export default function Guardados() {
  return <SavedQuotesPage />;
}
