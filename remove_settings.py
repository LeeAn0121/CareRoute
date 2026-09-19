import re

page_path = "src/app/page.tsx"

with open(page_path, "r", encoding="utf-8") as f:
    page_content = f.read()

# 1. Update state type
page_content = page_content.replace(
    "useState<'map' | 'list' | 'settings'>('map');",
    "useState<'map' | 'list'>('map');"
)

# 2. Remove settings UI block
# Finding the block starting with `{activeTab === 'settings' && (`
settings_ui_pattern = re.compile(r"\{\s*activeTab\s*===\s*'settings'\s*&&\s*\(\s*<div.*?</div>\s*\)\s*\}", re.DOTALL)
# The regex might be too tricky because of nested divs.
# Let's find the exact lines to cut.
