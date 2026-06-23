import { useQuery } from "@tanstack/react-query";
import { ordersApi } from "../api";

/**
 * List orders from BAO_CAO_SO_DUOI.
 *
 * Supported params:
 *   factories     string[]   — factory codes, e.g. ["B-F2","C-F2"]
 *   months        string[]   — planning months, e.g. ["2026-06","2026-07"]
 *                              API derives crd_from/crd_to automatically
 *   statuses      string[]   — order statuses, e.g. ["P","N","C"]
 *   crd_from      string     — ISO date, inclusive lower bound on CRD
 *   crd_to        string     — ISO date, inclusive upper bound on CRD
 *   order_dt_from string     — ISO date, lower bound on order_date
 *   order_dt_to   string     — ISO date, upper bound on order_date
 *   search        string     — free-text search on ORDERNO / ARTICLE / CUSTNAME
 *   include_sizes bool       — include size breakdown (default true)
 *   include_pdsch bool       — embed PDSCH rows per order (heavier)
 *   include_events bool      — embed Announcement_Change events per order (heavier)
 *   page          int
 *   page_size     int
 */
export const useOrders = (params) =>
  useQuery({
    queryKey: ["orders", params],
    queryFn: () => ordersApi.list(params),
    // keepPreviousData removed: it caused stale data to persist when
    // navigating to a lower page number (data appeared frozen / unchanged).
    enabled: true,
  });

export const useOrderFactoryCodes = () =>
  useQuery({
    queryKey: ["order-factory-codes"],
    queryFn: () => ordersApi.factoryCodes(),
    staleTime: 5 * 60 * 1000,
  });

export const useOrderDetail = (id) =>
  useQuery({
    queryKey: ["order", id],
    queryFn: () => ordersApi.detail(id),
    enabled: !!id,
  });

export const useOrderPDSCH = (id) =>
  useQuery({
    queryKey: ["order-pdsch", id],
    queryFn: () => ordersApi.pdsch(id),
    enabled: !!id,
  });

export const useOrderEvents = (id) =>
  useQuery({
    queryKey: ["order-events", id],
    queryFn: () => ordersApi.events(id),
    enabled: !!id,
  });
