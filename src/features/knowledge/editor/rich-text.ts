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
  value = { ...value, marks: normalizeMarks(value.text, value.marks) };
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

/** Canonical mark ranges: no HTML is accepted by the editor or server document. */
export const markTypes: InlineMarkType[] = ["bold", "italic", "underline", "highlight"];
export function normalizeMarks(text: string, input: InlineMark[] = []): InlineMark[] {
  const result: InlineMark[] = [];
  for (const type of markTypes) {
    const ranges = input.filter(m => m.type === type && Number.isInteger(m.from) && Number.isInteger(m.to))
      .map(m => ({type, from: Math.max(0, m.from), to: Math.min(text.length, m.to)}))
      .filter(m => m.to > m.from).sort((a,b) => a.from-b.from || a.to-b.to);
    for (const mark of ranges) {
      const last = result.at(-1);
      if (last?.type === type && last.to >= mark.from) last.to = Math.max(last.to, mark.to);
      else result.push({...mark});
    }
  }
  return result;
}
export function rangeMarked(text: string, marks: InlineMark[], type: InlineMarkType, from: number, to: number) {
  return to > from && normalizeMarks(text, marks).some(m => m.type === type && m.from <= from && m.to >= to);
}
export function clearMarks(text: string, marks: InlineMark[], from: number, to: number) {
  const clean = normalizeMarks(text, marks);
  if (from < 0 || to <= from || to > text.length) return clean;
  return clean.flatMap(m => m.to <= from || m.from >= to ? [m] : [
    ...(m.from < from ? [{...m, to: from}] : []), ...(m.to > to ? [{...m, from: to}] : [])]);
}
