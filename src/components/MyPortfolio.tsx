import { Briefcase } from "lucide-react";
import { Link } from "react-router-dom";

const MyPortfolio = () => {
  return (
    <div className="bg-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Briefcase className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">My Portfolio</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-3">View your holdings and performance</p>
      <Link to="/portfolio" className="text-sm text-primary font-medium hover:underline">
        View Portfolio →
      </Link>
    </div>
  );
};

export default MyPortfolio;
