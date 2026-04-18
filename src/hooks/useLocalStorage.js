import { useEffect, useState } from "react";

export function useLocalStorage(key, initialValue) {
  const getInitialValue = () =>
    typeof initialValue === "function" ? initialValue() : initialValue;

  const [value, setValue] = useState(() => {
    try {
      const storedValue = window.localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : getInitialValue();
    } catch (error) {
      console.error("Error leyendo localStorage", error);
      return getInitialValue();
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Error guardando localStorage", error);
    }
  }, [key, value]);

  return [value, setValue];
}
