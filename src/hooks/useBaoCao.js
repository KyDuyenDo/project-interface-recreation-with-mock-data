import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { baoCaoApi } from "../api";

/**
 * List BAO_CAO_SO_DUOI rows (PDSCH-based).
 *
 * Params:
 *   search       string   — search on ZLBH / RY / Article
 *   lpd_from     string   — ISO date, LPD >= this date
 *   lpd_to       string   — ISO date, LPD <= this date
 *   page         int
 *   page_size    int
 */
export const useBaoCao = (params) =>
  useQuery({
    queryKey: ["bao-cao-so-duoi", params],
    queryFn: () => baoCaoApi.list(params),
    enabled: true,
  });

/**
 * Patch (upsert) user-editable fields for a single ZLBH row.
 * Invalidates the list cache on success.
 */
export const usePatchBaoCao = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ zlbh, body }) => baoCaoApi.patch(zlbh, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bao-cao-so-duoi"] }),
  });
};
