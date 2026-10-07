import { test, expect, type BrowserContext } from "@playwright/test";
import { makeUser, registerUserViaApi, cleanupUsersViaApi, ROUTES } from "../helpers/user";
import { openParticipant } from "../helpers/actor";
import { futureSlotClock, zonedInstant } from "../helpers/time";

const ZONE = "Europe/Moscow";
const PAST_GRACE_MS = 15_000;
const SLOT_LEAD_MIN_MS = 40_000;

test.describe("Мои встречи", () => {
  const accountContexts: BrowserContext[] = [];

  test.afterEach(async () => {
    await cleanupUsersViaApi(accountContexts);
    accountContexts.length = 0;
  });

  test("начавшаяся встреча переходит из Ближайшие в Прошедшие и отменённые", async ({ browser }) => {
    test.setTimeout(240_000);
    const runId = Date.now();
    const skillTag = `Help-${runId}`;
    const host = await openParticipant(browser, accountContexts, makeUser("Pank", runId));
    const guest = await openParticipant(browser, accountContexts, makeUser("Normis", runId));
    let slot: ReturnType<typeof futureSlotClock>;
    let slotStartsAt: number;

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

    await test.step("Хост: открывает свои слоты", async () => {
      await host.page.goto(ROUTES.mySlots);
    });

    await test.step("Хост: добавляет слот, который ещё не начался", async () => {
      slot = futureSlotClock(ZONE, SLOT_LEAD_MIN_MS);
      slotStartsAt = zonedInstant(slot.date, slot.time, ZONE);
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
      await expect(guest.booking.bookingsCardName).toHaveText(host.user.name);
      await expect(guest.booking.bookingsCard).toContainText(slot.time);
    });

    await test.step("Гость: дожидается начала встречи", async () => {
      await expect
        .poll(() => Date.now() >= slotStartsAt + PAST_GRACE_MS, {
          timeout: SLOT_LEAD_MIN_MS + 60_000 + PAST_GRACE_MS,
          intervals: [1_000],
        })
        .toBe(true);
    });

    await test.step("Гость: обновляет «Мои встречи»", async () => {
      await guest.page.goto(ROUTES.bookings);
    });

    await test.step("Гость: не видит встречу в ближайших", async () => {
      await expect(guest.booking.bookingsUpcomingSection).toContainText("Пока пусто");
      await expect(guest.booking.bookingsCard).toHaveCount(0);
    });

    await test.step("Гость: видит встречу в прошедших", async () => {
      await expect(guest.booking.bookingsPastCardName).toHaveText(host.user.name);
      await expect(guest.booking.bookingsPastCard).toContainText(slot.time);
    });

    await test.step("Хост: открывает «Мои встречи»", async () => {
      await host.page.goto(ROUTES.bookings);
    });

    await test.step("Хост: не видит встречу в ближайших", async () => {
      await expect(host.booking.bookingsUpcomingSection).toContainText("Пока пусто");
      await expect(host.booking.bookingsCard).toHaveCount(0);
    });

    await test.step("Хост: видит встречу в прошедших", async () => {
      await expect(host.booking.bookingsPastCardName).toHaveText(guest.user.name);
      await expect(host.booking.bookingsPastCard).toContainText(slot.time);
    });
  });
});
