import { useQuery } from "@tanstack/react-query";
import { eventsApi } from "../api";

export const useEvents = (params) =>
  useQuery({
    queryKey: ["events", params],
    queryFn: () => eventsApi.list(params),
  });

export const useErpEvents = (params) =>
  useQuery({
    queryKey: ["erp-events", params],
    queryFn: () => eventsApi.erpRecent(params),
  });
