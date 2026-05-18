"use client";

import { useState } from "react";
import { ShareDialog } from "./share-dialog";

export function ShareButton() {
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <>
      <button
        className="wk-iconbtn"
        title="Paylaş"
        onClick={() => setDialogOpen(true)}
      >
        ↗
      </button>
      <ShareDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
