import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { throughputApi } from "../api";

export const useThroughputOverrides = (params) =>
  useQuery({
    queryKey: ["throughput", params],
    queryFn: () => throughputApi.list(params),
  });

export const useCreateThroughputOverride = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: throughputApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["throughput"] }),
  });
};

export const useDeleteThroughputOverride = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => throughputApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["throughput"] }),
  });
};
