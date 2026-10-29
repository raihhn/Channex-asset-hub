import { redirect } from "next/navigation";

export default function UIOptionTwoPage() {
  // Keep old preview links working while making the product route the source of truth.
  redirect("/");
}
