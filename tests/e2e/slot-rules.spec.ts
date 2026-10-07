import { test, expect, type BrowserContext } from "@playwright/test";
import { makeUser, registerUserViaApi, cleanupUsersViaApi, ROUTES } from "../helpers/user";
import { openParticipant } from "../helpers/actor";
import { pastClock, shiftClock, tomorrowDate } from "../helpers/time";

const ZONE = "Europe/Moscow";
const SLOT_MINUTES = 25;
const FIRST_SLOT_TIME = "15:00";

test.describe("Слоты", () => {
  const accountContexts: BrowserContext[] = [];

  test.afterEach(async () => {
    await cleanupUsersViaApi(accountContexts);
    accountContexts.length = 0;
  });

  test("нельзя создать слот в прошлом", async ({ browser }) => {
    const host = await openParticipant(browser, accountContexts, makeUser("Pank", Date.now()));
    const past = pastClock(ZONE);

    await test.step("Хост: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(host.page, host.user);
    });

    await test.step("Хост: открывает свои слоты", async () => {
      await host.page.goto(ROUTES.mySlots);
    });

    await test.step("Хост: указывает слот в прошлом", async () => {
      await host.slots.addSlot(past.date, past.time);
    });

    await test.step("Хост: видит ошибку про слот в прошлом", async () => {
      await expect(host.slots.slotError).toHaveText("Слот должен начинаться в будущем");
    });

    await test.step("Хост: не видит созданный слот", async () => {
      await expect(host.slots.slotsCard).toHaveCount(0);
    });
  });

  test("нельзя создать слот раньше чем через 25 минут после первого", async ({ browser }) => {
    const host = await openParticipant(browser, accountContexts, makeUser("Pank", Date.now()));
    const date = tomorrowDate(ZONE);
    const tooSoon = shiftClock(date, FIRST_SLOT_TIME, SLOT_MINUTES - 1);

    await test.step("Хост: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(host.page, host.user);
    });

    await test.step("Хост: открывает свои слоты", async () => {
      await host.page.goto(ROUTES.mySlots);
    });

    await test.step("Хост: добавляет первый слот", async () => {
      await host.slots.addSlot(date, FIRST_SLOT_TIME);
    });

    await test.step("Хост: видит первый слот", async () => {
      await expect(host.slots.slotByTime(FIRST_SLOT_TIME)).toBeVisible();
    });

    await test.step("Хост: добавляет слот на минуту раньше конца первого", async () => {
      await host.slots.addSlot(tooSoon.date, tooSoon.time);
    });

    await test.step("Хост: не видит слот раньше чем через 25 минут", async () => {
      await expect(host.slots.slotByTime(tooSoon.time)).toHaveCount(0);
      await expect(host.slots.slotsCard).toHaveCount(1);
    });

    await test.step("Хост: видит ошибку", async () => {
      await expect(host.slots.slotError).toBeVisible();
    });
  });

  test("слот ровно через 25 минут после первого создаётся", async ({ browser }) => {
    const host = await openParticipant(browser, accountContexts, makeUser("Pank", Date.now()));
    const date = tomorrowDate(ZONE);
    const exact = shiftClock(date, FIRST_SLOT_TIME, SLOT_MINUTES);

    await test.step("Хост: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(host.page, host.user);
    });

    await test.step("Хост: открывает свои слоты", async () => {
      await host.page.goto(ROUTES.mySlots);
    });

    await test.step("Хост: добавляет первый слот", async () => {
      await host.slots.addSlot(date, FIRST_SLOT_TIME);
    });

    await test.step("Хост: видит первый слот", async () => {
      await expect(host.slots.slotByTime(FIRST_SLOT_TIME)).toBeVisible();
    });

    await test.step("Хост: добавляет слот ровно через 25 минут", async () => {
      await host.slots.addSlot(exact.date, exact.time);
    });

    await test.step("Хост: видит оба слота", async () => {
      await expect(host.slots.slotByTime(FIRST_SLOT_TIME)).toBeVisible();
      await expect(host.slots.slotByTime(exact.time)).toBeVisible();
      await expect(host.slots.slotsCard).toHaveCount(2);
    });
  });

  test("нельзя забронировать слот раньше чем через 25 минут после первого", async ({ browser }) => {
    const runId = Date.now();
    const skillTag = `Help-${runId}`;
    const host = await openParticipant(browser, accountContexts, makeUser("Pank", runId));
    const guest = await openParticipant(browser, accountContexts, makeUser("Normis", runId));
    const date = tomorrowDate(ZONE);
    const tooSoon = shiftClock(date, FIRST_SLOT_TIME, SLOT_MINUTES - 1);

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

    await test.step("Хост: добавляет первый слот", async () => {
      await host.slots.addSlot(date, FIRST_SLOT_TIME);
    });

    await test.step("Хост: видит первый слот", async () => {
      await expect(host.slots.slotByTime(FIRST_SLOT_TIME)).toBeVisible();
    });

    await test.step("Хост: добавляет слот на минуту раньше конца первого", async () => {
      await host.slots.addSlot(tooSoon.date, tooSoon.time);
    });

    await test.step("Хост: видит слот на минуту раньше конца первого", async () => {
      await expect(host.slots.slotByTime(tooSoon.time)).toBeVisible();
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
      await expect(guest.booking.catalogCard.filter({ hasText: host.user.name })).toBeVisible();
    });

    await test.step("Гость: открывает карточку хоста", async () => {
      await guest.booking.openPerson(host.user.name);
    });

    await test.step("Гость: видит имя хоста", async () => {
      await expect(guest.booking.personName).toHaveText(host.user.name);
    });

    await test.step("Гость: открывает первый слот", async () => {
      await guest.booking.openSlot(FIRST_SLOT_TIME);
    });

    await test.step("Гость: видит первый слот в модалке", async () => {
      await expect(guest.booking.bookingDialog).toContainText(FIRST_SLOT_TIME);
    });

    await test.step("Гость: подтверждает бронирование первого слота", async () => {
      await guest.booking.confirmBooking();
    });

    await test.step("Гость: видит успешное бронирование первого слота", async () => {
      await expect(guest.booking.bookingConfirmSuccess).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Гость: закрывает модалку", async () => {
      await guest.booking.closeBookingDialog();
    });

    await test.step("Гость: открывает слот раньше чем через 25 минут", async () => {
      await guest.booking.openSlot(tooSoon.time);
    });

    await test.step("Гость: подтверждает бронирование второго слота", async () => {
      await guest.booking.confirmBooking();
    });

    await test.step("Гость: видит отказ забронировать слот раньше чем через 25 минут", async () => {
      const result = guest.booking.bookingConfirmError.or(guest.booking.bookingConfirmSuccess);
      await expect(result).toBeVisible({ timeout: 15_000 });
      await expect(guest.booking.bookingConfirmSuccess).toHaveCount(0);
      await expect(guest.booking.bookingConfirmError).toBeVisible();
    });
  });

  test("слот ровно через 25 минут после первого можно забронировать", async ({ browser }) => {
    const runId = Date.now();
    const skillTag = `Help-${runId}`;
    const host = await openParticipant(browser, accountContexts, makeUser("Cody", runId));
    const guest = await openParticipant(browser, accountContexts, makeUser("Echo", runId));
    const date = tomorrowDate(ZONE);
    const exact = shiftClock(date, FIRST_SLOT_TIME, SLOT_MINUTES);

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

    await test.step("Хост: добавляет первый слот", async () => {
      await host.slots.addSlot(date, FIRST_SLOT_TIME);
    });

    await test.step("Хост: видит первый слот", async () => {
      await expect(host.slots.slotByTime(FIRST_SLOT_TIME)).toBeVisible();
    });

    await test.step("Хост: добавляет слот ровно через 25 минут", async () => {
      await host.slots.addSlot(exact.date, exact.time);
    });

    await test.step("Хост: видит слот ровно через 25 минут", async () => {
      await expect(host.slots.slotByTime(exact.time)).toBeVisible();
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
      await expect(guest.booking.catalogCard.filter({ hasText: host.user.name })).toBeVisible();
    });

    await test.step("Гость: открывает карточку хоста", async () => {
      await guest.booking.openPerson(host.user.name);
    });

    await test.step("Гость: видит имя хоста", async () => {
      await expect(guest.booking.personName).toHaveText(host.user.name);
    });

    await test.step("Гость: открывает первый слот", async () => {
      await guest.booking.openSlot(FIRST_SLOT_TIME);
    });

    await test.step("Гость: подтверждает бронирование первого слота", async () => {
      await guest.booking.confirmBooking();
    });

    await test.step("Гость: видит успешное бронирование первого слота", async () => {
      await expect(guest.booking.bookingConfirmSuccess).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Гость: закрывает модалку", async () => {
      await guest.booking.closeBookingDialog();
    });

    await test.step("Гость: открывает слот ровно через 25 минут", async () => {
      await guest.booking.openSlot(exact.time);
    });

    await test.step("Гость: подтверждает бронирование второго слота", async () => {
      await guest.booking.confirmBooking();
    });

    await test.step("Гость: видит успешное бронирование второго слота", async () => {
      await expect(guest.booking.bookingConfirmSuccess).toBeVisible({ timeout: 15_000 });
      await expect(guest.booking.bookingConfirmError).toHaveCount(0);
    });
  });

  test("нельзя удалить забронированный слот", async ({ browser }) => {
    const runId = Date.now();
    const skillTag = `Help-${runId}`;
    const host = await openParticipant(browser, accountContexts, makeUser("Rex", runId));
    const guest = await openParticipant(browser, accountContexts, makeUser("Nova", runId));
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
      await host.slots.addSlot(date, FIRST_SLOT_TIME);
    });

    await test.step("Хост: видит свободный слот", async () => {
      await expect(host.slots.slotByTime(FIRST_SLOT_TIME)).toContainText("свободен");
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
      await expect(guest.booking.catalogCard.filter({ hasText: host.user.name })).toBeVisible();
    });

    await test.step("Гость: открывает карточку хоста", async () => {
      await guest.booking.openPerson(host.user.name);
    });

    await test.step("Гость: открывает слот", async () => {
      await guest.booking.openSlot(FIRST_SLOT_TIME);
    });

    await test.step("Гость: подтверждает бронирование", async () => {
      await guest.booking.confirmBooking();
    });

    await test.step("Гость: видит успешное бронирование", async () => {
      await expect(guest.booking.bookingConfirmSuccess).toBeVisible({ timeout: 15_000 });
    });

    await test.step("Хост: открывает свои слоты", async () => {
      await host.page.goto(ROUTES.mySlots);
    });

    await test.step("Хост: видит забронированный слот", async () => {
      await expect(host.slots.slotByTime(FIRST_SLOT_TIME)).toContainText("забронирован");
    });

    await test.step("Хост: не может удалить забронированный слот", async () => {
      await expect(host.slots.deleteButton(FIRST_SLOT_TIME)).toHaveCount(0);
      await expect(host.slots.slotByTime(FIRST_SLOT_TIME)).toBeVisible();
    });
  });

  test("в форме слота только дата и время начала", async ({ browser }) => {
    const host = await openParticipant(browser, accountContexts, makeUser("Pank", Date.now()));

    await test.step("Хост: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(host.page, host.user);
    });

    await test.step("Хост: открывает свои слоты", async () => {
      await host.page.goto(ROUTES.mySlots);
    });

    await test.step("Хост: видит дату и время начала и не видит поле длительности", async () => {
      await expect(host.slots.slotsDateInput).toBeVisible();
      await expect(host.slots.slotsTimeInput).toBeVisible();
      await expect(host.slots.slotForm).toContainText("Дата");
      await expect(host.slots.slotForm).toContainText("Время начала");
      await expect(host.slots.slotFields).toHaveCount(2);
    });
  });

  test("свободный слот удаляется", async ({ browser }) => {
    const host = await openParticipant(browser, accountContexts, makeUser("Pank", Date.now()));
    const date = tomorrowDate(ZONE);

    await test.step("Хост: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(host.page, host.user);
    });

    await test.step("Хост: открывает свои слоты", async () => {
      await host.page.goto(ROUTES.mySlots);
    });

    await test.step("Хост: добавляет свободный слот на завтра", async () => {
      await host.slots.addSlot(date, FIRST_SLOT_TIME);
    });

    await test.step("Хост: видит свободный слот", async () => {
      await expect(host.slots.slotByTime(FIRST_SLOT_TIME)).toContainText("свободен");
    });

    await test.step("Хост: удаляет свободный слот", async () => {
      await host.slots.deleteSlot(FIRST_SLOT_TIME);
    });

    await test.step("Хост: не видит удалённый слот", async () => {
      await expect(host.slots.slotByTime(FIRST_SLOT_TIME)).toHaveCount(0);
      await expect(host.slots.slotsCard).toHaveCount(0);
    });
  });
});
