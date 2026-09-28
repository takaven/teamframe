"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { findPositionPath, positionDisplayTitle } from "@/services/positionService/model";

export type OrganisationTreeItem = {
  id: string;
  title: string;
  department: string;
  status: "Vacant" | "Filled";
  assignedEmployeeId: string | null;
  assignedEmployeeName: string | null;
  deptName: string;
  photoUrl: string | null;
  children: OrganisationTreeItem[];
};

function initialOrganisationExpanded(tree: OrganisationTreeItem[], selectedId: string | null): Set<string> {
  const expanded = findPositionPath(tree, selectedId);
  for (const root of tree) expanded.add(root.id);
  return expanded;
}

function OrganisationNode({
  node,
  depth,
  selectedId,
  selectedIds,
  expandedIds,
  onToggle,
}: {
  node: OrganisationTreeItem;
  depth: number;
  selectedId: string | null;
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.id);
  const selected = node.id === selectedId;
  const inSelectedPath = selectedIds.has(node.id);
  const occupied = node.status === "Filled" && Boolean(node.assignedEmployeeId && node.assignedEmployeeName);
  const vacant = !occupied;
  const title = positionDisplayTitle(node.title, vacant);
  const personName = node.assignedEmployeeName ?? "";

  return (
    <li
      className="tf-org-branch"
      data-depth={depth}
      data-path={inSelectedPath ? "true" : undefined}
      data-expanded={expanded ? "true" : undefined}
    >
      <div className="tf-org-node" data-selected={selected ? "true" : undefined} data-vacant={vacant ? "true" : undefined}>
        {hasChildren ? (
          <button
            type="button"
            className="tf-org-disclosure"
            aria-label={`${expanded ? "Collapse" : "Expand"} ${personName || title}`}
            aria-expanded={expanded}
            aria-controls={`org-children-${node.id}`}
            onClick={() => onToggle(node.id)}
          >
            <span aria-hidden>{expanded ? "−" : "+"}</span>
          </button>
        ) : (
          <span className="tf-org-disclosure-placeholder" aria-hidden />
        )}

        {vacant ? (
          <span className="tf-org-vacancy-avatar" aria-hidden>+</span>
        ) : (
          <Link href={`/people/${node.assignedEmployeeId}`} className="tf-org-avatar-link" aria-label={`Open ${personName}'s employee record`}>
            <EmployeeAvatar name={personName} photoUrl={node.photoUrl} size={depth === 0 ? 42 : 36} />
          </Link>
        )}

        <span className="tf-org-identity">
          {vacant ? (
            <Link href={`/org-chart?position=${node.id}`} className="tf-org-person-name">
              {title}
            </Link>
          ) : (
            <Link href={`/people/${node.assignedEmployeeId}`} className="tf-org-person-name">
              {personName}
            </Link>
          )}
          <Link href={`/org-chart?position=${node.id}`} className="tf-org-position-title" aria-current={selected ? "true" : undefined}>
            {vacant ? "Vacant" : title}
          </Link>
          <span className="tf-org-node-meta">
            {node.deptName}
            {hasChildren ? ` · ${node.children.length} report${node.children.length === 1 ? "" : "s"}` : ""}
          </span>
        </span>

        <Link href={`/org-chart?position=${node.id}`} className="tf-org-position-open" aria-label={`Open position details for ${title}`}>
          <span aria-hidden>→</span>
        </Link>
      </div>

      {hasChildren && expanded ? (
        <ul id={`org-children-${node.id}`} className="tf-org-children">
          {node.children.map((child) => (
            <OrganisationNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              selectedIds={selectedIds}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function OrganisationTree({
  tree,
  selectedId,
}: {
  tree: OrganisationTreeItem[];
  selectedId: string | null;
}) {
  const pathIds = useMemo(() => findPositionPath(tree, selectedId), [tree, selectedId]);
  const [expandedIds, setExpandedIds] = useState(() => initialOrganisationExpanded(tree, selectedId));

  useEffect(() => {
    setExpandedIds((current) => {
      if (window.matchMedia("(max-width: 640px)").matches) return new Set(pathIds);
      const next = new Set(current);
      pathIds.forEach((id) => next.add(id));
      return next;
    });
  }, [pathIds]);

  function toggle(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="tf-org-tree" aria-label="Organisation reporting hierarchy">
      <ul className="tf-org-roots">
        {tree.map((node) => (
          <OrganisationNode
            key={node.id}
            node={node}
            depth={0}
            selectedId={selectedId}
            selectedIds={pathIds}
            expandedIds={expandedIds}
            onToggle={toggle}
          />
        ))}
      </ul>
    </div>
  );
}
