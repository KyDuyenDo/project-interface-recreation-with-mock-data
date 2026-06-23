import { useState, useEffect } from "react";

/**
 * useDebounce — delays emitting a value until it hasn't changed for `delay` ms.
 *
 * @param {*}      value  — the live value (e.g. a filter string typed by user)
 * @param {number} delay  — milliseconds to wait (default 400 ms)
 * @returns debounced value
 *
 * Usage:
 *   const debouncedSearch = useDebounce(filters.search, 400);
 *   // use debouncedSearch in query params instead of filters.search
 */
export function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
