import re

path = "src/components/RecipientModal.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the handleSubmit logic
old_logic = """const coords = await getLatLng();
      const finalAddress = detailAddress ? `${address} ${detailAddress}` : address;

      const recipientData = {
        name,
        address: finalAddress,
        sido: bcode.substring(0, 2) + '00000000',
        sigungu: bcode.substring(0, 5) + '00000',
        dong: bcode,
        lat: coords.lat,
        lng: coords.lng,
        visit_time: visitTime + ':00'
      };"""

new_logic = """let coords = { lat: 37.5665, lng: 126.9780 }; // Default fallback
      
      // If editing and address is identical to the original base address, keep old coords
      const isAddressUnchanged = recipientToEdit && recipientToEdit.address.startsWith(address);
      
      if (isAddressUnchanged) {
        coords = { lat: recipientToEdit!.lat, lng: recipientToEdit!.lng };
      } else {
        try {
          coords = await getLatLng();
        } catch (e) {
          console.warn('Geocoding completely failed. Using default coords to prevent blocking save.', e);
          // Don't block save, just use default/0,0 or existing
          if (recipientToEdit) {
             coords = { lat: recipientToEdit.lat, lng: recipientToEdit.lng };
          }
        }
      }

      const finalAddress = detailAddress ? `${address} ${detailAddress}` : address;

      const recipientData = {
        name,
        address: finalAddress,
        sido: bcode.substring(0, 2) + '00000000',
        sigungu: bcode.substring(0, 5) + '00000',
        dong: bcode,
        lat: coords.lat,
        lng: coords.lng,
        visit_time: visitTime + ':00'
      };"""

content = content.replace(old_logic, new_logic)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Geocode fallback fixed")
