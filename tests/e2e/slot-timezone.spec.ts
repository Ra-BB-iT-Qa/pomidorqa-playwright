import { test, expect, type BrowserContext } from "@playwright/test";
import { makeUser, registerUserViaApi, cleanupUsersViaApi, ROUTES } from "../helpers/user";
import { openParticipant } from "../helpers/actor";

const HOST_TIMEZONE = "Asia/Yekaterinburg";
const GUEST_TIMEZONE = "Europe/Kaliningrad";
const SLOT_TIME = "15:00";

test.describe("Часовой пояс слота", () => {
  const accountContexts: BrowserContext[] = [];

  test.afterEach(async () => {
    await cleanupUsersViaApi(accountContexts);
    accountContexts.length = 0;
  });

  test("Гость видит слот в часовом поясе хоста", async ({ browser }) => {
    const runId = Date.now();
    const skillTag = `Korozia-metal-${runId}`;
    const slotDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const host = await openParticipant(browser, accountContexts, makeUser("Pank", runId));
    const guest = await openParticipant(browser, accountContexts, makeUser("Normis", runId));

    await test.step("Хост: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(host.page, host.user);
    });

    await test.step("Хост: ставит часовой пояс Екатеринбурга", async () => {
      await host.page.goto(ROUTES.profile);
      await host.profile.setTimezone(HOST_TIMEZONE);
      await host.page.reload();
    });

    await test.step("Хост: видит свой часовой пояс", async () => {
      await expect(host.profile.profileTimezoneSelect).toHaveValue(HOST_TIMEZONE);
    });

    await test.step("Хост: добавляет навык «могу помочь»", async () => {
      await host.profile.addSkill(skillTag, "can_help");
      await host.page.reload();
    });

    await test.step("Хост: видит навык в профиле", async () => {
      await expect(host.profile.canHelpSkills).toContainText(skillTag);
    });

    await test.step("Хост: добавляет свободный слот на завтра", async () => {
      await host.page.goto(ROUTES.mySlots);
      await host.slots.addSlot(slotDate, SLOT_TIME);
    });

    await test.step("Хост: видит слот в своём часовом поясе", async () => {
      await expect(host.slots.slotsCard.first()).toBeVisible();
      await expect(host.slots.timezoneNote).toContainText(HOST_TIMEZONE);
    });

    await test.step("Гость: регистрируется отдельным аккаунтом", async () => {
      await registerUserViaApi(guest.page, guest.user);
    });

    await test.step("Гость: ставит часовой пояс Калининграда", async () => {
      await guest.page.goto(ROUTES.profile);
      await guest.profile.setTimezone(GUEST_TIMEZONE);
      await guest.page.reload();
    });

    await test.step("Гость: видит свой часовой пояс", async () => {
      await expect(guest.profile.profileTimezoneSelect).toHaveValue(GUEST_TIMEZONE);
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

    await test.step("Гость: видит слот в часовом поясе хоста", async () => {
      await expect(guest.booking.slotTimes.filter({ hasText: SLOT_TIME })).toHaveText(SLOT_TIME);
      await expect(guest.booking.slotTimezoneNote).toContainText(HOST_TIMEZONE);
    });
  });
});
