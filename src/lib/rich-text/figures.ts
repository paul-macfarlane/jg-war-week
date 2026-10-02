import type { CommandProps } from "@tiptap/core";
import {
  Fragment,
  type NodeType,
  type Node as ProseMirrorNode,
  Slice,
} from "@tiptap/pm/model";
import {
  NodeSelection,
  type Selection,
  type Transaction,
} from "@tiptap/pm/state";

/**
 * The `figure` group: the nodes the stored shape allows only at the top of
 * a document (an image and a video). Only `QuoteDocument` admits the group,
 * so neither can land in a list item or a quote.
 */
export const FIGURE_GROUP = "figure";

function isFigure(type: NodeType): boolean {
  return (type.spec.group ?? "").split(" ").includes(FIGURE_GROUP);
}

/**
 * Where the Image and Video controls put a new figure: in place of the
 * selection, except that a selected image or video (one just inserted, or
 * clicked to show its tools) is kept and the new figure goes after it.
 */
export function figureInsertRange(selection: Selection): {
  from: number;
  to: number;
} {
  if (selection instanceof NodeSelection && isFigure(selection.node.type)) {
    return { from: selection.to, to: selection.to };
  }
  return { from: selection.from, to: selection.to };
}

/**
 * The Image and Video controls' command: puts `figure` at
 * `figureInsertRange`, directly after the list or quote the selection sits
 * in when it sits in one (`replaceLiftingFigures`), since a figure cannot
 * live inside either.
 */
export function insertFigure(
  figure: ProseMirrorNode,
  { state, tr, dispatch, commands }: CommandProps,
): boolean {
  const range = figureInsertRange(state.selection);
  if (!dispatch) return true;
  return (
    replaceLiftingFigures(
      tr,
      range.from,
      range.to,
      new Slice(Fragment.from(figure), 0, 0),
    ) || commands.insertContentAt(range, figure.toJSON())
  );
}

/**
 * Replaces `from`–`to` with `slice` when the range sits inside a list or a
 * quote and the slice carries a figure (an image or a video): the rest of
 * the slice goes in where it was aimed and every figure goes directly after
 * that whole list or quote, selected, so neither is split around it.
 * Returns false, touching nothing, for any other range or slice;
 * ProseMirror's own fitting is right there. Only lists and quotes nest a
 * block, so "inside one" is a depth past the document's own children.
 * Ported from journeys' `replaceLiftingImages`, widened from images to the
 * figure group.
 */
export function replaceLiftingFigures(
  tr: Transaction,
  from: number,
  to: number,
  slice: Slice,
): boolean {
  const $from = tr.doc.resolve(from);
  if ($from.depth <= 1) return false;
  const figures: ProseMirrorNode[] = [];
  const rest = withoutFigures(slice.content, figures);
  if (figures.length === 0) return false;

  const after = $from.after(1);
  // A side the slice closed only because a figure stood there opens as far
  // as what is left allows, so pasted words join the item they land in; any
  // other side keeps the openness it had, within what is left.
  const most = Slice.maxOpen(rest);
  const first = slice.content.firstChild;
  const last = slice.content.lastChild;
  const openStart =
    first && isFigure(first.type)
      ? most.openStart
      : Math.min(slice.openStart, most.openStart);
  const openEnd =
    last && isFigure(last.type)
      ? most.openEnd
      : Math.min(slice.openEnd, most.openEnd);
  tr.replaceRange(from, to, new Slice(rest, openStart, openEnd));
  const $at = tr.doc.resolve(tr.mapping.map(after));
  const at = $at.depth === 0 ? $at.pos : $at.after(1);
  tr.insert(at, figures);
  const lastFigure = figures[figures.length - 1];
  tr.setSelection(
    NodeSelection.create(
      tr.doc,
      at + Fragment.from(figures).size - lastFigure.nodeSize,
    ),
  );
  return true;
}

/** `fragment` with every figure taken out, at any depth, into `figures`. */
function withoutFigures(
  fragment: Fragment,
  figures: ProseMirrorNode[],
): Fragment {
  const kept: ProseMirrorNode[] = [];
  fragment.forEach((node) => {
    if (isFigure(node.type)) {
      figures.push(node);
    } else {
      kept.push(
        node.isLeaf ? node : node.copy(withoutFigures(node.content, figures)),
      );
    }
  });
  return Fragment.fromArray(kept);
}
