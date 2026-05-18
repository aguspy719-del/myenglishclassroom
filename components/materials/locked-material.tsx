"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useState } from "react";

interface LockedMaterialProps {
  materialTitle: string;
  prerequisiteTitle?: string;
  passingScore?: number;
}

export function LockedMaterialBadge({ materialTitle, prerequisiteTitle, passingScore = 75 }: LockedMaterialProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-gray-400 border-gray-200 cursor-not-allowed opacity-60"
        onClick={() => setOpen(true)}
      >
        <Lock className="w-4 h-4" />
        Locked
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Lock className="w-7 h-7 text-orange-600 dark:text-orange-400" />
            </div>
            <DialogTitle className="text-center">Material Locked</DialogTitle>
            <DialogDescription className="text-center">
              <strong>{materialTitle}</strong> is locked.
              {prerequisiteTitle && (
                <span> Complete the assessment for <strong>{prerequisiteTitle}</strong> with a minimum score of <strong>{passingScore}</strong> to unlock this material.</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setOpen(false)} className="w-full rounded-xl">Got it</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
