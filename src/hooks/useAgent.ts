import { useEffect } from "react";
import {
  onAgentStatus,
  onActionResult,
  ActionResult,
} from "../lib/bridge";
import { useAppStore } from "../stores/appStore";

export function useAgent() {
  const setAgentStatus = useAppStore((s) => s.setAgentStatus);
  const addActionResult = useAppStore((s) => s.addActionResult);

  useEffect(() => {
    let unlistenStatus: (() => void) | undefined;
    let unlistenResult: (() => void) | undefined;

    const setup = async () => {
      unlistenStatus = await onAgentStatus((status: string) => {
        setAgentStatus(status);
      });

      unlistenResult = await onActionResult((result: ActionResult) => {
        addActionResult(result);
      });
    };

    setup();

    return () => {
      unlistenStatus?.();
      unlistenResult?.();
    };
  }, [setAgentStatus, addActionResult]);
}
