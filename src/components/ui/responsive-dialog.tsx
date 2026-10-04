"use client";

import { createContext, useContext } from "react";

import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerVirtualKeyboardProvider,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * A modal dialog on a desktop, a bottom drawer on a phone — one API for both.
 *
 * A centred `position: fixed` dialog and an on-screen keyboard are a bad pair:
 * the dialog is anchored to the middle of a viewport the keyboard has just
 * halved, so a tall form overflows with its submit button below the fold. That
 * is not hypothetical — creating a psychologist from a phone put the button
 * off-screen, the tap landed on the overlay, and the dialog closed without ever
 * calling the server. A drawer is anchored to the bottom edge, scrolls its body,
 * and Base UI's VirtualKeyboardProvider keeps the focused field visible.
 *
 * RepOne's Dialog is Radix (asChild) and its Drawer is Base UI (render), so
 * each part bridges the two APIs.
 *
 * The parts mirror shadcn's Dialog and Drawer, so a caller composes it the same
 * way; each part renders whichever of the two the viewport calls for.
 */
const CompactContext = createContext<boolean | null>(null);

function useCompact(part: string): boolean {
  const compact = useContext(CompactContext);
  if (compact === null) throw new Error(`${part} must be used inside <ResponsiveDialog>.`);
  return compact;
}

/** The width below which the dialog becomes a drawer: Tailwind's `sm`. */
export const COMPACT_QUERY = "(max-width: 639px)";

function ResponsiveDialog({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const compact = useMediaQuery(COMPACT_QUERY);

  return (
    <CompactContext.Provider value={compact}>
      {compact ? (
        // The grab bar says "this is a sheet you can pull down".
        <Drawer
          open={open}
          onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}
          showSwipeHandle
        >
          {children}
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      )}
    </CompactContext.Provider>
  );
}

/** Wraps the element that opens the dialog, typically a Button. */
function ResponsiveDialogTrigger({ children }: { children: React.ReactElement }) {
  return useCompact("ResponsiveDialogTrigger") ? (
    <DrawerTrigger render={children} />
  ) : (
    <DialogTrigger asChild>{children}</DialogTrigger>
  );
}

function ResponsiveDialogContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return useCompact("ResponsiveDialogContent") ? (
    <DrawerVirtualKeyboardProvider>
      <DrawerContent className={className}>{children}</DrawerContent>
    </DrawerVirtualKeyboardProvider>
  ) : (
    <DialogContent className={className}>{children}</DialogContent>
  );
}

function ResponsiveDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return useCompact("ResponsiveDialogHeader") ? (
    <DrawerHeader className={className} {...props} />
  ) : (
    <DialogHeader className={className} {...props} />
  );
}

function ResponsiveDialogTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return useCompact("ResponsiveDialogTitle") ? (
    <DrawerTitle className={className}>{children}</DrawerTitle>
  ) : (
    <DialogTitle className={className}>{children}</DialogTitle>
  );
}

function ResponsiveDialogDescription({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return useCompact("ResponsiveDialogDescription") ? (
    <DrawerDescription className={className}>{children}</DrawerDescription>
  ) : (
    <DialogDescription className={className}>{children}</DialogDescription>
  );
}

/**
 * The scrollable middle. On a phone it is the only part that scrolls, so the
 * header stays put and the drawer frame does not jump while typing.
 */
function ResponsiveDialogBody({ className, ...props }: React.ComponentProps<"div">) {
  const compact = useCompact("ResponsiveDialogBody");
  return (
    <div
      data-slot="responsive-dialog-body"
      className={cn(
        // min-h-0 is load-bearing: the drawer content is a flex column with a
        // max-height, and without it this child refuses to shrink, so nothing
        // scrolls and the submit button stays off-screen.
        compact && "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-6",
        className,
      )}
      {...props}
    />
  );
}

function ResponsiveDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return useCompact("ResponsiveDialogFooter") ? (
    <DrawerFooter className={className} {...props} />
  ) : (
    <DialogFooter className={className} {...props} />
  );
}

/** Wraps the element that closes the dialog, typically a Button. */
function ResponsiveDialogClose({ children }: { children: React.ReactElement }) {
  return useCompact("ResponsiveDialogClose") ? (
    <DrawerClose render={children} />
  ) : (
    <DialogClose asChild>{children}</DialogClose>
  );
}

export {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
};
