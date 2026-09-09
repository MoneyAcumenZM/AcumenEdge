import { useState, useEffect } from "react";
import { Clock, Timer } from "lucide-react";

const schedule = [
  { label: "Pre-Opening", time: "10:00 – 11:00", desc: "Order entry only, no trades", startMin: 600, endMin: 660 },
  { label: "Continuous Trading", time: "11:00 – 14:00", desc: "Live matching & execution", startMin: 660, endMin: 840 },
  { label: "Amendments Window", time: "Until 15:00", desc: "Trade amendments & cancellations", startMin: 840, endMin: 900 },
  { label: "Market Publication", time: "15:00", desc: "End-of-day data published", startMin: 900, endMin: 901 },
];

const SessionsSchedule = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const totalMin = now.getHours() * 60 + now.getMinutes();
  const nextSession = schedule.find((s) => totalMin < s.endMin);
  const countdownMin = nextSession ? nextSession.endMin - totalMin : 0;
  const countdownH = Math.floor(countdownMin / 60);
  const countdownM = countdownMin % 60;

  return (
    <div className="bg-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Trading Sessions</h3>
      </div>
      <div className="space-y-2">
        {schedule.map((s) => {
          const isActive = totalMin >= s.startMin && totalMin < s.endMin;
          return (
            <div key={s.label} className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${isActive ? "bg-primary/10 border border-primary/20" : "bg-secondary/50"}`}>
              <div>
                <p className={`text-sm font-medium ${isActive ? "text-primary" : "text-foreground"}`}>{s.label}</p>
                <p className="text-[10px] text-muted-foreground">{s.desc}</p>
              </div>
              <span className="text-xs text-muted-foreground">{s.time}</span>
            </div>
          );
        })}
      </div>
      {nextSession && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Timer className="w-3.5 h-3.5" />
          <span>Next: {nextSession.label} in {countdownH > 0 ? `${countdownH}h ` : ''}{countdownM}m</span>
        </div>
      )}
    </div>
  );
};

export default SessionsSchedule;
