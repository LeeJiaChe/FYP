import re

with open('components/student/TripsTab.tsx', 'r') as f:
    content = f.read()

# Extract ConnectedRouteLine
crl_match = re.search(r'(// ─── VISUAL CONNECTED ROUTE LINE COMPONENT ────────────────────────\nfunction ConnectedRouteLine.*?\n})\n\nexport default function TripsTab', content, re.DOTALL)
crl_code = crl_match.group(1)

with open('components/student/ConnectedRouteLine.tsx', 'w') as f:
    f.write('import React from "react";\n\n' + crl_code + '\n\nexport default ConnectedRouteLine;\n')

# Remove it from TripsTab.tsx and import it
new_content = content.replace(crl_code, '')
new_content = new_content.replace('import BusLocationTracker', 'import BusLocationTracker from "@/components/BusLocationTracker";\nimport ConnectedRouteLine from "./ConnectedRouteLine";')

with open('components/student/TripsTab.tsx', 'w') as f:
    f.write(new_content)

print("Split ConnectedRouteLine")
