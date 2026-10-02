import { OperatorPageSkeleton } from "@/components/shells/OperatorPageSkeleton";

// Shown before the shell renders (each scorekeeper page renders it).
export default function ScoreKeeperLoading() {
  return <OperatorPageSkeleton withBar />;
}
