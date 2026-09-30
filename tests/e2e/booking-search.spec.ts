import { test, expect, type BrowserContext } from "@playwright/test";
import { makeUser, registerUser, openBookingModal, cleanupUsersViaApi, ROUTES } from "../helpers/user";
import { ProfilePage } from "../Pages/profile-page";
import { BookingPage } from "../Pages/booking-page";
import { MySlotsPage } from "../Pages/my-slots-page";

test.describe("После резервирования слота карточка пропадает из поиска", () => {
  test("После резервирования слота карточка хоста пропадает из каталога для других участников", async ({
    browser,
  }) => {
    const runId = Date.now();
    const skillTag = `Korozia-metal-${runId}`;
    const host = makeUser("Pank", runId);
    const guest = makeUser("Normis", runId);
    const other = makeUser("Drugo", runId);

    const accountContexts: BrowserContext[] = [];
    const hostContext = await browser.newContext();
    accountContexts.push(hostContext);
    const guestContext = await browser.newContext();
    accountContexts.push(guestContext);
    const otherContext = await browser.newContext();
    accountContexts.push(otherContext);

    try {
      const hostPage = await hostContext.newPage();
      const guestPage = await guestContext.newPage();
      const otherPage = await otherContext.newPage();

      const hostProfilePage = new ProfilePage(hostPage);
      const guestBookingPage = new BookingPage(guestPage);
      const otherBookingPage = new BookingPage(otherPage);
      const hostMySlotsPage = new MySlotsPage(hostPage);

      await test.step("Хост: регистрируется в PomidorQA", async () => {
        await registerUser(hostPage, host);
      });

      await test.step('Хост: добавляет навык «могу помочь» в профиле', async () => {
        await hostPage.goto(ROUTES.profile);
        await hostProfilePage.addSkill(skillTag, "can_help");
      });

      await test.step("Хост: Видит навык в профиле", async () => {
        await expect(hostProfilePage.canHelpSkills).toContainText(skillTag);
      });

      await test.step("Хост: добавляет свободный слот на завтра", async () => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const date = tomorrow.toISOString().slice(0, 10);

        await hostPage.goto(ROUTES.mySlots);
        await hostMySlotsPage.addSlot(date, "12:00");
      });

      await test.step("Хост: Видит карточку слота", async () => {
        await expect(hostMySlotsPage.slotsCard.first()).toBeVisible();
      });

      await test.step("Другой участник: регистрируется отдельным аккаунтом", async () => {
        await registerUser(otherPage, other);
      });

      await test.step("Другой участник: ищет хоста в каталоге по навыку", async () => {
        await otherBookingPage.filterCatalog(skillTag);
      });

      await test.step("Другой участник: Видит карточку хоста", async () => {
        await expect(otherBookingPage.catalogCard.filter({ hasText: host.name })).toBeVisible();
      });

      await test.step("Гость: регистрируется отдельным аккаунтом", async () => {
        await registerUser(guestPage, guest);
      });

      await test.step("Гость: ищет хоста в каталоге по навыку", async () => {
        await guestBookingPage.filterCatalog(skillTag);
      });

      await test.step("Гость: Видит карточку хоста", async () => {
        await expect(guestBookingPage.catalogCard.filter({ hasText: host.name })).toBeVisible();
      });

      await test.step("Гость: открывает карточку хоста", async () => {
        await guestBookingPage.catalogCard.filter({ hasText: host.name }).click();
      });

      await test.step("Гость: Видит имя хоста", async () => {
        await expect(guestBookingPage.personName).toHaveText(host.name);
      });

      await test.step("Гость: кликает по дню и времени в календаре слотов", async () => {
        await openBookingModal(guestPage);
      });

      await test.step("Гость: подтверждает бронирование в модалке", async () => {
        await guestBookingPage.bookingConfirmButton.click();
      });

      await test.step("Гость: Видит успешное бронирование", async () => {
        const success = guestBookingPage.bookingConfirmSuccess;
        const error = guestBookingPage.bookingConfirmError;

        await expect(success.or(error)).toBeVisible({ timeout: 15_000 });
        if (await error.isVisible().catch(() => false)) {
          throw new Error(`Бронирование не удалось: ${await error.textContent()}`);
        }
      });

      await test.step("Другой участник: карточка хоста пропадает из каталога", async () => {
        await expect(async () => {
          await otherPage.goto(ROUTES.pomidorqa);
          await otherBookingPage.filterCatalog(skillTag);
          await expect(otherBookingPage.catalogCard.filter({ hasText: host.name })).toHaveCount(0);
        }).toPass({ timeout: 15_000 });
      });
    } finally {
      await cleanupUsersViaApi(accountContexts);
    }
  });
});
