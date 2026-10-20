import { notFound } from "next/navigation";
import { AdminEventProvider } from "@/components/shells/AdminSidebar";
import { getAdminEvent } from "./adminEvent";

/** Loads the event once for the sidebar's event group and each page's breadcrumb. */
export default async function AdminEventLayout({
  children,
  params,
}: LayoutProps<"/admin/events/[eventId]">) {
  const { eventId } = await params;
  const event = await getAdminEvent(eventId);
  if (!event) notFound();
  return <AdminEventProvider event={event}>{children}</AdminEventProvider>;
}
