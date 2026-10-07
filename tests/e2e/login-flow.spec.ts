import { test, expect, type BrowserContext } from "@playwright/test";
import { TestUser, makeUser, registerUserViaApi, deleteUserViaApi, ROUTES } from "../helpers/user";
import { expectOutsideAccount, leaveAccount } from "../helpers/session";
import { LoginPage } from "../Pages/login-page";
import { BookingPage } from "../Pages/booking-page";

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

  test("нельзя войти с пустыми данными", async () => {
    await test.step("Участник: отправляет форму входа без email и пароля", async () => {
      await loginPage.submit();
    });

    await test.step("Участник: остаётся на входе, поля email и пароля обязательны", async () => {
      await expect(loginPage.page).toHaveURL(new RegExp(`${ROUTES.login}$`));
      await expect(loginPage.emailInput).toBeFocused();
      expect(await loginPage.isValueMissing(loginPage.emailInput)).toBe(true);
      expect(await loginPage.isValueMissing(loginPage.passwordInput)).toBe(true);
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

  test("верный email и пароль открывают каталог", async () => {
    const catalog = new BookingPage(loginPage.page);

    await test.step("Участник: входит со своим email и паролем", async () => {
      await loginPage.login({ email: user.email, password: user.password });
    });

    await test.step("Участник: попадает в каталог", async () => {
      await expect(loginPage.page).toHaveURL(new RegExp(`${ROUTES.pomidorqa}$`));
      await expect(catalog.catalogHeading).toBeVisible();
    });
  });

  test("кнопка «Выйти» завершает сессию, а назад не возвращает в аккаунт", async () => {
    const header = await leaveAccount(loginPage, user);
    const catalog = new BookingPage(loginPage.page);

    await test.step("Участник: возвращается назад", async () => {
      await loginPage.page.goBack();
    });

    await test.step("Участник: остаётся на входе, а не в каталоге", async () => {
      await expect(loginPage.page).toHaveURL(new RegExp(`${ROUTES.login}$`));
      await expect(loginPage.heading).toBeVisible();
      await expect(catalog.catalogHeading).toHaveCount(0);
      await expect(header.guestLoginLink).toBeVisible();
      await expectOutsideAccount(header);
    });
  });

  test.describe("жесты браузера", () => {
    test.use({ hasTouch: true });

    test("слайд влево открывает вход, а не каталог", async () => {
      const header = await leaveAccount(loginPage, user);
      const catalog = new BookingPage(loginPage.page);

      await test.step("Участник: смахивает влево", async () => {
        await header.swipeLeft();
      });

      await test.step("Участник: видит страницу входа, а не каталог", async () => {
        await expect(loginPage.page).toHaveURL(new RegExp(`${ROUTES.login}$`));
        await expect(loginPage.heading).toBeVisible();
        await expect(catalog.catalogHeading).toHaveCount(0);
        await expect(header.guestLoginLink).toBeVisible();
        await expectOutsideAccount(header);
      });
    });
  });
});
