export type OverviewQueueItem = {
  id: string;
  class: "decision" | "overdue" | "due" | "exception";
  source: string;
  title: string;
  subjectName: string;
  owner: string;
  nextAction: string;
  dueAt: string | null;
  href: string;
  detail: string;
};

export type OverviewQueueFilter = "all" | "decision" | "overdue" | "due" | "exception";
export type OverviewQueueCounts = Record<OverviewQueueFilter, number>;

export function getOverviewQueueCounts(items: OverviewQueueItem[]): OverviewQueueCounts {
  return items.reduce<OverviewQueueCounts>((counts, item) => {
    counts.all += 1;
    counts[item.class] += 1;
    return counts;
  }, { all: 0, decision: 0, overdue: 0, due: 0, exception: 0 });
}

export function getOverviewQueueView(
  items: OverviewQueueItem[],
  filter: OverviewQueueFilter,
  limit = 10,
): { matching: OverviewQueueItem[]; visible: OverviewQueueItem[] } {
  const matching = filter === "all" ? items : items.filter((item) => item.class === filter);
  return { matching, visible: matching.slice(0, limit) };
}
