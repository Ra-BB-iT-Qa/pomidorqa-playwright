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

  test("в каталоге только участники со свободным слотом в будущем, в поиске себя не видно", async ({
    browser,
  }) => {
    const runId = Date.now();
    const skillTag = `Help-${runId}`;
    const date = tomorrowDate(ZONE);
    const available = await openParticipant(browser, accountContexts, makeUser(`Astra${runId}`, runId));
    const learner = await openParticipant(browser, accountContexts, makeUser(`Boreal${runId}`, runId));
    const idle = await openParticipant(browser, accountContexts, makeUser(`Cinder${runId}`, runId));
    const viewer = await openParticipant(browser, accountContexts, makeUser(`Drift${runId}`, runId));

    await test.step("Хост со слотом: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(available.page, available.user);
    });

    await test.step("Хост со слотом: открывает профиль", async () => {
      await available.page.goto(ROUTES.profile);
    });

    await test.step("Хост со слотом: добавляет навык «могу помочь»", async () => {
      await available.profile.addSkill(skillTag, "can_help");
    });

    await test.step("Хост со слотом: видит навык в профиле", async () => {
      await expect(available.profile.canHelpSkill(skillTag)).toBeVisible();
    });

    await test.step("Хост со слотом: открывает свои слоты", async () => {
      await available.page.goto(ROUTES.mySlots);
    });

    await test.step("Хост со слотом: добавляет свободный слот на завтра", async () => {
      await available.slots.addSlot(date, SLOT_TIME);
    });

    await test.step("Хост со слотом: видит свободный слот", async () => {
      await expect(available.slots.slotByTime(SLOT_TIME)).toContainText("свободен");
    });

    await test.step("Хост с навыком «хочу разобрать»: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(learner.page, learner.user);
    });

    await test.step("Хост с навыком «хочу разобрать»: открывает профиль", async () => {
      await learner.page.goto(ROUTES.profile);
    });

    await test.step("Хост с навыком «хочу разобрать»: добавляет навык", async () => {
      await learner.profile.addSkill(skillTag, "want_to_learn");
    });

    await test.step("Хост с навыком «хочу разобрать»: видит навык в профиле", async () => {
      await expect(learner.profile.wantToLearnSkill(skillTag)).toBeVisible();
      await expect(learner.profile.canHelpSkill(skillTag)).toHaveCount(0);
    });

    await test.step("Хост с навыком «хочу разобрать»: открывает свои слоты", async () => {
      await learner.page.goto(ROUTES.mySlots);
    });

    await test.step("Хост с навыком «хочу разобрать»: добавляет свободный слот на завтра", async () => {
      await learner.slots.addSlot(date, SLOT_TIME);
    });

    await test.step("Хост с навыком «хочу разобрать»: видит свободный слот", async () => {
      await expect(learner.slots.slotByTime(SLOT_TIME)).toContainText("свободен");
    });

    await test.step("Хост без слота: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(idle.page, idle.user);
    });

    await test.step("Хост без слота: открывает профиль", async () => {
      await idle.page.goto(ROUTES.profile);
    });

    await test.step("Хост без слота: добавляет навык «могу помочь»", async () => {
      await idle.profile.addSkill(skillTag, "can_help");
    });

    await test.step("Хост без слота: видит навык в профиле", async () => {
      await expect(idle.profile.canHelpSkill(skillTag)).toBeVisible();
    });

    await test.step("Зритель: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(viewer.page, viewer.user);
    });

    await test.step("Зритель: открывает профиль", async () => {
      await viewer.page.goto(ROUTES.profile);
    });

    await test.step("Зритель: добавляет тот же навык «могу помочь»", async () => {
      await viewer.profile.addSkill(skillTag, "can_help");
    });

    await test.step("Зритель: видит навык в профиле", async () => {
      await expect(viewer.profile.canHelpSkill(skillTag)).toBeVisible();
    });

    await test.step("Зритель: открывает свои слоты", async () => {
      await viewer.page.goto(ROUTES.mySlots);
    });

    await test.step("Зритель: добавляет свободный слот на завтра", async () => {
      await viewer.slots.addSlot(date, SLOT_TIME);
    });

    await test.step("Зритель: видит свободный слот", async () => {
      await expect(viewer.slots.slotByTime(SLOT_TIME)).toContainText("свободен");
    });

    await test.step("Зритель: открывает каталог", async () => {
      await viewer.page.goto(ROUTES.pomidorqa);
    });

    await test.step("Зритель: видит участников со свободным слотом и не видит себя", async () => {
      await expect(viewer.booking.personCard(available.user.name)).toBeVisible();
      await expect(viewer.booking.personCard(learner.user.name)).toBeVisible();
      await expect(viewer.booking.personCard(idle.user.name)).toHaveCount(0);
      await expect(viewer.booking.personCard(viewer.user.name)).toHaveCount(0);
    });

    await test.step("Зритель: ищет по навыку", async () => {
      await viewer.booking.filterCatalog(skillTag);
    });

    await test.step("Зритель: видит участника с навыком «могу помочь» и не видит себя", async () => {
      await expect(viewer.booking.personCard(available.user.name)).toBeVisible();
      await expect(viewer.booking.personCard(idle.user.name)).toHaveCount(0);
      await expect(viewer.booking.personCard(viewer.user.name)).toHaveCount(0);
    });

    await test.step("Хост со слотом: открывает каталог", async () => {
      await available.page.goto(ROUTES.pomidorqa);
    });

    await test.step("Хост со слотом: ищет по тому же навыку", async () => {
      await available.booking.filterCatalog(skillTag);
    });

    await test.step("Хост со слотом: видит зрителя и не видит себя", async () => {
      await expect(available.booking.personCard(viewer.user.name)).toBeVisible();
      await expect(available.booking.personCard(available.user.name)).toHaveCount(0);
      await expect(available.booking.personCard(idle.user.name)).toHaveCount(0);
    });
  });
});
