#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
from pathlib import Path


ASSISTANT_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ASSISTANT_ROOT.parent
MATERIAL_ROOT = REPO_ROOT / "采集工作台" / "素材库"
MAX_BODY_CHARS = 6000


def now_iso() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def repo_relative(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(REPO_ROOT.resolve()))
    except ValueError:
        return str(path.resolve())


def project_relative(project_dir: Path, path: Path) -> str:
    return str(path.resolve().relative_to(project_dir.resolve()))


def resolve_inside_repo(raw: str) -> Path:
    path = Path(raw).expanduser()
    if not path.is_absolute():
        path = REPO_ROOT / path
    resolved = path.resolve()
    if not resolved.is_file():
        raise SystemExit(f"素材文件不存在：{raw}")
    if resolved.suffix.lower() != ".md":
        raise SystemExit(f"素材必须是 Markdown 文件：{raw}")
    return resolved


def parse_title(text: str, path: Path) -> str:
    for line in text.splitlines():
        match = re.match(r"^#\s+(.+?)\s*$", line)
        if match:
            return match.group(1).strip()
    return path.stem


def parse_meta(text: str) -> dict[str, str]:
    meta: dict[str, str] = {}
    for line in text.splitlines()[:80]:
        match = re.match(r"^-\s*([^:：]+)\s*[:：]\s*(.+?)\s*$", line)
        if not match:
            continue
        key = match.group(1).strip()
        value = match.group(2).strip()
        if key and value:
            meta[key] = value
    return meta


def infer_platform(path: Path, meta: dict[str, str], source: str = "") -> str:
    platform = meta.get("平台", "").strip()
    if platform:
        return platform
    text = f"{path} {source}"
    if "mp.weixin.qq.com" in text:
        return "公众号"
    if "xiaohongshu.com" in text or "xhslink.com" in text:
        return "小红书"
    if "zhihu.com" in text:
        return "知乎"
    if "github.com" in text:
        return "GitHub"
    for label in ["公众号", "微信", "小红书", "知乎", "GitHub"]:
        if label in text:
            return "公众号" if label == "微信" else label
    return ""


def stable_id(path: Path) -> str:
    rel = repo_relative(path)
    return hashlib.sha1(rel.encode("utf-8")).hexdigest()[:12]


def extract_body(text: str) -> str:
    stripped = re.sub(r"!\[([^\]]*)\]\(data:image/[^)]+\)", r"![\1](内嵌图片已省略，原图见素材原文)", text.strip())
    if len(stripped) <= MAX_BODY_CHARS:
        return stripped
    return stripped[:MAX_BODY_CHARS].rstrip() + "\n\n...（素材过长，已截断；原文见引用路径）"


def load_existing_refs(path: Path) -> dict:
    if not path.exists():
        return {"created_at": now_iso(), "material_root": repo_relative(MATERIAL_ROOT), "items": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"material_refs.json 格式错误：{path}") from exc
    if not isinstance(data, dict):
        raise SystemExit(f"material_refs.json 必须是对象：{path}")
    if not data.get("created_at"):
        data["created_at"] = now_iso()
    data.setdefault("material_root", repo_relative(MATERIAL_ROOT))
    data.setdefault("items", [])
    if not isinstance(data["items"], list):
        raise SystemExit(f"material_refs.json 的 items 必须是数组：{path}")
    return data


