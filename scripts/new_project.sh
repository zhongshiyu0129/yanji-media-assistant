#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: scripts/new_project.sh <project-slug>"
  echo "Example: scripts/new_project.sh 2026-05-16-yellow-river"
  exit 1
fi

slug="$1"
root="$(cd "$(dirname "$0")/.." && pwd)"
project_dir="$root/projects/$slug"

if [ -e "$project_dir" ]; then
  echo "Project already exists: $project_dir"
  exit 1
fi

mkdir -p \
  "$project_dir/input" \
  "$project_dir/context" \
  "$project_dir/process" \
  "$project_dir/final" \
  "$project_dir/logs"

cat > "$project_dir/input/original_script.md" <<'EOF'
# 原始口播稿

## 标题

## 原文

请把已经提取好的原视频口播稿粘贴到这里。

## 来源备注
- 来源平台：
- 原视频标题：
- 作者：
- 发布时间：
- 链接：

## 本项目要求
- 目标平台：
- 目标字数/时长：
- 希望保留：
- 希望避免：
- 开头强度：克制 / 正常 / 强
- 结尾方向：
EOF

cat > "$project_dir/context/project_brief.md" <<'EOF'
# 项目 Brief

## 主题

## 目标观众

## 本次风格

## 必须保留的金句/情绪句

## 必须规避的表达

## 用户确认记录
EOF

cat > "$project_dir/context/account.yaml" <<'EOF'
account_id: default
account_path: ../../accounts/default
EOF

cat > "$project_dir/input/material_refs.json" <<'EOF'
{
  "created_at": "",
  "material_root": "采集工作台/素材库",
  "items": []
}
EOF

cat > "$project_dir/input/selected_materials.md" <<'EOF'
# 选用素材

本文件由素材引用工具生成。当前项目尚未选择采集素材。

规则：这里只引用 `采集工作台/素材库/` 中的原始 Markdown，不修改原始素材。
EOF

cat > "$project_dir/process/source_extraction.md" <<'EOF'
# 原视频表达提取

## 金句

## 情绪句

## 悬念句

## 类比/画面感表达

## 数据与事实点

## 可学习但不可照搬的表达手法
EOF

cat > "$project_dir/final/voiceover.md" <<'EOF'
# 最终口播稿

EOF

cat > "$project_dir/final/subtitle.md" <<'EOF'
# 字幕安全版

EOF

cat > "$project_dir/logs/workflow_log.md" <<'EOF'
# Workflow Log

## Project

## User choices

## Outputs

## Risks

## Memory
EOF

echo "Created project: $project_dir"
echo "Next: paste your script into $project_dir/input/original_script.md"
