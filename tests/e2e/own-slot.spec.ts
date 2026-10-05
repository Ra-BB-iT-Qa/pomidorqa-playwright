import { test, expect, type BrowserContext } from "@playwright/test";
import { makeUser, registerUserViaApi, cleanupUsersViaApi, ROUTES } from "../helpers/user";
import { openGuest, openParticipant } from "../helpers/actor";
import { tomorrowDate } from "../helpers/time";

const ZONE = "Europe/Moscow";
const SLOT_TIME = "12:00";

test.describe("Свой слот", () => {
  const accountContexts: BrowserContext[] = [];
  const guestContexts: BrowserContext[] = [];

  test.afterEach(async () => {
    await cleanupUsersViaApi(accountContexts);
    accountContexts.length = 0;
    await Promise.all(
      guestContexts.splice(0).map(async (context) => {
        try {
          await context.close();
        } catch (reason) {
          console.warn("Браузерный контекст уже закрыт:", reason);
        }
      }),
    );
  });

  test("Нельзя забронировать свой слот по прямой ссылке", async ({ browser }) => {
    const runId = Date.now();
    const skillTag = `Help-${runId}`;
    const date = tomorrowDate(ZONE);
    const host = await openParticipant(browser, accountContexts, makeUser(`Ember${runId}`, runId));
    const guest = await openGuest(browser, guestContexts);

    await test.step("Хост: регистрируется в PomidorQA", async () => {
      await registerUserViaApi(host.page, host.user);
    });

    await test.step("Хост: открывает профиль", async () => {
      await host.page.goto(ROUTES.profile);
    });

    await test.step("Хост: добавляет навык «могу помочь»", async () => {
      await host.profile.addSkill(skillTag, "can_help");
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

    await test.step("Гость: открывает каталог", async () => {
      await guest.page.goto(ROUTES.pomidorqa);
    });

    await test.step("Гость: ищет хоста по навыку", async () => {
      await guest.booking.filterCatalog(skillTag);
    });

    await test.step("Гость: видит карточку хоста", async () => {
      await expect(guest.booking.personCard(host.user.name)).toBeVisible();
    });

    let personPath = "";

    await test.step("Гость: берёт ссылку на страницу хоста", async () => {
      personPath = await guest.booking.personPath(host.user.name);
    });

    await test.step("Хост: открывает свою страницу по ссылке", async () => {
      await host.page.goto(personPath);
    });

    await test.step("Хост: видит своё имя", async () => {
      await expect(host.booking.personName).toHaveText(host.user.name);
    });

    await test.step("Хост: открывает свой слот", async () => {
      await host.booking.openSlot(SLOT_TIME);
    });

    await test.step("Хост: подтверждает бронирование", async () => {
      await host.booking.confirmBooking();
    });

    await test.step("Хост: видит отказ забронировать свой слот", async () => {
      await expect(host.booking.bookingConfirmError).toHaveText("Нельзя забронировать собственный слот");
      await expect(host.booking.bookingConfirmSuccess).toHaveCount(0);
    });

    await test.step("Хост: открывает свои слоты", async () => {
      await host.page.goto(ROUTES.mySlots);
    });

    await test.step("Хост: видит, что слот остался свободным", async () => {
      await expect(host.slots.slotByTime(SLOT_TIME)).toContainText("свободен");
    });
  });
});
