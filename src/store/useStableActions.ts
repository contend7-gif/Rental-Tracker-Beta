import { useRef } from "react";

type ActionMap = Record<string, (...args: never[]) => unknown>;

export function createActionFacade<TActions extends ActionMap>(
  getCurrentActions: () => TActions,
  actionNames: Array<keyof TActions>,
): TActions {
  return Object.fromEntries(actionNames.map((name) => [
    name,
    (...args: never[]) => getCurrentActions()[name](...args),
  ])) as TActions;
}

export function useStableActions<TActions extends ActionMap>(actions: TActions): TActions {
  const currentActionsRef = useRef(actions);
  currentActionsRef.current = actions;
  const stableActionsRef = useRef<TActions | null>(null);
  if (!stableActionsRef.current) {
    stableActionsRef.current = createActionFacade(
      () => currentActionsRef.current,
      Object.keys(actions) as Array<keyof TActions>,
    );
  }
  return stableActionsRef.current;
}
