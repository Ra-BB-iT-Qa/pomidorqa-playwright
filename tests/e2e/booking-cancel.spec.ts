import { test, expect, type BrowserContext } from "@playwright/test";
import { makeUser, registerUserViaApi, openBookingModal, cleanupUsersViaApi, ROUTES } from "../helpers/user";
import { openParticipant } from "../helpers/actor";


test.describe("Отмену бронирования видят и хост и гость", () => {
    const accountContexts: BrowserContext[] = [];

    test.afterEach(async () => {
        await cleanupUsersViaApi(accountContexts);
        accountContexts.length = 0;
    });

    test("Отмену бронирования видят и хост и гость", async ({ browser }) => { 
  const runId = Date.now();
  const skillTag = `Korozia-metal-${runId}`;
  const host = await openParticipant(browser, accountContexts, makeUser("Pank", runId));
  const guest = await openParticipant(browser, accountContexts, makeUser("Normis", runId));

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
    
      await test.step("Гость: регистрируется отдельным аккаунтом", async () => {
        await registerUserViaApi(guest.page, guest.user);
      });
    
      await test.step("Гость: ищет хоста в каталоге по навыку (сценарий 9)", async () => {
        await guest.booking.filterCatalog(skillTag);
      });
    
      await test.step("Гость: Видит карточку хоста", async () => {
        await expect(
          guest.booking.catalogCard.filter({ hasText: host.user.name })
        ).toBeVisible();
      });
    
      await test.step("Гость: открывает карточку хоста", async () => {
        await guest.booking.catalogCard.filter({ hasText: host.user.name }).click();
      });
    
      await test.step("Гость: Видит имя хоста", async () => {
        await expect(guest.booking.personName).toHaveText(host.user.name);
      });
    
      await test.step("Гость: кликает по дню и времени в календаре слотов", async () => {
        await openBookingModal(guest.page);
      });await test.step("Гость: подтверждает бронирование в модалке", async () => {
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
    
      await test.step("Хост: переходит в «Мои встречи»", async () => {
        await host.page.goto(ROUTES.bookings);
      });
    
      await test.step("Хост: Видит карточку бронирования", async () => {
        await expect(host.booking.bookingsUpcomingSection.first()).toBeVisible();
      });
    
      await test.step("Гость переходит в «Мои встречи»", async () => {
        await guest.page.goto(ROUTES.bookings)
      });
      await test.step("Гость: Видит карточку бронирования", async () => {
        await expect(guest.booking.bookingsUpcomingSection.first()).toBeVisible();
      });
      await test.step("Гость: Отменяет бронирование", async () => {
        await guest.booking.bookingCancel();
      });
      await test.step("Гость: Видит 0 бронирования", async () => {
        await expect(guest.booking.bookingsCard).toHaveCount(0);
      });
      await test.step("Хост: Переходит в «Мои встречи»", async () => {
        await host.page.goto(ROUTES.bookings);
      });
      await test.step("Хост: Не видит бронирования с гостём", async () => {
        await expect(host.booking.bookingsCard).toHaveCount(0);
      });
    });
});