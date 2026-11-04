"""把一个原型目录打成 zip，自动排除依赖、版本库和系统垃圾文件。

用法：python3 pack.py <目录> [输出目录]
默认输出到仓库根目录的 dist/；最后一行打印 zip 的绝对路径。
"""
import sys
import zipfile
from datetime import datetime
from pathlib import Path

EXCLUDE_DIRS = {".git", "node_modules", "__MACOSX", "dist", ".vite", ".cache", "_to_delete", "test-results", "playwright-report"}
EXCLUDE_FILES = {".DS_Store", "Thumbs.db", "desktop.ini"}
EXCLUDE_SUFFIXES = (".inspect.ndjson", ".log")


def skip(rel: Path) -> bool:
    if any(part in EXCLUDE_DIRS for part in rel.parts[:-1]):
        return True
    name = rel.name
    return name in EXCLUDE_FILES or name.startswith("._") or name.endswith(EXCLUDE_SUFFIXES)


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("用法：python3 pack.py <目录> [输出目录]")
    src = Path(sys.argv[1]).resolve()
    if not src.is_dir():
        sys.exit(f"目录不存在：{src}")
    repo = Path(__file__).resolve().parents[4]
    out_dir = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else repo / "dist"
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{src.name}-{datetime.now():%Y%m%d-%H%M}.zip"

    count = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(src.rglob("*")):
            rel = path.relative_to(src)
            if path.is_file() and not skip(rel):
                zf.write(path, Path(src.name) / rel)
                count += 1
    if count == 0:
        out.unlink()
        sys.exit("没有可打包的文件")
    print(f"{count} 个文件，{out.stat().st_size / 1024 / 1024:.1f} MB")
    print(out)


if __name__ == "__main__":
    main()
