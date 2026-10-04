import type { InlineMark, InlineMarkType, RichText } from "./article-model";

/** Preserve marks around an edit using common prefix/suffix, including surrogate pairs. */
export function editRichText(value: RichText, text: string): RichText {
  if (text === value.text) return value;
  let start = 0,
    end = value.text.length,
    newEnd = text.length;
  while (start < end && start < newEnd && value.text[start] === text[start])
    start++;
  while (
    end > start &&
    newEnd > start &&
    value.text[end - 1] === text[newEnd - 1]
  ) {
    end--;
    newEnd--;
  }
  const delta = newEnd - end;
  const marks = value.marks.flatMap((mark) => {
    let from = mark.from,
      to = mark.to;
    if (to <= start) return [mark];
    if (from >= end && !(start === end && from === start))
      return [{ ...mark, from: from + delta, to: to + delta }];
    from = from <= start ? from : start;
    to = to >= end ? to + delta : newEnd;
    return to > from ? [{ ...mark, from, to }] : [];
  });
  return { text, marks };
}

export function toggleRichMark(
  value: RichText,
  type: InlineMarkType,
  from: number,
  to: number,
): RichText {
  if (from < 0 || to <= from || to > value.text.length) return value;
  const existing = value.marks.some(
    (m) => m.type === type && m.from <= from && m.to >= to,
  );
  let marks: InlineMark[];
  if (existing) {
    marks = value.marks.flatMap((m) => {
      if (m.type !== type || m.to <= from || m.from >= to) return [m];
      return [
        ...(m.from < from ? [{ ...m, to: from }] : []),
        ...(m.to > to ? [{ ...m, from: to }] : []),
      ];
    });
  } else marks = [...value.marks, { type, from, to }];
  return { ...value, marks };
}

export function richTextSegments(value: RichText) {
  const cuts = [
    ...new Set([
      0,
      value.text.length,
      ...value.marks.flatMap((m) => [m.from, m.to]),
    ]),
  ].sort((a, b) => a - b);
  return cuts.slice(0, -1).map((from, index) => ({
    text: value.text.slice(from, cuts[index + 1]),
    marks: value.marks
      .filter((m) => m.from <= from && m.to >= cuts[index + 1])
      .map((m) => m.type),
  }));
}
