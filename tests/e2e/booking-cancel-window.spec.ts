import { test, expect, type BrowserContext } from "@playwright/test";
import { makeUser, registerUserViaApi, cleanupUsersViaApi, ROUTES } from "../helpers/user";
import { openParticipant } from "../helpers/actor";
import { futureSlotClock, shiftClock, zonedInstant } from "../helpers/time";

const ZONE = "Europe/Moscow";
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const WAIT_MS = 60_000;
const CANCEL_MARGIN_MS = 45_000;
const CANCEL_TOO_LATE = "Отменить встречу можно не позже чем за 2 часа до начала. Напиши собеседнику в Telegram.";

function slackMs(slot: { date: string; time: string }): number {
  return zonedInstant(slot.date, slot.time, ZONE) - Date.now() - TWO_HOURS_MS;
}

function clockPastBoundary(offsetMinutes: number): { date: string; time: string } {
  const edge = futureSlotClock(ZONE, TWO_HOURS_MS);
  return shiftClock(edge.date, edge.time, offsetMinutes);
}

test.describe("Срок отмены бронирования", () => {
  const accountContexts: BrowserContext[] = [];

  test.afterEach(async () => {
    await cleanupUsersViaApi(accountContexts);
    accountContexts.length = 0;
  });

  test("Нельзя отменить бронирование меньше чем за 2 часа", async ({ browser }) => {
    test.setTimeout(120_000);
    const runId = Date.now();
    const skillTag = `Help-${runId}`;
    const host = await openParticipant(browser, accountContexts, makeUser("Pank", runId));
    const guest = await openParticipant(browser, accountContexts, makeUser("Normis", runId));

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

    const edge = futureSlotClock(ZONE, TWO_HOURS_MS);
    const slot = shiftClock(edge.date, edge.time, -1);

    await test.step("Хост: добавляет слот на минуту раньше границы 2 часов", async () => {
      await host.slots.addSlot(slot.date, slot.time);
    });

    await test.step("Хост: видит свободный слот", async () => {
      await expect(host.slots.slotByTime(slot.time)).toContainText("свободен");
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
      await guest.booking.openSlot(slot.time);
    });

    await test.step("Гость: подтверждает бронирование", async () => {
      await guest.booking.confirmBooking();
    });

    await test.step("Гость: видит успешное бронирование", async () => {
      await expect(guest.booking.bookingConfirmSuccess).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Гость: открывает «Мои встречи»", async () => {
      await guest.page.goto(ROUTES.bookings);
    });

    await test.step("Гость: видит встречу в ближайших", async () => {
      await expect(guest.booking.bookingsCard).toContainText(slot.time);
    });

    await test.step("Гость: отменяет бронирование", async () => {
      await guest.booking.bookingCancel();
    });

    await test.step("Гость: видит отказ отменить позже чем за 2 часа", async () => {
      await expect(guest.booking.bookingCancelError).toHaveText(CANCEL_TOO_LATE);
      await expect(guest.booking.bookingsCard).toContainText(host.user.name);
      await expect(guest.booking.bookingsCardCancelButton).toBeVisible();
    });

    await test.step("Хост: открывает свои слоты", async () => {
      await host.page.goto(ROUTES.mySlots);
    });

    await test.step("Хост: видит, что слот остался забронированным", async () => {
      await expect(host.slots.slotByTime(slot.time)).toContainText("забронирован");
    });
  });

  test("Можно отменить бронирование за 2 часа", async ({ browser }) => {
    test.setTimeout(180_000);
    const runId = Date.now();
    const skillTag = `Help-${runId}`;
    const host = await openParticipant(browser, accountContexts, makeUser("Cody", runId));
    const guest = await openParticipant(browser, accountContexts, makeUser("Echo", runId));
    let slot = futureSlotClock(ZONE, TWO_HOURS_MS);

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

    await test.step("Гость: регистрируется отдельным аккаунтом", async () => {
      await registerUserViaApi(guest.page, guest.user);
    });

    await test.step("Хост: дожидается слота на границе 2 часов", async () => {
      await expect
        .poll(
          () => {
            slot = futureSlotClock(ZONE, TWO_HOURS_MS);
            return slackMs(slot);
          },
          { timeout: WAIT_MS, intervals: [1_000] },
        )
        .toBeGreaterThanOrEqual(CANCEL_MARGIN_MS);
    });

    await test.step("Хост: открывает свои слоты", async () => {
      await host.page.goto(ROUTES.mySlots);
    });

    await test.step("Хост: добавляет слот на границе 2 часов", async () => {
      await host.slots.addSlot(slot.date, slot.time);
    });

    await test.step("Хост: видит свободный слот", async () => {
      await expect(host.slots.slotByTime(slot.time)).toContainText("свободен");
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
      await guest.booking.openSlot(slot.time);
    });

    await test.step("Гость: подтверждает бронирование", async () => {
      await guest.booking.confirmBooking();
    });

    await test.step("Гость: видит успешное бронирование", async () => {
      await expect(guest.booking.bookingConfirmSuccess).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Гость: открывает «Мои встречи»", async () => {
      await guest.page.goto(ROUTES.bookings);
    });

    await test.step("Гость: видит встречу в ближайших", async () => {
      await expect(guest.booking.bookingsCard).toContainText(slot.time);
    });

    await test.step("Гость: отменяет бронирование", async () => {
      await guest.booking.bookingCancel();
    });

    await test.step("Гость: видит, что бронирование отменено", async () => {
      await expect(guest.booking.bookingsCard).toHaveCount(0);
      await expect(guest.booking.bookingCancelError).toHaveCount(0);
    });

    await test.step("Хост: открывает свои слоты", async () => {
      await host.page.goto(ROUTES.mySlots);
    });

    await test.step("Хост: видит, что слот снова свободен", async () => {
      await expect(host.slots.slotByTime(slot.time)).toContainText("свободен");
    });
  });

  test("За 2 часа и 1 минуту отмена проходит, и слот бронирует другой гость", async ({ browser }) => {
    test.setTimeout(180_000);
    const runId = Date.now();
    const skillTag = `Help-${runId}`;
    const host = await openParticipant(browser, accountContexts, makeUser("Rex", runId));
    const guest = await openParticipant(browser, accountContexts, makeUser("Nova", runId));
    const guest2 = await openParticipant(browser, accountContexts, makeUser("Iris", runId));
    let slot = clockPastBoundary(1);

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

    await test.step("Гость: регистрируется отдельным аккаунтом", async () => {
      await registerUserViaApi(guest.page, guest.user);
    });

    await test.step("Хост: дожидается слота на минуту позже границы 2 часов", async () => {
      await expect
        .poll(
          () => {
            slot = clockPastBoundary(1);
            return slackMs(slot);
          },
          { timeout: WAIT_MS, intervals: [1_000] },
        )
        .toBeGreaterThanOrEqual(WAIT_MS);
    });

    await test.step("Хост: открывает свои слоты", async () => {
      await host.page.goto(ROUTES.mySlots);
    });

    await test.step("Хост: добавляет слот на минуту позже границы 2 часов", async () => {
      await host.slots.addSlot(slot.date, slot.time);
    });

    await test.step("Хост: видит свободный слот", async () => {
      await expect(host.slots.slotByTime(slot.time)).toContainText("свободен");
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
      await guest.booking.openSlot(slot.time);
    });

    await test.step("Гость: подтверждает бронирование", async () => {
      await guest.booking.confirmBooking();
    });

    await test.step("Гость: видит успешное бронирование", async () => {
      await expect(guest.booking.bookingConfirmSuccess).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Гость: открывает «Мои встречи»", async () => {
      await guest.page.goto(ROUTES.bookings);
    });

    await test.step("Гость: видит встречу в ближайших", async () => {
      await expect(guest.booking.bookingsCard).toContainText(slot.time);
    });

    await test.step("Гость: отменяет бронирование", async () => {
      await guest.booking.bookingCancel();
    });

    await test.step("Гость: видит, что бронирование отменено", async () => {
      await expect(guest.booking.bookingsCard).toHaveCount(0);
    });

    await test.step("Хост: открывает свои слоты", async () => {
      await host.page.goto(ROUTES.mySlots);
    });

    await test.step("Хост: видит, что слот снова свободен", async () => {
      await expect(host.slots.slotByTime(slot.time)).toContainText("свободен");
    });

    await test.step("Гость 2: регистрируется отдельным аккаунтом", async () => {
      await registerUserViaApi(guest2.page, guest2.user);
    });

    await test.step("Гость 2: открывает каталог", async () => {
      await guest2.page.goto(ROUTES.pomidorqa);
    });

    await test.step("Гость 2: ищет хоста по навыку", async () => {
      await guest2.booking.filterCatalog(skillTag);
    });

    await test.step("Гость 2: видит карточку хоста", async () => {
      await expect(guest2.booking.personCard(host.user.name)).toBeVisible();
    });

    await test.step("Гость 2: открывает карточку хоста", async () => {
      await guest2.booking.openPerson(host.user.name);
    });

    await test.step("Гость 2: открывает слот", async () => {
      await guest2.booking.openSlot(slot.time);
    });

    await test.step("Гость 2: подтверждает бронирование", async () => {
      await guest2.booking.confirmBooking();
    });

    await test.step("Гость 2: видит успешное бронирование", async () => {
      await expect(guest2.booking.bookingConfirmSuccess).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Гость 2: открывает «Мои встречи»", async () => {
      await guest2.page.goto(ROUTES.bookings);
    });

    await test.step("Гость 2: видит встречу с хостом", async () => {
      await expect(guest2.booking.bookingsCardName).toHaveText(host.user.name);
    });

    await test.step("Хост: открывает «Мои встречи»", async () => {
      await host.page.goto(ROUTES.bookings);
    });

    await test.step("Хост: видит встречу со вторым гостем", async () => {
      await expect(host.booking.bookingsCardName).toHaveText(guest2.user.name);
    });
  });
});
