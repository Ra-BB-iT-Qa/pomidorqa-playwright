import { test, expect } from "@playwright/test";
import { TestUser, makeUser, deleteUserViaApi, ROUTES } from "../helpers/user";
import { RegisterPage } from "../Pages/register-page";
import { ProfilePage } from "../Pages/profile-page";

test.describe("Регистрация", () => {
  let user: TestUser;
  let registerPage: RegisterPage;
  let profilePage: ProfilePage;

  test.beforeEach(async ({ page }) => {
    user = makeUser("Pank", Date.now());
    registerPage = new RegisterPage(page);
    profilePage = new ProfilePage(page);
    await registerPage.open();
  });

  test.afterEach(async ({ page }) => {
    await deleteUserViaApi(page.context().request).catch((reason: unknown) => {
      const message = reason instanceof Error ? reason.message : String(reason);
      if (message.includes("401") || message.includes("404")) {
        return;
      }
      throw reason;
    });
  });

  test("Нельзя зарегистрироваться без имени", async () => {
    await test.step("Гость: отправляет форму без имени", async () => {
      await registerPage.register({ email: user.email, password: user.password });
    });

    await test.step("Гость: остаётся на регистрации, поле имени обязательно", async () => {
      await expect(registerPage.page).toHaveURL(new RegExp(`${ROUTES.register}$`));
      await expect(registerPage.nameInput).toBeFocused();
      expect(await registerPage.isValueMissing(registerPage.nameInput)).toBe(true);
    });
  });

  test("Нельзя зарегистрироваться без email", async () => {
    await test.step("Гость: отправляет форму без email", async () => {
      await registerPage.register({ name: user.name, password: user.password });
    });

    await test.step("Гость: остаётся на регистрации, поле email обязательно", async () => {
      await expect(registerPage.page).toHaveURL(new RegExp(`${ROUTES.register}$`));
      await expect(registerPage.emailInput).toBeFocused();
      expect(await registerPage.isValueMissing(registerPage.emailInput)).toBe(true);
    });
  });

  test("Нельзя зарегистрироваться без @ в email", async () => {
    await test.step("Гость: отправляет форму с email без @", async () => {
      await registerPage.register({
        name: user.name,
        email: user.email.replace("@", ""),
        password: user.password,
      });
    });

    await test.step("Гость: остаётся на регистрации, email без @ не принят", async () => {
      await expect(registerPage.page).toHaveURL(new RegExp(`${ROUTES.register}$`));
      await expect(registerPage.emailInput).toBeFocused();
      expect(await registerPage.isTypeMismatch(registerPage.emailInput)).toBe(true);
    });
  });

  test("Нельзя зарегистрироваться без пароля", async () => {
    await test.step("Гость: отправляет форму без пароля", async () => {
      await registerPage.register({ name: user.name, email: user.email });
    });

    await test.step("Гость: остаётся на регистрации, поле пароля обязательно", async () => {
      await expect(registerPage.page).toHaveURL(new RegExp(`${ROUTES.register}$`));
      await expect(registerPage.passwordInput).toBeFocused();
      expect(await registerPage.isValueMissing(registerPage.passwordInput)).toBe(true);
    });
  });

  test("После регистрации профиль хранит имя, пояс Москвы и пустые telegram и о себе", async () => {
    await test.step("Гость: регистрируется", async () => {
      await registerPage.registerAccount(user);
    });

    await test.step("Гость: открывает профиль", async () => {
      await profilePage.page.goto(ROUTES.profile);
    });

    await test.step("Гость: видит имя с регистрации, пояс Москвы, пустые telegram и о себе", async () => {
      await expect(profilePage.profileNameInput).toHaveValue(user.name);
      await expect(profilePage.profileTimezoneSelect).toHaveValue("Europe/Moscow");
      await expect(profilePage.profileTelegramInput).toHaveValue("");
      await expect(profilePage.profileAboutInput).toHaveValue("");
    });
  });
});
