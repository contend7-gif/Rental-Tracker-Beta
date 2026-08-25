export function reviewItemUrgencyRank(item) {
  const urgency = item?.urgency || "normal";
  if (urgency === "critical") return 4;
  if (urgency === "high") return 3;
  if (urgency === "medium") return 2;
  if (urgency === "low") return 1;
  return 0;
}

export function sortReviewItems(items = []) {
  return [...items].sort((left, right) => {
    const urgencyDelta = reviewItemUrgencyRank(right) - reviewItemUrgencyRank(left);
    if (urgencyDelta !== 0) return urgencyDelta;
    return String(left.title || "").localeCompare(String(right.title || ""));
  });
}

export function splitDoFirstItems(items = [], limit = 3) {
  const sortedItems = sortReviewItems(items);
  const doFirstItems = sortedItems.slice(0, limit);
  const doFirstKeys = new Set(doFirstItems.map((item) => item.key));
  return {
    doFirstItems,
    remainingItems: sortedItems.filter((item) => !doFirstKeys.has(item.key)),
  };
}

export function visibleReviewItemsForSection(items = [], activeSection = "all", doFirstItems = [], limit = 8) {
  const doFirstKeys = new Set(doFirstItems.map((item) => item.key));
  const scopedItems = activeSection === "all"
    ? items.filter((item) => !doFirstKeys.has(item.key))
    : items.filter((item) => item.sectionKey === activeSection);
  return sortReviewItems(scopedItems).slice(0, limit);
}

export function summarizeReviewSections(tabs = []) {
  const sectionTabs = tabs.filter((tab) => tab?.key && tab.key !== "all");
  const openTabs = sectionTabs.filter((tab) => Number(tab.count || 0) > 0);
  const clearTabs = sectionTabs.filter((tab) => Number(tab.count || 0) <= 0);
  const primarySection = [...openTabs].sort((left, right) => {
    const countDelta = Number(right.count || 0) - Number(left.count || 0);
    if (countDelta !== 0) return countDelta;
    return String(left.label || "").localeCompare(String(right.label || ""));
  })[0] || null;

  return {
    openSectionCount: openTabs.length,
    clearSectionCount: clearTabs.length,
    primarySection,
  };
}

export function summarizeIssueLabels(issues = [], limit = 3) {
  if (!issues.length) return ["Ready"];
  const groupedIssues = new Map();
  issues.forEach((issue) => {
    const label = String(issue?.label || "").trim();
    if (!label) return;
    groupedIssues.set(label, (groupedIssues.get(label) || 0) + 1);
  });

  const labels = [...groupedIssues.entries()].slice(0, limit).map(([label, count]) => (
    count > 1 ? `${label} · ${count} related checks` : label
  ));
  if (groupedIssues.size > limit) labels.push(`+${groupedIssues.size - limit} more`);
  return labels;
}

export function groupRelatedReviewItems(items = []) {
  const groupedByKey = new Map();
  const orderedEntries = [];

  items.forEach((item) => {
    const groupKey = String(item?.groupKey || "").trim();
    if (!groupKey) {
      orderedEntries.push(item);
      return;
    }
    if (!groupedByKey.has(groupKey)) {
      const entry = { groupKey, items: [] };
      groupedByKey.set(groupKey, entry);
      orderedEntries.push(entry);
    }
    groupedByKey.get(groupKey).items.push(item);
  });

  return orderedEntries.map((entry) => {
    if (!entry?.items) return entry;
    if (entry.items.length === 1) return entry.items[0];

    const members = sortReviewItems(entry.items);
    const lead = members[0];
    const issueLabels = [...new Set(members.flatMap((item) => item.issueLabels || []))];
    const checkCount = members.reduce(
      (sum, item) => sum + Math.max(1, Number(item.checkCount || item.issueLabels?.length || 1)),
      0,
    );

    return {
      ...lead,
      key: `group-${entry.groupKey}`,
      title: lead.groupTitle || lead.title,
      actionLabel: lead.groupActionLabel || "Review first",
      groupCount: members.length,
      checkCount,
      issueLabels,
      memberItems: members,
    };
  });
}

export function isGroupedReviewItem(item) {
  return Number(item?.groupCount || 0) > 1 && Array.isArray(item?.memberItems) && item.memberItems.length > 1;
}

export function sortReviewSeriesMembers(items = []) {
  return [...items].sort((left, right) => {
    const leftDate = String(left?.transaction?.date || "");
    const rightDate = String(right?.transaction?.date || "");
    const dateDelta = rightDate.localeCompare(leftDate);
    if (dateDelta !== 0) return dateDelta;
    return String(left?.title || "").localeCompare(String(right?.title || ""));
  });
}
