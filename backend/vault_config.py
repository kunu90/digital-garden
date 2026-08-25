"""Runtime-mutable vault path, persisted to ~/.digital-garden/config.json."""

import json
from pathlib import Path

_CONFIG_FILE = Path.home() / ".digital-garden" / "config.json"

_NOT_LOADED = object()
_vault_path: Path | None = _NOT_LOADED  # type: ignore[assignment]


def join_vault_path(vault: Path, rel: str = "") -> Path:
    """Join a vault-relative path without following the final symlink.

    Notes may live in the vault as a symlink to another folder (for example
    the repo's ``Building digital garden`` directory). ``Path.resolve()``
    would treat those as outside the vault and reject them.
    """
    root = vault.expanduser().resolve()
    rel_path = Path(rel) if rel else Path()
    if rel_path.is_absolute() or any(part == ".." for part in rel_path.parts):
        raise ValueError("Path is outside the vault.")
    return root / rel_path


def iter_markdown_files(vault: Path):
    """Yield markdown files under the vault, following directory symlinks."""
    root = vault.expanduser().resolve()

    def walk(directory: Path):
        try:
            children = sorted(directory.iterdir(), key=lambda p: p.name.lower())
        except OSError:
            return
        for path in children:
            if path.name.startswith("."):
                continue
            if path.is_dir():
                yield from walk(path)
            elif path.suffix.lower() == ".md":
                yield path

    yield from walk(root)


def _load() -> None:
    global _vault_path
    # 1. Try persistent config file
    if _CONFIG_FILE.exists():
        try:
            data = json.loads(_CONFIG_FILE.read_text(encoding="utf-8"))
            if "vault_path" in data:
                _vault_path = Path(data["vault_path"]).expanduser().resolve()
                return
        except Exception:
            pass

    # 2. Fall back to VAULT_PATH env var / .env
    try:
        from config import get_settings
        settings = get_settings()
        if settings.vault_path:
            _vault_path = settings.vault_path.expanduser().resolve()
            return
    except Exception:
        pass

    _vault_path = None


def get_vault_path() -> Path | None:
    global _vault_path
    if _vault_path is _NOT_LOADED:
        _load()
    return _vault_path  # type: ignore[return-value]


def set_vault_path(path: Path) -> None:
    global _vault_path
    _vault_path = path.expanduser().resolve()
    _CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    _CONFIG_FILE.write_text(
        json.dumps({"vault_path": str(_vault_path)}, indent=2), encoding="utf-8"
    )
