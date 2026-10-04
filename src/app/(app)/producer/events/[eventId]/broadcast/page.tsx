import { redirect } from "next/navigation";

type Props = { params: Promise<{ eventId: string }> };

/** Broadcast was a second name for the Production board; old links land there. */
export default async function ProducerBroadcastPage({ params }: Props) {
  redirect(`/producer/events/${(await params).eventId}/production`);
}
