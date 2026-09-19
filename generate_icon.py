from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    img = Image.new('RGB', (size, size), color = (13, 148, 136)) # Teal 600
    d = ImageDraw.Draw(img)
    # Draw a simple white circle
    margin = size // 4
    d.ellipse([margin, margin, size - margin, size - margin], fill=(255, 255, 255))
    # Draw a smaller teal circle inside
    margin_inner = size // 2.5
    d.ellipse([margin_inner, margin_inner, size - margin_inner, size - margin_inner], fill=(13, 148, 136))
    img.save(filename)

create_icon(192, "public/icon-192.png")
create_icon(512, "public/icon-512.png")
print("Icons generated")
