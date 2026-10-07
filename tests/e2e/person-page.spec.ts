import { test, expect, type BrowserContext } from "@playwright/test";
import { makeUser, registerUserViaApi, cleanupUsersViaApi, ROUTES } from "../helpers/user";
import { openParticipant } from "../helpers/actor";
import { shiftClock, tomorrowDate } from "../helpers/time";

const ZONE = "Europe/Moscow";
const SLOT_TIME = "12:00";

test.describe("Страница участника", () => {
  const accountContexts: BrowserContext[] = [];

  test.afterEach(async () => {
    await cleanupUsersViaApi(accountContexts);
    accountContexts.length = 0;
  });

  test("на странице участника видны информация о себе, оба навыка и свободный слот на 25 минут", async ({ browser }) => {
    test.setTimeout(150_000);
    const runId = Date.now();
    const helpTag = `Help-${runId}`;
    const wantTag = `Want-${runId}`;
    const about = `О себе ${runId}`;
    const host = await openParticipant(browser, accountContexts, makeUser("Pank", runId));
    const guest = await openParticipant(browser, accountContexts, makeUser("Normis", runId));
    const date = tomorrowDate(ZONE);

    await test.step("Хост: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(host.page, host.user);
    });

    await test.step("Хост: открывает профиль", async () => {
      await host.page.goto(ROUTES.profile);
    });

    await test.step("Хост: сохраняет «о себе»", async () => {
      await host.profile.profileAboutInput.fill(about);
      await host.profile.save();
      await host.page.reload();
    });

    await test.step("Хост: видит сохранённое «о себе»", async () => {
      await expect(host.profile.profileAboutInput).toHaveValue(about);
    });

    await test.step("Хост: добавляет навык «могу помочь»", async () => {
      await host.profile.addSkill(helpTag, "can_help");
      await host.page.reload();
    });

    await test.step("Хост: видит навык «могу помочь»", async () => {
      await expect(host.profile.canHelpSkill(helpTag)).toBeVisible();
    });

    await test.step("Хост: добавляет навык «хочу разобрать»", async () => {
      await host.profile.addSkill(wantTag, "want_to_learn");
      await host.page.reload();
    });

    await test.step("Хост: видит навык «хочу разобрать»", async () => {
      await expect(host.profile.wantToLearnSkill(wantTag)).toBeVisible();
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
      await guest.booking.filterCatalog(helpTag);
    });

    await test.step("Гость: видит карточку хоста", async () => {
      await expect(guest.booking.personCard(host.user.name)).toBeVisible();
    });

    await test.step("Гость: открывает карточку хоста", async () => {
      await guest.booking.openPerson(host.user.name);
    });

    await test.step("Гость: видит имя, «о себе» и оба навыка", async () => {
      await expect(guest.booking.personName).toHaveText(host.user.name);
      await expect(guest.booking.personAbout(about)).toBeVisible();
      await expect(guest.booking.personCanHelpHeading).toBeVisible();
      await expect(guest.booking.personSkill(helpTag)).toBeVisible();
      await expect(guest.booking.personWantToLearnHeading).toBeVisible();
      await expect(guest.booking.personSkill(wantTag)).toBeVisible();
    });

    await test.step("Гость: видит свободный слот длительностью 25 минут", async () => {
      await expect(guest.booking.personSlotsHeading).toBeVisible();
      await expect(guest.booking.slotTimes.filter({ hasText: SLOT_TIME })).toHaveText(SLOT_TIME);
    });
  });

  test("забронированный слот не показывается на странице участника", async ({ browser }) => {
    const runId = Date.now();
    const skillTag = `Help-${runId}`;
    const laterTime = shiftClock(tomorrowDate(ZONE), SLOT_TIME, 25).time;
    const host = await openParticipant(browser, accountContexts, makeUser("Pank", runId));
    const guest = await openParticipant(browser, accountContexts, makeUser("Normis", runId));
    const viewer = await openParticipant(browser, accountContexts, makeUser("Drift", runId));
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

    await test.step("Хост: добавляет два свободных слота на завтра", async () => {
      await host.slots.addSlot(date, SLOT_TIME);
      await host.slots.addSlot(date, laterTime);
    });

    await test.step("Хост: видит оба свободных слота", async () => {
      await expect(host.slots.slotByTime(SLOT_TIME)).toContainText("свободен");
      await expect(host.slots.slotByTime(laterTime)).toContainText("свободен");
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

    await test.step("Гость: открывает первый слот", async () => {
      await guest.booking.openSlot(SLOT_TIME);
    });

    await test.step("Гость: подтверждает бронирование", async () => {
      await guest.booking.confirmBooking();
    });

    await test.step("Гость: видит успешное бронирование", async () => {
      await expect(guest.booking.bookingConfirmSuccess).toBeVisible({ timeout: 15_000 });
      await expect(guest.booking.bookingConfirmError).toHaveCount(0);
    });

    await test.step("Зритель: регистрируется отдельным аккаунтом", async () => {
      await registerUserViaApi(viewer.page, viewer.user);
    });

    await test.step("Зритель: открывает каталог", async () => {
      await viewer.page.goto(ROUTES.pomidorqa);
    });

    await test.step("Зритель: ищет хоста по навыку", async () => {
      await viewer.booking.filterCatalog(skillTag);
    });

    await test.step("Зритель: видит карточку хоста", async () => {
      await expect(viewer.booking.personCard(host.user.name)).toBeVisible();
    });

    await test.step("Зритель: открывает карточку хоста", async () => {
      await viewer.booking.openPerson(host.user.name);
    });

    await test.step("Зритель: видит только оставшийся свободный слот", async () => {
      await expect(viewer.booking.slotTimes.filter({ hasText: laterTime })).toHaveText(laterTime);
      await expect(viewer.booking.slotTimes.filter({ hasText: SLOT_TIME })).toHaveCount(0);
    });
  });
});
