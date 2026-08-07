import difflib

from fastapi import APIRouter

from api.diff.schemas import DiffHunk, DiffLine, DiffRequest, DiffResponse

router = APIRouter(prefix="/diff", tags=["diff"])


def _parse_unified_diff(old: str, new: str, path: str) -> DiffResponse:
    old_lines = old.splitlines(keepends=True)
    new_lines = new.splitlines(keepends=True)

    matcher = difflib.SequenceMatcher(None, old_lines, new_lines)
    hunks: list[DiffHunk] = []
    context = 3

    groups = list(matcher.get_grouped_opcodes(context))
    for group in groups:
        old_start = group[0][1] + 1
        new_start = group[0][3] + 1
        lines: list[DiffLine] = []
        old_lineno = old_start
        new_lineno = new_start

        for tag, i1, i2, j1, j2 in group:
            if tag == "equal":
                for line in old_lines[i1:i2]:
                    lines.append(DiffLine(
                        type="context",
                        content=line.rstrip("\n"),
                        old_lineno=old_lineno,
                        new_lineno=new_lineno,
                    ))
                    old_lineno += 1
                    new_lineno += 1
            elif tag in ("replace", "delete"):
                for line in old_lines[i1:i2]:
                    lines.append(DiffLine(
                        type="remove",
                        content=line.rstrip("\n"),
                        old_lineno=old_lineno,
                    ))
                    old_lineno += 1
                if tag == "replace":
                    for line in new_lines[j1:j2]:
                        lines.append(DiffLine(
                            type="add",
                            content=line.rstrip("\n"),
                            new_lineno=new_lineno,
                        ))
                        new_lineno += 1
            elif tag == "insert":
                for line in new_lines[j1:j2]:
                    lines.append(DiffLine(
                        type="add",
                        content=line.rstrip("\n"),
                        new_lineno=new_lineno,
                    ))
                    new_lineno += 1

        hunks.append(DiffHunk(old_start=old_start, new_start=new_start, lines=lines))

    return DiffResponse(file_path=path, hunks=hunks, has_changes=bool(hunks))


@router.post("", response_model=DiffResponse)
def compute_diff(body: DiffRequest):
    return _parse_unified_diff(body.old_content, body.new_content, body.file_path)
