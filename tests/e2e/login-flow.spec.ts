import { test, expect, type BrowserContext } from "@playwright/test";
import { TestUser, makeUser, registerUserViaApi, deleteUserViaApi, ROUTES } from "../helpers/user";
import { LoginPage } from "../Pages/login-page";

const LOGIN_ERROR = "Неверный email или пароль";

test.describe("Вход", () => {
  let user: TestUser;
  let loginPage: LoginPage;
  let sessionCookies: Awaited<ReturnType<BrowserContext["cookies"]>> = [];

  test.beforeEach(async ({ page }) => {
    user = makeUser("Pank", Date.now());
    await registerUserViaApi(page, user);
    sessionCookies = await page.context().cookies();
    await page.context().clearCookies();
    loginPage = new LoginPage(page);
    await loginPage.open();
  });

  test.afterEach(async ({ page }) => {
    if (sessionCookies.length > 0) {
      await page.context().clearCookies();
      await page.context().addCookies(sessionCookies);
    }
    await deleteUserViaApi(page.context().request).catch((reason: unknown) => {
      const message = reason instanceof Error ? reason.message : String(reason);
      if (message.includes("401") || message.includes("404")) {
        return;
      }
      throw reason;
    });
  });

  test("при неверном email видна общая ошибка входа", async () => {
    const stranger = makeUser("Normis", Date.now());

    await test.step("Участник: входит с чужим email и своим паролем", async () => {
      await loginPage.login({ email: stranger.email, password: user.password });
    });

    await test.step("Участник: видит ошибку и не узнаёт, что неверен именно email", async () => {
      await expect(loginPage.page).toHaveURL(new RegExp(`${ROUTES.login}$`));
      await expect(loginPage.error).toHaveText(LOGIN_ERROR);
    });
  });

  test("при неверном пароле видна та же ошибка входа", async () => {
    await test.step("Участник: входит со своим email и чужим паролем", async () => {
      await loginPage.login({ email: user.email, password: `${user.password}-net` });
    });

    await test.step("Участник: видит ту же ошибку и не узнаёт, что неверен именно пароль", async () => {
      await expect(loginPage.page).toHaveURL(new RegExp(`${ROUTES.login}$`));
      await expect(loginPage.error).toHaveText(LOGIN_ERROR);
    });
  });
});
