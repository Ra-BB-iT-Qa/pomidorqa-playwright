import { test, expect, type BrowserContext } from "@playwright/test";
import { makeUser, registerUserViaApi, cleanupUsersViaApi, ROUTES } from "../helpers/user";
import { openParticipant } from "../helpers/actor";
import { tomorrowDate } from "../helpers/time";

const ZONE = "Europe/Moscow";
const SLOT_TIME = "12:00";

test.describe("Каталог", () => {
  const accountContexts: BrowserContext[] = [];

  test.afterEach(async () => {
    await cleanupUsersViaApi(accountContexts);
    accountContexts.length = 0;
  });

  test("В каталоге только участники со свободным слотом в будущем, в поиске себя не видно", async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const runId = Date.now();
    const skillTag = `Help-${runId}`;
    const date = tomorrowDate(ZONE);
    const host = await openParticipant(browser, accountContexts, makeUser(`Astra${runId}`, runId));
    const guest1 = await openParticipant(browser, accountContexts, makeUser(`Boreal${runId}`, runId));
    const guest2 = await openParticipant(browser, accountContexts, makeUser(`Cinder${runId}`, runId));
    const guest3 = await openParticipant(browser, accountContexts, makeUser(`Drift${runId}`, runId));

    await test.step("Хост: со слотом: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(host.page, host.user);
    });

    await test.step("Хост: со слотом: открывает профиль", async () => {
      await host.page.goto(ROUTES.profile);
    });

    await test.step("Хост: со слотом: добавляет навык «могу помочь»", async () => {
      await host.profile.addSkill(skillTag, "can_help");
    });

    await test.step("Хост: со слотом: обновляет страницу и видит навык в профиле", async () => {
      await host.page.reload();
      await expect(host.profile.canHelpSkill(skillTag)).toBeVisible();
    });

    await test.step("Хост: со слотом: открывает свои слоты", async () => {
      await host.page.goto(ROUTES.mySlots);
    });

    await test.step("Хост: со слотом: добавляет свободный слот на завтра", async () => {
      await host.slots.addSlot(date, SLOT_TIME);
    });

    await test.step("Хост: со слотом: видит свободный слот", async () => {
      await expect(host.slots.slotByTime(SLOT_TIME)).toContainText("свободен");
    });

    await test.step("Гость 1: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(guest1.page, guest1.user);
    });

    await test.step("Гость 1: открывает профиль", async () => {
      await guest1.page.goto(ROUTES.profile);
    });

    await test.step("Гость 1: добавляет навык «хочу разобрать»", async () => {
      await guest1.profile.addSkill(skillTag, "want_to_learn");
      await guest1.page.reload();
    });

    await test.step("Гость 1: видит навык в профиле", async () => {
      await expect(guest1.profile.wantToLearnSkill(skillTag)).toBeVisible();
      await expect(guest1.profile.canHelpSkill(skillTag)).toHaveCount(0);
    });

    await test.step("Гость 1: открывает свои слоты", async () => {
      await guest1.page.goto(ROUTES.mySlots);
    });

    await test.step("Гость 1: добавляет свободный слот на завтра", async () => {
      await guest1.slots.addSlot(date, SLOT_TIME);
    });

    await test.step("Гость 1: видит свободный слот", async () => {
      await expect(guest1.slots.slotByTime(SLOT_TIME)).toContainText("свободен");
    });

    await test.step("Гость 2: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(guest2.page, guest2.user);
    });

    await test.step("Гость 2: открывает профиль", async () => {
      await guest2.page.goto(ROUTES.profile);
    });

    await test.step("Гость 2: добавляет навык «могу помочь»", async () => {
      await guest2.profile.addSkill(skillTag, "can_help");
      await guest2.page.reload();
    });

    await test.step("Гость 2: видит навык в профиле", async () => {
      await expect(guest2.profile.canHelpSkill(skillTag)).toBeVisible();
    });

    await test.step("Гость 3: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(guest3.page, guest3.user);
    });

    await test.step("Гость 3: открывает профиль", async () => {
      await guest3.page.goto(ROUTES.profile);
    });

    await test.step("Гость 3: добавляет тот же навык «могу помочь»", async () => {
      await guest3.profile.addSkill(skillTag, "can_help");
      await guest3.page.reload();
    });

    await test.step("Гость 3: видит навык в профиле", async () => {
      await expect(guest3.profile.canHelpSkill(skillTag)).toBeVisible();
    });

    await test.step("Гость 3: открывает свои слоты", async () => {
      await guest3.page.goto(ROUTES.mySlots);
    });

    await test.step("Гость 3: добавляет свободный слот на завтра", async () => {
      await guest3.slots.addSlot(date, SLOT_TIME);
    });

    await test.step("Гость 3: видит свободный слот", async () => {
      await expect(guest3.slots.slotByTime(SLOT_TIME)).toContainText("свободен");
    });

    await test.step("Гость 3: открывает каталог", async () => {
      await guest3.page.goto(ROUTES.pomidorqa);
    });

    await test.step("Гость 3: видит участников со свободным слотом и не видит себя", async () => {
      await expect(guest3.booking.personCard(host.user.name)).toBeVisible();
      await expect(guest3.booking.personCard(guest1.user.name)).toBeVisible();
      await expect(guest3.booking.personCard(guest2.user.name)).not.toBeVisible();
      await expect(guest3.booking.personCard(guest3.user.name)).toHaveCount(0);
    });

    await test.step("Гость 3: ищет по навыку", async () => {
      await guest3.booking.filterCatalog(skillTag);
    });

    await test.step("Гость 3: видит участника с навыком «могу помочь» и не видит себя", async () => {
      await expect(guest3.booking.personCard(host.user.name)).toBeVisible();
      await expect(guest3.booking.personCard(guest1.user.name)).toHaveCount(0);
      await expect(guest3.booking.personCard(guest2.user.name)).toHaveCount(0);
      await expect(guest3.booking.personCard(guest3.user.name)).toHaveCount(0);
    });

    await test.step("Хост: со слотом: открывает каталог", async () => {
      await host.page.goto(ROUTES.pomidorqa);
    });

    await test.step("Хост: со слотом: ищет по тому же навыку", async () => {
      await host.booking.filterCatalog(skillTag);
    });

    await test.step("Хост: со слотом: видит участника с навыком «могу помочь» и не видит себя", async () => {
      await expect(host.booking.personCard(guest3.user.name)).toBeVisible();
      await expect(host.booking.personCard(guest1.user.name)).toHaveCount(0);
      await expect(host.booking.personCard(guest2.user.name)).toHaveCount(0);
      await expect(host.booking.personCard(host.user.name)).toHaveCount(0);
    });
  });

  test("Поиск по навыку не показывает участника только с «хочу разобрать»", async ({ browser }) => {
    const runId = Date.now();
    const skillTag = `Learn-${runId}`;
    const date = tomorrowDate(ZONE);
    const guest1 = await openParticipant(browser, accountContexts, makeUser(`Lumen${runId}`, runId));
    const guest2 = await openParticipant(browser, accountContexts, makeUser(`Quartz${runId}`, runId));

    await test.step("Гость 1: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(guest1.page, guest1.user);
    });

    await test.step("Гость 1: открывает профиль", async () => {
      await guest1.page.goto(ROUTES.profile);
    });

    await test.step("Гость 1: добавляет навык", async () => {
      await guest1.profile.addSkill(skillTag, "want_to_learn");
      await guest1.page.reload();
    });   

    await test.step("Гость 1: видит навык только в «хочу разобрать»", async () => {
      await expect(guest1.profile.wantToLearnSkill(skillTag)).toBeVisible();
      await expect(guest1.profile.canHelpSkill(skillTag)).toHaveCount(0);
    });

    await test.step("Гость 1: открывает свои слоты", async () => {
      await guest1.page.goto(ROUTES.mySlots);
    });

    await test.step("Гость 1: добавляет свободный слот на завтра", async () => {
      await guest1.slots.addSlot(date, SLOT_TIME);
    });

    await test.step("Гость 1: видит свободный слот", async () => {
      await expect(guest1.slots.slotByTime(SLOT_TIME)).toContainText("свободен");
    });

    await test.step("Гость 2: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(guest2.page, guest2.user);
    });

    await test.step("Гость 2: открывает каталог", async () => {
      await guest2.page.goto(ROUTES.pomidorqa);
    });

    await test.step("Гость 2: видит участника со свободным слотом", async () => {
      await expect(guest2.booking.personCard(guest1.user.name)).toBeVisible();
    });

    await test.step("Гость 2: ищет по навыку", async () => {
      await guest2.booking.filterCatalog(skillTag);
    });

    await test.step("Гость 2: не видит участника с «хочу разобрать»", async () => {
      await expect(guest2.booking.personCard(guest1.user.name)).toHaveCount(0);
    });
  });
});
