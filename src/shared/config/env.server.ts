import "server-only";

import { parseServerEnvironment } from "./server-environment";

export const serverEnvironment = parseServerEnvironment(process.env);
