import { test, expect, type BrowserContext } from "@playwright/test";
import { makeUser, registerUserViaApi, openBookingModal, cleanupUsersViaApi, ROUTES } from "../helpers/user";
import { openParticipant } from "../helpers/actor";
import { tomorrowDate } from "../helpers/time";


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
        await host.page.reload();
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

    test("хост отменяет бронирование, и встреча оказывается среди прошедших", async ({ browser }) => {
      const runId = Date.now();
      const skillTag = `Help-${runId}`;
      const slotTime = "12:00";
      const host = await openParticipant(browser, accountContexts, makeUser("Pank", runId));
      const guest = await openParticipant(browser, accountContexts, makeUser("Normis", runId));
      const date = tomorrowDate("Europe/Moscow");

      await test.step("Хост: регистрируется в PomidorQA", async () => {
        await registerUserViaApi(host.page, host.user);
      });

      await test.step("Хост: открывает профиль", async () => {
        await host.page.goto(ROUTES.profile);
      });

      await test.step("Хост: добавляет навык «могу помочь»", async () => {
        await host.profile.addSkill(skillTag, "can_help");
        await host.page.reload();
      });

      await test.step("Хост: видит навык в профиле", async () => {
        await expect(host.profile.canHelpSkill(skillTag)).toBeVisible();
      });

      await test.step("Хост: открывает свои слоты", async () => {
        await host.page.goto(ROUTES.mySlots);
      });

      await test.step("Хост: добавляет свободный слот на завтра", async () => {
        await host.slots.addSlot(date, slotTime);
      });

      await test.step("Хост: видит свободный слот", async () => {
        await expect(host.slots.slotByTime(slotTime)).toContainText("свободен");
      });

      await test.step("Гость: регистрируется отдельным аккаунтом", async () => {
        await registerUserViaApi(guest.page, guest.user);
      });

      await test.step("Гость: открывает каталог", async () => {
        await guest.page.goto(ROUTES.pomidorqa);
      });

      await test.step("Гость: ищет хоста по навыку", async () => {
        await guest.booking.filterCatalog(skillTag);
      });

      await test.step("Гость: видит карточку хоста", async () => {
        await expect(guest.booking.personCard(host.user.name)).toBeVisible();
      });

      await test.step("Гость: открывает карточку хоста", async () => {
        await guest.booking.openPerson(host.user.name);
      });

      await test.step("Гость: открывает слот", async () => {
        await guest.booking.openSlot(slotTime);
      });

      await test.step("Гость: подтверждает бронирование", async () => {
        await guest.booking.confirmBooking();
      });

      await test.step("Гость: видит успешное бронирование", async () => {
        await expect(guest.booking.bookingConfirmSuccess).toBeVisible({ timeout: 15_000 });
        await expect(guest.booking.bookingConfirmError).toHaveCount(0);
      });

      await test.step("Хост: открывает «Мои встречи»", async () => {
        await host.page.goto(ROUTES.bookings);
      });

      await test.step("Хост: видит встречу в ближайших", async () => {
        await expect(host.booking.bookingsCardName).toHaveText(guest.user.name);
      });

      await test.step("Хост: отменяет бронирование", async () => {
        await host.booking.bookingCancel();
      });

      await test.step("Хост: снова открывает «Мои встречи»", async () => {
        await host.page.goto(ROUTES.bookings);
      });

      await test.step("Хост: видит отмену в прошедших и не видит кнопку отмены", async () => {
        await expect(host.booking.bookingsUpcomingSection).toContainText("Пока пусто");
        await expect(host.booking.bookingsCard).toHaveCount(0);
        await expect(host.booking.bookingsPastCardName).toHaveText(guest.user.name);
        await expect(host.booking.bookingsPastCard).toContainText("отменено");
        await expect(host.booking.bookingsPastCancelButton).toHaveCount(0);
      });

      await test.step("Хост: открывает свои слоты", async () => {
        await host.page.goto(ROUTES.mySlots);
      });

      await test.step("Хост: видит, что слот снова свободен", async () => {
        await expect(host.slots.slotByTime(slotTime)).toContainText("свободен");
      });

      await test.step("Гость: открывает «Мои встречи»", async () => {
        await guest.page.goto(ROUTES.bookings);
      });

      await test.step("Гость: видит отмену в прошедших и не видит кнопку отмены", async () => {
        await expect(guest.booking.bookingsUpcomingSection).toContainText("Пока пусто");
        await expect(guest.booking.bookingsCard).toHaveCount(0);
        await expect(guest.booking.bookingsPastCardName).toHaveText(host.user.name);
        await expect(guest.booking.bookingsPastCard).toContainText("отменено");
        await expect(guest.booking.bookingsPastCancelButton).toHaveCount(0);
      });
    });
});