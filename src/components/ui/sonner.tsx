"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useMediaQuery } from "@/lib/use-media-query";
import { COMPACT_QUERY } from "@/components/ui/responsive-dialog";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  // On a phone the bottom is the tab bar and the form's submit button; toasts
  // there sit on top of what the person taps next.
  const compact = useMediaQuery(COMPACT_QUERY);
  return (
    <Sonner
      theme="dark"
      position={compact ? "top-center" : "bottom-right"}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
