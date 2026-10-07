import { test, expect, type BrowserContext } from "@playwright/test";
import { makeUser, registerUserViaApi, cleanupUsersViaApi, ROUTES } from "../helpers/user";
import { openParticipant } from "../helpers/actor";
import { tomorrowDate } from "../helpers/time";

const ZONE = "Europe/Moscow";
const SLOT_TIME = "12:00";
const TAKEN_ERROR = "Этот слот только что забронировали — выбери другой";

test.describe("Занятый слот", () => {
  const accountContexts: BrowserContext[] = [];

  test.afterEach(async () => {
    await cleanupUsersViaApi(accountContexts);
    accountContexts.length = 0;
  });

  test("Второй гость видит, что слот занят, и предложение выбрать другой", async ({ browser }) => {
    const runId = Date.now();
    const skillTag = `Help-${runId}`;
    const host = await openParticipant(browser, accountContexts, makeUser("Pank", runId));
    const guest = await openParticipant(browser, accountContexts, makeUser("Normis", runId));
    const guest2 = await openParticipant(browser, accountContexts, makeUser("Drift", runId));
    const date = tomorrowDate(ZONE);

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
      await host.slots.addSlot(date, SLOT_TIME);
    });

    await test.step("Хост: видит свободный слот", async () => {
      await expect(host.slots.slotByTime(SLOT_TIME)).toContainText("свободен");
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
      await guest.booking.openSlot(SLOT_TIME);
    });

    await test.step("Гость2: регистрируется отдельным аккаунтом", async () => {
      await registerUserViaApi(guest2.page, guest2.user);
    });

    await test.step("Гость2: открывает каталог", async () => {
      await guest2.page.goto(ROUTES.pomidorqa);
    });

    await test.step("Гость2: ищет хоста по навыку", async () => {
      await guest2.booking.filterCatalog(skillTag);
    });

    await test.step("Гость2: видит карточку хоста", async () => {
      await expect(guest2.booking.personCard(host.user.name)).toBeVisible();
    });

    await test.step("Гость2: открывает карточку хоста", async () => {
      await guest2.booking.openPerson(host.user.name);
    });

    await test.step("Гость2: открывает тот же слот", async () => {
      await guest2.booking.openSlot(SLOT_TIME);
    });

    await test.step("Гость: подтверждает бронирование", async () => {
      await guest.booking.confirmBooking();
    });

    await test.step("Гость: видит успешное бронирование", async () => {
      await expect(guest.booking.bookingConfirmSuccess).toBeVisible({ timeout: 15_000 });
      await expect(guest.booking.bookingConfirmError).toHaveCount(0);
    });

    await test.step("Гость2: подтверждает бронирование", async () => {
      await guest2.booking.confirmBooking();
    });

    await test.step("Гость2: видит, что слот занят и нужно выбрать другой", async () => {
      await expect(guest2.booking.bookingConfirmError).toHaveText(TAKEN_ERROR, { timeout: 15_000 });
      await expect(guest2.booking.bookingConfirmSuccess).toHaveCount(0);
    });

    await test.step("Хост: открывает Мои встречи", async () => {
      await host.page.goto(ROUTES.bookings);
    });

    await test.step("Хост: видит бронирование", async () => {
      await expect(host.booking.bookingsUpcomingSection).toContainText(guest.user.name);
      await expect(host.booking.bookingsCard).toBeVisible();
    });

    await test.step("Гость: открывает Мои встречи", async () => {
      await guest.page.goto(ROUTES.bookings);
    });

    await test.step("Гость: видит бронирование", async () => {
      await expect(guest.booking.bookingsUpcomingSection).toContainText(host.user.name);
      await expect(guest.booking.bookingsCard).toBeVisible();
    });

    await test.step("Гость2: закрывает окно бронирования", async () => {
      await guest2.booking.closeBookingDialog();
    });

    await test.step("Гость2: открывает Мои встречи", async () => {
      await guest2.page.goto(ROUTES.bookings);
    });

    await test.step("Гость2: не видит бронирование", async () => {
      await expect(guest2.booking.bookingsUpcomingSection).toContainText("Пока пусто");
      await expect(guest2.booking.bookingsCard).toHaveCount(0);
    });
  });
});
