"use client";

import { useState } from "react";
import { GoogleButton, OAuthErrorNotice } from "@/components/auth/GoogleButton";

/** The invited person may use Google instead of choosing a password. */
export function InviteGoogle() {
  const [failed, setFailed] = useState(false);
  return (
    <div className="mt-4 border-t border-border pt-4">
      {failed ? <OAuthErrorNotice /> : null}
      <GoogleButton onFailure={() => setFailed(true)} />
    </div>
  );
}
