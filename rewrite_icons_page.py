import re

page_path = "src/app/page.tsx"
with open(page_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace import
lucide_import = "import { MapPin, List, Plus, Navigation, Clock, User, Download, Share, X, ChevronRight, Check, Pencil, Trash2 } from 'lucide-react';"
tabler_import = "import { IconMapPin, IconList, IconPlus, IconNavigation, IconClock, IconUser, IconDownload, IconShare, IconX, IconChevronRight, IconCheck, IconPencil, IconTrash } from '@tabler/icons-react';"
content = content.replace(lucide_import, tabler_import)

# Replace components
content = content.replace("<MapPin", "<IconMapPin")
content = content.replace("<List", "<IconList")
content = content.replace("<Plus", "<IconPlus")
content = content.replace("<Navigation", "<IconNavigation")
content = content.replace("<Clock", "<IconClock")
content = content.replace("<User", "<IconUser")
content = content.replace("<Download", "<IconDownload")
content = content.replace("<Share", "<IconShare")
content = content.replace("<X", "<IconX")
content = content.replace("<ChevronRight", "<IconChevronRight")
content = content.replace("<Check", "<IconCheck")
content = content.replace("<Pencil", "<IconPencil")
content = content.replace("<Trash2", "<IconTrash")

with open(page_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Icons replaced")
