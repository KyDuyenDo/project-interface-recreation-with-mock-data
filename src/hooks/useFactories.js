import { useQuery } from "@tanstack/react-query";
import { factoriesApi } from "../api";

export const useFactories = () =>
  useQuery({
    queryKey: ["factories"],
    queryFn: factoriesApi.list,
    staleTime: 300_000, // 5 min — rarely changes
  });
