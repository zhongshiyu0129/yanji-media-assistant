#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import re
import subprocess
from pathlib import Path


ASSISTANT_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ASSISTANT_ROOT.parent
NEW_PROJECT = ASSISTANT_ROOT / "scripts" / "new_project.sh"


def now_iso() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def slug(text: str, max_len: int = 48) -> str:
    cleaned = re.sub(r"[^\w\u4e00-\u9fff.-]+", "-", text.strip(), flags=re.UNICODE).strip("-._")
    return (cleaned or "material-rewrite")[:max_len]


def resolve_material(raw: str) -> Path:
    path = Path(raw).expanduser()
    if not path.is_absolute():
        path = REPO_ROOT / path
    resolved = path.resolve()
    if not resolved.is_file():
        raise SystemExit(f"素材文件不存在：{raw}")
    if resolved.suffix.lower() != ".md":
        raise SystemExit(f"素材必须是 Markdown 文件：{raw}")
    return resolved


def repo_relative(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(REPO_ROOT.resolve()))
    except ValueError:
        return str(path.resolve())


def clean_material_for_rewrite(text: str) -> str:
    return re.sub(
        r"!\[([^\]]*)\]\(data:image/[^)]+\)",
        r"![\1](内嵌图片已省略，原图见来源素材)",
        text.strip(),
    )


def parse_title(text: str, path: Path) -> str:
    for line in text.splitlines():
        match = re.match(r"^#\s+(.+?)\s*$", line)
        if match:
            return match.group(1).strip()
    return path.stem


def default_project_slug(title: str, material_path: Path) -> str:
    date = dt.date.today().isoformat()
    digest = hashlib.sha1(str(material_path.resolve()).encode("utf-8")).hexdigest()[:8]
    return f"{date}-{slug(title, 32)}-{digest}"


def create_project(project_slug: str) -> Path:
    project_dir = ASSISTANT_ROOT / "projects" / project_slug
    if project_dir.exists():
        return project_dir
    subprocess.run([str(NEW_PROJECT), project_slug], cwd=str(ASSISTANT_ROOT), check=True)
    return project_dir


def write_project_input(project_dir: Path, material_path: Path, account: str) -> None:
    material_text = clean_material_for_rewrite(material_path.read_text(encoding="utf-8", errors="replace"))
    title = parse_title(material_text, material_path)
    rel = repo_relative(material_path)

    original_script = f"""# 原始素材改写任务

## 标题

{title}

## 来源素材

- 素材路径: {rel}
- 导入时间: {now_iso()}
- 改写账号: {account}

## 改写要求

请把下面这篇采集素材改写成账号自己的口播稿。原始素材只作为信息来源和表达参考，不要照搬原文结构和特色表述。

## 原始素材

{material_text}
"""
    (project_dir / "input" / "original_script.md").write_text(original_script, encoding="utf-8")

    brief = f"""# 项目 Brief

## 主题

{title}

## 来源素材

- 素材路径: {rel}
- 导入时间: {now_iso()}

## 本次风格

使用 `{account}` 账号包。

## 必须保留的金句/情绪句

待工作流提取后确认。

## 必须规避的表达

- 不直接复制原素材结构。
- 不照搬原素材特色表达。
- 不修改原始素材文件。

## 用户确认记录
"""
    (project_dir / "context" / "project_brief.md").write_text(brief, encoding="utf-8")

    account_yaml = f"""account_id: {account}
account_path: ../../accounts/{account}
"""
    (project_dir / "context" / "account.yaml").write_text(account_yaml, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="从素材库 Markdown 直接创建自媒体改写项目。")
    parser.add_argument("--material", required=True, help="要改写的素材 Markdown 路径。")
    parser.add_argument("--project", default="", help="项目 slug；不填则自动生成。")
    parser.add_argument("--account", default="default", help="账号包 ID，默认 default。")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    material_path = resolve_material(args.material)
    material_text = material_path.read_text(encoding="utf-8", errors="replace")
    title = parse_title(material_text, material_path)
    project_slug = args.project.strip() or default_project_slug(title, material_path)
    project_dir = create_project(project_slug)
    write_project_input(project_dir, material_path, args.account.strip() or "default")
    print(f"改写项目已准备：{project_dir}")
    print(f"输入文件：{project_dir / 'input' / 'original_script.md'}")
    print(f"下一步：请运行 media-workflow 处理 projects/{project_slug}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
