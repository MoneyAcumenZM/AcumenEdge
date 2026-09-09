import { Landmark } from "lucide-react";

const Bonds = () => (
  <div className="flex flex-col items-center justify-center text-center py-24 gap-4">
    <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-background/60 border border-white/10">
      <Landmark className="w-8 h-8 text-white" strokeWidth={1.5} />
    </div>
    <h1 className="text-xl font-bold text-foreground">Bonds</h1>
    <p className="text-sm text-muted-foreground max-w-xs">
      Coming soon — government and corporate bond listings will be available here.
    </p>
  </div>
);

export default Bonds;
