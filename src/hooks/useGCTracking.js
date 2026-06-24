import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gcTrackingApi } from "../api";

export const useGCTracking = (params) =>
  useQuery({
    queryKey: ["gc-tracking", params],
    queryFn: () => gcTrackingApi.list(params),
  });

export const usePatchGCTracking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => gcTrackingApi.patch(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gc-tracking"] }),
  });
};
