import re

path = "src/components/Providers.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace env variable with hardcoded Client ID
old_client_id = "ncpClientId={process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || ''}"
new_client_id = "ncpClientId={'f9sp6e02ix'}"
content = content.replace(old_client_id, new_client_id)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

layout_path = "src/app/layout.tsx"
with open(layout_path, "r", encoding="utf-8") as f:
    layout_content = f.read()

# Remove the duplicated Script tag
script_tag = r'<Script\s+strategy="beforeInteractive"\s+src={`https://openapi\.map\.naver\.com/openapi/v3/maps\.js\?ncpClientId=f9sp6e02ix&submodules=geocoder`}\s*/>'
layout_content = re.sub(script_tag, '', layout_content)

# Remove the next/script import
layout_content = layout_content.replace('import Script from "next/script";\n', '')

with open(layout_path, "w", encoding="utf-8") as f:
    f.write(layout_content)

print("Providers and Layout fixed")
