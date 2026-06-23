import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subcontractorApi } from "../api";

export const useSubcontractors = (params) =>
  useQuery({
    queryKey: ["subcontractor", params],
    queryFn: () => subcontractorApi.list(params),
  });

export const useCreateSubcontractor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: subcontractorApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subcontractor"] }),
  });
};

export const useUpdateSubcontractor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => subcontractorApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subcontractor"] }),
  });
};

export const useDeleteSubcontractor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => subcontractorApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subcontractor"] }),
  });
};
