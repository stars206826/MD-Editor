/**
 * Network Status Context
 * 
 * Provides network status detection and management across the application.
 * Requirements: 9.1, 9.2, 9.5
 */

"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface NetworkContextValue {
  isOnline: boolean;
  lastOnlineAt: Date | null;
  checkConnection: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

interface NetworkProviderProps {
  children: ReactNode;
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(new Date());

  // Check actual network connectivity by making a request
  async function checkConnection(): Promise<boolean> {
    try {
      const response = await fetch("/api/health", {
        method: "HEAD",
        cache: "no-cache",
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // Handle online event (Requirement 9.5)
  function handleOnline() {
    // Verify actual connectivity before updating state
    checkConnection().then((connected) => {
      if (connected) {
        setIsOnline(true);
        setLastOnlineAt(new Date());
      }
    });
  }

  // Handle offline event (Requirement 9.1)
  function handleOffline() {
    setIsOnline(false);
  }

  // Set up event listeners (Requirement 9.1, 9.5)
  useEffect(() => {
    // Initial check
    setIsOnline(navigator.onLine);
    
    if (navigator.onLine) {
      checkConnection().then((connected) => {
        setIsOnline(connected);
        if (connected) {
          setLastOnlineAt(new Date());
        }
      });
    }

    // Add event listeners
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodic connectivity check (every 30 seconds)
    const intervalId = setInterval(() => {
      if (navigator.onLine) {
        checkConnection().then((connected) => {
          if (connected !== isOnline) {
            setIsOnline(connected);
            if (connected) {
              setLastOnlineAt(new Date());
            }
          }
        });
      }
    }, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(intervalId);
    };
  }, [isOnline]);

  return (
    <NetworkContext.Provider value={{ isOnline, lastOnlineAt, checkConnection }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}
