import { OperatorPageSkeleton } from "@/components/shells/OperatorPageSkeleton";

// Shown before the shell renders (the picker and the event layout each render it).
export default function ProducerLoading() {
  return <OperatorPageSkeleton withBar />;
}
