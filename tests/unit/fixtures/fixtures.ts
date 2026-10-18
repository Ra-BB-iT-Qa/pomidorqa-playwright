import { test as base, expect, type BrowserContext } from "@playwright/test";
import { cleanupUsersViaApi, deleteUserViaApi } from "../../helpers/user";

type AccountFixtures = {
  accountContexts: BrowserContext[];
};

export const test = base.extend<AccountFixtures>({
  // Разбор фикстуры идёт после теста и afterEach, в том числе когда проверка упала.
  accountContexts: async ({}, use) => {
    const contexts: BrowserContext[] = [];
    await use(contexts);
    await cleanupUsersViaApi(contexts);
  },

  page: async ({ page }, use) => {
    await use(page);
    await deleteUserViaApi(page.context().request).catch((reason: unknown) => {
      const message = reason instanceof Error ? reason.message : String(reason);
      if (message.includes("401") || message.includes("404")) {
        return;
      }
      throw reason;
    });
  },
});

export { expect };
