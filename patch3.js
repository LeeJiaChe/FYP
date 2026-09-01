const fs = require('fs');
let code = fs.readFileSync('src/features/fleet/ui/AdminPortal.tsx', 'utf8');

code = code.replace(
`        setNewBus({
          plateNumber: "",
          seatedCapacity: 20,
          standingCapacity: 8,
          status: "ACTIVE",
        });`,
`        setNewBus({
          plateNumber: "",
          assignedDriverId: "",
          seatedCapacity: 20,
          standingCapacity: 8,
          status: "ACTIVE",
        });`
);

code = code.replace(
`                setNewBus({
                  plateNumber: "",
                  seatedCapacity: 20,
                  standingCapacity: 8,
                  status: "ACTIVE",
                });`,
`                setNewBus({
                  plateNumber: "",
                  assignedDriverId: "",
                  seatedCapacity: 20,
                  standingCapacity: 8,
                  status: "ACTIVE",
                });`
);

code = code.replace(
`                setNewBus({
                  plateNumber: bus.plateNumber,
                  seatedCapacity: bus.seatedCapacity,
                  standingCapacity: bus.standingCapacity,
                  status: bus.status,
                });`,
`                setNewBus({
                  plateNumber: bus.plateNumber,
                  assignedDriverId: bus.assignedDriverId || "",
                  seatedCapacity: bus.seatedCapacity,
                  standingCapacity: bus.standingCapacity,
                  status: bus.status,
                });`
);

fs.writeFileSync('src/features/fleet/ui/AdminPortal.tsx', code);
