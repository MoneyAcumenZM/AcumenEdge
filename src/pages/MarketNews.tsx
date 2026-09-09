import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Newspaper, Calendar, Megaphone, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  source: string | null;
  published_at: string;
}

const categoryIcon: Record<string, typeof Calendar> = {
  agm: Calendar,
  announcement: Megaphone,
  dividend: Megaphone,
  holiday: Calendar,
};

const MarketNews = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: news = [], isLoading } = useQuery({
    queryKey: ["market-news"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_news" as any)
        .select("id, title, summary, body, category, source, published_at")
        .eq("is_active", true)
        .order("published_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as NewsItem[];
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/">
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Market News</h1>
        <span className="ml-auto text-[10px] text-muted-foreground">{news.length} articles</span>
      </div>

      {isLoading ? (
        <div className="hairline-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="py-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : news.length === 0 ? (
        <div className="text-center py-16">
          <Newspaper className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No market news available</p>
        </div>
      ) : (
        <div className="hairline-y">
          {news.map((item) => {
            const Icon = categoryIcon[item.category] || Megaphone;
            const isExpanded = expandedId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="w-full text-left py-4"
              >
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-background/60 border border-white/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-white" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.summary}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(item.published_at).toLocaleDateString("en-ZM", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {item.source && (
                        <span className="text-[9px] text-muted-foreground">{item.source}</span>
                      )}
                      <span className="text-[8px] px-2 py-0.5 rounded-full border border-white/10 text-white/70 capitalize">{item.category}</span>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 pt-3 hairline-top">
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{item.body}</p>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default MarketNews;
