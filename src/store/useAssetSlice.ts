import { useCallback, useMemo, useRef, useState } from "react";
import type { Asset, Transaction, WorkOrder } from "../models.ts";
import { createAssetActions } from "./assetStore.ts";
import type { AppendActivityLog } from "./activityStore.ts";

type StateUpdater<T> = T[] | ((previous: T[]) => T[]);

export function useAssetSlice({
  getTransactions,
  setWorkOrders,
  appendActivityLog,
}: {
  getTransactions: () => Transaction[];
  setWorkOrders: (updater: StateUpdater<WorkOrder>) => void;
  appendActivityLog: AppendActivityLog;
}) {
  const [assets, setAssetState] = useState<Asset[]>([]);
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const setAssets = useCallback((updater: StateUpdater<Asset>) => setAssetState(updater), []);
  const actions = useMemo(() => createAssetActions({
    getAssets: () => assetsRef.current,
    getTransactions,
    setAssets,
    setWorkOrders,
    appendActivityLog,
  }), [appendActivityLog, getTransactions, setAssets, setWorkOrders]);
  return { assets, setAssets, actions };
}
