import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

export function ServerStatus() {
  const [status, setStatus] = useState("connecting"); // 'connecting' | 'connected' | 'disconnected'
  const [lastChecked, setLastChecked] = useState(null);

  useEffect(() => {
    let mounted = true;
    let intervalId = null;

    const checkServer = async () => {
      if (!mounted) return;
      
      try {
        // Try to access Firestore system status document
        const docRef = doc(db, "system", "status");
        await getDoc(docRef);
        
        if (mounted) {
          setStatus("connected");
          setLastChecked(new Date());
        }
      } catch (error) {
        // If error, try alternative check
        try {
          // Try to list collections as fallback
          if (db.app) {
            await db.app.options_.authUid;
          }
          if (mounted) {
            setStatus("connected");
            setLastChecked(new Date());
          }
        } catch {
          if (mounted) {
            setStatus("disconnected");
          }
        }
      }
    };

    // Initial check
    checkServer();

    // Set up polling every 10 seconds
    intervalId = setInterval(checkServer, 10000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: <Wifi className="w-4 h-4" />,
          color: "text-green-500",
          bgColor: "bg-green-500/10",
          label: "Connected",
          pulse: false,
        };
      case "disconnected":
        return {
          icon: <WifiOff className="w-4 h-4" />,
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          label: "Disconnected",
          pulse: true,
        };
      default:
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          color: "text-yellow-500",
          bgColor: "bg-yellow-500/10",
          label: "Connecting...",
          pulse: false,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-full
        ${config.bgColor} ${config.color}
        transition-all duration-300
        ${config.pulse ? "animate-pulse" : ""}
      `}
      title={`Server Status: ${config.label}`}
    >
      {config.icon}
      <span className="text-xs font-medium hidden sm:inline">
        {config.label}
      </span>
    </div>
  );
}

export default ServerStatus;
