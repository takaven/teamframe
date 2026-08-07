export type PositionRecord = {
  id: string;
  title: string;
  department: string;
  parent_position_id: string | null;
  assigned_employee_id: string | null;
  assigned_employee_name: string | null;
  note: string | null;
  status: "Vacant" | "Filled";
  jd_attached: boolean;
  jd_original_filename: string | null;
  jd_mime_type: string | null;
  jd_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PositionTreeNode = PositionRecord & {
  children: PositionTreeNode[];
};

export function buildPositionTree(positions: PositionRecord[]): PositionTreeNode[] {
  const nodes = new Map<string, PositionTreeNode>();
  for (const position of positions) {
    nodes.set(position.id, { ...position, children: [] });
  }

  const roots: PositionTreeNode[] = [];
  for (const node of nodes.values()) {
    if (node.parent_position_id && nodes.has(node.parent_position_id)) {
      nodes.get(node.parent_position_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sort = (items: PositionTreeNode[]) => {
    items.sort((a, b) => a.title.localeCompare(b.title));
    for (const item of items) sort(item.children);
  };
  sort(roots);
  return roots;
}

export function wouldCreateReportingCycle(
  positions: Array<{ id: string; parent_position_id: string | null }>,
  positionId: string,
  nextParentId: string | null,
): boolean {
  if (!nextParentId) return false;
  if (positionId === nextParentId) return true;

  const parentById = new Map(positions.map((position) => [position.id, position.parent_position_id]));
  parentById.set(positionId, nextParentId);
  const seen = new Set<string>();
  let cursor: string | null | undefined = nextParentId;

  while (cursor) {
    if (cursor === positionId) return true;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = parentById.get(cursor) ?? null;
  }
  return false;
}

export function validateSingleAssignmentInvariant(
  positions: Array<{ id: string; assigned_employee_id: string | null }>,
): boolean {
  const seen = new Set<string>();
  for (const position of positions) {
    if (!position.assigned_employee_id) continue;
    if (seen.has(position.assigned_employee_id)) return false;
    seen.add(position.assigned_employee_id);
  }
  return true;
}

export function validatePositionJdFileForTest(input: {
  fileName: string;
  mimeType: string;
  size: number;
  bytes: Buffer;
}): "pdf" | "docx" {
  if (!input.fileName || input.fileName.length > 180) throw new Error("POSITION_JD_INVALID_FILENAME");
  if (input.size === 0) throw new Error("POSITION_JD_EMPTY_FILE");
  if (input.size > 10 * 1024 * 1024) throw new Error("POSITION_JD_TOO_LARGE");
  const lowerName = input.fileName.toLowerCase();
  if (lowerName.endsWith(".pdf")) {
    if (input.mimeType !== "application/pdf") throw new Error("POSITION_JD_MIME_EXTENSION_MISMATCH");
    if (input.bytes.subarray(0, 4).toString("ascii") !== "%PDF") throw new Error("POSITION_JD_SIGNATURE_MISMATCH");
    return "pdf";
  }
  if (lowerName.endsWith(".docx")) {
    if (input.mimeType !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      throw new Error("POSITION_JD_MIME_EXTENSION_MISMATCH");
    }
    if (
      input.bytes.subarray(0, 4).toString("ascii") !== "PK\u0003\u0004" ||
      input.bytes.indexOf(Buffer.from("[Content_Types].xml", "ascii")) === -1 ||
      input.bytes.indexOf(Buffer.from("word/", "ascii")) === -1
    ) {
      throw new Error("POSITION_JD_SIGNATURE_MISMATCH");
    }
    return "docx";
  }
  throw new Error("POSITION_JD_UNSUPPORTED_EXTENSION");
}
