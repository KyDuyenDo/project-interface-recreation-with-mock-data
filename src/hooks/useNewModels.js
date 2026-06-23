import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { newModelsApi } from "../api";

export const useNewModelScan = () =>
  useQuery({
    queryKey: ["new-model-scan"],
    queryFn: newModelsApi.scan,
  });

export const useNewModelPins = () =>
  useQuery({
    queryKey: ["new-model-pins"],
    queryFn: newModelsApi.pins.list,
  });

export const useCreatePin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: newModelsApi.pins.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["new-model-pins"] }),
  });
};

export const useDeletePin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => newModelsApi.pins.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["new-model-pins"] }),
  });
};
