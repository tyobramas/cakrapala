import { redirect } from "next/navigation";

export default function ISSCatalogRedirectPage() {
  redirect("/satellites/catalog");
}