def build_item(path: Path) -> tuple[dict[str, str], str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    meta = parse_meta(text)
    title = parse_title(text, path)
    source = clean_markdown_link(meta.get("来源", "") or meta.get("链接", "") or meta.get("url", ""))
    item = {
        "id": stable_id(path),
        "title": title,
        "path": repo_relative(path),
        "source": source,
        "platform": infer_platform(path, meta, source),
        "selected_at": now_iso(),
    }
    return item, extract_body(text)


def clean_markdown_link(value: str) -> str:
    match = re.match(r"^\[.*?\]\((https?://[^)]+)\)$", value.strip())
    if match:
        return match.group(1)
    return value.strip()


def write_selected_materials(project_dir: Path, items: list[dict[str, str]], bodies: dict[str, str]) -> None:
    lines = [
        "# 选用素材",
        "",
        "本文件引用 `采集工作台/素材库/` 中的原始 Markdown，用于当前写作项目上下文。",
        "",
        "规则：原始素材只读，不在写作流程中修改。",
        "",
        f"- 更新时间: {now_iso()}",
        f"- 素材数量: {len(items)}",
        "",
    ]

    if not items:
        lines.extend(["## 当前未选择素材", ""])
    else:
        lines.extend(["## 素材索引", ""])
        for index, item in enumerate(items, start=1):
            lines.append(f"{index}. {item.get('title') or item.get('path')}")
            lines.append(f"   - ID: {item.get('id', '')}")
            lines.append(f"   - 平台: {item.get('platform', '')}")
            lines.append(f"   - 路径: {item.get('path', '')}")
            if item.get("source"):
                lines.append(f"   - 来源: {item['source']}")
        lines.append("")
        lines.append("## 素材内容")
        lines.append("")
        for index, item in enumerate(items, start=1):
            lines.append(f"### {index}. {item.get('title') or item.get('path')}")
            lines.append("")
            lines.append(f"- ID: {item.get('id', '')}")
            lines.append(f"- 平台: {item.get('platform', '')}")
            lines.append(f"- 路径: {item.get('path', '')}")
            if item.get("source"):
                lines.append(f"- 来源: {item['source']}")
            lines.append("")
            lines.append(bodies.get(item["id"], "").strip())
            lines.append("")

    (project_dir / "input" / "selected_materials.md").write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def link_materials(project: str, material_paths: list[str], replace: bool) -> Path:
    project_dir = ASSISTANT_ROOT / "projects" / project
    if not project_dir.is_dir():
        raise SystemExit(f"项目不存在：{project_dir}")
    input_dir = project_dir / "input"
    input_dir.mkdir(parents=True, exist_ok=True)

    refs_path = input_dir / "material_refs.json"
    data = {"created_at": now_iso(), "material_root": repo_relative(MATERIAL_ROOT), "items": []} if replace else load_existing_refs(refs_path)

    existing_by_id = {str(item.get("id")): item for item in data["items"] if isinstance(item, dict)}
    bodies: dict[str, str] = {}
    for item in data["items"]:
        if isinstance(item, dict) and item.get("id") and item.get("path"):
            raw_path = Path(str(item["path"])).expanduser()
            existing_path = raw_path if raw_path.is_absolute() else REPO_ROOT / raw_path
            if existing_path.exists():
                bodies[str(item["id"])] = extract_body(existing_path.read_text(encoding="utf-8", errors="replace"))

    for raw in material_paths:
        material_path = resolve_inside_repo(raw)
        item, body = build_item(material_path)
        existing_by_id[item["id"]] = item
        bodies[item["id"]] = body

    data["items"] = list(existing_by_id.values())
    data["updated_at"] = now_iso()

    refs_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_selected_materials(project_dir, data["items"], bodies)
    return refs_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="把采集工作台素材引用到自媒体写作项目。")
    parser.add_argument("--project", required=True, help="自媒体助手/projects 下的项目 slug。")
    parser.add_argument("--material", action="append", default=[], help="要引用的 Markdown 素材路径，可重复。")
    parser.add_argument("--replace", action="store_true", help="替换已有素材引用，而不是追加。")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.material and args.replace:
        refs_path = link_materials(args.project, [], replace=True)
    elif not args.material:
        raise SystemExit("请至少提供一个 --material，或使用 --replace 清空引用。")
    else:
        refs_path = link_materials(args.project, args.material, replace=args.replace)
    print(f"素材引用已更新：{refs_path}")
    print(f"选用素材汇总：{refs_path.parent / 'selected_materials.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
