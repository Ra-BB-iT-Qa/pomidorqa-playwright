import { expect, test } from "@playwright/test";
import { HeaderPage } from "../Pages/header-page";
import { LoginPage } from "../Pages/login-page";
import { ROUTES, type TestUser } from "./user";

export async function leaveAccount(loginPage: LoginPage, user: TestUser) {
  const header = new HeaderPage(loginPage.page);

  await test.step("Участник: входит со своим email и паролем", async () => {
    await loginPage.login({ email: user.email, password: user.password });
  });

  await test.step("Участник: видит кнопку «Выйти»", async () => {
    await expect(header.logoutButton).toBeVisible();
    await expect(header.logoutButton).toHaveText("Выйти");
  });

  await test.step("Участник: выходит кнопкой «Выйти»", async () => {
    await header.logout();
  });

  await test.step("Участник: видит «Войти» в шапке и не видит действия участника", async () => {
    await expect(loginPage.page).toHaveURL(new RegExp(`${ROUTES.pomidorqa}$`));
    await expect(header.guestLoginLink).toBeVisible();
    await expect(header.memberSlotsLink).toHaveCount(0);
    await expect(header.memberMeetingsLink).toHaveCount(0);
    await expect(header.memberProfileLink).toHaveCount(0);
    await expect(header.logoutButton).toHaveCount(0);
  });

  return header;
}

export async function expectOutsideAccount(header: HeaderPage) {
  await expect(header.logoutButton).toHaveCount(0);
  await expect(header.memberSlotsLink).toHaveCount(0);
  await expect(header.memberMeetingsLink).toHaveCount(0);
  await expect(header.memberProfileLink).toHaveCount(0);
}
