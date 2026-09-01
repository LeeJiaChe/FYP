const fs = require('fs');
let code = fs.readFileSync('src/features/fleet/contracts/fleet.schemas.ts', 'utf8');
code = code.replace('.transform((value) => value || undefined),', '.transform((value) => value === "" ? null : value),');
fs.writeFileSync('src/features/fleet/contracts/fleet.schemas.ts', code);

let code2 = fs.readFileSync('src/features/fleet/infrastructure/fleet.prisma.server.ts', 'utf8');
code2 = code2.replace('...(input.assignedDriverId === undefined ? {} : { assignedDriverId: input.assignedDriverId }),', '...(input.assignedDriverId !== undefined ? { assignedDriverId: input.assignedDriverId } : {}),');
fs.writeFileSync('src/features/fleet/infrastructure/fleet.prisma.server.ts', code2);
