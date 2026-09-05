import "server-only";

import { serverEnvironment } from "@/shared/config/env.server";
import {
  createTransactionalEmailDelivery,
  type TransactionalEmailDelivery,
} from "./transactional-email.server";

let delivery: TransactionalEmailDelivery | undefined;

export function getTransactionalEmailDelivery(): TransactionalEmailDelivery {
  delivery ??= createTransactionalEmailDelivery({
    runtime: serverEnvironment.runtime,
    apiKey: serverEnvironment.transactionalEmail.resendApiKey,
    from: serverEnvironment.transactionalEmail.from,
    appBaseUrl: serverEnvironment.transactionalEmail.appBaseUrl,
  });
  return delivery;
}
