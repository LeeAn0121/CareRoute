with open('src/app/layout.tsx', 'r') as f:
    content = f.read()

content = content.replace('dxr1zrae95', 'f9sp6e02ix')

with open('src/app/layout.tsx', 'w') as f:
    f.write(content)
