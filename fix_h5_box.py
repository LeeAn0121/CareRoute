import re

path = "src/app/page.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix h5 > Box issue
old_h5 = """<Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, letterSpacing: '-0.5px' }}>
            <Box sx={{ width: 36, height: 36, bgcolor: '#0d9488', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3)' }}>
              <IconMapPin size={20} color="white" />
            </Box>
            케어루트
          </Typography>"""

new_h5 = """<Typography variant="h5" component="div" sx={{ fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, letterSpacing: '-0.5px' }}>
            <Box component="span" sx={{ width: 36, height: 36, bgcolor: '#0d9488', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3)' }}>
              <IconMapPin size={20} color="white" />
            </Box>
            케어루트
          </Typography>"""

content = content.replace(old_h5, new_h5)

# Fix h6 > Box issue in List Items
old_h6_list = """<Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          <Box sx={{ width: 56, height: 56, bgcolor: '#f0fdfa', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconUser size={28} color="#0d9488" />
                          </Box>
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
                              {marker.name} 어르신
                            </Typography>"""

new_h6_list = """<Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          <Box sx={{ width: 56, height: 56, bgcolor: '#f0fdfa', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconUser size={28} color="#0d9488" />
                          </Box>
                          <Box>
                            <Typography variant="h6" component="div" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
                              {marker.name} 어르신
                            </Typography>"""
content = content.replace(old_h6_list, new_h6_list)


# Check for Drawer Typography > Box?
old_drawer = """<Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
                  {selectedRecipient.name} 어르신
                </Typography>"""
new_drawer = """<Typography variant="h5" component="div" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
                  {selectedRecipient.name} 어르신
                </Typography>"""
content = content.replace(old_drawer, new_drawer)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("HTML semantics fixed")
