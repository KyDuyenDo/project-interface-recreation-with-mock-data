import { MOCK_FREQUENCY_DATA } from "../pages/ga-config/mockData";

/**
 * Mock wrapper for useModelLineFrequency
 * Returns mock data when isMockMode is true
 */
export const useModelLineFrequencyMock = (params, isMockMode, useRealHook) => {
  if (isMockMode) {
    return {
      data: MOCK_FREQUENCY_DATA,
      isLoading: false,
      error: null,
      refetch: () => Promise.resolve({ data: MOCK_FREQUENCY_DATA }),
    };
  }
  return useRealHook(params);
};
