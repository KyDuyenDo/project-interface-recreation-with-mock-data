import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { materialApi } from "../api";

export const useMaterialETA = (params) =>
  useQuery({
    queryKey: ["material-eta", params],
    queryFn: () => materialApi.list(params),
  });

export const useImportMaterialETA = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file) => materialApi.importXlsx(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["material-eta"] }),
  });
};

export const useUpdateMaterialETA = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => materialApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["material-eta"] }),
  });
};

export const useMaterialTracking = (params) =>
  useQuery({
    queryKey: ["material-tracking", params],
    queryFn: () => materialApi.tracking(params),
  });

export const usePatchMaterialTracking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => materialApi.patchTracking(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["material-tracking"] }),
  });
};
