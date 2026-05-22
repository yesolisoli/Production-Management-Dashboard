"use client";

import { useState } from "react";
import { DEFAULT_STATUS_CONFIGS, type StatusConfig } from "../components/status-select";
import {
  deleteStatusConfigRecord,
  insertStatusConfig,
  refetchStatusConfigsSnapshot,
  replaceStatusConfigOrder,
  updateStatusConfigRecord,
} from "../supabase";

export function useStatusConfigs(initialConfigs: StatusConfig[] = DEFAULT_STATUS_CONFIGS) {
  const [statusConfigs, setStatusConfigs] = useState<StatusConfig[]>(initialConfigs);

  const restoreStatusConfigsFromDb = async (context: string) => {
    try {
      const dbConfigs = await refetchStatusConfigsSnapshot();
      setStatusConfigs(dbConfigs);
    } catch (error) {
      console.error(`[assignment-board] Failed to refetch status configs after ${context}:`, error);
    }
  };

  const handleUpdateConfig = (code: string, updates: Partial<StatusConfig>) => {
    setStatusConfigs((prev) => prev.map((c) => c.code === code ? { ...c, ...updates } : c));

    void updateStatusConfigRecord({
      code,
      ...("label" in updates ? { label: updates.label } : {}),
      ...("colorHex" in updates ? { colorHex: updates.colorHex } : {}),
      ...("unavailable" in updates ? { unavailable: updates.unavailable } : {}),
    }).catch((error) => {
      console.error("[assignment-board] Failed to update status config:", error);
      void restoreStatusConfigsFromDb("handleUpdateConfig");
    });
  };

  const handleDeleteConfig = (code: string) => {
    const config = statusConfigs.find((c) => c.code === code);
    if (config?.protected) return;

    setStatusConfigs((prev) => prev.filter((c) => c.code !== code));

    void deleteStatusConfigRecord(code).catch((error) => {
      console.error("[assignment-board] Failed to delete status config. It may still be in use by employee_daily_statuses:", error);
      void restoreStatusConfigsFromDb("handleDeleteConfig");
    });
  };

  const handleAddConfig = (label: string, colorHex: string) => {
    const code = `status_${crypto.randomUUID()}`;
    const nextConfig: StatusConfig = { code, label, className: "", colorHex };
    setStatusConfigs((prev) => [...prev, nextConfig]);

    const displayOrder = statusConfigs.length + 1;
    void insertStatusConfig({
      code,
      label,
      colorHex,
      unavailable: false,
      displayOrder,
    }).catch((error) => {
      console.error("[assignment-board] Failed to add status config:", error);
      void restoreStatusConfigsFromDb("handleAddConfig");
    });
  };

  const handleReorderConfig = (newConfigs: StatusConfig[]) => {
    setStatusConfigs(newConfigs);
    void replaceStatusConfigOrder(newConfigs).catch((error) => {
      console.error("[assignment-board] Failed to reorder status configs:", error);
      void restoreStatusConfigsFromDb("handleReorderConfig");
    });
  };

  return {
    statusConfigs,
    setStatusConfigs,
    handleUpdateConfig,
    handleDeleteConfig,
    handleAddConfig,
    handleReorderConfig,
  };
}
