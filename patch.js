const fs = require('fs');
let code = fs.readFileSync('src/features/fleet/ui/AdminPortal.tsx', 'utf8');
const lines = code.split('\n');

for (let i = 1040; i < 1070; i++) {
  if (lines[i].includes('value={newRoute.driverId}')) {
    lines[i] = lines[i].replace('value={newRoute.driverId}', 'value={newBus.assignedDriverId}');
  }
  if (lines[i].includes('setNewRoute({ ...newRoute, driverId: e.target.value })')) {
    lines[i] = lines[i].replace('setNewRoute({ ...newRoute, driverId: e.target.value })', 'setNewBus({ ...newBus, assignedDriverId: e.target.value })');
  }
  if (lines[i].includes('required') && lines[i-2].includes('id="assign-driver"')) {
    lines.splice(i, 1);
  }
}

fs.writeFileSync('src/features/fleet/ui/AdminPortal.tsx', lines.join('\n'));
