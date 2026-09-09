import { createContext, useContext, useState, ReactNode } from "react";

interface UIState {
  isDepositOpen: boolean;
  setDepositOpen: (v: boolean) => void;
}

const UIContext = createContext<UIState>({ isDepositOpen: false, setDepositOpen: () => {} });

export const useUI = () => useContext(UIContext);

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [isDepositOpen, setDepositOpen] = useState(false);
  return (
    <UIContext.Provider value={{ isDepositOpen, setDepositOpen }}>
      {children}
    </UIContext.Provider>
  );
};
