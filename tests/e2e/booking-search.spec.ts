import { test, expect, type BrowserContext } from "@playwright/test";
import { makeUser, registerUserViaApi, openBookingModal, cleanupUsersViaApi, ROUTES } from "../helpers/user";
import { openParticipant } from "../helpers/actor";

test.describe("После резервирования слота карточка пропадает из поиска", () => {
  const accountContexts: BrowserContext[] = [];

  test.afterEach(async () => {
    await cleanupUsersViaApi(accountContexts);
    accountContexts.length = 0;
  });

  test("После резервирования слота карточка хоста пропадает из каталога для других участников", async ({
    browser,
  }) => {
    const runId = Date.now();
    const skillTag = `Korozia-metal-${runId}`;
    const host = await openParticipant(browser, accountContexts, makeUser("Pank", runId));
    const guest = await openParticipant(browser, accountContexts, makeUser("Normis", runId));
    const other = await openParticipant(browser, accountContexts, makeUser("Drugo", runId));

      await test.step("Хост: регистрируется в PomidorQA", async () => {
        await registerUserViaApi(host.page, host.user);
      });

      await test.step('Хост: добавляет навык «могу помочь» в профиле', async () => {
        await host.page.goto(ROUTES.profile);
        await host.profile.addSkill(skillTag, "can_help");
      });

      await test.step("Хост: Видит навык в профиле", async () => {
        await expect(host.profile.canHelpSkills).toContainText(skillTag);
      });

      await test.step("Хост: добавляет свободный слот на завтра", async () => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const date = tomorrow.toISOString().slice(0, 10);

        await host.page.goto(ROUTES.mySlots);
        await host.slots.addSlot(date, "12:00");
      });

      await test.step("Хост: Видит карточку слота", async () => {
        await expect(host.slots.slotsCard.first()).toBeVisible();
      });

      await test.step("Другой участник: регистрируется отдельным аккаунтом", async () => {
        await registerUserViaApi(other.page, other.user);
      });

      await test.step("Другой участник: ищет хоста в каталоге по навыку", async () => {
        await other.booking.filterCatalog(skillTag);
      });

      await test.step("Другой участник: Видит карточку хоста", async () => {
        await expect(other.booking.catalogCard.filter({ hasText: host.user.name })).toBeVisible();
      });

      await test.step("Гость: регистрируется отдельным аккаунтом", async () => {
        await registerUserViaApi(guest.page, guest.user);
      });

      await test.step("Гость: ищет хоста в каталоге по навыку", async () => {
        await guest.booking.filterCatalog(skillTag);
      });

      await test.step("Гость: Видит карточку хоста", async () => {
        await expect(guest.booking.catalogCard.filter({ hasText: host.user.name })).toBeVisible();
      });

      await test.step("Гость: открывает карточку хоста", async () => {
        await guest.booking.catalogCard.filter({ hasText: host.user.name }).click();
      });

      await test.step("Гость: Видит имя хоста", async () => {
        await expect(guest.booking.personName).toHaveText(host.user.name);
      });

      await test.step("Гость: кликает по дню и времени в календаре слотов", async () => {
        await openBookingModal(guest.page);
      });

      await test.step("Гость: подтверждает бронирование в модалке", async () => {
        await guest.booking.bookingConfirmButton.click();
      });

      await test.step("Гость: Видит успешное бронирование", async () => {
        const success = guest.booking.bookingConfirmSuccess;
        const error = guest.booking.bookingConfirmError;

        await expect(success.or(error)).toBeVisible({ timeout: 15_000 });
        if (await error.isVisible().catch(() => false)) {
          throw new Error(`Бронирование не удалось: ${await error.textContent()}`);
        }
      });

      await test.step("Другой участник: карточка хоста пропадает из каталога", async () => {
        await expect(async () => {
          await other.page.goto(ROUTES.pomidorqa);
          await other.booking.filterCatalog(skillTag);
          await expect(other.booking.catalogCard.filter({ hasText: host.user.name })).toHaveCount(0);
        }).toPass({ timeout: 15_000 });
      });
  });
});
