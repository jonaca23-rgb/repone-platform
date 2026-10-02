import { OperatorPageSkeleton } from "@/components/shells/OperatorPageSkeleton";

// Shown before the shell renders (the picker, the event layout and the floor page each render it).
export default function CommentatorLoading() {
  return <OperatorPageSkeleton withBar />;
}
