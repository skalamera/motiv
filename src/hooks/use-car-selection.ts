import { useState, useEffect } from "react";

const STORAGE_KEY = "motiv_selected_car_id";

export function useCarSelection(initialValue: string = "") {
  const [selectedCarId, setSelectedCarIdState] = useState<string>(initialValue);

  // Load initial value from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setSelectedCarIdState(stored);
      }
    } catch (e) {
      console.warn("Could not read from localStorage", e);
    }
  }, []);

  const setSelectedCarId = (id: string) => {
    setSelectedCarIdState(id);
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }
  };

  return [selectedCarId, setSelectedCarId] as const;
}
